/* 시연 영상 자동 녹화 (2026-11-04): 제출판(dist/index.html)을 1920×1080·30fps로 한 장씩 그려 mp4로 만든다. 게임 소리(효과음·배경음악)도 같은 시간축으로 녹음.
   - 화면: 캔버스를 1920×1080으로 키우고 2배로 그림(글자·3D 마스코트가 선명), 게임 진행은 자동 플레이 봇(PlayBot.tick)
   - 2026-11-18 설명형: 핵심 순간마다 멈추고 볼 곳을 비추며 이유를 두 줄로(SC 목록). 그 밖엔 5배속
   - 1분 내외(모집요강 '게임 시연영상 1분 내외 / 1080p 이상'): 설명 7장면, 설명 없는 구간 12배속, 단계 안내 0.9초·끝 카드 2.4초, 타이틀 2.5초·결과 6.5초, 핵심 장면(첫 계약·실사 판단·브로커·AI 조사·긴급)은 자막과 함께 1배속, 단계 안내·끝 카드는 1배속(영상용으로 짧게), 타이틀 3.5초 · 결과 화면 9초
   - 2026-11-18 v8.26 업무 4단계에 맞춤: 단계 안내 1.8초·끝 카드 3.5초, 태풍은 4단계 고정 시점 그대로(옛 사건 순서 덮어쓰기 뺌)
   - 인코더: ffmpeg-static(h264+aac). 없으면 FFMPEG 환경변수로 지정
   - 소리: AudioContext를 OfflineAudioContext로 바꿔 '영상 시간'으로 예약 → 끝에 한 번에 렌더해 wav로
   준비: npx playwright(크로미움), ffmpeg-static(npm) — 경로는 환경변수 PW, FFMPEG로 바꿀 수 있음
   주의(2026-11-18): `npm i --no-save ffmpeg-static`은 같은 방식으로 깔린 playwright를 지움 → 둘을 한 번에 `npm i --no-save playwright ffmpeg-static`
   사용: python3 -m http.server 8767 (저장소 폴더에서) → node tools/record_demo.cjs [출력.mp4] [시드]
   미리보기(인코더 없이): PREVIEW=폴더 node tools/record_demo.cjs x.mp4 [시드] → 2초마다 장면 PNG + 길이·자막 확인 */
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
// 경로: 저장소 폴더에서 `npm i --no-save playwright ffmpeg-static` 후 `npx playwright install chromium` 하면 따로 지정할 필요 없음
const tryReq = m => { try { return require.resolve(m, { paths: [process.cwd(), __dirname] }); } catch (e) { return null; } };
const PW = process.env.PW || tryReq('playwright') || '/home/dksrnjs/.npm/_npx/9833c18b2d85bc59/node_modules/playwright';
const CHROME = process.env.CHROME || undefined;                        // 없으면 playwright가 설치한 크로미움
const FFMPEG = process.env.FFMPEG || (tryReq('ffmpeg-static') && require(tryReq('ffmpeg-static'))) || path.join(process.env.SP || '/tmp', 'ffm/node_modules/ffmpeg-static/ffmpeg');
const OUT = path.resolve(process.argv[2] || 'demo.mp4'), SEED = +(process.argv[3] || 7), FPS = 30;
const { chromium } = require(PW);

// 페이지보다 먼저: 고정 난수 + 오디오를 오프라인 녹음으로 + 게임 자체 루프 멈춤
const INIT = `
  (() => {
    let s = ${SEED} >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    window.__vt = 0;
    const off = new OfflineAudioContext(2, 48000 * 150, 48000); window.__off = off;
    const proxy = new Proxy(off, { get(t, p) {
      if (p === 'currentTime') return window.__vt;
      if (p === 'state') return 'running';
      if (p === 'resume' || p === 'suspend') return () => Promise.resolve();
      const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; } });
    window.AudioContext = window.webkitAudioContext = function () { return proxy; };
    window.requestAnimationFrame = () => 0;                          // 게임 루프는 녹화 스크립트가 직접 돌림
  })();`;

// 페이지 안에서 돌릴 녹화 진행 (한 번 부를 때마다 영상 1프레임)
const REC = `
window.REC = (() => {
  const C = G.C, W = 960, H = 540, cv = document.getElementById('game'), ctx = cv.getContext('2d');
  cv.width = 1920; cv.height = 1080; C.RES_AUTO = false; C.RES = 2;   // 8.15단계: 녹화는 늘 2배
  const M = G.missions.LIST, U = G.U;
  // 2026-11-18 설명형 장면: 핵심 순간마다 게임을 잠깐 멈추고(hold) 볼 곳을 밝게 비추며(focus) 이유를 두 줄로(text·sub) 설명. 이어서 slow초 동안 1배속
  const bub = r => G.ui.bubbleRect(r);
  const repRect = S => { const d = S.report.sh.w.door, w = 216, h = 124; return { x: U.clamp(d.x + d.w / 2 - w / 2, 4, W - w - 4), y: d.y + d.h + 4, w, h }; };
  const rowRect = S => { const R = repRect(S); return { x: R.x + 4, y: R.y + 36, w: R.w - 8, h: 16 }; };
  const okShop = (S, r) => S.shops.filter(s => G.shops.isOpen(S, s) && G.connect.fit(S, s, r) === 'ok').sort((a, b) => G.shops.price(a, r.item) - G.shops.price(b, r.item))[0];
  const done = S => n => S.stats && (S.stats[n] || 0);
  const SC = [
    { id: 'card', tag: '1단계 ' + M[0].name, col: M[0].col, when: S => G.requests.active(S).some(r => !r.ship), hold: 2.2, slow: 0,
      before(S, me) { me.r = G.requests.active(S).find(r => !r.ship); me.r.t = Math.max(me.r.t, 0.3); }, focus: (S, me) => bub(me.r),
      text: S => '학교가 나라장터로 주문했어요', sub: S => '카드 맨 아래 별(★) = 꼭 지켜야 할 품질 조건' },
    { id: 'pick', tag: '1단계 ' + M[0].name, col: M[0].col, after: 'card', hold: 3.0, slow: 0.6,
      before(S, me) { me.r = SCx.card.r; S.sel = me.r; S.connectHint = false; }, focus: (S, me) => { const sh = okShop(S, me.r); return sh ? { x: sh.w.body.x - 4, y: sh.w.body.y - 8, w: sh.w.body.w + 8, h: sh.w.body.h + 34 } : null; },
      text: S => '조건(★)을 맞춘 공방 중 가장 싼 곳과 계약해요', sub: S => '★이 모자라면 조건 ✘ · 더 비싸면 세금 낭비 · 계약하면 드론이 납품' },
    { id: 'sprout', tag: '2단계 ' + M[1].name, col: '#2e9b3a', when: S => S.report && S.report.t >= C.INSPECT_TIME && !S.report.sh.fake, hold: 3.4, slow: 0.4, focus: S => S.report ? rowRect(S) : null,
      text: S => '생산 설비 ✔ 있음 → 등록!', sub: S => '납품 실적이 없는 건 막 시작한 새싹(스타트업)이라서예요 · 키우면 혁신제품' },
    { id: 'fake', tag: '2단계 ' + M[1].name, col: '#d9342b', when: S => S.report && S.report.t >= C.INSPECT_TIME && S.report.sh.fake, hold: 3.4, slow: 0.4, focus: S => S.report ? rowRect(S) : null,
      text: S => '생산 설비 ✘ 없음 → 적발!', sub: S => '서류만 있고 만들 능력이 없는 페이퍼컴퍼니 · 등록하면 부정 낙찰이 돼요' },
    { id: 'bk', tag: '3단계 ' + M[2].name, col: M[2].col, when: S => S.bk && S.bk.state === 'grab' && S.bk.req, hold: 2.6, slow: 0.4,
      before(S, me) { me.r = S.bk.req; }, focus: (S, me) => me.r && me.r.state === 'open' ? bub(me.r) : null,
      text: S => '브로커가 이 계약을 가로채려 해요', sub: S => "보라색 '브로커!' 카드 · 먼저 계약하거나 브로커를 눌러 막아요" },
    { id: 'ult', tag: 'AI 조사', col: '#0f6f94', when: S => S.ultFx && S.ultFx.t > 0.05, hold: 0, slow: 0,
      text: S => 'AI 데이터 일제 조사', sub: S => '숨은 브로커 조직까지 데이터로 한 번에 찾아 적발해요' },
    { id: 'storm', tag: '4단계 ' + M[3].name, col: M[3].col, when: S => S.storm && S.storm.t > 0.2 && G.requests.active(S).some(r => r.urgent && !r.ship), hold: 2.6, slow: 0.4,
      before(S, me) { me.r = G.requests.active(S).find(r => r.urgent && !r.ship); }, focus: (S, me) => me.r && me.r.state === 'open' ? bub(me.r) : null,
      text: S => "태풍! 빨간 '긴급 ×2' 계약", sub: S => '긴급 계약은 자동 체결이 안 돼요 → 직접 먼저 계약 · 점수 ×2' },
  ];
  const SCx = {}, shown = {};
  let cur = null, curT = 0, phase = 'title', phaseT = 0, frame = 0, clock = 0, botSt = {};
  const BOT = { inspect: true, speed: 0.6, bkDelay: 0.3 };
  function check(S) {                                                 // 장면 시작 (게임 한 스텝 전에 확인 → 봇이 먼저 움직이지 않게)
    if (G.screen !== 'play') return;
    if (cur && curT >= cur.hold) { const nx = SC.find(sc => sc.after === cur.id && !shown[sc.id]); if (nx) { shown[nx.id] = true; SCx[nx.id] = {}; if (nx.before) nx.before(S, SCx[nx.id]); cur = nx; curT = 0; if (window.__scLog) window.__scLog.push(nx.id + '@' + (frame / FPS_).toFixed(1)); return; } }   // 이어지는 장면은 틈 없이
    if (cur) return;
    for (const sc of SC) {
      if (shown[sc.id]) continue;
      if (sc.after ? !(shown[sc.after] && !cur) : !sc.when(S)) continue;
      shown[sc.id] = true; SCx[sc.id] = {}; if (sc.before) sc.before(S, SCx[sc.id]);
      cur = sc; curT = 0; if (window.__scLog) window.__scLog.push(sc.id + '@' + (frame / FPS_).toFixed(1)); return;
    }
  }
  const holding = () => cur && curT < cur.hold;
  { const a = G.broker.drawAlarm, d = G.director.draw; G.broker.drawAlarm = (c, S) => { if (!holding()) a(c, S); }; G.director.draw = (c, S) => { if (!holding()) d(c, S); }; }   // 설명 중엔 경보 띠·배너가 가리지 않게
  function gameStep(dt) {
    const S = G.S;
    if (G.screen !== 'play') { G.screens.update(dt); G.input.endFrame(); return; }
    check(S); if (holding()) return;
    G.settings.ultAuto = !!shown.bk && !holding();                   // AI 조사는 브로커 설명을 보여 준 뒤에
    if (S.hitStop > 0) { S.hitStop -= dt; return; }
    if (!S.ultCut) { PlayBot.tick(S, BOT, botSt); G.dali.t += dt * (G.dali.moving ? 1 : 0); }
    G.dali.speed = C.DALI_SPEED * (S.speedMult || 1);
    const c0 = S.stats.brokerCaught || 0, lock = S.ultLock;
    G.screens.step(S, dt); G.input.endFrame();
    if ((S.stats.brokerCaught || 0) > c0 && !lock && !S.ultLock) S.__handCatch = true;
  }
  function drawFocus() {                                              // 볼 곳만 밝게 (나머지는 어둡게) + 노란 테두리
    if (!holding() || !cur.focus) return;
    const R = cur.focus(G.S, SCx[cur.id]); if (!R) return;
    const K = G.soft, k = Math.min(1, curT / 0.25), pad = 6, on = 0.6 + Math.sin(curT * 8) * 0.4;
    ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = 'rgba(10,16,28,.5)';
    const x0 = R.x - pad, y0 = R.y - pad, w0 = R.w + pad * 2, h0 = R.h + pad * 2, r0 = 12;   // 바깥 사각형 + 둥근 구멍(역방향)
    ctx.beginPath(); ctx.rect(0, 0, W, H);
    ctx.moveTo(x0 + r0, y0); ctx.arcTo(x0, y0, x0, y0 + h0, r0); ctx.arcTo(x0, y0 + h0, x0 + w0, y0 + h0, r0); ctx.arcTo(x0 + w0, y0 + h0, x0 + w0, y0, r0); ctx.arcTo(x0 + w0, y0, x0, y0, r0); ctx.closePath();
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255,216,74,' + on.toFixed(2) + ')'; ctx.lineWidth = 4; K.rr(ctx, R.x - pad, R.y - pad, R.w + pad * 2, R.h + pad * 2, 12); ctx.stroke();
    ctx.restore(); ctx.lineWidth = 1;
  }
  function drawCaption() {
    if (!cur) return;
    const life = cur.hold + cur.slow + (cur.id === 'ult' ? 2.6 : 0.5), a = Math.min(1, curT / 0.2) * (curT > life - 0.3 ? Math.max(0, (life - curT) / 0.3) : 1);
    if (curT >= life) { cur = null; return; }
    const K = G.soft, S = G.S, text = cur.text(S), sub = cur.sub(S);
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = '15px "Jua", sans-serif'; const gw = ctx.measureText(cur.tag).width;
    ctx.font = '24px "Jua", sans-serif'; const tw = ctx.measureText(text).width; ctx.font = '17px "Jua", sans-serif'; const sw = ctx.measureText(sub).width;
    const w = Math.max(tw, sw) + 64, h = 74, x = W / 2 - w / 2, y = H - h - 14 + (1 - Math.min(1, curT / 0.2)) * 10;
    K.softShadow(ctx, 14, 5, .45); K.rr(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(20,28,44,.93)'; ctx.fill(); K.noShadow(ctx);
    ctx.strokeStyle = cur.col; ctx.lineWidth = 2; K.rr(ctx, x + 1, y + 1, w - 2, h - 2, 17); ctx.stroke(); ctx.lineWidth = 1;
    K.rr(ctx, W / 2 - gw / 2 - 14, y - 15, gw + 28, 28, 14); ctx.fillStyle = cur.col; ctx.fill();
    K.J(ctx, cur.tag, W / 2, y - 1, 15, '#fff');
    K.J(ctx, text, W / 2, y + 30, 24, '#ffe48a');
    K.J(ctx, sub, W / 2, y + 56, 17, '#e6edf5');
    ctx.restore();
  }
  function step() {
    const dt = 1 / FPS_;
    window.__vt = frame / FPS_;
    if (frame === 0) { window.dispatchEvent(new Event('pointerdown')); G.screen = 'title'; }
    phaseT += dt;
    if (phase === 'title') {
      if (phaseT >= 2.5) { phase = 'game'; phaseT = 0; G.screens.newGame(); botSt = {}; }
    } else if (phase === 'game') {
      const S = G.S;
      const slow = !!cur || S.ultCut || S.ultFx || G.screen !== 'play';
      const sub = slow ? 2 : 24;                                         // 1배속(2스텝) / 12배속(24스텝): 1분 내외에 맞추려고 설명 없는 구간은 빨리
      for (let i = 0; i < sub; i++) gameStep(1 / 60);
      if (G.screen === 'result') { phase = 'result'; phaseT = 0; }
    } else if (phase === 'result') {
      G.screens.update(dt); G.input.endFrame();
    }
    if (cur) curT += dt;
    clock += dt;
    G.music.update();
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    G.screens.draw(ctx, clock);
    drawFocus(); drawCaption();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    frame++;
    return { done: phase === 'result' && phaseT >= 6.5, phase, t: (frame / FPS_).toFixed(1), shown: Object.keys(shown) };
  }
  return { step, shown };
})();`;

(async () => {
  const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(INIT);
  await p.goto('http://127.0.0.1:8767/dist/index.html'); await p.waitForTimeout(2500);
  await p.addScriptTag({ url: '/tools/playbot.js' });
    await p.evaluate(() => { G.store.set('thanks', G.thanks.LIST.map(g => g.id)); });   // 2026-11-18: 감사 선물 창이 결과 화면 '실제로는?'을 가리지 않게 모두 받은 상태로
  await p.evaluate(() => { G.C.STAGE_INTRO_SEC = 0.9; G.C.STAGE_CARD_SEC = 2.4; G.thanks.drawWorld = () => {}; G.settings.hard = false; G.settings.easy = false; G.settings.ultAuto = true; });   // 영상용: 단계 화면 짧게, 보통 모드
  await p.addScriptTag({ content: REC.replace(/FPS_/g, String(FPS)) });
  const PREVIEW = process.env.PREVIEW;
  if (PREVIEW) { await p.evaluate(() => { window.__scLog = []; });                                                      // 미리보기: 영상·소리 없이 2초마다 PNG
    fs.mkdirSync(PREVIEW, { recursive: true }); let r, n = 0;
    do { r = await p.evaluate(() => window.REC.step()); if (n % (FPS * (+process.env.PREVIEW_SEC || 2)) === 0) { const url = await p.evaluate(() => document.getElementById('game').toDataURL('image/png')); fs.writeFileSync(path.join(PREVIEW, String(n / FPS).padStart(3, '0') + 's_' + r.phase + '.png'), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); } n++; } while (!r.done && n < FPS * 150);
    console.log('장면 시작: ' + (await p.evaluate(() => window.__scLog || [])).join(' '));
    console.log('미리보기 ' + (n / FPS).toFixed(1) + '초 · 자막: ' + r.shown.join(', ') + ' · 오류 ' + errs.length + (errs.length ? ' ' + errs.slice(0, 3).join(' / ') : '')); await b.close(); return;
  }
  const vtmp = OUT.replace(/\.mp4$/, '') + '.video.mp4';
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), vtmp]);
  ff.stderr.on('data', d => process.stderr.write(d));
  let r, n = 0;
  do {
    r = await p.evaluate(() => window.REC.step());
    const url = await p.evaluate(() => document.getElementById('game').toDataURL('image/png'));
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(res => ff.stdin.once('drain', res));
    if (++n % 150 === 0) console.log('  ' + r.t + '초 · ' + r.phase + ' · 자막 ' + r.shown.join(','));
  } while (!r.done && n < FPS * 150);
  ff.stdin.end(); await new Promise(res => ff.on('close', res));
  const dur = n / FPS;
  console.log('화면 ' + n + '장 (' + dur.toFixed(1) + '초) · 자막: ' + r.shown.join(', '));
  // 소리 렌더 → wav
  const wavB64 = await p.evaluate(async dur => {
    const buf = await window.__off.startRendering(), sr = buf.sampleRate, len = Math.min(buf.length, Math.ceil(dur * sr)), ch = [buf.getChannelData(0), buf.getChannelData(1)];
    const out = new DataView(new ArrayBuffer(44 + len * 4)), w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + len * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, len * 4, true);
    for (let i = 0; i < len; i++) for (let c = 0; c < 2; c++) out.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true);
    const u8 = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }, dur);
  const wav = OUT.replace(/\.mp4$/, '') + '.wav'; fs.writeFileSync(wav, Buffer.from(wavB64, 'base64'));
  await b.close();
  await new Promise(res => spawn(FFMPEG, ['-y', '-loglevel', 'error', '-i', vtmp, '-i', wav, '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], { stdio: 'inherit' }).on('close', res));
  fs.unlinkSync(vtmp); fs.unlinkSync(wav);
  console.log('완성: ' + OUT + ' · 오류 ' + errs.length + (errs.length ? ' ' + errs.slice(0, 3).join(' / ') : ''));
})();
