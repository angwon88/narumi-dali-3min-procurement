/* 개발용 자동 플레이 봇 (밸런스 확인용, 제출 빌드에 포함되지 않음)
   사용: 브라우저 콘솔 또는 Playwright에서 이 파일을 불러온 뒤 PlayBot.run({...}) → 한 판 결과 요약
   전략: 가방이 빌 때까지 '가장 급한 요청'의 물건을 가장 싼 공방에서 산다(가방 칸만큼 묶어서) → 마을로 배달
   옵션: avoidFake(예정가 60% 미만 가격 회피), speed(이동 속도 배율, 사람 근사 0.7), inspect(수상해 보이면 나르미 검증) */
'use strict';
window.PlayBot = {
  // 한 프레임의 판단과 이동 (2026-11-04 분리: 시연 영상 녹화에서도 씀). st = { mode } 상태를 프레임 사이에 유지
  tick(S, opt = {}, st = {}) {
    const { avoidFake = true, speed = 1, inspect = false, quality = true, chase = true, sprout = true, stock = true } = opt;
    const d = G.dali, DT = 1 / 60;
    st.mode = st.mode || 'buy'; let target = null;
    const suspicious = sh => Object.keys(sh.mults).some(id => sh.q[id] === 3 && sh.mults[id] < 0.6);   // 개편: ★3인데 ★1 값이면 수상
    const act = G.requests.active(S);
    const uncovered = act.filter(r => {
      const need = act.filter(q => q.item === r.item).length, have = d.bag.filter(b => b.item === r.item).length;
      return need > have;
    }).sort((a, b) => a.left - b.left);
    if (st.mode === 'buy' && (d.bag.length >= S.bagCap || (!uncovered.length && d.bag.length))) st.mode = 'deliver';
    if (st.mode === 'deliver' && !d.bag.length) st.mode = 'buy';
    // 브로커가 계약을 노리고 달리면 나르미로 적발 (chase:false면 안 쫓음) / 실사할 수 있는 새 공방 중 수상해 보이는 곳 → 요청 있는 업종 순
    if (chase && S.bk && (S.bk.state === 'run' || S.bk.state === 'grab') && S.inspectCD <= 0 && !G.narmi.busy()) G.broker.request(S);
    else if (inspect && inspect !== 'never' && S.inspectCD <= 0 && !G.narmi.busy()) {
      const need = new Set(act.map(r => G.ITEM[r.item].cat));
      const ok = S.shops.filter(s => !G.shops.whyNot(S, s));
      const pick = ok.sort((a, b) => (suspicious(b) - suspicious(a)) || (need.has(b.cat) - need.has(a.cat)))[0];
      if (pick) G.shops.request(S, pick);
    }
    const Z = G.events.ZONE;
    const fc = S.forecasts.some(f => f.id === 'surge'), mp = fc ? G.C.MAT_PRICE_FORECAST : G.C.MAT_PRICE;
    if (stock && !S.surge && !S.surgeDone && S.stock < G.C.STOCK_MAX && S.saved >= mp && (S.elapsed < 14 || fc)) target = { x: Z.x + Z.w / 2, y: Z.y + Z.h / 2 };   // 비축: 초반(쌀 때)이나 폭등 예보 때
    else if (st.mode === 'buy') {
      for (const r of uncovered) {
        // 개편: 계약 조건(★minQ)을 맞추는 공방 중 가장 싼 곳. quality:false면 조건을 안 보고 제일 싼 곳(옛 전략 비교용)
        const cand = S.shops.filter(s => G.shops.isOpen(S, s) && s.cat === G.ITEM[r.item].cat && !(avoidFake && suspicious(s)) && (quality === false || s.q[r.item] >= r.minQ));
        const sh = (sprout && cand.find(s => s.sprout && s.verified)) || cand.sort((a, b) => G.shops.price(a, r.item) - G.shops.price(b, r.item))[0];   // sprout: 새싹 공방을 키움
        if (sh) { target = { x: sh.w.door.x + 20, y: sh.w.door.y + 16 }; break; }
      }
    } else {
      const b = d.bag.find(b => act.some(q => q.item === b.item));
      if (!b) d.bag.shift();
      else { const r = act.filter(q => q.item === b.item).sort((x, y) => x.left - y.left)[0]; target = { x: r.vill.yard.x + r.vill.yard.w / 2, y: r.vill.yard.y + 22 }; }
    }
    if (target) {
      const dx = target.x - d.x, dy = target.y - d.y, dist = Math.hypot(dx, dy), stp = d.speed * speed * DT;
      if (dist > stp) { d.x += dx / dist * stp; d.y += dy / dist * stp; d.moving = true; d.face = G.spr.dir8(dx, dy); } else { d.x = target.x; d.y = target.y; d.moving = false; }
    } else d.moving = false;
  },
  run(opt = {}) {
    const { until = 999 } = opt;   // until: 이 시간(초)까지만 진행
    G.screens.newGame(); const S = G.S, DT = 1 / 60; G.screen = 'pause';
    const st = {};
    for (let i = 0; i < 180 * 60 && S.timeLeft > 0 && S.elapsed < until; i++) {
      this.tick(S, opt, st);
      G.screens.step(S, DT); G.screen = 'pause';
      while (S.pendingLevels > 0) { G.levelup.open(S); G.levelup.choose(S, S.offer[0]); G.screen = 'pause'; }
    }
    const st2 = S.stats;
    return { 배달: S.delivered, 불합격: st2.qFail || 0, 가성비: st2.valueBest || 0, 가성비놓침: st2.valueMiss || 0, 놓침: st2.reqExpired, 속음: (st2.scammed || 0) + (st2.stolen || 0), 적발: st2.caught || 0, 검증: S.data, 데이터단계: S.dataLv, 만료: st2.certExpired || 0, 요청: st2.reqMade, 점수: S.score, 신뢰: Math.round(S.trust), 아낀세금: S.saved, 낭비: S.wasted, 레벨: S.level, 선물: (S.gifts || []).length, 최대콤보: S.maxCombo || 0, 브로커승: st2.brokerWon || 0, 브로커막음: st2.brokerBlocked || 0, 브로커적발: st2.brokerCaught || 0, 새싹: st2.sprouts || 0, 필살기: st2.ult || 0, 새싹실적: st2.sproutBuy || 0, 혁신지정: st2.innov || 0 };
  },
  avg(opt, n = 5) {
    const rs = []; for (let i = 0; i < n; i++) rs.push(this.run(opt));
    const out = {}; for (const k of Object.keys(rs[0])) out[k] = +(rs.reduce((a, r) => a + r[k], 0) / n).toFixed(1);
    return out;
  },
};
