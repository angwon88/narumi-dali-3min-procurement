/* 점수 · 신뢰도 · 아낀 세금 · 통계 (기획서 3.5) */
'use strict';
G.score = (() => {
  const C = G.C;
  const r1 = v => Math.round(v * 10) / 10;
  function init(S) {
    S.score = 0; S.trust = C.TRUST_START; S.saved = 0; S.wasted = 0; S.delivered = 0; S.onTime = 0;
    S.combo = 0; S.maxCombo = 0; S.comboT = 0;
  }
  const comboMult = S => Math.min(C.COMBO_MAX_MULT, 1 + C.COMBO_STEP * Math.max(0, S.combo - 1));
  function breakCombo(S) { if (S.combo >= 3) G.fx.add(S, G.dali.x, G.dali.y - 70, '콤보 끊김…', '#ff8a7a'); S.combo = 0; }
  function trust(S, d) { S.trust = Math.max(0, Math.min(100, S.trust + d)); }
  // 제때 납품: 100 + 시간 보너스(남은 비율×50) + 절감 점수(절감액×20)
  function delivered(S, r, bagItem) {
    const frac = r.left / r.limit;
    const saving = r1(r.price - bagItem.paid);
    let pts = C.DELIVER_BASE + Math.round(frac * C.TIME_BONUS * (S.timeBonusMult || 1)) + (saving > 0 ? Math.round(saving * C.SAVING_MULT) : 0);
    S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo); S.comboT = 0;
    const cm = comboMult(S);
    const sh = bagItem.innov ? S.shops[bagItem.shop] : null;
    pts = Math.round(pts * (S.scoreMult || 1) * cm * (sh ? (sh.mature ? C.INNOV_MATURE_MULT : C.INNOV_SCORE_MULT) : 1));
    if (bagItem.innov) { trust(S, C.INNOV_TRUST_BONUS); S.stats.innovDelivered = (S.stats.innovDelivered || 0) + 1; }
    S.score += pts; S.delivered++; S.onTime++;
    G.levelup.gain(S);
    if (saving > 0) S.saved = r1(S.saved + saving); else if (saving < 0) S.wasted = r1(S.wasted - saving);
    G.gifts.add(S, saving);                                   // 아낀 만큼 저금통 +, 비싸게 산 만큼 -
    trust(S, frac >= 0.5 ? C.TRUST_FAST : C.TRUST_ON_TIME);
    G.villages.onSuccess(S, r.vid);
    if (bagItem.prep && (S.dust || S.storm)) {                     // 예보 보고 미리 준비한 물건을 사건 중 납품
      S.score += C.PREP_BONUS; trust(S, C.PREP_TRUST); S.stats.prepared = (S.stats.prepared || 0) + 1;
      const yd = r.vill.yard; G.fx.add(S, yd.x + yd.w / 2, yd.y + 16, '미리 대비했어요! +' + C.PREP_BONUS, '#9be37a', 16);
    }
    G.audio.play('deliver', S.combo);
    const v = r.vill.yard;
    const star = sh && sh.mature ? '  ★혁신 ×' + C.INNOV_MATURE_MULT : '';   // 성공 판정 뒤 혁신 납품은 금빛 파편과 함께
    G.fx.add(S, v.x + v.w / 2, v.y + 16, '+' + pts + star + (S.combo >= 2 ? '  콤보 ' + S.combo + '!' : ''), '#ffe48a', 16);
    if (star) G.fx.burst(S, v.x + v.w / 2, v.y + 10, true, 24);
    if (saving > 0) G.fx.add(S, v.x + v.w / 2, v.y + 16, '세금 +' + saving + '만원', '#9be37a');
    // 개편: 가성비 판정 (산 순간 기준, 조건을 맞춘 곳 중 가장 쌌나)
    if (bagItem.best === true) {
      S.score += C.VALUE_BONUS; S.stats.valueBest = (S.stats.valueBest || 0) + 1;
      G.fx.add(S, v.x + v.w / 2, v.y + 16, '가성비 최고! +' + C.VALUE_BONUS, '#7fe0ff', 16);
    } else if (bagItem.best === false) {
      S.stats.valueMiss = (S.stats.valueMiss || 0) + 1;
      G.fx.add(S, v.x + v.w / 2, v.y + 16, bagItem.q > r.minQ ? '과잉 품질 · 조건 맞는 더 싼 곳이 있었어요' : '조건 맞는 더 싼 곳이 있었어요', '#ffd6a0');
    }
  }
  return { init, trust, delivered, comboMult, breakCombo };
})();
