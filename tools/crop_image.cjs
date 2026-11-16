/* 그림 일부를 잘라 크기 맞추기 (2026-11-16, 광장 바닥용). 서버 켠 상태에서:
   node tools/crop_image.cjs <원본(저장소 안 경로)> <저장할 jpg> <잘라낼 x> <y> <폭> <높이> <결과 폭> <결과 높이>
   예(광장): node tools/crop_image.cjs docs/licenses/원본_건물/광장_LeonardoAI.jpg assets/plaza.jpg 231 271 889 261 960 282
   광장 값: 원본의 원형 무늬 가운데(675, 415)가 조달청 가운데(480, 290)에 오도록, 건물·벤치·그림자가 없는 돌바닥만 */
'use strict';
const fs = require('fs');
const tryReq = m => { try { return require.resolve(m, { paths: [process.cwd(), __dirname] }); } catch (e) { return null; } };
const { chromium } = require(process.env.PW || tryReq('playwright') || 'playwright');
const [src, out, ...n] = process.argv.slice(2), [sx, sy, sw, sh, ow, oh] = n.map(Number);
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('http://127.0.0.1:8767/index.html');
  const url = await p.evaluate(async ([src, sx, sy, sw, sh, ow, oh]) => {
    const im = new Image(); im.src = '/' + src.split('/').map(encodeURIComponent).join('/'); await im.decode();
    const c = document.createElement('canvas'); c.width = ow; c.height = oh;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(im, sx, sy, sw, sh, 0, 0, ow, oh);
    return c.toDataURL('image/jpeg', 0.9);
  }, [src, sx, sy, sw, sh, ow, oh]);
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log(out, ow + '×' + oh, Math.round(fs.statSync(out).size / 1024) + 'KB');
  await b.close();
})();
