/* 달이(플레이어)와 나르미 */
'use strict';
G.dali = {
  x: 0, y: 0, face: 's', moving: false, t: 0, speed: G.C.DALI_SPEED,
  box(x, y) { return { x: x - 9, y: y - 8, w: 18, h: 10 }; },        // 발 아래 충돌 상자
  bag: [],
  reset() { Object.assign(this, { x: G.world.START.x, y: G.world.START.y, face: 's', moving: false, t: 0, speed: G.C.DALI_SPEED, bag: [] }); },
  update(dt) {
    const v = G.input.moveVec(), sp = this.speed * dt;
    this.moving = v.x !== 0 || v.y !== 0;
    if (this.moving) {
      const nx = this.x + v.x * sp, ny = this.y + v.y * sp;
      if (!G.world.blocked(this.box(nx, this.y))) this.x = nx;         // 축 분리 충돌: 벽을 따라 미끄러짐
      if (!G.world.blocked(this.box(this.x, ny))) this.y = ny;
      this.face = G.spr.dir8(v.x, v.y);
    }
    this.t += dt;
  },
  draw(ctx) {
    G.spr.shadow(ctx, this.x, this.y - 1, 12);
    G.spr.drawChar(ctx, 'dali', this.moving ? 'walk' : 'rot', this.face, this.t, this.x, this.y);
  },
  // 머리 위: 가방 칸 + 구매 게이지 (캐릭터 위에 그려야 해서 따로)
  drawOver(ctx, S) {
    const cap = S.bagCap, sz = 16, gap = 2, w = cap * sz + (cap - 1) * gap;
    const x0 = Math.round(this.x - w / 2), y0 = Math.round(this.y - 66);
    for (let i = 0; i < cap; i++) {
      const x = x0 + i * (sz + gap);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - 1, y0 - 1, sz + 2, sz + 2);
      ctx.fillStyle = this.bag[i] ? '#fffdf6' : 'rgba(255,253,246,.45)'; ctx.fillRect(x, y0, sz, sz);
      const b = this.bag[i]; if (b) G.icons.draw(ctx, b.item, x + sz / 2, y0 + sz / 2, 14);
    }
    const B = S.buy;
    if (B && B.shop && B.dwell > 0) {
      const f = Math.min(1, B.dwell / G.C.BUY_DWELL);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,24,30,.6)'; ctx.beginPath(); ctx.arc(this.x, y0 - 12, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(this.x, y0 - 12, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke(); ctx.lineWidth = 1;
    }
  },
};
G.narmi = {
  x: 0, y: 0, face: 's', t: 0,
  reset() { const p = G.world.roofPerch; Object.assign(this, { x: p.x, y: p.y, face: 's', t: 0 }); },
  update(dt) { this.t += dt; },
  draw(ctx) {
    const bob = Math.round(Math.sin(this.t * 2) * 1.5);
    G.spr.drawChar(ctx, 'narmi', 'rot', this.face, this.t, this.x, this.y + bob);
  },
};
