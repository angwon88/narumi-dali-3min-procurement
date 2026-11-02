/* 공방: 가격 · 영업 상태 · 구매 · 나르미 검증 · 수상한 공방 (기획서 3.3, 3.4, 3.6, 3.7)
   상태(status): open 영업 / closing 속인 뒤 사라지는 중 / caught 적발 연출 / empty 빈 칸(REOPEN_SEC 뒤 새 공방)
   경쟁 유지(기획서 3.8): 행마다 연속 구매 수 → 3이면 옆 공방 경고, 5면 옆 공방 폐업 + 남은 공방 독점(가격 ×1.3)
   인증제(기획서 3.6, 2026-11-02): 인증된 공방(certT > 0)에서만 구매. 처음 문 연 공방은 인증 상태, 새로 개업한 공방은 미인증.
     인증은 CERT_SEC초 뒤 만료 → 나르미로 재검증. 수상한 공방은 검증하면 적발, 방치하면 FAKE_BID_SEC초 뒤 부정 낙찰.
   혁신은 이후 작업에서 얹는다. */
'use strict';
G.shops = (() => {
  const C = G.C, U = G.U;
  const round1 = v => Math.round(v * 10) / 10;
  const TAG_W = 62, FLAG_SEC = 15, CLOSE_SHOW = 1.5, REVEAL_SEC = 1.5;

  function init(S) {
    S.shops = G.world.shops.map(w => ({
      w, idx: w.idx, cat: w.cat.id, mults: {}, status: 'open', fake: false, verified: false,
      fx: null, openFx: null, stampT: 0, flagT: 0, t: Math.random() * 3, closeT: 0, revealT: 0, reopenT: 0,
      lonely: false, monopoly: false, innov: false, growT: null, certT: 0, bidT: 0,
    }));
    for (const sh of S.shops) if (S.openCats.has(sh.cat)) certify(sh, U.rand(C.CERT_START[0], C.CERT_START[1]));
    S.streak = [0, 1, 2, 3].map(() => ({ shop: -1, n: 0 }));
    S.streakWarn = C.STREAK_WARN; S.streakClose = C.STREAK_CLOSE;
    for (let r = 0; r < 4; r++) rollRow(S, r);
    S.priceClock = C.PRICE_REROLL_SEC;
    S.inspectCD = 0; S.inspectCDMax = C.INSPECT_COOLDOWN; S.certSec = C.CERT_SEC;
    S.data = 0; S.dataLv = 0; S.dualInspect = false;
    S.fakeClock = 0; S.firstFakeDone = false; S.firstScam = false;
    S.buy = { shop: null, dwell: 0, warned: false };
  }

  // ---------- 가격 ----------
  // 물건마다 따로 가격 배율 (2026-11-01: 공방 하나에 배율 하나 → 물건별로 변경. 실제 조달도 품목별 입찰)
  // 같은 물건의 정상 공방 두 곳은 0.05 이상 차이. 수상한 공방은 자기 가격 유지
  const rollNormal = () => U.rand(C.PRICE_NORMAL[0], C.PRICE_NORMAL[1]);
  function rollRow(S, r) {
    const a = S.shops[r * 2], b = S.shops[r * 2 + 1];
    for (const it of itemsOf(a)) {
      if (!a.fake) a.mults[it.id] = rollNormal();
      if (!b.fake) { let n = 0; do b.mults[it.id] = rollNormal(); while (!a.fake && Math.abs(a.mults[it.id] - b.mults[it.id]) < 0.05 && ++n < 50); }
    }
  }
  // 인증: 남은 시간 t초. verified는 그리기·안내용 표시값
  function certify(sh, t, stamp) { sh.certT = t; sh.verified = t > 0; sh.stampT = stamp ? 0 : 1; }   // 도장은 나르미 검증 때만
  const certified = sh => sh.innov || sh.certT > 0;
  const isOpen = (S, sh) => sh.status === 'open' && S.openCats.has(sh.cat);
  const itemsOf = sh => G.ITEMS.filter(i => i.cat === sh.cat);
  const price = (sh, itemId) => round1(G.ITEM[itemId].price * (sh.mults[itemId] || 1) * (sh.monopoly ? C.MONOPOLY_MULT : 1) * (sh.innov ? C.INNOV_PRICE_MULT : 1) * G.events.priceMult(sh));
  const partner = (S, sh) => S.shops[sh.idx ^ 1];

  function opened(S, cat) { for (const sh of S.shops) if (sh.cat === cat) { sh.openFx = 0; certify(sh, U.rand(C.CERT_START[0], C.CERT_START[1])); } }

  // 20초마다 가격 다시 뽑기. 바뀐 공방 간판은 1.5초 반짝이며 ▲(비싸짐)·▼(싸짐) 표시
  function reroll(S) {
    const before = S.shops.map(sh => ({ ...sh.mults }));
    for (let r = 0; r < 4; r++) rollRow(S, r);
    for (const sh of S.shops) {
      const dirs = {}; let any = false;
      for (const it of itemsOf(sh)) { const d = sh.mults[it.id] - before[sh.idx][it.id]; if (Math.abs(d) > 0.005) { dirs[it.id] = d > 0 ? 1 : -1; any = true; } }
      sh.fx = isOpen(S, sh) && any ? { t: 0, dirs } : null;
    }
  }

  // ---------- 새 공방 개업 (빈 칸 재개업 · 수상한 공방 교체) ----------
  function newShop(S, sh, fake) {
    Object.assign(sh, { status: 'open', fake, verified: false, certT: 0, bidT: fake ? C.FAKE_BID_SEC : 0, fx: null, openFx: 0, stampT: 0, flagT: FLAG_SEC, closeT: 0, revealT: 0, reopenT: 0, lonely: false, monopoly: false, closeWhy: null });
    const p0 = partner(S, sh);
    if (p0.monopoly) { p0.monopoly = false; const b = p0.w.body; G.fx.add(S, b.x + b.w / 2, b.y + 8, '경쟁 공방이 생겨 독점이 풀렸어요', '#9be37a'); }
    S.streak[sh.idx >> 1] = { shop: -1, n: 0 };
    const p = partner(S, sh);
    for (const it of itemsOf(sh)) {
      if (fake) { sh.mults[it.id] = U.rand(C.PRICE_FAKE[0], C.PRICE_FAKE[1]); continue; }
      let n = 0;
      do sh.mults[it.id] = rollNormal(); while (!p.fake && p.status === 'open' && Math.abs(p.mults[it.id] - sh.mults[it.id]) < 0.05 && ++n < 50);
    }
    if (fake) S.stats.fakeSpawned = (S.stats.fakeSpawned || 0) + 1;
  }
  const fakeCount = S => S.shops.filter(sh => sh.fake && (sh.status === 'open' || sh.status === 'closing')).length;
  const fakeMax = S => (S.elapsed >= 90 ? 2 : 1);
  // 수상한 공방 등장: 수상한 공방이 없는 열린 행에서, 빈 칸이 있으면 거기, 없으면 공방 하나를 교체
  function spawnFake(S) {
    if (fakeCount(S) >= fakeMax(S)) return false;
    const d = G.dali;
    const rows = [0, 1, 2, 3].filter(r => S.openCats.has(S.shops[r * 2].cat) && !S.shops[r * 2].fake && !S.shops[r * 2 + 1].fake);
    if (!rows.length) return false;
    const r = rows[Math.floor(Math.random() * rows.length)];
    const pair = [S.shops[r * 2], S.shops[r * 2 + 1]];
    let sh = pair.find(x => x.status === 'empty');
    if (!sh) {
      const cand = pair.filter(x => x.status === 'open' && !x.innov && !U.inRect(d.x, d.y, x.w.door));   // 달이가 서 있는 공방은 피함
      if (!cand.length) return false;
      sh = cand[Math.floor(Math.random() * cand.length)];
    }
    newShop(S, sh, true);
    return true;
  }
  G.director.on('firstFake', S => { S.firstFakeDone = true; spawnFake(S); S.fakeClock = 18; });
  function fakeTimer(S, dt) {
    if (!S.firstFakeDone) return;
    S.fakeClock -= dt;
    if (S.fakeClock > 0) return;
    const late = S.elapsed >= 90;                                     // 1:30부터 더 자주
    if (Math.random() < (late ? 0.7 : 0.6)) spawnFake(S);
    S.fakeClock += late ? 15 : 18;
  }

  // ---------- 구매 ----------
  function wanted(S, sh) {
    let best = null;
    for (const it of itemsOf(sh)) {
      const reqs = G.requests.active(S).filter(r => r.item === it.id).sort((a, b) => a.left - b.left);
      const carried = G.dali.bag.filter(b => b.item === it.id).length;
      if (reqs.length > carried) { const r = reqs[carried]; if (!best || r.left < best.left) best = { item: it.id, left: r.left }; }
    }
    if (best) return best.item;
    const prep = itemsOf(sh).find(it => S.prep && S.prep.has(it.id));     // 예보 중: 대비 물건은 요청 없이도 삼
    return prep ? prep.id : null;
  }
  function buy(S, sh, item) {
    const p = price(sh, item);
    const prep = !G.requests.active(S).some(r => r.item === item) || G.dali.bag.filter(b => b.item === item).length >= G.requests.active(S).filter(r => r.item === item).length;
    G.dali.bag.push({ item, paid: p, shop: sh.idx, fake: sh.fake, innov: sh.innov, prep });
    G.audio.play('buy');   // 수상한 물건도 겉보기는 같다
    S.stats.bought = (S.stats.bought || 0) + 1;
    const d = sh.w.door;
    G.fx.add(S, d.x + d.w / 2, d.y - 6, G.ITEM[item].name + ' 구매 ' + p + '만원', '#fff');
    if (sh.fake && sh.closeT === 0) sh.closeT = 0.0001;                  // 3초 뒤 사라짐
    compete(S, sh);
  }
  // ---------- 경쟁 유지 (기획서 3.8) ----------
  // 같은 공방에서 연달아 사면 streak +1, 옆 공방에서 사면 1부터 다시
  function compete(S, sh) {
    const row = sh.idx >> 1, st = S.streak[row], p = partner(S, sh);
    if (st.shop === sh.idx) st.n++; else { st.shop = sh.idx; st.n = 1; }
    sh.lonely = false;
    if (p.status !== 'open' || p.fake || p.innov) return;                // 비어 있거나 수상한·혁신 공방은 대상 아님
    if (st.n >= S.streakClose) {
      p.lonely = false; p.status = 'closing'; p.closeT = 0; p.closeWhy = 'comp';
      sh.monopoly = true;
      S.stats.closedByStreak = (S.stats.closedByStreak || 0) + 1;
      const b = p.w.body;
      G.fx.add(S, b.x + b.w / 2, b.y + 10, '손님이 없어 문을 닫았어요…', '#ffd6a0');
      G.fx.add(S, sh.w.body.x + sh.w.body.w / 2, sh.w.body.y + 10, '독점! 가격 ×' + C.MONOPOLY_MULT, '#ff8a7a', 16);
    } else if (st.n >= S.streakWarn) p.lonely = true;
  }
  function updateBuy(S, dt) {
    const dali = G.dali, B = S.buy;
    const sh = S.shops.find(s => isOpen(S, s) && U.inRect(dali.x, dali.y, s.w.door)) || null;
    if (sh !== B.shop) { B.shop = sh; B.dwell = 0; B.warned = false; }
    if (!sh) return;
    if (!certified(sh)) {                                          // 인증제: 미인증 공방에서는 못 삼
      B.dwell = 0;
      if (!B.warned && !dali.moving) { const d = sh.w.door; G.fx.add(S, d.x + d.w / 2, d.y - 6, sh.certExpired ? '인증 만료 · 공방을 눌러 재검증' : '미인증 공방 · 공방을 눌러 나르미 검증', '#ffd6a0'); B.warned = true; }
      return;
    }
    const item = wanted(S, sh);
    const full = dali.bag.length >= S.bagCap;
    const press = G.input.hit('e') || G.input.hit('enter');
    if (!item || full) {
      B.dwell = 0;
      if (!B.warned && (press || !dali.moving)) {
        const d = sh.w.door;
        G.fx.add(S, d.x + d.w / 2, d.y - 6, full ? '가방이 가득 찼어요' : '필요한 물건이 아니에요', '#ffd6a0');
        B.warned = true;
      }
      return;
    }
    B.warned = false;
    if (press) { buy(S, sh, item); B.dwell = 0; return; }
    if (G.settings.buyMode === 'auto') {
      B.dwell += dt;
      if (B.dwell >= (S.buyDwell || C.BUY_DWELL)) { buy(S, sh, item); B.dwell = 0; }
    }
  }

  // ---------- 매 프레임 ----------
  function update(S, dt) {
    S.priceClock -= dt;
    if (S.priceClock <= 0) { reroll(S); S.priceClock += C.PRICE_REROLL_SEC; }
    fakeTimer(S, dt);
    for (const sh of S.shops) {
      sh.t += dt;
      if (sh.fx && (sh.fx.t += dt) > 1.5) sh.fx = null;
      if (sh.openFx != null && (sh.openFx += dt) > 0.8) sh.openFx = null;
      if (sh.growT != null) sh.growT += dt;
      if (sh.flagT > 0) sh.flagT = Math.max(0, sh.flagT - dt);
      if (sh.status === 'open' && S.openCats.has(sh.cat) && !sh.innov && sh.certT > 0) {   // 인증 시간 감소 → 만료
        sh.certT = Math.max(0, sh.certT - dt); sh.verified = sh.certT > 0;
        if (sh.certT === 0) { sh.certExpired = true; S.stats.certExpired = (S.stats.certExpired || 0) + 1;
          const b = sh.w.body; G.fx.add(S, b.x + b.w / 2, b.y + 110, '인증 만료 · 재검증 필요', '#ffd6a0'); }
      }
      if (sh.status === 'open' && sh.fake && sh.bidT > 0 && (sh.bidT -= dt) <= 0) bidRig(S, sh);
      if (sh.status === 'open' && sh.closeT > 0 && (sh.closeT += dt) >= C.FAKE_VANISH_SEC) {   // 속인 수상한 공방이 사라짐
        sh.status = 'closing'; sh.closeT = 0; sh.closeWhy = 'scam';
        const b = sh.w.body; G.fx.add(S, b.x + b.w / 2, b.y + 10, '앗, 공방이 문을 닫았어요?', '#ffd6a0');
      } else if (sh.status === 'closing' && (sh.closeT += dt) >= CLOSE_SHOW) toEmpty(sh);
      else if (sh.status === 'caught' && (sh.revealT += dt) >= REVEAL_SEC) toEmpty(sh);
      else if (sh.status === 'empty' && (sh.reopenT -= dt) <= 0) {
        const fake = S.firstFakeDone && fakeCount(S) < fakeMax(S) && Math.random() < C.REOPEN_FAKE_CHANCE;
        newShop(S, sh, fake);
      }
    }
    updateBuy(S, dt);
  }
  // 부정 낙찰: 방치된 수상한 공방이 그 업종 요청 하나를 따내고 납품하지 않은 채 사라짐 (요청이 없으면 생길 때까지 기다림)
  function bidRig(S, sh) {
    const r = G.requests.active(S).filter(q => G.ITEM[q.item].cat === sh.cat).sort((a, b) => a.left - b.left)[0];
    if (!r) { sh.bidT = 0.5; return; }
    G.requests.stolen(S, r, sh);
    sh.status = 'closing'; sh.closeT = 0; sh.closeWhy = 'scam';
    const b = sh.w.body; G.fx.add(S, b.x + b.w / 2, b.y + 110, '부정 낙찰! 납품 없이 사라졌어요', '#ff8a7a', 16);
  }

  // 혁신 공방으로 성장 (레벨업 혁신제품 카드)
  function makeInnov(S, sh) {
    sh.innov = true; sh.growT = 0; sh.lonely = false; sh.trial = C.INNOV_TRIAL; sh.mature = false;
    S.stats.innov = (S.stats.innov || 0) + 1;
    const who = sh.w.cat.name + '공방 ' + sh.w.side;
    G.director.banner(S, who + G.U.josa(who, '이', '가') + ' 혁신 공방으로 성장했어요!', '혁신제품 시범구매 · 조달청이 첫 구매자가 되어 줬어요');
    G.audio.play('gift');
  }
  function toEmpty(sh) { Object.assign(sh, { status: 'empty', fake: false, verified: false, certT: 0, bidT: 0, certExpired: false, reopenT: C.REOPEN_SEC, closeT: 0, revealT: 0, flagT: 0, lonely: false, monopoly: false }); }

  // ---------- 나르미 검증 (기획서 3.6) ----------
  const shopAt = (S, p) => S.shops.find(sh => U.inRect(p.x, p.y, sh.w.body)) || null;
  function whyNot(S, sh) {
    if (sh.status === 'empty' || sh.status === 'closing' || sh.status === 'caught') return '빈 가게예요';
    if (!isOpen(S, sh)) return '아직 문을 안 열었어요';
    if (sh.innov) return '혁신 공방은 장기 인증이에요';
    if (sh.certT > C.CERT_RENEW_AT) return '인증이 넉넉해요 (' + Math.ceil(sh.certT) + '초)';
    if (G.narmi.busy() || S.inspectCD > 0) return '나르미가 숨 고르는 중 (' + Math.ceil(S.inspectCD) + '초)';
    return null;
  }
  function request(S, sh) {
    const why = whyNot(S, sh), b = sh.w.body;
    if (why) { G.fx.add(S, b.x + b.w / 2, b.y + 12, why, '#ffd6a0'); return false; }
    G.narmi.send(S, sh);
    G.audio.play('whoosh');
    S.stats.inspected = (S.stats.inspected || 0) + 1;
    return true;
  }
  // 검증 결과: 정상 → 초록 도장 / 수상한 공방 → 적발
  function inspected(S, sh) {
    const b = sh.w.body;
    if (sh.status !== 'open') return;                                   // 그사이 사라짐
    addData(S);
    if (S.dualInspect && !sh._dual) {                                   // 데이터 Lv3: 옆 공방도 함께 분석
      const p = partner(S, sh);
      if (p.status === 'open' && isOpen(S, p) && !p.innov && p.certT <= C.CERT_RENEW_AT) { p._dual = true; inspected(S, p); p._dual = false; }
    }
    if (sh.fake) {
      sh.status = 'caught'; sh.revealT = 0; sh.closeT = 0;
      S.catchStreak = (S.catchStreak || 0) + 1;
      const bonus = C.CATCH_SCORE + C.CATCH_STREAK_BONUS * (S.catchStreak - 1);
      S.score += bonus; G.score.trust(S, C.TRUST_CATCH);
      S.stats.caught = (S.stats.caught || 0) + 1;
      const fy = b.y + 110;                                             // 문구는 공방 아래 길에서 (HUD에 가리지 않게)
      G.fx.add(S, b.x + b.w / 2, fy, '적발! 실체 없는 공방 +' + bonus, '#ffe48a', 16);
      if (S.catchStreak >= 2) G.fx.add(S, b.x + b.w / 2, fy, '연속 적발 ×' + S.catchStreak + '!', '#ff8a7a', 16);
      G.fx.add(S, b.x + b.w / 2, fy, '부정 낙찰 막음 · 세금 ' + C.CATCH_BANK + '만원 지킴', '#9be37a');
      // 연출: 한순간 멈춤 + 화면 흔들림 + 파편 + 동전이 세금 저금통(HUD)으로
      S.hitStop = 0.15; S.shakeT = 0.35;
      G.fx.burst(S, b.x + b.w / 2, b.y + 32);
      G.fx.coins(S, b.x + b.w / 2, b.y + 32, 326, 32, 8, () => { S.saved = round1(S.saved + C.CATCH_BANK); G.gifts.add(S, C.CATCH_BANK); });
      G.narmi.say('실체 없는 공방 적발!', 1.8);
      G.audio.play('catch');
      G.fx.add(S, b.x + b.w / 2, b.y + 8, '마을 신뢰 +' + C.TRUST_CATCH, '#9be37a');
    } else {
      const renew = sh.certExpired || sh.certT > 0;
      certify(sh, S.certSec, true); sh.certExpired = false;
      S.stats[renew ? 'renewed' : 'certified'] = (S.stats[renew ? 'renewed' : 'certified'] || 0) + 1;
      G.fx.add(S, b.x + b.w / 2, b.y + 110, renew ? '✔ 재검증 완료 · 인증 ' + S.certSec + '초' : '✔ 거래 기록 정상 · 인증 ' + S.certSec + '초', '#9be37a');
      G.audio.play('ok');
    }
  }
  // 나르미 데이터 성장: 검증할 때마다 +1, DATA_LV마다 단계 상승
  function addData(S) {
    S.data++;
    const lv = C.DATA_LV.filter(n => S.data >= n).length;
    if (lv <= S.dataLv) return;
    S.dataLv = lv;
    const L = [null,
      ['나르미 데이터 분석 Lv1', '쉬는 시간이 짧아졌어요', () => { S.inspectCDMult *= 0.75; }],
      ['나르미 데이터 분석 Lv2', '위험 감지: 수상한 공방에 ? 표시', () => { S.fakeHint = true; }],
      ['나르미 데이터 분석 Lv3', '한 번에 같은 종류 두 공방을 분석', () => { S.dualInspect = true; }]][lv];
    L[2](); G.director.banner(S, L[0] + '!', '검증 ' + S.data + '회 · ' + L[1]); G.narmi.say('데이터가 쌓였어요!', 1.6); G.audio.play('levelup');
  }
  function handleInspectInput(S) {
    for (const p of G.input.taps) { const sh = shopAt(S, p); if (sh) { request(S, sh); return; } }
    if (G.input.hit(' ')) {
      const d = G.dali; let best = null, bd = 1e9;
      for (const sh of S.shops) {
        if (whyNot(S, sh)) continue;                                   // 검증할 수 있는 공방 중 가장 가까운 곳
        const c = sh.w.door, dist = Math.hypot(c.x + c.w / 2 - d.x, c.y + c.h / 2 - d.y);
        if (dist < bd) { bd = dist; best = sh; }
      }
      if (best) request(S, best);
    }
  }

  // ---------- 그리기 ----------
  const T = (...a) => G.world.text(...a);
  function shutter(ctx, b, k, label) {
    const h = Math.round((b.h - 22) * k); if (h <= 0) return;
    ctx.fillStyle = '#7d8590'; ctx.fillRect(b.x + 4, b.y + 22, b.w - 8, h);
    ctx.fillStyle = '#6a7179'; for (let y = b.y + 26; y < b.y + 22 + h; y += 6) ctx.fillRect(b.x + 4, y, b.w - 8, 2);
    if (label) T(ctx, label, b.x + b.w / 2, b.y + 43, 12, '#fff');
  }
  // 단서 ①: 굴뚝 연기 (정상만)
  function chimney(ctx, sh) {
    const b = sh.w.body, x = sh.w.wndX + 4, y = b.y - 10;
    ctx.fillStyle = '#7a3b2e'; ctx.fillRect(x, y, 10, 14); ctx.fillStyle = '#5c2a20'; ctx.fillRect(x - 1, y, 12, 3);
    if (sh.fake) return;
    for (let i = 0; i < 3; i++) {
      const k = ((sh.t / 1.5) + i / 3) % 1, r = 3 + k * 4;
      ctx.globalAlpha = 0.8 * (1 - k); ctx.fillStyle = '#f4f6f8';
      ctx.beginPath(); ctx.arc(x + 5 + Math.sin(k * 5 + i) * 4, y - 3 - k * 16, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // 단서 ②: 창문 안 일꾼 (수상한 공방은 커튼만)
  function windowView(ctx, sh) {
    const x = sh.w.wndX, y = sh.w.body.y + 30;
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - 1, y - 1, 20, 20);
    if (sh.fake) {
      ctx.fillStyle = '#c9a3b8'; ctx.fillRect(x, y, 18, 18);
      ctx.fillStyle = '#b08aa0'; for (let i = 0; i < 18; i += 4) ctx.fillRect(x + i, y, 2, 18);
      ctx.fillStyle = '#8d6a7f'; ctx.fillRect(x + 8, y, 2, 18);
      return;
    }
    ctx.fillStyle = '#ffe9b0'; ctx.fillRect(x, y, 18, 18);
    const up = Math.floor(sh.t * 4) % 2 === 0;
    ctx.fillStyle = '#4a3020'; ctx.fillRect(x + 4, y + 4, 6, 2);           // 머리카락
    ctx.fillStyle = '#f2c79b'; ctx.fillRect(x + 4, y + 6, 6, 5);           // 얼굴
    ctx.fillStyle = '#4f7cac'; ctx.fillRect(x + 2, y + 11, 10, 7);         // 몸
    ctx.fillStyle = '#6b4423'; ctx.fillRect(x + 12, up ? y + 6 : y + 10, 2, 6);   // 망치 자루
    ctx.fillStyle = '#7d7d7d'; ctx.fillRect(x + 11, up ? y + 4 : y + 9, 5, 3);    // 망치 머리
  }
  function priceTag(ctx, S, sh) {
    const b = sh.w.body, tx = sh.w.tagX, flash = sh.fx && Math.floor(sh.fx.t * 6) % 2 === 0;
    if (sh.fx) { ctx.fillStyle = flash ? '#ffd84a' : '#fff3b0'; ctx.fillRect(tx - 2, b.y + 23, TAG_W + 4, 38); }
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(tx, b.y + 25, TAG_W, 34);
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(tx, b.y + 41, TAG_W, 1);
    itemsOf(sh).forEach((it, i) => {
      const y = b.y + 33 + i * 17;
      G.icons.draw(ctx, it.id, tx + 9, y, 17);
      T(ctx, price(sh, it.id) + '만', tx + 32, y + 1, 12, sh.monopoly ? '#d9342b' : '#2a2416');
      const dir = sh.fx && sh.fx.dirs[it.id];
      if (dir) T(ctx, dir > 0 ? '▲' : '▼', tx + 57, y + 1, 12, dir > 0 ? '#d9342b' : '#2e9b3a');
    });
  }
  function flag(ctx, sh) {                       // '개업!' 깃발 (정상·수상한 공방 모두 같음)
    const b = sh.w.body, x = sh.w.doorGfx + 10, y = b.y - 8, wave = Math.sin(sh.t * 6) * 2;
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(x, y, 2, 30);
    ctx.fillStyle = '#e2433b'; ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 30, y + 3 + wave); ctx.lineTo(x + 30, y + 15 + wave); ctx.lineTo(x + 2, y + 14); ctx.fill();
    T(ctx, '개업!', x + 16, y + 8 + wave / 2, 12, '#fff');
  }
  function stamp(ctx, sh, text, col, cx, cy, big) {
    sh.stampT = Math.min(1, (sh.stampT || 0) + 1 / 60);
    const k = sh.stampT < 0.15 ? 1.8 - sh.stampT / 0.15 * 0.8 : 1, w = big ? 64 : 52;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.rotate(-0.12);
    ctx.fillStyle = col; ctx.fillRect(-w / 2, -8, w, 16); ctx.fillStyle = '#fffdf6'; ctx.fillRect(-w / 2 + 2, -6, w - 4, 12);
    ctx.fillStyle = col; ctx.fillRect(-w / 2 + 3, -5, w - 6, 10);
    T(ctx, text, 0, 1, 12, '#fff'); ctx.restore();
  }
  function innovLook(ctx, sh) {
    const b = sh.w.body, g = Math.min(1, (sh.growT || 0) / 0.6), pulse = g < 1 ? Math.sin(g * Math.PI) * 4 : 0;
    ctx.fillStyle = '#f6c431'; ctx.fillRect(b.x - 3 - pulse, b.y - pulse, b.w + 6 + pulse * 2, 22);        // 금빛 지붕
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(b.x - 3, b.y, b.w + 6, 3);
    T(ctx, '★혁신 ' + sh.w.cat.name + sh.w.side, b.x + b.w / 2, b.y + 11, 12, '#5a3a00');
    // 시범 사용 진행 / 성공 판정 표시 (공방 아래 길)
    const tag = sh.mature ? '★ 성공 판정' : '시범 사용 ' + (C.INNOV_TRIAL - sh.trial) + '/' + C.INNOV_TRIAL;
    ctx.fillStyle = sh.mature ? '#e0a800' : '#5a3a00'; ctx.fillRect(b.x + b.w / 2 - 34, b.y + 66, 68, 14);
    T(ctx, tag, b.x + b.w / 2, b.y + 73, 12, '#fff');
    for (let i = 0; i < 3; i++) {                                                                       // 반짝임
      const k = ((sh.t * 0.8) + i / 3) % 1, x = b.x + 10 + ((i * 47 + Math.floor(sh.t)) % (b.w - 20)), y = b.y + 26 + i * 10;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff6b0'; ctx.fillRect(x, y - 3, 1, 7); ctx.fillRect(x - 3, y, 7, 1); ctx.globalAlpha = 1;
    }
  }
  // 인증 표시: 인증 중이면 건물 아래 남은 시간 막대, 미인증·만료면 가격표 위 회색 띠 + 자물쇠
  function certLook(ctx, S, sh) {
    if (sh.innov || sh.status !== 'open') return;
    const b = sh.w.body, x = b.x + 6, w = b.w - 12, y = b.y + 64;   // 건물 바로 아래 길 위
    if (sh.certT > 0) {
      const f = sh.certT / S.certSec, low = sh.certT <= C.CERT_RENEW_AT;
      const blink = sh.certT <= 8 && Math.floor(sh.t * 4) % 2 === 0;
      ctx.fillStyle = 'rgba(20,24,30,.7)'; ctx.fillRect(x - 1, y - 1, w + 2, 7);
      ctx.fillStyle = blink ? '#fff' : f > 0.5 ? '#46b04a' : low && f > 0.2 ? '#f2b632' : '#e5533d';
      ctx.fillRect(x, y, Math.round(w * Math.min(1, f)), 5);
      if (low) { ctx.fillStyle = '#fff'; ctx.fillRect(x + Math.round(w * C.CERT_RENEW_AT / S.certSec), y - 1, 1, 7); }   // 재검증 가능 표시선
      if (sh.stampT < 1) stamp(ctx, sh, '✔ 인증', '#2e9b3a', sh.w.tagX + TAG_W / 2, b.y + 44);   // 인증 순간 도장
      return;
    }
    // 미인증: 가격표를 어둡게 + 자물쇠 띠 (가격은 보여서 검증할 가치가 있는지 판단 가능)
    const tx = sh.w.tagX, blink = Math.floor(sh.t * 2) % 2 === 0;
    ctx.fillStyle = 'rgba(40,44,52,.45)'; ctx.fillRect(tx, b.y + 25, TAG_W, 34);
    ctx.fillStyle = sh.certExpired ? (blink ? '#c0392b' : '#8a2a20') : '#4a4f57'; ctx.fillRect(tx - 2, b.y + 15, TAG_W + 4, 12);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(tx + 3, b.y + 19, 7, 6); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(tx + 6.5, b.y + 19, 2.5, Math.PI, 0); ctx.stroke(); ctx.lineWidth = 1;
    T(ctx, sh.certExpired ? '인증 만료' : '미인증', tx + TAG_W / 2 + 5, b.y + 21, 12, '#fff');
  }
  function emptyLot(ctx, sh, S) {
    const b = sh.w.body;
    ctx.fillStyle = '#6fae4a'; ctx.fillRect(b.x - 3, b.y - 2, b.w + 6, b.h + 2);
    ctx.fillStyle = '#b89d66'; for (let x = b.x; x < b.x + b.w; x += 10) ctx.fillRect(x, b.y + b.h - 14, 3, 12);
    ctx.fillRect(b.x, b.y + b.h - 11, b.w, 2); ctx.fillRect(b.x, b.y + b.h - 6, b.w, 2);
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(b.x + b.w / 2 - 34, b.y + 14, 68, 22);
    ctx.fillStyle = '#6b4423'; ctx.fillRect(b.x + b.w / 2 - 1, b.y + 36, 2, 14);
    T(ctx, '빈 가게', b.x + b.w / 2, b.y + 25, 12, '#4a3f2a');
  }
  function caughtView(ctx, sh) {                // 적발: 간판이 떨어지고 빈 창고·서류 더미가 드러남
    const b = sh.w.body, k = Math.min(1, sh.revealT / 0.4);
    ctx.fillStyle = '#4a4f57'; ctx.fillRect(b.x + 4, b.y + 22, b.w - 8, b.h - 22);
    ctx.fillStyle = '#f4f4f4';
    for (let i = 0; i < 3; i++) { ctx.fillRect(b.x + 14 + i * 4, b.y + 50 - i * 5, 22, 4); }
    ctx.fillStyle = '#c9c9c9'; ctx.fillRect(b.x + 14, b.y + 54, 30, 2);
    T(ctx, '텅…', b.x + b.w - 24, b.y + 44, 12, '#cfd8e3');
    ctx.save(); ctx.translate(b.x + b.w / 2, b.y + 11 + k * 40); ctx.rotate(k * 0.5);          // 떨어지는 간판
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(-44, -10, 88, 20); T(ctx, sh.w.cat.name + '공방', 0, 0, 12, '#fff'); ctx.restore();
    stamp(ctx, sh, '적발!', '#d9342b', b.x + b.w / 2, b.y + 30, true);
  }
  function draw(ctx, S) {
    for (const sh of S.shops) {
      const b = sh.w.body;
      if (!S.openCats.has(sh.cat)) { shutter(ctx, b, 1, '준비 중'); continue; }
      if (sh.status === 'empty') { emptyLot(ctx, sh, S); continue; }
      if (sh.status === 'caught') { caughtView(ctx, sh); continue; }
      if (sh.innov) innovLook(ctx, sh);
      chimney(ctx, sh);
      windowView(ctx, sh);
      priceTag(ctx, S, sh);
      if (sh.status === 'closing') {               // 속인 뒤: 셔터 + 폐업 팻말
        shutter(ctx, b, Math.min(1, sh.closeT / 0.4), '');
        ctx.fillStyle = '#fffdf6'; ctx.fillRect(b.x + b.w / 2 - 34, b.y + 34, 68, 20);
        T(ctx, sh.closeWhy === 'comp' ? '손님 없음' : '폐업', b.x + b.w / 2, b.y + 44, 12, '#d9342b');
        continue;
      }
      if (sh.lonely) {                             // 경고: 간판이 어두워지고 '손님이 없어요…'
        ctx.fillStyle = 'rgba(20,24,30,.38)'; ctx.fillRect(b.x, b.y + 18, b.w, b.h - 18);
        const bx = b.x + b.w / 2, by = b.y + 42 + Math.sin(sh.t * 3) * 1.5;
        ctx.fillStyle = '#fffdf6'; ctx.fillRect(bx - 48, by - 9, 96, 18);
        ctx.fillStyle = '#3a3a3a'; ctx.fillRect(bx - 48, by - 9, 96, 1); ctx.fillRect(bx - 48, by + 8, 96, 1);
        T(ctx, '손님이 없어요…', bx, by, 12, '#4a3f2a');
      }
      if (sh.monopoly) {                           // 독점: 빨간 띠
        ctx.fillStyle = '#d9342b'; ctx.fillRect(sh.w.tagX + 15, b.y + 12, 32, 13);
        T(ctx, '독점', sh.w.tagX + 31, b.y + 18, 12, '#fff');
      }
      if (sh.openFx != null) shutter(ctx, b, 1 - sh.openFx / 0.8, '');
      if (sh.flagT > 0) flag(ctx, sh);
      if (sh.fake && S.fakeHint) {                 // 나르미 데이터 Lv2: 수상한 공방 간판에 ?
        const qx = sh.w.wndX + 11, qy = b.y + 8 + Math.sin(sh.t * 4) * 2;
        ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(qx, qy, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(qx, qy, 8, 0, Math.PI * 2); ctx.fill();
        T(ctx, '?', qx, qy + 1, 12, '#2a2416');
      }
      certLook(ctx, S, sh);
    }
  }
  // 문 앞 안내 풍선 (2026-11-02 가시성): 달이가 공방 문 앞에 서면 물건 이름·가격·인증 상태를 크게
  function drawDoorInfo(ctx, S) {
    const sh = S.buy && S.buy.shop; if (!sh || sh.status !== 'open') return;
    const d = sh.w.door, items = itemsOf(sh), w = 132, h = 22 + items.length * 22;
    const x = Math.max(4, Math.min(C.VIEW.w - w - 4, d.x + d.w / 2 - w / 2)), y = d.y + d.h + 6;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(x, y, w, h);
    const ok = certified(sh);
    ctx.fillStyle = ok ? '#2e9b3a' : sh.certExpired ? '#c0392b' : '#4a4f57'; ctx.fillRect(x, y, w, 18);
    T(ctx, sh.innov ? '★ 혁신 공방' : ok ? '✔ 인증 ' + Math.ceil(sh.certT) + '초' : sh.certExpired ? '인증 만료 · 재검증' : '미인증 · 검증 필요', x + w / 2, y + 9, 12, '#fff');
    items.forEach((it, i) => {
      const ry = y + 31 + i * 22, p = price(sh, it.id), up = p > it.price;
      G.icons.draw(ctx, it.id, x + 16, ry, 20);
      ctx.font = '12px "Galmuri11 Bold", ' + G.FONT; ctx.fillStyle = '#2a2416'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(it.name, x + 30, ry + 1);
      T(ctx, p + '만', x + w - 8, ry + 1, 12, up ? '#d9342b' : '#2e6b2e', 'right');
    });
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.lineWidth = 1;
  }
  function drawHover(ctx, S) {
    const m = G.input.mouse; if (m.x < 0) { G.canvas.style.cursor = ''; return; }
    const sh = shopAt(S, m);
    G.canvas.style.cursor = sh ? 'pointer' : '';
    if (!sh) return;
    const b = sh.w.body, ok = !whyNot(S, sh);
    ctx.strokeStyle = ok ? '#ffd84a' : 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6); ctx.setLineDash([]); ctx.lineWidth = 1;
  }
  return { drawDoorInfo, certified, request, whyNot, makeInnov, init, update, draw, drawHover, price, isOpen, rollRow, opened, inspected, handleInspectInput, shopAt, spawnFake, newShop };
})();
