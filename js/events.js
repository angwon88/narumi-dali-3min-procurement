/* 사건과 비축 (2026-11-02 추가, 기획서 4.3)
   ① 원자재 비축 (2026-11-03 단순화): 가격 폭등 '예보'가 뜬 동안 조달청 아래 '원자재 비축'칸에 서 있으면 0.5초마다 원자재 1상자 (최대 STOCK_MAX, 돈 안 듦).
      전에는 아무 때나 저금통 3만원을 냈는데, 저금통이 안 보여 언제·왜 하는지 알기 어려웠음
   ② 원자재 가격 폭등(2:05~2:25): 공방 가격 ×SURGE.mult. 비축 상자가 있으면 요청이 많은 업종부터 1상자씩 방출 → 그 업종 가격 정상
      (실제: 조달청은 알루미늄·구리 등 비철금속을 비축했다가 가격 급등·수급 불안 때 중소기업에 방출·대여)
   ③ 미세먼지 경보: 화면이 뿌옇고, 마을마다 마스크 요청이 몰림
   ④ 사건 예보(2026-11-02): 사건 15초 전 예보판. 예보~사건 끝까지 대비 물건은 요청 없이 미리 살 수 있고(S.prep),
      미리 산 물건을 사건 중 납품하면 '미리 대비했어요!' 보너스. 시점은 director.js가 판마다 섞어서 정함 */
'use strict';
G.events = (() => {
  const C = G.C, T = (...a) => G.world.text(...a), r1 = v => Math.round(v * 10) / 10;
  const OB = G.world.office.body;
  const ZONE = { x: OB.x + 40, y: OB.y + OB.h + 4, w: 76, h: 26 };   // 마을 말풍선과 겹치지 않게

  function init(S) {
    S.stock = 0; S.stockDwell = 0; S.stockWarned = false;
    S.surge = null; S.surgeMult = 1; S.stabilized = new Set(); S.surgeDone = false;
    S.dust = null; S.storm = null; S.forecasts = []; S.prep = new Set();
  }

  // ---------- ① 비축 ----------
  // 2026-11-03 실제 비축사업처럼 원자재(알루미늄·구리 등)를 '쌀 때' 산다. 돈은 HUD의 '아낀 세금'에서 냄(A안: 가성비로 아낀 세금 → 비축)
  //   평소 시세 1상자 3만원, 폭등 예보가 뜨면 4.5만원(이미 오르기 시작). 폭등 때 공방에 방출해 재료값을 지킴
  const MAT = { furn: '알루미늄', elec: '구리', health: '니켈', safety: '아연' };
  const forecasting = S => S.forecasts.some(f => f.id === 'surge');
  const stockOpen = S => !S.surge && !S.surgeDone;
  const matPrice = S => forecasting(S) ? C.MAT_PRICE_FORECAST : C.MAT_PRICE;
  function stockUpdate(S, dt) {
    if (C.STOCK === false) return;
    const d = G.dali, inZ = G.U.inRect(d.x, d.y, ZONE);
    if (!inZ) { S.stockDwell = 0; S.stockWarned = false; return; }
    const why = !stockOpen(S) ? '원자재 가격이 이미 올랐어요' : S.stock >= C.STOCK_MAX ? '비축 창고가 가득 찼어요 (3/3)' : S.saved < matPrice(S) ? '아낀 세금이 모자라요 (' + S.saved + '만원 · 1상자 ' + matPrice(S) + '만원)' : null;
    if (why) { S.stockDwell = 0; if (!S.stockWarned && !d.moving) { G.fx.add(S, ZONE.x + ZONE.w / 2, ZONE.y - 4, why, '#ffd6a0'); S.stockWarned = true; } return; }
    S.stockDwell += dt;
    if (S.stockDwell >= C.STOCK_DWELL) {
      const p = matPrice(S);
      S.stockDwell = 0; S.stock++; S.saved = r1(S.saved - p); S.stats.stockSpent = r1((S.stats.stockSpent || 0) + p);
      G.fx.coins(S, 326, 17, ZONE.x + ZONE.w / 2, ZONE.y + 6, 4, null, null, 0);   // 아낀 세금(HUD)에서 동전이 비축칸으로
      S.stats.stocked = (S.stats.stocked || 0) + 1;
      G.fx.add(S, ZONE.x + ZONE.w / 2, ZONE.y - 4, '아낀 세금 ' + p + '만원으로 원자재 1상자 · ' + S.stock + '/' + C.STOCK_MAX, '#9be37a', 16);
      if (S.stock === 1) G.narmi.say('원자재를 쌀 때 사 뒀어요! 값이 폭등하면 공방에 풀어요', 2.8);
      G.audio.play('buy');
    }
  }

  // ---------- ② 원자재 가격 폭등 ----------
  const catNames = { furn: '가구', elec: '전자', health: '보건', safety: '안전' };
  function surgeStart(S) {
    endForecast(S, 'surge');
    S.surge = { t: 0 }; S.surgeMult = C.SURGE.mult;
    const demand = cat => G.requests.active(S).filter(r => G.ITEM[r.item].cat === cat).length;
    const cats = G.world.CATS.map(c => c.id).sort((a, b) => demand(b) - demand(a));
    const n = Math.min(S.stock, cats.length), pick = cats.slice(0, n);
    S.stock -= n; S.stats.released = n;
    if (n) { S.score += C.PREP_BONUS * n; G.score.trust(S, C.PREP_TRUST); S.stats.prepared = (S.stats.prepared || 0) + n;
      G.fx.add(S, OB.x + OB.w / 2, OB.y + OB.h + 50, '미리 대비! +' + C.PREP_BONUS * n, '#ffe48a', 16); }
    if (n) G.director.banner(S, '원자재 가격 폭등! 비축 원자재 방출', pick.map(c => catNames[c]).join('·') + ' 공방은 재료값 그대로 · 나머지 공방 값 ×' + C.SURGE.mult);
    else G.director.banner(S, '원자재 가격 폭등! 공방 값 ×' + C.SURGE.mult, '비축해 둔 원자재가 없어요… 다음엔 쌀 때 미리 비축해요');
    G.audio.play(n ? 'gift' : 'warn');
    pick.forEach((cat, i) => {                         // 상자가 조달청 창고에서 그 업종 공방 사이로 날아감
      const row = G.world.CATS.findIndex(c => c.id === cat), a = G.world.shops[row * 2], b = G.world.shops[row * 2 + 1];
      const tx = (a.body.x + b.body.x + b.body.w) / 2, ty = a.body.y + 40;
      G.fx.coins(S, OB.x + OB.w + 14, OB.y + OB.h - 10, tx, ty, 1, () => {
        S.stabilized.add(cat);
        G.fx.add(S, tx, a.body.y + 112, catNames[cat] + ' 공방에 ' + MAT[cat] + ' 방출! 값 그대로', '#9be37a', 16);
      }, 'crate', i * 0.15);
    });
  }
  function surgeEnd(S) {
    endPrep(S, 'surge');
    S.surge = null; S.surgeMult = 1; S.stabilized.clear(); S.surgeDone = true;
    G.director.banner(S, '원자재 가격이 안정됐어요', '');
  }
  // ---------- ④ 예보 ----------
  const FORECAST = {
    dust:  { name: '미세먼지 예보', need: '마스크를 미리 준비해요', items: ['mask'], icon: 'mask' },
    storm: { name: '태풍 예보', need: '곧 소방서·보건소·학교에 긴급 계약!', items: [], icon: 'helmet' },   // 2026-11-03 '미리 사 두기' 뺌: 예보는 경고만
    surge: { name: '원자재 가격 폭등 예보', need: '시세가 오르기 시작! 지금이라도 비축', items: [], icon: null },
  };
  G.director.on('forecast', (S, p) => {
    const f = FORECAST[p.id]; if (!f) return;
    S.forecasts.push({ id: p.id, at: p.at });
    f.items.forEach(it => S.prep.add(it));
    G.director.banner(S, f.name + ' · ' + C.FORECAST_SEC + '초 뒤', f.need + (p.id === 'surge' ? " · 지금 비축하면 '위기 대응' 임무!" : ''));
    G.narmi.say(p.id === 'surge' ? '원자재 값이 오를 거예요! 아낀 세금으로 비축칸에서 사 둬요' : '태풍이 와요! 긴급 계약을 빨리 해결해요', 3);
    G.audio.play('warn');
  });
  function endForecast(S, id) {
    S.forecasts = S.forecasts.filter(f => f.id !== id);
  }
  function endPrep(S, id) { FORECAST[id].items.forEach(it => S.prep.delete(it)); }
  G.director.on('surgeStart', surgeStart);
  G.director.on('surgeEnd', surgeEnd);
  // 공방 가격에 곱할 값 (shops.price가 부른다)
  function priceMult(sh) {
    const S = G.S; if (!S || !S.surge || sh.fake || sh.tier >= 2) return 1;   // 공장은 폭등 영향 없음
    return S.stabilized.has(sh.cat) ? 1 : S.surgeMult;
  }

  // ---------- ③ 미세먼지 경보 ----------
  function dustStart(S) {
    endForecast(S, 'dust');
    S.dust = { t: 0, specks: Array.from({ length: 70 }, () => ({ x: Math.random() * C.VIEW.w, y: C.HUD_H + Math.random() * (C.VIEW.h - C.HUD_H), s: 1 + Math.random() * 2 })) };
    G.director.banner(S, '미세먼지 경보! 긴급조달 시작', '마을마다 마스크가 급해요 · 긴급 계약 점수 ×' + C.STORM.mult);
    G.audio.play('warn');
    for (const v of G.world.villages) {                // 열린 마을마다 마스크 요청 하나씩
      if (S.openVillages.has(v.id) && makeUrgent(S, v.id, 'mask')) S.stats.urgentMade = (S.stats.urgentMade || 0) + 1;   // 긴급 계약으로 (2026-11-03)
    }
  }
  function dustEnd(S) { endPrep(S, 'dust'); S.dust = null; for (const r of G.requests.active(S)) if (r.urgent && !S.storm) r.urgent = false; G.director.banner(S, '미세먼지가 걷혔어요', ''); }
  // ---------- ⑤ 폭우·태풍 위기 (기획서 4.2, 2026-11-03 구현) ----------
  // 소방서(안전모)·보건소(구급상자)·학교(전등, 정전)에 긴급 계약. 빨간 '긴급 ×2' 탭, 점수 ×2. 태풍 중 STORM.every초마다 소방서·보건소에 긴급 계약.
  // 마을 말풍선이 꽉 찼으면 그 마을의 가장 여유 있는 계약을 긴급으로 바꿈. 비 때문에 달이 이동 -10%(우산)
  function makeUrgent(S, vid, item) {
    if (!S.openVillages.has(vid) || !S.openCats.has(G.ITEM[item].cat)) return null;
    const mine = G.requests.ofVillage(S, vid);
    let r = mine.length < C.MAX_REQ_PER_VILLAGE ? G.requests.spawn(S, { vid, item, urgent: true }) : null;
    if (!r) r = mine.filter(q => !q.urgent && !q.broker && !q.ship).sort((a, b) => b.left - a.left)[0];
    if (!r) return null;
    r.urgent = true; r.limit = r.left = C.STORM.limit; r.t = 0;
    return r;
  }
  function stormStart(S) {
    endForecast(S, 'storm');
    S.storm = { t: 0, clock: C.STORM.every, drops: Array.from({ length: 110 }, () => ({ x: Math.random() * C.VIEW.w, y: C.HUD_H + Math.random() * (C.VIEW.h - C.HUD_H), v: 380 + Math.random() * 220 })) };
    S.stats.urgentMade = S.stats.urgentMade || 0; S.stats.urgentDone = S.stats.urgentDone || 0;
    G.director.banner(S, '태풍 상륙! 긴급조달 시작', '소방서·보건소·학교가 급해요 · 긴급 계약 점수 ×' + C.STORM.mult + ' · 비 때문에 조금 느려요');
    G.audio.play('warn'); S.shakeT = Math.max(S.shakeT || 0, 0.3);
    for (const [vid, item] of [['fire', 'helmet'], ['clinic', 'kit'], ['school', 'lamp']]) if (makeUrgent(S, vid, item)) S.stats.urgentMade++;
  }
  function stormEnd(S) {
    endPrep(S, 'storm'); S.storm = null;
    for (const r of G.requests.active(S)) if (r.urgent) r.urgent = false;     // 남은 긴급 계약은 보통 계약으로
    const done = S.stats.urgentDone || 0;
    G.director.banner(S, '위기 극복!', '태풍 동안 긴급 계약 ' + done + '건을 해결했어요');
    G.audio.play(done ? 'gift' : 'banner');
  }
  G.director.on('stormStart', stormStart);
  G.director.on('stormEnd', stormEnd);
  G.director.on('dustStart', dustStart);
  G.director.on('dustEnd', dustEnd);

  function update(S, dt) {
    stockUpdate(S, dt);
    if (S.surge) S.surge.t += dt;
    if (S.dust) { S.dust.t += dt; for (const p of S.dust.specks) { p.x += (14 + p.s * 6) * dt; if (p.x > C.VIEW.w) p.x -= C.VIEW.w; } }
    if (S.storm) {
      S.storm.t += dt;
      for (const d of S.storm.drops) { d.y += d.v * dt; d.x -= d.v * 0.25 * dt; if (d.y > C.VIEW.h) { d.y = C.HUD_H; d.x = Math.random() * (C.VIEW.w + 120); } }
      if ((S.storm.clock -= dt) <= 0) {                                   // 태풍 중 소방서·보건소에 긴급 계약
        S.storm.clock += C.STORM.every;
        const pick = Math.random() < 0.5 ? ['fire', 'helmet'] : ['clinic', 'kit'];
        if (makeUrgent(S, pick[0], pick[1])) S.stats.urgentMade++;
      }
    }
  }

  // ---------- 그리기 ----------
  function crate(ctx, x, y) {                          // 원자재 상자 (14px)
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x, y, 14, 12);
    ctx.fillStyle = '#a07a50'; ctx.fillRect(x + 1, y + 1, 12, 4);
    ctx.fillStyle = '#c0c6cc'; ctx.fillRect(x + 3, y + 6, 8, 3);    // 금속 덩어리
  }
  function drawWorld(ctx, S) {
    if (C.STOCK === false) return;                                     // 시험판: 비축칸·창고·시세판 숨김
    // 비축칸
    // 비축칸 (2026-11-03): 폭등 전에는 언제든 비축 예산으로 원자재 구입. 예보 때는 진하게 깜빡이며 재촉
    const z = ZONE, can = stockOpen(S) && S.stock < C.STOCK_MAX && S.saved >= matPrice(S), PREP = G.missions.BY.prep.col;
    const fc = forecasting(S), on = Math.floor(S.elapsed * 3) % 2 === 0;
    ctx.fillStyle = can ? (fc ? (on ? PREP : '#0b5d68') : 'rgba(15,138,150,.35)') : 'rgba(0,0,0,.08)'; ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeStyle = can ? (fc ? '#fff' : PREP) : 'rgba(80,60,30,.5)'; ctx.setLineDash([3, 3]); ctx.strokeRect(z.x + .5, z.y + .5, z.w - 1, z.h - 1); ctx.setLineDash([]);
    crate(ctx, z.x + 4, z.y + 7);
    T(ctx, '원자재 비축', z.x + z.w / 2 + 8, z.y + z.h / 2 + 1, 12, can && fc ? '#fff' : can ? '#0b4d58' : '#6a5a3a');
    if (S.stockDwell > 0) { ctx.fillStyle = '#ffd84a'; ctx.fillRect(z.x, z.y + z.h - 3, Math.round(z.w * S.stockDwell / C.STOCK_DWELL), 3); }
    if (!fc && stockOpen(S)) T(ctx, '아낀 세금으로 1상자 ' + matPrice(S) + '만', z.x + z.w / 2, z.y + z.h + 10, 12, '#4a3f2a');
    // 비축 창고 (조달청 오른쪽 옆): 금속 원자재 상자
    const sx = OB.x + OB.w + 6, sy = OB.y + OB.h - 14;
    for (let i = 0; i < C.STOCK_MAX; i++) {
      if (i < S.stock) crate(ctx, sx + (i % 2) * 15, sy - Math.floor(i / 2) * 13);
      else { ctx.strokeStyle = 'rgba(80,60,30,.35)'; ctx.strokeRect(sx + (i % 2) * 15 + .5, sy - Math.floor(i / 2) * 13 + .5, 13, 11); }
    }
    T(ctx, '창고 ' + S.stock + '/' + C.STOCK_MAX, sx + 15, sy + 22, 12, '#4a3f2a');
    // 원자재 시세판 (창고 위): 평소 / 예보(▲ 오르는 중) / 폭등(×1.6)
    const bx = OB.x + OB.w + 8, by = OB.y + 4, bw = 82, up = fc || S.surge;
    ctx.fillStyle = '#1e2a3a'; ctx.fillRect(bx, by, bw, 46); ctx.fillStyle = up ? '#d9342b' : '#2e9b3a'; ctx.fillRect(bx, by, bw, 3);
    T(ctx, '원자재 시세', bx + bw / 2, by + 11, 12, '#cfd8e3');
    T(ctx, '알루미늄·구리', bx + bw / 2, by + 24, 12, '#c0c6cc');
    T(ctx, S.surge ? '폭등 ×' + C.SURGE.mult : (up ? '▲ ' : '') + matPrice(S) + '만/상자', bx + bw / 2, by + 37, 12, up ? '#ff8a7a' : '#9be37a');
    // 폭등 중: 공방 지붕 위 표시
    if (S.surge) {
      for (const sh of S.shops) {
        if (!G.shops.isOpen(S, sh) || sh.fake) continue;
        const b = sh.w.body, ok = S.stabilized.has(sh.cat);
        const ty = sh.innov ? b.y + 84 : b.y + 72;      // 혁신 공방은 '시범 사용' 표시 아래로
        ctx.fillStyle = ok || sh.tier >= 2 ? '#2e9b3a' : '#d9342b'; ctx.fillRect(b.x + b.w / 2 - 44, ty, 88, 14);
        T(ctx, ok ? '비축 덕분 그대로' : sh.tier >= 2 ? '공장 · 그대로' : '재료값 ×' + S.surgeMult, b.x + b.w / 2, ty + 7, 12, '#fff');
      }
    }
  }
  // 폭등 예보 중 비축 안내 (마을 말풍선보다 위층에 그림)
  function drawCallout(ctx, S) {
    const z = ZONE; if (!forecasting(S) || !stockOpen(S) || S.stock >= C.STOCK_MAX || S.saved < matPrice(S)) return;
    const w = 168, x = z.x + z.w / 2 - w / 2, y = z.y + z.h + 6;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 2, y + 3, w, 20);
    ctx.fillStyle = '#0b5d68'; ctx.fillRect(x, y, w, 20); ctx.fillStyle = '#ffd84a'; ctx.fillRect(x, y, w, 2);
    T(ctx, '지금이라도 비축! (1상자 ' + matPrice(S) + '만)', x + w / 2, y + 11, 12, '#ffd84a');
    const ay = z.y - 10 + Math.sin(S.elapsed * 6) * 3;
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.moveTo(z.x + z.w / 2 - 7, ay - 6); ctx.lineTo(z.x + z.w / 2 + 7, ay - 6); ctx.lineTo(z.x + z.w / 2, ay + 2); ctx.fill();
  }
  function drawOverlay(ctx, S) {                       // 태풍 비 · 미세먼지 (HUD 아래 전체)
    if (S.storm) {
      const k = Math.min(1, S.storm.t / 0.8);
      ctx.fillStyle = 'rgba(20,32,60,' + (0.28 * k).toFixed(2) + ')'; ctx.fillRect(0, C.HUD_H, C.VIEW.w, C.VIEW.h - C.HUD_H);
      ctx.strokeStyle = 'rgba(190,215,255,' + (0.55 * k).toFixed(2) + ')'; ctx.lineWidth = 1; ctx.beginPath();
      for (const d of S.storm.drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 4, d.y + 14); }
      ctx.stroke();
      if (Math.floor(S.storm.t * 10) % 37 === 0) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, C.HUD_H, C.VIEW.w, C.VIEW.h - C.HUD_H); }   // 가끔 번개
    }
    if (!S.dust) return;
    const t = S.dust.t, dur = 15, k = Math.min(1, t / 1.2, Math.max(0, (dur - t) / 1.2));
    const top = C.HUD_H, W = C.VIEW.w, H = C.VIEW.h;
    // ① 누런 막 (위쪽이 더 짙게)
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, 'rgba(170,140,80,' + (0.55 * k) + ')'); g.addColorStop(1, 'rgba(190,165,110,' + (0.35 * k) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, top, W, H - top);
    // ② 흘러가는 큰 먼지 구름
    for (let i = 0; i < 7; i++) {
      const x = ((i * 173 + t * (18 + i * 4)) % (W + 240)) - 120, y = top + 40 + (i * 71) % (H - top - 60);
      ctx.fillStyle = 'rgba(150,125,80,' + (0.18 * k) + ')';
      for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(x + j * 26, y + Math.sin(j + i) * 8, 30 - j * 3, 0, Math.PI * 2); ctx.fill(); }
    }
    // ③ 먼지 알갱이
    ctx.fillStyle = 'rgba(100,85,60,' + (0.7 * k) + ')';
    for (const p of S.dust.specks) ctx.fillRect(Math.round(p.x), Math.round(p.y + Math.sin(p.x / 40) * 4), p.s + 1, p.s + 1);
    // ④ 마을에서 '콜록'
    for (const v of G.world.villages) {
      if (!S.openVillages.has(v.id)) continue;
      const ph = (t * 0.9 + v.idx * 0.37) % 1;
      ctx.globalAlpha = k * (1 - ph);
      T(ctx, '콜록', v.yard.x + 40 + v.idx * 37 % 140, v.yard.y + 10 - ph * 24, 12, '#5a4630');
    }
    ctx.globalAlpha = 1;
    ctx.globalAlpha = 1;
  }
  // HUD 아래 오른쪽 상태판: 진행 중 사건 → 예보 순으로 쌓기
  function drawBoards(ctx, S) {
    const W = C.VIEW.w, boards = [];
    if (S.dust) boards.push({ col: '90,70,40', line: '#ffd84a', icon: 'mask', text: '미세먼지 나쁨 · ' + Math.max(0, Math.ceil(C.EVENT_DUR.dust - S.dust.t)) + '초' });
    if (S.surge) boards.push({ col: '140,40,30', line: '#ffd84a', icon: null, text: '원자재 가격 폭등 · ' + Math.max(0, Math.ceil(C.EVENT_DUR.surge - S.surge.t)) + '초' });
    for (const f of S.forecasts) {
      const F = FORECAST[f.id], left = Math.max(0, Math.ceil(f.at - S.elapsed));
      boards.push({ col: '30,60,110', line: '#5ec8f2', icon: F.icon, text: F.name + ' · ' + left + '초 뒤', sub: F.need, blink: left <= 5 });
    }
    boards.forEach((b, i) => {
      const h = b.sub ? 38 : 24, w = 236, x = W - w - 10, y = C.HUD_H + 4 + i * 42;
      const on = !b.blink || Math.floor(S.elapsed * 3) % 2 === 0;
      ctx.fillStyle = 'rgba(' + b.col + ',' + (on ? 0.94 : 0.75) + ')'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = b.line; ctx.fillRect(x, y, w, 2);
      if (b.icon) G.icons.draw(ctx, b.icon, x + 16, y + 12, 16);
      else G.events.crate(ctx, x + 9, y + 6);
      T(ctx, b.text, x + 32, y + 12, 12, '#fff', 'left');
      if (b.sub) T(ctx, b.sub, x + 32, y + 28, 12, '#cfe3f5', 'left');
    });
  }
  return { drawCallout, init, update, drawWorld, drawOverlay, drawBoards, priceMult, crate, ZONE, FORECAST };
})();
