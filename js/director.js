/* 3분 타임라인 (기획서 4.1). 경과 시간(초) 기준.
   구간: 요청 간격·제한 시간. 사건: 마을·공방 개방, 배너 등. 수치는 [초기값]. */
'use strict';
G.director = (() => {
  const C = G.C;
  // 2026-11-01 가로 배치로 이동 거리가 짧아져 전체적으로 빠르게 조정 [초기값]
  const SEGMENTS = [   // 2026-11-03 2분으로 압축 (3분 때 0·10·30·45·60·90·110·150초)
    { from: 0,   name: '첫 주문',      interval: 5.0, limit: 24 },
    { from: 6,   name: '마을이 깨어남', interval: 4.6, limit: 22 },
    { from: 16,  name: '거리 완성',    interval: 4.3, limit: 21 },
    { from: 24,  name: '모두 영업',    interval: 4.0, limit: 20 },
    { from: 36,  name: '수상한 손님',  interval: 3.9, limit: 20 },
    { from: 58,  name: '사건 많은 장터', interval: 3.9, limit: 20 },
    { from: 75,  name: '바쁜 장터',    interval: 3.6, limit: 18 },
    { from: 100, name: '막바지',      interval: 3.2, limit: 16 },
  ];

  const EVENTS = [
    { at: 4, extra: { vid: 'school', item: 'chair' } },        // 시작하자마자 두 번째 요청
    { at: 6, open: { village: 'clinic', cat: 'health' }, banner: '보건소가 문을 열었어요!', sub: '보건 공방도 영업 시작' },
    { at: 15, open: { village: 'fire', cat: 'safety' }, banner: '소방서가 문을 열었어요!', sub: '안전 공방도 영업 시작' },
    { at: 24, open: { village: 'library' }, banner: '도서관이 문을 열었어요!', sub: '공방 거리가 바빠져요' },
    { at: 8, hook: 'tipReg' },
    { at: 14, hook: 'tipStock' },                                  // 원자재 비축 안내                                     // 등록 업체 안내
    { at: 26, hook: 'firstFake', flag: 'fake' },   // 2분 기준 첫 수상한 공방
    ...C.SPROUT_AT.map(at => ({ at, hook: 'sprout' })),          // 개편: 새싹 공방(스타트업) 개업                 // 첫 수상한 공방 확정 등장 (적발 기회를 늘리려고 1:00 → 0:50)
    { at: C.FINAL_RUSH_AT, rush: true, banner: '막바지 20초! 점수 1.5배', sub: '조금만 더 힘내요' },
  ];
  const hooks = {};                                // 다른 작업이 등록: G.director.on('firstFake', fn)

  // 판마다 사건 일정 만들기: 켜진 사건(미세먼지·폭우·폭등)을 자리에 섞어 배치 → 예보·시작·끝 일정
  function schedule() {
    const ids = ['dust', 'storm', 'surge'].filter(id => C.EVENTS[id] !== false);
    let plan = [];
    if (C.EVENT_FIXED) plan = ids.map(id => ({ id, at: C.EVENT_FIXED_AT[id] }));
    else {
      // 자리와 사건을 무작위로 짝짓되, EVENT_NOT_FIRST 사건(폭등)은 첫 자리(0번)에 못 감
      for (let tryN = 0; tryN < 50; tryN++) {
        const slots = C.EVENT_SLOTS.map((r, i) => i).sort(() => Math.random() - 0.5).slice(0, ids.length);
        const order = ids.slice().sort(() => Math.random() - 0.5);
        if (order.every((id, k) => !(C.EVENT_NOT_FIRST.includes(id) && slots[k] === 0))) { plan = order.map((id, k) => ({ id, slot: slots[k] })); break; }
      }
      plan = plan.map(p => { const [a, b] = C.EVENT_SLOTS[p.slot]; return { id: p.id, at: Math.round(a + Math.random() * (b - a)) }; });
    }
    const list = EVENTS.slice();
    for (const p of plan) {
      list.push({ at: Math.max(1, p.at - C.FORECAST_SEC), hook: 'forecast', arg: p });
      list.push({ at: p.at, hook: p.id + 'Start', arg: p });
      list.push({ at: p.at + C.EVENT_DUR[p.id], hook: p.id + 'End', arg: p });
    }
    return { list: list.sort((a, b) => a.at - b.at), plan };
  }
  function init(S) {
    S.segIdx = -1; S.evIdx = 0; S.banner = null;
    const sc = schedule(); S.evList = sc.list; S.eventPlan = sc.plan;
    apply(S);
  }
  function apply(S) {
    let i = 0; while (i + 1 < SEGMENTS.length && S.elapsed >= SEGMENTS[i + 1].from) i++;
    if (i !== S.segIdx) { S.segIdx = i; S.reqInterval = SEGMENTS[i].interval * C.REQ_INTERVAL_MULT; S.reqLimit = Math.round(SEGMENTS[i].limit * C.REQ_LIMIT_MULT); }
  }
  // opt.queue: 다른 배너가 떠 있으면 끝난 뒤에 (임무 배너가 사건 배너를 덮지 않게), opt.dur: 보여 줄 시간, opt.col: 띠 색
  function banner(S, text, sub, opt = {}) {
    const b = { text, sub: sub || '', t: 0, dur: opt.dur || 2.2, col: opt.col };
    if (opt.queue && S.banner && S.banner.t < S.banner.dur - 0.3) { (S.bannerQ = S.bannerQ || []).push(b); return; }
    S.banner = b;
  }
  function fire(S, ev) {
    if (ev.flag && C.EVENTS[ev.flag] === false) return;            // 꺼진 사건은 건너뜀
    if (ev.open) {
      if (ev.open.village) S.openVillages.add(ev.open.village);
      if (ev.open.cat) { S.openCats.add(ev.open.cat); G.shops.opened(S, ev.open.cat); }
    }
    if (ev.extra) G.requests.spawn(S, ev.extra);
    if (ev.rush) S.scoreMult = C.FINAL_RUSH_MULT;
    if (ev.banner) { banner(S, ev.banner, ev.sub); G.audio.play('banner'); }
    if (ev.hook && hooks[ev.hook]) hooks[ev.hook](S, ev.arg);
  }
  function update(S, dt) {
    apply(S);
    while (S.evIdx < S.evList.length && S.elapsed >= S.evList[S.evIdx].at) fire(S, S.evList[S.evIdx++]);
    if (S.banner && (S.banner.t += dt) > S.banner.dur) S.banner = null;
    if (!S.banner && S.bannerQ && S.bannerQ.length) S.banner = S.bannerQ.shift();
  }
  // 화면 위 가운데 배너 (2초)
  function draw(ctx, S) {
    const b = S.banner; if (!b) return;
    const k = b.t < 0.2 ? b.t / 0.2 : b.t > b.dur - 0.3 ? Math.max(0, (b.dur - b.t) / 0.3) : 1;
    ctx.font = '12px ' + G.FONT; const sw = ctx.measureText(b.sub || '').width; ctx.font = '16px ' + G.FONT;
    const W = C.VIEW.w, w = Math.max(308, ctx.measureText(b.text).width + 32, sw + 32), h = b.sub ? 50 : 36, x = (W - w) / 2, y = 184 - (1 - k) * 20;
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 3, y + 4, w, h);
    ctx.fillStyle = '#2f4f8a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = b.col || '#ffd84a'; ctx.fillRect(x, y, w, b.col ? 6 : 3);
    G.world.text(ctx, b.text, W / 2, y + 17, 16, '#fff');
    if (b.sub) G.world.text(ctx, b.sub, W / 2, y + 37, 12, '#cfe3f5');
    ctx.globalAlpha = 1;
  }
  return { init, update, draw, banner, on: (name, fn) => { hooks[name] = fn; }, SEGMENTS, EVENTS };
})();
