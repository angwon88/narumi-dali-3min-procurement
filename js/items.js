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
  const cache = {};
  // 각 아이콘: [색, x, y, w, h] 사각형 목록 (16×16 격자)
  const SHAPES = {
    desk: [['#6b4423', 1, 5, 14, 3], ['#8a5a30', 1, 5, 14, 1], ['#6b4423', 2, 8, 2, 6], ['#6b4423', 12, 8, 2, 6], ['#4f321a', 4, 8, 8, 2]],
    chair: [['#8a5a30', 4, 1, 2, 13], ['#8a5a30', 4, 2, 8, 2], ['#6b4423', 4, 8, 9, 2], ['#6b4423', 11, 10, 2, 4], ['#4f321a', 4, 6, 8, 1]],
    tablet: [['#2b2f3a', 2, 2, 12, 12], ['#5ec8f2', 3, 3, 10, 9], ['#bff0ff', 4, 4, 4, 2], ['#8a93a6', 7, 12, 2, 1]],
    lamp: [['#ffe066', 4, 1, 8, 8], ['#fff6c2', 5, 2, 3, 3], ['#c9b16a', 6, 9, 4, 2], ['#7d7d7d', 6, 11, 4, 3], ['#5a5a5a', 5, 14, 6, 1]],
    mask: [['#9fd3ff', 1, 6, 3, 1], ['#9fd3ff', 12, 6, 3, 1], ['#9fd3ff', 1, 10, 3, 1], ['#9fd3ff', 12, 10, 3, 1], ['#f4f8fb', 3, 5, 10, 7], ['#c9d6e0', 3, 7, 10, 1], ['#c9d6e0', 3, 9, 10, 1]],
    kit: [['#f4f4f4', 1, 4, 14, 10], ['#c9c9c9', 1, 13, 14, 1], ['#e2433b', 7, 6, 2, 6], ['#e2433b', 5, 8, 6, 2], ['#7d7d7d', 6, 2, 4, 2]],
    ext: [['#d9342b', 5, 4, 6, 11], ['#ff6a5e', 6, 5, 1, 8], ['#2b2b2b', 6, 2, 4, 2], ['#2b2b2b', 10, 2, 3, 1], ['#2b2b2b', 12, 3, 1, 4], ['#f4f4f4', 6, 8, 4, 3]],
    helmet: [['#f5c518', 3, 4, 10, 7], ['#f5c518', 2, 9, 12, 2], ['#ffe27a', 5, 5, 3, 2], ['#d39e00', 1, 11, 14, 2], ['#d39e00', 7, 3, 2, 8]],
  };
  function get(id) {
    if (cache[id]) return cache[id];
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d');
    for (const [col, x, y, w, h] of SHAPES[id] || []) { g.fillStyle = col; g.fillRect(x, y, w, h); }
    return (cache[id] = c);
  }
  // 가운데 (cx, cy), 크기 size
  function draw(ctx, id, cx, cy, size) {
    const s = size || 24; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(get(id), Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
  }
  return { draw };
})();
