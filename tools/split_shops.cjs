/* 공방 4종 한 장 → 업종별 공방 그림 4장 (2026-11-16 8.21단계)
   원본: 2×2로 배치된 정면 공방 그림(왼쪽 위 가구, 오른쪽 위 전자, 왼쪽 아래 보건, 오른쪽 아래 안전)
   - 칸마다 가장자리에서 이어진 흰 배경을 투명하게 → 건물 범위만 잘라 냄 → 폭 248px(화면 124px의 2배)로 줄임
   - 지붕 꼭대기 줄(태양광 판 아래)을 찾아 그림 위쪽에 표시 정보로 남김(world.js가 지붕을 공방 지붕 자리에 맞춤)
   사용: 서버 켠 상태에서 node tools/split_shops.cjs docs/licenses/원본_건물/공방4종.png
   → assets/shop_furn.png · shop_elec.png · shop_health.png · shop_safety.png, 콘솔에 각 그림의 지붕 높이 */
'use strict';
const fs = require('fs');
const tryReq = m => { try { return require.resolve(m, { paths: [process.cwd(), __dirname] }); } catch (e) { return null; } };
const { chromium } = require(process.env.PW || tryReq('playwright') || 'playwright');
const src = process.argv[2], OUT_W = 248, IDS = ['furn', 'elec', 'health', 'safety'];
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('http://127.0.0.1:8767/index.html');
  const res = await p.evaluate(async ([src, OUT_W]) => {
    const im = new Image(); im.src = '/' + src.split('/').map(encodeURIComponent).join('/'); await im.decode();
    const W = im.naturalWidth, H = im.naturalHeight, out = [];
    for (let q = 0; q < 4; q++) {
      const qx = (q % 2) * (W >> 1), qy = (q >> 1) * (H >> 1), qw = W >> 1, qh = H >> 1;
      const c = document.createElement('canvas'); c.width = qw; c.height = qh; const g = c.getContext('2d');
      g.drawImage(im, qx, qy, qw, qh, 0, 0, qw, qh);
      const d = g.getImageData(0, 0, qw, qh), px = d.data, seen = new Uint8Array(qw * qh), st = [];
      const white = k => px[k * 4 + 3] < 20 || (px[k * 4] > 225 && px[k * 4 + 1] > 225 && px[k * 4 + 2] > 225);
      for (let x = 0; x < qw; x++) st.push(x, (qh - 1) * qw + x);
      for (let y = 0; y < qh; y++) st.push(y * qw, y * qw + qw - 1);
      while (st.length) { const k = st.pop(); if (seen[k] || !white(k)) continue; seen[k] = 1; px[k * 4 + 3] = 0; const x = k % qw; if (x > 0) st.push(k - 1); if (x < qw - 1) st.push(k + 1); if (k >= qw) st.push(k - qw); if (k < qw * (qh - 1)) st.push(k + qw); }
      g.putImageData(d, 0, 0);
      // 건물 범위 + 지붕 꼭대기(가장 넓은 줄이 시작하는 높이)
      let x0 = qw, x1 = 0, y0 = qh, y1 = 0; const rowW = new Array(qh).fill(0);
      for (let y = 0; y < qh; y++) { let l = -1, r = -1; for (let x = 0; x < qw; x++) if (px[(y * qw + x) * 4 + 3] > 20) { if (l < 0) l = x; r = x; } if (l >= 0) { rowW[y] = r - l; x0 = Math.min(x0, l); x1 = Math.max(x1, r); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
      const maxW = Math.max(...rowW), roofY = rowW.findIndex(w => w > maxW * 0.8);
      const s = OUT_W / (x1 - x0 + 1), oh = Math.round((y1 - y0 + 1) * s);
      const o = document.createElement('canvas'); o.width = OUT_W; o.height = oh; const og = o.getContext('2d');
      og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high'; og.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, OUT_W, oh);
      out.push({ png: o.toDataURL('image/png'), h: oh, roof: Math.round((roofY - y0) * s) });
    }
    return out;
  }, [src, OUT_W]);
  res.forEach((r, i) => { fs.writeFileSync('assets/shop_' + IDS[i] + '.png', Buffer.from(r.png.split(',')[1], 'base64')); console.log('assets/shop_' + IDS[i] + '.png', OUT_W + '×' + r.h, '지붕 꼭대기 y=' + r.roof); });
  await b.close();
})();
