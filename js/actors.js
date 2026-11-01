/* 달이(플레이어)와 나르미 */
'use strict';
G.dali = {
  x: 0, y: 0, face: 's', moving: false, t: 0, speed: G.C.DALI_SPEED,
  box(x, y) { return { x: x - 9, y: y - 8, w: 18, h: 10 }; },        // 발 아래 충돌 상자
  reset() { Object.assign(this, { x: G.world.START.x, y: G.world.START.y, face: 's', moving: false, t: 0, speed: G.C.DALI_SPEED }); },
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
