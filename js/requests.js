/* 요청: 생성 · 시간 감소 · 만료 (기획서 3.4, 4.1)
   구간별 간격(S.reqInterval)·제한 시간(S.reqLimit)은 director.js가 정한다. */
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
  }
  const active = S => S.requests.filter(r => r.state === 'open');
  const ofVillage = (S, vid) => active(S).filter(r => r.vid === vid);

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
      const have = new Set(ofVillage(S, v.id).map(r => r.item));
      let pool = v.wants.filter(id => S.openCats.has(G.ITEM[id].cat));
      if (!pool.length) return null;
      const fresh = pool.filter(id => !have.has(id));           // 같은 마을에 같은 물건 겹치지 않게(가능하면)
      if (fresh.length) pool = fresh;
      vid = v.id; item = pool[Math.floor(Math.random() * pool.length)];
    }
    const vill = G.world.villages.find(v => v.id === vid);
    const slot = [0, 1].find(i => !ofVillage(S, vid).some(r => r.slot === i));
    const r = {
      id: nextId++, vid, item, price: G.ITEM[item].price, slot: slot == null ? 0 : slot,
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
      if (S.reqClock <= 0) { spawn(S, { vid: 'school', item: 'desk' }); S.firstReqDone = true; S.reqClock = S.reqInterval || C.REQ_INTERVAL; }
    } else {
      S.reqClock -= dt;
      if (S.reqClock <= 0) { spawn(S); S.reqClock += S.reqInterval || C.REQ_INTERVAL; }
      // 빈 시간 방지: 요청이 0개인 채로 1초가 지나면 바로 하나
      if (active(S).length === 0) { S.reqEmptyT += dt; if (S.reqEmptyT >= C.REQ_EMPTY_FILL) { spawn(S); S.reqEmptyT = 0; } }
      else S.reqEmptyT = 0;
    }
    for (const r of S.requests) {
      r.t += dt;
      if (r.state === 'open') {
        r.left -= dt;
        if (r.left <= 0) { r.left = 0; r.state = 'expired'; S.stats.reqExpired++; onExpire(S, r); }
      } else r.endT += dt;
    }
    S.requests = S.requests.filter(r => r.state === 'open' || r.endT < 0.6);   // 끝난 요청은 0.6초 연출 뒤 제거
  }
  // 시간 초과: 신뢰도 감소 + 마을 피해 8초
  function onExpire(S, r) {
    G.score.trust(S, C.TRUST_FAIL);
    G.villages.onFail(S, r.vid);
    const b = G.ui.bubbleRect(r);
    G.fx.add(S, b.x + b.w / 2, b.y - 4, '늦었어요… 신뢰 ' + C.TRUST_FAIL, '#ff8a7a');
  }

  // 수상한 공방 물건 납품: 50% 미납(빈 상자) · 50% 불량 → 요청 실패, 신뢰도 -15, 마을 피해, 낸 돈은 낭비된 세금
  function fraud(S, r, b) {
    r.state = 'expired'; r.fraud = Math.random() < 0.5 ? 'empty' : 'broken';
    G.score.trust(S, C.TRUST_FRAUD);
    G.villages.onFail(S, r.vid);
    S.wasted = Math.round((S.wasted + b.paid) * 10) / 10;
    G.gifts.add(S, -b.paid);                                  // 수상한 공방에 낸 돈만큼 저금통에서 빠짐
    S.stats.scammed = (S.stats.scammed || 0) + 1;
    const y = r.vill.yard;
    G.fx.add(S, y.x + y.w / 2, y.y + 16, r.fraud === 'empty' ? '빈 상자였어요…' : '불량품이에요!', '#ff8a7a', 16);
    G.fx.add(S, y.x + y.w / 2, y.y + 16, '신뢰 ' + C.TRUST_FRAUD + ' · 세금 ' + b.paid + '만원 낭비', '#ff8a7a');
    if (!S.firstScam) { S.firstScam = true; G.narmi.say('연기도 안 나던 공방이었는데…', 2.5); }
  }

  // 납품: 달이가 마을 앞마당에 들어가면 그 마을 요청과 맞는 물건을 모두 납품
  function deliver(S) {
    const d = G.dali; if (!d.bag.length) return;
    const v = G.world.villages.find(v => S.openVillages.has(v.id) && G.U.inRect(d.x, d.y, v.yard));
    if (!v) return;
    for (let i = 0; i < d.bag.length; i++) {
      const b = d.bag[i];
      const r = ofVillage(S, v.id).filter(q => q.item === b.item).sort((a, c) => a.left - c.left)[0];
      if (!r) continue;
      d.bag.splice(i--, 1);
      if (b.fake) { fraud(S, r, b); continue; }
      r.state = 'done';
      G.score.delivered(S, r, b);
    }
  }

  return { init, update, spawn, active, ofVillage, deliver };
})();
