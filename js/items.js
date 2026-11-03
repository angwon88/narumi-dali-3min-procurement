/* 물건 8종 (기획서 3.3) — 예정가격 단위: 만원. 아이콘은 16px 임시 픽셀아트(코드로 그림) */
'use strict';
G.ITEMS = [
  { id: 'desk', name: '책상', cat: 'furn', price: 12 },
  { id: 'chair', name: '의자', cat: 'furn', price: 8 },
  { id: 'tablet', name: '태블릿', cat: 'elec', price: 30 },
  { id: 'lamp', name: '전등', cat: 'elec', price: 6 },
  { id: 'mask', name: '마스크', cat: 'health', price: 4 },
  { id: 'kit', name: '구급상자', cat: 'health', price: 9 },
  { id: 'ext', name: '소화기', cat: 'safety', price: 11 },
  { id: 'helmet', name: '안전모', cat: 'safety', price: 7 },
];
G.ITEM = Object.fromEntries(G.ITEMS.map(i => [i.id, i]));

G.icons = (() => {
  // 2026-11-02 가시성 개선: 24×24 격자로 다시 그리고, 자동으로 1px 어두운 테두리를 둘러 어떤 바탕에서도 또렷하게
  // 각 아이콘: [색, x, y, w, h] 사각형 목록
  const SHAPES = {
    desk: [['#8a5a30', 1, 7, 22, 4], ['#b07a45', 1, 7, 22, 1], ['#6b4423', 3, 11, 3, 11], ['#6b4423', 18, 11, 3, 11],
           ['#7a4f2a', 8, 11, 8, 5], ['#d9b25a', 11, 13, 2, 1]],
    chair: [['#8a5a30', 5, 1, 3, 22], ['#b07a45', 8, 3, 9, 2], ['#b07a45', 8, 7, 9, 2], ['#8a5a30', 16, 1, 2, 11],
            ['#6b4423', 5, 12, 15, 3], ['#8a5a30', 17, 15, 3, 8]],
    tablet: [['#2b2f3a', 4, 1, 16, 22], ['#3d8fd0', 6, 3, 12, 15], ['#9fdcff', 7, 4, 5, 3], ['#7d8590', 11, 20, 2, 2]],
    lamp: [['#ffe066', 7, 1, 10, 3], ['#ffe066', 5, 3, 14, 7], ['#ffe066', 7, 10, 10, 3], ['#fff6c2', 7, 4, 4, 3],
           ['#c9b16a', 9, 13, 6, 2], ['#9aa5b1', 8, 15, 8, 2], ['#7d8590', 8, 17, 8, 2], ['#9aa5b1', 8, 19, 8, 1], ['#4a4f57', 10, 20, 4, 2],
           ['#fff3a0', 2, 5, 2, 1], ['#fff3a0', 20, 5, 2, 1], ['#fff3a0', 11, 0, 2, 1]],
    mask: [['#7fb8e8', 0, 9, 2, 6], ['#7fb8e8', 1, 8, 4, 1], ['#7fb8e8', 1, 15, 4, 1], ['#7fb8e8', 22, 9, 2, 6], ['#7fb8e8', 19, 8, 4, 1], ['#7fb8e8', 19, 15, 4, 1],
           ['#f4f8fb', 4, 7, 16, 11], ['#f4f8fb', 6, 6, 12, 1], ['#f4f8fb', 6, 18, 12, 1],
           ['#c3d3e0', 4, 10, 16, 1], ['#c3d3e0', 4, 13, 16, 1], ['#9aa5b1', 8, 6, 8, 1]],
    kit: [['#4a4f57', 8, 2, 8, 2], ['#4a4f57', 8, 2, 2, 5], ['#4a4f57', 14, 2, 2, 5],
          ['#d9342b', 2, 6, 20, 15], ['#a8231b', 2, 19, 20, 2], ['#ff6a5e', 2, 6, 20, 1],
          ['#ffffff', 10, 9, 4, 10], ['#ffffff', 7, 12, 10, 4]],
    ext: [['#2b2b2b', 9, 1, 6, 4], ['#2b2b2b', 15, 2, 5, 2], ['#2b2b2b', 18, 3, 2, 9],
          ['#d9342b', 8, 5, 8, 18], ['#d9342b', 9, 4, 6, 1], ['#ff6a5e', 9, 6, 2, 15], ['#a8231b', 14, 6, 2, 17],
          ['#f4f4f4', 9, 11, 6, 5], ['#2b2b2b', 10, 13, 4, 1]],
    helmet: [['#f5c518', 9, 4, 6, 1], ['#f5c518', 7, 5, 10, 2], ['#f5c518', 5, 7, 14, 9], ['#ffe27a', 7, 7, 3, 4],
             ['#d39e00', 11, 4, 2, 12], ['#d39e00', 1, 16, 22, 3], ['#a87d00', 1, 18, 22, 1]],
  };
  const N = 24, cache = {};
  function get(id) {
    if (cache[id]) return cache[id];
    const c = document.createElement('canvas'); c.width = c.height = N + 2;
    const g = c.getContext('2d');
    for (const [col, x, y, w, h] of SHAPES[id] || []) { g.fillStyle = col; g.fillRect(x + 1, y + 1, w, h); }
    // 1px 테두리: 칠해진 칸 바깥쪽 이웃을 어둡게
    const img = g.getImageData(0, 0, N + 2, N + 2), d = img.data, out = new Uint8ClampedArray(d);
    const A = (x, y) => (x < 0 || y < 0 || x > N + 1 || y > N + 1) ? 0 : d[(y * (N + 2) + x) * 4 + 3];
    for (let y = 0; y < N + 2; y++) for (let x = 0; x < N + 2; x++) {
      const i = (y * (N + 2) + x) * 4;
      if (!A(x, y)) {
        if (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1)) { out[i] = 40; out[i + 1] = 34; out[i + 2] = 28; out[i + 3] = 230; }
        continue;
      }
      // 2026-11-03 입체 음영: 위·왼쪽이 비어 있으면 밝게(빛), 아래·오른쪽이 비어 있으면 어둡게(그림자)
      const lit = !A(x, y - 1) || !A(x - 1, y), shade = !A(x, y + 1) || !A(x + 1, y);
      const f = lit && !shade ? 1.22 : shade && !lit ? 0.72 : 1;
      if (f !== 1) for (let k = 0; k < 3; k++) out[i + k] = Math.min(255, d[i + k] * f + (f > 1 ? 18 : 0));
    }
    g.putImageData(new ImageData(out, N + 2, N + 2), 0, 0);
    return (cache[id] = c);
  }
  // 품질 별 (개편): 7×7 픽셀 별을 u배로. (x, y) 왼쪽 위부터 max칸, n칸만 금색(나머지는 옅은 회색). 한 칸 = 7u + u 간격
  const STAR = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'];
  function stars(ctx, x, y, n, max, u) {
    u = u || 1;
    for (let i = 0; i < (max || 3); i++) {
      const ox = Math.round(x + i * 8 * u), on = i < n;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        if (STAR[r][c] !== '#') continue;
        ctx.fillStyle = on ? (r < 3 ? '#ffc21a' : '#e09a00') : '#d6cdb6';
        ctx.fillRect(ox + c * u, y + r * u, u, u);
      }
    }
  }
  // 가운데 (cx, cy), 크기 size
  function draw(ctx, id, cx, cy, size) {
    const s = size || 24; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(get(id), Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
  }
  return { draw, stars };
})();
