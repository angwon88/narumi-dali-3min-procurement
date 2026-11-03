/* 화면 전환: title → play ⇄ pause → end(1.5초) → result */
'use strict';
G.S = null;              // 한 판의 상태
G.screen = 'boot';
G.screens = (() => {
  const C = G.C, W = C.VIEW.w, H = C.VIEW.h, T = (...a) => G.world.text(...a), ui = G.ui;
  let endT = 0;

  function newGame() {
    G.S = { timeLeft: C.GAME_SECONDS, elapsed: 0, floats: [], bagCap: C.BAG_START, scoreMult: 1 };
    G.score.init(G.S); G.levelup.init(G.S); G.requests.init(G.S); G.shops.init(G.S); G.villages.init(G.S); G.director.init(G.S); G.gifts.init(G.S); G.events.init(G.S); G.broker.init(G.S); G.missions.init(G.S); G.ult.init(G.S);
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
  const BTN_START = { x: 300 - 110, y: 362, w: 220, h: 48 };   // 2026-11-03 왼쪽 단
  const BTN_INTRO = { x: 300 - 70, y: 420, w: 140, h: 30 };            // 상황 소개 다시 보기
  const BTN_SOUND = { x: W - 118, y: 12, w: 106, h: 30 };              // 소리 켜기/끄기 (휴대폰용, 2026-11-03)
  const soundLabel = () => G.audio.isMuted() ? '소리 켜기' : '소리 끄기';
  const BTN_MUSIC = { x: W - 118, y: 48, w: 106, h: 30 };
  const musicLabel = () => G.music.isOff() ? '음악 켜기' : '음악 끄기';
  const BTN_ULT = { x: W - 158, y: 84, w: 146, h: 30 }, BTN_ULTQ = { x: W - 190, y: 84, w: 28, h: 30 };
  const ultLabel = () => G.settings.ultAuto ? 'AI 조사: 자동 사용' : 'AI 조사: 직접 사용(Q)';
  let ultTipOn = false;                                                // [?]를 누르면 설명을 켜고 끔 (휴대폰용)
  function titleUpdate() {
    if (ui.clicked(BTN_SOUND)) { G.audio.toggle(); return; }
    if (ui.clicked(BTN_MUSIC)) { G.music.toggle(); return; }
    if (ui.clicked(BTN_ULT)) { G.ult.toggleAuto(); return; }
    if (ui.clicked(BTN_ULTQ)) { ultTipOn = !ultTipOn; return; }
    if (ui.clicked(BTN_INTRO)) { G.intro.start(() => { G.screen = 'title'; }); return; }
    if (ui.clicked(BTN_START) || G.input.hit('enter') || G.input.hit(' ')) { if (G.intro.seen()) newGame(); else G.intro.start(newGame); }
  }
  function ciPlate(ctx, key, cx, y, h) {
    const im = G.img[key]; if (!im || !im.naturalWidth) return;
    const w = im.naturalWidth * h / im.naturalHeight;
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - w / 2 - 10, y - 6, w + 20, h + 12);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(im, cx - w / 2, y, w, h); ctx.imageSmoothingEnabled = false;
  }
  // 이 게임에 담긴 조달청 제도 (2026-11-02 주제 가시성): 결과 화면 '실제로는?' 태그와 같은 색
  // 2026-11-03 그래픽 상향: 왼쪽 = 제목·5대 임무·버튼, 오른쪽 = 공식 3D 나르미·달이 (공모전 제공 이미지)
  const LX = 300;                                                       // 왼쪽 단 가운데
  function titleMissions(ctx) {
    const y0 = 214;
    T(ctx, '조달관 5대 임무', LX, y0, 12, '#ffe48a');
    G.missions.LIST.forEach((m, i) => {
      const y = y0 + 14 + i * 25, x = LX - 150;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 2, y + 3, 300, 21);
      ctx.fillStyle = 'rgba(255,253,246,.94)'; ctx.fillRect(x, y, 300, 21);
      ctx.fillStyle = m.col; ctx.fillRect(x, y, 26, 21);
      T(ctx, String(i + 1), x + 13, y + 11, 12, '#fff');
      G.icons.draw(ctx, m.icon, x + 40, y + 10, 16);
      ctx.font = '12px "Galmuri11 Bold", ' + G.FONT; ctx.fillStyle = m.col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(m.name, x + 54, y + 11);
    });
  }
  // 타이틀 배경: 이미지 AI 일러스트를 한 번만 살짝 흐리게 만들어 둠 (간판 글자가 덜 보이게)
  let bgCache = null;
  function titleBg(ctx) {
    const im = G.img.title_bg;
    if (!im || !im.naturalWidth) { G.world.draw(ctx); return false; }
    if (!bgCache) {
      bgCache = document.createElement('canvas'); bgCache.width = W; bgCache.height = H;
      const g = bgCache.getContext('2d'); g.filter = 'blur(2.5px)'; g.drawImage(im, -8, -8, W + 16, H + 16); g.filter = 'none';
    }
    ctx.drawImage(bgCache, 0, 0); return true;
  }
  function titleDraw(ctx, t) {
    const art = titleBg(ctx);
    const g = ctx.createLinearGradient(0, 0, W, 0);                     // 왼쪽은 어둡게(글자), 오른쪽은 밝게(마스코트)
    g.addColorStop(0, art ? 'rgba(16,24,36,.8)' : 'rgba(16,24,36,.86)'); g.addColorStop(0.5, art ? 'rgba(16,24,36,.45)' : 'rgba(16,24,36,.6)'); g.addColorStop(1, art ? 'rgba(30,60,100,.12)' : 'rgba(30,60,100,.35)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 오른쪽: 빛 원 + 3D 마스코트 (둥실둥실)
    const im = G.img.mascot3d, bob = Math.sin(t * 2) * 4;
    ctx.fillStyle = 'rgba(255,240,180,.16)'; ctx.beginPath(); ctx.ellipse(722, 300, 220, 170, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,180,.12)'; ctx.beginPath(); ctx.ellipse(722, 300, 170, 130, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(722, 452, 170, 16, 0, 0, 7); ctx.fill();
    if (im && im.naturalWidth) { const h = 320, w = im.naturalWidth * h / im.naturalHeight; ctx.imageSmoothingEnabled = true; ctx.drawImage(im, 722 - w / 2, 130 + bob, w, h); ctx.imageSmoothingEnabled = false; }
    else { G.spr.drawChar(ctx, 'narmi', 'walk', 's', t, 700, 380, 1.6); G.spr.drawChar(ctx, 'dali', 'walk', 's', t, 790, 380, 1.6); }
    // 왼쪽: CI · 제목 · 임무 · 버튼
    ciPlate(ctx, 'ci_h', LX, 26, 28);
    ctx.font = '36px "Galmuri11 Bold", ' + G.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2f4f8a'; ctx.fillText('나르미와 달이의', LX + 3, 108 + 3);
    ctx.fillStyle = '#fff'; ctx.fillText('나르미와 달이의', LX, 108);
    ctx.font = '56px "Galmuri11 Bold", ' + G.FONT;
    ctx.fillStyle = '#2f4f8a'; ctx.fillText('2분 조달작전', LX + 4, 164 + 4);
    ctx.fillStyle = '#ffd84a'; ctx.fillText('2분 조달작전', LX, 164);
    titleMissions(ctx);
    ui.button(ctx, BTN_START, '작전 시작', { size: 20 });
    ui.button(ctx, BTN_INTRO, '소개 다시 보기', { size: 12, fill: '#cfd8e3', hot: '#fff' });
    ui.button(ctx, BTN_SOUND, soundLabel(), { size: 12, fill: '#cfd8e3', hot: '#fff' });
    ui.button(ctx, BTN_MUSIC, musicLabel(), { size: 12, fill: '#cfd8e3', hot: '#fff' });
    ui.button(ctx, BTN_ULT, ultLabel(), { size: 12, fill: '#a9e3f2', hot: '#fff' });
    ui.button(ctx, BTN_ULTQ, '?', { size: 16, fill: '#ffd84a', hot: '#fff3a0' });
    if (ultTipOn || ui.hover(BTN_ULT) || ui.hover(BTN_ULTQ)) ui.tip(ctx, BTN_ULTQ.x - 170, BTN_ULT.y + BTN_ULT.h + 6, ui.ULT_TIP);
    const best = G.store.get('best', 0);
    if (best) T(ctx, '최고 점수 ' + best + ' · 최고 등급 ' + G.store.get('bestGrade', '-'), W - 20, H - 20, 12, '#ffe48a', 'right');
    if (G.VERSION) T(ctx, G.VERSION, 16, H - 20, 12, '#8fa3b8', 'left');
    T(ctx, '터치·클릭으로 이동 · Space 브로커 · Enter 시작 · M 소리', LX, H - 44, 12, '#cfd8e3');
    if (G.input.hit('m')) G.audio.toggle();
  }

  // ---------- 플레이 ----------
  function playUpdate(dt) {
    if (G.input.hit('escape') || G.input.hit('p') || ui.clicked(ui.PAUSE_BTN)) { G.screen = 'pause'; return; }
    if (G.input.hit('m')) { const m = G.audio.toggle(); G.fx.add(G.S, W / 2, 200, m ? '소리 끔 (M)' : '소리 켬 (M)', '#cfd8e3', 16); }
    if (G.debug && G.debug.update()) return;
    if (G.S.hitStop > 0) { G.S.hitStop -= dt; return; }              // 적발 순간 한순간 멈춤
    G.dali.update(dt);
    G.ult.input(G.S);
    G.nav.handleTaps(G.S);
    step(G.S, dt);
    if (G.screen === 'play' && G.S.pendingLevels > 0) G.levelup.open(G.S);   // 레벨업: 시간 정지하고 카드 선택
  }
  // 달이 이동을 뺀 한 프레임 진행 (debug.js의 시간 건너뛰기도 이것을 쓴다)
  function step(S, dt) {
    S.timeLeft -= dt; S.elapsed += dt;
    G.director.update(S, dt);
    G.requests.update(S, dt);
    G.narmi.update(dt, S);
    G.broker.update(S, dt);
    G.missions.update(S, dt);
    G.ult.update(S, dt);
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
    G.missions.drawOffice(ctx, G.S);                                    // 조달청 업적 메달
    G.narmi.draw(ctx);
    G.nav.draw(ctx);
    G.dali.draw(ctx);
    ui.bubbles(ctx, G.S);
    ui.checks(ctx, G.S);
    G.events.drawCallout(ctx, G.S);
    G.broker.draw(ctx, G.S);
    G.dali.drawOver(ctx, G.S);
    G.shops.drawDoorInfo(ctx, G.S);
    G.shops.drawHover(ctx, G.S);
    G.fx.draw(ctx, G.S);
    G.events.drawOverlay(ctx, G.S);
    G.ult.draw(ctx, G.S);
    G.broker.drawSanction(ctx, G.S);
    G.missions.drawStamp(ctx, G.S);
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
    G.ult.drawTip(ctx);
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
  const BTN_PSOUND = { x: W / 2 - 90, y: 388, w: 88, h: 36 }, BTN_PMUSIC = { x: W / 2 + 2, y: 388, w: 88, h: 36 }, BTN_PULT = { x: W / 2 - 90, y: 432, w: 180, h: 32 }, BTN_PULTQ = { x: W / 2 + 96, y: 432, w: 28, h: 32 };
  function pauseUpdate() {
    if (G.input.hit('escape') || G.input.hit('p') || ui.clicked(BTN_RESUME)) G.screen = 'play';
    else if (ui.clicked(BTN_RESTART)) newGame();
    else if (ui.clicked(BTN_TITLE)) G.screen = 'title';
    else if (ui.clicked(BTN_PSOUND)) G.audio.toggle();
    else if (ui.clicked(BTN_PULT)) G.ult.toggleAuto();
    else if (ui.clicked(BTN_PULTQ)) ultTipOn = !ultTipOn;
    else if (ui.clicked(BTN_PMUSIC)) G.music.toggle();
  }
  function pauseDraw(ctx) {
    playDraw(ctx);
    ctx.fillStyle = 'rgba(10,14,20,.7)'; ctx.fillRect(0, 0, W, H);
    T(ctx, '잠깐 쉬는 중', W / 2, 170, 28, '#fff');
    ui.button(ctx, BTN_RESUME, '계속'); ui.button(ctx, BTN_RESTART, '처음부터'); ui.button(ctx, BTN_TITLE, '타이틀로');
    ui.button(ctx, BTN_PSOUND, soundLabel(), { size: 12, fill: '#cfd8e3', hot: '#fff' });
    ui.button(ctx, BTN_PMUSIC, musicLabel(), { size: 12, fill: '#cfd8e3', hot: '#fff' });
    ui.button(ctx, BTN_PULT, ultLabel(), { size: 12, fill: '#a9e3f2', hot: '#fff' });
    ui.button(ctx, BTN_PULTQ, '?', { size: 16, fill: '#ffd84a', hot: '#fff3a0' });
    if (ultTipOn || ui.hover(BTN_PULT) || ui.hover(BTN_PULTQ)) ui.tip(ctx, W / 2 - 150, 248, ui.ULT_TIP);
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
