/* 조달관 5대 임무 (2026-11-03): 게임의 핵심 메시지 다섯 가지를 '임무'로 묶어 머리에 남게 한다.
   - 타이틀 배지 · 상황 소개 4번째 장면 · HUD 임무 칸 · 처음 달성할 때 도장 + "실제로도…" 배너 · 결과 화면 임무 카드
   - 색과 구호를 여기 한곳에서 정해 모든 화면이 같이 쓴다 (같은 행동 = 같은 말·색·소리)
   - 5개를 모두 해야 S등급 (result.js)
   실제 사실 문장의 근거는 기획서 부록 B·B-2. */
'use strict';
G.missions = (() => {
  const n = v => v || 0, T = (...a) => G.world.text(...a);
  const LIST = [
    { id: 'value', desc: '품질 조건(★)을 맞춘 공방 중 가장 싼 곳에서 사요', name: '조건 맞춰 가성비 납품', short: '가성비 최고!', col: '#2f6fb5', icon: 'desk',
      done: s => n(s.valueBest) > 0,
      real: '실제로도 공공기관은 품질 조건을 정하고, 조건을 맞춘 업체 중에서 가격을 따져 사요' },
    { id: 'paper', desc: '너무 싸고 좋은 새 공방은 나르미 실사로 걸러내요', name: '페이퍼컴퍼니 적발', short: '페이퍼컴퍼니 적발!', col: '#d9342b', icon: 'tablet',
      done: s => n(s.caught) > 0,
      real: '실제로도 조달청은 데이터로 페이퍼컴퍼니 의심 업체를 골라 걸러내요' },
    { id: 'broker', desc: '계약을 가로채려는 브로커를 눌러 나르미로 막아요', name: '브로커 차단', short: '브로커 차단!', col: '#7a3fb0', icon: 'ext',
      done: s => n(s.brokerCaught) + n(s.brokerBlocked) > 0,
      real: '실제로도 조달청은 브로커의 불공정 행위를 신고받고, 걸리면 입찰참가자격을 제한해요' },
    { id: 'sprout', desc: '새싹 공방을 사 줘서 실적 3건이면 혁신제품 지정!', name: '새싹을 혁신제품으로', short: '새싹 성장!', col: '#d39e00', icon: 'lamp',
      done: s => n(s.innov) > 0,
      real: '실제로도 조달청은 혁신제품의 첫 구매자가 되어 기술 기업의 성장을 도와요' },
    { id: 'prep', desc: '예보를 보고 미리 사 두고, 원자재를 비축해요', name: '위기 미리 대비', short: '미리 대비!', col: '#2f9bd0', icon: 'mask',
      done: s => n(s.prepared) > 0,
      real: '실제로도 조달청은 원자재를 비축하고, 재난 때는 긴급 물자를 더 빨리 살 수 있게 해요' },
  ];
  const BY = Object.fromEntries(LIST.map(m => [m.id, m]));
  function init(S) { S.missions = {}; S.mStamp = null; }
  const count = S => LIST.filter(m => S.missions && S.missions[m.id] != null).length;
  function update(S, dt) {
    for (const m of LIST) if (S.missions[m.id] == null && m.done(S.stats || {}, S)) { S.missions[m.id] = S.elapsed; achieve(S, m); }
    if (S.mStamp && (S.mStamp.t += dt) > 1.8) S.mStamp = null;
  }
  function achieve(S, m) {
    const k = count(S);
    S.mStamp = { m, t: 0, k };
    G.director.banner(S, '임무 ' + k + '/5 달성 · ' + m.name, m.real, { queue: true, dur: 3.4, col: m.col });
    G.audio.play('levelup');
  }
  // HUD: '임무' + 5칸 (달성하면 그 임무 색 + ✔)
  function drawHud(ctx, S, x) {
    const k = count(S);
    T(ctx, '임무 ' + k + '/5', x + 34, 12, 12, k === 5 ? '#ffd84a' : '#8fa3b8');
    LIST.forEach((m, i) => {
      const cx = x + 6 + i * 14, cy = 29, on = S.missions && S.missions[m.id] != null;
      ctx.fillStyle = '#0f1620'; ctx.fillRect(cx - 6, cy - 6, 12, 12);
      ctx.fillStyle = on ? m.col : '#2a3646'; ctx.fillRect(cx - 5, cy - 5, 10, 10);
      if (on) T(ctx, '✔', cx, cy + 1, 12, '#fff');
    });
  }
  // 처음 달성한 순간: 화면 가운데 큰 도장
  function drawStamp(ctx, S) {
    const st = S.mStamp; if (!st) return;
    const k = Math.min(1, st.t / 0.18), sc = 2.2 - 1.2 * k, a = st.t > 1.4 ? Math.max(0, (1.8 - st.t) / 0.4) : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(480, 300); ctx.rotate(-0.08); ctx.scale(sc, sc);
    ctx.font = '16px "Galmuri11 Bold", ' + G.FONT; const w = ctx.measureText('✔ ' + st.m.short).width + 40;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-w / 2 + 3, -22, w, 48);
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(-w / 2, -25, w, 48);
    ctx.strokeStyle = st.m.col; ctx.lineWidth = 4; ctx.strokeRect(-w / 2 + 2, -23, w - 4, 44); ctx.lineWidth = 1;
    T(ctx, '임무 ' + st.k + '/5', 0, -12, 12, st.m.col);
    ctx.font = '16px "Galmuri11 Bold", ' + G.FONT; ctx.fillStyle = st.m.col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✔ ' + st.m.short, 0, 7);
    ctx.restore();
  }
  return { LIST, BY, init, update, count, drawHud, drawStamp };
})();
