/* 브로커 (개편 2026-11-02): 계약을 가로채 불량품을 납품하려는 AI 라이벌 너구리.
   실제 근거: 낙찰만 노리는 페이퍼컴퍼니·입찰 브로커, 계약과 다른 물건 납품 → 조달청은 데이터로 의심 업체를 골라
   입찰보증금 부과(2026-11부터), 계약 해지·입찰참가자격 제한. 게임에서는 '입찰 경쟁'을 '납품 경주'로 보여 준다.
   흐름: off(쉬는 중) → grab(페이퍼컴퍼니 문 앞에서 불량품 챙김) → run(노린 마을로) → 도착하면 부정 납품
         · 달이가 먼저 납품하면 다른 같은 물건 계약으로 갈아타거나 허탕 → flee
         · 브로커를 누르면 나르미가 쫓아가 적발(caught), 그 페이퍼컴퍼니도 함께 드러남 */
'use strict';
G.broker = (() => {
  const C = G.C, U = G.U, T = (...a) => G.world.text(...a);
  const ROAD_Y = 192, LOW_Y = 378, OFFICE = [398, 562];

  function init(S) {
    S.bk = { isBroker: true, state: 'off', x: -40, y: ROAD_Y, t: 0, wait: 0,   // BROKER_FIRST_AT이 되자마자 등장 (2026-11-03 수정: 전에는 거기서 또 같은 시간을 기다려 2배 늦게 나왔음)
      req: null, shop: null, item: null,
      path: [], face: 1, stun: false, timer: 0, shown: false, freeze: 0, blockCD: 0 };
    Object.assign(S.stats, { brokerWon: 0, brokerBlocked: 0, brokerCaught: 0 });
  }
  const speed = S => U.clamp(C.BROKER_SPEED[0] + (C.BROKER_SPEED[1] - C.BROKER_SPEED[0]) * (S.elapsed - C.BROKER_FIRST_AT) / (C.GAME_SECONDS - C.BROKER_FIRST_AT), C.BROKER_SPEED[0], C.BROKER_SPEED[1]);

  // 문 앞 → 길 → (조달청 건물 피해서) 아래 길 → 마을 앞마당
  function pathTo(bk, v) {
    const yx = v.yard.x + v.yard.w / 2;
    const lane = yx > OFFICE[0] && yx < OFFICE[1] ? (yx < 480 ? OFFICE[0] - 4 : OFFICE[1] + 4) : yx;
    return [{ x: bk.x, y: ROAD_Y }, { x: lane, y: ROAD_Y }, { x: lane, y: LOW_Y }, { x: yx, y: LOW_Y }, { x: yx, y: v.yard.y + 18 }];
  }
  function fleePath(bk) { const left = bk.x < 480; return [{ x: bk.x, y: Math.min(bk.y, LOW_Y) }, { x: bk.x, y: ROAD_Y }, { x: left ? -40 : 1000, y: ROAD_Y }]; }

  // 노릴 계약 고르기: 아직 안 노린 열린 계약 중 비싼 것부터. 불량품을 들고 가까운 화면 가장자리 길에서 달려 들어옴
  // (2026-11-02 조정: 페이퍼컴퍼니 공방에 들르게 했더니 공방 실사로 너무 쉽게 막혀 분리. 막는 법 = 먼저 납품 / 브로커를 눌러 적발)
  function plan(S) {
    const bk = S.bk;
    const reqs = G.requests.active(S).filter(r => !r.broker && r.left > 8).sort((a, b) => b.price - a.price);
    for (const r of reqs) {
      const yx = r.vill.yard.x + r.vill.yard.w / 2;
      // 2026-11-03: 가장자리 마을(학교·도서관)은 달릴 거리가 짧아 알아챌 틈이 없었음 → 먼저 화면 끝에 나타나 BROKER_GRAB초 두리번(이때도 잡을 수 있음)
      Object.assign(bk, { state: 'grab', timer: 0, req: r, shop: null, item: r.item, x: yx < 480 ? 34 : C.VIEW.w - 34, y: ROAD_Y, face: yx < 480 ? 1 : -1, stun: false, path: [] });
      r.broker = true;
      if (!bk.shown) {
        bk.shown = true;
        G.director.banner(S, '브로커 등장!', '계약을 가로채 불량품을 넣으려 해요 · 먼저 납품하거나, 브로커를 눌러 나르미로 적발!');
        G.narmi.say('저 너구리, 수상해요!', 2.4);
      }
      G.audio.play('whoosh');
      return true;
    }
    return false;
  }
  function rest(S, sec) { const bk = S.bk; if (bk.req) bk.req.broker = false; Object.assign(bk, { state: 'off', wait: sec, req: null, shop: null, item: null, path: [] }); }
  function flee(S, msg, col) {
    const bk = S.bk; if (bk.req) bk.req.broker = false;
    bk.req = null; bk.state = 'flee'; bk.path = fleePath(bk);
    if (msg) G.fx.add(S, bk.x, bk.y - 46, msg, col || '#9be37a', 16);
  }
  function step(bk, dt, sp) {
    const p = bk.path[0]; if (!p) return true;
    const dx = p.x - bk.x, dy = p.y - bk.y, d = Math.hypot(dx, dy), s = sp * dt;
    if (Math.abs(dx) > 1) bk.face = dx > 0 ? 1 : -1;
    if (d <= s) { bk.x = p.x; bk.y = p.y; bk.path.shift(); return !bk.path.length; }
    bk.x += dx / d * s; bk.y += dy / d * s; return false;
  }

  function update(S, dt) {
    const bk = S.bk; if (!bk) return;
    bk.t += dt;
    if (bk.stun) return;                                              // 나르미가 붙잡는 중
    if (bk.state === 'off') {
      if (S.elapsed < C.BROKER_FIRST_AT || C.BROKER === false || S.elapsed < (S.brokerPauseUntil || 0)) return;   // 필살기 뒤 잠시 쉼
      if ((bk.wait -= dt) <= 0 && !plan(S)) bk.wait = 1;
      return;
    }
    if (bk.state === 'caught') { if ((bk.timer += dt) >= 1.2) rest(S, C.BROKER_REST * 1.5); return; }
    // 그사이 페이퍼컴퍼니가 적발되면 계약이 무효 → 도망
    if ((bk.state === 'grab' || bk.state === 'run') && bk.shop && (bk.shop.status !== 'open' || !bk.shop.fake)) {
      S.stats.brokerBlocked++; flee(S, '들켰다! 브로커 도망', '#9be37a'); return;
    }
    if (bk.state === 'grab') {                                         // 두리번 (등장 예고)
      if (bk.req.state !== 'open') { flee(S, '쳇, 벌써 납품했네…', '#ffd6a0'); return; }
      if ((bk.timer += dt) >= C.BROKER_GRAB) { bk.state = 'run'; bk.face = bk.req.vill.yard.x + 110 > bk.x ? 1 : -1; bk.path = pathTo(bk, bk.req.vill); }
      return;
    }
    if (bk.state === 'run') {
      const r = bk.req;
      // 달이가 길을 막으면 1초 멈칫 (검거는 나르미만). 같은 브로커는 2.5초에 한 번만
      bk.blockCD = Math.max(0, (bk.blockCD || 0) - dt);
      if (bk.freeze > 0) { bk.freeze -= dt; return; }
      const d = G.dali;
      if (!bk.blockCD && Math.abs(d.x - bk.x) < 20 && Math.abs(d.y - bk.y) < 16) {
        bk.freeze = C.BROKER_BLOCK_SEC; bk.blockCD = C.BROKER_BLOCK_CD;
        S.stats.brokerBumped = (S.stats.brokerBumped || 0) + 1;
        G.fx.add(S, bk.x, bk.y - 60, '멈칫! 달이가 길을 막았어요', '#ffe48a', 16);
        G.audio.play('ok');
        if (!S.bumpTip) { S.bumpTip = true; G.narmi.say('지금이에요! 브로커를 눌러요 (Space)', 2.4); }
        return;
      }
      if (r.state !== 'open') {                                       // 달이가 먼저 납품했거나 시간 초과
        const next = G.requests.active(S).find(q => q.item === bk.item && !q.broker && q.left > 6);
        if (next) { bk.req.broker = false; bk.req = next; next.broker = true; bk.path = pathTo(bk, next.vill); }
        else {
          if (r.state === 'done') {
            S.stats.brokerBlocked++; S.score += C.BROKER_BLOCK_SCORE;
            G.fx.add(S, bk.x, bk.y - 46, '계약 지켜냄! +' + C.BROKER_BLOCK_SCORE, '#ffe48a', 16);
          }
          flee(S, '쳇, 허탕이네…', '#ffd6a0');
        }
        return;
      }
      if (step(bk, dt, speed(S))) dumpGoods(S, r);
      return;
    }
    if (bk.state === 'flee' && step(bk, dt, speed(S) * 1.3)) rest(S, S.elapsed > C.LATE_AT ? C.BROKER_REST * 0.6 : C.BROKER_REST);
  }
  // 부정 납품: 그 계약은 불량품으로 실패
  function dumpGoods(S, r) {
    r.state = 'expired'; r.fraud = 'broken'; r.broker = false;
    S.stats.brokerWon++;
    G.score.trust(S, C.TRUST_BROKER); G.score.breakCombo(S);
    G.villages.onFail(S, r.vid);
    G.audio.play('scam'); S.shakeT = Math.max(S.shakeT || 0, 0.2);
    const y = r.vill.yard;
    G.fx.add(S, y.x + y.w / 2, y.y + 10, '부정 납품! 브로커가 불량품을 넣었어요', '#ff8a7a', 16);
    G.fx.add(S, y.x + y.w / 2, y.y + 10, '신뢰 ' + C.TRUST_BROKER, '#ff8a7a');
    if (!S.firstBrokerWin) { S.firstBrokerWin = true; G.narmi.say('계약을 뺏겼어요! 브로커를 눌러 막아요', 2.8); }
    S.bk.req = null; flee(S, '히히, 낙찰!', '#ff8a7a');
  }

  // ---------- 나르미로 적발 ----------
  const hit = (S, p) => { const bk = S.bk, t = p.touch ? 1 : 0; return bk && (bk.state === 'grab' || bk.state === 'run') && Math.abs(p.x - bk.x) < 26 + t * 22 && p.y > bk.y - 92 - t * 16 && p.y < bk.y + 10 + t * 24; };   // 터치는 손가락 크기만큼 넓게   // 보따리·이름표까지 눌러도 됨
  function request(S) {
    const bk = S.bk;
    if (G.narmi.busy() || S.inspectCD > 0) { G.fx.add(S, bk.x, bk.y - 50, '나르미가 숨 고르는 중 (' + Math.ceil(S.inspectCD) + '초)', '#ffd6a0'); return false; }
    G.narmi.send(S, bk); G.audio.play('whoosh');
    return true;
  }
  function caught(S) {
    const bk = S.bk; bk.stun = false;
    if (bk.state !== 'grab' && bk.state !== 'run') return;
    if (bk.req) bk.req.broker = false;
    S.stats.brokerCaught++;
    S.score += C.BROKER_CATCH_BONUS; G.score.trust(S, C.TRUST_CATCH);
    // 2026-11-03 통쾌한 제재 연출: 한순간 멈춤 + 큰 흔들림 + 거대한 '입찰참가자격 제한' 도장 + 가짜 서류 폭죽 (피·폭력 없이)
    S.hitStop = 0.28; S.shakeT = 0.5; G.fx.burst(S, bk.x, bk.y - 20); G.fx.burst(S, bk.x, bk.y - 30, 'paper', 34);
    S.sanction = { x: bk.x, y: bk.y - 40, t: 0, n: S.stats.brokerCaught };
    G.fx.add(S, bk.x, bk.y - 60, '브로커 차단! +' + C.BROKER_CATCH_BONUS, '#ffe48a', 16);
    G.audio.play('catch'); setTimeout(() => G.audio.play('end'), 120);
    if (!S.ultLock) G.ult.charge(S);                                    // 필살기 충전 (필살기로 잡은 건 빼고)
    G.narmi.say('브로커 차단! 입찰참가자격 제한이에요', 2.2);
    if (bk.shop && bk.shop.status === 'open' && bk.shop.fake) G.shops.inspected(S, bk.shop);   // 뒤에 있던 페이퍼컴퍼니도 드러남
    Object.assign(bk, { state: 'caught', timer: 0, req: null, path: [] });
  }

  // ---------- 그리기: 너구리 (중절모 + 검은 눈 띠 + 줄무늬 꼬리 + 보따리) ----------
  function px(ctx, col, x, y, w, h) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
  // 2026-11-03 그래픽 상향: 픽셀 단위 너구리 브로커 (중절모·눈 띠·트렌치코트·빨간 넥타이·서류가방·줄무늬 꼬리), 걷기 2프레임. 오른쪽을 보는 그림 → 왼쪽은 뒤집기
  const PAL = { k: '#1e1a17', h: '#3a3a44', H: '#55566a', r: '#c0392b', g: '#9a8d7d', G: '#7d7062', w: '#efe6d6', m: '#2b2622', e: '#ffffff', p: '#111111', n: '#2b2622',
    c: '#8a6a44', C: '#6a4f32', s: '#f4f0e6', t: '#d9342b', l: '#3a2f28', o: '#1e1a17', b: '#5a3a22', B: '#8a5a30', y: '#c9bca8', z: '#3a332d', q: '#ffd84a' };
  const TOP = [
    '.......kkkkkkk........',
    '......khHhhhhhk.......',
    '......khhhhhhhk.......',
    '......krrrrrrrk.......',
    '....kkhhhhhhhhhkk.....',
    '.....kGggggggggGk.....',
    '....kgmmmmmmmmmmgk....',
    '....kgmepmmmmepmgk....',
    '....kgmmmmmmmmmmgk....',
    '....kggwwwwwwwwwnnk...',
    '.....kgwwwwwwwwwk.....',
    '......kkgggggggk......',
    '.....kcCsstssCck......',
    '....kccCcstscCcck.....',
    'zy.kcccCcsttcCccck.kk.',
    'yzykccccCcttCcccckbbbk',
    '.zyzkcccCccCccccckBbbk',
    '..zzkcccCccCcccckbbbbk',
    '....kCCCCCCCCCCCkkkkk.',
  ];
  const LEGS = [
    ['.....kllk...kllk......', '.....kllk...kllk......', '....kooook.kooook.....'],
    ['......kllkkllk........', '.......kllkllk........', '......koookooook......'],
  ];
  const frames = [];
  function frame(i) {
    if (frames[i]) return frames[i];
    const rows = TOP.concat(LEGS[i]), u = 2, c = document.createElement('canvas'); c.width = 22 * u; c.height = rows.length * u;
    const g = c.getContext('2d');
    rows.forEach((row, y) => [...row.padEnd(22, '.')].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x * u, y * u, u, u); } }));
    return (frames[i] = c);
  }
  function raccoon(ctx, bk, S) {
    const moving = bk.state === 'run' || bk.state === 'flee', step2 = moving ? Math.floor(bk.t * 10) % 2 : 0;
    const bob = moving ? step2 : Math.round(Math.sin(bk.t * 3));
    const fr = frame(step2), RS = 1.3, W = fr.width * RS, H = fr.height * RS;   // 1.3배 (달이·나르미와 비슷한 크기)
    G.spr.shadow(ctx, bk.x, bk.y - 1, 14);
    ctx.save(); ctx.translate(Math.round(bk.x), Math.round(bk.y) - bob); ctx.scale(bk.face, 1);
    if (bk.state === 'caught') { const k = Math.min(1, bk.timer / 0.2); ctx.translate(-bk.timer * 70, 0); ctx.rotate(-bk.timer * 6); ctx.scale(1 + 0.3 * k, 1 - 0.55 * k); }   // 납작해져 데굴데굴 굴러 나감
    else if (bk.freeze > 0) ctx.translate(Math.sin(bk.t * 40) * 1.5, 0);   // 멈칫: 부르르
    ctx.drawImage(fr, -W / 2, -H, W, H);
    if (bk.state === 'caught') { ctx.fillStyle = '#fff'; ctx.fillRect(-6, -H + 14, 3, 3); ctx.fillRect(6, -H + 14, 3, 3); }   // 눈이 빙글
    if ((bk.freeze > 0 && bk.state === 'run') || (bk.state === 'grab' && Math.floor(bk.t * 6) % 2 === 0)) { ctx.scale(bk.face, 1); T(ctx, '!', 0, -H - 6, 16, '#ffd84a'); }
    ctx.restore();
    // 불량품 보따리 (머리 위): 물건 아이콘 + 금 간 표시
    if (bk.item && (bk.state === 'run' || bk.state === 'grab')) {
      const ix = Math.round(bk.x), iy = Math.round(bk.y) - H - 16 - bob;
      px(ctx, '#3a3a3a', ix - 12, iy - 12, 24, 24); px(ctx, '#e8dcc0', ix - 11, iy - 11, 22, 22);
      G.icons.draw(ctx, bk.item, ix, iy, 18);
      ctx.strokeStyle = '#d9342b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ix + 4, iy - 11); ctx.lineTo(ix, iy - 3); ctx.lineTo(ix + 5, iy + 3); ctx.stroke(); ctx.lineWidth = 1;
    }
    // 이름표
    const ny = Math.round(bk.y) - (bk.item && bk.state !== 'flee' && bk.state !== 'caught' ? H + 38 : H + 10) - bob;
    px(ctx, '#7a3fb0', Math.round(bk.x) - 22, ny - 7, 44, 14); T(ctx, '브로커', bk.x, ny, 12, '#fff');
  }

  function draw(ctx, S) {
    const bk = S.bk; if (!bk || bk.state === 'off') return;
    // 노리는 계약까지 빨간 점선 (얼마나 가까운지 한눈에)
    if (bk.state === 'run' && bk.req) {
      const b = G.ui.bubbleRect(bk.req);
      ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = '#e5533d'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -bk.t * 30;
      ctx.beginPath(); ctx.moveTo(bk.x, bk.y - 20); ctx.lineTo(b.x + b.w / 2, b.y + b.h); ctx.stroke(); ctx.restore();
    }
    if (bk.state === 'grab') {                                        // 두리번: 좌우로 고개 돌림 + 출발까지 남은 막대 + 노리는 계약 점선
      bk.face = Math.floor(bk.timer * 3) % 2 ? 1 : -1;
      const f = 1 - bk.timer / C.BROKER_GRAB;
      px(ctx, 'rgba(20,24,30,.8)', bk.x - 20, bk.y + 6, 40, 6); px(ctx, '#e5533d', bk.x - 19, bk.y + 7, Math.round(38 * f), 4);
      if (bk.req) { const b = G.ui.bubbleRect(bk.req); ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#e5533d'; ctx.lineWidth = 2; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(bk.x, bk.y - 20); ctx.lineTo(b.x + b.w / 2, b.y + b.h); ctx.stroke(); ctx.restore(); }
    }
    raccoon(ctx, bk, S);
  }
  // 제재 도장 (브로커가 사라져도 남아서 찍힘)
  function drawSanction(ctx, S) {
    const st = S.sanction; if (!st) return;
    st.t += 1 / 60; if (st.t > 1.4) { S.sanction = null; return; }
    const k = Math.min(1, st.t / 0.12), sc = (3 - 2 * k) * (1 + Math.min(0.4, (st.n - 1) * 0.1)), a = st.t > 1.1 ? (1.4 - st.t) / 0.3 : 1;
    const x = Math.max(110, Math.min(C.VIEW.w - 110, st.x)), y = Math.max(90, st.y);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(-0.18); ctx.scale(sc, sc);
    ctx.font = '16px "Galmuri11 Bold", ' + G.FONT; const w = ctx.measureText('입찰참가자격 제한').width + 24;
    ctx.strokeStyle = '#d9342b'; ctx.lineWidth = 3; ctx.strokeRect(-w / 2, -18, w, 36); ctx.lineWidth = 1; ctx.strokeRect(-w / 2 + 4, -14, w - 8, 28);
    ctx.fillStyle = 'rgba(255,253,246,.85)'; ctx.fillRect(-w / 2 + 5, -13, w - 10, 26);
    ctx.fillStyle = '#d9342b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('입찰참가자격 제한', 0, 1);
    ctx.restore();
  }
  // 말풍선에 '브로커!' 표시 (ui.bubble에서 호출)
  function bubbleMark(ctx, r, b) {
    if (!r.broker || r.state !== 'open') return;
    const blink = Math.floor(r.t * 4) % 2 === 0;
    px(ctx, blink ? '#9a5ad0' : '#5a2a8a', b.w - 44, -11, 44, 11);
    ctx.font = '10px Galmuri9, ' + G.FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('브로커!', b.w - 22, -5);
    ctx.strokeStyle = blink ? '#e5533d' : 'rgba(229,83,61,.5)'; ctx.lineWidth = 2; ctx.strokeRect(-2, -2, b.w + 4, b.h + 4); ctx.lineWidth = 1;
  }
  return { init, update, draw, drawSanction, hit, request, caught, bubbleMark, raccoon };
})();
