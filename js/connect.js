/* 계약 연결 (2026-11-06 시험판 1단계, 개편안.md 7.0단계): 달이가 걸어 나르는 대신 '계약 카드 → 공방'을 눌러 체결하면 수레가 자동으로 납품한다.
   - 체결: 카드 선택 → 공방 터치. 조건(★)·등록(실사)·납품 칸을 확인. 체결하면 계약 시간이 멈춘다
   - 납품: 공방 → 마을을 CONNECT_SHIP_SPEED로 이동(CONNECT_SHIP_SEC 범위로 맞춤). 먼 공방일수록 오래 걸림. 도착하면 기존 검수·점수(requests.settle)
   - 공방별 동시 납품: CONNECT_SLOTS[공방 단계] + 물류 창고 보상
   - 브로커가 먼저 도착하면 납품 취소(broker.js가 cancel을 부름)
   C.CONNECT가 false면 이 파일은 아무 일도 하지 않고 옛 조작(달이 이동·구매)이 그대로 돈다. */
'use strict';
G.connect = (() => {
  const C = G.C, U = G.U, T = (...a) => G.world.text(...a);
  const r1 = v => Math.round(v * 10) / 10;

  function init(S) { S.sel = null; S.ships = []; S.shipMult = 1; S.slotBonus = 0; S.connectHint = true; }
  const slots = (S, sh) => C.CONNECT_SLOTS[sh.tier || 0] + (S.slotBonus || 0);
  const busy = (S, sh) => S.ships.filter(s => s.shop === sh).length;
  const hasSlot = (S, sh) => busy(S, sh) < slots(S, sh);
  const needsCheck = sh => sh.isNew && !sh.verified && !sh.innov;
  const speedNow = S => (S.shipMult || 1) * (S.storm ? C.STORM.speed : 1);
  // 도착까지 남은 초 (브로커가 노릴 수레를 고를 때)
  const secLeft = (S, r) => r.ship ? (1 - r.ship.p) * r.ship.dur / speedNow(S) : Infinity;

  // 이 공방이 이 계약을 받을 수 있나: ok / check(실사 전) / under(조건 미달) / full(납품 칸 없음) / other(다른 업종)
  function fit(S, sh, r) {
    if (G.ITEM[r.item].cat !== sh.cat) return 'other';
    if (needsCheck(sh)) return 'check';
    if (sh.q[r.item] < r.minQ) return 'under';
    if (!hasSlot(S, sh)) return 'full';
    return 'ok';
  }
  function select(S, r) {
    if (r.ship) { const b = G.ui.bubbleRect(r); G.fx.add(S, b.x + b.w / 2, b.y - 16, '납품 중이에요', '#cfe3f5'); return; }
    S.sel = S.sel === r ? null : r; S.connectHint = false;
    G.audio.play('ok');
  }
  function inspect(S, sh) {                                            // 새 공방: 나르미가 실사 (쉬는 중이면 대기열)
    if (!G.shops.whyNot(S, sh)) { G.shops.request(S, sh); return; }
    S.wantInspect = sh; const b = sh.w.body;
    G.fx.add(S, b.x + b.w / 2, b.y + 110, '나르미가 바빠요 · 곧 실사할게요', '#ffd6a0');
  }
  function say(S, sh, text, col) { const b = sh.w.body; G.fx.add(S, b.x + b.w / 2, b.y + 110, text, col || '#ffd6a0'); }
  function tapShop(S, sh) {
    if (!G.shops.isOpen(S, sh)) { say(S, sh, G.shops.whyNot(S, sh) || '지금은 계약할 수 없어요'); return; }
    if (needsCheck(sh)) { inspect(S, sh); return; }                    // 카드를 고른 상태면 선택은 그대로 (실사 뒤 바로 계약)
    if (!S.sel) { say(S, sh, '먼저 아래쪽 계약 카드를 눌러요'); return; }
    sign(S, S.sel, sh);
  }
  function sign(S, r, sh) {
    const why = fit(S, sh, r), name = G.ITEM[r.item].name;
    if (why === 'other') { say(S, sh, '이 공방엔 ' + name + G.U.josa(name, '이', '가') + ' 없어요'); return false; }
    if (why === 'under') { say(S, sh, name + G.U.josa(name, '은', '는') + ' 조건 미달 (★' + r.minQ + ' 이상 필요)', '#ff8a7a'); return false; }
    if (why === 'full') { say(S, sh, '납품 중이라 더 못 받아요 (' + busy(S, sh) + '/' + slots(S, sh) + ')'); return false; }
    if (why === 'check') { inspect(S, sh); return false; }
    launch(S, r, sh, G.shops.order(S, sh, r.item, r));
    S.sel = null;
    if (!S.firstShip) { S.firstShip = true; G.narmi.say('납품은 자동이에요! 브로커가 오면 눌러서 막아요', 2.6); }
    return true;
  }
  function launch(S, r, sh, b) {
    const d = sh.w.door, door = { x: d.x + d.w / 2, y: d.y + 14 }, path = [door, ...G.broker.pathTo(door, r.vill)];
    let len = 0; for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    const dur = U.clamp(len / C.CONNECT_SHIP_SPEED, C.CONNECT_SHIP_SEC[0], C.CONNECT_SHIP_SEC[1]);
    r.ship = { r, b, shop: sh, path, len, dur, p: 0, x: door.x, y: door.y, face: 1 };
    S.ships.push(r.ship);
  }
  function place(s) {
    let left = s.p * s.len;
    for (let i = 1; i < s.path.length; i++) {
      const a = s.path[i - 1], c = s.path[i], l = Math.hypot(c.x - a.x, c.y - a.y);
      if (left <= l || i === s.path.length - 1) {
        const k = l ? Math.min(1, left / l) : 1; s.x = a.x + (c.x - a.x) * k; s.y = a.y + (c.y - a.y) * k;
        if (Math.abs(c.x - a.x) > 1) s.face = c.x > a.x ? 1 : -1;
        return;
      }
      left -= l;
    }
  }
  function update(S, dt) {
    if (!C.CONNECT) return;
    if (S.sel && (S.sel.state !== 'open' || S.sel.ship)) S.sel = null;   // 고른 카드가 끝났으면 선택 해제
    for (const s of S.ships.slice()) {
      s.p = Math.min(1, s.p + dt * speedNow(S) / s.dur); place(s);
      if (s.p < 1) continue;
      S.ships.splice(S.ships.indexOf(s), 1); s.r.ship = null;
      G.requests.settle(S, s.r, s.b);
    }
  }
  // 브로커가 먼저 도착: 수레 취소, 쓴 돈은 낭비
  function cancel(S, r) {
    const s = r.ship; if (!s) return;
    S.ships.splice(S.ships.indexOf(s), 1); r.ship = null;
    S.wasted = r1(S.wasted + s.b.paid);
    S.stats.shipStolen = (S.stats.shipStolen || 0) + 1;
    G.fx.add(S, s.x, s.y - 30, '납품 취소 · 세금 ' + s.b.paid + '만원 낭비', '#ff8a7a');
  }
  // 누른 곳 처리. true면 여기서 끝 (false면 빈 땅 → 달이 이동)
  function tap(S, p) {
    const r = G.requests.active(S).find(q => { const b = G.ui.bubbleRect(q); return U.inRect(p.x, p.y, { x: b.x, y: b.y - 11, w: b.w, h: b.h + 18 }); });
    if (r) { select(S, r); return true; }
    const sh = S.shops.find(s => U.inRect(p.x, p.y, s.w.slot));
    if (sh) { tapShop(S, sh); return true; }
    const v = G.world.villages.find(v => U.inRect(p.x, p.y, v.slot));
    if (v) { const q = G.requests.ofVillage(S, v.id).filter(c => !c.ship).sort((a, b) => a.left - b.left)[0]; if (q && S.sel !== q) select(S, q); return true; }
    const o = G.world.office.body;
    return U.inRect(p.x, p.y, { x: o.x, y: o.y, w: o.w, h: o.h + 34 });
  }

  // ---------- 그리기 ----------
  function pill(ctx, cx, y, w, text, col) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(cx - w / 2 + 1, y + 2, w, 18);
    ctx.fillStyle = col; ctx.fillRect(cx - w / 2, y, w, 18);
    T(ctx, text, cx, y + 9, 12, '#fff');
  }
  // 공방 표시: 납품 칸, 그리고 카드를 고르면 받을 수 있는 곳 / 없는 곳
  function drawShops(ctx, S) {
    if (!C.CONNECT) return;
    const r = S.sel;
    for (const sh of S.shops) {
      if (!G.shops.isOpen(S, sh)) continue;
      const b = sh.w.body, cx = b.x + b.w / 2, y = b.y + b.h + 5, n = busy(S, sh), m = slots(S, sh);
      if (!r) { if (n) pill(ctx, cx, y, 92, '납품 중 ' + n + '/' + m, '#2f6fb5'); continue; }
      const st = fit(S, sh, r);
      if (st === 'other') { ctx.fillStyle = 'rgba(20,24,30,.42)'; ctx.fillRect(b.x, b.y, b.w, b.h); if (n) pill(ctx, cx, y, 92, '납품 중 ' + n + '/' + m, '#2f6fb5'); continue; }
      if (st === 'check') { pill(ctx, cx, y, 92, '눌러서 실사', '#0f8a96'); continue; }
      if (st === 'full') { pill(ctx, cx, y, 92, '납품 중 ' + n + '/' + m, '#5a6472'); continue; }
      if (S.hard) { pill(ctx, cx, y, 92, G.shops.price(sh, r.item) + '만', '#2a3646'); continue; }   // 하드: 조건 힌트 없음
      if (st === 'under') { ctx.fillStyle = 'rgba(217,52,43,.16)'; ctx.fillRect(b.x, b.y, b.w, b.h); pill(ctx, cx, y, 92, '조건 ✘', '#d9342b'); continue; }
      const on = 0.6 + Math.sin(S.elapsed * 6) * 0.4;
      ctx.strokeStyle = 'rgba(46,155,58,' + on.toFixed(2) + ')'; ctx.lineWidth = 3; ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4); ctx.lineWidth = 1;
      pill(ctx, cx, y, 92, '계약 ' + G.shops.price(sh, r.item) + '만', '#2e9b3a');
    }
  }
  // 납품 수레 (전기 납품 트럭을 받으면 트럭으로)
  function vehicle(ctx, x, y, face, item, truck, t) {
    const bob = Math.floor(t * 12) % 2;
    G.spr.shadow(ctx, x, y + 1, truck ? 20 : 15);
    ctx.save(); ctx.translate(Math.round(x), Math.round(y) - bob); ctx.scale(face, 1);
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
    if (truck) {
      R('#3a3a3a', -22, -23, 31, 20); R('#fffdf6', -21, -22, 29, 18);                   // 짐칸
      R('#3a3a3a', 9, -17, 14, 14); R('#2e9b3a', 10, -16, 12, 12); R('#bdeaff', 15, -14, 6, 5);   // 운전석
      R('#ffe066', 4, -12, 3, 2); R('#ffe066', 2, -9, 3, 2);                              // 번개
      R('#2a2a2a', -17, -4, 8, 5); R('#2a2a2a', 10, -4, 8, 5);
    } else {
      R('#3a3a3a', -15, -18, 30, 15); R('#c9a26b', -14, -17, 28, 13); R('#a07f4f', -14, -17, 28, 2);   // 나무 수레
      R('#4a3020', 15, -14, 7, 2);                                                         // 손잡이
      R('#2a2a2a', -11, -4, 7, 5); R('#2a2a2a', 4, -4, 7, 5);
    }
    ctx.restore();
    const ix = Math.round(x) - (truck ? face * 6 : 0), iy = Math.round(y) - bob - (truck ? 14 : 24);   // 물건이 수레 색에 묻히지 않게 흰 판 위에
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(ix - 11, iy - 11, 22, 22); ctx.fillStyle = '#fffdf6'; ctx.fillRect(ix - 10, iy - 10, 20, 20);
    G.icons.draw(ctx, item, ix, iy, 18);
  }
  function drawShips(ctx, S) {
    if (!C.CONNECT) return;
    for (const s of S.ships) vehicle(ctx, s.x, s.y, s.face, s.r.item, S.truck, S.elapsed);
  }
  // 말풍선 위층: 고른 카드 표시, 조작 안내
  function drawOver(ctx, S) {
    if (!C.CONNECT) return;
    const c = S.sel;
    if (c) {
      const b = G.ui.bubbleRect(c), name = G.ITEM[c.item].name, on = 0.65 + Math.sin(S.elapsed * 7) * 0.35;
      ctx.strokeStyle = 'rgba(255,216,74,' + on.toFixed(2) + ')'; ctx.lineWidth = 4; ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6); ctx.lineWidth = 1;
      if (!S.hard) {
        const text = name + ' ★' + c.minQ + ' 이상 · 맞는 공방을 눌러요';
        ctx.font = '12px ' + G.FONT; const w = ctx.measureText(text).width + 22;
        ctx.fillStyle = 'rgba(30,42,58,.92)'; ctx.fillRect(C.VIEW.w / 2 - w / 2, 196, w, 22); ctx.fillStyle = '#ffd84a'; ctx.fillRect(C.VIEW.w / 2 - w / 2, 196, w, 2);
        T(ctx, text, C.VIEW.w / 2, 208, 12, '#fff');
      }
    } else if (S.connectHint && !S.hard) {                              // 첫 카드: 어디를 누를지
      const r = G.requests.active(S).find(q => !q.ship); if (!r) return;
      const b = G.ui.bubbleRect(r), y = b.y - 38 + Math.sin(S.elapsed * 5) * 3;
      ctx.fillStyle = '#ffd84a'; ctx.fillRect(b.x + b.w / 2 - 42, y, 84, 20);
      ctx.beginPath(); ctx.moveTo(b.x + b.w / 2 - 6, y + 20); ctx.lineTo(b.x + b.w / 2 + 6, y + 20); ctx.lineTo(b.x + b.w / 2, y + 27); ctx.fill();
      T(ctx, '카드를 눌러요', b.x + b.w / 2, y + 10, 12, '#2a2416');
    }
  }
  return { init, update, tap, select, tapShop, sign, cancel, fit, slots, busy, hasSlot, needsCheck, secLeft, vehicle, drawShops, drawShips, drawOver };
})();
