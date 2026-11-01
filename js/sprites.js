/* 캐릭터 프레임 재생 (새로 작성). 8방향, 없는 방향은 좌우 반전으로 대체 */
'use strict';
G.spr = (() => {
  const DIR8 = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
  const MIR = { e: 'w', w: 'e', se: 'sw', sw: 'se', ne: 'nw', nw: 'ne', s: 's', n: 'n' };
  const dir8 = (dx, dy) => DIR8[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
  function pick(m, anim, face) {
    for (const a of [anim, 'rot']) {
      const A = m.anims[a]; if (!A) continue;
      if (A.dirs[face]) return { A, fr: A.dirs[face], flip: false };
      if (A.dirs[MIR[face]]) return { A, fr: A.dirs[MIR[face]], flip: true };
    }
    return null;
  }
  // (x, y) = 발 위치
  function drawChar(ctx, key, anim, face, t, x, y, scale) {
    const m = G.CHAR_META[key], im = G.img[key];
    if (!m || !im || !im.naturalWidth) return;
    const p = pick(m, anim, face); if (!p) return;
    const i = p.fr[Math.floor(t * p.A.fps) % p.fr.length], c = m.cell;
    const s = scale || G.C.CHAR_SCALE, w = c * s;
    ctx.save();
    ctx.imageSmoothingEnabled = !!m.smooth;
    ctx.translate(Math.round(x), Math.round(y));
    if (p.flip) ctx.scale(-1, 1);
    ctx.drawImage(im, (i % m.cols) * c, Math.floor(i / m.cols) * c, c, c, -m.foot[0] * s, -m.foot[1] * s, w, w);
    ctx.restore();
  }
  function shadow(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  return { dir8, drawChar, shadow };
})();
