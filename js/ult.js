/* 필살기 "AI 데이터 일제 조사" (2026-11-03): 브로커를 ULT_NEED명 적발하면 충전 → 쓸모 있는 순간 자동 발동(Q·HUD 버튼으로 바로도 가능).
   발동하면 나르미의 데이터 스캔 빛이 화면을 왼쪽→오른쪽으로 훑으며
   - 모든 페이퍼컴퍼니 적발 · 등록 심사 중인 새 공방 실사 통과 · 달리는 브로커 적발
   - 이후 ULT_BROKER_PAUSE초 동안 브로커가 나오지 않음
   실제 근거: 조달청은 2026년 11월부터 데이터 분석으로 페이퍼컴퍼니 의심 업체를 골라 입찰보증금을 물림(기획서 부록 B). */
'use strict';
G.ult = (() => {
  const C = G.C, T = (...a) => G.world.text(...a);
  const BTN = { x: 732, y: 5, w: 72, h: 34 };
  function init(S) { S.ultCharge = 0; S.ultFx = null; S.ultCut = null; S.ultLock = false; S.brokerPauseUntil = 0; }
  const ready = S => S.ultCharge >= C.ULT_NEED;
  function charge(S) {
    if (S.ultLock || ready(S)) return;
    S.ultCharge++;
    if (ready(S)) {
      G.narmi.say(G.settings.ultAuto ? '데이터가 모였어요! 수상한 곳이 보이면 바로 일제 조사!' : 'AI 조사 준비! Q 또는 위쪽 [AI 조사] 버튼', 2.6);
      G.audio.play('gift');
    }
  }
  function input(S) {
    if (C.QUIET && S.stage < 2) return;                                // 3단계(브로커)부터
    if (!(G.ui.clicked(BTN) || G.input.hit('q'))) return;
    if (S.ultFx || S.ultCut) return;
    if (!ready(S)) { G.fx.add(S, BTN.x + BTN.w / 2, 60, (C.CONNECT ? '브로커를 ' + (C.ULT_NEED - S.ultCharge) + '번 더 막으면 AI 조사!' : '브로커를 ' + (C.ULT_NEED - S.ultCharge) + '명 더 적발하면 AI 조사!'), '#cfd8e3'); return; }
    fire(S);
  }
  // 2026-11-04 대표 장면 연출: ① 컷인(1.1초, 게임 멈춤: 3D 나르미 + 큰 제목) → ② 스캔(적발할 때마다 도장 쾅) → ③ 결과 집계
  const CUT = 1.1;
  function fire(S) {
    S.ultCharge = 0; S.ultLock = true; S.ultCut = { t: 0 }; S.ultFx = null;
    S.stats.ult = (S.stats.ult || 0) + 1;
    S.score += C.ULT_SCORE;
    G.audio.play('levelup'); G.audio.play('whoosh');
    S.brokerPauseUntil = S.elapsed + (S.rush ? 5 : C.ULT_BROKER_PAUSE) + CUT;   // 결전 중엔 5초만 쉼
  }
  function cutUpdate(S, dt) {                                          // 컷인 동안은 screens.js가 게임을 멈추고 이것만 돌림
    const c = S.ultCut; c.t += dt;
    if (c.t >= CUT) {
      S.ultCut = null; S.ultFx = { t: 0, done: new Set(), hits: [], found: 0, passed: 0, tax: 0, chain: 0, gain: 0, hidden: hideouts(S) };
      S.shakeT = 0.4; G.audio.play('whoosh'); G.narmi.say('숨은 브로커 조직까지 데이터로 찾아요!', 1.6);
    }
  }
  // 11-16 8.16단계 '숨은 브로커 조직': 스캔이 시작되면 건물 뒤·골목에 숨어 있던 브로커들이 들통나 고개를 내밀고, 빛이 닿을 때마다 한 명씩 적발(연속 적발 ×n)
  //   실제 근거: 조달청은 데이터 분석으로 숨은 부정 의심 업체를 골라 입찰참가자격을 제한함(기획서 부록 B). 연출용이라 계약·신뢰에는 영향 없음, 점수만
  const SPOTS = [[96, 196], [300, 196], [660, 196], [870, 196], [60, 330], [904, 330], [240, 404], [720, 404]];
  function hideouts(S) {
    if (!C.CONNECT) return [];
    const n = C.ULT_HIDDEN[Math.min(C.ULT_HIDDEN.length - 1, Math.max(0, S.stage - 2))];
    return SPOTS.slice().sort(() => Math.random() - 0.5).slice(0, n).map(([x, y]) => ({ x, y, t: 0, state: 'grab', face: x < 480 ? 1 : -1, timer: 0, freeze: 0, item: null, loot: null, hit: false }))
      .sort((a, b) => a.x - b.x);
  }
  function chainHit(S, x, y) {                                         // 한 명 적발: 도장 + 서류 폭죽 + 흔들림 + 연속 적발 점수(뒤로 갈수록 큼)
    const u = S.ultFx; u.chain++; u.chainT = 0;
    const pts = C.ULT_HIDDEN_SCORE + 50 * (u.chain - 1); S.score += pts; u.gain += pts;
    u.hits.push({ x: Math.max(110, Math.min(C.VIEW.w - 110, x)), y: Math.max(C.HUD_H + 30, y - 46), text: '입찰참가자격 제한', col: '#d9342b', t: 0 });
    G.fx.burst(S, x, y - 30, 'paper', 26); G.fx.burst(S, x, y - 20);
    S.hitStop = 0.07; S.shakeT = Math.max(S.shakeT || 0, 0.3);
    G.audio.play('catch'); if (u.chain >= 3) setTimeout(() => G.audio.play('levelup'), 60);
    S.stats.ultHidden = (S.stats.ultHidden || 0) + 1;
  }
  function hit(S, x, y, text, col, tax, small) {
    const u = S.ultFx; u.hits.push({ x: Math.max(90, Math.min(C.VIEW.w - 90, x)), y: Math.max(C.HUD_H + 24, y), text, col, t: 0, small });   // 화면 끝에서도 도장이 잘리지 않게
    if (small) { G.audio.play('click'); return; }                      // 11-16 작은 도장(정상 확인·계약 보호): 딱딱딱 소리만
    if (tax != null) { u.found++; u.tax = Math.round((u.tax + tax) * 10) / 10; G.audio.play('catch'); S.shakeT = Math.max(S.shakeT || 0, 0.25); }
    else { u.passed++; G.audio.play('ok'); }
  }
  // 수상한 공방의 '사 버렸다면 낭비됐을' 세금 = 그 공방 가격표 합
  const fakeTax = sh => G.ITEMS.filter(i => i.cat === sh.cat).reduce((a, i) => a + G.shops.price(sh, i.id), 0);
  // 2026-11-03 똑똑한 자동 발동: 충전이 다 되면 쓸모 있는 순간(페이퍼컴퍼니가 있거나, 브로커가 달리거나, 심사 중인 새 공방이 2곳 이상)에 저절로. Q·버튼으로 바로 쓸 수도 있음
  function worth(S) {
    if (S.bk && (S.bk.state === 'run' || S.bk.state === 'grab' || (C.CONNECT && S.bk.state === 'flee' && S.bk.x > 40 && S.bk.x < C.VIEW.w - 40))) return true;
    const open = S.shops.filter(sh => sh.status === 'open' && G.shops.isOpen(S, sh));
    return open.some(sh => sh.fake) || open.filter(sh => sh.isNew && !sh.verified && !sh.innov).length >= 2;
  }
  const ULT_PAUSE_TXT = C.ULT_BROKER_PAUSE;
  const SUM = 2.6;                                                    // 결과 집계 보여 주는 시간
  function update(S, dt) {
    if (G.settings.ultAuto && !S.ultFx && !S.ultCut && ready(S) && worth(S)) fire(S);
    const u = S.ultFx; if (!u) return;
    u.t += dt; for (const h of u.hits) h.t += dt;
    const bx = Math.min(1, u.t / C.ULT_SCAN) * C.VIEW.w;
    // 11-16 8.14단계: 빛이 지나가는 순서대로 공방마다 도장(딱딱딱) — 새 공방은 실사(페이퍼컴퍼니 적발·새싹 통과), 등록 업체는 '✔ 정상'
    for (const sh of S.shops) {
      if (u.done.has(sh.idx) || sh.w.body.x + sh.w.body.w / 2 > bx) continue;
      u.done.add(sh.idx);
      if (sh.status !== 'open' || !G.shops.isOpen(S, sh)) continue;
      const b = sh.w.body;
      if (sh.fake || (sh.isNew && !sh.verified && !sh.innov)) {
        const fake = sh.fake, tax = fake ? fakeTax(sh) : null;
        if (C.CONNECT && S.report && S.report.sh === sh) S.report = null;   // 달이가 보던 보고서는 닫음
        S.ultQuiet = true; G.shops.inspected(S, sh); S.ultQuiet = false;
        hit(S, b.x + b.w / 2, b.y + 40, fake ? '적발!' : '실사 통과', fake ? '#d9342b' : '#2e9b3a', tax);
      } else if (C.CONNECT) { u.okShops = (u.okShops || 0) + 1; hit(S, b.x + b.w / 2, b.y + 34, '✔ 정상', '#2e9b3a', null, true); }
    }
    // 계약 카드마다 '보호' 도장: 브로커가 쉬는 동안(ULT_BROKER_PAUSE) 계약을 지킴
    if (C.CONNECT) for (const r of G.requests.active(S)) {
      const rb = G.ui.bubbleRect(r); if ((u.cards = u.cards || new Set()).has(r.id) || rb.x + rb.w / 2 > bx) continue;
      u.cards.add(r.id); u.safe = (u.safe || 0) + 1; hit(S, rb.x + rb.w / 2, rb.y + rb.h / 2, '계약 보호', '#2f6fb5', null, true);
    }
    for (const h of u.hidden || []) {                                  // 숨은 브로커: 들통(고개 내밈) → 빛이 닿으면 적발 → 데굴데굴 굴러 사라짐
      h.t += dt; if (h.hit) h.timer += dt;
      if (!h.hit && h.x <= bx) { h.hit = true; h.state = 'caught'; h.timer = 0; chainHit(S, h.x, h.y); }
    }
    if (u.chainT != null) u.chainT += dt;
    const bk = S.bk;
    if (!u.bkDone && bk && (bk.state === 'run' || bk.state === 'grab' || (C.CONNECT && bk.state === 'flee' && bk.x > -20 && bk.x < C.VIEW.w + 20)) && bk.x <= bx) {   // 화면 안에서 도망치는 브로커도
      u.bkDone = true; const tax = bk.req ? bk.req.price : 0;
      G.broker.caught(S, true); hit(S, bk.x, bk.y - 40, '브로커 적발!', '#7a3fb0', tax);
      if (C.CONNECT) { u.chain++; u.chainT = 0; }
    }
    if (u.t > C.ULT_SCAN + 0.3 && u.sumT == null) { u.sumT = 0; G.audio.play(u.found ? 'gift' : 'ok'); }
    if (u.sumT != null) u.sumT += dt;
    if (u.sumT != null && u.sumT > SUM) { S.ultFx = null; S.ultLock = false; }
  }
  // 스캔 빛 + 도장 + 결과 집계 (화면 위층)
  function draw(ctx, S) {
    const u = S.ultFx; if (!u) return;
    const K = G.soft, W = C.VIEW.w, H = C.VIEW.h, k = Math.min(1, u.t / C.ULT_SCAN), bx = k * W, fade = u.t > C.ULT_SCAN ? Math.max(0, 1 - (u.t - C.ULT_SCAN) / 0.8) : 1;
    ctx.save(); ctx.globalAlpha = 0.22 * fade; ctx.fillStyle = '#0b5d68'; ctx.fillRect(0, C.HUD_H, W, H - C.HUD_H);
    ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = '#5ec8f2';                    // 데이터 격자
    for (let x = 0; x < bx; x += 24) ctx.fillRect(x, C.HUD_H, 1, H - C.HUD_H);
    for (let y = C.HUD_H; y < H; y += 24) ctx.fillRect(0, y, bx, 1);
    if (k < 1) {                                                            // 스캔 빛줄기
      const g = ctx.createLinearGradient(bx - 60, 0, bx + 8, 0);
      g.addColorStop(0, 'rgba(94,200,242,0)'); g.addColorStop(1, 'rgba(200,245,255,.9)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(bx - 60, C.HUD_H, 68, H - C.HUD_H);
      ctx.fillStyle = '#fff'; ctx.fillRect(bx, C.HUD_H, 3, H - C.HUD_H);
    }
    ctx.restore();
    for (const h of u.hidden || []) {                                       // 숨은 브로커 + 조준 고리
      if (h.hit && h.timer > 1.0) continue;
      const pop = Math.min(1, h.t / 0.22), sc = pop < 1 ? pop * 1.15 : 1;
      ctx.save(); ctx.translate(h.x, h.y); ctx.scale(sc, sc); ctx.translate(-h.x, -h.y);
      if (h.hit) ctx.globalAlpha = Math.max(0, 1 - h.timer);
      G.broker.raccoon(ctx, h, S);
      ctx.restore();
      if (!h.hit && pop >= 1) {                                             // 빨간 조준 고리가 돌며 좁혀짐
        const r = 30 - Math.min(8, h.t * 6), a0 = h.t * 4;
        ctx.save(); ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]); ctx.lineDashOffset = -h.t * 30;
        ctx.beginPath(); ctx.arc(h.x, h.y - 34, r, a0, a0 + Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#ff3b30'; for (const [dx, dy] of [[-r - 4, 0], [r + 4, 0], [0, -r - 4], [0, r + 4]]) ctx.fillRect(h.x + dx - 2, h.y - 34 + dy - 2, 4, 4);
        ctx.restore(); ctx.lineWidth = 1;
      }
    }
    for (const h of u.hits) {                                               // 적발 도장: 크게 쾅 → 제자리 → 사라짐
      const a = h.t > 1.8 ? Math.max(0, 1 - (h.t - 1.8) / 0.4) : 1; if (a <= 0) continue;
      const sc = h.t < 0.14 ? 2.4 - h.t / 0.14 * 1.4 : 1, fs = h.small ? 15 : 22, hh = h.small ? 24 : 36;   // 작은 도장(정상·보호)은 작게
      ctx.save(); ctx.globalAlpha = a; ctx.translate(h.x, h.y); ctx.rotate(-0.12); ctx.scale(sc, sc);
      ctx.font = fs + 'px "Jua", sans-serif'; const w = ctx.measureText(h.text).width + (h.small ? 18 : 28);
      K.softShadow(ctx, 8, 3, .35); K.rr(ctx, -w / 2, -hh / 2, w, hh, 10); ctx.fillStyle = h.col; ctx.fill(); K.noShadow(ctx);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; K.rr(ctx, -w / 2 + 3, -hh / 2 + 3, w - 6, hh - 6, 8); ctx.stroke(); ctx.lineWidth = 1;
      K.J(ctx, h.text, 0, 1, fs, '#fff'); ctx.restore();
    }
    if (u.chain >= 1 && u.chainT != null && u.chainT < 1.6 && u.sumT == null) {   // 가운데 위: '연속 적발 ×n!' (잡을 때마다 커지며 튀어나옴)
      const p = Math.min(1, u.chainT / 0.12), sc = (1.7 - 0.7 * p) * (1 + Math.min(0.5, (u.chain - 1) * 0.12)), a = u.chainT > 1.2 ? Math.max(0, (1.6 - u.chainT) / 0.4) : 1;
      const tg = ctx.createLinearGradient(0, -24, 0, 24); tg.addColorStop(0, '#fff17a'); tg.addColorStop(0.55, '#ffc93a'); tg.addColorStop(1, '#ff6a26');
      ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 150); ctx.rotate(-0.05); ctx.scale(sc, sc);
      K.J(ctx, '연속 적발 ×' + u.chain + '!', 0, 0, 40, '#fff', { stroke: [['#fff', 14]] });
      K.J(ctx, '연속 적발 ×' + u.chain + '!', 0, 0, 40, tg, { stroke: [['#b8281e', 7]] });
      ctx.restore();
    }
  }
  // 컷인 (HUD 위까지 덮음): 어두운 화면 + 대각선 띠 + 3D 나르미 + 큰 제목
  function drawCut(ctx, S) {
    const u = S.ultFx;
    if (u) {                                                                // 결과 집계 (배너보다 위층)
      const K = G.soft, W = C.VIEW.w;
      if (u.sumT != null) {                                                    // 결과 집계
      const p = Math.min(1, u.sumT / 0.2), a = u.sumT > SUM - 0.4 ? Math.max(0, (SUM - u.sumT) / 0.4) : 1;
      const ext = C.CONNECT ? '공방 ' + ((u.okShops || 0) + u.passed + u.found) + '곳 확인 · 계약 ' + (u.safe || 0) + '건 보호 · 브로커 ' + ULT_PAUSE_TXT + '초 출동 중단' : '';   // 8.14단계: 한 번에 몇 곳을 봤는지
      const main = u.chain ? '브로커 조직 ' + u.chain + '명 일망타진! +' + (u.gain + C.ULT_SCORE).toLocaleString() + '점' : u.found ? '부정 ' + u.found + '건 적발 · 세금 ' + u.tax + '만원 지킴' : u.passed ? '새 공방 ' + u.passed + '곳 실사 통과' : '수상한 곳 없음 · 깨끗해요!', eh = ext ? 22 : 0;   // 8.16단계
      ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 300); ctx.scale(0.8 + 0.2 * p, 0.8 + 0.2 * p);
      ctx.font = '24px "Jua", sans-serif'; const w = Math.max(460, ctx.measureText(main).width + 60);
      K.softShadow(ctx, 18, 6, .45); K.rr(ctx, -w / 2, -40, w, 84 + eh, 20); ctx.fillStyle = 'rgba(255,251,240,.97)'; ctx.fill(); K.noShadow(ctx);
      K.rr(ctx, -80, -54, 160, 28, 14); ctx.fillStyle = '#0f6f94'; ctx.fill(); K.J(ctx, 'AI 조사 결과', 0, -39, 17, '#fff');
      K.J(ctx, main, 0, -4, 24, u.found ? '#d9342b' : '#2e7d3a');
      if (ext) K.J(ctx, ext, 0, 22, 16, '#0f6f94');
      K.J(ctx, '실제로도 조달청은 데이터로 페이퍼컴퍼니 의심 업체를 골라내요', 0, 26 + eh, 14, '#6a5a3a');
      ctx.restore();
    }
    }
    const c = S.ultCut; if (!c) return;
    const K = G.soft, W = C.VIEW.w, H = C.VIEW.h, k = c.t / CUT;
    const ein = Math.min(1, k / 0.22), out = k > 0.82 ? (k - 0.82) / 0.18 : 0, e = 1 - Math.pow(1 - ein, 3);
    ctx.save(); ctx.globalAlpha = 1 - out;
    ctx.fillStyle = 'rgba(8,14,24,.62)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate((1 - e) * W, 0); ctx.transform(1, -0.12, 0, 1, 0, 60);   // 기울어진 띠
    const g = ctx.createLinearGradient(0, 170, 0, 360); g.addColorStop(0, '#1d3f78'); g.addColorStop(0.5, '#2f8fc8'); g.addColorStop(1, '#1d3f78');
    ctx.fillStyle = g; ctx.fillRect(-40, 170, W + 80, 190);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(-40, 166, W + 80, 5); ctx.fillRect(-40, 359, W + 80, 5);
    ctx.fillStyle = 'rgba(255,255,255,.35)';                                // 속도선
    for (let i = 0; i < 14; i++) { const y = 182 + (i * 53) % 170, x = W - ((c.t * 1400 + i * 260) % (W + 300)); ctx.fillRect(x, y, 120 + (i % 3) * 60, 2); }
    ctx.restore();
    const im = G.img.mascot3d;                                              // 3D 나르미·달이가 오른쪽에서 쑥
    if (im && im.naturalWidth) { const h = 300, w = im.naturalWidth * h / im.naturalHeight, x = 720 + (1 - e) * 420 - k * 30; ctx.imageSmoothingEnabled = true; ctx.drawImage(im, x - w / 2, 140, w, h); ctx.imageSmoothingEnabled = false; }
    const tx = 300 - (1 - e) * 500;                                         // 제목은 왼쪽에서
    const tg = ctx.createLinearGradient(0, 230, 0, 290); tg.addColorStop(0, '#fff17a'); tg.addColorStop(0.55, '#ffc93a'); tg.addColorStop(1, '#ff9a26');
    K.J(ctx, '나르미의', tx, 214, 26, '#fff', { stroke: [['#1d3f78', 6]] });
    K.J(ctx, 'AI 데이터 일제 조사!', tx, 262, 50, '#fff', { stroke: [['#fff', 16]] });
    K.J(ctx, 'AI 데이터 일제 조사!', tx, 262, 50, tg, { stroke: [['#1d3f78', 8]] });
    K.J(ctx, C.CONNECT ? '숨은 브로커 조직까지 데이터로 한 번에 찾아요' : '페이퍼컴퍼니 · 브로커를 데이터로 한 번에 찾아요', tx, 312, 17, '#fff', { stroke: [['rgba(10,20,40,.7)', 5]] });
    ctx.restore();
  }
  // HUD 버튼: 브로커 적발 칸 3개, 다 차면 반짝
  function drawTip(ctx) { if (G.ui.hover(BTN)) G.ui.tip(ctx, BTN.x - 220, BTN.y + BTN.h + 6, G.ui.ULT_TIP); }
  function drawHud(ctx, S) {
    const r = ready(S), on = r && Math.floor((S.elapsed || 0) * 4) % 2 === 0;
    ctx.fillStyle = r ? (on ? '#5ec8f2' : '#2f9bd0') : '#2a3646'; ctx.fillRect(BTN.x, BTN.y, BTN.w, BTN.h);
    ctx.fillStyle = r ? '#fff' : '#3a4656'; ctx.fillRect(BTN.x, BTN.y, BTN.w, 2);
    T(ctx, r ? (G.settings.ultAuto ? '자동 대기' : '누르기 Q') : 'AI 조사', BTN.x + BTN.w / 2, BTN.y + 11, 12, r ? '#0b2a3a' : '#8fa3b8');
    for (let i = 0; i < C.ULT_NEED; i++) {
      const x = BTN.x + BTN.w / 2 - (C.ULT_NEED * 14 - 4) / 2 + i * 14, y = BTN.y + 20;
      ctx.fillStyle = i < S.ultCharge ? (r ? '#0b2a3a' : '#7a3fb0') : '#3a4656'; ctx.fillRect(x, y, 10, 9);
    }
  }
  function toggleAuto() { G.settings.ultAuto = !G.settings.ultAuto; G.store.set('ultAuto', G.settings.ultAuto); return G.settings.ultAuto; }
  return { init, charge, input, update, draw, drawCut, cutUpdate, drawHud, drawTip, ready, BTN, toggleAuto };
})();
