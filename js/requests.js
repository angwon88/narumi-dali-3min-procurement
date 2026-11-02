/* 요청: 생성 · 시간 감소 · 만료 (기획서 3.4, 4.1)
   구간별 간격(S.reqInterval)·제한 시간(S.reqLimit)은 director.js가 정한다.
   개편(2026-11-02): 요청 = 계약 카드. 물건 + 예정가격 + 조건(품질 ★minQ 이상).
     납품 = 검수: 실제 품질(realQ)이 조건 이상이면 합격, 아니면 불합격(요청은 남고 쓴 돈은 낭비). */
'use strict';
G.requests = (() => {
  const C = G.C;
  let nextId = 1;

  function init(S) {
    S.requests = [];
    S.reqClock = C.REQ_FIRST_AT;          // 다음 요청까지 남은 시간
    S.reqEmptyT = 0;                      // 요청이 하나도 없던 시간
    S.openVillages = new Set(['school']);
    S.openCats = new Set(['furn', 'elec']);
    S.firstReqDone = false;
    S.stats = { reqMade: 0, reqExpired: 0 };
    S.checks = [];                        // 검수표 연출
  }
  const active = S => S.requests.filter(r => r.state === 'open');
  const ofVillage = (S, vid) => active(S).filter(r => r.vid === vid);

  // 계약 조건: 그 물건을 맞출 수 있는 (정상) 공방의 최고 품질 이하에서 가중치로 뽑음
  function pickMinQ(S, item) {
    let top = 1;
    for (const sh of S.shops) if (G.shops.isOpen(S, sh) && !sh.fake && sh.q[item]) top = Math.max(top, sh.q[item]);
    const w = C.Q_REQ_W.slice(0, top), sum = w.reduce((a, b) => a + b, 0);
    let x = Math.random() * sum; for (let q = 1; q <= w.length; q++) { x -= w[q - 1]; if (x < 0) return q; }
    return 1;
  }
  // 요청 하나 만들기. 만들 수 없으면 null
  function spawn(S, force) {
    const open = active(S);
    if (open.length >= C.MAX_REQ_TOTAL) return null;
    let vid, item;
    if (force) ({ vid, item } = force);
    else {
      const vs = G.world.villages.filter(v => S.openVillages.has(v.id) && ofVillage(S, v.id).length < C.MAX_REQ_PER_VILLAGE);
      if (!vs.length) return null;
      const v = vs[Math.floor(Math.random() * vs.length)];
      if (S.dust && S.openCats.has('health') && Math.random() < 0.6) { vid = v.id; item = 'mask'; }   // 미세먼지 경보: 마스크 요청 몰림
      else {
      const have = new Set(ofVillage(S, v.id).map(r => r.item));
      let pool = v.wants.filter(id => S.openCats.has(G.ITEM[id].cat));
      if (!pool.length) return null;
      const fresh = pool.filter(id => !have.has(id));           // 같은 마을에 같은 물건 겹치지 않게(가능하면)
      if (fresh.length) pool = fresh;
      vid = v.id; item = pool[Math.floor(Math.random() * pool.length)];
      }
    }
    const vill = G.world.villages.find(v => v.id === vid);
    const slot = [0, 1].find(i => !ofVillage(S, vid).some(r => r.slot === i));
    const r = {
      id: nextId++, vid, item, price: G.ITEM[item].price, slot: slot == null ? 0 : slot, minQ: force && force.minQ ? force.minQ : pickMinQ(S, item),
      limit: (S.reqLimit || C.REQ_LIMIT) * (S.limitMult || 1), left: (S.reqLimit || C.REQ_LIMIT) * (S.limitMult || 1), urgent: false,
      state: 'open', t: 0, endT: 0, vill,
    };
    S.requests.push(r); S.stats.reqMade++;
    return r;
  }

  function update(S, dt) {
    // 첫 요청: 0:02 학교 책상 확정
    if (!S.firstReqDone) {
      S.reqClock -= dt;
      if (S.reqClock <= 0) {
        // 첫 계약: 학교 책상 ★★ 이상 (두 가구 공방 중 하나만 맞추도록 품질이 갈리면 ★★, 아니면 뽑기)
        const qs = S.shops.filter(sh => sh.cat === 'furn').map(sh => sh.q.desk).sort();
        spawn(S, { vid: 'school', item: 'desk', minQ: qs[0] < 2 && qs[1] >= 2 ? 2 : 0 });
        S.firstReqDone = true; S.reqClock = S.reqInterval || C.REQ_INTERVAL;
        G.narmi.say('계약 조건부터 확인! 품질 별을 봐요', 2.6);
      }
    } else {
      S.reqClock -= dt;
      if (S.reqClock <= 0) { spawn(S); S.reqClock += S.reqInterval || C.REQ_INTERVAL; }
      // 빈 시간 방지: 요청이 0개인 채로 1초가 지나면 바로 하나
      if (active(S).length === 0) { S.reqEmptyT += dt; if (S.reqEmptyT >= C.REQ_EMPTY_FILL) { spawn(S); S.reqEmptyT = 0; } }
      else S.reqEmptyT = 0;
    }
    for (const r of S.requests) {
      r.t += dt; if (r.failT != null) r.failT += dt;
      if (r.state === 'open') {
        r.left -= dt;
        if (r.left <= 0) { r.left = 0; r.state = 'expired'; S.stats.reqExpired++; onExpire(S, r); }
      } else r.endT += dt;
    }
    S.requests = S.requests.filter(r => r.state === 'open' || r.endT < 0.6);   // 끝난 요청은 0.6초 연출 뒤 제거
    for (const c of S.checks) c.t += dt;
    S.checks = S.checks.filter(c => c.t < C.CHECK_SEC);
  }
  // 시간 초과: 신뢰도 감소 + 마을 피해 8초
  function onExpire(S, r) {
    G.score.trust(S, C.TRUST_FAIL);
    G.score.breakCombo(S);
    G.audio.play('fail');
    G.villages.onFail(S, r.vid);
    const b = G.ui.bubbleRect(r);
    G.fx.add(S, b.x + b.w / 2, b.y - 4, '늦었어요… 신뢰 ' + C.TRUST_FAIL, '#ff8a7a');
  }

  // 수상한 공방 물건 납품 → 검수에서 불량이 드러남 (개편: 요청은 남아 다시 조달해야 함). 신뢰도 -15, 마을 피해, 낸 돈은 낭비된 세금
  function fraud(S, r, b) {
    r.failT = 0;
    G.score.trust(S, C.TRUST_FRAUD);
    G.score.breakCombo(S);
    G.audio.play('scam');
    G.villages.onFail(S, r.vid);
    S.wasted = Math.round((S.wasted + b.paid) * 10) / 10;
    G.gifts.add(S, -b.paid);                                  // 수상한 공방에 낸 돈만큼 저금통에서 빠짐
    S.stats.scammed = (S.stats.scammed || 0) + 1;
    S.catchStreak = 0;
    const y = r.vill.yard;
    G.fx.add(S, y.x + y.w / 2, y.y + 16, '표시는 ★★★, 실제는 불량! 페이퍼컴퍼니', '#ff8a7a', 16);
    G.fx.add(S, y.x + y.w / 2, y.y + 16, '신뢰 ' + C.TRUST_FRAUD + ' · 세금 ' + b.paid + '만원 낭비', '#ff8a7a');
    if (!S.firstScam) { S.firstScam = true; G.narmi.say('연기도 안 나던 공방이었는데…', 2.5); }
  }

  // 검수 불합격(품질 미달): 요청은 남고, 쓴 돈은 낭비, 신뢰도 -6, 콤보 끊김
  function qualityFail(S, r, b) {
    r.failT = 0;
    G.score.trust(S, C.TRUST_QFAIL); G.score.breakCombo(S);
    S.wasted = Math.round((S.wasted + b.paid) * 10) / 10; G.gifts.add(S, -b.paid);
    S.stats.qFail = (S.stats.qFail || 0) + 1;
    G.audio.play('fail');
    const y = r.vill.yard;
    G.fx.add(S, y.x + y.w / 2, y.y + 16, '품질 미달! ★' + r.minQ + ' 이상이 조건이에요', '#ff8a7a', 16);
    G.fx.add(S, y.x + y.w / 2, y.y + 16, '신뢰 ' + C.TRUST_QFAIL + ' · 세금 ' + b.paid + '만원 낭비', '#ff8a7a');
    if (!S.firstQFail) { S.firstQFail = true; G.narmi.say('계약서의 별 개수를 꼭 확인해요!', 2.6); }
  }
  // 부정 낙찰 (기획서 3.7): 방치된 수상한 공방이 이 요청을 따내고 납품하지 않음 → 요청 실패·신뢰도 -15·마을 피해
  function stolen(S, r, sh) {
    r.state = 'expired'; r.fraud = 'empty';
    G.score.trust(S, C.TRUST_FRAUD); G.score.breakCombo(S); G.villages.onFail(S, r.vid);
    S.stats.stolen = (S.stats.stolen || 0) + 1; S.catchStreak = 0;
    const y = r.vill.yard;
    G.fx.add(S, y.x + y.w / 2, y.y + 16, '미납! 부정 낙찰 업체였어요', '#ff8a7a', 16);
    G.fx.add(S, y.x + y.w / 2, y.y + 16, '신뢰 ' + C.TRUST_FRAUD, '#ff8a7a');
    G.audio.play('scam');
    if (!S.firstStolen) { S.firstStolen = true; G.narmi.say('연기도 안 나던 새 공방이었는데…', 2.6); }
  }

  // 혁신제품 시범 사용 (기획서 3.9): 혁신 공방이 된 뒤 첫 INNOV_TRIAL건은 시범 사용.
  // INNOV_TRIAL_FAIL 확률로 '보완 필요' → 그 물건은 못 쓰지만 구매면책으로 신뢰도·콤보 손해 없음(요청은 그대로).
  // 시범 사용을 마치면 '성공 판정' → 이후 점수 ×INNOV_MATURE_MULT. true를 돌려주면 이번 납품은 보완 필요.
  function trial(S, r, b) {
    const sh = S.shops[b.shop]; if (!sh || !sh.innov || sh.mature) return false;
    sh.trial = Math.max(0, sh.trial - 1);
    const fail = Math.random() < C.INNOV_TRIAL_FAIL;
    const y = r.vill.yard;
    if (fail) {
      S.stats.trialFail = (S.stats.trialFail || 0) + 1;
      G.fx.add(S, y.x + y.w / 2, y.y + 16, '시범 사용: 보완 필요', '#ffd6a0', 16);
      G.fx.add(S, y.x + y.w / 2, y.y + 16, '구매면책 · 손해 없음', '#9be37a');
      if (!S.immunityShown) { S.immunityShown = true; G.director.banner(S, '혁신제품 구매면책!', '시범 사용 중 문제는 조달청이 책임져요 · 손해 없음'); }
      G.audio.play('ok');
    }
    if (sh.trial === 0) {
      sh.mature = true; sh.stampT = 0;
      const who = sh.w.cat.name + '공방 ' + sh.w.side;
      G.director.banner(S, who + ' 혁신제품 성공 판정!', '시범 사용 통과 · 공공기관 판로 열림 · 이제 납품 점수 ×' + C.INNOV_MATURE_MULT);
      G.audio.play('gift'); setTimeout(() => G.audio.play('levelup'), 250);
      // 2026-11-02 하이리턴 연출: 금빛 번쩍임 + 공방·마을 양쪽에서 금빛 파편 + 큰 배율 글자
      const b = sh.w.body;
      S.flashT = 0.5; S.shakeT = Math.max(S.shakeT || 0, 0.25);
      G.fx.burst(S, b.x + b.w / 2, b.y + 40, true, 60); G.fx.burst(S, y.x + y.w / 2, y.y + 10, true, 40);
      G.fx.add(S, b.x + b.w / 2, b.y + 96, '★ 성공 판정! 점수 ×' + C.INNOV_MATURE_MULT, '#ffd84a', 28);
      S.stats.innovMature = (S.stats.innovMature || 0) + 1;
    }
    return fail;
  }

  // 납품: 달이가 마을 앞마당에 들어가면 그 마을 요청과 맞는 물건을 모두 납품
  function deliver(S) {
    const d = G.dali; if (!d.bag.length) return;
    const v = G.world.villages.find(v => S.openVillages.has(v.id) && G.U.inRect(d.x, d.y, v.yard));
    if (!v) return;
    for (let i = 0; i < d.bag.length; i++) {
      const b = d.bag[i];
      // 어느 계약에 낼까: 표시 품질로 조건을 맞추는 것 중 가장 급한 것 → 없으면 가장 급한 것(불합격 위험)
      const same = ofVillage(S, v.id).filter(q => q.item === b.item).sort((a, c) => a.left - c.left);
      const r = same.find(q => b.q >= q.minQ) || same[0];
      if (!r) continue;
      d.bag.splice(i--, 1);
      const ok = b.realQ >= r.minQ;
      S.checks.push({ x: r.vill.yard.x + r.vill.yard.w / 2, y: r.vill.yard.y - 128, minQ: r.minQ, q: b.q, realQ: b.realQ, ok, fake: b.fake, t: 0 });
      if (b.fake) { fraud(S, r, b); continue; }
      if (!ok) { qualityFail(S, r, b); continue; }
      if (b.innov && trial(S, r, b)) continue;                    // 혁신제품 시범 사용: '보완 필요'면 요청은 그대로 남음
      r.state = 'done';
      S.stats.passed = (S.stats.passed || 0) + 1;
      G.score.delivered(S, r, b);
    }
  }

  return { init, update, spawn, active, ofVillage, deliver, stolen };
})();
