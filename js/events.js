/* 사건과 비축 (2026-11-02 추가, 기획서 4.3)
   ① 원자재 비축: 조달청 건물 아래 '비축칸'에 0.5초 서 있으면 세금 저금통 STOCK_COST만원 → 원자재 1상자 (최대 STOCK_MAX)
   ② 원자재 가격 폭등(2:05~2:25): 공방 가격 ×SURGE.mult. 비축 상자가 있으면 요청이 많은 업종부터 1상자씩 방출 → 그 업종 가격 정상
      (실제: 조달청은 알루미늄·구리 등 비철금속을 비축했다가 가격 급등·수급 불안 때 중소기업에 방출·대여)
   ③ 미세먼지 경보(1:05~1:20): 화면이 뿌옇고, 마을마다 마스크 요청이 몰림 */
'use strict';
G.events = (() => {
  const C = G.C, T = (...a) => G.world.text(...a), r1 = v => Math.round(v * 10) / 10;
  const OB = G.world.office.body;
  const ZONE = { x: OB.x + 10, y: OB.y + OB.h + 4, w: OB.w - 20, h: 26 };

  function init(S) {
    S.stock = 0; S.stockDwell = 0; S.stockWarned = false;
    S.surge = null; S.surgeMult = 1; S.stabilized = new Set(); S.surgeDone = false;
    S.dust = null;
  }

  // ---------- ① 비축 ----------
  function stockUpdate(S, dt) {
    const d = G.dali, inZ = G.U.inRect(d.x, d.y, ZONE);
    if (!inZ) { S.stockDwell = 0; S.stockWarned = false; return; }
    const why = S.surge || S.surgeDone ? '원자재 가격이 이미 올랐어요' : S.stock >= C.STOCK_MAX ? '비축 창고가 가득 찼어요' : S.bank < C.STOCK_COST ? '저금통 ' + C.STOCK_COST + '만원부터 비축할 수 있어요' : null;
    if (why) { S.stockDwell = 0; if (!S.stockWarned && !d.moving) { G.fx.add(S, ZONE.x + ZONE.w / 2, ZONE.y - 4, why, '#ffd6a0'); S.stockWarned = true; } return; }
    S.stockDwell += dt;
    if (S.stockDwell >= C.STOCK_DWELL) {
      S.stockDwell = 0; S.bank = r1(S.bank - C.STOCK_COST); S.stock++;
      S.stats.stocked = (S.stats.stocked || 0) + 1;
      G.fx.add(S, ZONE.x + ZONE.w / 2, ZONE.y - 4, '원자재 비축 +1 (' + S.stock + '/' + C.STOCK_MAX + ')', '#9be37a', 16);
      G.audio.play('buy');
    }
  }

  // ---------- ② 원자재 가격 폭등 ----------
  const catNames = { furn: '가구', elec: '전자', health: '보건', safety: '안전' };
  function surgeStart(S) {
    S.surge = { t: 0 }; S.surgeMult = C.SURGE.mult;
    const demand = cat => G.requests.active(S).filter(r => G.ITEM[r.item].cat === cat).length;
    const cats = G.world.CATS.map(c => c.id).sort((a, b) => demand(b) - demand(a));
    const n = Math.min(S.stock, cats.length), pick = cats.slice(0, n);
    S.stock -= n; S.stats.released = n;
    if (n) G.director.banner(S, '원자재 가격 폭등! 비축 원자재 방출', pick.map(c => catNames[c]).join('·') + ' 공방 가격을 지켰어요 · 나머지 ×' + C.SURGE.mult);
    else G.director.banner(S, '원자재 가격 폭등! 공방 가격 ×' + C.SURGE.mult, '비축해 둔 원자재가 없어요… (조달청 아래 비축칸)');
    G.audio.play(n ? 'gift' : 'warn');
    pick.forEach((cat, i) => {                         // 상자가 조달청 창고에서 그 업종 공방 사이로 날아감
      const row = G.world.CATS.findIndex(c => c.id === cat), a = G.world.shops[row * 2], b = G.world.shops[row * 2 + 1];
      const tx = (a.body.x + b.body.x + b.body.w) / 2, ty = a.body.y + 40;
      G.fx.coins(S, OB.x + OB.w + 14, OB.y + OB.h - 10, tx, ty, 1, () => {
        S.stabilized.add(cat);
        G.fx.add(S, tx, a.body.y + 112, '비축 방출! ' + catNames[cat] + ' 가격 안정', '#9be37a', 16);
      }, 'crate', i * 0.15);
    });
  }
  function surgeEnd(S) {
    S.surge = null; S.surgeMult = 1; S.stabilized.clear(); S.surgeDone = true;
    G.director.banner(S, '원자재 가격이 안정됐어요', '');
  }
  G.director.on('surgeWarn', S => { G.director.banner(S, '곧 원자재 가격이 오른대요!', '조달청 아래 비축칸에서 미리 비축해요'); G.audio.play('warn'); });
  G.director.on('surgeStart', surgeStart);
  G.director.on('surgeEnd', surgeEnd);
  // 공방 가격에 곱할 값 (shops.price가 부른다)
  function priceMult(sh) {
    const S = G.S; if (!S || !S.surge || sh.fake) return 1;
    return S.stabilized.has(sh.cat) ? 1 : S.surgeMult;
  }

  // ---------- ③ 미세먼지 경보 ----------
  function dustStart(S) {
    S.dust = { t: 0, specks: Array.from({ length: 70 }, () => ({ x: Math.random() * C.VIEW.w, y: C.HUD_H + Math.random() * (C.VIEW.h - C.HUD_H), s: 1 + Math.random() * 2 })) };
    G.director.banner(S, '미세먼지 경보!', '마을마다 마스크가 필요해요 · 보건 공방으로');
    G.audio.play('warn');
    for (const v of G.world.villages) {                // 열린 마을마다 마스크 요청 하나씩
      if (S.openVillages.has(v.id) && G.requests.ofVillage(S, v.id).length < C.MAX_REQ_PER_VILLAGE) G.requests.spawn(S, { vid: v.id, item: 'mask' });
    }
  }
  function dustEnd(S) { S.dust = null; G.director.banner(S, '미세먼지가 걷혔어요', ''); }
  G.director.on('dustStart', dustStart);
  G.director.on('dustEnd', dustEnd);

  function update(S, dt) {
    stockUpdate(S, dt);
    if (S.surge) S.surge.t += dt;
    if (S.dust) { S.dust.t += dt; for (const p of S.dust.specks) { p.x += (14 + p.s * 6) * dt; if (p.x > C.VIEW.w) p.x -= C.VIEW.w; } }
  }

  // ---------- 그리기 ----------
  function crate(ctx, x, y) {                          // 원자재 상자 (14px)
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x, y, 14, 12);
    ctx.fillStyle = '#a07a50'; ctx.fillRect(x + 1, y + 1, 12, 4);
    ctx.fillStyle = '#c0c6cc'; ctx.fillRect(x + 3, y + 6, 8, 3);    // 금속 덩어리
  }
  function drawWorld(ctx, S) {
    // 비축칸
    const z = ZONE, can = !S.surge && !S.surgeDone && S.stock < C.STOCK_MAX && S.bank >= C.STOCK_COST;
    ctx.fillStyle = can ? 'rgba(155,227,122,.35)' : 'rgba(0,0,0,.08)'; ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeStyle = can ? '#2e9b3a' : 'rgba(80,60,30,.5)'; ctx.setLineDash([3, 3]); ctx.strokeRect(z.x + .5, z.y + .5, z.w - 1, z.h - 1); ctx.setLineDash([]);
    T(ctx, '원자재 비축 ' + C.STOCK_COST + '만원', z.x + z.w / 2, z.y + z.h / 2 + 1, 12, can ? '#1f5a1f' : '#6a5a3a');
    if (S.stockDwell > 0) { ctx.fillStyle = '#2e9b3a'; ctx.fillRect(z.x, z.y + z.h - 3, Math.round(z.w * S.stockDwell / C.STOCK_DWELL), 3); }
    // 비축 창고 (조달청 오른쪽 옆): 상자 더미
    const sx = OB.x + OB.w + 6, sy = OB.y + OB.h - 14;
    for (let i = 0; i < C.STOCK_MAX; i++) {
      if (i < S.stock) crate(ctx, sx + (i % 2) * 15, sy - Math.floor(i / 2) * 13);
      else { ctx.strokeStyle = 'rgba(80,60,30,.35)'; ctx.strokeRect(sx + (i % 2) * 15 + .5, sy - Math.floor(i / 2) * 13 + .5, 13, 11); }
    }
    T(ctx, '비축 ' + S.stock + '/' + C.STOCK_MAX, sx + 15, sy + 22, 12, '#4a3f2a');
    // 폭등 중: 공방 지붕 위 표시
    if (S.surge) {
      for (const sh of S.shops) {
        if (!G.shops.isOpen(S, sh) || sh.fake) continue;
        const b = sh.w.body, ok = S.stabilized.has(sh.cat);
        const ty = sh.innov ? b.y + 84 : b.y + 66;      // 혁신 공방은 '시범 사용' 표시 아래로
        ctx.fillStyle = ok ? '#2e9b3a' : '#d9342b'; ctx.fillRect(b.x + b.w / 2 - 30, ty, 60, 14);
        T(ctx, ok ? '비축 방출' : '재료값 ×' + S.surgeMult, b.x + b.w / 2, ty + 7, 12, '#fff');
      }
    }
  }
  function drawOverlay(ctx, S) {                       // 미세먼지 (HUD 아래 전체)
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
    // ⑤ 상태 표시: HUD 바로 아래 오른쪽
    const bx = W - 196, by = top + 4;
    ctx.fillStyle = 'rgba(90,70,40,' + (0.92 * k) + ')'; ctx.fillRect(bx, by, 184, 24);
    ctx.fillStyle = 'rgba(255,216,74,' + k + ')'; ctx.fillRect(bx, by, 184, 2);
    ctx.globalAlpha = k; G.icons.draw(ctx, 'mask', bx + 16, by + 13, 16);
    T(ctx, '미세먼지 나쁨 · ' + Math.max(0, Math.ceil(dur - t)) + '초', bx + 100, by + 13, 12, '#fff');
    ctx.globalAlpha = 1;
  }
  return { init, update, drawWorld, drawOverlay, priceMult, crate, ZONE };
})();
