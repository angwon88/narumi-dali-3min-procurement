/* 레벨업과 카드 (기획서 3.9)
   납품 수가 LEVEL_REQ에 닿으면 레벨업 → 게임 시간 정지, 카드 3장 중 1장 선택(클릭·1/2/3 키)
   3장 중 1장은 항상 혁신제품 시범구매 카드 (후보가 없으면 일반 카드). */
'use strict';
G.levelup = (() => {
  const C = G.C, W = C.VIEW.w, H = C.VIEW.h, T = (...a) => G.world.text(...a);
  const LOCK = 0.5;                                   // 실수 방지: 카드가 뜬 뒤 0.5초 입력 무시

  // 일반 카드: max = 최대 횟수, ok = 지금 고를 수 있는지, apply = 효과
  const CARDS = [
    { id: 'shoes', name: '달이의 운동화', icon: 'shoes', col: '#e2433b', max: 3, desc: () => '이동 속도 +15%',
      apply: S => { S.speedMult *= 1.15; } },
    // 가방은 강해서 1회만, Lv.4부터 등장 (4칸째는 가구 혁신 카드로만)
    { id: 'bag', name: '큰 도토리 가방', icon: 'bag', col: '#b9824f', max: 1, desc: () => '가방 +1칸',
      ok: S => S.level - S.pendingLevels + 1 >= 4 && S.bagCap < C.BAG_MAX, apply: S => { S.bagCap = Math.min(C.BAG_MAX, S.bagCap + 1); } },
    { id: 'wings', name: '나르미의 날개', icon: 'wing', col: '#5b8fb9', max: 2, desc: () => '검증 쉬는 시간 -30%',
      apply: S => { S.inspectCDMult *= 0.7; } },
    { id: 'share', name: '가성비 계산기', icon: 'chart', col: '#7a5ab8', max: 1, desc: () => '급한 계약에 가장 알맞은 가격표에 초록 테두리',
      apply: S => { S.valueHint = true; } },
    { id: 'talk', name: '마을과 소통', icon: 'talk', col: '#46b04a', max: 2, desc: () => '새 요청 제한 시간 +15%',
      apply: S => { S.limitMult *= 1.15; } },
    { id: 'ledger', name: '공정 거래 장부', icon: 'book', col: '#2f4f8a', max: 1, desc: S => '한 공방만 써도 버티는 횟수 +2 (폐업 ' + S.streakClose + '→' + (S.streakClose + 2) + '번)',
      apply: S => { S.streakWarn += 2; S.streakClose += 2; } },
    { id: 'quick', name: '빠른 계산', icon: 'coin', col: '#d9a441', max: 1,
      desc: () => G.settings.buyMode === 'auto' ? '구매 대기 0.4초 → 0.2초' : '이동 속도 +8%',
      apply: S => { if (G.settings.buyMode === 'auto') S.buyDwell = 0.2; else S.speedMult *= 1.08; } },
  ];
  // 혁신제품 (기획서 3.9): 카테고리별 효과 ① + 고른 공방이 혁신 공방으로 성장 ②
  const INNOV = {
    furn:   { product: '접이식 수납 카트', icon: 'cart',    effect: '가방 +1칸',             apply: S => { S.bagCap = Math.min(C.BAG_MAX, S.bagCap + 1); } },
    elec:   { product: '스마트 주문판',    icon: 'board',   effect: '새 요청 제한 시간 +15%', apply: S => { S.limitMult *= 1.15; } },
    health: { product: '보온 배송 상자',   icon: 'box',     effect: '시간 보너스 2배',        apply: S => { S.timeBonusMult = 2; } },
    safety: { product: '전동 킥보드',      icon: 'scooter', effect: '킥보드 타고 이동 속도 +35%', apply: S => { S.speedMult *= 1.35; S.scooter = true; } },
  };
  function innovCard(S) {
    const cand = S.shops.filter(sh => G.shops.isOpen(S, sh) && !sh.fake && !sh.innov && !S.innovCats.has(sh.cat));
    if (!cand.length) return null;
    const sh = cand[Math.floor(Math.random() * cand.length)], I = INNOV[sh.cat], who = sh.w.cat.name + '공방 ' + sh.w.side;
    return {
      id: 'innov', innov: true, shop: sh, name: I.product, icon: I.icon, col: '#f6c431', max: 99,
      lines: ['① ' + I.effect, '② ' + who + ' → 혁신 공방', '(시범 사용 3건 · 구매면책)'],
      desc: () => '',
      apply: S2 => { I.apply(S2); S2.innovCats.add(sh.cat); G.shops.makeInnov(S2, sh); },
    };
  }
  const BONUS = { id: 'bonus', name: '응원 보너스', icon: 'star', col: '#f6c431', max: 99, desc: () => '점수 +200', apply: S => { S.score += 200; } };

  function init(S) {
    S.level = 1; S.pendingLevels = 0; S.taken = {}; S.offer = null; S.offerT = 0;
    S.speedMult = 1; S.inspectCDMult = 1; S.limitMult = 1; S.fakeHint = false; S.buyDwell = C.BUY_DWELL;
    S.innovCats = new Set(); S.timeBonusMult = 1;
  }
  const xpNeed = S => C.LEVEL_REQ[S.level - 1];               // 다음 레벨까지 필요한 누적 납품 수 (없으면 최고 레벨)
  function gain(S) {
    if (!C.LEVELUP) return;                                          // 2026-11-03 레벨업 카드 끔
    while (xpNeed(S) != null && S.delivered >= xpNeed(S)) { S.level++; S.pendingLevels++; }
  }
  function available(S) { return CARDS.filter(c => (S.taken[c.id] || 0) < c.max && (!c.ok || c.ok(S))); }
  function makeOffer(S) {
    const pool = available(S).slice(), pick = [];
    const inv = null;                                                      // 개편: 혁신은 새싹 공방을 키워서 (레벨업 혁신 카드 없음)
    while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    while (pick.length < 3) pick.push(BONUS);
    if (inv) { pick.splice(0, 1); pick.splice(1, 0, inv); }               // 혁신 카드를 가운데로
    return pick;
  }
  function open(S) { S.offer = makeOffer(S); S.offerT = 0; G.screen = 'levelup'; G.audio.play('levelup'); }
  function choose(S, card) {
    G.audio.play('click');
    card.apply(S);
    S.taken[card.id] = (S.taken[card.id] || 0) + 1;
    (S.stats.cards = S.stats.cards || []).push(card.id);
    G.dali.speed = C.DALI_SPEED * S.speedMult;
    S.pendingLevels--;
    G.fx.add(S, G.dali.x, G.dali.y - 80, card.name + '!', '#ffe48a', 16);
    if (S.pendingLevels > 0) open(S); else { S.offer = null; G.screen = 'play'; }
  }

  // ---------- 화면 ----------
  const CW = 220, CH = 280, GAP = 20, X0 = (W - (CW * 3 + GAP * 2)) / 2, Y0 = 150;
  const rect = i => ({ x: X0 + i * (CW + GAP), y: Y0, w: CW, h: CH });
  function update(dt) {
    const S = G.S; S.offerT += dt;
    if (S.offerT < LOCK) return;
    for (let i = 0; i < 3; i++) if (G.input.hit(String(i + 1)) || G.ui.clicked(rect(i))) { choose(S, S.offer[i]); return; }
  }
  function wrap(ctx, text, maxW) {                     // 한글 줄바꿈 (글자 단위)
    ctx.font = '12px ' + G.FONT; const lines = []; let cur = '';
    for (const ch of text) { if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch.trim() ? ch : ''; } else cur += ch; }
    if (cur) lines.push(cur); return lines;
  }
  // 카드 아이콘 (임시 픽셀 그림, 3주차에 다듬기)
  function icon(ctx, kind, cx, cy, col) {
    ctx.fillStyle = col; ctx.fillRect(cx - 28, cy - 28, 56, 56);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(cx - 28, cy - 28, 56, 6);
    ctx.fillStyle = '#fffdf6';
    const R = (x, y, w, h) => ctx.fillRect(cx + x, cy + y, w, h);
    switch (kind) {
      case 'shoes': R(-16, 0, 24, 10); R(-16, -10, 10, 10); R(8, 4, 10, 6); ctx.fillStyle = '#3a3a3a'; R(-16, 10, 34, 3); break;
      case 'bag': R(-14, -6, 28, 22); R(-8, -14, 16, 4); R(-10, -12, 3, 8); R(7, -12, 3, 8); ctx.fillStyle = col; R(-4, 0, 8, 6); break;
      case 'wing': for (let i = 0; i < 4; i++) R(-16 + i * 6, -10 + i * 4, 30 - i * 6, 4); break;
      case 'chart': R(-18, 12, 36, 3); R(-14, -2, 6, 14); R(-5, -12, 6, 24); R(4, 2, 6, 10); R(13, -8, 5, 20); break;
      case 'talk': R(-18, -14, 36, 22); R(-10, 8, 6, 6); ctx.fillStyle = col; R(-12, -6, 6, 4); R(-2, -6, 6, 4); R(8, -6, 4, 4); break;
      case 'book': R(-16, -14, 32, 28); ctx.fillStyle = col; R(-1, -14, 2, 28); R(-12, -8, 9, 2); R(4, -8, 9, 2); R(-12, -2, 9, 2); R(4, -2, 9, 2); break;
      case 'coin': ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = col; R(-2, -10, 4, 20); R(-8, -6, 16, 3); R(-8, 3, 16, 3); break;
      case 'cart': R(-16, -8, 28, 14); R(10, -14, 3, 10); ctx.fillStyle = col; R(-12, -4, 20, 6); ctx.fillStyle = '#fffdf6'; R(-14, 8, 6, 6); R(4, 8, 6, 6); break;
      case 'board': R(-14, -18, 28, 32); ctx.fillStyle = col; R(-10, -14, 20, 4); R(-10, -6, 14, 3); R(-10, 0, 18, 3); R(-10, 6, 10, 3); break;
      case 'box': R(-16, -10, 32, 22); ctx.fillStyle = col; R(-16, -4, 32, 3); ctx.fillStyle = '#e2433b'; R(-2, -16, 4, 6); R(-6, -18, 12, 3); break;
      case 'scooter': R(-16, 8, 8, 8); R(8, 8, 8, 8); R(-12, 6, 24, 3); R(8, -16, 3, 24); R(4, -16, 10, 3); break;
      default: for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 0.4; R(Math.cos(a) * 12 - 4, Math.sin(a) * 12 - 4, 8, 8); } R(-6, -6, 12, 12);
    }
  }
  function draw(ctx, t) {
    const S = G.S;
    ctx.fillStyle = 'rgba(10,14,20,.72)'; ctx.fillRect(0, 0, W, H);
    T(ctx, '레벨 업!  Lv.' + (S.level - S.pendingLevels + 1), W / 2 + 2, 96 + 2, 32, '#2f4f8a');
    T(ctx, '레벨 업!  Lv.' + (S.level - S.pendingLevels + 1), W / 2, 96, 32, '#ffd84a');
    T(ctx, '하나를 골라 주세요  (클릭 또는 1·2·3)', W / 2, 128, 12, '#cfd8e3');
    const ready = S.offerT >= LOCK;
    S.offer.forEach((c, i) => {
      const r = rect(i), hot = ready && G.U.inRect(G.input.mouse.x, G.input.mouse.y, r), pop = Math.min(1, S.offerT / 0.25);
      const lift = hot ? -6 : 0;
      ctx.save(); ctx.globalAlpha = pop; ctx.translate(0, (1 - pop) * 30 + lift);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(r.x + 4, r.y + 6, r.w, r.h);
      ctx.fillStyle = '#fffdf6'; ctx.fillRect(r.x, r.y, r.w, r.h);
      const bw = c.innov ? 6 : 3; ctx.fillStyle = c.innov ? (hot ? '#ffe27a' : '#e0a800') : hot ? '#ffd84a' : '#3a3a3a';
      ctx.fillRect(r.x, r.y, r.w, bw); ctx.fillRect(r.x, r.y + r.h - bw, r.w, bw); ctx.fillRect(r.x, r.y, bw, r.h); ctx.fillRect(r.x + r.w - bw, r.y, bw, r.h);
      if (c.innov) {                                    // '혁신제품 시범구매' 리본
        ctx.fillStyle = '#d9342b'; ctx.fillRect(r.x + r.w - 92, r.y + 10, 84, 18);
        T(ctx, '혁신 시범구매', r.x + r.w - 50, r.y + 19, 12, '#fff');
      }
      T(ctx, '[' + (i + 1) + ']', r.x + 20, r.y + 18, 12, '#8a8a8a');
      icon(ctx, c.icon, r.x + r.w / 2, r.y + 78, c.col);
      T(ctx, c.name, r.x + r.w / 2, r.y + 136, 16, '#2a2416');
      const lines = c.lines ? c.lines.flatMap(l => wrap(ctx, l, r.w - 28)) : wrap(ctx, c.desc(S), r.w - 32);
      lines.forEach((ln, k) => T(ctx, ln, r.x + r.w / 2, r.y + 168 + k * 18, 12, c.innov && k === lines.length - 1 ? '#8a6a00' : '#4a3f2a'));
      if (c.max < 99) {
        const n = S.taken[c.id] || 0;
        for (let k = 0; k < c.max; k++) { ctx.fillStyle = k < n ? '#f6c431' : '#ddd6c4'; ctx.fillRect(r.x + r.w / 2 - c.max * 9 + k * 18 + 2, r.y + r.h - 34, 14, 10); }
        T(ctx, (n + 1) + ' / ' + c.max + ' 단계', r.x + r.w / 2, r.y + r.h - 14, 12, '#8a8a8a');
      }
      ctx.restore();
    });
    if (!ready) { ctx.fillStyle = 'rgba(10,14,20,.25)'; ctx.fillRect(X0, Y0, CW * 3 + GAP * 2, CH); }
  }
  return { INNOV, init, gain, open, choose, update, draw, CARDS, xpNeed, available };
})();
