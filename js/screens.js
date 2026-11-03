/* 화면 전환: title → play ⇄ pause → end(1.5초) → result */
'use strict';
G.S = null;              // 한 판의 상태
G.screen = 'boot';
G.screens = (() => {
  const C = G.C, W = C.VIEW.w, H = C.VIEW.h, T = (...a) => G.world.text(...a), ui = G.ui;
  let endT = 0;

  function newGame() {
    G.S = { timeLeft: C.GAME_SECONDS, elapsed: 0, floats: [], bagCap: C.BAG_START, scoreMult: 1, hard: !!G.settings.hard };   // 하드 모드는 판 시작 때 고정
    G.score.init(G.S); G.levelup.init(G.S); G.requests.init(G.S); G.shops.init(G.S); G.villages.init(G.S); G.director.init(G.S); G.gifts.init(G.S); G.events.init(G.S); G.broker.init(G.S); G.missions.init(G.S); G.ult.init(G.S);
    G.dali.reset(); G.narmi.reset(); G.input.reset();
    G.screen = 'play';
  }
  function finish() {
    const key = G.S.hard ? 'best_hard' : 'best', best = G.store.get(key, 0);   // 최고 기록은 모드별
    G.S.newBest = G.S.score > best;
    if (G.S.newBest) G.store.set(key, G.S.score);
    G.result.start(G.S);
    G.screen = 'result';
  }

  // ---------- 타이틀 ----------
  // 2026-11-03 타이틀 다듬기: 3D 마스코트·일러스트와 어울리게 둥근 글꼴(Jua)·둥근 판·스티커 제목·알약 버튼
  const BTN_START = { x: 300 - 115, y: 398, w: 230, h: 56 };
  const BTN_INTRO = { x: 300 - 75, y: 464, w: 150, h: 32 };            // 상황 소개 다시 보기
  const BTN_SOUND = { x: W - 118, y: 14, w: 106, h: 30 };              // 소리 켜기/끄기 (휴대폰용)
  const soundLabel = () => G.audio.isMuted() ? '소리 켜기' : '소리 끄기';
  const BTN_MUSIC = { x: W - 118, y: 50, w: 106, h: 30 };
  const musicLabel = () => G.music.isOff() ? '음악 켜기' : '음악 끄기';
  const BTN_ULT = { x: W - 178, y: 86, w: 166, h: 30 }, BTN_ULTQ = { x: W - 214, y: 86, w: 30, h: 30 };
  const ultLabel = () => G.settings.ultAuto ? 'AI 조사: 자동 사용' : 'AI 조사: 직접 사용(Q)';
  const BTN_MODE = { x: W - 178, y: 122, w: 166, h: 30 };             // 2026-11-03 보통 / 하드 모드
  const modeLabel = () => G.settings.hard ? '하드 모드' : '보통 모드';
  const MODE_TIP = ['보통 / 하드 모드 (눌러서 바꾸기)', '보통: 필요한 물건 초록 테두리 · 구매 발판 깜빡임 · 남은 임무 알림', '하드: 힌트 없음 · 계약이 빡빡하고 브로커가 거세요', '      계약 시간 -32% · 브로커가 더 자주, 더 빠르게', '최고 기록은 모드별로 따로 저장돼요'];
  let ultTipOn = false;                                                // [?]를 누르면 설명을 켜고 끔 (휴대폰용)
  function titleUpdate() {
    if (ui.clicked(BTN_SOUND)) { G.audio.toggle(); return; }
    if (ui.clicked(BTN_MUSIC)) { G.music.toggle(); return; }
    if (ui.clicked(BTN_ULT)) { G.ult.toggleAuto(); return; }
    if (ui.clicked(BTN_ULTQ)) { ultTipOn = !ultTipOn; return; }
    if (ui.clicked(BTN_MODE)) { G.settings.hard = !G.settings.hard; G.store.set('hard', G.settings.hard); return; }
    if (ui.clicked(BTN_INTRO)) { G.intro.start(() => { G.screen = 'title'; }); return; }
    if (ui.clicked(BTN_START) || G.input.hit('enter') || G.input.hit(' ')) { if (G.intro.seen()) newGame(); else G.intro.start(newGame); }
  }
  const JF = '"Jua", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  function rr(ctx, x, y, w, h, r) {                                     // 둥근 사각형 경로
    r = Math.min(r, w / 2, h / 2); ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // 둥근 글꼴 글자. o.stroke = [색, 두께] 여러 겹(바깥부터)
  function J(ctx, s, x, y, size, fill, o = {}) {
    ctx.font = size + 'px ' + JF; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const [c, w] of o.stroke || []) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.strokeText(s, x, y); }
    ctx.fillStyle = fill; ctx.fillText(s, x, y); ctx.lineWidth = 1;
  }
  function softShadow(ctx, blur, oy, a) { ctx.shadowColor = 'rgba(40,28,10,' + a + ')'; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy; }
  const noShadow = ctx => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };
  // 알약 버튼: kind 'main'(주황) / 'sub'(흰 반투명) / 'q'(노란 원)
  function pill(ctx, r, label, kind, t) {
    const hot = ui.hover(r), main = kind === 'main';
    const sc = main ? 1 + Math.sin(t * 3) * 0.015 + (hot ? 0.03 : 0) : 1;
    ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(sc, sc); ctx.translate(-r.w / 2, -r.h / 2);
    const R = r.h / 2;
    if (main) {
      softShadow(ctx, 14, 6, .35); rr(ctx, 0, 4, r.w, r.h, R); ctx.fillStyle = '#c8641a'; ctx.fill(); noShadow(ctx);
      const g = ctx.createLinearGradient(0, 0, 0, r.h); g.addColorStop(0, hot ? '#ffe27a' : '#ffd451'); g.addColorStop(1, hot ? '#ffad3a' : '#ff9a26');
      rr(ctx, 0, 0, r.w, r.h, R); ctx.fillStyle = g; ctx.fill();
      rr(ctx, 8, 4, r.w - 16, r.h * 0.38, R * 0.7); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
      J(ctx, label, r.w / 2, r.h / 2 + 2, 28, '#fff', { stroke: [['#a8501a', 6]] });
    } else {
      softShadow(ctx, 8, 3, .25); rr(ctx, 0, 0, r.w, r.h, R); ctx.fillStyle = kind === 'q' ? (hot ? '#fff0a0' : '#ffd84a') : kind === 'hard' ? (hot ? '#ff7a6a' : '#e5533d') : kind === 'ult' ? (hot ? '#ffffff' : 'rgba(225,246,255,.92)') : (hot ? '#ffffff' : 'rgba(255,252,244,.88)'); ctx.fill(); noShadow(ctx);
      ctx.strokeStyle = kind === 'ult' ? 'rgba(47,140,190,.55)' : 'rgba(47,79,138,.25)'; ctx.lineWidth = 1.5; rr(ctx, .75, .75, r.w - 1.5, r.h - 1.5, R); ctx.stroke(); ctx.lineWidth = 1;
      J(ctx, label, r.w / 2, r.h / 2 + 1, kind === 'q' ? 18 : r.h >= 40 ? 21 : 15, kind === 'ult' ? '#1d5f85' : kind === 'hard' ? '#fff' : '#2f4f8a');
    }
    ctx.restore();
  }
  function ciPlate(ctx, key, cx, y, h) {
    const im = G.img[key]; if (!im || !im.naturalWidth) return;
    const w = im.naturalWidth * h / im.naturalHeight;
    softShadow(ctx, 8, 3, .2); rr(ctx, cx - w / 2 - 14, y - 7, w + 28, h + 14, (h + 14) / 2); ctx.fillStyle = '#fff'; ctx.fill(); noShadow(ctx);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(im, cx - w / 2, y, w, h); ctx.imageSmoothingEnabled = false;
  }
  G.soft = { rr, J, pill, softShadow, noShadow, bg: c => titleBg(c), ciPlate: (...a) => ciPlate(...a) };   // 결과 화면도 같이 씀 (2026-11-03)
  const LX = 300;                                                       // 왼쪽 단 가운데
  // 5대 임무: 크림색 둥근 판 + 임무 색 동그라미 번호
  function titleMissions(ctx) {
    const px = LX - 175, py = 214, pw = 350, ph = 172;
    softShadow(ctx, 18, 6, .28); rr(ctx, px, py, pw, ph, 20); ctx.fillStyle = 'rgba(255,251,240,.93)'; ctx.fill(); noShadow(ctx);
    rr(ctx, LX - 70, py - 13, 140, 26, 13); ctx.fillStyle = '#2f4f8a'; ctx.fill();
    J(ctx, '조달관 5대 임무', LX, py + 1, 16, '#fff');
    G.missions.LIST.forEach((m, i) => {
      const y = py + 34 + i * 27, x = px + 26;
      if (i) { ctx.fillStyle = 'rgba(120,100,60,.12)'; ctx.fillRect(x, y - 13, pw - 52, 1); }
      ctx.fillStyle = m.col; ctx.beginPath(); ctx.arc(x + 10, y, 11, 0, 7); ctx.fill();
      J(ctx, String(i + 1), x + 10, y + 1, 15, '#fff');
      G.icons.draw(ctx, m.icon, x + 38, y, 18);
      J(ctx, m.name, x + 58, y + 1, 18, '#3a3022', { align: 'left' });
    });
  }
  // 타이틀 배경: 이미지 AI 일러스트를 한 번만 살짝 흐리게 만들어 둠
  let bgCache = null;
  function titleBg(ctx) {
    const im = G.img.title_bg;
    if (!im || !im.naturalWidth) { G.world.draw(ctx); return false; }
    if (!bgCache) {
      bgCache = document.createElement('canvas'); bgCache.width = W; bgCache.height = H;
      const g = bgCache.getContext('2d'); g.filter = 'blur(2px)'; g.drawImage(im, -8, -8, W + 16, H + 16); g.filter = 'none';
    }
    ctx.drawImage(bgCache, 0, 0); return true;
  }
  function titleDraw(ctx, t) {
    const art = titleBg(ctx);
    // 왼쪽만 살짝 눌러 글자가 뜨게 (예전처럼 검게 덮지 않음 → 일러스트 색 유지)
    const g = ctx.createLinearGradient(0, 0, W * 0.62, 0);
    g.addColorStop(0, art ? 'rgba(40,30,20,.32)' : 'rgba(16,24,36,.7)'); g.addColorStop(1, 'rgba(40,30,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const v = ctx.createLinearGradient(0, H - 90, 0, H); v.addColorStop(0, 'rgba(40,30,20,0)'); v.addColorStop(1, 'rgba(40,30,20,.35)');
    ctx.fillStyle = v; ctx.fillRect(0, H - 90, W, 90);
    // 오른쪽: 햇살 원 + 3D 마스코트 (둥실둥실) + 이름표
    const im = G.img.mascot3d, bob = Math.sin(t * 2) * 4;
    const halo = ctx.createRadialGradient(722, 290, 20, 722, 290, 240); halo.addColorStop(0, 'rgba(255,244,200,.55)'); halo.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = halo; ctx.fillRect(470, 40, 500, 470);
    ctx.fillStyle = 'rgba(60,40,20,.28)'; ctx.beginPath(); ctx.ellipse(722, 452, 175, 15, 0, 0, 7); ctx.fill();
    if (im && im.naturalWidth) { const h = 320, w = im.naturalWidth * h / im.naturalHeight; ctx.imageSmoothingEnabled = true; ctx.drawImage(im, 722 - w / 2, 130 + bob, w, h); ctx.imageSmoothingEnabled = false; }
    else { G.spr.drawChar(ctx, 'narmi', 'walk', 's', t, 700, 380, 1.6); G.spr.drawChar(ctx, 'dali', 'walk', 's', t, 790, 380, 1.6); }
    for (const [nx, name, col] of [[628, '나르미', '#2f4f8a'], [862, '달이', '#c8641a']]) {
      softShadow(ctx, 6, 2, .25); rr(ctx, nx - 38, 466, 76, 28, 14); ctx.fillStyle = 'rgba(255,252,244,.95)'; ctx.fill(); noShadow(ctx);
      J(ctx, name, nx, 481, 17, col);
    }
    // 왼쪽: CI · 스티커 제목 · 임무 판 · 버튼
    ciPlate(ctx, 'ci_h', LX, 22, 26);
    J(ctx, '나르미와 달이의', LX, 96, 38, '#fff', { stroke: [['rgba(40,28,10,.25)', 14], ['#2f4f8a', 8]] });
    const tg = ctx.createLinearGradient(0, 132, 0, 196); tg.addColorStop(0, '#fff17a'); tg.addColorStop(0.55, '#ffc93a'); tg.addColorStop(1, '#ff9a26');
    softShadow(ctx, 12, 6, .35); J(ctx, '2분 조달작전', LX, 164, 76, '#fff', { stroke: [['#fff', 22]] }); noShadow(ctx);
    J(ctx, '2분 조달작전', LX, 164, 76, tg, { stroke: [['#2f4f8a', 11]] });
    titleMissions(ctx);
    pill(ctx, BTN_START, '작전 시작', 'main', t);
    pill(ctx, BTN_INTRO, '소개 다시 보기', 'sub', t);
    pill(ctx, BTN_SOUND, soundLabel(), 'sub', t);
    pill(ctx, BTN_MUSIC, musicLabel(), 'sub', t);
    pill(ctx, BTN_ULT, ultLabel(), 'ult', t);
    pill(ctx, BTN_ULTQ, '?', 'q', t);
    pill(ctx, BTN_MODE, modeLabel(), G.settings.hard ? 'hard' : 'sub', t);
    if (ui.hover(BTN_MODE)) ui.tip(ctx, BTN_MODE.x - 150, BTN_MODE.y + BTN_MODE.h + 6, MODE_TIP);
    if (ultTipOn || ui.hover(BTN_ULT) || ui.hover(BTN_ULTQ)) ui.tip(ctx, BTN_ULTQ.x - 170, BTN_ULT.y + BTN_ULT.h + 6, ui.ULT_TIP);
    const hk = G.settings.hard ? '_hard' : '', best = G.store.get('best' + hk, 0);
    if (best) J(ctx, (hk ? '하드 ' : '') + '최고 점수 ' + best + ' · 최고 등급 ' + G.store.get('bestGrade' + hk, '-'), W - 18, H - 18, 15, '#fff3b0', { align: 'right', stroke: [['rgba(40,28,10,.55)', 4]] });
    J(ctx, '터치·클릭으로 이동 · Space 브로커 · Enter 시작 · M 소리', LX, 515, 14, '#fff', { stroke: [['rgba(40,28,10,.5)', 4]] });
    if (G.VERSION) T(ctx, G.VERSION, 10, H - 9, 12, 'rgba(255,255,255,.6)', 'left');
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
    if (S.ultCut) { G.ult.cutUpdate(S, dt); return; }                // AI 조사 컷인 1.1초: 게임 멈춤
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
    S.comboT += dt; if (S.rush) S.rushT = (S.rushT || 0) + dt;
    if (S.shakeT > 0) S.shakeT -= dt;
    if (S.flashT > 0) S.flashT -= dt;
    if (S.trust <= C.TRUST_DANGER) { S.warnT = (S.warnT || 0) - dt; if (S.warnT <= 0) { G.audio.play('warn'); S.warnT = 2; } } else S.warnT = 0;
    if (S.timeLeft <= 10 && Math.ceil(S.timeLeft) !== Math.ceil(S.timeLeft + dt)) G.audio.play('tick');
    G.fx.update(S, dt);
    if (S.timeLeft <= 0) { S.timeLeft = 0; G.screen = 'end'; endT = C.END_HOLD; G.audio.play('end'); }
  }
  // 2026-11-04 결전(마지막 20초): 화면 가장자리 붉은 맥박 + 'RUSH' 띠, 마지막 5초는 가운데 큰 숫자
  function rushDraw(ctx, S) {
    if (!S.rush || S.timeLeft <= 0) return;
    const pulse = 0.5 + 0.5 * Math.sin(S.rushT * (S.timeLeft <= 5 ? 9 : 5)), a = 0.18 + 0.22 * pulse;
    for (const [x, y, w, h, gx0, gy0, gx1, gy1] of [[0, C.HUD_H, W, 26, 0, C.HUD_H, 0, C.HUD_H + 26], [0, H - 26, W, 26, 0, H, 0, H - 26], [0, C.HUD_H, 26, H, 0, 0, 26, 0], [W - 26, C.HUD_H, 26, H, W, 0, W - 26, 0]]) {
      const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1); g.addColorStop(0, 'rgba(255,60,40,' + a.toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    }
    if (S.rushT < 2.2) {                                                 // 시작 순간: 'FINAL 20' 띠가 가로지름
      const k = S.rushT / 2.2, x = W * 1.2 - k * W * 1.4;
      ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 3); ctx.fillStyle = 'rgba(217,52,43,.85)'; ctx.fillRect(0, 118, W, 44);
      softShadow(ctx, 6, 3, .4); J(ctx, '최후의 20초 · 브로커 조직 총출동!', x, 141, 28, '#fff', { stroke: [['#7a1a12', 6]] }); noShadow(ctx); ctx.restore();
    }
    if (S.timeLeft <= 5) {                                               // 5·4·3·2·1
      const n = Math.ceil(S.timeLeft), f = n - S.timeLeft, sc = 1.6 - Math.min(1, f / 0.2) * 0.6;
      ctx.save(); ctx.globalAlpha = 0.85 * (1 - f * 0.6); ctx.translate(W / 2, H / 2 + 10); ctx.scale(sc, sc);
      J(ctx, String(n), 0, 0, 120, '#fff', { stroke: [['#d9342b', 14]] }); ctx.restore();
    }
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
    rushDraw(ctx, G.S);
    G.ult.drawCut(ctx, G.S);
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
  // 2026-11-03 일시정지 화면도 타이틀과 같은 톤(둥근 판·Jua·알약 버튼)
  const BTN_RESUME = { x: W / 2 - 110, y: 236, w: 220, h: 54 };
  const BTN_RESTART = { x: W / 2 - 110, y: 302, w: 106, h: 36 };
  const BTN_TITLE = { x: W / 2 + 4, y: 302, w: 106, h: 36 };
  const BTN_PSOUND = { x: W / 2 - 110, y: 350, w: 106, h: 32 }, BTN_PMUSIC = { x: W / 2 + 4, y: 350, w: 106, h: 32 }, BTN_PULT = { x: W / 2 - 110, y: 392, w: 180, h: 32 }, BTN_PULTQ = { x: W / 2 + 78, y: 392, w: 32, h: 32 };
  function pauseUpdate() {
    if (G.input.hit('escape') || G.input.hit('p') || ui.clicked(BTN_RESUME)) G.screen = 'play';
    else if (ui.clicked(BTN_RESTART)) newGame();
    else if (ui.clicked(BTN_TITLE)) G.screen = 'title';
    else if (ui.clicked(BTN_PSOUND)) G.audio.toggle();
    else if (ui.clicked(BTN_PULT)) G.ult.toggleAuto();
    else if (ui.clicked(BTN_PULTQ)) ultTipOn = !ultTipOn;
    else if (ui.clicked(BTN_PMUSIC)) G.music.toggle();
  }
  function pauseDraw(ctx, t) {
    playDraw(ctx);
    ctx.fillStyle = 'rgba(30,24,16,.55)'; ctx.fillRect(0, 0, W, H);
    const S = G.S, px = W / 2 - 150, py = 112, pw = 300, ph = 352;
    softShadow(ctx, 24, 8, .4); rr(ctx, px, py, pw, ph, 24); ctx.fillStyle = 'rgba(255,251,240,.97)'; ctx.fill(); noShadow(ctx);
    // 3D 마스코트가 판 위로 살짝 고개를 내밂
    const im = G.img.mascot3d;
    if (im && im.naturalWidth) { const h = 120, w = im.naturalWidth * h / im.naturalHeight, bob = Math.sin((t || 0) * 2) * 2; ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, py + 6); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.drawImage(im, W / 2 - w / 2, py - 70 + bob, w, h); ctx.imageSmoothingEnabled = false; ctx.restore(); }
    rr(ctx, W / 2 - 92, py + 4, 184, 40, 20); ctx.fillStyle = '#2f4f8a'; ctx.fill();
    J(ctx, '잠깐 쉬는 중', W / 2, py + 25, 26, '#fff');
    if (S) {                                                         // 지금 상황 한 줄
      const k = G.missions.count(S);
      J(ctx, '남은 시간 ' + G.U.fmtTime(S.timeLeft) + ' · 점수 ' + S.score + ' · 임무 ' + k + '/5', W / 2, py + 66, 15, '#6a5a3a');
      J(ctx, (S.hard ? '하드 모드 · ' : '보통 모드 · ') + '시간이 멈춰 있어요', W / 2, py + 88, 14, S.hard ? '#d9342b' : '#9a8a6a');
    }
    pill(ctx, BTN_RESUME, '계속하기', 'main', t || 0);
    pill(ctx, BTN_RESTART, '처음부터', 'sub', 0); pill(ctx, BTN_TITLE, '타이틀로', 'sub', 0);
    pill(ctx, BTN_PSOUND, soundLabel(), 'sub', 0); pill(ctx, BTN_PMUSIC, musicLabel(), 'sub', 0);
    pill(ctx, BTN_PULT, ultLabel(), 'ult', 0); pill(ctx, BTN_PULTQ, '?', 'q', 0);
    J(ctx, 'Esc·P 계속', W / 2, py + ph - 13, 13, '#9a8a6a');
    if (ultTipOn || ui.hover(BTN_PULT) || ui.hover(BTN_PULTQ)) ui.tip(ctx, W / 2 - 150, BTN_PULT.y + 38, ui.ULT_TIP);
  }

  // ---------- 작전 종료 → 결과 ----------
  function endUpdate(dt) { endT -= dt; if (endT <= 0) finish(); }
  function endDraw(ctx) {
    playDraw(ctx);
    ctx.fillStyle = 'rgba(30,24,16,.5)'; ctx.fillRect(0, 0, W, H);
    const tg = ctx.createLinearGradient(0, H / 2 - 30, 0, H / 2 + 30); tg.addColorStop(0, '#fff17a'); tg.addColorStop(0.55, '#ffc93a'); tg.addColorStop(1, '#ff9a26');
    softShadow(ctx, 12, 6, .35); J(ctx, '작전 종료!', W / 2, H / 2, 72, '#fff', { stroke: [['#fff', 20]] }); noShadow(ctx);
    J(ctx, '작전 종료!', W / 2, H / 2, 72, tg, { stroke: [['#2f4f8a', 10]] });
  }
  const BTN_AGAIN = { x: W / 2 - 215, y: 476, w: 200, h: 44 };
  const BTN_HOME = { x: W / 2 + 15, y: 476, w: 200, h: 44 };
  function resultUpdate(dt) {
    G.result.update(dt);
    if (ui.clicked(BTN_AGAIN) || G.input.hit('enter')) newGame();
    else if (ui.clicked(BTN_HOME) || G.input.hit('escape')) G.screen = 'title';
  }
  function resultDraw(ctx, t) {
    G.result.draw(ctx, G.S);
    pill(ctx, BTN_AGAIN, '다시 하기', 'main', t || 0); pill(ctx, BTN_HOME, '타이틀로', 'sub', 0);
    ciPlate(ctx, 'ci_h', W - 80, 488, 22);
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
