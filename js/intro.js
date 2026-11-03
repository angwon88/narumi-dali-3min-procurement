/* 상황 소개 3컷 (2026-11-01 추가): 처음 시작할 때 한 번. 무슨 게임인지 10초 안에 알려 주는 장면 (설명문·퀴즈 아님)
   클릭·Enter·Space = 다음, Esc = 건너뛰기. 장면당 3.5초 자동 넘김. */
'use strict';
G.intro = (() => {
  const C = G.C, W = C.VIEW.w, H = C.VIEW.h, T = (...a) => G.world.text(...a), PANEL = 5;   // 개편: 장면이 많아져 3.5 → 5초
  let idx = 0, t = 0, next = null;
  function start(after) { idx = 0; t = 0; next = after; G.screen = 'intro'; }
  function done() { G.store.set('introSeen', true); const f = next; next = null; f && f(); }
  function update(dt) {
    t += dt;
    if (G.input.hit('escape')) { done(); return; }
    const adv = t > 0.3 && (G.input.taps.length || G.input.hit('enter') || G.input.hit(' '));
    if (adv || t >= PANEL) { idx++; t = 0; G.audio.play('click'); if (idx >= 4) done(); }
  }
  // ---------- 장면 그림 ----------
  function house(ctx, x, y, w, h, wall, roof, label) {
    ctx.fillStyle = wall; ctx.fillRect(x, y + 16, w, h - 16); ctx.fillStyle = roof; ctx.fillRect(x - 3, y, w + 6, 20);
    T(ctx, label, x + w / 2, y + 10, 12, '#fff');
  }
  // 계약 카드 (게임 속 말풍선을 크게): 나라장터 탭 + 물건 + 예정가격 + 품질 조건 줄
  function card(ctx, x, y, item, price, minQ, hi) {
    const w = 96, h = 104;
    ctx.fillStyle = '#2f4f8a'; ctx.fillRect(x, y - 14, 56, 14);
    ctx.font = '10px Galmuri9, ' + G.FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('나라장터', x + 28, y - 7);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 3, y + 4, w, h);
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.lineWidth = 1;
    G.icons.draw(ctx, item, x + w / 2, y + 26, 34);
    ctx.font = '12px "Galmuri11 Bold", ' + G.FONT; ctx.fillStyle = '#2a2416'; ctx.fillText(G.ITEM[item].name, x + w / 2, y + 54);
    T(ctx, '예정 ' + price + '만', x + w / 2, y + 68, 12, '#6a5a3a');
    ctx.fillStyle = hi ? '#e5533d' : '#2a2416'; ctx.fillRect(x + 4, y + 78, w - 8, 22);
    const sw = minQ * 16 - 2, sx = Math.round(x + w / 2 - (sw + 24) / 2);
    G.icons.stars(ctx, sx, y + 82, minQ, minQ, 2); T(ctx, '이상', sx + sw + 14, y + 89, 12, '#fff');
  }
  // 공방 (지붕·벽·창·문 + 가격표: 아이콘·품질·가격)
  function shop(ctx, x, y, label, roof, q, price, smoke, t) {
    ctx.fillStyle = '#b9824f'; ctx.fillRect(x, y + 20, 150, 70); ctx.fillStyle = roof; ctx.fillRect(x - 3, y, 156, 22);
    T(ctx, label, x + 75, y + 11, 12, '#fff');
    ctx.fillStyle = '#7a3b2e'; ctx.fillRect(x + 118, y - 14, 10, 14);
    if (smoke) for (let i = 0; i < 3; i++) { const k = ((t * 0.7) + i / 3) % 1; ctx.globalAlpha = 0.8 * (1 - k); ctx.fillStyle = '#f4f6f8'; ctx.beginPath(); ctx.arc(x + 123, y - 18 - k * 16, 3 + k * 4, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#3b2a1e'; ctx.fillRect(x + 118, y + 50, 22, 40);
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(x + 8, y + 30, 100, 26);
    G.icons.draw(ctx, 'desk', x + 20, y + 43, 18); G.icons.stars(ctx, x + 32, y + 36, q, 3, 1); T(ctx, price + '만', x + 104, y + 44, 12, '#2a2416', 'right');
  }
  function stampBox(ctx, x, y, text, col, k) {        // 기울어진 도장 (k: 0~1 찍히는 정도)
    const sc = 1.8 - 0.8 * Math.min(1, k);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, k * 2);
    ctx.font = '16px ' + G.FONT; const w = ctx.measureText(text).width + 20;
    ctx.fillStyle = col; ctx.fillRect(-w / 2, -14, w, 28); T(ctx, text, 0, 1, 16, '#fff'); ctx.restore(); ctx.globalAlpha = 1;
  }
  function sprout(ctx, x, y, g) {                     // 새싹 → 자라는 나무 (g: 0~1)
    const h = 8 + g * 34, lf = 4 + g * 10;
    ctx.fillStyle = '#6b4423'; ctx.fillRect(x - 12, y, 24, 6);
    ctx.fillStyle = '#2e8b2e'; ctx.fillRect(x - 2, y - h, 4, h);
    ctx.fillStyle = '#4cc04c'; ctx.fillRect(x - 2 - lf, y - h - 2, lf, 6); ctx.fillRect(x + 2, y - h - 7, lf, 6);
    if (g > 0.6) { ctx.fillStyle = '#7cd65c'; ctx.fillRect(x - lf * 0.6, y - h * 0.6, lf * 0.6, 5); ctx.fillRect(x + 2, y - h * 0.45, lf * 0.6, 5); }
  }
  function scene(ctx, i, k) {
    const cx = W / 2, top = 120, tt = k * PANEL;
    if (i === 0) {                                     // ① 계약 카드: 품질 조건을 읽어요
      house(ctx, cx - 300, top + 140, 170, 90, '#e8d27a', '#8a7a40', '학교');
      house(ctx, cx + 130, top + 140, 170, 90, '#d9574a', '#7a2a22', '소방서');
      if (k > 0.08) card(ctx, cx - 263, top + 10, 'desk', 12, 2, k > 0.45 && Math.floor(tt * 4) % 2 === 0);
      if (k > 0.25) card(ctx, cx + 167, top + 10, 'ext', 11, 1, false);
      if (k > 0.45) {                                   // 조건 줄을 가리키는 화살표
        ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.moveTo(cx - 155, top + 99); ctx.lineTo(cx - 140, top + 91); ctx.lineTo(cx - 140, top + 107); ctx.fill();
        ctx.fillRect(cx - 140, top + 96, 40, 6);
        T(ctx, '계약 조건!', cx - 60, top + 99, 16, '#ffd84a');
        T(ctx, '품질 ★★ 이상만 받아요', cx - 40, top + 122, 12, '#fff');
      }
      G.spr.drawChar(ctx, 'narmi', 'rot', 's', tt, cx - 20, top + 236, 1.1);
      G.spr.drawChar(ctx, 'dali', 'rot', 's', tt, cx + 30, top + 240, 1.1);
    } else if (i === 1) {                              // ② 가성비 고르기 + 새 공방 실사
      shop(ctx, cx - 330, top + 30, '가구공방 A', '#6a4a2a', 1, 8, true, tt);
      shop(ctx, cx - 140, top + 30, '가구공방 B', '#6a4a2a', 2, 10, true, tt);
      shop(ctx, cx + 120, top + 30, '새 공방', '#6a4a2a', 3, 5, false, tt);
      card(ctx, cx - 48, top + 172, 'desk', 12, 2, false);
      if (k > 0.2) stampBox(ctx, cx - 270, top + 136, '조건 ✘', '#d9342b', (k - 0.2) * 5);
      if (k > 0.38) stampBox(ctx, cx - 80, top + 136, '가성비!', '#2e9b3a', (k - 0.38) * 5);
      const dk = Math.min(1, Math.max(0, (k - 0.38) / 0.3));                   // 달이: B로 걸어감
      G.spr.drawChar(ctx, 'dali', dk > 0 && dk < 1 ? 'walk' : 'rot', 'n', tt, cx - 200 + dk * 190, top + 258 - dk * 118, 1.05);   // B 공방 문 앞으로
      // 나르미: 너무 싸고 너무 좋은 새 공방으로 → 데이터 분석 → 적발
      const nk = Math.min(1, Math.max(0, (k - 0.3) / 0.25));
      G.spr.drawChar(ctx, 'narmi', nk > 0 && nk < 1 ? 'walk' : 'rot', 'ne', tt, cx + 120 + nk * 75, top + 250 - nk * 108, 1.05);
      if (k > 0.55) {
        ctx.fillStyle = '#1e2a3a'; ctx.fillRect(cx + 240, top + 140, 84, 48);
        [0.5, 0.9, 0.3, 0.7].forEach((h, j) => { const g = Math.min(1, (k - 0.55) * 4); ctx.fillStyle = j % 2 ? '#9be37a' : '#5ec8f2'; ctx.fillRect(cx + 250 + j * 17, top + 182 - 32 * h * g, 10, 32 * h * g); });
        T(ctx, '실사·데이터 분석', cx + 282, top + 200, 12, '#fff');
      }
      if (k > 0.78) stampBox(ctx, cx + 195, top + 78, '적발!', '#d9342b', (k - 0.78) * 5);
    } else if (i === 3) {                              // ④ 조달관 5대 임무 (missions.js)
      G.missions.LIST.forEach((m, j) => {
        const y = top + 4 + j * 54, show = k > 0.06 + j * 0.1;
        if (!show) return;
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(cx - 300 + 3, y + 4, 600, 46);
        ctx.fillStyle = '#fffdf6'; ctx.fillRect(cx - 300, y, 600, 46);
        ctx.fillStyle = m.col; ctx.fillRect(cx - 300, y, 46, 46);
        T(ctx, String(j + 1), cx - 277, y + 24, 24, '#fff');
        G.icons.draw(ctx, m.icon, cx - 226, y + 23, 28);
        ctx.font = '16px "Galmuri11 Bold", ' + G.FONT; ctx.fillStyle = m.col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(m.name, cx - 200, y + 14);
        T(ctx, m.desc, cx - 200, y + 33, 12, '#4a3f2a', 'left');
      });
    } else {                                           // ③ 검수 합격 · 브로커 차단 · 새싹 성장
      house(ctx, cx - 330, top + 150, 160, 80, '#e8d27a', '#8a7a40', '학교');
      G.spr.drawChar(ctx, 'dali', 'rot', 'e', tt, cx - 160, top + 262, 1.0);
      if (k > 0.08) {                                   // 검수표
        const sx = cx - 250, sy = top + 50, kk = Math.min(1, (k - 0.08) * 5);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(-0.05); ctx.scale(1.5 - 0.5 * kk, 1.5 - 0.5 * kk);
        ctx.fillStyle = '#fffdf6'; ctx.fillRect(-84, -26, 168, 52); ctx.strokeStyle = '#2e9b3a'; ctx.lineWidth = 3; ctx.strokeRect(-82.5, -24.5, 165, 49); ctx.lineWidth = 1;
        T(ctx, '계약', -66, -10, 12, '#6a5a3a'); G.icons.stars(ctx, -52, -17, 2, 3, 2);
        T(ctx, '납품', 10, -10, 12, '#6a5a3a'); G.icons.stars(ctx, 24, -17, 2, 3, 2);
        ctx.fillStyle = '#2e9b3a'; ctx.fillRect(-78, 4, 156, 18); T(ctx, '검수 합격 ✔', 0, 13, 12, '#fff'); ctx.restore();
      }
      // 브로커: 학교 쪽으로 달리다 나르미에게 적발
      const caught = k > 0.6, rk = Math.min(1, k / 0.6);
      const bk = { state: caught ? 'caught' : 'run', t: tt, face: -1, x: cx + 60 - rk * 90, y: top + 230, item: 'desk', freeze: 0 };
      if (!caught) { ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = '#e5533d'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(bk.x, bk.y - 20); ctx.lineTo(cx - 190, top + 190); ctx.stroke(); ctx.restore(); }
      G.broker.raccoon(ctx, bk, null);
      const nk = Math.min(1, Math.max(0, (k - 0.35) / 0.25));
      G.spr.drawChar(ctx, 'narmi', 'walk', 'sw', tt, cx - 30 + (bk.x - cx + 30) * nk + 20, top + 120 + nk * 90 - 14, 1.0);
      if (caught) stampBox(ctx, bk.x, top + 120, '브로커 차단!', '#7a3fb0', (k - 0.6) * 5);
      // 새싹 공방 → 혁신제품
      const gx = cx + 250, g = Math.min(1, Math.max(0, (k - 0.2) / 0.55));
      ctx.fillStyle = '#b9824f'; ctx.fillRect(gx - 70, top + 150, 140, 80);
      ctx.fillStyle = g >= 1 ? '#f6c431' : '#7cc45a'; ctx.fillRect(gx - 73, top + 130, 146, 22);
      T(ctx, g >= 1 ? '★혁신 공방' : '새싹 공방', gx, top + 141, 12, g >= 1 ? '#5a3a00' : '#1f4a17');
      sprout(ctx, gx, top + 214, g);
      const done = Math.min(3, Math.floor(g * 3.01));
      ctx.fillStyle = '#1f4a17'; ctx.fillRect(gx - 50, top + 238, 100, 16); T(ctx, '실적', gx - 32, top + 246, 12, '#fff');
      for (let j = 0; j < 3; j++) { ctx.fillStyle = j < done ? '#9be37a' : '#4a6a40'; ctx.fillRect(gx - 12 + j * 18, top + 241, 14, 10); }
      if (g >= 1) stampBox(ctx, gx, top + 100, '혁신제품 지정!', '#e0a800', (k - 0.75) * 5);
    }
  }
  const CAPS = [
    ['마을이 계약 조건과 함께 주문해요', '나라장터 주문 카드 맨 아래 별 = 꼭 지켜야 할 품질 조건이에요'],
    ['조건을 맞추는 곳 중 가성비를 골라요', '제일 싼 곳이 정답은 아니에요 · 너무 싸고 좋은 새 공방은 나르미가 실사해요'],
    ['검수 합격! 브로커는 막고, 새싹은 키워요', '브로커는 눌러서 나르미로 적발 · 새싹 공방을 사 주면 혁신제품으로 자라요'],
    ['조달관 5대 임무', '다섯 가지를 모두 해내면 S등급! 화면 위 임무 칸에 도장이 찍혀요'],
  ];
  function draw(ctx) {
    ctx.fillStyle = '#1e2a3a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#6fae4a'; ctx.fillRect(110, 100, W - 220, 300); ctx.fillStyle = '#d9c38f'; ctx.fillRect(110, 330, W - 220, 70);
    const k = Math.min(1, t / PANEL);
    ctx.save(); ctx.beginPath(); ctx.rect(110, 100, W - 220, 300); ctx.clip(); scene(ctx, idx, k); ctx.restore();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(110, 100, W - 220, 300); ctx.lineWidth = 1;
    const [cap, sub] = CAPS[Math.min(idx, 3)];
    T(ctx, cap, W / 2, 62, 24, '#ffd84a');
    T(ctx, sub, W / 2, 432, 16, '#fff');
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i === idx ? '#ffd84a' : '#4a5a70'; ctx.fillRect(W / 2 - 41 + i * 22, 470, 14, 6); }
    if (idx === 3) T(ctx, '공방·마을 터치 = 이동  ·  새 공방 터치 = 나르미 실사  ·  브로커 터치(Space) = 적발  ·  브로커 3명 적발 → 필살기 AI 조사(자동/Q)', W / 2, 496, 12, '#cfd8e3');
    T(ctx, '클릭·Enter 다음  ·  Esc 건너뛰기', W - 16, H - 16, 12, '#8fa3b8', 'right');
  }
  return { start, update, draw, seen: () => G.store.get('introSeen', false) };
})();
