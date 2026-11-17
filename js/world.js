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
  // 지붕 이름판 (8.15단계 미래형 간판): 둥근 남색 판 + 색 테두리 + 위쪽 빛 + 왼쪽 아이콘(또는 색 점) + 굵은 흰 글자
  function label(ctx, s, cx, cy, col, icon) {
    if (!C.FUTURE || !G.soft) { ctx.font = '12px ' + G.FONT; const w = ctx.measureText(s).width + 10; px(ctx, 'rgba(20,16,10,.45)', cx - w / 2, cy - 7, w, 14); text(ctx, s, cx, cy, 12, '#fff'); return; }
    const K = G.soft, F = '12px "Galmuri11 Bold", ' + G.FONT; ctx.font = F;
    const tw = ctx.measureText(s).width, lead = icon ? 16 : col ? 9 : 0, w = Math.round(tw + 12 + lead), h = 16, x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
    ctx.fillStyle = 'rgba(10,20,35,.28)'; K.rr(ctx, x + 1, y + 2, w, h, 8); ctx.fill();                       // 그림자
    ctx.fillStyle = 'rgba(24,38,60,.92)'; K.rr(ctx, x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = col || '#5ec8f2'; ctx.lineWidth = 1; K.rr(ctx, x + .5, y + .5, w - 1, h - 1, 7.5); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x + 6, y + 2, w - 12, 1);                         // 위쪽 빛
    if (icon && G.icons) G.icons.draw(ctx, icon, x + 10, y + h / 2, 12);
    else if (col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 7.5, y + h / 2, 2.5, 0, 7); ctx.fill(); }
    ctx.font = F; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x + 6 + lead, y + h / 2 + .5);
  }
  const VICON = { school: 'desk', clinic: 'kit', fire: 'ext', library: 'lamp' };   // 마을 간판 아이콘
  const VLABEL_DX = { clinic: -62 };                                   // 건물 그림의 가운데 장식(보건소 초록 십자)을 가리지 않게 이름표를 옮김
  // ---------- 11-16 8.13단계 미래형 바닥: 밝은 보도 데크 + 네모 화단 + LED 가로등 + 화분 나무 (C.FUTURE) ----------
  function deck(ctx, x0, y0, w, h) {
    px(ctx, '#d9e3ea', x0, y0, w, h);                                   // 흰 건물이 묻히지 않게 살짝 어둡게
    for (let y = y0 + 12; y < y0 + h; y += 12) px(ctx, '#c7d3dc', x0, y, w, 1);
    for (let row = 0, y = y0; y < y0 + h; row++, y += 12) for (let x = x0 + (row % 2) * 12; x < x0 + w; x += 24) px(ctx, '#c7d3dc', x, y, 1, 12);
    for (let k = 0; k < w * h / 2600; k++) { const x = x0 + Math.floor(rnd() * w / 24) * 24, y = y0 + Math.floor(rnd() * h / 12) * 12; px(ctx, 'rgba(94,200,242,.35)', x + 2, y + 5, 20, 2); }   // 바닥에 박힌 하늘색 빛 줄
  }
  function planter(ctx, x, y, w, h) {                                  // 네모 화단: 흰 테두리 + 다듬은 잔디 + 작은 꽃
    px(ctx, 'rgba(0,0,0,.12)', x + 1, y + h, w, 2);
    px(ctx, '#ffffff', x, y, w, h); px(ctx, '#cfdbe2', x, y + h - 2, w, 2);
    px(ctx, '#8fd19e', x + 2, y + 2, w - 4, h - 5); px(ctx, '#a7e0b2', x + 2, y + 2, w - 4, 2);
    for (let k = 0; k < w / 10; k++) { const fx = x + 4 + rnd() * (w - 8), fy = y + 4 + rnd() * Math.max(1, h - 10); px(ctx, ['#ffffff', '#ffd6e8', '#fff6b0'][Math.floor(rnd() * 3)], fx, fy, 2, 2); }
  }
  function futureGround(ctx, x0, y0, w, h) {
    deck(ctx, x0, y0, w, h);
    for (let x = x0 + 6; x < x0 + w - 40; x += 64 + Math.floor(rnd() * 24)) planter(ctx, x, y0 + 4 + Math.floor(rnd() * Math.max(1, h - 30)), 34 + Math.floor(rnd() * 18), 14);
  }
  function futureLamp(ctx, x, y) {                                     // 얇은 흰 기둥 + 하늘색 LED 막대
    px(ctx, 'rgba(0,0,0,.15)', x - 4, y - 1, 9, 3);
    px(ctx, '#cfd8e0', x - 3, y - 3, 7, 3); px(ctx, '#ffffff', x - 1, y - 32, 3, 30); px(ctx, '#cfd8e0', x + 1, y - 32, 1, 30);
    px(ctx, 'rgba(94,200,242,.25)', x - 6, y - 40, 13, 12); px(ctx, '#5ec8f2', x - 2, y - 38, 5, 8); px(ctx, '#e6f8ff', x - 1, y - 37, 2, 6);
  }
  function futureTree(ctx, x, y) {                                     // 둥근 흰 화분에 다듬은 둥근 나무
    px(ctx, 'rgba(0,0,0,.15)', x - 11, y - 1, 22, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 9, y - 10, 18, 9); ctx.fillStyle = '#cfdbe2'; ctx.fillRect(x - 9, y - 3, 18, 2); ctx.fillStyle = '#5ec8f2'; ctx.fillRect(x - 9, y - 10, 18, 2);
    px(ctx, '#8a6a4a', x - 1, y - 16, 3, 6);
    const blob = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); };
    blob(x, y - 26, 12, '#5fb878'); blob(x - 3, y - 29, 7, '#7fcf92'); px(ctx, '#c8f0d0', x - 5, y - 33, 3, 2);
  }
  function drawGround(ctx) {
    if (C.FUTURE) {
      futureGround(ctx, 0, TOP, C.VIEW.w, SY - TOP + 66);              // 공방 줄 뒤
      futureGround(ctx, 0, VY - 4, C.VIEW.w, C.VIEW.h - VY + 4);        // 마을 줄
    } else {
    grass(ctx, 0, TOP, C.VIEW.w, SY - TOP + 66);                       // 공방 줄 뒤
    grass(ctx, 0, VY - 4, C.VIEW.w, C.VIEW.h - VY + 4);                 // 마을 줄
    }
    const pz = G.img && G.img.plaza;                                   // 11-16 광장 바닥 그림(Leonardo.ai, tools/crop_image.cjs). 없으면 코드 돌길
    if (pz && pz.naturalWidth) {
      ctx.drawImage(pz, 0, SY + 62, C.VIEW.w, VY - SY - 62);
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(0, SY + 62, C.VIEW.w, VY - SY - 62);   // 카드·수레·글자가 잘 보이게 바닥을 연하게
      // 11-16 미래형 바닥: 조달청 둘레 빛나는 원형 광장 (그림에는 원이 없어 코드로)
      const cx = office.body.x + office.body.w / 2, cy = office.body.y + office.body.h / 2 + 6;
      ctx.save(); ctx.beginPath(); ctx.rect(0, SY + 62, C.VIEW.w, VY - SY - 62); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(cx, cy, 150, 92, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(94,200,242,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, 157, 99, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx, cy, 143, 85, 0, 0, 7); ctx.stroke();
      ctx.restore(); ctx.lineWidth = 1;
    } else cobble(ctx, 0, SY + 62, C.VIEW.w, VY - SY - 62);              // 광장
    const curb = C.FUTURE ? '#a9c4d3' : '#b89d66', L = C.FUTURE ? futureLamp : lamp, Tr = C.FUTURE ? futureTree : tree;
    px(ctx, curb, 0, SY + 62, C.VIEW.w, 3); px(ctx, curb, 0, VY - 4, C.VIEW.w, 3);   // 연석
    for (const x of [240, 480, 720]) L(ctx, x, SY + 98);              // 공방 종류 사이 가로등
    for (const x of [8, 952]) L(ctx, x, SY + 98);
    for (const x of [240, 480, 720]) Tr(ctx, x, VY + 104);            // 마을 사이 나무
  }
  // ---------- 2026-11-03 그래픽 상향 3: 건물에 깊이감 (경사 지붕·처마·주춧돌·꽃 화분·창 불빛·부드러운 그림자) ----------
  // 업종별 모양: 가구 = 나무 판자 + 붉은 기와 / 전자 = 파란 사이딩 + 남색 금속 지붕 / 보건 = 흰 타일 + 초록 지붕 / 안전 = 노란 벽돌 + 주황 지붕
  const LOOK = {
    furn:   { wall: '#c08a55', roof: '#a8432f', kind: 'plank' },
    elec:   { wall: '#6f9fcb', roof: '#2f4f8a', kind: 'siding' },
    health: { wall: '#eef1ee', roof: '#3f9a6a', kind: 'tile' },
    safety: { wall: '#e2b34e', roof: '#d8632a', kind: 'brick' },
  };
  function softShade(ctx, x, y, w) {                                    // 건물 밑 부드러운 그림자
    const g = ctx.createLinearGradient(0, y, 0, y + 9); g.addColorStop(0, 'rgba(40,30,15,.32)'); g.addColorStop(1, 'rgba(40,30,15,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 2, y, w + 6, 9);
  }
  // 경사 지붕: 아래가 넓은 사다리꼴 + 기와 줄 + 용마루 빛 + 처마 그림자
  function slopeRoof(ctx, x, y, w, h, base, over, inset) {
    const x0 = x - over, x1 = x + w + over;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x0, y + h); ctx.lineTo(x1, y + h); ctx.lineTo(x1 - inset, y); ctx.lineTo(x0 + inset, y); ctx.closePath();
    ctx.fillStyle = base; ctx.fill(); ctx.clip();
    for (let ry = y + 4, r = 0; ry < y + h; ry += 5, r++) {
      px(ctx, 'rgba(0,0,0,.2)', x0, ry, x1 - x0, 1);
      for (let rx = x0 + (r % 2 ? 5 : 0); rx < x1; rx += 10) px(ctx, 'rgba(0,0,0,.13)', rx, ry - 4, 1, 4);
      px(ctx, 'rgba(255,255,255,.07)', x0, ry + 1, x1 - x0, 1);
    }
    const sh = ctx.createLinearGradient(x0, 0, x1, 0); sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.14)');
    ctx.fillStyle = sh; ctx.fillRect(x0, y, x1 - x0, h);
    ctx.restore();
    px(ctx, shade(base, 1.35), x0 + inset, y, x1 - x0 - inset * 2, 2);            // 용마루
    px(ctx, shade(base, 0.6), x0, y + h - 2, x1 - x0, 2);                          // 처마 끝
    px(ctx, 'rgba(0,0,0,.3)', x, y + h, w, 3); px(ctx, 'rgba(0,0,0,.12)', x, y + h + 3, w, 2);   // 처마 그림자
  }
  function wallPattern(ctx, kind, x, y, w, h, wall) {
    const d = shade(wall, 0.8), l = shade(wall, 1.12);
    px(ctx, wall, x, y, w, h);
    if (kind === 'plank') for (let yy = y + 5; yy < y + h; yy += 6) { px(ctx, d, x, yy, w, 1); px(ctx, l, x, yy + 1, w, 1); for (let xx = x + ((yy - y) % 12 ? 12 : 3); xx < x + w; xx += 20) px(ctx, d, xx, yy - 5, 1, 5); }
    else if (kind === 'siding') for (let yy = y + 4; yy < y + h; yy += 5) { px(ctx, d, x, yy, w, 1); px(ctx, l, x, yy - 3, w, 1); }
    else if (kind === 'tile') { for (let yy = y + 6; yy < y + h; yy += 7) px(ctx, '#d5dbd6', x, yy, w, 1); for (let xx = x + 7; xx < x + w; xx += 7) px(ctx, '#dfe4df', xx, y, 1, h); px(ctx, '#3f9a6a', x, y + 2, w, 2); }
    else if (kind === 'brick') for (let yy = y + 1, r = 0; yy < y + h; yy += 5, r++) { px(ctx, d, x, yy + 4, w, 1); for (let xx = x + (r % 2 ? 6 : 0); xx < x + w; xx += 12) px(ctx, d, xx, yy, 1, 4); }
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.16)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  function flowerBox(ctx, x, y, w) {                                    // 창 밑 꽃 화분
    px(ctx, '#7a4a2a', x, y, w, 4); px(ctx, '#9a6236', x, y, w, 1);
    const cols = ['#ff7a9a', '#ffd84a', '#ffffff', '#ff9a4a'];
    for (let i = 0; i < w - 2; i += 4) { px(ctx, '#3f8a35', x + 1 + i, y - 2, 3, 2); px(ctx, cols[(i / 4 + x) % 4 | 0], x + 2 + i, y - 4, 2, 2); }
  }
  function glassWindow(ctx, x, y, w, h, frame) {                        // 창: 틀 + 하늘빛 유리 + 반사 + 창턱
    px(ctx, frame, x - 2, y - 2, w + 4, h + 4);
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#cdeaff'); g.addColorStop(1, '#8cc4ec');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    px(ctx, 'rgba(255,255,255,.55)', x + 2, y + 2, 3, h - 6); px(ctx, 'rgba(255,255,255,.35)', x + 6, y + 2, 2, h / 2);
  }
  // 공방 그림(tools/split_shops.cjs, 2배 크기): 폭 124(양옆 6px 처마), 세로 1.2배로 늘려 지붕 꼭대기가 공방 지붕 자리(y-2)에, 바닥은 공방 바닥에
  function shopArt(s) {
    const im = G.img && G.img['shop_' + s.cat.id]; if (!im || !im.naturalWidth) return null;
    const b = s.body, w = 124, h = im.naturalHeight / 2 * 1.2;
    return { im, w, h, x: b.x - 6, y: b.y + b.h - h };
  }
  function drawShop(ctx, s) {
    const b = s.body, L = LOOK[s.cat.id] || { wall: s.cat.col, roof: shade(s.cat.col, 0.55), kind: 'plank' };
    softShade(ctx, b.x, b.y + b.h - 1, b.w);
    const art = shopArt(s);                                             // 8.21단계 미래형 공방 그림: 벽·지붕·문·창 대신 (간판만 위에). B 공방은 좌우로 뒤집음
    if (art) {
      ctx.save(); if (s.side === 'B') { ctx.translate(b.x * 2 + b.w, 0); ctx.scale(-1, 1); }
      ctx.imageSmoothingEnabled = true; ctx.drawImage(art.im, art.x, art.y, art.w, art.h); ctx.imageSmoothingEnabled = false; ctx.restore();
      label(ctx, s.cat.name + '공방 ' + s.side, b.x + b.w / 2 + 4, b.y + 10, s.cat.col);
      return;
    }
    wallPattern(ctx, L.kind, b.x, b.y + 18, b.w, b.h - 22, L.wall);
    px(ctx, '#9a9184', b.x - 1, b.y + b.h - 5, b.w + 2, 5); px(ctx, '#b5ad9f', b.x - 1, b.y + b.h - 5, b.w + 2, 1);   // 주춧돌
    for (let xx = b.x + 8; xx < b.x + b.w; xx += 14) px(ctx, '#857c70', xx, b.y + b.h - 4, 1, 4);
    outline(ctx, b.x, b.y + 18, b.w, b.h - 18);
    slopeRoof(ctx, b.x, b.y - 2, b.w, 22, L.roof, 4, 7);
    label(ctx, s.cat.name + '공방 ' + s.side, b.x + b.w / 2 + 4, b.y + 10, s.cat.col);   // 왼쪽 ✔ 표시와 안 겹치게 살짝 오른쪽
    // 문: 틀 + 판자 문 + 위 채광창 + 손잡이 + 계단
    px(ctx, '#2a1d14', s.doorGfx - 2, b.y + 30, 24, 31); px(ctx, '#5a3826', s.doorGfx, b.y + 32, 20, 29);
    px(ctx, '#ffe9a8', s.doorGfx + 2, b.y + 33, 16, 4); px(ctx, '#2a1d14', s.doorGfx + 9, b.y + 33, 2, 4);
    px(ctx, '#6e4630', s.doorGfx + 2, b.y + 39, 7, 9); px(ctx, '#6e4630', s.doorGfx + 11, b.y + 39, 7, 9); px(ctx, '#6e4630', s.doorGfx + 2, b.y + 50, 16, 8);
    px(ctx, '#ffd84a', s.doorGfx + 15, b.y + 48, 2, 2);
    px(ctx, '#bdb3a3', s.doorGfx - 4, b.y + b.h - 2, 28, 3);
    // 일꾼 창 (일꾼 그림은 shops.js가 위에 그림) + 꽃 화분
    glassWindow(ctx, s.wndX, b.y + 30, 18, 18, '#3b2a1e');
    flowerBox(ctx, s.wndX - 3, b.y + 50, 24);
    px(ctx, '#c4aa72', s.door.x + 6, s.door.y + 2, s.door.w - 12, 3);   // 문 앞 디딤돌
  }
  // 마을: 위치(창 4개 x=40+i*44, 문 x=6)는 피해·단장 연출과 맞추고, 모양은 마을마다 다르게
  const VLOOK = {
    school:  { roof: '#b8452f', kind: 'plank' },
    clinic:  { roof: '#3f9a6a', kind: 'tile' },
    fire:    { roof: '#5a2a24', kind: 'brick' },
    library: { roof: '#4a3a78', kind: 'stone' },
  };
  // 마을 건물 그림(tools/make_sprite.cjs로 만든 PNG): 칸 아래쪽에 붙이고 가운데 맞춤. dark = 유리창이 꺼진 그림(피해 연출)
  const ART = 2;                                                       // 건물 그림 PNG 배율 (tools/make_sprite.cjs 기본 2배)
  function villageArt(v, dark) {
    const im = G.img && G.img['village_' + v.id + (dark ? '_dark' : '')]; if (!im || !im.naturalWidth) return null;
    const b = v.body, w = im.naturalWidth / ART, h = im.naturalHeight / ART;   // 그림은 2배 크기로 만들어 둠(선명하게)
    return { im, w, h, x: b.x + Math.round((b.w - w) / 2), y: b.y + b.h - h };
  }
  function drawVillage(ctx, v) {
    const y = v.yard, b = v.body, wall = shade(v.col, 1), VL = VLOOK[v.id] || { roof: shade(v.col, 0.5), kind: 'plank' };
    if (C.FUTURE) {                                                    // 미래형 앞마당: 데크 + 양옆 네모 화단 + 하늘색 빛 길
      deck(ctx, y.x, y.y, y.w, y.h); px(ctx, '#cfdbe2', y.x, y.y, y.w, 1);
      planter(ctx, y.x + 4, y.y + 6, 40, 28); planter(ctx, y.x + y.w - 44, y.y + 6, 40, 28);
      px(ctx, 'rgba(94,200,242,.45)', b.x + b.w / 2 - 14, y.y + 4, 28, 2); px(ctx, 'rgba(94,200,242,.3)', b.x + b.w / 2 - 14, y.y + y.h - 6, 28, 2);
    } else {
    // 앞마당: 잔디 + 가장자리 꽃밭 + 디딤돌 길
    px(ctx, '#8cc56a', y.x, y.y, y.w, y.h); px(ctx, '#9bd277', y.x, y.y, y.w, 2);
    for (let x = y.x + 6; x < y.x + y.w; x += 12) px(ctx, '#7ab35a', x, y.y + 4, 2, y.h - 8);
    for (let k = 0; k < 7; k++) { px(ctx, '#d8c9a0', b.x + 8 + (k % 2) * 3, y.y + 3 + k * 5, 14, 3); }
    for (const fx of [y.x + 3, y.x + y.w - 9]) for (let k = 0; k < 4; k++) { px(ctx, '#3f8a35', fx, y.y + 6 + k * 8, 6, 3); px(ctx, ['#ff7a9a', '#ffd84a', '#fff', '#ff9a4a'][(k + fx) % 4 | 0], fx + 1, y.y + 4 + k * 8, 3, 3); }
    }
    softShade(ctx, b.x, b.y + b.h - 1, b.w);
    const art = villageArt(v);                                         // 11-16 이미지 AI 건물 그림이 있으면 벽·지붕·문·창 대신 (이름표만 위에)
    if (art) {
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(art.im, art.x, art.y, art.w, art.h); ctx.restore();
      label(ctx, v.name, b.x + b.w / 2 + (VLABEL_DX[v.id] || 0), art.y + 13, v.col, VICON[v.id]);
      return;
    }
    if (VL.kind === 'stone') { px(ctx, wall, b.x, b.y + 18, b.w, b.h - 18); for (let yy = b.y + 22, r = 0; yy < b.y + b.h; yy += 8, r++) { px(ctx, shade(v.col, 0.85), b.x, yy + 7, b.w, 1); for (let xx = b.x + (r % 2 ? 10 : 0); xx < b.x + b.w; xx += 20) px(ctx, shade(v.col, 0.85), xx, yy, 1, 8); } for (let xx = b.x + 34; xx < b.x + b.w - 10; xx += 44) { px(ctx, '#e6def0', xx, b.y + 22, 5, b.h - 26); px(ctx, '#c8bcd8', xx + 4, b.y + 22, 1, b.h - 26); } }
    else wallPattern(ctx, VL.kind, b.x, b.y + 18, b.w, b.h - 22, wall);
    px(ctx, '#9a9184', b.x - 1, b.y + b.h - 4, b.w + 2, 4); px(ctx, '#b5ad9f', b.x - 1, b.y + b.h - 4, b.w + 2, 1);   // 주춧돌
    outline(ctx, b.x, b.y + 18, b.w, b.h - 18);
    // 굴뚝 (지붕 뒤)
    if (v.id !== 'fire') { px(ctx, '#7a5a4a', b.x + b.w - 44, b.y - 10, 12, 16); px(ctx, '#5a4034', b.x + b.w - 46, b.y - 12, 16, 3); }
    slopeRoof(ctx, b.x, b.y - 2, b.w, 22, VL.roof, 5, 9);
    if (v.id === 'school' || v.id === 'library') {                      // 가운데 박공
      ctx.fillStyle = shade(VL.roof, 1.1); ctx.beginPath(); ctx.moveTo(b.x + b.w / 2 - 38, b.y + 4); ctx.lineTo(b.x + b.w / 2, b.y - 16); ctx.lineTo(b.x + b.w / 2 + 38, b.y + 4); ctx.fill();
      ctx.strokeStyle = shade(VL.roof, 0.6); ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
    }
    if (v.id === 'fire') { px(ctx, '#3a3f48', b.x + b.w / 2 - 6, b.y - 18, 12, 18); px(ctx, '#e5533d', b.x + b.w / 2 - 4, b.y - 16, 8, 6); px(ctx, '#2a2e36', b.x + b.w / 2 - 8, b.y - 20, 16, 3); }   // 망루
    label(ctx, v.name, b.x + b.w / 2, b.y + 10, v.col, VICON[v.id]);
    for (let i = 0; i < 4; i++) {                                      // 창 (불 켜짐) + 덧문 + 꽃 화분
      const wx = b.x + 40 + i * 44, wy = b.y + 30;
      px(ctx, '#3b2a1e', wx - 2, wy - 2, 28, 20);
      const g = ctx.createLinearGradient(0, wy, 0, wy + 16); g.addColorStop(0, '#fff8c8'); g.addColorStop(1, '#ffe08a'); ctx.fillStyle = g; ctx.fillRect(wx, wy, 24, 16);
      px(ctx, '#d8c070', wx + 11, wy, 2, 16); px(ctx, '#d8c070', wx, wy + 7, 24, 2); px(ctx, 'rgba(255,255,255,.6)', wx + 2, wy + 2, 2, 4);
      if (v.id === 'library') { ctx.fillStyle = '#3b2a1e'; ctx.beginPath(); ctx.arc(wx + 12, wy, 13, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff8c8'; ctx.beginPath(); ctx.arc(wx + 12, wy, 11, Math.PI, 0); ctx.fill(); }
      if (v.id === 'school' || v.id === 'clinic') flowerBox(ctx, wx - 1, wy + 19, 26);
      else px(ctx, '#6b4423', wx - 3, wy + 18, 30, 3);
    }
    if (v.id === 'fire') { px(ctx, '#2a2e36', b.x + 1, b.y + 24, 32, 46); px(ctx, '#c9342b', b.x + 3, b.y + 26, 28, 44); for (let k = 0; k < 7; k++) px(ctx, '#a8281f', b.x + 3, b.y + 29 + k * 6, 28, 2); px(ctx, '#fff', b.x + 9, b.y + 30, 16, 3); }   // 빨간 차고 문
    else { px(ctx, '#2a1d14', b.x + 4, b.y + 30, 26, 40); px(ctx, '#5a3826', b.x + 6, b.y + 32, 22, 38); px(ctx, '#ffe9a8', b.x + 8, b.y + 33, 18, 5); px(ctx, '#6e4630', b.x + 8, b.y + 41, 8, 12); px(ctx, '#6e4630', b.x + 18, b.y + 41, 8, 12); px(ctx, '#ffd84a', b.x + 23, b.y + 54, 2, 2); }
    if (v.id === 'clinic') { px(ctx, '#fff', b.x + 6, b.y + 20, 22, 9); px(ctx, '#e5533d', b.x + 15, b.y + 21, 4, 7); px(ctx, '#e5533d', b.x + 12, b.y + 23, 10, 3); }   // 보건 표시
    if (v.id === 'school') { px(ctx, '#fff', b.x + b.w / 2 - 6, b.y - 8, 12, 8); px(ctx, '#3b2a1e', b.x + b.w / 2 - 1, b.y - 8, 2, 8); }   // 박공 창
  }
  // 캐시: 바닥 + 공방·마을 바탕 (글꼴이 준비된 뒤 한 번)
  let cache = null;
  function staticLayer() {
    if (cache && cache._res === C.RES) return cache;                  // 화면 배율이 바뀌면 다시 그림
    cache = document.createElement('canvas'); cache._res = C.RES; cache.width = C.VIEW.w * C.RES; cache.height = C.VIEW.h * C.RES;
    const g = cache.getContext('2d'); g.scale(C.RES, C.RES); g.imageSmoothingEnabled = false; seed = 7;
    drawGround(g); shops.forEach(s => drawShop(g, s)); villages.forEach(v => drawVillage(g, v));
    return cache;
  }
  // 조달청 (2026-11-03 다시 그림): 박공지붕 · 큰 CI 간판 · 업적 메달 자리 · 기둥 · 유리문 · 계단 · 깃대. 충돌 영역(office.body)은 그대로
  const roofPerch = { x: 480, y: 242 };                                // 나르미가 서는 지붕 자리 (조달청 그림이 있으면 drawOffice가 높이를 맞춤)
  function drawOffice(ctx, t) {
    const b = office.body, x = b.x, y = b.y, w = b.w, px = (c, X, Y, W, H) => { ctx.fillStyle = c; ctx.fillRect(Math.round(X), Math.round(Y), W, H); };
    px('rgba(0,0,0,.18)', x + 4, y + b.h - 2, w, 6);                                   // 그림자
    const hq = G.img && G.img.hq;
    if (hq && hq.naturalWidth) {                                                      // 11-16 8.17단계 미래형 조달청 그림(704×576): 벽 x 48~656이 건물 폭에, 옥상 판 y 145가 y-2에
      const s = (w + 24) / 608, ox = x - 12 - 48 * s, oy = y + b.h - 540 * s, P = (ix, iy) => [ox + ix * s, oy + iy * s];   // 조금 크게(양옆 12px), 계단 아래를 건물 바닥에
      ctx.imageSmoothingEnabled = true; ctx.drawImage(hq, ox, oy, hq.naturalWidth * s, hq.naturalHeight * s); ctx.imageSmoothingEnabled = false;
      const ci = G.img.ci_h, [sx0, sy0] = P(112, 185), [sx1, sy1] = P(592, 245);        // 그림의 빈 간판에 공식 CI
      // CI는 간판 폭을 거의 다 쓰게
      if (ci && ci.naturalWidth) {
        const ch = Math.round((sy1 - sy0) + 8), cw = ci.naturalWidth * ch / ci.naturalHeight, mx = (sx0 + sx1) / 2, my = (sy0 + sy1) / 2;
        ctx.fillStyle = '#ffffff'; G.soft.rr(ctx, mx - cw / 2 - 5, my - ch / 2 - 2, cw + 10, ch + 4, 4); ctx.fill();
        ctx.strokeStyle = '#1e2f52'; ctx.lineWidth = 1; G.soft.rr(ctx, mx - cw / 2 - 4.5, my - ch / 2 - 1.5, cw + 9, ch + 3, 4); ctx.stroke();
        ctx.imageSmoothingEnabled = true; ctx.drawImage(ci, mx - cw / 2, my - ch / 2, cw, ch); ctx.imageSmoothingEnabled = false;
      }
      office.art = { band: P(0, 270)[1], top: P(0, 120)[1] };                         // 메달 줄(회색 띠)·옥상 가운데 높이 (missions.js·나르미가 씀)
      roofPerch.y = Math.round(office.art.top + 4);
      return;
    }
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
    ctx.drawImage(staticLayer(), 0, 0, C.VIEW.w, C.VIEW.h);
    drawOffice(ctx, performance.now() / 1000);
  }
  // 마을 이름표만 다시 그리기 (피해 연출이 덮은 뒤)
  function villageLabel(ctx, v) { const art = villageArt(v), b = v.body; label(ctx, v.name, b.x + b.w / 2 + (art ? VLABEL_DX[v.id] || 0 : 0), art ? art.y + 13 : b.y + 10, v.col, VICON[v.id]); }
  return { label, shopArt, shade, CATS, VILLAGES, shops, villages, office, START, PLAY, blocked, draw, text, villageArt, villageLabel, roofPerch };
})();
