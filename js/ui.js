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
    T(ctx, '⏱', 20, 22, 16, '#fff');
    T(ctx, G.U.fmtTime(S.timeLeft), 64, 22, 24, low ? (Math.floor(S.timeLeft * 2) % 2 ? '#ff6b5b' : '#ffb3a8') : '#fff');
    T(ctx, '점수', 128, 22, 12, '#8fa3b8', 'left'); T(ctx, String(S.score), 160, 22, 18, '#ffe48a', 'left');
    T(ctx, '아낀 세금', 262, 22, 12, '#8fa3b8', 'left'); T(ctx, S.saved + '만원', 322, 22, 16, '#9be37a', 'left');
    // 마을 신뢰도 게이지
    const gx = 452, gw = 170, f = S.trust / 100, danger = S.trust <= C.TRUST_DANGER;
    T(ctx, '마을 신뢰', gx - 6, 22, 12, '#8fa3b8', 'right');
    ctx.fillStyle = '#0f1620'; ctx.fillRect(gx, 14, gw, 16);
    const blink = danger && Math.floor(S.elapsed * 3) % 2 === 0;
    ctx.fillStyle = blink ? '#ff8a7a' : f > 0.5 ? '#46b04a' : f > 0.25 ? '#f2b632' : '#e5533d';
    ctx.fillRect(gx + 2, 16, Math.round((gw - 4) * f), 12);
    T(ctx, String(Math.round(S.trust)), gx + gw / 2, 22, 12, '#fff');
    // 나르미 검증 준비 상태 (원형 게이지)
    const nx = 660, ny = 22, cd = S.inspectCD || 0, ready = cd <= 0 && !G.narmi.busy();
    ctx.fillStyle = '#0f1620'; ctx.beginPath(); ctx.arc(nx, ny, 17, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = ready ? '#9be37a' : '#3a4656';
    ctx.beginPath(); ctx.arc(nx, ny, 15, 0, Math.PI * 2); ctx.stroke();
    if (!ready && S.inspectCDMax) { ctx.strokeStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(nx, ny, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd / S.inspectCDMax)); ctx.stroke(); }
    ctx.lineWidth = 1;
    ctx.save(); ctx.beginPath(); ctx.arc(nx, ny, 13, 0, Math.PI * 2); ctx.clip();
    G.spr.drawChar(ctx, 'narmi', 'rot', 's', 0, nx, ny + 30, 0.6); ctx.restore();
    T(ctx, ready ? '검증 OK' : Math.ceil(cd) + '초', nx + 22, 22, 12, ready ? '#9be37a' : '#8fa3b8', 'left');
    T(ctx, '‖', C.VIEW.w - 22, 22, 18, '#fff');
  }
  const PAUSE_BTN = { x: C.VIEW.w - 40, y: 4, w: 36, h: 36 };
  function joystick(ctx) {
    const j = G.input.joy; if (!j.active) return;
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(j.ox, j.oy, j.R, 0, 7); ctx.fill();
    let dx = j.x - j.ox, dy = j.y - j.oy; const d = Math.hypot(dx, dy); if (d > j.R) { dx *= j.R / d; dy *= j.R / d; }
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(j.ox + dx, j.oy + dy, 20, 0, 7); ctx.fill();
  }

  // 마을 요청 말풍선: 마을 앞마당 왼쪽, 마을당 최대 2개(위·아래 칸)
  const BW = 56, BH = 46;
  function bubbleRect(r) { const v = r.vill; return { x: v.yard.x - BW - 6, y: v.slot.y + 2 + r.slot * 50, w: BW, h: BH }; }
  function ringColor(f) { return f > 0.5 ? '#46b04a' : f > 0.25 ? '#f2b632' : '#e5533d'; }
  function bubble(ctx, r) {
    const b = bubbleRect(r), f = r.left / r.limit;
    let a = 1, dy = 0, sc = 1;
    if (r.state !== 'open') { a = Math.max(0, 1 - r.endT / 0.6); dy = -r.endT * 20; }
    else if (r.t < 0.25) sc = 0.6 + 1.6 * r.t;                          // 등장: 톡 튀어나옴
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2 + dy); ctx.scale(sc, sc); ctx.translate(-b.w / 2, -b.h / 2);
    const danger = r.state === 'open' && f <= 0.25 && Math.floor(r.t * 4) % 2 === 0;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(2, 3, b.w, b.h);
    ctx.fillStyle = r.state === 'expired' ? '#ffd6d0' : '#fffdf6'; ctx.fillRect(0, 0, b.w, b.h);
    ctx.fillStyle = danger ? '#e5533d' : r.urgent ? '#e5533d' : '#3a3a3a';           // 테두리
    ctx.fillRect(0, 0, b.w, 2); ctx.fillRect(0, b.h - 2, b.w, 2); ctx.fillRect(0, 0, 2, b.h); ctx.fillRect(b.w - 2, 0, 2, b.h);
    ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.moveTo(b.w - 2, 14); ctx.lineTo(b.w + 6, 19); ctx.lineTo(b.w - 2, 24); ctx.fill();   // 꼬리(마을 쪽)
    const cx = b.w / 2, cy = 17;
    ctx.lineWidth = 3; ctx.strokeStyle = '#ddd6c4'; ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke();
    if (r.state === 'open') { ctx.strokeStyle = ringColor(f); ctx.beginPath(); ctx.arc(cx, cy, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke(); }
    ctx.lineWidth = 1;
    if (!r.fraud) G.icons.draw(ctx, r.item, cx, cy, 18);
    T(ctx, r.price + '만원', cx, 38, 12, '#4a3f2a');
    if (r.fraud) {                                                   // 미납: 빈 상자 / 불량: 부서진 상자
      ctx.fillStyle = '#c9a26b'; ctx.fillRect(cx - 9, cy - 2, 18, 11); ctx.fillStyle = '#a07f4f'; ctx.fillRect(cx - 9, cy - 2, 18, 2);
      if (r.fraud === 'empty') { ctx.fillStyle = '#5a4630'; ctx.fillRect(cx - 7, cy, 14, 7); ctx.fillStyle = '#c9a26b'; ctx.fillRect(cx - 12, cy - 8, 8, 3); ctx.fillRect(cx + 4, cy - 8, 8, 3); }
      else { ctx.fillStyle = '#5a4630'; ctx.fillRect(cx - 2, cy - 2, 2, 11); ctx.fillRect(cx + 2, cy + 3, 5, 2); ctx.fillStyle = '#7d7d7d'; ctx.fillRect(cx - 12, cy + 6, 4, 3); ctx.fillRect(cx + 9, cy + 5, 3, 3); }
    } else if (r.state === 'expired') { ctx.strokeStyle = '#e5533d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 9, cy - 9); ctx.lineTo(cx + 9, cy + 9); ctx.moveTo(cx + 9, cy - 9); ctx.lineTo(cx - 9, cy + 9); ctx.stroke(); ctx.lineWidth = 1; }
    ctx.restore();
  }
  function bubbles(ctx, S) { for (const r of S.requests) bubble(ctx, r); }
  return { panel, button, clicked, hud, joystick, bubbles, bubbleRect, PAUSE_BTN };
})();
