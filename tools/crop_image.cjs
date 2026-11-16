/* 그림 일부를 잘라 크기 맞추기 (2026-11-16, 광장 바닥용). 서버 켠 상태에서:
   node tools/crop_image.cjs <원본(저장소 안 경로)> <저장할 jpg> <잘라낼 x> <y> <폭> <높이> <결과 폭> <결과 높이>
   예(광장): node tools/crop_image.cjs docs/licenses/원본_건물/광장_LeonardoAI.jpg assets/plaza.jpg 231 271 889 261 1920 564 --mirror 675,415,40,135 --patch 675,415,64,420,620
   광장 값: 원본의 원형 무늬 가운데(675, 415)가 조달청 가운데(480, 290)에 오도록, 건물·벤치·그림자가 없는 돌바닥만 */
'use strict';
const fs = require('fs');
const tryReq = m => { try { return require.resolve(m, { paths: [process.cwd(), __dirname] }); } catch (e) { return null; } };
const { chromium } = require(process.env.PW || tryReq('playwright') || 'playwright');
// 선택: --patch cx,cy,r,fx,fy = 원본의 (cx,cy) 반지름 r 원을 (fx,fy) 둘레의 깨끗한 바닥으로 덮음(가장자리는 부드럽게). 광장 가운데 분수 지우기용
// 선택: --mirror cx,cy,r0,r1 = (cx,cy) 둘레 r0~r1 고리의 아래쪽 절반을 위쪽 절반을 180도 돌린 것으로 덮음(동심원 무늬 위 그림자·얼룩 지우기). --patch보다 먼저 적용
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1].split(',').map(Number) : null; };
const patch = opt('--patch'), mirror = opt('--mirror');
const [src, out, ...n] = args, [sx, sy, sw, sh, ow, oh] = n.map(Number);
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('http://127.0.0.1:8767/index.html');
  const url = await p.evaluate(async ([src, sx, sy, sw, sh, ow, oh, patch, mirror]) => {
    const im = new Image(); im.src = '/' + src.split('/').map(encodeURIComponent).join('/'); await im.decode();
    const s = document.createElement('canvas'); s.width = im.naturalWidth; s.height = im.naturalHeight;
    const sg = s.getContext('2d'); sg.drawImage(im, 0, 0);
    if (mirror) {                                                      // 고리 아래쪽 절반 ← 위쪽 절반을 180도 돌린 것 (경계는 부드럽게)
      const [cx, cy, r0, r1] = mirror, t = document.createElement('canvas'); t.width = s.width; t.height = s.height;
      const tg = t.getContext('2d'); tg.translate(cx, cy); tg.rotate(Math.PI); tg.translate(-cx, -cy); tg.drawImage(im, 0, 0); tg.setTransform(1, 0, 0, 1, 0, 0);
      const m = document.createElement('canvas'); m.width = s.width; m.height = s.height; const mg = m.getContext('2d');
      const gr = mg.createRadialGradient(cx, cy, r0, cx, cy, r1); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.1, 'rgba(0,0,0,1)'); gr.addColorStop(0.88, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      mg.fillStyle = gr; mg.fillRect(0, cy, s.width, s.height);
      const fade = mg.createLinearGradient(0, cy, 0, cy + 14); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');   // 가로 경계선도 부드럽게
      mg.globalCompositeOperation = 'destination-out'; mg.fillStyle = fade; mg.fillRect(0, cy, s.width, 14);
      tg.globalCompositeOperation = 'destination-in'; tg.drawImage(m, 0, 0);
      sg.drawImage(t, 0, 0);
    }
    if (patch) {                                                       // 깨끗한 바닥 조각을 옮겨 붙이고, 가장자리 12px은 서서히 섞음
      const [cx, cy, r, fx, fy] = patch, t = document.createElement('canvas'); t.width = s.width; t.height = s.height;
      const tg = t.getContext('2d'); tg.drawImage(s, cx - fx, cy - fy);
      const gr = tg.createRadialGradient(cx, cy, Math.max(1, r - 12), cx, cy, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      tg.globalCompositeOperation = 'destination-in'; tg.fillStyle = gr; tg.fillRect(0, 0, t.width, t.height);
      sg.drawImage(t, 0, 0);
    }
    const c = document.createElement('canvas'); c.width = ow; c.height = oh;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(s, sx, sy, sw, sh, 0, 0, ow, oh);
    return c.toDataURL('image/jpeg', 0.9);
  }, [src, sx, sy, sw, sh, ow, oh, patch, mirror]);
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log(out, ow + '×' + oh, Math.round(fs.statSync(out).size / 1024) + 'KB');
  await b.close();
})();
