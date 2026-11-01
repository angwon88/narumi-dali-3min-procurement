/* 화면 전환: title → play ⇄ pause → end(1.5초) → result */
'use strict';
G.S = null;              // 한 판의 상태
G.screen = 'boot';
G.screens = (() => {
  const C = G.C, W = C.VIEW.w, H = C.VIEW.h, T = (...a) => G.world.text(...a), ui = G.ui;
  let endT = 0;

  function newGame() {
    G.S = { timeLeft: C.GAME_SECONDS, elapsed: 0, floats: [], bagCap: C.BAG_START, scoreMult: 1 };
    G.score.init(G.S); G.requests.init(G.S); G.shops.init(G.S); G.villages.init(G.S); G.director.init(G.S);
    G.dali.reset(); G.narmi.reset(); G.input.reset();
    G.screen = 'play';
  }
  function finish() {
    const best = G.store.get('best', 0);
    G.S.newBest = G.S.score > best;
    if (G.S.newBest) G.store.set('best', G.S.score);
    G.screen = 'result';
  }

  // ---------- 타이틀 ----------
  const BTN_START = { x: W / 2 - 100, y: 360, w: 200, h: 48 };
  function titleUpdate() {
    if (ui.clicked(BTN_START) || G.input.hit('enter') || G.input.hit(' ')) newGame();
  }
  function ciPlate(ctx, key, cx, y, h) {
    const im = G.img[key]; if (!im || !im.naturalWidth) return;
    const w = im.naturalWidth * h / im.naturalHeight;
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - w / 2 - 10, y - 6, w + 20, h + 12);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(im, cx - w / 2, y, w, h); ctx.imageSmoothingEnabled = false;
  }
  function titleDraw(ctx, t) {
    G.world.draw(ctx);
    ctx.fillStyle = 'rgba(16,24,36,.62)'; ctx.fillRect(0, 0, W, H);
    ciPlate(ctx, 'ci_h', W / 2, 28, 30);
    ctx.font = '40px "Galmuri11 Bold", ' + G.FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2f4f8a'; ctx.fillText('나르미와 달이의', W / 2 + 3, 126 + 3);
    ctx.fillStyle = '#fff'; ctx.fillText('나르미와 달이의', W / 2, 126);
    ctx.font = '56px "Galmuri11 Bold", ' + G.FONT;
    ctx.fillStyle = '#2f4f8a'; ctx.fillText('3분 조달작전', W / 2 + 4, 186 + 4);
    ctx.fillStyle = '#ffd84a'; ctx.fillText('3분 조달작전', W / 2, 186);
    G.spr.drawChar(ctx, 'narmi', 'walk', 's', t, W / 2 - 60, 330, 1.25);
    G.spr.drawChar(ctx, 'dali', 'walk', 's', t, W / 2 + 60, 330, 1.25);
    ui.button(ctx, BTN_START, '작전 시작', { size: 20 });
    const best = G.store.get('best', 0);
    if (best) T(ctx, '최고 점수 ' + best, W - 20, H - 20, 12, '#ffe48a', 'right');
    T(ctx, '방향키/WASD 이동 · Enter 시작', W / 2, H - 20, 12, '#cfd8e3');
  }

  // ---------- 플레이 ----------
  function playUpdate(dt) {
    if (G.input.hit('escape') || G.input.hit('p') || ui.clicked(ui.PAUSE_BTN)) { G.screen = 'pause'; return; }
    if (G.debug && G.debug.update()) return;
    G.dali.update(dt);
    G.shops.handleInspectInput(G.S);
    step(G.S, dt);
  }
  // 달이 이동을 뺀 한 프레임 진행 (debug.js의 시간 건너뛰기도 이것을 쓴다)
  function step(S, dt) {
    S.timeLeft -= dt; S.elapsed += dt;
    G.director.update(S, dt);
    G.requests.update(S, dt);
    G.narmi.update(dt, S);
    G.shops.update(S, dt);
    G.requests.deliver(S);
    G.villages.update(S, dt);
    G.fx.update(S, dt);
    if (S.timeLeft <= 0) { S.timeLeft = 0; G.screen = 'end'; endT = C.END_HOLD; }
  }
  function playDraw(ctx) {
    G.world.draw(ctx);
    G.shops.draw(ctx, G.S);
    G.villages.draw(ctx, G.S);
    G.narmi.draw(ctx);
    G.dali.draw(ctx);
    ui.bubbles(ctx, G.S);
    G.dali.drawOver(ctx, G.S);
    G.shops.drawHover(ctx, G.S);
    G.fx.draw(ctx, G.S);
    G.villages.dangerEdge(ctx, G.S);
    G.director.draw(ctx, G.S);
    ui.hud(ctx, G.S);
    if (G.debug) G.debug.draw(ctx);
    ui.joystick(ctx);
    const tl = G.S.timeLeft;                                   // 마지막 10초 카운트다운
    if (tl > 0 && tl <= 10 && G.screen === 'play') {
      const n = Math.ceil(tl), f = tl - Math.floor(tl);
      ctx.globalAlpha = 0.35 + 0.5 * f; T(ctx, String(n), W / 2, H / 2, 72 + 24 * f, '#fff'); ctx.globalAlpha = 1;
    }
  }

  // ---------- 일시정지 ----------
  const BTN_RESUME = { x: W / 2 - 90, y: 220, w: 180, h: 44 };
  const BTN_RESTART = { x: W / 2 - 90, y: 276, w: 180, h: 44 };
  const BTN_TITLE = { x: W / 2 - 90, y: 332, w: 180, h: 44 };
  function pauseUpdate() {
    if (G.input.hit('escape') || G.input.hit('p') || ui.clicked(BTN_RESUME)) G.screen = 'play';
    else if (ui.clicked(BTN_RESTART)) newGame();
    else if (ui.clicked(BTN_TITLE)) G.screen = 'title';
  }
  function pauseDraw(ctx) {
    playDraw(ctx);
    ctx.fillStyle = 'rgba(10,14,20,.7)'; ctx.fillRect(0, 0, W, H);
    T(ctx, '잠깐 쉬는 중', W / 2, 170, 28, '#fff');
    ui.button(ctx, BTN_RESUME, '계속'); ui.button(ctx, BTN_RESTART, '처음부터'); ui.button(ctx, BTN_TITLE, '타이틀로');
  }

  // ---------- 작전 종료 → 결과 ----------
  function endUpdate(dt) { endT -= dt; if (endT <= 0) finish(); }
  function endDraw(ctx) {
    playDraw(ctx);
    ctx.fillStyle = 'rgba(10,14,20,.5)'; ctx.fillRect(0, 0, W, H);
    T(ctx, '작전 종료!', W / 2 + 3, H / 2 + 3, 48, '#2f4f8a'); T(ctx, '작전 종료!', W / 2, H / 2, 48, '#ffd84a');
  }
  const BTN_AGAIN = { x: W / 2 - 210, y: 400, w: 200, h: 46 };
  const BTN_HOME = { x: W / 2 + 10, y: 400, w: 200, h: 46 };
  function resultUpdate() {
    if (ui.clicked(BTN_AGAIN) || G.input.hit('enter')) newGame();
    else if (ui.clicked(BTN_HOME) || G.input.hit('escape')) G.screen = 'title';
  }
  function resultDraw(ctx) {
    ctx.fillStyle = '#1e2a3a'; ctx.fillRect(0, 0, W, H);
    T(ctx, '작전 종료!', W / 2, 70, 36, '#ffd84a');
    T(ctx, '점수 ' + G.S.score + (G.S.newBest ? '  (최고 기록!)' : ''), W / 2, 130, 20, '#fff');
    T(ctx, '배달 ' + G.S.delivered + '건 · 아낀 세금 ' + G.S.saved + '만원 · 마을 신뢰 ' + Math.round(G.S.trust), W / 2, 180, 16, '#cfe3f5');
    T(ctx, '(기록 카드와 조달 메시지는 11번 작업에서 채운다)', W / 2, 220, 12, '#8fa3b8');
    T(ctx, '필요한 것을, 공정하게, 효율적으로, 필요한 곳에 제때 — 그게 조달입니다.', W / 2, 340, 16, '#fff');
    ui.button(ctx, BTN_AGAIN, '다시 하기'); ui.button(ctx, BTN_HOME, '타이틀로');
    ciPlate(ctx, 'ci_h', W / 2, 482, 26);
  }

  const table = {
    title: [titleUpdate, titleDraw], play: [playUpdate, playDraw], pause: [pauseUpdate, pauseDraw],
    end: [endUpdate, endDraw], result: [resultUpdate, resultDraw],
  };
  return {
    newGame, step,
    update(dt) { const f = table[G.screen]; if (f) f[0](dt); },
    draw(ctx, t) { const f = table[G.screen]; if (f) f[1](ctx, t); },
    autoPause() { if (G.screen === 'play') G.screen = 'pause'; },
  };
})();
