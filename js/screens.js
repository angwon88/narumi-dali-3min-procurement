/* 화면 전환: title → play ⇄ pause → end(1.5초) → result */
'use strict';
G.S = null;              // 한 판의 상태
G.screen = 'boot';
G.screens = (() => {
  const C = G.C, W = C.VIEW.w, H = C.VIEW.h, T = (...a) => G.world.text(...a), ui = G.ui;
  let endT = 0;

  function newGame() {
    G.S = { timeLeft: C.GAME_SECONDS, elapsed: 0, floats: [], bagCap: C.BAG_START, scoreMult: 1 };
    G.score.init(G.S); G.levelup.init(G.S); G.requests.init(G.S); G.shops.init(G.S); G.villages.init(G.S); G.director.init(G.S); G.gifts.init(G.S); G.events.init(G.S);
    G.dali.reset(); G.narmi.reset(); G.input.reset();
    G.screen = 'play';
  }
  function finish() {
    const best = G.store.get('best', 0);
    G.S.newBest = G.S.score > best;
    if (G.S.newBest) G.store.set('best', G.S.score);
    G.result.start(G.S);
    G.screen = 'result';
  }

  // ---------- 타이틀 ----------
  const BTN_START = { x: W / 2 - 100, y: 360, w: 200, h: 48 };
  function titleUpdate() {
    if (ui.clicked(BTN_START) || G.input.hit('enter') || G.input.hit(' ')) { if (G.intro.seen()) newGame(); else G.intro.start(newGame); }
  }
  function ciPlate(ctx, key, cx, y, h) {
    const im = G.img[key]; if (!im || !im.naturalWidth) return;
    const w = im.naturalWidth * h / im.naturalHeight;
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - w / 2 - 10, y - 6, w + 20, h + 12);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(im, cx - w / 2, y, w, h); ctx.imageSmoothingEnabled = false;
  }
  // 이 게임에 담긴 조달청 제도 (2026-11-02 주제 가시성): 결과 화면 '실제로는?' 태그와 같은 색
  const BADGES = [['계약 조건 · 검수', '#2f4f8a'], ['가성비 따지기', '#2e9b3a'], ['페이퍼컴퍼니 실사', '#d9342b'], ['혁신제품 시범구매', '#e0a800']];
  function titleBadges(ctx) {
    ctx.font = '12px ' + G.FONT;
    const pad = 12, gap = 8, ws = BADGES.map(([s]) => Math.ceil(ctx.measureText(s).width) + pad * 2);
    let x = W / 2 - (ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1)) / 2;
    const y = 232;
    BADGES.forEach(([s, col], i) => {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 2, y + 3, ws[i], 22);
      ctx.fillStyle = col; ctx.fillRect(x, y, ws[i], 22);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x, y, ws[i], 2);
      T(ctx, s, x + ws[i] / 2, y + 12, 12, '#fff');
      x += ws[i] + gap;
    });
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
    titleBadges(ctx);
    G.spr.drawChar(ctx, 'narmi', 'walk', 's', t, W / 2 - 60, 330, 1.25);
    G.spr.drawChar(ctx, 'dali', 'walk', 's', t, W / 2 + 60, 330, 1.25);
    ui.button(ctx, BTN_START, '작전 시작', { size: 20 });
    const best = G.store.get('best', 0);
    if (best) T(ctx, '최고 점수 ' + best, W - 20, H - 20, 12, '#ffe48a', 'right');
    T(ctx, '방향키/WASD 이동 · Enter 시작 · M 소리 ' + (G.audio.isMuted() ? '켜기' : '끄기'), W / 2, H - 20, 12, '#cfd8e3');
    if (G.input.hit('m')) G.audio.toggle();
  }

  // ---------- 플레이 ----------
  function playUpdate(dt) {
    if (G.input.hit('escape') || G.input.hit('p') || ui.clicked(ui.PAUSE_BTN)) { G.screen = 'pause'; return; }
    if (G.input.hit('m')) { const m = G.audio.toggle(); G.fx.add(G.S, W / 2, 200, m ? '소리 끔 (M)' : '소리 켬 (M)', '#cfd8e3', 16); }
    if (G.debug && G.debug.update()) return;
    if (G.S.hitStop > 0) { G.S.hitStop -= dt; return; }              // 적발 순간 한순간 멈춤
    G.dali.update(dt);
    G.shops.handleInspectInput(G.S);
    step(G.S, dt);
    if (G.screen === 'play' && G.S.pendingLevels > 0) G.levelup.open(G.S);   // 레벨업: 시간 정지하고 카드 선택
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
    G.gifts.update(S, dt);
    G.events.update(S, dt);
    S.comboT += dt;
    if (S.shakeT > 0) S.shakeT -= dt;
    if (S.flashT > 0) S.flashT -= dt;
    if (S.trust <= C.TRUST_DANGER) { S.warnT = (S.warnT || 0) - dt; if (S.warnT <= 0) { G.audio.play('warn'); S.warnT = 2; } } else S.warnT = 0;
    if (S.timeLeft <= 10 && Math.ceil(S.timeLeft) !== Math.ceil(S.timeLeft + dt)) G.audio.play('tick');
    G.fx.update(S, dt);
    if (S.timeLeft <= 0) { S.timeLeft = 0; G.screen = 'end'; endT = C.END_HOLD; G.audio.play('end'); }
  }
  function playDraw(ctx) {
    const S0 = G.S, shake = S0.shakeT > 0 ? S0.shakeT * 14 : 0;
    ctx.save(); if (shake) ctx.translate(Math.round((Math.random() - 0.5) * shake), Math.round((Math.random() - 0.5) * shake));
    G.world.draw(ctx);
    G.shops.draw(ctx, G.S);
    G.villages.draw(ctx, G.S);
    G.gifts.draw(ctx, G.S);
    G.events.drawWorld(ctx, G.S);
    G.narmi.draw(ctx);
    G.dali.draw(ctx);
    ui.bubbles(ctx, G.S);
    ui.checks(ctx, G.S);
    G.dali.drawOver(ctx, G.S);
    G.shops.drawDoorInfo(ctx, G.S);
    G.shops.drawHover(ctx, G.S);
    G.fx.draw(ctx, G.S);
    G.events.drawOverlay(ctx, G.S);
    ctx.restore();
    if (S0.flashT > 0) { ctx.fillStyle = 'rgba(255,216,74,' + (S0.flashT * 0.9).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }   // 혁신 성공 판정 금빛 번쩍임
    G.villages.dangerEdge(ctx, G.S);
    G.director.draw(ctx, G.S);
    ui.hud(ctx, G.S);
    ui.comboBadge(ctx, G.S);
    G.events.drawBoards(ctx, G.S);
    G.fx.drawParts(ctx, G.S);                                         // 파편·동전은 HUD 위로 (저금통까지 날아가게)
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
  const BTN_AGAIN = { x: W / 2 - 210, y: 454, w: 200, h: 40 };
  const BTN_HOME = { x: W / 2 + 10, y: 454, w: 200, h: 40 };
  function resultUpdate(dt) {
    G.result.update(dt);
    if (ui.clicked(BTN_AGAIN) || G.input.hit('enter')) newGame();
    else if (ui.clicked(BTN_HOME) || G.input.hit('escape')) G.screen = 'title';
  }
  function resultDraw(ctx) {
    G.result.draw(ctx, G.S);
    ui.button(ctx, BTN_AGAIN, '다시 하기'); ui.button(ctx, BTN_HOME, '타이틀로');
    ciPlate(ctx, 'ci_h', W / 2, 508, 22);
  }

  const table = {
    title: [titleUpdate, titleDraw], play: [playUpdate, playDraw], pause: [pauseUpdate, pauseDraw],
    intro: [dt => G.intro.update(dt), ctx => G.intro.draw(ctx)],
    levelup: [dt => G.levelup.update(dt), (ctx, t) => { playDraw(ctx); G.levelup.draw(ctx, t); }],
    end: [endUpdate, endDraw], result: [resultUpdate, resultDraw],
  };
  return {
    newGame, step,
    update(dt) { const f = table[G.screen]; if (f) f[0](dt); },
    draw(ctx, t) { const f = table[G.screen]; if (f) f[1](ctx, t); },
    autoPause() { if (G.screen === 'play') G.screen = 'pause'; },
  };
})();
