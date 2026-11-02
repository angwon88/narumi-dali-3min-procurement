/* ===== 개발용: 시간 건너뛰기 (테스트 전용) =====
   - 제출용 빌드(tools/build.py)에는 자동으로 빠진다 (index.html의 data-dev 표시)
   - 완전히 없애려면: 이 파일 삭제 + index.html의 debug.js 줄 삭제
   조작: 플레이 중 [5] = 5초 건너뛰기, [0] = 10초 건너뛰기 (화면 오른쪽 위 버튼도 가능)
   건너뛰는 동안 게임을 1/60초 단위로 빠르게 진행 → 요청·가격·마을 개방이 실제와 똑같이 일어남. 달이는 그대로. */
'use strict';
G.debug = (() => {
  const C = G.C, W = C.VIEW.w;
  const BTN5 = { x: W - 150, y: 8, w: 48, h: 28 }, BTN10 = { x: W - 96, y: 8, w: 48, h: 28 };
  function skip(sec) {
    const S = G.S, n = Math.round(sec / C.DT);
    for (let i = 0; i < n && G.screen === 'play'; i++) G.screens.step(S, C.DT);
    G.fx.add(S, W / 2, 70, '⏩ +' + sec + '초 건너뜀', '#9fd3ff', 16);
  }
  // true를 돌려주면 이번 프레임은 건너뛰기만 하고 끝
  function update() {
    let sec = 0;
    if (G.input.hit('5') || G.ui.clicked(BTN5)) sec = 5;
    if (G.input.hit('0') || G.ui.clicked(BTN10)) sec = 10;
    if (!sec) return false;
    skip(sec); return true;
  }
  function draw(ctx) {
    G.ui.button(ctx, BTN5, '+5초', { size: 12, fill: '#9fd3ff', hot: '#c9e7ff' });
    G.ui.button(ctx, BTN10, '+10초', { size: 12, fill: '#9fd3ff', hot: '#c9e7ff' });
    const e = G.S.elapsed;
    const nx = (G.S.eventPlan || []).filter(p => p.at > e).map(p => ({ dust: '먼지', storm: '폭우', surge: '폭등' })[p.id] + ' ' + Math.floor(p.at / 60) + ':' + String(p.at % 60).padStart(2, '0')).join(' · ');
    if (nx) G.world.text(ctx, 'DEV 다음 사건: ' + nx, W - 12, 388, 12, '#9fd3ff', 'right');
    G.world.text(ctx, 'DEV 경과 ' + Math.floor(e / 60) + ':' + String(Math.floor(e % 60)).padStart(2, '0'), W - 12, 404, 12, '#9fd3ff', 'right');
  }
  return { skip, update, draw };
})();
