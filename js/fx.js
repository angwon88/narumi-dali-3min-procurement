/* 떠오르는 글자. 같은 자리에서 동시에 생기면 한 줄씩 위로 밀어 겹치지 않게 한다 */
'use strict';
G.fx = (() => {
  const LIFE = 1.2;
  function add(S, x, y, text, col, size) {
    if (!S.floats) S.floats = [];
    if (S.ultQuiet) return;                                            // 11-04 AI 조사 스캔 중엔 도장이 대신 알려 줌
    if (S.floats.some(f => f.text === text && f.age < 0.5 && Math.abs(f.ax - x) < 40)) return;   // 11-04 같은 글자가 같은 자리에 또 뜨면 생략
    let near = S.floats.filter(f => f.age < 0.7 && Math.abs(f.ax - x) < 60 && Math.abs(f.ay - y) < 30);
    if (near.length >= 3) { near[0].age = LIFE; near = near.slice(1); }   // 한 자리에 최대 3줄: 가장 오래된 것부터 지움
    const live = S.floats.filter(f => f.age < LIFE); if (live.length >= 12) live[0].age = LIFE;   // 화면 전체 최대 12개
    const up = near.reduce((a, f) => a + Math.max(16, f.size + 6), 0);   // 먼저 뜬 글자 크기만큼 위로 (큰 글자와도 안 겹치게)
    S.floats.push({ ax: x, ay: y, x, y: y - up, text, col: col || '#fff', size: size || 12, age: 0 });
  }
  // 파편 (적발 때 별·불꽃이 사방으로)
  const GOLD = ['#ffd84a', '#fff3a0', '#fff', '#e0a800'];
  function burst(S, x, y, gold, n) {
    S.parts = S.parts || [];
    const paper = gold === 'paper', pal = paper ? ['#ffffff', '#f4efe0', '#e8e2d0', '#ffffff'] : gold ? GOLD : ['#ffd84a', '#ff8a7a', '#fff', '#e2433b'];
    for (let i = 0; i < (n || 26); i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * (gold ? 240 : 160);
      S.parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * v * (paper ? 0.8 : 1), vy: Math.sin(a) * v - (paper ? 140 : 60), age: 0, life: paper ? 1.2 + Math.random() * 0.5 : 0.6 + Math.random() * (gold ? 0.7 : 0.4), col: pal[i % 4], sz: paper ? 5 + (i % 3) : 2 + (i % 3) + (gold && i % 5 === 0 ? 2 : 0), paper });
    }
  }
  // 동전: (x, y)에서 (tx, ty)로 날아감. 모두 도착하면 done()
  function coins(S, x, y, tx, ty, n, done, look, delay) {
    S.parts = S.parts || [];
    for (let i = 0; i < n; i++) S.parts.push({ kind: 'coin', look: look || 'coin', x, y, sx: (x + tx) / 2 + (Math.random() - 0.5) * 60, sy: Math.min(y, ty) - 40 - Math.random() * 40, tx, ty, age: -i * 0.05 - (delay || 0), life: 0.75, done: i === n - 1 ? done : null });
  }
  function update(S, dt) {
    if (S.floats) { for (const f of S.floats) f.age += dt; S.floats = S.floats.filter(f => f.age < LIFE); }
    if (!S.parts) return;
    for (const p of S.parts) {
      p.age += dt;
      if (p.kind === 'spark') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.paper ? 160 : 300) * dt; if (p.paper) p.vx *= 0.98; }
      else if (p.kind === 'coin' && p.age >= p.life && p.done) { p.done(); p.done = null; G.audio.play('buy'); }
    }
    S.parts = S.parts.filter(p => p.age < p.life);
  }
  function drawParts(ctx, S) {
    if (!S.parts) return;
    for (const p of S.parts) {
      if (p.age < 0) continue;
      const k = p.age / p.life;
      if (p.kind === 'spark') { ctx.globalAlpha = 1 - k; ctx.fillStyle = p.col; if (p.paper) { const f = Math.abs(Math.sin(p.age * 9 + p.sz)); ctx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, Math.max(1, Math.round(p.sz * 1.3 * f))); ctx.fillStyle = '#b9b2a0'; ctx.fillRect(Math.round(p.x) + 1, Math.round(p.y) + 1, p.sz - 2, 1); } else ctx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz); }
      else {                                       // 위로 튀었다가 저금통으로 (베지어 곡선)
        const u = 1 - k, x = u * u * p.x + 2 * u * k * p.sx + k * k * p.tx, y = u * u * p.y + 2 * u * k * p.sy + k * k * p.ty;
        ctx.globalAlpha = 1;
        if (p.look === 'crate') { G.events.crate(ctx, Math.round(x) - 7, Math.round(y) - 6); continue; }
        ctx.fillStyle = '#a07800'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
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
      const hw = ctx.measureText(f.text).width / 2 + 4, x = Math.max(hw, Math.min(G.C.VIEW.w - hw, f.x));   // 화면 밖으로 잘리지 않게
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,24,30,.85)'; ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.col; ctx.fillText(f.text, x, y);
      ctx.lineWidth = 1; ctx.globalAlpha = 1;
    }
  }
  return { add, update, draw, burst, coins, drawParts };
})();
