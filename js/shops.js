/* 공방: 가격 · 영업 상태 · 구매 · 나르미 검증 · 수상한 공방 (기획서 3.3, 3.4, 3.6, 3.7)
   상태(status): open 영업 / closing 속인 뒤 사라지는 중 / caught 적발 연출 / empty 빈 칸(REOPEN_SEC 뒤 새 공방)
   경쟁 유지(기획서 3.8): 행마다 연속 구매 수 → 3이면 옆 공방 경고, 5면 옆 공방 폐업 + 남은 공방 독점(가격 ×1.3)
   개편(2026-11-02, 개편안.md): 인증·만료 규칙을 없앰.
     품질: 공방마다 물건별 품질 ★1~3(sh.q). 가격은 품질 구간(Q_PRICE) 안에서 정해짐. 같은 행 두 공방은 같은 물건 품질이 다름.
     나르미 = 현장 실사: 새로 개업한 공방(isNew)만 실사. 정상이면 '✔ 실사' 표시, 수상한 공방이면 적발.
     수상한 공방: 가격표엔 ★3이 싸게 붙어 있지만 실제는 불량(realQ 0) → 납품 검수에서 불합격. */
'use strict';
G.shops = (() => {
  const C = G.C, U = G.U;
  const round1 = v => Math.round(v * 10) / 10;
  const TAG_W = 62, FLAG_SEC = 15, CLOSE_SHOW = 1.5, REVEAL_SEC = 1.5;

  function init(S) {
    S.shops = G.world.shops.map(w => ({
      w, idx: w.idx, cat: w.cat.id, mults: {}, status: 'open', fake: false, verified: false,
      fx: null, openFx: null, stampT: 0, flagT: 0, t: Math.random() * 3, closeT: 0, revealT: 0, reopenT: 0,
      lonely: false, monopoly: false, innov: false, growT: null, certT: 0, bidT: 0, q: {}, isNew: false, sales: 0, tier: 0, tierT: null,
    }));
    for (let r = 0; r < 4; r++) rowQuality(S, r);
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
  // 개편: 가격 배율은 그 물건 품질의 가격대 안에서. 숨은 가성비(Q_BARGAIN)면 한 단계 아래 가격대
  function rollMult(sh, id) {
    const q = sh.q[id] || 2, band = C.Q_PRICE[q > 1 && Math.random() < C.Q_BARGAIN ? q - 1 : q];
    return U.rand(band[0], band[1]);
  }
  function rollRow(S, r) {
    for (const sh of [S.shops[r * 2], S.shops[r * 2 + 1]]) if (!sh.fake) for (const it of itemsOf(sh)) sh.mults[it.id] = rollMult(sh, it.id);
  }
  // 품질 정하기: 행의 두 공방은 같은 물건 품질이 서로 다르게 (비교할 이유)
  function pickQ(avoid) { const pool = [1, 2, 3].filter(q => q !== avoid); return pool[Math.floor(Math.random() * pool.length)]; }
  function rowQuality(S, r) {
    const a = S.shops[r * 2], b = S.shops[r * 2 + 1];
    for (const it of itemsOf(a)) { a.q[it.id] = pickQ(); b.q[it.id] = pickQ(a.q[it.id]); }
  }
  const realQ = (sh, id) => sh.fake ? 0 : sh.q[id];
  const certified = sh => sh.status === 'open';                      // 개편: 인증제 없음 (봇·다른 모듈 호환용)
  // 이 요청 조건을 맞추는 공방 중 가장 싼 값 (가성비 판정용, 표시 품질 기준)
  function bestPrice(S, item, minQ) {
    let best = Infinity;
    for (const sh of S.shops) if (isOpen(S, sh) && !sh.fake && sh.q[item] >= minQ && !(C.CONNECT && !G.connect.hasSlot(S, sh))) best = Math.min(best, price(sh, item));   // 수상한 공방은 비교 대상 아님
    return best;
  }
  const isOpen = (S, sh) => sh.status === 'open' && S.openCats.has(sh.cat);
  const itemsOf = sh => G.ITEMS.filter(i => i.cat === sh.cat);
  const price = (sh, itemId) => round1(G.ITEM[itemId].price * (sh.mults[itemId] || 1) * (sh.monopoly ? C.MONOPOLY_MULT : 1) * (sh.innov ? C.INNOV_PRICE_MULT : 1) * (sh.sprout ? C.SPROUT_PRICE_MULT : 1) * C.SHOP_TIER_PRICE[sh.tier || 0] * G.events.priceMult(sh));
  const partner = (S, sh) => S.shops[sh.idx ^ 1];

  function opened(S, cat) { for (const sh of S.shops) if (sh.cat === cat) sh.openFx = 0; }

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
    Object.assign(sh, { status: 'open', fake, sales: 0, tier: 0, tierT: null, sprout: false, innov: false, mature: false, growT: null, verified: false, isNew: true, certT: 0, bidT: fake && C.FAKE_BID ? C.FAKE_BID_SEC : 0, fx: null, openFx: 0, stampT: 0, flagT: FLAG_SEC, closeT: 0, revealT: 0, reopenT: 0, lonely: false, monopoly: false, closeWhy: null });
    const p0 = partner(S, sh);
    if (p0.monopoly) { p0.monopoly = false; const b = p0.w.body; G.fx.add(S, b.x + b.w / 2, b.y + 8, '경쟁 공방이 생겨 독점이 풀렸어요', '#9be37a'); }
    S.streak[sh.idx >> 1] = { shop: -1, n: 0 };
    const p = partner(S, sh);
    for (const it of itemsOf(sh)) {
      if (fake) { sh.q[it.id] = 3; sh.mults[it.id] = U.rand(C.PRICE_FAKE[0], C.PRICE_FAKE[1]); continue; }   // 너무 좋고 너무 쌈
      sh.q[it.id] = pickQ(p.status === 'open' && !p.fake ? p.q[it.id] : undefined);
      sh.mults[it.id] = rollMult(sh, it.id);
    }
    if (fake) S.stats.fakeSpawned = (S.stats.fakeSpawned || 0) + 1;
  }
  const fakeCount = S => S.shops.filter(sh => sh.fake && (sh.status === 'open' || sh.status === 'closing')).length;
  const fakeMax = S => (S.elapsed >= C.LATE_AT ? 2 : 1);
  // 수상한 공방 등장: 수상한 공방이 없는 열린 행에서, 빈 칸이 있으면 거기, 없으면 공방 하나를 교체
  // cat: 그 업종 행에만 (브로커용), force: 동시 개수 상한 무시. 성공하면 그 공방을 돌려줌
  function spawnFake(S, cat, force) {
    if (!force && fakeCount(S) >= fakeMax(S)) return false;
    const d = G.dali;
    const rows = [0, 1, 2, 3].filter(r => (!cat || S.shops[r * 2].cat === cat) && S.openCats.has(S.shops[r * 2].cat) && !S.shops[r * 2].fake && !S.shops[r * 2 + 1].fake);
    if (!rows.length) return false;
    const r = rows[Math.floor(Math.random() * rows.length)];
    const pair = [S.shops[r * 2], S.shops[r * 2 + 1]];
    let sh = pair.find(x => x.status === 'empty');
    if (!sh) {
      const cand = pair.filter(x => x.status === 'open' && !x.innov && !x.sprout && !U.inRect(d.x, d.y, x.w.door));   // 달이가 서 있는 공방·혁신·새싹은 피함
      if (!cand.length) return false;
      sh = cand[Math.floor(Math.random() * cand.length)];
    }
    newShop(S, sh, true);
    return sh;
  }
  G.director.on('firstFake', S => { S.firstFakeDone = true; spawnFake(S); S.fakeClock = 14; });
  // ---------- 새싹 공방 (개편 2단계: 스타트업 성장) ----------
  // 열린 행에서 빈 칸이 있으면 거기, 없으면 평범한 공방 하나를 새싹 공방으로 교체. 품질 ★2~3, 값은 조금 비쌈
  function spawnSprout(S) {
    const d = G.dali;
    const rows = [0, 1, 2, 3].filter(r => S.openCats.has(S.shops[r * 2].cat) && ![0, 1].some(k => { const x = S.shops[r * 2 + k]; return x.sprout || x.innov || x.fake; }));
    if (!rows.length) return false;
    const r = rows[Math.floor(Math.random() * rows.length)], pair = [S.shops[r * 2], S.shops[r * 2 + 1]];
    const sh = pair.find(x => x.status === 'empty') || pair.filter(x => x.status === 'open' && !U.inRect(d.x, d.y, x.w.door))[Math.floor(Math.random() * 2) % 2] || pair.find(x => x.status === 'open' && !U.inRect(d.x, d.y, x.w.door));
    if (!sh) return false;
    newShop(S, sh, false);
    const p = partner(S, sh);
    for (const it of itemsOf(sh)) { const pq = p.status === 'open' && !p.fake ? p.q[it.id] : 0; sh.q[it.id] = pq === 3 ? 2 : pq === 2 ? 3 : (Math.random() < 0.5 ? 2 : 3); sh.mults[it.id] = rollMult(sh, it.id); }
    Object.assign(sh, { sprout: true, trial: C.SPROUT_GOAL, growT: 0 });
    S.stats.sprouts = (S.stats.sprouts || 0) + 1;
    const who = sh.w.cat.name + sh.w.side;
    G.director.banner(S, '새싹 공방 개업! (' + who + ')', '실적 없는 스타트업 · 사 주면 자라서 혁신제품이 돼요 (실적 ' + C.SPROUT_GOAL + '건)');
    G.audio.play('banner');
    return sh;
  }
  G.director.on('sprout', S => { spawnSprout(S); });
  G.director.on('tipStock', S => !S.hard && C.STOCK !== false && G.narmi.say('아낀 세금으로 원자재를 쌀 때 사 둬요! (조달청 아래 비축칸)', 3.2));
  G.director.on('tipReg', S => !S.hard && G.narmi.say('지붕의 ✔ = 나라장터 등록 업체! 등록된 곳과만 계약해요', 3.2));
  // 실적을 다 채우면 혁신제품 지정: 혁신 공방(성공 판정 상태)으로, 품질 +1, 업종별 혁신제품 효과
  function graduate(S, sh) {
    sh.sprout = false; sh.innov = true; sh.mature = true; sh.growT = 0; sh.lonely = false; sh.isNew = false;
    for (const it of itemsOf(sh)) { sh.q[it.id] = Math.min(3, sh.q[it.id] + 1); sh.mults[it.id] = rollMult(sh, it.id); }
    // 2026-11-03 혁신 보상은 업종이 아니라 순서대로: 1호 전동 킥보드(이동 +35%) → 2호 수납 카트(가방 +1) → 3호 AI 실사 드론(나르미 쉬는 시간 -40%) → 4호 스마트 주문판(계약 시간 +20%)
    const key = ['safety', 'furn', 'elec', 'health'].find(k => !S.innovCats.has(k)), I = key && G.levelup.INNOV[key];
    if (I) { I.apply(S); S.innovCats.add(key); }
    S.stats.innov = (S.stats.innov || 0) + 1;
    return I;
  }
  function fakeTimer(S, dt) {
    if (!S.firstFakeDone) return;
    S.fakeClock -= dt;
    if (S.fakeClock > 0) return;
    const late = S.elapsed >= C.LATE_AT;                              // 후반부터 더 자주
    if (Math.random() < (late ? 0.7 : 0.6)) spawnFake(S);
    S.fakeClock += (late ? 11 : 14) * (S.hard ? C.HARD.fakeEvery : 1);   // 2분 기준 · 하드는 더 자주
  }

  // ---------- 구매 ----------
  // 이 공방에서 살 물건과 그 물건이 향할 요청(가장 급한, 아직 가방으로 채우지 않은 것)
  function wanted(S, sh) {
    let best = null;
    // 개편(터치 조작): 계약 조건(★)을 맞추는 물건만 산다. 조건 미달 물건은 자동으로 사지 않음
    for (const it of itemsOf(sh)) {
      const reqs = G.requests.active(S).filter(r => r.item === it.id && sh.q[it.id] >= r.minQ).sort((a, b) => a.left - b.left);
      const carried = G.dali.bag.filter(b => b.item === it.id).length;
      if (reqs.length > carried) { const r = reqs[carried]; if (!best || r.left < best.r.left) best = { item: it.id, r }; }
    }
    if (best) return best;
    const prep = itemsOf(sh).find(it => S.prep && S.prep.has(it.id));     // 예보 중: 대비 물건은 요청 없이도 삼
    return prep ? { item: prep.id, r: null } : null;
  }
  function buy(S, sh, item, r) { G.dali.bag.push(order(S, sh, item, r)); }
  // 값을 치르고 물건 정보를 돌려줌 (달이 가방·계약 연결 수레가 함께 씀)
  function order(S, sh, item, r) {
    const p = price(sh, item);
    const prep = !r;
    // 가성비 판정은 '산 순간' 기준: 이 요청 조건을 맞춘 공방 중 가장 싼 곳이었나 (조건 미달이면 null)
    const fits = r && sh.q[item] >= r.minQ;
    const best = fits && !sh.sprout ? p <= bestPrice(S, item, r.minQ) + 0.05 : undefined;   // 새싹 공방 구매는 가성비 대신 '투자'
    const bought = { item, paid: p, shop: sh.idx, fake: sh.fake, innov: sh.innov, sprout: sh.sprout, prep, q: sh.q[item], realQ: realQ(sh, item), best, forReq: r ? r.id : null };
    G.audio.play('buy');   // 수상한 물건도 겉보기는 같다
    if (!sh.fake) { sh.sales += p; while (sh.tier < C.SHOP_TIER.length && sh.sales >= C.SHOP_TIER[sh.tier]) growShop(S, sh); }
    S.stats.bought = (S.stats.bought || 0) + 1;
    const d = sh.w.door;
    G.fx.add(S, d.x + d.w / 2, d.y - 6, G.ITEM[item].name + ' 계약 ' + p + '만원', '#fff');
    if (sh.fake && sh.closeT === 0) sh.closeT = 0.0001;                  // 3초 뒤 사라짐
    compete(S, sh);
    return bought;
  }
  // ---------- 공방 성장 (2026-11-03): 누적 판매로 작업장 → 공장 ----------
  function growShop(S, sh) {
    sh.tier++; sh.tierT = 0;
    S.score += C.TIER_SCORE; G.score.trust(S, C.TIER_TRUST);
    S.stats.shopGrow = (S.stats.shopGrow || 0) + 1; if (sh.tier >= 2) S.stats.shopFactory = (S.stats.shopFactory || 0) + 1;
    const b = sh.w.body, who = sh.w.cat.name + '공방 ' + sh.w.side;
    G.fx.burst(S, b.x + b.w / 2, b.y + 10, true, sh.tier >= 2 ? 40 : 24);
    if (sh.tier >= 2) { G.director.banner(S, who + G.U.josa(who, '이', '가') + ' 공장으로 성장했어요!', '일자리가 늘었어요 · 값 10% 인하 · 원자재 가격 폭등에도 끄떡없어요'); G.audio.play('gift'); }
    else { G.fx.add(S, b.x + b.w / 2, b.y + 110, who + ' → 작업장! 값 5% 인하', '#ffe48a', 16); G.audio.play('ok'); }
  }
  // ---------- 경쟁 유지 (기획서 3.8) ----------
  // 같은 공방에서 연달아 사면 streak +1, 옆 공방에서 사면 1부터 다시
  function compete(S, sh) {
    if (!C.COMPETE) return;
    const row = sh.idx >> 1, st = S.streak[row], p = partner(S, sh);
    if (st.shop === sh.idx) st.n++; else { st.shop = sh.idx; st.n = 1; }
    sh.lonely = false;
    if (p.status !== 'open' || p.fake || p.innov || p.sprout) return;    // 비어 있거나 수상한·혁신·새싹 공방은 대상 아님
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
    if (C.CONNECT) return;                                           // 계약 연결: 달이는 사지 않음
    const dali = G.dali, B = S.buy;
    const sh = S.shops.find(s => isOpen(S, s) && U.inRect(dali.x, dali.y, s.w.door)) || null;
    if (sh !== B.shop) { B.shop = sh; B.dwell = 0; B.warned = false; }
    if (!sh) return;
    if (sh.isNew && !sh.verified && !sh.innov) {                    // 개편: 새 공방은 나르미 실사가 끝나야 계약(구매)
      B.dwell = 0; S.wantInspect = sh;
      const onIt = G.narmi.target === sh && G.narmi.busy();
      if (!B.warned || onIt !== B.onIt) { const d = sh.w.door; G.fx.add(S, d.x + d.w / 2, d.y - 6, onIt ? '나르미 실사 중… 잠깐만요' : '등록 심사 중 · 실사를 통과해야 계약해요', '#ffd6a0'); B.warned = true; B.onIt = onIt; }
      return;
    }
    const want = wanted(S, sh), item = want && want.item;
    const full = dali.bag.length >= S.bagCap;
    const press = G.input.hit('e') || G.input.hit('enter');
    if (!item || full) {
      B.dwell = 0;
      if (!B.warned && (press || !dali.moving)) {
        const d = sh.w.door;
        const under = !full && G.requests.active(S).find(r => itemsOf(sh).some(it => it.id === r.item) && sh.q[r.item] < r.minQ);
        G.fx.add(S, d.x + d.w / 2, d.y - 6, full ? '가방이 가득 찼어요' : under ? G.ITEM[under.item].name + G.U.josa(G.ITEM[under.item].name, '은', '는') + ' 조건 미달 (★' + under.minQ + ' 이상 필요)' : '필요한 물건이 아니에요', under ? '#ff8a7a' : '#ffd6a0');
        B.warned = true;
      }
      return;
    }
    B.warned = false;
    if (press) { buy(S, sh, item, want.r); B.dwell = 0; return; }
    if (G.settings.buyMode === 'auto') {
      B.dwell += dt;
      if (B.dwell >= (S.buyDwell || C.BUY_DWELL)) { buy(S, sh, item, want.r); B.dwell = 0; }
    }
  }

  // ---------- 매 프레임 ----------
  function update(S, dt) {
    S.priceClock -= dt;
    if (S.priceClock <= 0) { reroll(S); S.priceClock += C.PRICE_REROLL_SEC; }
    fakeTimer(S, dt);
    // 실사 대기열: 달이가 가려는(또는 서 있는) 새 공방을 나르미가 쉬는 대로 실사
    const w = S.wantInspect;
    if (w && (w.status !== 'open' || w.verified || !w.isNew)) S.wantInspect = null;
    else if (w && !G.narmi.busy() && S.inspectCD <= 0) { request(S, w); S.wantInspect = null; }
    for (const sh of S.shops) {
      sh.t += dt;
      if (sh.fx && (sh.fx.t += dt) > 1.5) sh.fx = null;
      if (sh.openFx != null && (sh.openFx += dt) > 0.8) sh.openFx = null;
      if (sh.growT != null) sh.growT += dt;
      if (sh.flagT > 0) sh.flagT = Math.max(0, sh.flagT - dt);
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
    const r = G.requests.active(S).filter(q => G.ITEM[q.item].cat === sh.cat && !q.ship).sort((a, b) => a.left - b.left)[0];   // 납품 중 계약은 건드리지 않음
    if (!r) { sh.bidT = 0.5; return; }
    G.requests.stolen(S, r, sh);
    sh.status = 'closing'; sh.closeT = 0; sh.closeWhy = 'scam';
    const b = sh.w.body; G.fx.add(S, b.x + b.w / 2, b.y + 110, '부정 낙찰! 납품 없이 사라졌어요', '#ff8a7a', 16);
  }

  // 혁신 공방으로 성장 (레벨업 혁신제품 카드)
  function makeInnov(S, sh) {
    sh.innov = true; sh.growT = 0; sh.lonely = false; sh.trial = C.INNOV_TRIAL; sh.mature = false; sh.isNew = false;
    for (const it of itemsOf(sh)) sh.q[it.id] = Math.min(3, sh.q[it.id] + 1);   // 개편: 혁신 = 기술 향상, 품질 한 단계 위
    S.stats.innov = (S.stats.innov || 0) + 1;
    const who = sh.w.cat.name + '공방 ' + sh.w.side;
    G.director.banner(S, who + G.U.josa(who, '이', '가') + ' 혁신 공방으로 성장했어요!', '혁신제품 시범구매 · 조달청이 첫 구매자가 되어 줬어요');
    G.audio.play('gift');
  }
  function toEmpty(sh) { Object.assign(sh, { status: 'empty', fake: false, sales: 0, tier: 0, tierT: null, sprout: false, verified: false, isNew: false, certT: 0, bidT: 0, certExpired: false, reopenT: C.REOPEN_SEC, closeT: 0, revealT: 0, flagT: 0, lonely: false, monopoly: false }); }

  // ---------- 나르미 검증 (기획서 3.6) ----------
  const shopAt = (S, p) => S.shops.find(sh => U.inRect(p.x, p.y, sh.w.body)) || null;
  function whyNot(S, sh) {
    if (sh.status === 'empty' || sh.status === 'closing' || sh.status === 'caught') return '빈 가게예요';
    if (!isOpen(S, sh)) return '아직 문을 안 열었어요';
    if (sh.innov) return '혁신 공방은 이미 검증됐어요';
    if (!sh.isNew) return '이미 나라장터에 등록된 업체예요';
    if (sh.verified) return '이미 실사한 공방이에요';
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
      if (p.status === 'open' && isOpen(S, p) && p.isNew && !p.verified) { p._dual = true; inspected(S, p); p._dual = false; }
    }
    if (sh.fake) {
      sh.status = 'caught'; sh.revealT = 0; sh.closeT = 0;
      S.catchStreak = (S.catchStreak || 0) + 1;
      const bonus = C.CATCH_SCORE + C.CATCH_STREAK_BONUS * Math.min(3, S.catchStreak - 1);   // 연속 적발 보너스는 최대 3단계
      S.score += bonus; G.score.trust(S, C.TRUST_CATCH);
      S.stats.caught = (S.stats.caught || 0) + 1;
      const fy = b.y + 110;                                             // 문구는 공방 아래 길에서 (HUD에 가리지 않게)
      G.fx.add(S, b.x + b.w / 2, fy, '페이퍼컴퍼니 적발! +' + bonus, '#ffe48a', 16);
      if (S.catchStreak >= 2) G.fx.add(S, b.x + b.w / 2, fy, '연속 적발 ×' + S.catchStreak + '!', '#ff8a7a', 16);
      G.fx.add(S, b.x + b.w / 2, fy, '부정 낙찰 막음 · 세금 ' + C.CATCH_BANK + '만원 지킴', '#9be37a');
      // 연출: 한순간 멈춤 + 화면 흔들림 + 파편 + 동전이 세금 저금통(HUD)으로
      S.hitStop = 0.15; S.shakeT = 0.35;
      G.fx.burst(S, b.x + b.w / 2, b.y + 32);
      G.fx.coins(S, b.x + b.w / 2, b.y + 32, 326, 32, 8, () => { S.saved = round1(S.saved + C.CATCH_BANK); G.gifts.add(S, C.CATCH_BANK); });
      G.narmi.say('페이퍼컴퍼니 적발!', 1.8);
      G.audio.play('catch');
      G.fx.add(S, b.x + b.w / 2, b.y + 8, '마을 신뢰 +' + C.TRUST_CATCH, '#9be37a');
    } else {
      sh.verified = true; sh.stampT = 0;
      S.stats.certified = (S.stats.certified || 0) + 1;
      G.fx.add(S, b.x + b.w / 2, b.y + 110, S.ultQuiet ? '✔ 실사 통과' : '✔ 실사 통과 · 나라장터 등록! 이제 계약할 수 있어요', '#9be37a');
      G.audio.play('ok');
    }
  }
  // 나르미 데이터 성장: 검증할 때마다 +1, DATA_LV마다 단계 상승
  function addData(S) {
    S.data++;
    if (!C.DATA_LEVELS) return;                                      // 2026-11-03 데이터 단계 끔 (필살기로 대체)
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
    for (const p of G.input.taps) {
      if (G.broker.hit(S, p)) { G.broker.request(S); return; }           // 브로커를 누르면 나르미가 쫓아감
      const sh = shopAt(S, p); if (sh) { request(S, sh); return; }
    }
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
  // 구매 자리(문 앞 발판) 2026-11-03: 어디 서야 사는지 잘 안 보인다는 피드백 → 둥근 발판 + 필요한 물건이 있으면 깜빡이는 '구매' + 문 쪽 화살표
  function doorMat(ctx, S, sh) {
    const d = sh.w.door, x = d.x + 3, y = d.y + 4, w = d.w - 6, h = d.h - 8, t = S.elapsed || 0;
    const here = S.buy && S.buy.shop === sh, check = !S.hard && sh.isNew && !sh.verified && !sh.innov;
    const need = !S.hard && itemsOf(sh).some(it => needFits(S, sh, it.id));   // 하드 모드: 빈 발판만
    const rr = () => { const r = 6; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    if (!need && !here) { rr(); ctx.fillStyle = 'rgba(255,248,225,.35)'; ctx.fill(); ctx.strokeStyle = 'rgba(120,90,40,.45)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1; return; }
    const on = 0.5 + Math.sin(t * 6) * 0.5, col = check ? '#0f8a96' : '#2e9b3a';
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + 1, y + h - 1, w, 3);
    rr(); ctx.fillStyle = here ? '#fff3b0' : check ? 'rgba(200,240,245,.95)' : 'rgba(225,255,215,.95)'; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2 + on; ctx.stroke(); ctx.lineWidth = 1;
    G.world.text(ctx, check ? '실사' : '구매', x + w / 2, y + h / 2 + 1, 12, col);
    if (!here) {                                                      // 위(문)로 올라가는 작은 화살표
      const ax = x + w / 2, ay = y - 2 - ((t * 1.5) % 1) * 5;
      ctx.globalAlpha = 0.6 + on * 0.4; ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(ax - 5, ay); ctx.lineTo(ax + 5, ay); ctx.lineTo(ax, ay - 5); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  // 11-04 성능: 진행 중 계약·가방을 한 프레임에 한 번만 세어 둠 (공방 8곳 × 물건마다 다시 세던 것)
  let needMemo = null, needAt = -1;
  function needMap(S) {
    if (needAt === S.elapsed && needMemo) return needMemo;
    const m = {};
    for (const r of G.requests.active(S)) if (!r.ship) (m[r.item] = m[r.item] || { n: 0, minQ: 9 }).n++, m[r.item].minQ = Math.min(m[r.item].minQ, r.minQ);
    for (const b of G.dali.bag) if (m[b.item]) m[b.item].n--;
    needAt = S.elapsed; return (needMemo = m);
  }
  function needFits(S, sh, itemId) {
    const e = needMap(S)[itemId];
    return !!e && e.n > 0 && sh.q[itemId] >= e.minQ;
  }
  function priceTag(ctx, S, sh) {
    const b = sh.w.body, tx = sh.w.tagX, flash = sh.fx && Math.floor(sh.fx.t * 6) % 2 === 0;
    if (sh.fx) { ctx.fillStyle = flash ? '#ffd84a' : '#fff3b0'; ctx.fillRect(tx - 2, b.y + 23, TAG_W + 4, 38); }
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(tx, b.y + 25, TAG_W, 34);
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(tx, b.y + 41, TAG_W, 1);
    itemsOf(sh).forEach((it, i) => {
      const y = b.y + 33 + i * 17;
      G.icons.draw(ctx, it.id, tx + 8, y, 15);
      G.icons.stars(ctx, tx + 16, y - 4, sh.q[it.id], 3, 1);         // 품질 ★ (개편)
      const dir = sh.fx && sh.fx.dirs[it.id];
      T(ctx, String(price(sh, it.id)), tx + TAG_W - 2, y + 1, 12, sh.monopoly || dir > 0 ? '#d9342b' : dir < 0 ? '#2e9b3a' : '#2a2416', 'right');
      if (S.prep && S.prep.has(it.id) && !sh.fake && sh.status === 'open') {   // 예보 중 대비 물건 (2026-11-03: 처음 하는 사람도 알게)
        const on = Math.floor(S.elapsed * 4) % 2 === 0;
        ctx.strokeStyle = on ? '#0f8a96' : '#ffd84a'; ctx.lineWidth = 2; ctx.strokeRect(tx + 1, y - 7, TAG_W - 2, 15); ctx.lineWidth = 1;
        ctx.fillStyle = '#0b5d68'; ctx.fillRect(tx + TAG_W - 28, y - 17, 28, 12); G.world.text(ctx, '대비', tx + TAG_W - 14, y - 11, 12, '#ffd84a');
      }
      if (!S.hard && sh.status === 'open' && needFits(S, sh, it.id)) {   // 2026-11-03 필요 물건 표시: 진행 중 계약에 필요하고 ★ 조건을 맞추면 초록 체크 테두리 (가장 싼 곳 고르기는 그대로 플레이어 몫)
        const on = 0.75 + Math.sin(S.elapsed * 6) * 0.25;
        ctx.fillStyle = 'rgba(120,220,110,.28)'; ctx.fillRect(tx, y - 7, TAG_W, 15);
        ctx.strokeStyle = 'rgba(30,150,50,' + on.toFixed(2) + ')'; ctx.lineWidth = 2.5; ctx.strokeRect(tx - 1, y - 8, TAG_W + 2, 17); ctx.lineWidth = 1;
        G.icons.draw(ctx, it.id, tx + 8, y, 15); G.icons.stars(ctx, tx + 16, y - 4, sh.q[it.id], 3, 1);
        T(ctx, String(price(sh, it.id)), tx + TAG_W - 2, y + 1, 12, sh.monopoly || (sh.fx && sh.fx.dirs[it.id] > 0) ? '#d9342b' : sh.fx && sh.fx.dirs[it.id] < 0 ? '#2e9b3a' : '#2a2416', 'right');
      }
      if (S.valueHint && !sh.fake && bestFor(S, sh, it.id)) { ctx.strokeStyle = '#2e9b3a'; ctx.lineWidth = 2; ctx.strokeRect(tx + 1, y - 7, TAG_W - 2, 15); ctx.lineWidth = 1; }
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
  // 새싹 공방: 연두 지붕 + 자라는 새싹 + 공방 아래 '실적 n/3' 칸
  // 성장 모습 (2026-11-03 다시 그림: 건물 모양이 바뀌게)
  //   작업장: 줄무늬 차양(창·문 위), 지붕 위 노란 '작업장' 현판, 굴뚝 하나 더, 문 옆 원자재 상자
  //   공장: 지붕 전체가 톱니 지붕(채광창)으로 솟고, 줄무늬 큰 굴뚝·짙은 연기, 금빛 '공장' 현판, 깃발, 창에 불빛
  function tierLook(ctx, sh) {
    if (!sh.tier) return;
    const b = sh.w.body, A = sh.w.side === 'A', g = sh.tierT == null ? 1 : Math.min(1, sh.tierT / 0.5);
    if (sh.tierT != null) sh.tierT += 1 / 60;
    const px = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    const cat = sh.w.cat.col, dark = G.world.shade(cat, 0.45), mid = G.world.shade(cat, 0.7);
    // 공통: 줄무늬 차양 (창문~문 위)
    const ax = Math.min(sh.w.wndX, sh.w.doorGfx) - 4, aw = Math.abs(sh.w.wndX - sh.w.doorGfx) + 28;
    for (let k = 0; k < aw; k += 6) px(k % 12 ? '#fffdf6' : (sh.tier >= 2 ? '#d9342b' : mid), ax + k, b.y + 23, 6, 5);
    px('rgba(0,0,0,.18)', ax, b.y + 28, aw, 2);
    // 문 옆 원자재 상자 (길 쪽)
    const bx = A ? b.x + b.w - 50 : b.x + 26;
    G.events.crate(ctx, bx, b.y + 52); if (sh.tier >= 2) { G.events.crate(ctx, bx + (A ? -14 : 14), b.y + 52); G.events.crate(ctx, bx + (A ? -7 : 7), b.y + 41); }
    if (sh.tier >= 2) {
      const up = Math.round(18 * g);                                     // 톱니 지붕
      for (let k = 0; k < 4; k++) {
        const tx = b.x - 2 + k * 29;
        ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(tx, b.y); ctx.lineTo(tx + 22, b.y - up); ctx.lineTo(tx + 22, b.y); ctx.fill();
        px('#9fd3ff', tx + 22, b.y - up + 2, 4, up - 2); px(Math.floor(sh.t * 2 + k) % 3 ? '#fff6b0' : '#ffe48a', tx + 9, b.y - up / 2, 4, 3);
      }
      const cx = A ? b.x + 6 : b.x + b.w - 14;                           // 줄무늬 큰 굴뚝 + 짙은 연기
      px('#8a8f99', cx, b.y - 30, 9, 30); px('#d9342b', cx, b.y - 26, 9, 3); px('#d9342b', cx, b.y - 18, 9, 3);
      for (let i = 0; i < 3; i++) { const k = ((sh.t / 1.1) + i / 3) % 1; ctx.globalAlpha = 0.75 * (1 - k); ctx.fillStyle = '#e1e4e8'; ctx.beginPath(); ctx.arc(cx + 4 + Math.sin(k * 4) * 4, b.y - 34 - k * 12, 3 + k * 5, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      const fx = A ? b.x + b.w - 6 : b.x + 22, wave = Math.sin(sh.t * 6) * 1.5;   // 깃발
      px('#5a5a5a', fx, b.y - up - 12, 2, 12); px('#2f6fb5', fx + 2, b.y - up - 12 + wave, 11, 7);
    }
    // 지붕 위 현판 (작업장 = 노랑, 공장 = 금빛 + 별)
    const label = sh.tier >= 2 ? '★ 공장' : '작업장', lw = sh.tier >= 2 ? 46 : 42, lx = A ? b.x + (sh.tier >= 2 ? 20 : 6) : b.x + b.w - lw - (sh.tier >= 2 ? 18 : 4);   // 굴뚝을 피해서
    const ly = b.y - (sh.tier >= 2 ? 26 : 12) * g;
    px('#3a3a3a', lx - 1, ly - 1, lw + 2, 13); px(sh.tier >= 2 ? '#ffd84a' : '#fff3a0', lx, ly, lw, 11);
    G.world.text(ctx, label, lx + lw / 2, ly + 6, 12, sh.tier >= 2 ? '#7a4a00' : '#5a4a00');
    if (sh.tier === 1) {                                                   // 작업장: 굴뚝 하나 더
      const cx = sh.w.wndX + 18, cy = b.y - 8;
      px('#7a3b2e', cx, cy, 8, 10);
      for (let i = 0; i < 2; i++) { const k = ((sh.t / 1.3) + i / 2) % 1; ctx.globalAlpha = 0.7 * (1 - k); ctx.fillStyle = '#f4f6f8'; ctx.beginPath(); ctx.arc(cx + 4 + Math.sin(k * 5) * 3, cy - 3 - k * 14, 2 + k * 3, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  function sproutLook(ctx, sh) {
    const b = sh.w.body, done = C.SPROUT_GOAL - sh.trial, g = Math.min(1, (sh.growT || 0) / 0.6), pulse = g < 1 ? Math.sin(g * Math.PI) * 3 : 0;
    ctx.fillStyle = '#7cc45a'; ctx.fillRect(b.x - 3 - pulse, b.y - pulse, b.w + 6 + pulse * 2, 22);
    ctx.fillStyle = '#b8ec8e'; ctx.fillRect(b.x - 3, b.y, b.w + 6, 3);
    T(ctx, '새싹 ' + sh.w.cat.name + sh.w.side, b.x + b.w / 2 + 6, b.y + 11, 12, '#1f4a17');
    // 새싹 그림: 실적이 쌓일수록 줄기·잎이 커짐
    const sx = b.x + 12, sy = b.y + 18, h = 4 + done * 3, sw = Math.sin(sh.t * 3) * 1;
    ctx.fillStyle = '#6b4423'; ctx.fillRect(sx - 4, sy - 2, 9, 3);
    ctx.fillStyle = '#2e8b2e'; ctx.fillRect(sx, sy - h, 2, h);
    const lf = 2 + done; ctx.fillStyle = '#4cc04c';
    ctx.fillRect(sx - lf + sw, sy - h - 1, lf, 3); ctx.fillRect(sx + 2 + sw, sy - h - 3, lf, 3);
    // 실적 칸
    const tx = b.x + b.w / 2 - 38; ctx.fillStyle = '#1f4a17'; ctx.fillRect(tx, b.y + 66, 76, 14);
    T(ctx, '실적', tx + 15, b.y + 73, 12, '#fff');
    for (let i = 0; i < C.SPROUT_GOAL; i++) { ctx.fillStyle = i < done ? '#9be37a' : '#4a6a40'; ctx.fillRect(tx + 32 + i * 14, b.y + 69, 11, 8); }
  }
  function innovLook(ctx, sh) {
    const b = sh.w.body, g = Math.min(1, (sh.growT || 0) / 0.6), pulse = g < 1 ? Math.sin(g * Math.PI) * 4 : 0;
    ctx.fillStyle = '#f6c431'; ctx.fillRect(b.x - 3 - pulse, b.y - pulse, b.w + 6 + pulse * 2, 22);        // 금빛 지붕
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(b.x - 3, b.y, b.w + 6, 3);
    T(ctx, '★혁신 ' + sh.w.cat.name + sh.w.side, b.x + b.w / 2, b.y + 11, 12, '#5a3a00');
    // 시범 사용 진행 / 성공 판정 표시 (공방 아래 길)
    const tag = sh.mature ? '★ 혁신제품' : '시범 사용 ' + (C.INNOV_TRIAL - sh.trial) + '/' + C.INNOV_TRIAL;
    ctx.fillStyle = sh.mature ? '#e0a800' : '#5a3a00'; ctx.fillRect(b.x + b.w / 2 - 34, b.y + 66, 68, 14);
    T(ctx, tag, b.x + b.w / 2, b.y + 73, 12, '#fff');
    for (let i = 0; i < 3; i++) {                                                                       // 반짝임
      const k = ((sh.t * 0.8) + i / 3) % 1, x = b.x + 10 + ((i * 47 + Math.floor(sh.t)) % (b.w - 20)), y = b.y + 26 + i * 10;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff6b0'; ctx.fillRect(x, y - 3, 1, 7); ctx.fillRect(x - 3, y, 7, 1); ctx.globalAlpha = 1;
    }
  }
  // 실사 표시 (개편): 새 공방은 가격표 위 회색 띠 '실사 전', 실사하면 도장 → 작은 '✔실사' 띠
  function certLook(ctx, S, sh) {
    if (sh.innov || sh.status !== 'open' || !sh.isNew) return;
    const b = sh.w.body, tx = sh.w.tagX;
    if (sh.verified) {
      if (sh.stampT < 1) { stamp(ctx, sh, '✔ 실사', '#2e9b3a', tx + TAG_W / 2, b.y + 44); return; }
      ctx.fillStyle = '#2e9b3a'; ctx.fillRect(tx + 8, b.y + 15, TAG_W - 16, 11); T(ctx, '✔ 실사', tx + TAG_W / 2, b.y + 21, 12, '#fff');
      return;
    }
    ctx.fillStyle = '#4a4f57'; ctx.fillRect(tx + 4, b.y + 15, TAG_W - 8, 11);
    T(ctx, '실사 전', tx + TAG_W / 2, b.y + 21, 12, '#fff');
  }
  // 가성비 힌트(레벨업 카드): 지금 가장 급한 그 물건 요청 기준으로 이 공방이 '조건 맞춘 곳 중 가장 쌈'인가
  function bestFor(S, sh, item) {
    const r = G.requests.active(S).filter(q => q.item === item).sort((a, b) => a.left - b.left)[0];
    return r && sh.q[item] >= r.minQ && price(sh, item) <= bestPrice(S, item, r.minQ) + 0.05;
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
      if (sh.sprout) sproutLook(ctx, sh);
      tierLook(ctx, sh);
      if (sh.status === 'open') {                                         // 나라장터 등록 표시 (2026-11-03)
        const reg = !sh.isNew || sh.verified || sh.innov, rx = b.x + 9, ry = b.y + 11;
        ctx.fillStyle = '#1e2a3a'; ctx.beginPath(); ctx.arc(rx, ry, 7, 0, 7); ctx.fill();
        ctx.fillStyle = reg ? '#2e9b3a' : '#8a8f99'; ctx.beginPath(); ctx.arc(rx, ry, 6, 0, 7); ctx.fill();
        T(ctx, reg ? '✔' : '…', rx, ry + 1, 12, '#fff');
      }
      chimney(ctx, sh);
      windowView(ctx, sh);
      priceTag(ctx, S, sh);
      if (sh.status === 'open' && !C.CONNECT) doorMat(ctx, S, sh);
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
  // 문 앞 안내 풍선: 물건 · 품질 · 가격, 그리고 지금 급한 요청 조건을 맞추는지 (개편)
  function drawDoorInfo(ctx, S) {
    const sh = S.buy && S.buy.shop; if (!sh || sh.status !== 'open') return;
    const d = sh.w.door, items = itemsOf(sh), w = 176, h = 26 + items.length * 34;
    const x = Math.max(4, Math.min(C.VIEW.w - w - 4, d.x + d.w / 2 - w / 2)), y = d.y + d.h + 6;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(x, y, w, h);
    const head = sh.innov ? ['★ 혁신 공방', '#b08800'] : sh.sprout ? [sh.verified ? '새싹 공방 · 실적 ' + (C.SPROUT_GOAL - sh.trial) + '/' + C.SPROUT_GOAL : '새싹 공방 · 등록 심사 중', '#3a8a3a'] : !sh.isNew ? ['✔ 나라장터 등록 업체', '#2f4f8a'] : sh.verified ? ['✔ 실사 통과 · 등록 완료', '#2e9b3a'] : ['새 공방 · 등록 심사 중', '#6a5a3a'];
    ctx.fillStyle = head[1]; ctx.fillRect(x, y, w, 18);
    T(ctx, head[0] + (sh.tier >= 2 ? ' · 공장' : sh.tier ? ' · 작업장' : ''), x + w / 2, y + 9, 12, '#fff');
    items.forEach((it, i) => {
      const ry = y + 36 + i * 34, p = price(sh, it.id);
      G.icons.draw(ctx, it.id, x + 16, ry, 20);
      ctx.font = '12px "Galmuri11 Bold", ' + G.FONT; ctx.fillStyle = '#2a2416'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(it.name, x + 30, ry - 5);
      G.icons.stars(ctx, x + 30, ry + 2, sh.q[it.id], 3, 2);
      T(ctx, p + '만', x + 116, ry - 5, 12, p > it.price ? '#d9342b' : '#2a2416', 'right');
      // 지금 급한 이 물건 요청의 조건과 비교
      const r = G.requests.active(S).filter(q => q.item === it.id).sort((a, b) => a.left - b.left)[0];
      if (r) {
        const ok = sh.q[it.id] >= r.minQ, best = ok && bestFor(S, sh, it.id);
        ctx.fillStyle = ok ? (best ? '#2e9b3a' : '#7a9a3a') : '#d9342b'; ctx.fillRect(x + 122, ry - 11, 50, 22);
        T(ctx, ok ? (best ? '가성비!' : '조건 OK') : '조건 ✘', x + 147, ry, 12, '#fff');
      }
    });
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.lineWidth = 1;
  }
  function drawHover(ctx, S) {
    const m = G.input.mouse; if (m.x < 0) { G.canvas.style.cursor = ''; return; }
    const sh = shopAt(S, m);
    G.canvas.style.cursor = sh || G.broker.hit(S, m) || (C.CONNECT && G.requests.active(S).some(r => U.inRect(m.x, m.y, G.ui.bubbleRect(r)))) ? 'pointer' : '';
    if (!sh) return;
    const b = sh.w.body, ok = !whyNot(S, sh);
    ctx.strokeStyle = ok ? '#ffd84a' : 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6); ctx.setLineDash([]); ctx.lineWidth = 1;
  }
  return { order, spawnSprout, graduate, bestPrice, bestFor, drawDoorInfo, certified, request, whyNot, makeInnov, init, update, draw, drawHover, price, isOpen, rollRow, opened, inspected, handleInspectInput, shopAt, spawnFake, newShop };
})();
