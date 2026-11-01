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
      ctx.fillStyle = this.bag[i] && this.bag[i].innov ? '#e0a800' : '#3a3a3a'; ctx.fillRect(x - 1, y0 - 1, sz + 2, sz + 2);
      ctx.fillStyle = this.bag[i] ? '#fffdf6' : 'rgba(255,253,246,.45)'; ctx.fillRect(x, y0, sz, sz);
      const b = this.bag[i]; if (b) G.icons.draw(ctx, b.item, x + sz / 2, y0 + sz / 2, 14);
    }
    const B = S.buy;
    if (B && B.shop && B.dwell > 0) {
      const f = Math.min(1, B.dwell / (S.buyDwell || G.C.BUY_DWELL));
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,24,30,.6)'; ctx.beginPath(); ctx.arc(this.x, y0 - 12, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(this.x, y0 - 12, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke(); ctx.lineWidth = 1;
    }
  },
};
/* 나르미: 지붕에서 대기 → 지정한 공방으로 날아가 1초 검증 → 복귀 (기획서 3.6)
   상태: perch(대기) · fly(가는 중) · inspect(검증 중) · back(돌아오는 중) */
G.narmi = {
  x: 0, y: 0, face: 's', t: 0, state: 'perch', target: null, timer: 0, talk: null,
  reset() { const p = G.world.roofPerch; Object.assign(this, { x: p.x, y: p.y, face: 's', t: 0, state: 'perch', target: null, timer: 0, talk: null }); },
  say(text, sec) { this.talk = { text, left: sec }; },
  spot(sh) { const b = sh.w.body; return { x: b.x + b.w / 2, y: b.y + 62 }; },        // 공방 앞에 내려앉는 곳 (HUD에 가리지 않게)
  send(S, sh) { this.target = sh; this.state = 'fly'; S.inspectCD = G.C.INSPECT_COOLDOWN * (S.inspectCDMult || 1); S.inspectCDMax = S.inspectCD; },
  moveTo(p, dt) {
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy), step = G.C.NARMI_SPEED * dt;
    if (d <= step) { this.x = p.x; this.y = p.y; return true; }
    this.x += dx / d * step; this.y += dy / d * step; this.face = G.spr.dir8(dx, dy); return false;
  },
  update(dt, S) {
    this.t += dt;
    if (this.talk && (this.talk.left -= dt) <= 0) this.talk = null;
    if (S) S.inspectCD = Math.max(0, (S.inspectCD || 0) - dt);
    if (this.state === 'fly' && this.moveTo(this.spot(this.target), dt)) { this.state = 'inspect'; this.timer = 0; this.face = 's'; }
    else if (this.state === 'inspect' && (this.timer += dt) >= G.C.INSPECT_TIME) { G.shops.inspected(S, this.target); this.state = 'back'; }
    else if (this.state === 'back' && this.moveTo(G.world.roofPerch, dt)) { this.state = 'perch'; this.target = null; this.face = 's'; }
  },
  busy() { return this.state !== 'perch'; },
  draw(ctx) {
    const flying = this.state === 'fly' || this.state === 'back';
    const lift = flying ? 14 : 0, bob = Math.round(Math.sin(this.t * (flying ? 10 : 2)) * (flying ? 2.5 : 1.5));
    if (flying) G.spr.shadow(ctx, this.x, this.y + 18, 9);
    G.spr.drawChar(ctx, 'narmi', flying ? 'walk' : 'rot', this.face, this.t, this.x, this.y - lift + bob);
    if (this.talk) {                                     // 말풍선 (짧은 반응 한마디)
      ctx.font = '12px ' + G.FONT; const w = ctx.measureText(this.talk.text).width + 16, x = Math.round(this.x - w / 2), y = Math.round(this.y - 76);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 2, y + 3, w, 22);
      ctx.fillStyle = '#fffdf6'; ctx.fillRect(x, y, w, 22); ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + 20, w, 2); ctx.fillRect(x, y, 2, 22); ctx.fillRect(x + w - 2, y, 2, 22);
      ctx.fillStyle = '#fffdf6'; ctx.fillRect(this.x - 3, y + 22, 6, 4);
      G.world.text(ctx, this.talk.text, this.x, y + 11, 12, '#2a2416');
    }
    if (this.state === 'inspect') {                     // 데이터 분석: 화면판 + 자라는 막대그래프 + 진행 막대
      const f = this.timer / G.C.INSPECT_TIME, x = Math.round(this.x), y = Math.round(this.y + 36);   // 나르미 아래 길 쪽
      ctx.fillStyle = '#1e2a3a'; ctx.fillRect(x - 26, y - 22, 52, 30);
      ctx.fillStyle = '#5ec8f2'; ctx.fillRect(x - 26, y - 22, 52, 2);
      const hs = [0.5, 0.9, 0.35, 0.7];
      hs.forEach((h, i) => { const k = Math.min(1, f * 1.6 - i * 0.15); if (k > 0) { ctx.fillStyle = i % 2 ? '#9be37a' : '#5ec8f2'; const bh = Math.round(18 * h * k); ctx.fillRect(x - 20 + i * 11, y + 2 - bh, 7, bh); } });
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x - 22, y - 16 + Math.round(f * 18) % 18, 44, 1);   // 스캔 줄
      ctx.fillStyle = 'rgba(20,24,30,.85)'; ctx.fillRect(x - 26, y + 10, 52, 6);
      ctx.fillStyle = '#9be37a'; ctx.fillRect(x - 25, y + 11, Math.round(50 * f), 4);
      ctx.fillStyle = '#1e2a3a'; ctx.fillRect(x - 32, y + 16, 64, 16); G.world.text(ctx, '데이터 분석', x, y + 24, 12, '#fff');
    }
  },
};
