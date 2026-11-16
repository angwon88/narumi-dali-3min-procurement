/* 조달 업무 4단계 (2026-11-16, 개편안.md 8.0단계): 한 판(2분)을 시간 기준 4단계로 나눠, 단계마다 조달청 업무 한 가지를 체험하게 한다.
   - 예전 '조달관 5대 임무'(2026-11-03)를 대체. 새싹·혁신제품은 2단계(업체 실사)에 포함
   - 단계 시작: 게임을 멈추고 '몇 단계 · 이름 · 목표 한 문장' 안내(STAGE_INTRO_SEC초, 누르면 바로)
   - 단계 끝: 게임을 멈추고 "방금 한 일 → 실제로 조달청은…" 카드 1장(STAGE_CARD_SEC초, 누르면 바로)
   - 단계가 바뀌는 시각은 config.js의 STAGE_AT (시간 기준이라 봇·시연 영상에서 예측 가능)
   - 타이틀 목록 · 상황 소개 마지막 장면 · 결과 화면 카드가 모두 이 LIST를 쓴다. 4가지를 한 번씩 해야 S등급 (result.js)
   실제 사실 문장(real)의 근거는 기획서 부록 B·B-2. */
'use strict';
G.missions = (() => {
  const C = G.C, n = v => v || 0, T = (...a) => G.world.text(...a);
  const W = C.VIEW.w, H = C.VIEW.h;
  const LIST = [
    { id: 'value', name: '계약 조건·가성비', col: '#2f6fb5', icon: 'desk',
      desc: '별(★) 조건을 맞춘 공방 중 가장 싼 곳과 계약해요',
      fresh: '계약 카드 → 공방을 눌러요',
      open: { villages: ['school', 'library'], cats: ['furn', 'elec'] },
      done: s => n(s.valueBest) > 0,
      me: (S, s) => '계약 ' + S.delivered + '건 납품 · 가성비 최고 ' + n(s.valueBest) + '번',
      real: () => '실제로도 공공기관은 품질 조건을 정하고, 조건을 맞춘 업체 중에서 가격을 따져 사요' },
    { id: 'paper', name: '업체 실사', col: '#d9342b', icon: 'tablet',
      desc: '새 공방은 달이가 실사! 설비가 없으면 적발해요',
      fresh: '새로 등장: 보건소 · 새 공방',
      open: { villages: ['clinic'], cats: ['health'] },
      done: s => n(s.caught) + n(s.certified) > 0,
      me: (S, s) => '새 공방 ' + (n(s.caught) + n(s.certified)) + '곳 실사 · 적발 ' + n(s.caught) + ' · 새싹 등록 ' + n(s.certified),
      real: s => !n(s.caught) && n(s.certified) ? '실제로도 조달청은 혁신제품의 첫 구매자가 되어 기술 기업의 성장을 도와요' : '실제로도 조달청은 데이터로 페이퍼컴퍼니 의심 업체를 골라 걸러내요' },
    { id: 'broker', name: '브로커 차단', col: '#7a3fb0', icon: 'raccoon',
      desc: C.CONNECT_BROKER_MODE === 'ship' ? '수레를 쫓는 브로커를 눌러 나르미로 막아요' : '브로커가 노리는 카드를 먼저 계약하거나 브로커를 눌러요',
      fresh: '새로 등장: 소방서 · 브로커 · AI 조사',
      open: { villages: ['fire'], cats: ['safety'] },
      done: s => n(s.brokerCaught) + n(s.brokerBlocked) > 0,
      me: (S, s) => '브로커 적발 ' + n(s.brokerCaught) + ' · 먼저 계약 ' + n(s.brokerBlocked) + ' · 뺏김 ' + n(s.brokerWon),
      real: () => '실제로도 조달청은 브로커의 불공정 행위를 신고받고, 걸리면 입찰참가자격을 제한해요' },
    { id: 'prep', name: '긴급조달', col: '#0f8a96', icon: 'helmet',
      desc: '태풍! 빨간 긴급 계약부터 빨리 해결해요',
      fresh: '새로 등장: 태풍 긴급 계약(점수 ×' + C.STORM.mult + ')',
      open: { villages: [], cats: [] },
      done: s => n(s.urgentDone) > 0,
      me: (S, s) => '긴급 계약 ' + n(s.urgentMade) + '건 중 ' + n(s.urgentDone) + '건 해결',
      real: () => '실제로도 조달청은 재난 땐 긴급입찰·수의계약으로 빨리 사요' },
  ];
  const BY = Object.fromEntries(LIST.map(m => [m.id, m]));
  const count = S => LIST.filter(m => S.missions && S.missions[m.id] != null).length;
  const stageEnd = i => i + 1 < C.STAGE_AT.length ? C.STAGE_AT[i + 1] : C.GAME_SECONDS;

  function init(S) { S.missions = {}; S.stage = -1; S.stageUI = null; enter(S, 0); }
  // 단계 들어가기: 그 단계에서 새로 나오는 마을·업종을 열고 시작 안내를 띄움
  function enter(S, i) {
    S.stage = i;
    const o = LIST[i].open;
    for (const v of o.villages) S.openVillages.add(v);
    for (const c of o.cats) if (!S.openCats.has(c)) { S.openCats.add(c); if (S.shops) G.shops.opened(S, c); }
    if (LIST[i].id === 'broker') S.ultCharge = Math.max(S.ultCharge || 0, C.STAGE_ULT_START);   // 3단계 30초 안에 AI 조사를 한 번은 써 보게 미리 채워 줌
    S.stageUI = { kind: 'intro', i, t: 0 };
  }
  // 한 프레임: 업무 달성 기록(결과 화면용) + 단계 경계. 경계에 닿으면 true (screens.js가 게임을 멈추고 카드를 띄움)
  function update(S, dt) {
    for (const m of LIST) if (S.missions[m.id] == null && m.done(S.stats || {}, S)) S.missions[m.id] = S.elapsed;
    const last = S.stage >= LIST.length - 1;
    if (last ? S.timeLeft > 0 : (S.elapsed < stageEnd(S.stage) || S.ultFx || S.ultCut)) return false;   // AI 조사 연출 중이면 끝난 뒤에
    S.stageUI = { kind: 'card', i: S.stage, t: 0 };
    return true;
  }
  // 안내·카드 넘기기. 마지막 카드 뒤에는 'finish'를 돌려줌 (결과 화면으로)
  function advance(S) {
    const u = S.stageUI; if (!u) return null;
    if (u.kind === 'card') {
      if (u.i >= LIST.length - 1) { S.stageUI = null; return 'finish'; }
      enter(S, u.i + 1); return 'intro';
    }
    S.stageUI = null; return 'play';
  }
  function tick(S, dt) {                                               // 멈춘 동안: 누르거나 시간이 지나면 넘김
    const u = S.stageUI; if (!u) return 'play';
    u.t += dt;
    const card = u.kind === 'card', dur = card ? C.STAGE_CARD_SEC : C.STAGE_INTRO_SEC;
    const tap = u.t > (card ? 0.9 : 0.5) && (G.input.taps.length || G.input.hit('enter') || G.input.hit(' '));   // 바쁘게 누르다 카드를 못 보고 넘기지 않게 잠깐은 안 넘어감
    if (!tap && u.t < dur) return null;
    G.audio.play('click');
    return advance(S);
  }

  function wrap(ctx, s, maxW) {
    const out = []; let line = '';
    for (const word of s.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; } else line = next;
    }
    if (line) out.push(line);
    return out;
  }
  // 멈춤 화면 그리기 (플레이 화면 위에)
  function drawStage(ctx, S) {
    const u = S.stageUI; if (!u) return;
    const K = G.soft, J = K.J, m = LIST[u.i], k = Math.min(1, u.t / 0.18);
    if (u.kind === 'intro') {                                           // 시작 안내: 가운데 띠 (지도가 비쳐 보이게 옅게 가림)
      ctx.fillStyle = 'rgba(30,24,16,.38)'; ctx.fillRect(0, C.HUD_H, W, H - C.HUD_H);
      const h = 132 * k, y = 262 - h / 2;
      ctx.fillStyle = 'rgba(255,251,240,.97)'; ctx.fillRect(0, y, W, h);
      ctx.fillStyle = m.col; ctx.fillRect(0, y, W, 6 * k); ctx.fillRect(0, y + h - 6 * k, W, 6 * k);
      if (k < 1) return;
      K.rr(ctx, W / 2 - 52, 207, 104, 28, 14); ctx.fillStyle = m.col; ctx.fill();
      J(ctx, (u.i + 1) + '단계', W / 2, 222, 18, '#fff');
      ctx.font = '36px "Jua", sans-serif'; const nw = ctx.measureText(m.name).width;
      G.icons.draw(ctx, m.icon, W / 2 - nw / 2 - 6, 260, 34);
      J(ctx, m.name, W / 2 + 22, 262, 36, m.col);
      J(ctx, m.desc, W / 2, 297, 18, '#3a3022');
      J(ctx, m.fresh, W / 2, 345, 15, '#fff', { stroke: [['rgba(40,28,10,.6)', 4]] });
      return;
    }
    // 끝 카드: 방금 한 일(내 숫자 한 줄) → 실제로 조달청은(사실 한 줄)
    const s = S.stats || {}, pw = 640, ph = 268, px = (W - pw) / 2, py = 142, last = u.i >= LIST.length - 1;
    ctx.fillStyle = 'rgba(30,24,16,.58)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, py + ph / 2); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-W / 2, -(py + ph / 2)); ctx.globalAlpha = k;
    K.softShadow(ctx, 24, 8, .45); K.rr(ctx, px, py, pw, ph, 24); ctx.fillStyle = 'rgba(255,251,240,.98)'; ctx.fill(); K.noShadow(ctx);
    ctx.font = '19px "Jua", sans-serif'; const head = (u.i + 1) + '단계 끝 · ' + m.name, hw = ctx.measureText(head).width + 44;
    K.rr(ctx, W / 2 - hw / 2, py - 17, hw, 34, 17); ctx.fillStyle = m.col; ctx.fill();
    J(ctx, head, W / 2, py + 1, 19, '#fff');
    J(ctx, '방금 한 일', W / 2, py + 44, 15, '#9a8a6a');
    J(ctx, m.me(S, s), W / 2, py + 76, 27, m.col);
    ctx.fillStyle = 'rgba(120,100,60,.2)'; ctx.fillRect(px + 60, py + 108, pw - 120, 2);
    J(ctx, '↓', W / 2, py + 109, 18, '#b8a888', { stroke: [['rgba(255,251,240,1)', 8]] });
    J(ctx, '실제로 조달청은…', W / 2, py + 136, 15, '#9a8a6a');
    ctx.font = '20px "Jua", sans-serif';
    let lines = wrap(ctx, m.real(s), pw - 90);
    if (lines.length === 2) lines = wrap(ctx, m.real(s), ctx.measureText(m.real(s)).width / 2 + 40);   // 두 줄이면 길이를 비슷하게 (한 낱말만 넘어가지 않게)
    lines.forEach((ln, j) => J(ctx, ln, W / 2, py + 168 + j * 27 - (lines.length - 1) * 5, 20, '#3a3022'));
    const f = Math.min(1, u.t / C.STAGE_CARD_SEC);                      // 저절로 넘어가기까지 남은 시간
    K.rr(ctx, px + 60, py + ph - 20, pw - 120, 6, 3); ctx.fillStyle = 'rgba(120,100,60,.18)'; ctx.fill();
    K.rr(ctx, px + 60, py + ph - 20, Math.max(6, (pw - 120) * (1 - f)), 6, 3); ctx.fillStyle = m.col; ctx.fill();
    J(ctx, last ? '누르면 결과 보기' : '누르면 ' + (u.i + 2) + '단계로', W / 2, py + ph - 36, 14, '#9a8a6a');
    ctx.restore();
  }
  // 상단: '몇 단계 이름' + 목표 한 문장
  function drawHud(ctx, S, x) {
    const m = LIST[Math.max(0, S.stage)];
    ctx.fillStyle = m.col; ctx.fillRect(x, 5, 50, 16);
    T(ctx, (S.stage + 1) + '단계', x + 25, 13, 12, '#fff');
    ctx.font = '12px "Galmuri11 Bold", ' + G.FONT; ctx.fillStyle = '#ffe48a'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(m.name, x + 58, 13);
    T(ctx, m.desc, x, 31, 12, '#e6edf5', 'left');
  }
  // 조달청 정면 업적 메달: 업무를 한 번 해낼 때마다 메달이 하나씩 걸리고, 다 모으면 지붕에 금빛 별
  function drawOffice(ctx, S) {
    const b = G.world.office.body, t = S.elapsed || 0;
    LIST.forEach((m, i) => {
      const cx = b.x + 29 + i * 27, cy = b.y + 54, at = S.missions && S.missions[m.id];
      if (at == null) { ctx.strokeStyle = 'rgba(80,90,110,.5)'; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.stroke(); ctx.setLineDash([]); return; }
      const k = Math.min(1, (t - at) / 0.4), sc = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.8 : 1;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
      ctx.fillStyle = '#d9342b'; ctx.fillRect(-5, 2, 3, 8); ctx.fillStyle = '#2f6fb5'; ctx.fillRect(2, 2, 3, 8);   // 리본
      ctx.fillStyle = '#b08800'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
      ctx.fillStyle = m.col; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 7); ctx.fill();
      T(ctx, String(i + 1), 0, 1, 12, '#fff');
      ctx.restore();
    });
    if (count(S) === LIST.length) {                                    // 다 모으면 금별 + 반짝임
      const p = 1 + Math.sin(t * 4) * 0.08;                            // 지붕 양쪽(가운데는 나르미 자리)
      for (const sx of [b.x + 34, b.x + b.w - 34]) {
        const sy = b.y - 1;
        ctx.save(); ctx.translate(sx, sy); ctx.scale(p, p);
        ctx.fillStyle = '#ffd84a'; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 11, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.fill(); ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1; ctx.restore();
        for (let i = 0; i < 2; i++) { const k = ((t * 0.8) + i / 2) % 1; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff6b0'; ctx.fillRect(sx - 10 + i * 20, sy - 10 - k * 10, 2, 2); ctx.globalAlpha = 1; }
      }
    }
  }
  return { LIST, BY, init, update, advance, tick, count, drawHud, drawStage, drawOffice };
})();
