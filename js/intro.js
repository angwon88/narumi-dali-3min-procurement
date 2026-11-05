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
    if (adv || t >= PANEL) { idx++; t = 0; G.audio.play('click'); if (idx >= 5) done(); }
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
  function reg(ctx, x, y, ok) {                       // 지붕의 나라장터 등록 표시 (게임과 같게)
    ctx.fillStyle = '#1e2a3a'; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill();
    ctx.fillStyle = ok ? '#2e9b3a' : '#8a8f99'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
    T(ctx, ok ? '✔' : '…', x, y + 1, 12, '#fff');
  }
  function stampBox(ctx, x, y, text, col, k) {        // 기울어진 도장 (k: 0~1 찍히는 정도) — 2026-11-03 둥근 판·Jua
    const K = G.soft, sc = 1.8 - 0.8 * Math.min(1, k);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, k * 2);
    ctx.font = '19px "Jua", sans-serif'; const w = ctx.measureText(text).width + 26;
    K.softShadow(ctx, 6, 3, .3); K.rr(ctx, -w / 2, -16, w, 32, 10); ctx.fillStyle = col; ctx.fill(); K.noShadow(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; K.rr(ctx, -w / 2 + 3, -13, w - 6, 26, 8); ctx.stroke(); ctx.lineWidth = 1;
    K.J(ctx, text, 0, 1, 19, '#fff'); ctx.restore(); ctx.globalAlpha = 1;
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
      reg(ctx, cx - 320, top + 11, true); reg(ctx, cx - 130, top + 11, true); reg(ctx, cx + 130, top + 11, k > 0.78 ? false : false);   // 등록 업체 ✔ / 새 공방 = 심사 중
      card(ctx, cx - 48, top + 172, 'desk', 12, 2, false);
      if (k > 0.2) stampBox(ctx, cx - 270, top + 136, '조건 ✘', '#d9342b', (k - 0.2) * 5);
      if (k > 0.38) stampBox(ctx, cx - 80, top + 136, '가성비!', '#2e9b3a', (k - 0.38) * 5);
      const dk = Math.min(1, Math.max(0, (k - 0.38) / 0.3));                   // 달이: B로 걸어감
      if (G.C.CONNECT) {                                                       // 계약 연결: 카드를 누르고 → B 공방을 누름 → 수레 출발
        const tk = k < 0.2 ? { x: cx - 8, y: top + 215 } : { x: cx - 80, y: top + 100 };
        if (k < 0.5) { ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(tk.x, tk.y, 10 + (tt * 2 % 1) * 12, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        if (k >= 0.5) G.connect.vehicle(ctx, cx - 110 + Math.min(1, (k - 0.5) / 0.3) * 60, top + 250, 1, 'desk', false, tt);
      } else G.spr.drawChar(ctx, 'dali', dk > 0 && dk < 1 ? 'walk' : 'rot', 'n', tt, cx - 200 + dk * 190, top + 258 - dk * 118, 1.05);   // B 공방 문 앞으로
      // 나르미: 등록 심사 중인 새 공방(너무 싸고 너무 좋음)을 눌러 실사 → 실사 보고서 → 적발
      const nk = Math.min(1, Math.max(0, (k - 0.3) / 0.25));
      G.spr.drawChar(ctx, 'narmi', nk > 0 && nk < 1 ? 'walk' : 'rot', 'ne', tt, cx + 120 + nk * 75, top + 250 - nk * 108, 1.05);
      if (k > 0.5) {
        const bx = cx + 222, by = top + 132, f = Math.min(1, (k - 0.5) / 0.26);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(bx + 2, by + 3, 128, 70);
        ctx.fillStyle = '#fffdf6'; ctx.fillRect(bx, by, 128, 70); ctx.fillStyle = '#1e2a3a'; ctx.fillRect(bx, by, 128, 16); T(ctx, '실사 보고서', bx + 64, by + 8, 12, '#fff');
        [['사업장', true], ['생산 설비', false], ['납품 실적', false]].forEach(([n2, ok], j) => {
          T(ctx, n2, bx + 10, by + 26 + j * 15, 12, '#4a3f2a', 'left');
          T(ctx, f > 0.2 + j * 0.3 ? (ok ? '✔ 확인' : '✘ 없음') : '…', bx + 118, by + 26 + j * 15, 12, f > 0.2 + j * 0.3 ? (ok ? '#2e9b3a' : '#d9342b') : '#8a8f99', 'right');
        });
      }
      if (k > 0.78) stampBox(ctx, cx + 195, top + 78, '적발!', '#d9342b', (k - 0.78) * 5);
    } else if (i === 3) {                              // ④ 위기 대응: 아낀 세금으로 원자재 비축 → 폭등 때 공방 값 그대로 / 태풍 긴급조달
      // 왼쪽: 아낀 세금 → 원자재 상자 → 폭등 (시험판은 비축을 꺼서 왼쪽에 보건소 긴급 계약)
      if (G.C.STOCK === false) {
        house(ctx, cx - 280, top + 150, 180, 80, '#7fb8a4', '#3f6f60', '보건소');
        if (k > 0.3) { const bx = cx - 232, by = top + 30; ctx.fillStyle = '#d9342b'; ctx.fillRect(bx, by - 14, 56, 14); ctx.font = '10px Galmuri9, ' + G.FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('긴급 ×2', bx + 28, by - 7); ctx.fillStyle = '#fffdf6'; ctx.fillRect(bx, by, 84, 90); ctx.strokeStyle = '#e5533d'; ctx.lineWidth = 3; ctx.strokeRect(bx + 1.5, by + 1.5, 81, 87); ctx.lineWidth = 1; G.icons.draw(ctx, 'kit', bx + 42, by + 28, 34); T(ctx, '구급상자', bx + 42, by + 56, 12, '#2a2416'); T(ctx, '예정 9만', bx + 42, by + 72, 12, '#6a5a3a'); }
      } else {
      ctx.fillStyle = '#1e2a3a'; ctx.fillRect(cx - 330, top + 6, 120, 30); T(ctx, '아낀 세금', cx - 300, top + 21, 12, '#8fa3b8'); T(ctx, Math.max(3, 12 - Math.min(3, Math.floor(k * 8)) * 3) + '만원', cx - 238, top + 21, 12, '#9be37a');
      const crates = Math.min(3, Math.floor(k * 8));
      for (let j = 0; j < 3; j++) { const x = cx - 300 + j * 26, y = top + 120; if (j < crates) { G.events.crate(ctx, x, y); G.events.crate(ctx, x + 6, y - 12); } else { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.strokeRect(x + .5, y + .5, 13, 11); } }
      if (crates < 3 && k < 0.4) { const f = (k * 8) % 1; ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(cx - 260 + (cx - 300 + crates * 26 - (cx - 260)) * f, top + 36 + 84 * f - Math.sin(f * Math.PI) * 30, 5, 0, 7); ctx.fill(); }
      T(ctx, '원자재가 쌀 때 비축', cx - 262, top + 150, 12, '#fff');
      if (k > 0.45) {
        const kk = Math.min(1, (k - 0.45) * 5);
        ctx.fillStyle = '#d9342b'; ctx.fillRect(cx - 345, top + 164, 330, 22); T(ctx, '원자재 가격 폭등!', cx - 180, top + 175, 12, '#fff');
        for (const [x, ic, price, col, lab, lc] of [[cx - 345, 'desk', '10만', '#2a2416', '비축 덕분 그대로', '#2e9b3a'], [cx - 175, 'tablet', Math.round(25 + 15 * kk) + '만', '#d9342b', '비축 없음 ×1.6', '#d9342b']]) {
          ctx.fillStyle = '#fffdf6'; ctx.fillRect(x, top + 192, 160, 50);
          G.icons.draw(ctx, ic, x + 40, top + 208, 20); T(ctx, price, x + 100, top + 208, 12, col);
          ctx.fillStyle = lc; ctx.fillRect(x, top + 226, 160, 16); T(ctx, lab, x + 80, top + 234, 12, '#fff');
        }
      }
      }
      // 오른쪽: 태풍 → 긴급조달 (긴급 계약 ×2)
      ctx.save(); ctx.beginPath(); ctx.rect(cx + 10, top - 20, 330, 300); ctx.clip();
      ctx.fillStyle = 'rgba(20,32,60,.35)'; ctx.fillRect(cx + 10, top - 20, 330, 300);
      ctx.strokeStyle = 'rgba(190,215,255,.6)'; ctx.beginPath(); for (let j = 0; j < 40; j++) { const rx = cx + 10 + ((j * 53 + tt * 260) % 340), ry = top - 20 + ((j * 97 + tt * 420) % 300); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 14); } ctx.stroke();
      ctx.restore();
      house(ctx, cx + 80, top + 150, 180, 80, '#d9574a', '#7a2a22', '소방서');
      if (k > 0.15) {
        const bx = cx + 128, by = top + 30;
        ctx.fillStyle = '#d9342b'; ctx.fillRect(bx, by - 14, 56, 14); ctx.font = '10px Galmuri9, ' + G.FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('긴급 ×2', bx + 28, by - 7);
        ctx.fillStyle = '#fffdf6'; ctx.fillRect(bx, by, 84, 90); ctx.strokeStyle = '#e5533d'; ctx.lineWidth = 3; ctx.strokeRect(bx + 1.5, by + 1.5, 81, 87); ctx.lineWidth = 1;
        G.icons.draw(ctx, 'helmet', bx + 42, by + 28, 34); T(ctx, '안전모', bx + 42, by + 56, 12, '#2a2416'); T(ctx, '예정 7만', bx + 42, by + 72, 12, '#6a5a3a');
      }
      if (k > 0.55) stampBox(ctx, cx + 175, top + 128, '긴급조달!', '#0f8a96', (k - 0.55) * 5);
      if (G.C.CONNECT) G.connect.vehicle(ctx, cx + 40 + Math.min(1, k * 1.4) * 60, top + 262, 1, 'helmet', false, tt);
      else G.spr.drawChar(ctx, 'dali', 'walk', 'e', tt, cx + 40 + Math.min(1, k * 1.4) * 60, top + 262, 1.0);
    } else if (i === 4) {                              // ⑤ 조달관 5대 임무 (missions.js)
      const K = G.soft;
      G.missions.LIST.forEach((m, j) => {
        const y = top + 4 + j * 54, show = k > 0.06 + j * 0.1;
        if (!show) return;
        K.softShadow(ctx, 8, 3, .25); K.rr(ctx, cx - 300, y, 600, 46, 14); ctx.fillStyle = 'rgba(255,251,240,.97)'; ctx.fill(); K.noShadow(ctx);
        ctx.fillStyle = m.col; ctx.beginPath(); ctx.arc(cx - 274, y + 23, 15, 0, 7); ctx.fill();
        K.J(ctx, String(j + 1), cx - 274, y + 25, 20, '#fff');
        G.icons.draw(ctx, m.icon, cx - 230, y + 23, 28);
        K.J(ctx, m.name, cx - 204, y + 15, 19, m.col, { align: 'left' });
        K.J(ctx, m.desc, cx - 204, y + 34, 14, '#5a4e36', { align: 'left' });
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
      if (caught) { stampBox(ctx, bk.x, top + 118, '브로커 차단!', '#7a3fb0', (k - 0.6) * 5); if (k > 0.66) stampBox(ctx, bk.x + 10, top + 156, '입찰참가자격 제한', '#d9342b', (k - 0.66) * 5); }
      // AI 조사 칸: 브로커 1명 적발마다 한 칸 → 3칸이면 AI 데이터 일제 조사
      { const ax = cx - 60, ay = top + 14, n2 = caught ? 3 : k > 0.3 ? 2 : 1;
        ctx.fillStyle = n2 >= 3 && Math.floor(tt * 4) % 2 === 0 ? '#5ec8f2' : '#2a3646'; ctx.fillRect(ax, ay, 120, 34);
        T(ctx, n2 >= 3 ? 'AI 조사 준비!' : 'AI 조사', ax + 60, ay + 10, 12, n2 >= 3 ? '#0b2a3a' : '#cfd8e3');
        for (let j = 0; j < 3; j++) { ctx.fillStyle = j < n2 ? (n2 >= 3 ? '#0b2a3a' : '#7a3fb0') : '#3a4656'; ctx.fillRect(ax + 34 + j * 18, ay + 20, 14, 9); }
        T(ctx, '브로커 3명 → 일제 조사', ax + 60, ay + 44, 12, '#fff'); }
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
    ['카드를 누르고, 맞는 공방을 눌러 계약!', '조건을 맞춘 곳 중 가장 싼 곳이 가성비 · ✔ 없는 새 공방은 눌러서 나르미가 실사해요'],
    ['납품은 자동! 브로커는 막고, 새싹은 키워요', '납품이 끝나기 전에 브로커를 눌러 적발 · 3명 잡으면 AI 조사 · 새싹과 계약하면 혁신제품으로'],
    ['위기 대응: 긴급조달', '태풍이 오면 긴급 계약(점수 ×2)을 먼저 해결해요'],
    ['조달관 5대 임무', '다섯 가지를 모두 해내면 S등급! 화면 위 임무 칸에 도장이 찍혀요'],
  ];
  // 2026-11-03 타이틀·결과와 같은 톤: 일러스트 배경 + 둥근 장면 액자 + 스티커 제목 + 크림색 설명 알약
  function draw(ctx) {
    const K = G.soft, J = K.J, PX = 110, PY = 100, PW = W - 220, PH = 300;
    K.bg(ctx); ctx.fillStyle = 'rgba(40,30,20,.52)'; ctx.fillRect(0, 0, W, H);
    const k = Math.min(1, t / PANEL);
    K.softShadow(ctx, 22, 8, .45); K.rr(ctx, PX, PY, PW, PH, 20); ctx.fillStyle = '#6fae4a'; ctx.fill(); K.noShadow(ctx);
    ctx.save(); K.rr(ctx, PX, PY, PW, PH, 20); ctx.clip();
    ctx.fillStyle = '#d9c38f'; ctx.fillRect(PX, 330, PW, 70);
    scene(ctx, idx, k); ctx.restore();
    ctx.strokeStyle = '#fffbf0'; ctx.lineWidth = 5; K.rr(ctx, PX - 1, PY - 1, PW + 2, PH + 2, 21); ctx.stroke(); ctx.lineWidth = 1;
    const [cap, sub] = CAPS[Math.min(idx, 4)];
    const tg = ctx.createLinearGradient(0, 42, 0, 80); tg.addColorStop(0, '#fff17a'); tg.addColorStop(0.55, '#ffc93a'); tg.addColorStop(1, '#ff9a26');
    K.softShadow(ctx, 8, 4, .35); J(ctx, cap, W / 2, 58, 34, '#fff', { stroke: [['#fff', 14]] }); K.noShadow(ctx);
    J(ctx, cap, W / 2, 58, 34, tg, { stroke: [['#2f4f8a', 7]] });
    ctx.font = '17px "Jua", sans-serif'; const sw = ctx.measureText(sub).width + 40;
    K.softShadow(ctx, 10, 4, .3); K.rr(ctx, W / 2 - sw / 2, 416, sw, 36, 18); ctx.fillStyle = 'rgba(255,251,240,.96)'; ctx.fill(); K.noShadow(ctx);
    J(ctx, sub, W / 2, 435, 17, '#3a3022');
    for (let i = 0; i < 5; i++) {                                   // 진행 점: 지금 장면은 길쭉한 금색
      const on = i === idx, x = W / 2 - 62 + i * 26 + (i > idx ? 18 : 0);
      K.rr(ctx, x, 470, on ? 30 : 12, 12, 6); ctx.fillStyle = on ? '#ffc93a' : i < idx ? 'rgba(255,251,240,.9)' : 'rgba(255,251,240,.4)'; ctx.fill();
    }
    if (idx === 4) J(ctx, '공방·마을 터치 = 이동  ·  새 공방 터치 = 나르미 실사  ·  브로커 터치(Space) = 적발  ·  브로커 3명 → AI 조사 (자동 또는 Q)', W / 2, 503, 13, '#fff', { stroke: [['rgba(40,28,10,.6)', 4]] });
    J(ctx, '클릭·Enter 다음  ·  Esc 건너뛰기', W - 18, H - 16, 14, '#fff6dc', { align: 'right', stroke: [['rgba(40,28,10,.6)', 4]] });
  }
  return { start, update, draw, seen: () => G.store.get('introSeen', false) };
})();
