/* 부트스트랩 · 고정 간격 루프 · 화면 맞춤 */
'use strict';
(() => {
  const C = G.C, cv = document.getElementById('game'), ctx = cv.getContext('2d');
  G.canvas = cv; G.ctx = ctx;
  G.input.bind(cv);

  function fit() {                                   // 비율 유지 확대(레터박스)
    const s = Math.min(innerWidth / C.VIEW.w, innerHeight / C.VIEW.h);
    cv.style.width = Math.floor(C.VIEW.w * s) + 'px';
    cv.style.height = Math.floor(C.VIEW.h * s) + 'px';
  }
  addEventListener('resize', fit); fit();
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.screens.autoPause(); });
  addEventListener('blur', () => G.screens.autoPause());

  let last = 0, acc = 0, clock = 0;
  function frame(now) {
    const dtReal = Math.min(0.25, (now - (last || now)) / 1000); last = now;
    acc += dtReal; let steps = 0;
    while (acc >= C.DT && steps < 5) { G.screens.update(C.DT); G.input.endFrame(); acc -= C.DT; steps++; clock += C.DT; }
    if (steps === 5) acc = 0;
    ctx.imageSmoothingEnabled = false;
    G.screens.draw(ctx, clock);
    requestAnimationFrame(frame);
  }
  ctx.fillStyle = '#1e2a3a'; ctx.fillRect(0, 0, C.VIEW.w, C.VIEW.h);
  G.loadAssets(() => { G.screen = 'title'; requestAnimationFrame(frame); });
})();
