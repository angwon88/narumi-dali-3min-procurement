/* 빠른 점검 (2026-11-04): 제출판(dist)을 열어 봇으로 6판 → 점수·신뢰·등급과 콘솔 오류 확인. 고친 뒤 커밋 전에 실행.
   준비: 저장소 폴더에서 `npm i --no-save playwright` + `npx playwright install chromium`, `python3 tools/build.py`, `python3 -m http.server 8767`
   사용: node tools/smoke_test.cjs [index.html|dist/index.html]   (기본 dist) */
'use strict';
const tryReq = m => { try { return require.resolve(m, { paths: [process.cwd(), __dirname] }); } catch (e) { return null; } };
const { chromium } = require(process.env.PW || tryReq('playwright') || 'playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://127.0.0.1:8767/' + (process.argv[2] || 'dist/index.html')); await p.waitForTimeout(1500);
  await p.addScriptTag({ url: '/tools/playbot.js' });
  const out = [];
  for (let i = 0; i < 6; i++) out.push(await p.evaluate(sp => { const r = PlayBot.run({ inspect: true, speed: sp }); G.screen = 'end'; G.screens.update(2); for (let k = 0; k < 90; k++) G.screens.update(1 / 60); return r.점수 + '/' + r.신뢰 + ' ' + G.S.grade; }, i < 3 ? 0.7 : 0.45));
  await p.evaluate(() => { localStorage.clear(); });
  console.log('점수/신뢰 등급: ' + out.join(' | ') + ' · 오류 ' + errs.length + (errs.length ? '\n  ' + errs.slice(0, 5).join('\n  ') : ''));
  await b.close(); process.exit(errs.length ? 1 : 0);
})();
