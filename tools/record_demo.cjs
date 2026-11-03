/* 시연 영상 자동 녹화 (2026-11-04): 제출판(dist/index.html)을 1920×1080·30fps로 한 장씩 그려 mp4로 만든다. 게임 소리(효과음·배경음악)도 같은 시간축으로 녹음.
   - 화면: 캔버스를 1920×1080으로 키우고 2배로 그림(글자·3D 마스코트가 선명), 게임 진행은 자동 플레이 봇(PlayBot.tick)
   - 속도: 평소 3배속, 핵심 장면(5대 임무 첫 달성·AI 조사·결전)은 자막과 함께 1배속, 타이틀 3.5초 · 결과 화면 8초
   - 소리: AudioContext를 OfflineAudioContext로 바꿔 '영상 시간'으로 예약 → 끝에 한 번에 렌더해 wav로
   준비: npx playwright(크로미움), ffmpeg-static(npm) — 경로는 환경변수 PW, FFMPEG로 바꿀 수 있음
   사용: python3 -m http.server 8767 (저장소 폴더에서) → node tools/record_demo.cjs [출력.mp4] [시드] */
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PW = process.env.PW || '/home/dksrnjs/.npm/_npx/9833c18b2d85bc59/node_modules/playwright';
const CHROME = process.env.CHROME || '/home/dksrnjs/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const FFMPEG = process.env.FFMPEG || path.join(process.env.SP || '/tmp', 'ffm/node_modules/ffmpeg-static/ffmpeg');
const OUT = path.resolve(process.argv[2] || 'demo.mp4'), SEED = +(process.argv[3] || 7), FPS = 30;
const { chromium } = require(PW);

// 페이지보다 먼저: 고정 난수 + 오디오를 오프라인 녹음으로 + 게임 자체 루프 멈춤
const INIT = `
  (() => {
    let s = ${SEED} >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    window.__vt = 0;
    const off = new OfflineAudioContext(2, 48000 * 110, 48000); window.__off = off;
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
  cv.width = 1920; cv.height = 1080;
  const M = G.missions.LIST;
  const CAP = {
    value:  { tag: '조달관 5대 임무 1', col: M[0].col, text: '조건(★)을 맞춘 공방 중 가장 싼 곳에서 사요' },
    paper:  { tag: '조달관 5대 임무 2', col: M[1].col, text: '너무 싸고 좋은 새 공방? 나르미 실사로 페이퍼컴퍼니 적발!' },
    broker: { tag: '조달관 5대 임무 3', col: M[2].col, text: '계약을 가로채는 브로커를 눌러 차단 · 입찰참가자격 제한' },
    sprout: { tag: '조달관 5대 임무 4', col: M[3].col, text: '새싹 공방의 첫 고객이 되어 혁신제품으로 키워요' },
    crisis: { tag: '조달관 5대 임무 5', col: M[4].col, text: '태풍엔 긴급조달 · 원자재는 쌀 때 비축해요' },
    ult:    { tag: 'AI 조사', col: '#0f6f94', text: '브로커 3명 적발 → 데이터로 한 번에 찾아내는 AI 조사' },
    rush:   { tag: '결전', col: '#d9342b', text: '최후의 20초 · 브로커 총출동, 점수 1.5배!' },
  };
  const shown = {}; let cap = null, capT = 0, slowT = 0, phase = 'title', phaseT = 0, frame = 0, clock = 0, botSt = {};
  const BOT = { inspect: true, speed: 0.8 };
  function trigger(S) {
    const s = S.stats || {}, want = [];
    if (S.elapsed > 3) want.push('value');
    if (s.caught) want.push('paper');
    if (s.brokerCaught) want.push('broker');
    if (s.innov) want.push('sprout');
    if (S.storm) want.push('crisis');                               // 태풍 때 (봇이 초반에 비축해도 순서가 앞당겨지지 않게)
    if (S.ultFx && S.ultFx.t > 0.2) want.push('ult');
    if (S.rush) want.push('rush');
    for (const k of want) if (!shown[k]) { shown[k] = true; cap = CAP[k]; capT = 0; slowT = k === 'ult' ? 0 : 2.6; return; }
  }
  function gameStep(dt) {
    const S = G.S;
    if (G.screen !== 'play') { G.screens.update(dt); G.input.endFrame(); return; }
    if (S.hitStop > 0) { S.hitStop -= dt; return; }
    if (!S.ultCut) { PlayBot.tick(S, BOT, botSt); G.dali.t += dt * (G.dali.moving ? 1 : 0); }
    G.dali.speed = C.DALI_SPEED * (S.speedMult || 1);
    G.screens.step(S, dt); G.input.endFrame();
  }
  function drawCaption() {
    if (!cap) return;
    const K = G.soft, a = Math.min(1, capT / 0.2) * (capT > 3.2 ? Math.max(0, (3.6 - capT) / 0.4) : 1); if (a <= 0) { cap = null; return; }
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = '22px "Jua", sans-serif'; const tw = ctx.measureText(cap.text).width; ctx.font = '15px "Jua", sans-serif'; const gw = ctx.measureText(cap.tag).width;
    const w = tw + gw + 70, x = W / 2 - w / 2, y = H - 64 + (1 - Math.min(1, capT / 0.2)) * 10;
    K.softShadow(ctx, 14, 5, .45); K.rr(ctx, x, y, w, 46, 23); ctx.fillStyle = 'rgba(20,28,44,.9)'; ctx.fill(); K.noShadow(ctx);
    K.rr(ctx, x + 7, y + 7, gw + 24, 32, 16); ctx.fillStyle = cap.col; ctx.fill();
    K.J(ctx, cap.tag, x + 19 + gw / 2, y + 24, 15, '#fff');
    K.J(ctx, cap.text, x + gw + 44, y + 24, 22, '#fff', { align: 'left' });
    ctx.restore();
  }
  function step() {
    const dt = 1 / FPS_;
    window.__vt = frame / FPS_;
    if (frame === 0) { window.dispatchEvent(new Event('pointerdown')); G.screen = 'title'; }
    phaseT += dt;
    if (phase === 'title') {
      if (phaseT >= 3.5) { phase = 'game'; phaseT = 0; G.screens.newGame(); botSt = {}; }
    } else if (phase === 'game') {
      const S = G.S;
      if (G.screen === 'play') trigger(S);
      const slow = slowT > 0 || S.ultCut || S.ultFx || G.screen !== 'play';
      const sub = slow ? 2 : 6;                                          // 1배속(2스텝) / 3배속(6스텝)
      for (let i = 0; i < sub; i++) gameStep(1 / 60);
      if (slowT > 0) slowT -= dt;
      if (G.screen === 'result') { phase = 'result'; phaseT = 0; }
    } else if (phase === 'result') {
      G.screens.update(dt); G.input.endFrame();
    }
    if (cap) capT += dt;
    clock += dt;
    G.music.update();
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    G.screens.draw(ctx, clock);
    drawCaption();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    frame++;
    return { done: phase === 'result' && phaseT >= 9, phase, t: (frame / FPS_).toFixed(1), shown: Object.keys(shown) };
  }
  return { step, shown };
})();`;

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(INIT);
  await p.goto('http://127.0.0.1:8767/dist/index.html'); await p.waitForTimeout(2500);
  await p.addScriptTag({ url: '/tools/playbot.js' });
  // 결과 화면에서 '실제로는?'이 가려지지 않게 감사 선물은 하나(학교 화분)만 남기고 미리 받은 상태로 → 카드 1장만 짧게
  await p.evaluate(() => { G.store.set('thanks', G.thanks.LIST.map(g => g.id).filter(id => id !== 'pot')); });
  await p.evaluate(() => { G.C.EVENT_FIXED = true; G.C.EVENT_FIXED_AT = { dust: 40, storm: 44, surge: 80 }; });   // 태풍 → 폭등 순서 고정
  await p.addScriptTag({ content: REC.replace(/FPS_/g, String(FPS)) });
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
  } while (!r.done && n < FPS * 100);
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
