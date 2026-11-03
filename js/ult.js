/* 필살기 "AI 데이터 일제 조사" (2026-11-03): 브로커를 ULT_NEED명 적발하면 충전 → 쓸모 있는 순간 자동 발동(Q·HUD 버튼으로 바로도 가능).
   발동하면 나르미의 데이터 스캔 빛이 화면을 왼쪽→오른쪽으로 훑으며
   - 모든 페이퍼컴퍼니 적발 · 등록 심사 중인 새 공방 실사 통과 · 달리는 브로커 적발
   - 이후 ULT_BROKER_PAUSE초 동안 브로커가 나오지 않음
   실제 근거: 조달청은 2026년 11월부터 데이터 분석으로 페이퍼컴퍼니 의심 업체를 골라 입찰보증금을 물림(기획서 부록 B). */
'use strict';
G.ult = (() => {
  const C = G.C, T = (...a) => G.world.text(...a);
  const BTN = { x: 732, y: 5, w: 72, h: 34 };
  function init(S) { S.ultCharge = 0; S.ultFx = null; S.ultLock = false; S.brokerPauseUntil = 0; }
  const ready = S => S.ultCharge >= C.ULT_NEED;
  function charge(S) {
    if (S.ultLock || ready(S)) return;
    S.ultCharge++;
    if (ready(S)) {
      G.narmi.say('데이터가 모였어요! 수상한 곳이 보이면 바로 일제 조사!', 2.6);
      G.audio.play('gift');
    }
  }
  function input(S) {
    if (!(G.ui.clicked(BTN) || G.input.hit('q'))) return;
    if (S.ultFx) return;
    if (!ready(S)) { G.fx.add(S, BTN.x + BTN.w / 2, 60, '브로커를 ' + (C.ULT_NEED - S.ultCharge) + '명 더 적발하면 필살기!', '#cfd8e3'); return; }
    fire(S);
  }
  function fire(S) {
    S.ultCharge = 0; S.ultLock = true; S.ultFx = { t: 0, done: new Set() };
    S.stats.ult = (S.stats.ult || 0) + 1;
    S.score += C.ULT_SCORE; S.shakeT = 0.5;
    G.director.banner(S, '필살기! AI 데이터 일제 조사', '실제로도 조달청은 데이터로 페이퍼컴퍼니 의심 업체를 골라내요', { dur: 3, col: '#5ec8f2' });
    G.narmi.say('데이터 일제 조사 시작!', 1.6);
    G.audio.play('levelup'); G.audio.play('whoosh');
    const bk = S.bk;
    if (bk && (bk.state === 'run' || bk.state === 'grab')) G.broker.caught(S);
    S.brokerPauseUntil = S.elapsed + C.ULT_BROKER_PAUSE;
  }
  // 2026-11-03 똑똑한 자동 발동: 충전이 다 되면 쓸모 있는 순간(페이퍼컴퍼니가 있거나, 브로커가 달리거나, 심사 중인 새 공방이 2곳 이상)에 저절로. Q·버튼으로 바로 쓸 수도 있음
  function worth(S) {
    if (S.bk && (S.bk.state === 'run' || S.bk.state === 'grab')) return true;
    const open = S.shops.filter(sh => sh.status === 'open' && G.shops.isOpen(S, sh));
    return open.some(sh => sh.fake) || open.filter(sh => sh.isNew && !sh.verified && !sh.innov).length >= 2;
  }
  function update(S, dt) {
    if (!S.ultFx && ready(S) && worth(S)) fire(S);
    const u = S.ultFx; if (!u) return;
    u.t += dt;
    const bx = Math.min(1, u.t / C.ULT_SCAN) * C.VIEW.w;
    for (const sh of S.shops) {
      if (u.done.has(sh.idx) || sh.w.body.x + sh.w.body.w / 2 > bx) continue;
      u.done.add(sh.idx);
      if (sh.status === 'open' && G.shops.isOpen(S, sh) && (sh.fake || (sh.isNew && !sh.verified && !sh.innov))) { S.ultQuiet = true; G.shops.inspected(S, sh); S.ultQuiet = false; }
    }
    if (u.t > C.ULT_SCAN + 0.8) { S.ultFx = null; S.ultLock = false; }
  }
  // 스캔 빛 (화면 위층)
  function draw(ctx, S) {
    const u = S.ultFx; if (!u) return;
    const W = C.VIEW.w, H = C.VIEW.h, k = Math.min(1, u.t / C.ULT_SCAN), bx = k * W, fade = u.t > C.ULT_SCAN ? Math.max(0, 1 - (u.t - C.ULT_SCAN) / 0.8) : 1;
    ctx.save(); ctx.globalAlpha = 0.22 * fade; ctx.fillStyle = '#0b5d68'; ctx.fillRect(0, C.HUD_H, W, H - C.HUD_H);
    ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = '#5ec8f2';                    // 데이터 격자
    for (let x = 0; x < bx; x += 24) ctx.fillRect(x, C.HUD_H, 1, H - C.HUD_H);
    for (let y = C.HUD_H; y < H; y += 24) ctx.fillRect(0, y, bx, 1);
    if (k < 1) {                                                            // 스캔 빛줄기
      const g = ctx.createLinearGradient(bx - 60, 0, bx + 8, 0);
      g.addColorStop(0, 'rgba(94,200,242,0)'); g.addColorStop(1, 'rgba(200,245,255,.9)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(bx - 60, C.HUD_H, 68, H - C.HUD_H);
      ctx.fillStyle = '#fff'; ctx.fillRect(bx, C.HUD_H, 3, H - C.HUD_H);
    }
    ctx.restore();
  }
  // HUD 버튼: 브로커 적발 칸 3개, 다 차면 반짝
  function drawHud(ctx, S) {
    const r = ready(S), on = r && Math.floor((S.elapsed || 0) * 4) % 2 === 0;
    ctx.fillStyle = r ? (on ? '#5ec8f2' : '#2f9bd0') : '#2a3646'; ctx.fillRect(BTN.x, BTN.y, BTN.w, BTN.h);
    ctx.fillStyle = r ? '#fff' : '#3a4656'; ctx.fillRect(BTN.x, BTN.y, BTN.w, 2);
    T(ctx, r ? '자동 대기' : 'AI 조사', BTN.x + BTN.w / 2, BTN.y + 11, 12, r ? '#0b2a3a' : '#8fa3b8');
    for (let i = 0; i < C.ULT_NEED; i++) {
      const x = BTN.x + BTN.w / 2 - (C.ULT_NEED * 14 - 4) / 2 + i * 14, y = BTN.y + 20;
      ctx.fillStyle = i < S.ultCharge ? (r ? '#0b2a3a' : '#7a3fb0') : '#3a4656'; ctx.fillRect(x, y, 10, 9);
    }
  }
  return { init, charge, input, update, draw, drawHud, ready, BTN };
})();
