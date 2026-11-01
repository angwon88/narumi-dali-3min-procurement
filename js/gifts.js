/* 세금 저금통 → 마을 선물 (2026-11-01 추가, 기획서 3.10)
   싸게 산 만큼(예정가격 - 구매가) 저금통이 차고, 낭비(독점 가격 초과분·수상한 공방에 낸 돈)는 빠진다.
   GIFT_STEP만원이 모일 때마다 선물이 가장 적은 열린 마을에 공공시설 하나가 생긴다 → 신뢰도·점수 보너스.
   "국민 세금을 아끼면 그 돈이 다시 국민에게 돌아간다"를 눈으로 보여 주는 장치. */
'use strict';
G.gifts = (() => {
  const C = G.C, T = (...a) => G.world.text(...a);
  const KINDS = [
    { id: 'bench', name: '벤치' }, { id: 'flower', name: '꽃밭' }, { id: 'lamp', name: '가로등' },
    { id: 'tree', name: '나무' }, { id: 'slide', name: '미끄럼틀' }, { id: 'fountain', name: '분수' },
  ];
  const SLOTS = [14, 196, 44, 166, 74, 136];          // 앞마당 안 x 위치 (가운데는 비워 둠)
  function init(S) { S.bank = 0; S.gifts = []; S.giftIdx = 0; }
  function add(S, amount) {
    S.bank = Math.max(0, Math.round((S.bank + amount) * 10) / 10);
    while (S.bank >= C.GIFT_STEP) { S.bank = Math.round((S.bank - C.GIFT_STEP) * 10) / 10; give(S); }
  }
  function give(S) {
    const open = G.world.villages.filter(v => S.openVillages.has(v.id));
    const count = v => S.gifts.filter(g => g.vid === v.id).length;
    const min = Math.min(...open.map(count));
    const cand = open.filter(v => count(v) === min && count(v) < SLOTS.length);
    if (!cand.length) return;
    const v = cand[Math.floor(Math.random() * cand.length)];
    const kind = KINDS[S.giftIdx++ % KINDS.length];
    S.gifts.push({ vid: v.id, kind: kind.id, slot: count(v), t: 0 });
    G.score.trust(S, C.GIFT_TRUST); S.score += C.GIFT_SCORE;
    G.director.banner(S, '아낀 세금으로 ' + v.name + '에 ' + kind.name + G.U.josa(kind.name, '이', '가') + ' 생겼어요!', '국민 세금이 다시 마을로 · 신뢰 +' + C.GIFT_TRUST);
    G.fx.add(S, v.yard.x + v.yard.w / 2, v.yard.y + 6, '+' + C.GIFT_SCORE, '#ffe48a', 16);
    G.audio.play('gift');
  }
  function update(S, dt) { for (const g of S.gifts) g.t += dt; }

  // ---------- 그리기 (임시 픽셀 그림) ----------
  function drawOne(ctx, kind, x, y) {          // (x, y) = 바닥 가운데
    const R = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
    switch (kind) {
      case 'bench': R(-11, -10, 22, 3, '#8a5a30'); R(-11, -6, 22, 3, '#8a5a30'); R(-10, -3, 2, 3, '#4f321a'); R(8, -3, 2, 3, '#4f321a'); break;
      case 'flower': R(-11, -4, 22, 4, '#4f8a3a'); [['#e2433b', -8], ['#ffd84a', -2], ['#e86ac0', 4], ['#fff', 9]].forEach(([c, dx]) => { R(dx - 1, -9, 3, 3, c); R(dx, -6, 1, 3, '#2e6b2e'); }); break;
      case 'lamp': R(-1, -24, 2, 24, '#4a4f57'); R(-4, -28, 8, 5, '#ffe066'); R(-5, -29, 10, 2, '#4a4f57'); break;
      case 'tree': R(-2, -8, 4, 8, '#6b4423'); ctx.fillStyle = '#3f8f3a'; ctx.beginPath(); ctx.arc(x, y - 16, 10, 0, Math.PI * 2); ctx.fill(); R(-4, -22, 4, 3, '#5fb355'); break;
      case 'slide': R(-10, -22, 2, 22, '#5b8fb9'); R(-6, -22, 2, 22, '#5b8fb9'); for (let i = 0; i < 4; i++) R(-10, -20 + i * 5, 6, 1, '#5b8fb9');
        ctx.fillStyle = '#e2433b'; ctx.beginPath(); ctx.moveTo(x - 4, y - 22); ctx.lineTo(x + 12, y); ctx.lineTo(x + 7, y); ctx.lineTo(x - 4, y - 17); ctx.fill(); break;
      case 'fountain': R(-12, -6, 24, 6, '#9aa5b1'); R(-10, -5, 20, 3, '#5ec8f2'); R(-1, -16, 2, 10, '#9aa5b1');
        for (let i = 0; i < 3; i++) R(-6 + i * 6, -14 - (Math.floor(Date.now() / 200 + i) % 3) * 2, 2, 2, '#9fd3ff'); break;
    }
  }
  function draw(ctx, S) {
    for (const g of S.gifts) {
      const v = G.world.villages.find(v => v.id === g.vid), x = v.yard.x + SLOTS[g.slot], y = v.yard.y + 36;
      const k = Math.min(1, g.t / 0.35), sc = k < 1 ? 0.3 + k * 0.9 : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y);
      drawOne(ctx, g.kind, x, y); ctx.restore();
      if (g.t < 1.2) {                                       // 반짝임
        ctx.fillStyle = 'rgba(255,240,150,' + (1 - g.t / 1.2) + ')';
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + g.t * 3, r = 10 + g.t * 18; ctx.fillRect(x + Math.cos(a) * r - 1, y - 12 + Math.sin(a) * r - 1, 3, 3); }
      }
    }
  }
  // HUD: 다음 선물까지 막대
  function hudBar(ctx, S, x, y, w) {
    const f = Math.min(1, S.bank / C.GIFT_STEP);
    ctx.fillStyle = '#0f1620'; ctx.fillRect(x, y, w, 6);
    ctx.fillStyle = '#9be37a'; ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * f), 4);
  }
  return { init, add, update, draw, hudBar, KINDS };
})();
