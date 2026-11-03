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
  // ---------- 2026-11-03 그래픽 상향: 바닥·공방·마을 바탕을 픽셀아트로. 움직이지 않으므로 한 번 그려 캐시 ----------
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // 늘 같은 무늬
  const px = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  function grass(ctx, x0, y0, w, h) {
    px(ctx, '#6fae4a', x0, y0, w, h);
    for (let k = 0; k < w * h / 60; k++) { const x = x0 + rnd() * w, y = y0 + rnd() * h; px(ctx, rnd() < 0.5 ? '#65a242' : '#7bba54', x, y, 2, 2); }
    for (let k = 0; k < w * h / 900; k++) {                           // 풀 포기
      const x = x0 + rnd() * (w - 6), y = y0 + 4 + rnd() * (h - 8);
      px(ctx, '#4f8a34', x, y, 1, 3); px(ctx, '#4f8a34', x + 2, y - 1, 1, 4); px(ctx, '#4f8a34', x + 4, y, 1, 3);
    }
    for (let k = 0; k < w * h / 1400; k++) {                          // 작은 꽃
      const x = x0 + rnd() * (w - 4), y = y0 + rnd() * (h - 4), c = ['#fff6b0', '#ffd6e8', '#ffffff', '#ffd84a'][Math.floor(rnd() * 4)];
      px(ctx, c, x, y + 1, 3, 1); px(ctx, c, x + 1, y, 1, 3); px(ctx, '#e0a800', x + 1, y + 1, 1, 1);
    }
  }
  function cobble(ctx, x0, y0, w, h) {                                 // 광장 돌길 (차분하게: 큰 돌, 낮은 대비)
    px(ctx, '#d8c290', x0, y0, w, h);
    for (let row = 0, y = y0 + 3; y < y0 + h - 3; row++, y += 14) {
      for (let x = x0 - (row % 2) * 12; x < x0 + w; x += 24) {
        const sw = 21 + Math.floor(rnd() * 3), c = rnd() < 0.2 ? '#d3bc88' : rnd() < 0.35 ? '#ddc898' : '#d8c290';
        px(ctx, '#cdb683', x, y + 11, sw, 1); px(ctx, '#cdb683', x + sw, y, 1, 12); px(ctx, c, x + 1, y + 1, sw - 2, 9);
        px(ctx, 'rgba(255,255,255,.12)', x + 1, y + 1, sw - 2, 1);
      }
    }
    // 조달청 둘레 둥근 광장 (밝은 돌 고리)
    const cx = office.body.x + office.body.w / 2, cy = office.body.y + office.body.h / 2 + 6;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    ctx.strokeStyle = 'rgba(255,248,225,.35)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(cx, cy, 150, 92, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,130,80,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, 156, 98, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx, cy, 144, 86, 0, 0, 7); ctx.stroke();
    ctx.restore(); ctx.lineWidth = 1;
  }
  function tree(ctx, x, y) {                                           // (x, y) = 밑동
    px(ctx, 'rgba(0,0,0,.2)', x - 12, y - 2, 24, 5);
    px(ctx, '#6b4423', x - 2, y - 14, 5, 14);
    const blob = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); };
    blob(x, y - 24, 13, '#3f7f35'); blob(x - 7, y - 19, 9, '#3f7f35'); blob(x + 7, y - 19, 9, '#3f7f35');
    blob(x - 3, y - 27, 8, '#58a04a'); blob(x + 4, y - 22, 6, '#58a04a'); px(ctx, '#8fd16a', x - 5, y - 31, 3, 2);
  }
  function lamp(ctx, x, y) {                                           // (x, y) = 바닥
    px(ctx, 'rgba(0,0,0,.18)', x - 4, y - 1, 9, 3);
    px(ctx, '#3a3f48', x - 3, y - 3, 7, 3); px(ctx, '#4a4f57', x - 1, y - 30, 3, 28);
    px(ctx, '#3a3f48', x - 4, y - 36, 9, 6); px(ctx, '#fff3a0', x - 3, y - 35, 7, 4); px(ctx, '#3a3f48', x - 2, y - 38, 5, 2);
  }
  function outline(ctx, x, y, w, h) { ctx.strokeStyle = 'rgba(40,30,20,.55)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); }
  function roofTiles(ctx, x, y, w, h, base) {                          // 기와 지붕 + 처마 그림자
    px(ctx, base, x, y, w, h);
    for (let ry = y + 4; ry < y + h - 1; ry += 5) { px(ctx, 'rgba(0,0,0,.18)', x, ry, w, 1); for (let rx = x + ((ry - y) % 10 ? 4 : 0); rx < x + w; rx += 8) px(ctx, 'rgba(0,0,0,.12)', rx, ry - 4, 1, 4); }
    px(ctx, 'rgba(255,255,255,.22)', x, y, w, 2); px(ctx, 'rgba(0,0,0,.28)', x, y + h, w, 3);
  }
  function label(ctx, s, cx, cy) {                                     // 지붕 이름판
    ctx.font = '12px ' + G.FONT; const w = ctx.measureText(s).width + 10;
    px(ctx, 'rgba(20,16,10,.45)', cx - w / 2, cy - 7, w, 14); text(ctx, s, cx, cy, 12, '#fff');
  }
  function drawGround(ctx) {
    grass(ctx, 0, TOP, C.VIEW.w, SY - TOP + 66);                       // 공방 줄 뒤
    grass(ctx, 0, VY - 4, C.VIEW.w, C.VIEW.h - VY + 4);                 // 마을 줄
    cobble(ctx, 0, SY + 62, C.VIEW.w, VY - SY - 62);                   // 광장
    px(ctx, '#b89d66', 0, SY + 62, C.VIEW.w, 3); px(ctx, '#b89d66', 0, VY - 4, C.VIEW.w, 3);   // 연석
    for (const x of [240, 480, 720]) lamp(ctx, x, SY + 98);           // 공방 종류 사이 가로등
    for (const x of [8, 952]) lamp(ctx, x, SY + 98);
    for (const x of [240, 480, 720]) tree(ctx, x, VY + 104);           // 마을 사이 나무
  }
  function drawShop(ctx, s) {
    const b = s.body, cat = s.cat, wall = shade(cat.col, 1), dark = shade(cat.col, 0.72);
    px(ctx, 'rgba(0,0,0,.2)', b.x + 4, b.y + b.h - 2, b.w, 6);
    px(ctx, wall, b.x, b.y + 18, b.w, b.h - 18);                       // 벽 + 판자 무늬
    for (let y = b.y + 24; y < b.y + b.h; y += 6) { px(ctx, dark, b.x, y, b.w, 1); for (let x = b.x + ((y - b.y) % 12 ? 10 : 2); x < b.x + b.w; x += 18) px(ctx, dark, x, y - 5, 1, 5); }
    px(ctx, 'rgba(255,255,255,.15)', b.x, b.y + 18, 3, b.h - 18); px(ctx, 'rgba(0,0,0,.15)', b.x + b.w - 3, b.y + 18, 3, b.h - 18);
    roofTiles(ctx, b.x - 3, b.y, b.w + 6, 20, shade(cat.col, 0.55));
    outline(ctx, b.x, b.y + 18, b.w, b.h - 18);
    label(ctx, cat.name + '공방 ' + s.side, b.x + b.w / 2, b.y + 10);
    px(ctx, '#2a1d14', s.doorGfx - 2, b.y + 32, 24, 32); px(ctx, '#4a3022', s.doorGfx, b.y + 34, 20, 30);   // 문틀 + 문
    px(ctx, '#5c3c2a', s.doorGfx + 2, b.y + 36, 7, 12); px(ctx, '#5c3c2a', s.doorGfx + 11, b.y + 36, 7, 12); px(ctx, '#ffd84a', s.doorGfx + 15, b.y + 50, 2, 2);
    px(ctx, '#3b2a1e', s.wndX - 2, b.y + 28, 22, 22); px(ctx, '#9fd3ff', s.wndX, b.y + 30, 18, 18); px(ctx, '#6b4423', s.wndX - 3, b.y + 49, 24, 3);   // 창틀·창턱
    px(ctx, '#c4aa72', s.door.x + 6, s.door.y + 2, s.door.w - 12, 3);   // 문 앞 디딤돌
    ctx.strokeStyle = 'rgba(80,60,30,.35)'; ctx.setLineDash([3, 3]); ctx.strokeRect(s.door.x + .5, s.door.y + .5, s.door.w - 1, s.door.h - 1); ctx.setLineDash([]);
  }
  // 마을: 위치(창 4개 x=40+i*44, 문 x=6)는 피해·단장 연출과 맞추고, 모양은 마을마다 다르게
  function drawVillage(ctx, v) {
    const y = v.yard, b = v.body, wall = shade(v.col, 1), dark = shade(v.col, 0.78), roof = shade(v.col, 0.5);
    px(ctx, '#8cc56a', y.x, y.y, y.w, y.h); px(ctx, '#9bd277', y.x, y.y, y.w, 2);   // 앞마당 잔디
    for (let x = y.x + 6; x < y.x + y.w; x += 12) px(ctx, '#7ab35a', x, y.y + 4, 2, y.h - 8);
    px(ctx, 'rgba(0,0,0,.2)', b.x + 4, b.y + b.h - 2, b.w, 6);
    px(ctx, wall, b.x, b.y + 18, b.w, b.h - 18);
    if (v.id === 'fire') for (let yy = b.y + 22; yy < b.y + b.h; yy += 5) for (let xx = b.x + ((yy - b.y) % 10 ? 0 : 6); xx < b.x + b.w; xx += 12) px(ctx, dark, xx, yy, 1, 5), px(ctx, dark, xx, yy + 4, 12, 1);   // 벽돌
    else if (v.id === 'library') { for (let xx = b.x + 34; xx < b.x + b.w - 10; xx += 44) px(ctx, '#d8cce8', xx, b.y + 22, 4, b.h - 22); }   // 돌기둥
    else for (let yy = b.y + 26; yy < b.y + b.h; yy += 8) px(ctx, dark, b.x, yy, b.w, 1);      // 가로 줄눈
    px(ctx, 'rgba(255,255,255,.15)', b.x, b.y + 18, 3, b.h - 18);
    roofTiles(ctx, b.x - 3, b.y, b.w + 6, 20, roof);
    if (v.id === 'school' || v.id === 'library') {                      // 가운데 박공
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(b.x + b.w / 2 - 34, b.y + 2); ctx.lineTo(b.x + b.w / 2, b.y - 12); ctx.lineTo(b.x + b.w / 2 + 34, b.y + 2); ctx.fill();
    }
    outline(ctx, b.x, b.y + 18, b.w, b.h - 18);
    label(ctx, v.name, b.x + b.w / 2, b.y + 10);
    for (let i = 0; i < 4; i++) {                                      // 창 (불 켜짐) + 창틀
      const wx = b.x + 40 + i * 44, wy = b.y + 30;
      px(ctx, '#3b2a1e', wx - 2, wy - 2, 28, 20); px(ctx, '#fff6b0', wx, wy, 24, 16); px(ctx, '#e8d880', wx + 11, wy, 2, 16); px(ctx, '#e8d880', wx, wy + 7, 24, 2);
      if (v.id === 'library') { ctx.fillStyle = '#3b2a1e'; ctx.beginPath(); ctx.arc(wx + 12, wy, 13, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(wx + 12, wy, 11, Math.PI, 0); ctx.fill(); }
    }
    if (v.id === 'fire') { px(ctx, '#3a3f48', b.x + 2, b.y + 26, 30, 44); for (let k = 0; k < 6; k++) px(ctx, '#6a7179', b.x + 4, b.y + 30 + k * 7, 26, 3); }   // 차고 문
    else { px(ctx, '#2a1d14', b.x + 4, b.y + 32, 26, 38); px(ctx, '#4a3022', b.x + 6, b.y + 34, 22, 36); px(ctx, '#ffd84a', b.x + 23, b.y + 52, 2, 2); }
    if (v.id === 'clinic') { px(ctx, '#fff', b.x + 6, b.y + 22, 20, 8); px(ctx, '#e5533d', b.x + 14, b.y + 22, 4, 8); px(ctx, '#e5533d', b.x + 12, b.y + 24, 8, 4); }   // 보건 표시
    if (v.id === 'school') px(ctx, '#fff', b.x + b.w / 2 - 6, b.y - 6, 12, 6);   // 박공 창
  }
  // 캐시: 바닥 + 공방·마을 바탕 (글꼴이 준비된 뒤 한 번)
  let cache = null;
  function staticLayer() {
    if (cache) return cache;
    cache = document.createElement('canvas'); cache.width = C.VIEW.w; cache.height = C.VIEW.h;
    const g = cache.getContext('2d'); seed = 7;
    drawGround(g); shops.forEach(s => drawShop(g, s)); villages.forEach(v => drawVillage(g, v));
    return cache;
  }
  // 조달청 (2026-11-03 다시 그림): 박공지붕 · 큰 CI 간판 · 업적 메달 자리 · 기둥 · 유리문 · 계단 · 깃대. 충돌 영역(office.body)은 그대로
  function drawOffice(ctx, t) {
    const b = office.body, x = b.x, y = b.y, w = b.w, px = (c, X, Y, W, H) => { ctx.fillStyle = c; ctx.fillRect(Math.round(X), Math.round(Y), W, H); };
    px('rgba(0,0,0,.18)', x + 4, y + b.h - 2, w, 6);                                   // 그림자
    px('#e9edf3', x, y + 10, w, b.h - 10);                                            // 돌벽
    px('#d5dce6', x, y + 10, w, 3);
    for (let i = 0; i < 9; i++) px('#2f4f8a', x - 6 + i * 2, y + 10 - i * 2, w + 12 - i * 4, 2);   // 계단식 박공지붕
    px('#3f64a8', x + 10, y - 6, w - 20, 2); px('#ffd84a', x - 6, y + 10, w + 12, 2);
    px('#fff', x + 12, y + 16, w - 24, 28); px('#c9d2de', x + 12, y + 43, w - 24, 1);   // 큰 간판
    const ci = G.img.ci_h;
    if (ci && ci.naturalWidth) {
      const h = 22, cw = Math.min(w - 32, ci.naturalWidth * h / ci.naturalHeight);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(ci, x + (w - cw) / 2, y + 19, cw, cw * ci.naturalHeight / ci.naturalWidth); ctx.imageSmoothingEnabled = false;
    }
    px('#cfd6e0', x + 10, y + 46, w - 20, 16);                                         // 업적 메달 게시판 (메달은 missions.js)
    px('#b9c2cf', x + 10, y + 61, w - 20, 1);
    [x + 8, x + 30, x + w - 38, x + w - 16].forEach(cx => { px('#ffffff', cx, y + 64, 8, 24); px('#c9d2de', cx + 6, y + 64, 2, 24); px('#dfe5ee', cx - 1, y + 63, 10, 2); });   // 기둥
    px('#7fb6e0', x + 42, y + 66, 18, 18); px('#7fb6e0', x + w - 60, y + 66, 18, 18);   // 창
    px('#3a5f8f', x + w / 2 - 15, y + 64, 30, 26); px('#9fd3ff', x + w / 2 - 13, y + 66, 12, 24); px('#9fd3ff', x + w / 2 + 1, y + 66, 12, 24);   // 유리문
    px('#c7ced8', x - 2, y + 88, w + 4, 4); px('#b4bcc8', x - 6, y + 92, w + 12, 4);    // 계단
    const wave = Math.sin((t || 0) * 4) * 1.5;                                         // 깃대 (조달청 파랑 깃발)
    [[x - 12, 1], [x + w + 10, -1]].forEach(([fx, d]) => {
      px('#8a8f99', fx, y - 26, 2, 56); px('#ffd84a', fx - 1, y - 28, 4, 3);
      ctx.fillStyle = '#2f6fb5'; ctx.beginPath(); ctx.moveTo(fx + (d > 0 ? 2 : 0), y - 24); ctx.lineTo(fx + d * 18, y - 22 + wave); ctx.lineTo(fx + d * 18, y - 12 + wave); ctx.lineTo(fx + (d > 0 ? 2 : 0), y - 12); ctx.fill();
      px('#fff', fx + (d > 0 ? 4 : -14), y - 18 + wave * 0.6, 10, 2);
    });
  }

  function draw(ctx) {
    if (G.screen === 'boot') return;
    ctx.drawImage(staticLayer(), 0, 0);
    drawOffice(ctx, performance.now() / 1000);
  }
  return { shade, CATS, VILLAGES, shops, villages, office, START, PLAY, blocked, draw, text, roofPerch: { x: 480, y: 242 } };
})();
