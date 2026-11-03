/* 입력: 키보드 · 마우스 · 터치(왼쪽 절반 가상 조이스틱) */
'use strict';
G.input = (() => {
  const keys = {}; let pressed = {};
  const taps = [];                        // 이번 프레임의 클릭/탭 (게임 좌표)
  const mouse = { x: -1, y: -1 };
  const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, R: 48 };
  const BLOCK = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];

  function toGame(e) {
    const r = G.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * G.C.VIEW.w / r.width, y: (e.clientY - r.top) * G.C.VIEW.h / r.height };
  }
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    if (BLOCK.includes(k)) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; joy.active = false; });

  function bind(cv) {
    // 개편(2026-11-02): 터치는 짧게 누르면 탭(누른 곳으로 이동), 14px 넘게 끌면 그때 조이스틱
    let pend = null;
    cv.addEventListener('pointerdown', e => {
      const p = toGame(e);
      // 2026-11-03 모바일: 달리는 브로커는 손을 뗄 때가 아니라 누른 순간에 판정(그새 도망가지 않게) + 넓은 판정
      if (e.pointerType !== 'mouse' && G.screen === 'play' && G.S && G.broker.hit(G.S, { ...p, touch: true })) { taps.push({ ...p, touch: true }); e.preventDefault(); return; }
      if (e.pointerType !== 'mouse' && G.screen === 'play' && p.y > G.C.HUD_H && !joy.active) {
        pend = { id: e.pointerId, x: p.x, y: p.y }; try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      } else taps.push(p);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      const p = toGame(e);
      if (e.pointerType === 'mouse') { mouse.x = p.x; mouse.y = p.y; }
      if (pend && e.pointerId === pend.id && Math.hypot(p.x - pend.x, p.y - pend.y) > 14) { Object.assign(joy, { active: true, id: pend.id, ox: pend.x, oy: pend.y, x: p.x, y: p.y }); pend = null; }
      if (joy.active && e.pointerId === joy.id) { joy.x = p.x; joy.y = p.y; }
    });
    const up = e => {
      if (pend && e.pointerId === pend.id) { if (e.type === 'pointerup') taps.push({ x: pend.x, y: pend.y, touch: true }); pend = null; }
      if (joy.active && e.pointerId === joy.id) { joy.active = false; joy.id = null; }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  }
  // 이동 벡터 (길이 0~1)
  function moveVec() {
    if (joy.active) {
      let dx = joy.x - joy.ox, dy = joy.y - joy.oy; const d = Math.hypot(dx, dy);
      if (d < 6) return { x: 0, y: 0 };
      const m = Math.min(1, d / joy.R); return { x: dx / d * m, y: dy / d * m };
    }
    let x = 0, y = 0;
    if (keys['arrowleft'] || keys['a']) x -= 1;
    if (keys['arrowright'] || keys['d']) x += 1;
    if (keys['arrowup'] || keys['w']) y -= 1;
    if (keys['arrowdown'] || keys['s']) y += 1;
    const d = Math.hypot(x, y); return d ? { x: x / d, y: y / d } : { x: 0, y: 0 };
  }
  return {
    bind, moveVec, joy, mouse, taps,
    down: k => !!keys[k], hit: k => !!pressed[k],
    anyKey: () => Object.keys(pressed).length > 0,
    endFrame() { pressed = {}; taps.length = 0; },
    reset() { for (const k in keys) keys[k] = false; joy.active = false; },
  };
})();
