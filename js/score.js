/* 점수 · 신뢰도 · 아낀 세금 · 통계 (기획서 3.5) */
'use strict';
G.score = (() => {
  const C = G.C;
  const r1 = v => Math.round(v * 10) / 10;
  function init(S) {
    S.score = 0; S.trust = C.TRUST_START; S.saved = 0; S.wasted = 0; S.delivered = 0; S.onTime = 0;
  }
  function trust(S, d) { S.trust = Math.max(0, Math.min(100, S.trust + d)); }
  // 제때 납품: 100 + 시간 보너스(남은 비율×50) + 절감 점수(절감액×20)
  function delivered(S, r, bagItem) {
    const frac = r.left / r.limit;
    const saving = r1(r.price - bagItem.paid);
    let pts = C.DELIVER_BASE + Math.round(frac * C.TIME_BONUS) + (saving > 0 ? Math.round(saving * C.SAVING_MULT) : 0);
    pts = Math.round(pts * (S.scoreMult || 1));
    S.score += pts; S.delivered++; S.onTime++;
    if (saving > 0) S.saved = r1(S.saved + saving); else if (saving < 0) S.wasted = r1(S.wasted - saving);
    trust(S, frac >= 0.5 ? C.TRUST_FAST : C.TRUST_ON_TIME);
    const v = r.vill.yard;
    G.fx.add(S, v.x + v.w / 2, r.vill.slot.y + 30, '+' + pts, '#ffe48a', 16);
    if (saving > 0) G.fx.add(S, v.x + v.w / 2, r.vill.slot.y + 30, '세금 +' + saving + '만원', '#9be37a');
  }
  return { init, trust, delivered };
})();
