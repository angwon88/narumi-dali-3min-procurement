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
    this.t += dt * (this.speed / G.C.DALI_SPEED);                     // 빨라지면 걷는 동작도 빨라짐
  },
  draw(ctx) {
    const S = G.S, fast = this.speed > G.C.DALI_SPEED * 1.12;
    G.spr.shadow(ctx, this.x, this.y - 1, 12);
    if (fast && this.moving) {                                         // 발밑 먼지 (빨라진 걸 눈으로)
      for (let i = 0; i < 3; i++) {
        const k = ((this.t * 2) + i / 3) % 1, back = this.face.includes('e') ? -1 : this.face.includes('w') ? 1 : 0;
        ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = '#efe3c2';
        ctx.beginPath(); ctx.arc(this.x + back * (8 + k * 14), this.y - 2 - k * 4, 2 + k * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (S && S.scooter) { this.drawScooter(ctx); return; }
    G.spr.drawChar(ctx, 'dali', this.moving ? 'walk' : 'rot', this.face, this.t, this.x, this.y);
  },
  // 전동 킥보드 타기 (혁신제품 '전동 킥보드'). 방향별로 옆·정면·뒷모습을 따로 그린다
  drawScooter(ctx) {
    const f = this.face, x = Math.round(this.x), y = Math.round(this.y), mv = this.moving;
    const view = f === 's' ? 'front' : f === 'n' ? 'back' : 'side', dir = f.includes('w') ? -1 : 1;
    const bob = mv ? (Math.floor(this.t * 16) % 2) : 0;            // 길 위 덜컹거림
    const RISE = 5;                                                 // 발판 높이만큼 몸을 올림
    const DECK = '#2f6fb5', DECK2 = '#5ec8f2', DARK = '#2a2a2a', POLE = '#4a4f57';
    const wheel = (wx, wy, r) => {
      ctx.fillStyle = DARK; ctx.beginPath(); ctx.arc(wx, wy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9aa5b1'; const a = this.t * 20 * (mv ? 1 : 0);
      ctx.fillRect(Math.round(wx + Math.cos(a) * (r - 1.5)) - 1, Math.round(wy + Math.sin(a) * (r - 1.5)) - 1, 2, 2);
    };
    const battery = (bx, by) => { ctx.fillStyle = Math.floor(this.t * 3) % 2 ? '#9be37a' : '#4caf50'; ctx.fillRect(bx, by, 3, 2); };
    // 속도선 (뒤쪽으로)
    if (mv) {
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (let i = 0; i < 3; i++) {
        const k = ((this.t * 3) + i / 3) % 1, len = 8 + i * 3;
        if (view === 'side') ctx.fillRect(x - dir * (20 + k * 16) - (dir > 0 ? len : 0), y - 6 - i * 7, len, 1);
        else ctx.fillRect(x - 12 + i * 12, y + (view === 'front' ? -40 - k * 10 : 6 + k * 10), 1, 6);
      }
    }
    G.spr.shadow(ctx, x, y + 2, 16);
    if (view === 'side') {
      // 발판 + 앞뒤 바퀴
      wheel(x - dir * 13, y + 1, 3.5); wheel(x + dir * 15, y + 1, 3.5);
      ctx.fillStyle = DECK; ctx.fillRect(x - 15, y - 4 - bob, 30, 4);
      ctx.fillStyle = DECK2; ctx.fillRect(x - 15, y - 4 - bob, 30, 1);
      battery(x - dir * 6 - 1, y - 2 - bob);
      // 몸: 발판 위에 서서 진행 방향으로 살짝 기울임
      const lean = mv ? dir * 0.12 : 0;
      ctx.save(); ctx.translate(x, y - RISE - bob); ctx.rotate(lean);
      G.spr.drawChar(ctx, 'dali', 'rot', f, this.t, 0, 0);
      ctx.restore();
      // 손잡이 기둥(몸 앞) + 손잡이 — 손 높이(발에서 약 11px)에 닿게
      const px = x + dir * 15;
      ctx.fillStyle = POLE; ctx.beginPath();
      ctx.moveTo(px - 1, y - 2 - bob); ctx.lineTo(px + 1, y - 2 - bob); ctx.lineTo(px - dir * 3 + 1, y - 19 - bob); ctx.lineTo(px - dir * 3 - 1, y - 19 - bob); ctx.fill();
      ctx.fillStyle = DARK; ctx.fillRect(px - dir * 3 - 4, y - 21 - bob, 8, 3);       // 손잡이
      ctx.fillStyle = '#ffe066'; ctx.fillRect(px + dir * 1 - 1, y - 12 - bob, 2, 2);  // 앞 라이트
    } else if (view === 'front') {
      // 정면: 앞바퀴는 발 앞, 기둥은 배 앞, T자 손잡이는 손 높이
      ctx.fillStyle = DECK; ctx.fillRect(x - 4, y - 5 - bob, 8, 6);
      G.spr.drawChar(ctx, 'dali', 'rot', f, this.t, x, y - RISE - bob);
      wheel(x, y + 2, 3.5);
      ctx.fillStyle = POLE; ctx.fillRect(x - 1, y - 15 - bob, 3, 13);
      ctx.fillStyle = DARK; ctx.fillRect(x - 14, y - 17 - bob, 29, 3);              // 손 높이 (얼굴 아래)
      ctx.fillStyle = DECK2; ctx.fillRect(x - 14, y - 17 - bob, 3, 3); ctx.fillRect(x + 12, y - 17 - bob, 3, 3);
      ctx.fillStyle = '#ffe066'; ctx.fillRect(x - 1, y - 8 - bob, 3, 2);
    } else {
      // 뒷모습: 손잡이 끝이 몸 양옆으로 보이고, 뒷바퀴·발판 끝이 발밑에
      ctx.fillStyle = DARK; ctx.fillRect(x - 17, y - 19 - bob, 34, 3);
      G.spr.drawChar(ctx, 'dali', 'rot', f, this.t, x, y - RISE - bob);
      ctx.fillStyle = DECK; ctx.fillRect(x - 4, y - 5 - bob, 8, 5);
      ctx.fillStyle = '#e2433b'; ctx.fillRect(x - 2, y - 3 - bob, 4, 2);              // 미등
      wheel(x, y + 2, 3.5);
    }
  },
  // 머리 위: 가방 칸 + 구매 게이지 (캐릭터 위에 그려야 해서 따로)
  drawOver(ctx, S) {
    const cap = S.bagCap, sz = 22, gap = 2, w = cap * sz + (cap - 1) * gap;
    const x0 = Math.round(this.x - w / 2), y0 = Math.round(this.y - 72);
    for (let i = 0; i < cap; i++) {
      const x = x0 + i * (sz + gap);
      ctx.fillStyle = this.bag[i] && this.bag[i].innov ? '#e0a800' : '#3a3a3a'; ctx.fillRect(x - 1, y0 - 1, sz + 2, sz + 2);
      ctx.fillStyle = this.bag[i] ? '#fffdf6' : 'rgba(255,253,246,.45)'; ctx.fillRect(x, y0, sz, sz);
      const b = this.bag[i]; if (b) G.icons.draw(ctx, b.item, x + sz / 2, y0 + sz / 2, 20);
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
  spot(sh) { if (sh.isBroker) return { x: sh.x, y: sh.y - 10 }; const b = sh.w.body; return { x: b.x + b.w / 2, y: b.y + 62 }; },   // 공방 앞(HUD에 가리지 않게) / 꼼수 브로커 위치
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
    const tg = this.target;
    if (tg && tg.isBroker && (this.state === 'fly' || this.state === 'inspect') && tg.state !== 'grab' && tg.state !== 'run') { tg.stun = false; this.state = 'back'; }   // 놓침
    else if (this.state === 'fly' && this.moveTo(this.spot(tg), dt)) { this.state = 'inspect'; this.timer = 0; this.face = 's'; if (tg.isBroker) tg.stun = true; }
    else if (this.state === 'inspect' && (this.timer += dt) >= (tg.isBroker ? G.C.BROKER_CATCH_TIME : G.C.INSPECT_TIME)) {
      if (tg.isBroker) G.broker.caught(S); else G.shops.inspected(S, tg);
      this.state = 'back';
    }
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
