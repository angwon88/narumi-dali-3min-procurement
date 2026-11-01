/* 떠오르는 글자. 같은 자리에서 동시에 생기면 한 줄씩 위로 밀어 겹치지 않게 한다 */
'use strict';
G.fx = (() => {
  const LIFE = 1.2;
  function add(S, x, y, text, col, size) {
    if (!S.floats) S.floats = [];
    const near = S.floats.filter(f => f.age < 0.7 && Math.abs(f.ax - x) < 60 && Math.abs(f.ay - y) < 30).length;
    S.floats.push({ ax: x, ay: y, x, y: y - near * 16, text, col: col || '#fff', size: size || 12, age: 0 });
  }
  // 파편 (적발 때 별·불꽃이 사방으로)
  function burst(S, x, y) {
    S.parts = S.parts || [];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 160;
      S.parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, age: 0, life: 0.6 + Math.random() * 0.4, col: ['#ffd84a', '#ff8a7a', '#fff', '#e2433b'][i % 4], sz: 2 + (i % 3) });
    }
  }
  // 동전: (x, y)에서 (tx, ty)로 날아감. 모두 도착하면 done()
  function coins(S, x, y, tx, ty, n, done) {
    S.parts = S.parts || [];
    for (let i = 0; i < n; i++) S.parts.push({ kind: 'coin', x, y, sx: x + (Math.random() - 0.5) * 60, sy: y - 30 - Math.random() * 40, tx, ty, age: -i * 0.05, life: 0.75, done: i === n - 1 ? done : null });
  }
  function update(S, dt) {
    if (S.floats) { for (const f of S.floats) f.age += dt; S.floats = S.floats.filter(f => f.age < LIFE); }
    if (!S.parts) return;
    for (const p of S.parts) {
      p.age += dt;
      if (p.kind === 'spark') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
      else if (p.kind === 'coin' && p.age >= p.life && p.done) { p.done(); p.done = null; G.audio.play('buy'); }
    }
    S.parts = S.parts.filter(p => p.age < p.life);
  }
  function drawParts(ctx, S) {
    if (!S.parts) return;
    for (const p of S.parts) {
      if (p.age < 0) continue;
      const k = p.age / p.life;
      if (p.kind === 'spark') { ctx.globalAlpha = 1 - k; ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz); }
      else {                                       // 위로 튀었다가 저금통으로 (베지어 곡선)
        const u = 1 - k, x = u * u * p.x + 2 * u * k * p.sx + k * k * p.tx, y = u * u * p.y + 2 * u * k * p.sy + k * k * p.ty;
        ctx.globalAlpha = 1; ctx.fillStyle = '#a07800'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a07800'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 3, 2, 6);
      }
    }
    ctx.globalAlpha = 1;
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
  return { add, update, draw, burst, coins, drawParts };
})();
