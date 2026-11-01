/* 상황 소개 3컷 (2026-11-01 추가): 처음 시작할 때 한 번. 무슨 게임인지 10초 안에 알려 주는 장면 (설명문·퀴즈 아님)
   클릭·Enter·Space = 다음, Esc = 건너뛰기. 장면당 3.5초 자동 넘김. */
'use strict';
G.intro = (() => {
  const C = G.C, W = C.VIEW.w, H = C.VIEW.h, T = (...a) => G.world.text(...a), PANEL = 3.5;
  let idx = 0, t = 0, next = null;
  function start(after) { idx = 0; t = 0; next = after; G.screen = 'intro'; }
  function done() { G.store.set('introSeen', true); const f = next; next = null; f && f(); }
  function update(dt) {
    t += dt;
    if (G.input.hit('escape')) { done(); return; }
    const adv = t > 0.3 && (G.input.taps.length || G.input.hit('enter') || G.input.hit(' '));
    if (adv || t >= PANEL) { idx++; t = 0; G.audio.play('click'); if (idx >= 3) done(); }
  }
  // ---------- 장면 그림 ----------
  function house(ctx, x, y, w, h, wall, roof, label) {
    ctx.fillStyle = wall; ctx.fillRect(x, y + 16, w, h - 16); ctx.fillStyle = roof; ctx.fillRect(x - 3, y, w + 6, 20);
    T(ctx, label, x + w / 2, y + 10, 12, '#fff');
  }
  function bubble(ctx, x, y, item, price) {
    ctx.fillStyle = '#2f4f8a'; ctx.fillRect(x, y - 11, 44, 11);
    ctx.font = '10px Galmuri9, ' + G.FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('나라장터', x + 22, y - 5);
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(x, y, 62, 44); ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, 60, 42); ctx.lineWidth = 1;
    G.icons.draw(ctx, item, x + 31, y + 16, 18); T(ctx, '예정 ' + price + '만', x + 31, y + 35, 12, '#4a3f2a');
  }
  function scene(ctx, i, k) {
    const cx = W / 2, top = 120;
    if (i === 0) {
      house(ctx, cx - 250, top + 130, 160, 90, '#e8d27a', '#8a7a40', '학교');
      house(ctx, cx + 90, top + 130, 160, 90, '#d9574a', '#7a2a22', '소방서');
      if (k > 0.1) bubble(ctx, cx - 210, top + 60, 'desk', 12);
      if (k > 0.3) bubble(ctx, cx + 130, top + 60, 'ext', 11);
      G.spr.drawChar(ctx, 'narmi', 'rot', 's', 0, cx, top + 200, 1.1);
      T(ctx, '?', cx + 30, top + 120, 24, '#ffd84a');
    } else if (i === 1) {
      house(ctx, cx - 270, top + 40, 150, 90, '#b9824f', '#6a4a2a', '가구공방 A');
      house(ctx, cx - 110, top + 40, 150, 90, '#b9824f', '#6a4a2a', '가구공방 B');
      house(ctx, cx + 120, top + 40, 150, 90, '#b9824f', '#6a4a2a', '새 공방');
      const tag = (x, p, col) => { ctx.fillStyle = '#fffdf6'; ctx.fillRect(x, top + 70, 80, 24); G.icons.draw(ctx, 'desk', x + 12, top + 82, 14); T(ctx, p + '만', x + 50, top + 83, 12, col); };
      tag(cx - 255, 10.7, '#2a2416'); tag(cx - 95, 11.3, '#2a2416'); tag(cx + 135, 5.4, '#d9342b');
      ctx.fillStyle = '#7a3b2e'; [cx - 220, cx - 60].forEach(x => { ctx.fillRect(x, top + 26, 10, 14); ctx.fillStyle = 'rgba(240,240,240,.8)'; ctx.beginPath(); ctx.arc(x + 5, top + 18 - (k * 20 % 10), 5, 0, 7); ctx.fill(); ctx.fillStyle = '#7a3b2e'; });
      ctx.fillRect(cx + 170, top + 26, 10, 14);                                // 수상한 공방: 연기 없음
      if (k > 0.35) {                                                          // 데이터 분석판
        ctx.fillStyle = '#1e2a3a'; ctx.fillRect(cx + 150, top + 150, 90, 50);
        [0.5, 0.9, 0.3, 0.7].forEach((h, j) => { ctx.fillStyle = j % 2 ? '#9be37a' : '#5ec8f2'; ctx.fillRect(cx + 160 + j * 18, top + 192 - 34 * h * Math.min(1, (k - 0.35) * 3), 10, 34 * h * Math.min(1, (k - 0.35) * 3)); });
        T(ctx, '데이터 분석', cx + 195, top + 214, 12, '#fff');
      }
      if (k > 0.7) { ctx.save(); ctx.translate(cx + 195, top + 85); ctx.rotate(-0.15); ctx.fillStyle = '#d9342b'; ctx.fillRect(-36, -12, 72, 24); T(ctx, '적발!', 0, 1, 16, '#fff'); ctx.restore(); }
      G.spr.drawChar(ctx, 'narmi', 'rot', 'e', 0, cx + 90, top + 220, 1.1);
      G.spr.drawChar(ctx, 'dali', 'rot', 's', 0, cx - 150, top + 220, 1.1);
    } else {
      house(ctx, cx + 60, top + 120, 200, 90, '#e8d27a', '#8a7a40', '학교');
      const dx = cx - 240 + Math.min(1, k * 1.6) * 230;
      G.spr.drawChar(ctx, 'dali', 'walk', 'e', k * 3, dx, top + 200, 1.2);
      G.icons.draw(ctx, 'desk', dx, top + 110, 22);
      if (k > 0.65) {
        T(ctx, '+ 제때 납품!', cx + 160, top + 70, 20, '#ffe48a');
        ctx.fillStyle = '#8a5a30'; ctx.fillRect(cx + 200, top + 228, 30, 4); ctx.fillRect(cx + 200, top + 234, 30, 4);   // 선물 벤치
        T(ctx, '아낀 세금 → 벤치 선물', cx + 160, top + 250, 12, '#9be37a');
      }
    }
  }
  const CAPS = [
    ['마을에 필요한 물건이 생겼어요', '학교·보건소·소방서·도서관이 나라장터로 주문해요'],
    ['조달청 나르미와 달이가 공정하게 골라 사요', '싸고 믿을 수 있는 공방을 고르고, 수상한 공방은 데이터로 걸러내요'],
    ['필요한 곳에, 제때 배달!', '아낀 세금은 마을 선물로 돌아와요 · 3분 동안 마을을 지켜 주세요'],
  ];
  function draw(ctx) {
    ctx.fillStyle = '#1e2a3a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#6fae4a'; ctx.fillRect(110, 100, W - 220, 300); ctx.fillStyle = '#d9c38f'; ctx.fillRect(110, 330, W - 220, 70);
    const k = Math.min(1, t / PANEL);
    ctx.save(); ctx.beginPath(); ctx.rect(110, 100, W - 220, 300); ctx.clip(); scene(ctx, idx, k); ctx.restore();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(110, 100, W - 220, 300); ctx.lineWidth = 1;
    const [cap, sub] = CAPS[Math.min(idx, 2)];
    T(ctx, cap, W / 2, 62, 24, '#ffd84a');
    T(ctx, sub, W / 2, 432, 16, '#fff');
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i === idx ? '#ffd84a' : '#4a5a70'; ctx.fillRect(W / 2 - 30 + i * 22, 470, 14, 6); }
    if (idx === 2) T(ctx, '이동: 방향키·WASD (모바일: 화면 드래그)  ·  검증: 공방 클릭·Space', W / 2, 496, 12, '#cfd8e3');
    T(ctx, '클릭·Enter 다음  ·  Esc 건너뛰기', W - 16, H - 16, 12, '#8fa3b8', 'right');
  }
  return { start, update, draw, seen: () => G.store.get('introSeen', false) };
})();
