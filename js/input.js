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
    cv.addEventListener('pointerdown', e => {
      const p = toGame(e);
      const onShop = G.S && (G.world.shops.some(sh => G.U.inRect(p.x, p.y, sh.body)) || (G.broker && G.broker.hit(G.S, p)));   // 공방·꼼수 브로커를 누르면 나르미(탭)
      const useJoy = e.pointerType !== 'mouse' && G.screen === 'play' && p.y > G.C.HUD_H && !joy.active && !onShop;   // HUD·공방 말고는 어디서나 조이스틱
      if (useJoy) { Object.assign(joy, { active: true, id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y }); try { cv.setPointerCapture(e.pointerId); } catch (_) {} }
      else taps.push(p);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      const p = toGame(e);
      if (e.pointerType === 'mouse') { mouse.x = p.x; mouse.y = p.y; }
      if (joy.active && e.pointerId === joy.id) { joy.x = p.x; joy.y = p.y; }
    });
    const up = e => { if (joy.active && e.pointerId === joy.id) { joy.active = false; joy.id = null; } };
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
