/* 마을 상태: 요청 실패 시 8초 피해 연출, 납품 시 기쁨, 상태 얼굴 (기획서 3.5)
   그림은 임시 픽셀아트(코드로 그림). */
'use strict';
G.villages = (() => {
  const C = G.C, HURT = 8, HAPPY = 6;
  function init(S) {
    S.vstate = {};
    for (const v of G.world.villages) S.vstate[v.id] = { hurtT: 0, happyT: 0, t: 0 };
  }
  function onFail(S, vid) { const s = S.vstate[vid]; s.hurtT = HURT; s.happyT = 0; S.stats.villageHurt = (S.stats.villageHurt || 0) + 1; }
  function onSuccess(S, vid) { const s = S.vstate[vid]; if (s.hurtT <= 0) s.happyT = HAPPY; }
  function update(S, dt) {
    for (const s of Object.values(S.vstate)) { s.t += dt; s.hurtT = Math.max(0, s.hurtT - dt); s.happyT = Math.max(0, s.happyT - dt); }
  }

  // ---------- 작은 그림들 ----------
  function person(ctx, x, y, body, sit) {             // (x, y) = 발. 8×14 주민
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x - 4, y - 1, 9, 2);
    if (sit) {
      ctx.fillStyle = body; ctx.fillRect(x - 4, y - 7, 8, 6); ctx.fillRect(x - 4, y - 3, 10, 3);
      ctx.fillStyle = '#f2c79b'; ctx.fillRect(x - 3, y - 12, 6, 5);
      ctx.fillStyle = '#4a3020'; ctx.fillRect(x - 3, y - 13, 6, 2);
      return;
    }
    ctx.fillStyle = '#3b3b48'; ctx.fillRect(x - 3, y - 5, 2, 5); ctx.fillRect(x + 1, y - 5, 2, 5);
    ctx.fillStyle = body; ctx.fillRect(x - 4, y - 11, 8, 7);
    ctx.fillStyle = '#f2c79b'; ctx.fillRect(x - 3, y - 16, 6, 5);
    ctx.fillStyle = '#4a3020'; ctx.fillRect(x - 3, y - 17, 6, 2);
  }
  function face(ctx, x, y, mood) {                     // 지름 16 얼굴 배지: 1 웃음 · 0 보통 · -1 울상
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mood > 0 ? '#ffd84a' : mood < 0 ? '#9fb3c8' : '#f3e4b0';
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 4, y - 3, 2, 2); ctx.fillRect(x + 2, y - 3, 2, 2);
    if (mood > 0) { ctx.fillRect(x - 4, y + 2, 2, 1); ctx.fillRect(x - 2, y + 3, 4, 1); ctx.fillRect(x + 2, y + 2, 2, 1); }
    else if (mood < 0) { ctx.fillRect(x - 4, y + 4, 2, 1); ctx.fillRect(x - 2, y + 3, 4, 1); ctx.fillRect(x + 2, y + 4, 2, 1); ctx.fillStyle = '#5ec8f2'; ctx.fillRect(x + 5, y - 1, 2, 3); }
    else ctx.fillRect(x - 3, y + 3, 6, 1);
  }
  function darkWindows(ctx, b) { ctx.fillStyle = '#3b4250'; for (let i = 0; i < 4; i++) ctx.fillRect(b.x + 16 + i * 36, b.y + 40, 22, 18); }

  function draw(ctx, S) {
    for (const v of G.world.villages) {
      const s = S.vstate[v.id], b = v.body, y = v.yard, hurt = s.hurtT > 0;
      const blink = Math.floor(s.t * 3) % 2 === 0;
      if (v.id === 'fire') {                         // 경광등: 평소 빨강 깜빡, 피해 시 회색
        ctx.fillStyle = hurt ? '#7d7d7d' : blink ? '#ff3b30' : '#a8231b';
        ctx.fillRect(b.x + b.w - 30, b.y - 6, 10, 7);
      }
      if (hurt) {
        const fade = Math.min(1, s.hurtT / 0.5);      // 마지막 0.5초 서서히 회복
        ctx.globalAlpha = fade;
        if (v.id === 'school') {
          darkWindows(ctx, b);
          person(ctx, y.x + 22, y.y + 84, '#e86a5c', true); person(ctx, y.x + 40, y.y + 90, '#5b8fb9', true);
          G.world.text(ctx, '…', y.x + 31, y.y + 64, 12, '#fff');
        } else if (v.id === 'clinic') {
          [0, 1, 2].forEach(i => person(ctx, y.x + 48 - i * 15, y.y + 90, ['#7aa36b', '#c98a5a', '#8b7ab8'][i]));
          ctx.fillStyle = '#5ec8f2'; if (blink) ctx.fillRect(y.x + 52, y.y + 70, 2, 3);
          G.world.text(ctx, '대기 중', y.x + 30, y.y + 60, 12, '#fff');
        } else if (v.id === 'fire') {
          ctx.fillStyle = '#7d8590'; ctx.fillRect(b.x + 2, b.y + 56, 30, 44);
          ctx.fillStyle = '#6a7179'; for (let k = 0; k < 6; k++) ctx.fillRect(b.x + 2, b.y + 60 + k * 7, 30, 2);
          darkWindows(ctx, b);
        } else if (v.id === 'library') {
          darkWindows(ctx, b);
          ctx.fillStyle = '#fffdf6'; ctx.fillRect(b.x - 2, b.y + 70, 34, 16);
          ctx.fillStyle = '#3a3a3a'; ctx.fillRect(b.x + 14, b.y + 64, 2, 6);
          G.world.text(ctx, '휴관', b.x + 15, b.y + 79, 12, '#d9342b');
        }
        ctx.globalAlpha = 1;
      }
      face(ctx, b.x + b.w - 12, b.y + 11, hurt ? -1 : s.happyT > 0 ? 1 : 0);
    }
  }

  // 신뢰도 위기: 화면 가장자리가 붉게 맥박친다
  function dangerEdge(ctx, S) {
    if (S.trust > C.TRUST_DANGER) return;
    const W = C.VIEW.w, H = C.VIEW.h, top = C.HUD_H, k = 0.25 + 0.2 * Math.sin(S.elapsed * 6), D = 46;
    const edge = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(229,60,45,' + k + ')'); g.addColorStop(1, 'rgba(229,60,45,0)');
      ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh);
    };
    edge(0, top, 0, top + D, 0, top, W, D);
    edge(0, H, 0, H - D, 0, H - D, W, D);
    edge(0, 0, D, 0, 0, top, D, H - top);
    edge(W, 0, W - D, 0, W - D, top, D, H - top);
  }
  return { init, update, onFail, onSuccess, draw, dangerEdge };
})();
