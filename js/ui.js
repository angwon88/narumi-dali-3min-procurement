/* HUD · 버튼 · 공통 그리기 */
'use strict';
G.ui = (() => {
  const C = G.C, T = (...a) => G.world.text(...a);
  function panel(ctx, x, y, w, h, fill, line) {
    ctx.fillStyle = fill || 'rgba(20,28,40,.92)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = line || '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.lineWidth = 1;
  }
  function button(ctx, r, label, opt = {}) {
    const hot = G.U.inRect(G.input.mouse.x, G.input.mouse.y, r);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(r.x + 3, r.y + 4, r.w, r.h);
    ctx.fillStyle = hot ? (opt.hot || '#ffd84a') : (opt.fill || '#f6c431'); ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(r.x, r.y, r.w, 3);
    T(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, opt.size || 16, opt.col || '#2a2416');
  }
  const clicked = r => G.input.taps.some(p => G.U.inRect(p.x, p.y, r));
  function hud(ctx, S) {
    ctx.fillStyle = '#1e2a3a'; ctx.fillRect(0, 0, C.VIEW.w, C.HUD_H);
    ctx.fillStyle = '#2f4f8a'; ctx.fillRect(0, C.HUD_H - 3, C.VIEW.w, 3);
    const low = S.timeLeft <= 30;
    T(ctx, '⏱', 22, 22, 16, '#fff');
    T(ctx, G.U.fmtTime(S.timeLeft), 70, 22, 24, low ? (Math.floor(S.timeLeft * 2) % 2 ? '#ff6b5b' : '#ffb3a8') : '#fff');
    T(ctx, '점수 ' + S.score, 200, 22, 16, '#ffe48a');
    T(ctx, '‖', C.VIEW.w - 22, 22, 18, '#fff');
  }
  const PAUSE_BTN = { x: C.VIEW.w - 40, y: 4, w: 36, h: 36 };
  function joystick(ctx) {
    const j = G.input.joy; if (!j.active) return;
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(j.ox, j.oy, j.R, 0, 7); ctx.fill();
    let dx = j.x - j.ox, dy = j.y - j.oy; const d = Math.hypot(dx, dy); if (d > j.R) { dx *= j.R / d; dy *= j.R / d; }
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(j.ox + dx, j.oy + dy, 20, 0, 7); ctx.fill();
  }
  return { panel, button, clicked, hud, joystick, PAUSE_BTN };
})();
