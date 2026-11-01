'use strict';
G.U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  overlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
  inRect: (px, py, r) => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h,
  rand: (a, b) => a + Math.random() * (b - a),
  fmtTime: s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
};
// localStorage는 막혀 있어도 게임이 돌아가야 한다
G.store = {
  get(k, d) { try { const v = localStorage.getItem('sjcj.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sjcj.' + k, JSON.stringify(v)); } catch (e) { /* 무시 */ } },
};
