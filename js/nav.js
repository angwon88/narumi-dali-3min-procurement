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
    d.path = route({ x: d.x, y: d.y }, { x: t.x, y: t.y }); d.goal = t; d.goalT = 0;
    // 새 공방이면 나르미가 먼저 실사 (계약 전 실사)
    if (t.kind === 'shop' && t.sh.isNew && !t.sh.verified && !t.sh.innov && t.sh.status === 'open') S.wantInspect = t.sh;
  }
  function handleTaps(S) {
    for (const p of G.input.taps) {
      if (p.y < C.HUD_H) continue;                                    // HUD(일시정지 버튼 등)는 따로 처리
      if (G.broker.hit(S, p)) { G.broker.request(S); return; }
      const t = targetOf(S, p); if (t) { go(S, t); return; }
    }
    if (G.input.hit(' ')) {                                           // 키보드: 브로커가 달리면 나르미 출동, 아니면 가장 가까운 새 공방 실사
      if (S.bk && (S.bk.state === 'run' || S.bk.state === 'grab')) { G.broker.request(S); return; }
      const d = G.dali; let best = null, bd = 1e9;
      for (const sh of S.shops) {
        if (G.shops.whyNot(S, sh)) continue;
        const c = sh.w.door, dist = Math.hypot(c.x + c.w / 2 - d.x, c.y + c.h / 2 - d.y);
        if (dist < bd) { bd = dist; best = sh; }
      }
      if (best) G.shops.request(S, best);
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
  return { route, handleTaps, draw, targetOf };
})();
