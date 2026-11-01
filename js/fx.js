/* 떠오르는 글자. 같은 자리에서 동시에 생기면 한 줄씩 위로 밀어 겹치지 않게 한다 */
'use strict';
G.fx = (() => {
  const LIFE = 1.2;
  function add(S, x, y, text, col, size) {
    if (!S.floats) S.floats = [];
    const near = S.floats.filter(f => f.age < 0.7 && Math.abs(f.ax - x) < 60 && Math.abs(f.ay - y) < 30).length;
    S.floats.push({ ax: x, ay: y, x, y: y - near * 16, text, col: col || '#fff', size: size || 12, age: 0 });
  }
  function update(S, dt) {
    if (!S.floats) return;
    for (const f of S.floats) f.age += dt;
    S.floats = S.floats.filter(f => f.age < LIFE);
  }
  function draw(ctx, S) {
    if (!S.floats) return;
    for (const f of S.floats) {
      const k = f.age / LIFE, y = f.y - 22 * Math.min(1, k * 1.6);
      ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      ctx.font = f.size + 'px ' + G.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,24,30,.85)'; ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, y);
      ctx.lineWidth = 1; ctx.globalAlpha = 1;
    }
  }
  return { add, update, draw };
})();
