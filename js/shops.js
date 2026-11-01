/* 공방: 가격 · 영업 상태 · 구매 (기획서 3.3, 3.4)
   경쟁 유지·수상한 공방·혁신은 이후 작업에서 이 파일에 얹는다. */
'use strict';
G.shops = (() => {
  const C = G.C, U = G.U;
  const round1 = v => Math.round(v * 10) / 10;

  function init(S) {
    S.shops = G.world.shops.map(w => ({ w, idx: w.idx, cat: w.cat.id, mult: 1, status: 'open' }));
    for (let r = 0; r < 4; r++) rollRow(S, r);
    for (const sh of S.shops) { sh.fx = null; sh.openFx = null; }
    S.priceClock = C.PRICE_REROLL_SEC;
    S.buy = { shop: null, dwell: 0, warned: false };
  }
  // 같은 행 두 공방의 배율은 0.05 이상 차이 나게
  function rollRow(S, r) {
    const a = S.shops[r * 2], b = S.shops[r * 2 + 1];
    a.mult = U.rand(C.PRICE_NORMAL[0], C.PRICE_NORMAL[1]);
    do b.mult = U.rand(C.PRICE_NORMAL[0], C.PRICE_NORMAL[1]); while (Math.abs(a.mult - b.mult) < 0.05);
  }
  const isOpen = (S, sh) => sh.status === 'open' && S.openCats.has(sh.cat);
  const itemsOf = sh => G.ITEMS.filter(i => i.cat === sh.cat);
  const price = (sh, itemId) => round1(G.ITEM[itemId].price * sh.mult);

  // 이 공방에서 지금 사야 하는 물건: 요청 중이고 아직 가방에 그만큼 없는 것 중 가장 급한 것
  function wanted(S, sh) {
    let best = null;
    for (const it of itemsOf(sh)) {
      const reqs = G.requests.active(S).filter(r => r.item === it.id).sort((a, b) => a.left - b.left);
      const carried = G.dali.bag.filter(b => b.item === it.id).length;
      if (reqs.length > carried) { const r = reqs[carried]; if (!best || r.left < best.left) best = { item: it.id, left: r.left }; }
    }
    return best && best.item;
  }

  function buy(S, sh, item) {
    const p = price(sh, item);
    G.dali.bag.push({ item, paid: p, shop: sh.idx });
    S.stats.bought = (S.stats.bought || 0) + 1;
    const d = sh.w.door;
    G.fx.add(S, d.x + d.w / 2, d.y - 6, G.ITEM[item].name + ' 구매 ' + p + '만원', '#fff');
  }

  // 타임라인이 카테고리를 열 때: 셔터가 0.8초 동안 올라감
  function opened(S, cat) { for (const sh of S.shops) if (sh.cat === cat) sh.openFx = 0; }

  // 20초마다 가격 다시 뽑기. 바뀐 공방 간판은 1.5초 반짝이며 ▲(비싸짐)·▼(싸짐) 표시
  function reroll(S) {
    const before = S.shops.map(sh => sh.mult);
    for (let r = 0; r < 4; r++) rollRow(S, r);
    for (const sh of S.shops) {
      const d = sh.mult - before[sh.idx];
      sh.fx = S.openCats.has(sh.cat) && Math.abs(d) > 0.005 ? { t: 0, dir: d > 0 ? 1 : -1 } : null;
    }
  }

  // 매 프레임: 달이가 구매칸에 있으면 자동(0.4초 머무르기) 또는 E·Enter로 구매
  function update(S, dt) {
    S.priceClock -= dt;
    if (S.priceClock <= 0) { reroll(S); S.priceClock += C.PRICE_REROLL_SEC; }
    for (const sh of S.shops) {
      if (sh.fx && (sh.fx.t += dt) > 1.5) sh.fx = null;
      if (sh.openFx != null && (sh.openFx += dt) > 0.8) sh.openFx = null;
    }
    const dali = G.dali, B = S.buy;
    const sh = S.shops.find(s => isOpen(S, s) && U.inRect(dali.x, dali.y, s.w.door)) || null;
    if (sh !== B.shop) { B.shop = sh; B.dwell = 0; B.warned = false; }
    if (!sh) return;
    const item = wanted(S, sh);
    const full = dali.bag.length >= S.bagCap;
    const press = G.input.hit('e') || G.input.hit('enter');
    if (!item || full) {
      B.dwell = 0;
      if (!B.warned && (press || dali.moving === false)) {
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
      if (B.dwell >= C.BUY_DWELL) { buy(S, sh, item); B.dwell = 0; }
    }
  }

  // 셔터: k = 내려온 비율(1 = 다 닫힘)
  function shutter(ctx, b, k, label) {
    const h = Math.round((b.h - 22) * k); if (h <= 0) return;
    ctx.fillStyle = '#7d8590'; ctx.fillRect(b.x + 4, b.y + 22, b.w - 8, h);
    ctx.fillStyle = '#6a7179'; for (let y = b.y + 26; y < b.y + 22 + h; y += 6) ctx.fillRect(b.x + 4, y, b.w - 8, 2);
    if (label) G.world.text(ctx, '준비 중', b.x + b.w / 2, b.y + 43, 12, '#fff');
  }

  // 간판 가격표(건물 벽) + 준비 중 셔터
  function draw(ctx, S) {
    for (const sh of S.shops) {
      const b = sh.w.body;
      if (!S.openCats.has(sh.cat)) { shutter(ctx, b, 1, true); continue; }
      const flash = sh.fx && Math.floor(sh.fx.t * 6) % 2 === 0;
      if (sh.fx) { ctx.fillStyle = flash ? '#ffd84a' : '#fff3b0'; ctx.fillRect(b.x + 4, b.y + 23, 96, 38); }
      ctx.fillStyle = '#fffdf6'; ctx.fillRect(b.x + 6, b.y + 25, 92, 34);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(b.x + 6, b.y + 41, 92, 1);
      itemsOf(sh).forEach((it, i) => {
        const y = b.y + 33 + i * 17;
        G.icons.draw(ctx, it.id, b.x + 17, y, 14);
        G.world.text(ctx, price(sh, it.id) + '만', b.x + 58, y + 1, 12, '#2a2416');
        if (sh.fx) G.world.text(ctx, sh.fx.dir > 0 ? '▲' : '▼', b.x + 89, y + 1, 12, sh.fx.dir > 0 ? '#d9342b' : '#2e9b3a');
      });
      if (sh.openFx != null) shutter(ctx, b, 1 - sh.openFx / 0.8, false);
    }
  }
  return { init, update, draw, price, isOpen, rollRow, opened };
})();
