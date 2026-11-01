/* 개발용 자동 플레이 봇 (밸런스 확인용, 제출 빌드에 포함되지 않음)
   사용: 브라우저 콘솔 또는 Playwright에서 이 파일을 불러온 뒤 PlayBot.run({...}) → 한 판 결과 요약
   전략: 가방이 빌 때까지 '가장 급한 요청'의 물건을 가장 싼 공방에서 산다(가방 칸만큼 묶어서) → 마을로 배달
   옵션: avoidFake(예정가 60% 미만 가격 회피), speed(이동 속도 배율, 사람 근사 0.7), inspect(수상해 보이면 나르미 검증) */
'use strict';
window.PlayBot = {
  run(opt = {}) {
    const { avoidFake = true, speed = 1, inspect = false, until = 999 } = opt;   // until: 이 시간(초)까지만 진행
    G.screens.newGame(); const S = G.S, d = G.dali, DT = 1 / 60; G.screen = 'pause';
    let mode = 'buy', target = null;
    const suspicious = sh => Object.keys(sh.mults).some(id => sh.mults[id] < 0.6);
    for (let i = 0; i < 180 * 60 && S.timeLeft > 0 && S.elapsed < until; i++) {
      const act = G.requests.active(S);
      const uncovered = act.filter(r => {
        const need = act.filter(q => q.item === r.item).length, have = d.bag.filter(b => b.item === r.item).length;
        return need > have;
      }).sort((a, b) => a.left - b.left);
      if (mode === 'buy' && (d.bag.length >= S.bagCap || (!uncovered.length && d.bag.length))) mode = 'deliver';
      if (mode === 'deliver' && !d.bag.length) mode = 'buy';
      target = null;
      if (mode === 'buy') {
        for (const r of uncovered) {
          const cand = S.shops.filter(s => G.shops.isOpen(S, s) && s.cat === G.ITEM[r.item].cat && !(avoidFake && suspicious(s)));
          if (inspect) for (const s of S.shops) if (G.shops.isOpen(S, s) && suspicious(s) && !s.verified && S.inspectCD <= 0 && !G.narmi.busy()) G.narmi.send(S, s);
          const sh = cand.sort((a, b) => G.shops.price(a, r.item) - G.shops.price(b, r.item))[0];
          if (sh) { target = { x: sh.w.door.x + 20, y: sh.w.door.y + 16 }; break; }
        }
      } else {
        const b = d.bag.find(b => act.some(q => q.item === b.item));
        if (!b) d.bag.shift();
        else { const r = act.filter(q => q.item === b.item).sort((x, y) => x.left - y.left)[0]; target = { x: r.vill.yard.x + r.vill.yard.w / 2, y: r.vill.yard.y + 22 }; }
      }
      if (target) {
        const dx = target.x - d.x, dy = target.y - d.y, dist = Math.hypot(dx, dy), st = d.speed * speed * DT;
        if (dist > st) { d.x += dx / dist * st; d.y += dy / dist * st; d.moving = true; } else { d.x = target.x; d.y = target.y; d.moving = false; }
      } else d.moving = false;
      G.screens.step(S, DT); G.screen = 'pause';
      while (S.pendingLevels > 0) { G.levelup.open(S); G.levelup.choose(S, S.offer[0]); G.screen = 'pause'; }
    }
    const st = S.stats;
    return { 배달: S.delivered, 놓침: st.reqExpired, 속음: st.scammed || 0, 적발: st.caught || 0, 요청: st.reqMade, 점수: S.score, 신뢰: Math.round(S.trust), 아낀세금: S.saved, 낭비: S.wasted, 레벨: S.level, 선물: (S.gifts || []).length, 최대콤보: S.maxCombo || 0 };
  },
  avg(opt, n = 5) {
    const rs = []; for (let i = 0; i < n; i++) rs.push(this.run(opt));
    const out = {}; for (const k of Object.keys(rs[0])) out[k] = +(rs.reduce((a, r) => a + r[k], 0) / n).toFixed(1);
    return out;
  },
};
