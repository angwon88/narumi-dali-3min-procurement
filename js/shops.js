/* 공방: 가격 · 영업 상태 · 구매 (기획서 3.3, 3.4)
   경쟁 유지·수상한 공방·혁신은 이후 작업에서 이 파일에 얹는다. */
'use strict';
G.shops = (() => {
  const C = G.C, U = G.U;
  const round1 = v => Math.round(v * 10) / 10;

  function init(S) {
    S.shops = G.world.shops.map(w => ({ w, idx: w.idx, cat: w.cat.id, mult: 1, status: 'open' }));
    for (let r = 0; r < 4; r++) rollRow(S, r);
    for (const sh of S.shops) { sh.fx = null; sh.openFx = null; sh.verified = false; sh.stampT = 0; }
    S.inspectCD = 0; S.inspectCDMax = C.INSPECT_COOLDOWN;
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

  // ---------- 나르미 검증 (기획서 3.6) ----------
  const shopAt = (S, p) => S.shops.find(sh => U.inRect(p.x, p.y, sh.w.body)) || null;
  // 지정할 수 없으면 이유 문자열, 가능하면 null
  function whyNot(S, sh) {
    if (!isOpen(S, sh)) return '아직 문을 안 열었어요';
    if (sh.verified) return '이미 검증한 공방이에요';
    if (G.narmi.busy() || S.inspectCD > 0) return '나르미가 숨 고르는 중 (' + Math.ceil(S.inspectCD) + '초)';
    return null;
  }
  function request(S, sh) {
    const why = whyNot(S, sh), b = sh.w.body;
    if (why) { G.fx.add(S, b.x + b.w / 2, b.y + 12, why, '#ffd6a0'); return false; }
    G.narmi.send(S, sh);
    S.stats.inspected = (S.stats.inspected || 0) + 1;
    return true;
  }
  // 검증 결과: 지금은 모두 정상 → 초록 도장. 수상한 공방 적발은 6번 작업에서 이 함수에 추가
  function inspected(S, sh) {
    sh.verified = true; sh.stampT = 0;
    const b = sh.w.body; G.fx.add(S, b.x + b.w / 2, b.y + 8, '✔ 정상 공방', '#9be37a');
  }
  // 클릭·탭 또는 Space(달이에게 가장 가까운 열린 공방)
  function handleInspectInput(S) {
    for (const p of G.input.taps) { const sh = shopAt(S, p); if (sh) { request(S, sh); return; } }
    if (G.input.hit(' ')) {
      const d = G.dali; let best = null, bd = 1e9;
      for (const sh of S.shops) {
        if (!isOpen(S, sh) || sh.verified) continue;
        const c = sh.w.door, dist = Math.hypot(c.x + c.w / 2 - d.x, c.y + c.h / 2 - d.y);
        if (dist < bd) { bd = dist; best = sh; }
      }
      if (best) request(S, best);
    }
  }
  // 마우스를 올린 공방 테두리 (지정 가능하면 노랑, 아니면 회색)
  function drawHover(ctx, S) {
    const m = G.input.mouse; if (m.x < 0) { G.canvas.style.cursor = ''; return; }
    const sh = shopAt(S, m);
    G.canvas.style.cursor = sh ? 'pointer' : '';
    if (!sh) return;
    const b = sh.w.body, ok = !whyNot(S, sh);
    ctx.strokeStyle = ok ? '#ffd84a' : 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6); ctx.setLineDash([]); ctx.lineWidth = 1;
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
      const flash = sh.fx && Math.floor(sh.fx.t * 6) % 2 === 0, tx = sh.w.tagX;
      if (sh.fx) { ctx.fillStyle = flash ? '#ffd84a' : '#fff3b0'; ctx.fillRect(tx - 2, b.y + 23, 96, 38); }
      ctx.fillStyle = '#fffdf6'; ctx.fillRect(tx, b.y + 25, 92, 34);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(tx, b.y + 41, 92, 1);
      itemsOf(sh).forEach((it, i) => {
        const y = b.y + 33 + i * 17;
        G.icons.draw(ctx, it.id, tx + 11, y, 14);
        G.world.text(ctx, price(sh, it.id) + '만', tx + 52, y + 1, 12, '#2a2416');
        if (sh.fx) G.world.text(ctx, sh.fx.dir > 0 ? '▲' : '▼', tx + 83, y + 1, 12, sh.fx.dir > 0 ? '#d9342b' : '#2e9b3a');
      });
      if (sh.openFx != null) shutter(ctx, b, 1 - sh.openFx / 0.8, false);
      if (sh.verified) {                               // 초록 '✔ 검증' 도장 (찍힐 때 커졌다 작아짐)
        sh.stampT = Math.min(1, (sh.stampT || 0) + 1 / 60);
        const k = sh.stampT < 0.15 ? 1.8 - sh.stampT / 0.15 * 0.8 : 1, cx = sh.w.tagX + 46, cy = b.y + 60;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.rotate(-0.12);
        ctx.fillStyle = '#2e9b3a'; ctx.fillRect(-26, -8, 52, 16); ctx.fillStyle = '#fffdf6'; ctx.fillRect(-24, -6, 48, 12);
        ctx.fillStyle = '#2e9b3a'; ctx.fillRect(-23, -5, 46, 10);
        G.world.text(ctx, '✔ 검증', 0, 1, 12, '#fff'); ctx.restore();
      }
    }
  }
  return { init, update, draw, price, isOpen, rollRow, opened, inspected, handleInspectInput, drawHover, shopAt };
})();
