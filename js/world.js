/* 맵 배치 (기획서 3.2, 2026-11-01 가로 배치로 변경). 한 화면 960×540, 스크롤 없음.
   위: 공방 8칸 가로 한 줄 (같은 종류 A·B가 붙어 있고 문은 가운데에서 마주 봄)
   가운데: 길·광장, 조달청 건물
   아래: 마을 4곳 가로 한 줄 (건물 위쪽 앞마당 = 납품칸)
   → 가는 마을에 따라 가까운 공방이 달라져 한쪽으로 쏠리지 않음.
   그림은 임시(3주차에 픽셀아트로 교체). */
'use strict';
G.world = (() => {
  const C = G.C, TOP = C.HUD_H;
  const CATS = [
    { id: 'furn', name: '가구', col: '#b9824f' },
    { id: 'elec', name: '전자', col: '#5b8fb9' },
    { id: 'health', name: '보건', col: '#e0e0e0' },
    { id: 'safety', name: '안전', col: '#d9a441' },
  ];
  const VILLAGES = [
    { id: 'school', name: '학교', col: '#e8d27a', wants: ['desk', 'tablet', 'chair'] },
    { id: 'clinic', name: '보건소', col: '#bfe3d0', wants: ['mask', 'kit'] },
    { id: 'fire', name: '소방서', col: '#d9574a', wants: ['ext', 'helmet', 'kit'] },
    { id: 'library', name: '도서관', col: '#a98bc9', wants: ['chair', 'lamp', 'desk'] },
  ];
  // 공방: 112×100 칸 중 위 64px이 건물(충돌), 아래 36px은 길. 구매칸 40×28 (A는 오른쪽 아래, B는 왼쪽 아래)
  const SW = 112, SY = 72, PAIR_GAP = 4, CAT_GAP = 12;
  const SX0 = Math.round((C.VIEW.w - (SW * 8 + PAIR_GAP * 4 + CAT_GAP * 3)) / 2);
  const shops = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
    const x = SX0 + r * (SW * 2 + PAIR_GAP + CAT_GAP) + c * (SW + PAIR_GAP), y = SY;
    shops.push({
      idx: r * 2 + c, cat: CATS[r], side: c ? 'B' : 'A',
      slot: { x, y, w: SW, h: 100 }, body: { x, y, w: SW, h: 64 },
      door: { x: c ? x : x + SW - 40, y: y + 72, w: 40, h: 28 },
      doorGfx: c ? x + 4 : x + SW - 24,          // 문 그림(20px)
      wndX: c ? x + 28 : x + SW - 46,            // 일꾼 창문(18px)
      tagX: c ? x + 48 : x + 3,                  // 가격표(62px)
    });
  }
  // 마을: 220×110 칸 중 위 40px이 앞마당(납품칸), 아래 70px이 건물(충돌)
  const VW = 220, VGAP = 20, VY = 420, VX0 = Math.round((C.VIEW.w - (VW * 4 + VGAP * 3)) / 2);
  const villages = VILLAGES.map((v, i) => {
    const x = VX0 + i * (VW + VGAP), y = VY;
    return { ...v, idx: i, slot: { x, y, w: VW, h: 110 }, yard: { x, y, w: VW, h: 40 }, body: { x, y: y + 40, w: VW, h: 70 } };
  });
  const office = { body: { x: 410, y: 236, w: 140, h: 96 } };
  const START = { x: 480, y: 372 };
  const PLAY = { x: 0, y: TOP, w: C.VIEW.w, h: C.VIEW.h - TOP };
  const solids = [...shops.map(s => s.body), ...villages.map(v => v.body), office.body];

  function blocked(r) {
    if (r.x < PLAY.x || r.y < PLAY.y || r.x + r.w > PLAY.x + PLAY.w || r.y + r.h > PLAY.y + PLAY.h) return true;
    for (const s of solids) if (G.U.overlap(r, s)) return true;
    return false;
  }

  // ---------- 그리기 (임시) ----------
  function text(ctx, s, x, y, size, col, align) {
    ctx.font = (size || 12) + 'px ' + G.FONT; ctx.fillStyle = col || '#fff';
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
  }
  function house(ctx, b, wall, roof, label) {
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(b.x + 4, b.y + b.h - 2, b.w, 6);
    ctx.fillStyle = wall; ctx.fillRect(b.x, b.y + 18, b.w, b.h - 18);
    ctx.fillStyle = roof; ctx.fillRect(b.x - 3, b.y, b.w + 6, 22);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(b.x - 3, b.y, b.w + 6, 3);
    if (label) text(ctx, label, b.x + b.w / 2, b.y + 11, 12, '#fff');
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  }
  function drawGround(ctx) {
    ctx.fillStyle = '#6fae4a'; ctx.fillRect(0, TOP, C.VIEW.w, C.VIEW.h - TOP);
    ctx.fillStyle = '#65a242';
    for (let y = TOP; y < C.VIEW.h; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < C.VIEW.w; x += 32) ctx.fillRect(x, y, 4, 4);
    ctx.fillStyle = '#d9c38f'; ctx.fillRect(0, SY + 62, C.VIEW.w, VY - SY - 62);       // 공방 앞 길 ~ 마을 앞까지 광장
    ctx.fillStyle = '#c9b07a'; ctx.fillRect(0, SY + 62, C.VIEW.w, 3); ctx.fillRect(0, VY - 3, C.VIEW.w, 3);
  }
  function drawShop(ctx, s) {
    const b = s.body, cat = s.cat;
    house(ctx, b, shade(cat.col, 1), shade(cat.col, 0.6), cat.name + '공방 ' + s.side);
    ctx.fillStyle = '#3b2a1e'; ctx.fillRect(s.doorGfx, b.y + 34, 20, 30);            // 문
    ctx.fillStyle = '#9fd3ff'; ctx.fillRect(s.wndX, b.y + 30, 18, 18);                // 창 (일꾼은 shops.js가 그림)
    ctx.strokeStyle = 'rgba(80,60,30,.5)'; ctx.setLineDash([3, 3]); ctx.strokeRect(s.door.x + .5, s.door.y + .5, s.door.w - 1, s.door.h - 1); ctx.setLineDash([]);
  }
  function drawVillage(ctx, v) {
    ctx.fillStyle = '#8cc56a'; ctx.fillRect(v.yard.x, v.yard.y, v.yard.w, v.yard.h);
    ctx.fillStyle = '#7ab35a'; for (let x = v.yard.x + 6; x < v.yard.x + v.yard.w; x += 12) ctx.fillRect(x, v.yard.y + 2, 2, v.yard.h - 4);
    const b = v.body;
    house(ctx, b, shade(v.col, 1), shade(v.col, 0.55), v.name);
    ctx.fillStyle = '#fff6b0';
    for (let i = 0; i < 4; i++) ctx.fillRect(b.x + 40 + i * 44, b.y + 30, 24, 16);
    ctx.fillStyle = '#3b2a1e'; ctx.fillRect(b.x + 6, b.y + 34, 22, 36);
  }
  function drawOffice(ctx) {
    const b = office.body;
    house(ctx, b, '#eef1f5', '#2f4f8a', '');
    ctx.fillStyle = '#fff'; ctx.fillRect(b.x + 10, b.y + 24, b.w - 20, 30);
    const ci = G.img.ci_h;
    if (ci && ci.naturalWidth) {
      const h = 24, w = Math.min(b.w - 24, ci.naturalWidth * h / ci.naturalHeight);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(ci, b.x + (b.w - w) / 2, b.y + 27, w, w * ci.naturalHeight / ci.naturalWidth);
      ctx.imageSmoothingEnabled = false;
    }
    ctx.fillStyle = '#9fd3ff'; ctx.fillRect(b.x + 14, b.y + 62, 30, 18); ctx.fillRect(b.x + b.w - 44, b.y + 62, 30, 18);
    ctx.fillStyle = '#3b2a1e'; ctx.fillRect(b.x + b.w / 2 - 14, b.y + 64, 28, 36);
  }
  function draw(ctx) {
    drawGround(ctx);
    shops.forEach(s => drawShop(ctx, s));
    villages.forEach(v => drawVillage(ctx, v));
    drawOffice(ctx);
  }
  return { shade, CATS, VILLAGES, shops, villages, office, START, PLAY, blocked, draw, text, roofPerch: { x: 480, y: 242 } };
})();
