/* 3분 타임라인 (기획서 4.1). 경과 시간(초) 기준.
   구간: 요청 간격·제한 시간. 사건: 마을·공방 개방, 배너 등. 수치는 [초기값]. */
'use strict';
G.director = (() => {
  const C = G.C;
  // 2026-11-01 가로 배치로 이동 거리가 짧아져 전체적으로 빠르게 조정 [초기값]
  const SEGMENTS = [
    { from: 0,   name: '첫 주문',      interval: 5.0, limit: 24 },
    { from: 10,  name: '마을이 깨어남', interval: 4.6, limit: 22 },
    { from: 30,  name: '거리 완성',    interval: 4.3, limit: 21 },
    { from: 45,  name: '모두 영업',    interval: 4.0, limit: 20 },
    { from: 60,  name: '수상한 손님',  interval: 3.9, limit: 20 },
    { from: 90,  name: '폭우·태풍',    interval: 3.9, limit: 20 },   // 10번 작업에서 긴급 요청으로 바뀜
    { from: 110, name: '바쁜 장터',    interval: 3.6, limit: 18 },
    { from: 150, name: '연말 막바지',  interval: 3.2, limit: 16 },
  ];
  const EVENTS = [
    { at: 4, extra: { vid: 'school', item: 'chair' } },        // 시작하자마자 두 번째 요청
    { at: 10, open: { village: 'clinic', cat: 'health' }, banner: '보건소가 문을 열었어요!', sub: '보건 공방도 영업 시작' },
    { at: 30, open: { village: 'fire', cat: 'safety' }, banner: '소방서가 문을 열었어요!', sub: '안전 공방도 영업 시작' },
    { at: 45, open: { village: 'library' }, banner: '도서관이 문을 열었어요!', sub: '공방 거리가 바빠져요' },
    { at: 50, hook: 'firstFake' },                 // 첫 수상한 공방 확정 등장 (적발 기회를 늘리려고 1:00 → 0:50)
    { at: 65, hook: 'dustStart' },                 // 미세먼지 경보 1:05~1:20
    { at: 80, hook: 'dustEnd' },
    { at: 88, hook: 'stormWarn' },                 // 10번 작업: 태풍 경보
    { at: 117, hook: 'surgeWarn' },                // 원자재 가격 폭등 예고 → 2:05~2:25 폭등
    { at: 125, hook: 'surgeStart' },
    { at: 145, hook: 'surgeEnd' },
    { at: C.FINAL_RUSH_AT, rush: true, banner: '막바지! 점수 1.5배', sub: '조금만 더 힘내요' },
  ];
  const hooks = {};                                // 다른 작업이 등록: G.director.on('firstFake', fn)

  function init(S) {
    S.segIdx = -1; S.evIdx = 0; S.banner = null;
    apply(S);
  }
  function apply(S) {
    let i = 0; while (i + 1 < SEGMENTS.length && S.elapsed >= SEGMENTS[i + 1].from) i++;
    if (i !== S.segIdx) { S.segIdx = i; S.reqInterval = SEGMENTS[i].interval; S.reqLimit = SEGMENTS[i].limit; }
  }
  function banner(S, text, sub) { S.banner = { text, sub: sub || '', t: 0 }; }
  function fire(S, ev) {
    if (ev.open) {
      if (ev.open.village) S.openVillages.add(ev.open.village);
      if (ev.open.cat) { S.openCats.add(ev.open.cat); G.shops.opened(S, ev.open.cat); }
    }
    if (ev.extra) G.requests.spawn(S, ev.extra);
    if (ev.rush) S.scoreMult = C.FINAL_RUSH_MULT;
    if (ev.banner) { banner(S, ev.banner, ev.sub); G.audio.play('banner'); }
    if (ev.hook && hooks[ev.hook]) hooks[ev.hook](S);
  }
  function update(S, dt) {
    apply(S);
    while (S.evIdx < EVENTS.length && S.elapsed >= EVENTS[S.evIdx].at) fire(S, EVENTS[S.evIdx++]);
    if (S.banner && (S.banner.t += dt) > 2.2) S.banner = null;
  }
  // 화면 위 가운데 배너 (2초)
  function draw(ctx, S) {
    const b = S.banner; if (!b) return;
    const k = b.t < 0.2 ? b.t / 0.2 : b.t > 1.9 ? Math.max(0, (2.2 - b.t) / 0.3) : 1;
    ctx.font = '12px ' + G.FONT; const sw = ctx.measureText(b.sub || '').width; ctx.font = '16px ' + G.FONT;
    const W = C.VIEW.w, w = Math.max(308, ctx.measureText(b.text).width + 32, sw + 32), h = b.sub ? 50 : 36, x = (W - w) / 2, y = 184 - (1 - k) * 20;
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 3, y + 4, w, h);
    ctx.fillStyle = '#2f4f8a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(x, y, w, 3);
    G.world.text(ctx, b.text, W / 2, y + 17, 16, '#fff');
    if (b.sub) G.world.text(ctx, b.sub, W / 2, y + 37, 12, '#cfe3f5');
    ctx.globalAlpha = 1;
  }
  return { init, update, draw, banner, on: (name, fn) => { hooks[name] = fn; }, SEGMENTS, EVENTS };
})();
