/* 맵 배치 (기획서 3.2). 한 화면 960×540, 스크롤 없음.
   공방: 140×100 칸 중 위 64px이 건물(충돌), 아래는 길. 구매칸 = 칸의 오른쪽 아래 40×28.
   마을: 220×100 중 왼쪽 60px이 앞마당(납품칸), 나머지가 건물(충돌).
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
    { id: 'school', name: '학교', col: '#e8d27a' },
    { id: 'clinic', name: '보건소', col: '#bfe3d0' },
    { id: 'fire', name: '소방서', col: '#d9574a' },
    { id: 'library', name: '도서관', col: '#a98bc9' },
  ];
  const shops = [], villages = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
    const x = 16 + c * 150, y = 60 + r * 116;
    shops.push({
      idx: r * 2 + c, cat: CATS[r], side: c ? 'B' : 'A',
      slot: { x, y, w: 140, h: 100 }, body: { x, y, w: 140, h: 64 }, door: { x: x + 100, y: y + 72, w: 40, h: 28 },
    });
  }
  VILLAGES.forEach((v, i) => {
    const x = 704, y = 60 + i * 116;
    villages.push({ ...v, idx: i, slot: { x, y, w: 220, h: 100 }, yard: { x, y, w: 60, h: 100 }, body: { x: x + 60, y, w: 160, h: 100 } });
  });
  const office = { body: { x: 410, y: 180, w: 140, h: 110 } };
  const START = { x: 480, y: 330 };
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
    ctx.fillStyle = roof; ctx.fillRect(b.x - 4, b.y, b.w + 8, 22);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(b.x - 4, b.y, b.w + 8, 3);
    if (label) text(ctx, label, b.x + b.w / 2, b.y + 11, 12, '#fff');
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  }
  function drawGround(ctx) {
    ctx.fillStyle = '#6fae4a'; ctx.fillRect(0, TOP, C.VIEW.w, C.VIEW.h - TOP);
    ctx.fillStyle = '#65a242';                                     // 잔디 점무늬
    for (let y = TOP; y < C.VIEW.h; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < C.VIEW.w; x += 32) ctx.fillRect(x, y, 4, 4);
    ctx.fillStyle = '#d9c38f'; ctx.fillRect(322, TOP, 316, C.VIEW.h - TOP);   // 중앙 광장
    ctx.fillStyle = '#c9b07a'; ctx.fillRect(322, TOP, 4, C.VIEW.h - TOP); ctx.fillRect(634, TOP, 4, C.VIEW.h - TOP);
    for (const s of shops) { ctx.fillStyle = '#d9c38f'; ctx.fillRect(s.slot.x - 6, s.slot.y + 64, s.slot.w + 12, 52); }   // 공방 앞 길
  }
  function drawShop(ctx, s) {
    const b = s.body, cat = s.cat;
    house(ctx, b, shade(cat.col, 1), shade(cat.col, 0.6), cat.name + '공방 ' + s.side);
    ctx.fillStyle = '#3b2a1e'; ctx.fillRect(b.x + 108, b.y + 34, 22, 30);           // 문
    ctx.fillStyle = '#9fd3ff'; ctx.fillRect(b.x + 14, b.y + 30, 26, 18); ctx.fillRect(b.x + 54, b.y + 30, 26, 18);  // 창
    ctx.strokeStyle = 'rgba(80,60,30,.5)'; ctx.setLineDash([3, 3]); ctx.strokeRect(s.door.x + .5, s.door.y + .5, s.door.w - 1, s.door.h - 1); ctx.setLineDash([]);
  }
  function drawVillage(ctx, v) {
    ctx.fillStyle = '#8cc56a'; ctx.fillRect(v.yard.x, v.yard.y, v.yard.w, v.yard.h);
    ctx.fillStyle = '#7ab35a'; for (let y = v.yard.y + 6; y < v.yard.y + v.yard.h; y += 12) ctx.fillRect(v.yard.x + 2, y, v.yard.w - 4, 2);
    house(ctx, v.body, shade(v.col, 1), shade(v.col, 0.55), v.name);
    ctx.fillStyle = '#fff6b0';
    for (let i = 0; i < 4; i++) ctx.fillRect(v.body.x + 16 + i * 36, v.body.y + 40, 22, 18);
    ctx.fillStyle = '#3b2a1e'; ctx.fillRect(v.body.x + 4, v.body.y + 62, 22, 38);
  }
  function drawOffice(ctx) {
    const b = office.body;
    house(ctx, b, '#eef1f5', '#2f4f8a', '');
    ctx.fillStyle = '#fff'; ctx.fillRect(b.x + 10, b.y + 24, b.w - 20, 30);     // CI 간판(흰 판)
    const ci = G.img.ci_h;
    if (ci && ci.naturalWidth) {
      const h = 24, w = Math.min(b.w - 24, ci.naturalWidth * h / ci.naturalHeight);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(ci, b.x + (b.w - w) / 2, b.y + 27, w, w * ci.naturalHeight / ci.naturalWidth);
      ctx.imageSmoothingEnabled = false;
    }
    ctx.fillStyle = '#9fd3ff'; ctx.fillRect(b.x + 14, b.y + 64, 30, 20); ctx.fillRect(b.x + b.w - 44, b.y + 64, 30, 20);
    ctx.fillStyle = '#3b2a1e'; ctx.fillRect(b.x + b.w / 2 - 14, b.y + 70, 28, 40);
  }
  function draw(ctx) {
    drawGround(ctx);
    shops.forEach(s => drawShop(ctx, s));
    villages.forEach(v => drawVillage(ctx, v));
    drawOffice(ctx);
  }
  return { CATS, VILLAGES, shops, villages, office, START, PLAY, blocked, draw, text, roofPerch: { x: 480, y: 186 } };
})();
