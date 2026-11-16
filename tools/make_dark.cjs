/* 피해 연출용 '꺼진 창' 덧그림 만들기 (2026-11-16 8.15단계): 건물 PNG에서 유리(밝은 하늘·청록빛)만 어두운 색으로, 나머지는 투명하게
   흰 벽·진한 청록 띠는 건드리지 않음(밝기·파랑 기준). 사용: 서버 켠 상태에서 node tools/make_dark.cjs assets/village_school.png [다른 PNG …]
   → 같은 폴더에 <이름>_dark.png */
'use strict';
const fs = require('fs');
const tryReq = m => { try { return require.resolve(m, { paths: [process.cwd(), __dirname] }); } catch (e) { return null; } };
const { chromium } = require(process.env.PW || tryReq('playwright') || 'playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('http://127.0.0.1:8767/index.html');
  for (const src of process.argv.slice(2)) {
    const r = await p.evaluate(async src => {
      const im = new Image(); im.src = '/' + src; await im.decode();
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), q = d.data; let n = 0;
      for (let i = 0; i < q.length; i += 4) {
        const [r, gg, bb, a] = [q[i], q[i + 1], q[i + 2], q[i + 3]];
        const glass = a > 0 && bb > 175 && bb >= r + 25 && gg >= r + 10 && r > 120 && !(r > 225 && gg > 225 && bb > 225);   // 밝은 하늘·청록빛 유리 (흰색 제외)
        if (glass) { q[i] = 59; q[i + 1] = 66; q[i + 2] = 80; q[i + 3] = 255; n++; } else q[i + 3] = 0;
      }
      g.putImageData(d, 0, 0); return { url: c.toDataURL('image/png'), n, all: c.width * c.height };
    }, src);
    const out = src.replace(/\.png$/, '_dark.png');
    fs.writeFileSync(out, Buffer.from(r.url.split(',')[1], 'base64'));
    console.log(out, '유리 ' + Math.round(r.n / r.all * 100) + '%');
  }
  await b.close();
})();
