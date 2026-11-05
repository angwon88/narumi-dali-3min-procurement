/* 터치·클릭 조작 (개편 2026-11-02): 누른 곳으로 달이가 길을 찾아 이동.
   공방 → 문 앞으로 가서 구매 (새 공방이면 나르미가 자동으로 먼저 실사)
   마을·말풍선 → 앞마당으로 가서 납품 / 조달청 → 비축칸 / 브로커 → 나르미 출동 / 빈 곳 → 그 자리로
   길 찾기: 바로 갈 수 있으면 직선, 막히면 조달청 건물 네 모서리를 거쳐 가는 가장 짧은 길 */
'use strict';
G.nav = (() => {
  const C = G.C, U = G.U, W = G.world;
  const OB = W.office.body, M = 14;
  const CORNERS = [{ x: OB.x - M, y: OB.y - M }, { x: OB.x + OB.w + M, y: OB.y - M }, { x: OB.x - M, y: OB.y + OB.h + M + 6 }, { x: OB.x + OB.w + M, y: OB.y + OB.h + M + 6 }];
  const STOCK = { x: OB.x + 78, y: OB.y + OB.h + 17 };            // 비축칸 가운데 (events.js ZONE)

  const free = (x, y) => !W.blocked(G.dali.box(x, y));
  function clear(a, b) {                                            // 선분을 4px마다 검사
    const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 4));
    for (let i = 1; i <= n; i++) { const k = i / n; if (!free(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)) return false; }
    return true;
  }
  const len = pts => pts.reduce((s, p, i) => i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0, 0);
  function route(from, to) {
    if (clear(from, to)) return [to];
    let best = null;
    const tryPath = mids => { const pts = [from, ...mids, to]; for (let i = 1; i < pts.length; i++) if (!clear(pts[i - 1], pts[i])) return; if (!best || len(pts) < len([from, ...best])) best = [...mids, to]; };
    for (const c of CORNERS) tryPath([c]);
    for (const a of CORNERS) for (const b of CORNERS) if (a !== b) tryPath([a, b]);
    return best || [to];                                              // 길이 없으면 직선(벽을 따라 미끄러짐)
  }

  // 누른 곳 → 목적지
  function targetOf(S, p) {
    const sh = S.shops.find(s => U.inRect(p.x, p.y, s.w.slot));
    if (sh) return { kind: 'shop', sh, x: sh.w.door.x + sh.w.door.w / 2, y: sh.w.door.y + 14 };
    const v = W.villages.find(v => U.inRect(p.x, p.y, v.slot)) || (S.requests.find(r => r.state === 'open' && U.inRect(p.x, p.y, G.ui.bubbleRect(r))) || {}).vill;
    if (v) return { kind: 'village', v, x: v.yard.x + v.yard.w / 2, y: v.yard.y + 20 };
    if (U.inRect(p.x, p.y, { x: OB.x, y: OB.y, w: OB.w, h: OB.h + 34 })) return { kind: 'stock', ...STOCK };
    if (p.y < W.PLAY.y) return null;
    return { kind: 'point', x: U.clamp(p.x, 12, C.VIEW.w - 12), y: U.clamp(p.y, W.PLAY.y + 12, C.VIEW.h - 12) };
  }
  function go(S, t) {
    const d = G.dali;
    // 2026-11-03: 등록 심사 중(실사 전) 새 공방을 누르면 나르미만 실사하러 감. 실사를 통과하면 다시 눌러 계약 (검증 → 계약 순서)
    if (t.kind === 'shop' && t.sh.isNew && !t.sh.verified && !t.sh.innov && t.sh.status === 'open') {
      const why = G.shops.whyNot(S, t.sh);
      if (!why) G.shops.request(S, t.sh);
      else { S.wantInspect = t.sh; const b = t.sh.w.body; G.fx.add(S, b.x + b.w / 2, b.y + 110, '나르미가 바빠요 · 곧 실사할게요', '#ffd6a0'); }
      return;
    }
    d.path = route({ x: d.x, y: d.y }, { x: t.x, y: t.y }); d.goal = t; d.goalT = 0;
  }
  function handleTaps(S) {
    for (const p of G.input.taps) {
      if (p.y < C.HUD_H) continue;                                    // HUD(일시정지 버튼 등)는 따로 처리
      if (C.CONNECT && G.connect.tapReport(S, p)) return;             // 실사 보고서 버튼이 가장 먼저
      if (G.broker.hit(S, p)) { G.broker.request(S); return; }
      if (C.CONNECT && G.connect.tap(S, p)) return;                   // 계약 연결: 카드·공방·마을은 여기서, 빈 땅만 달이 이동
      const t = targetOf(S, p); if (t) { go(S, t); return; }
    }
    if (G.input.hit(' ')) {                                           // 키보드 Space = 브로커 추격 전용 (2026-11-03: 공방 실사는 직접 눌러서)
      if (S.bk && (S.bk.state === 'run' || S.bk.state === 'grab')) G.broker.request(S);
      else G.fx.add(S, G.dali.x, G.dali.y - 70, 'Space = 브로커 추격 · 공방 실사는 공방을 눌러요', '#cfd8e3');
    }
  }
  // 목적지 표시: 바닥에 퍼지는 고리
  function draw(ctx) {
    const d = G.dali; if (!d.goal || !d.path || !d.path.length) return;
    d.goalT = (d.goalT || 0) + 1 / 60;
    const k = (d.goalT * 1.5) % 1, g = d.goal;
    ctx.strokeStyle = 'rgba(255,216,74,' + (0.9 - k * 0.7).toFixed(2) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(g.x, g.y + 2, 6 + k * 10, 3 + k * 5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
  }
  // 달이를 그 자리로 걷게 함 (계약 연결: 새 공방 실사)
  function walkTo(x, y) { const d = G.dali; d.path = route({ x: d.x, y: d.y }, { x, y }); d.goal = { kind: 'point', x, y }; d.goalT = 0; }
  return { route, walkTo, handleTaps, draw, targetOf };
})();
