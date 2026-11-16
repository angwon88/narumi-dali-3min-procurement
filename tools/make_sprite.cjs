/* 건물 그림 만들기 (2026-11-16): 이미지 AI(Leonardo.ai)로 만든 정면 건물 그림 → 게임용 작은 PNG
   - 흰 배경을 투명하게 하고 건물만 잘라 냄. 벽 양옆에 딸려 나온 나무·울타리·땅 줄은 지움
   - 지붕(처마 포함) 폭을 칸 폭 + 8px(양쪽 처마 4px)에 맞추고, 높이는 1.15배까지만 늘림(납작한 칸에 맞추려고). 최대 높이 maxH
   - 마을: 유리창(밝은 파랑)이 꺼진 그림을 <이름>_dark.png로 함께 만듦 (피해 연출: 정전·휴관)
   - 게임은 2배 해상도로 그리므로(config RES) 결과 PNG도 기본 2배 크기(마을 456×136까지). world.js가 절반 크기로 그림
   - 이름표·기분 얼굴·깃대·단장 장식·배지는 코드가 위에 그림 (world.js · villages.js)
   사용: 서버 켠 상태에서 node tools/make_sprite.cjs <원본(저장소 안 경로)> <저장할 png> [칸 폭=220] [최대 높이=70] [배율=2]
   예: node tools/make_sprite.cjs docs/licenses/원본_건물/학교_LeonardoAI.jpg assets/village_school.png 220 70 */
'use strict';
const fs = require('fs');
const tryReq = m => { try { return require.resolve(m, { paths: [process.cwd(), __dirname] }); } catch (e) { return null; } };
const { chromium } = require(process.env.PW || tryReq('playwright') || 'playwright');
// 선택: --box 지붕위,벽위,벽아래,지붕왼,지붕오른,벽왼,벽오른 (원본 좌표, 자동 인식이 틀릴 때). 예: 도서관 --box 195,410,600,405,950,415,945
const argv = process.argv.slice(2), bi = argv.indexOf('--box'), box = bi >= 0 ? argv.splice(bi, 2)[1].split(',').map(Number) : null;
const [src, out, slotW = '220', maxH = '70', scale = '2'] = argv;
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('http://127.0.0.1:8767/index.html');
  const res = await p.evaluate(async ([src, slotW, maxH, scale, box]) => {
    const im = new Image(); im.src = '/' + src.split('/').map(encodeURIComponent).join('/'); await im.decode();
    const W = im.naturalWidth, H = im.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, W, H), px = d.data, at = (x, y) => (y * W + x) * 4;
    // 흰 배경: 가장자리에서 이어진 흰색만 지움 (창 유리·시계판처럼 건물 안의 흰색은 남김)
    const white = i => px[i] > 228 && px[i + 1] > 228 && px[i + 2] > 228, seen = new Uint8Array(W * H), stack = [];
    for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
    while (stack.length) {
      const k = stack.pop(); if (seen[k] || !white(k * 4)) continue;
      seen[k] = 1; px[k * 4 + 3] = 0; const x = k % W;
      if (x > 0) stack.push(k - 1); if (x < W - 1) stack.push(k + 1); if (k >= W) stack.push(k - W); if (k < W * (H - 1)) stack.push(k + W);
    }
    // 줄마다 '가운데 건물'에 이어진 구간만 (양옆 나무·깃대처럼 떨어진 것은 무시)
    const edge = y => {
      let c = -1; for (let d = 0; d < W * 0.15 && c < 0; d++) for (const x of [(W >> 1) - d, (W >> 1) + d]) if (c < 0 && px[at(x, y) + 3]) c = x;
      if (c < 0) return [-1, -1];
      let l = c, r = c; while (l > 0 && px[at(l - 1, y) + 3]) l--; while (r < W - 1 && px[at(r + 1, y) + 3]) r++;
      return [l, r];
    };
    // 지붕 꼭대기: 굴뚝보다 넓은 첫 줄
    let roofTop = 0; while (roofTop < H) { const [l, r] = edge(roofTop); if (l >= 0 && r - l > W * 0.25) break; roofTop++; }
    // 벽 시작: 지금까지의 가장 넓은 처마보다 양쪽이 안으로 들어온 첫 줄
    let minL = W, maxR = 0, wallTop = roofTop;
    for (; wallTop < H; wallTop++) {
      const [l, r] = edge(wallTop);
      if (l >= 0 && wallTop > roofTop + 4 && l > minL + 12 && r < maxR - 12) break;
      if (l >= 0) { minL = Math.min(minL, l); maxR = Math.max(maxR, r); }
    }
    let [wallL, wallR] = edge(wallTop + 3);
    if (box) { [roofTop, wallTop, , minL, maxR, wallL, wallR] = box; }   // 직접 지정(나무가 건물에 붙어 자동 인식이 틀릴 때)
    // 벽 줄부터는 벽 바깥(나무·울타리·땅)을 지움
    for (let y = wallTop; y < H; y++) for (let x = 0; x < W; x++) if (x < wallL || x > wallR) px[at(x, y) + 3] = 0;
    // 땅 줄(회색 길이나 초록 잔디가 대부분인 줄)부터 아래는 버림
    let wallBot = wallTop;
    for (let y = wallTop; y < H; y++) {
      let grey = 0, green = 0, n = 0;
      for (let x = wallL; x <= wallR; x++) { const i = at(x, y); if (!px[i + 3]) continue; n++; const [r, gg, bb] = [px[i], px[i + 1], px[i + 2]]; if (Math.abs(r - gg) < 14 && Math.abs(gg - bb) < 14 && r > 110) grey++; if (gg > r + 15 && gg > bb + 15) green++; }
      if (y > wallTop + 20 && n > (wallR - wallL) * 0.6 && (grey > n * 0.6 || green > n * 0.5)) break;
      if (n) wallBot = y;
    }
    if (box) wallBot = box[2];
    for (let y = wallBot + 1; y < H; y++) for (let x = 0; x < W; x++) px[at(x, y) + 3] = 0;
    if (box) for (let y = roofTop; y < wallTop; y++) for (let x = 0; x < W; x++) if (x < minL || x > maxR) px[at(x, y) + 3] = 0;   // 지붕 옆 나무도 지움
    g.putImageData(d, 0, 0);
    // 맞추기: 넓은 건물(학교)은 폭에 맞춤. 키 큰 건물(보건소·도서관)은 지붕 위쪽을 잘라 내고 높이에 맞춘 뒤 가로로 1.3배까지만 늘림(칸보다 좁으면 가운데)
    const roofW = maxR - minL + 1, HMAX = maxH * scale, wide = (slotW + 8) * scale;
    let OW = wide, OH = Math.round((wallBot - roofTop + 1) * (wide / roofW) * 1.15), srcTop = roofTop;
    if (OH > HMAX) {
      const wallH = wallBot - wallTop + 1, keep = Math.min(wallTop - roofTop, Math.round(wallH * 0.55)), sc = HMAX / (keep + wallH);
      srcTop = wallTop - keep; OH = HMAX; OW = Math.min(wide, Math.round(roofW * sc * Math.min(1.3, wide / (roofW * sc))));
    }
    const make = dark => {
      const o = document.createElement('canvas'); o.width = OW; o.height = OH;
      const og = o.getContext('2d'); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
      og.drawImage(c, minL, srcTop, roofW, wallBot - srcTop + 1, 0, 0, OW, OH);
      if (dark) {                                                     // 유리(밝은 파랑) → 꺼진 창
        const od = og.getImageData(0, 0, OW, OH), q = od.data;
        for (let i = 0; i < q.length; i += 4) {
          const [r, gg, bb] = [q[i], q[i + 1], q[i + 2]];
          if (q[i + 3] && ((bb > 140 && bb >= r + 20 && gg >= r) || (r > 215 && gg > 215 && bb > 215))) { q[i] = 59; q[i + 1] = 66; q[i + 2] = 80; q[i + 3] = 255; }
          else q[i + 3] = 0;                                          // 꺼진 창만 남김 (위에 덧그려도 이름표·배지를 덮지 않게)
        }
        og.putImageData(od, 0, 0);
      }
      return o.toDataURL('image/png');
    };
    return { size: [W, H], roofTop, wallTop, wallBot, roof: [minL, maxR], wall: [wallL, wallR], out: [OW, OH], png: make(false), dark: make(true) };
  }, [src, +slotW, +maxH, +scale, box]);
  fs.writeFileSync(out, Buffer.from(res.png.split(',')[1], 'base64'));
  fs.writeFileSync(out.replace(/\.png$/, '_dark.png'), Buffer.from(res.dark.split(',')[1], 'base64'));
  delete res.png; delete res.dark; console.log(out, JSON.stringify(res));
  await b.close();
})();
