/* 마을 상태: 요청 실패 시 8초 피해 연출, 납품 시 기쁨, 상태 얼굴 (기획서 3.5)
   그림은 임시 픽셀아트(코드로 그림). */
'use strict';
G.villages = (() => {
  const C = G.C, HURT = 8, HAPPY = 6;
  function init(S) {
    S.vstate = {};
    for (const v of G.world.villages) S.vstate[v.id] = { hurtT: 0, happyT: 0, t: 0, done: 0, tier: 0, upT: null };
  }
  function onFail(S, vid) { const s = S.vstate[vid]; s.hurtT = HURT; s.happyT = 0; S.stats.villageHurt = (S.stats.villageHurt || 0) + 1; }
  function onSuccess(S, vid) {
    const s = S.vstate[vid]; if (s.hurtT <= 0) s.happyT = HAPPY;
    s.done++; if (s.tier < C.VILLAGE_TIER.length && s.done >= C.VILLAGE_TIER[s.tier]) upgrade(S, vid);
  }
  // 마을 단장 (2026-11-03): 검수 합격 납품이 쌓이면 1·2단계. 1단계 새 계약 시간 +15%, 2단계 납품 점수 ×1.2·신뢰 +1
  const UP = { school: ['국기 게양대', '시계탑 증축'], clinic: ['구급차 배치', '2층 병원 증축'], fire: ['소방차 배치', '망루 증축'], library: ['꽃 정원', '돔 열람실 증축'] };
  function upgrade(S, vid) {
    const s = S.vstate[vid], v = G.world.villages.find(x => x.id === vid);
    s.tier++; s.upT = 0;
    S.score += C.TIER_SCORE; G.score.trust(S, C.TIER_TRUST);
    S.stats.villageUp = (S.stats.villageUp || 0) + 1;
    const what = UP[vid][s.tier - 1], b = v.body;
    if (s.tier >= 2) { G.director.banner(S, v.name + G.U.josa(v.name, '이', '가') + ' 새로 단장했어요! (' + what + ')', '납품 점수 ×' + C.VILLAGE_T2_SCORE + ' · 마을 신뢰 +' + C.VILLAGE_T2_TRUST + ' 추가'); G.audio.play('gift'); }
    else { G.fx.add(S, b.x + b.w / 2, b.y - 50, v.name + ' 단장! ' + what + ' · 계약 시간 +15%', '#ffe48a', 16); G.audio.play('ok'); }
    G.fx.burst(S, b.x + b.w / 2, b.y + 20, true, 30);
  }
  const limitMult = (S, vid) => S.vstate && S.vstate[vid] && S.vstate[vid].tier >= 1 ? C.VILLAGE_LIMIT_MULT : 1;
  function update(S, dt) {
    for (const s of Object.values(S.vstate)) { s.t += dt; s.hurtT = Math.max(0, s.hurtT - dt); s.happyT = Math.max(0, s.happyT - dt); }
  }

  // ---------- 작은 그림들 ----------
  function person(ctx, x, y, body, sit) {             // (x, y) = 발. 8×14 주민
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x - 4, y - 1, 9, 2);
    if (sit) {
      ctx.fillStyle = body; ctx.fillRect(x - 4, y - 7, 8, 6); ctx.fillRect(x - 4, y - 3, 10, 3);
      ctx.fillStyle = '#f2c79b'; ctx.fillRect(x - 3, y - 12, 6, 5);
      ctx.fillStyle = '#4a3020'; ctx.fillRect(x - 3, y - 13, 6, 2);
      return;
    }
    ctx.fillStyle = '#3b3b48'; ctx.fillRect(x - 3, y - 5, 2, 5); ctx.fillRect(x + 1, y - 5, 2, 5);
    ctx.fillStyle = body; ctx.fillRect(x - 4, y - 11, 8, 7);
    ctx.fillStyle = '#f2c79b'; ctx.fillRect(x - 3, y - 16, 6, 5);
    ctx.fillStyle = '#4a3020'; ctx.fillRect(x - 3, y - 17, 6, 2);
  }
  function face(ctx, x, y, mood) {                     // 지름 16 얼굴 배지: 1 웃음 · 0 보통 · -1 울상
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mood > 0 ? '#ffd84a' : mood < 0 ? '#9fb3c8' : '#f3e4b0';
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 4, y - 3, 2, 2); ctx.fillRect(x + 2, y - 3, 2, 2);
    if (mood > 0) { ctx.fillRect(x - 4, y + 2, 2, 1); ctx.fillRect(x - 2, y + 3, 4, 1); ctx.fillRect(x + 2, y + 2, 2, 1); }
    else if (mood < 0) { ctx.fillRect(x - 4, y + 4, 2, 1); ctx.fillRect(x - 2, y + 3, 4, 1); ctx.fillRect(x + 2, y + 4, 2, 1); ctx.fillStyle = '#5ec8f2'; ctx.fillRect(x + 5, y - 1, 2, 3); }
    else ctx.fillRect(x - 3, y + 3, 6, 1);
  }
  // 단장 모습: 1단계 소품(국기·구급차·소방차·꽃), 2단계 증축(시계탑·십자 간판·망루·돔) + 지붕 별
  function upLook(ctx, v, s) {
    if (!s.tier) return;
    const b = v.body, t = s.t, g = s.upT == null ? 1 : Math.min(1, s.upT / 0.6);
    if (s.upT != null) { s.upT += 1 / 60; if (s.upT > 1.2) s.upT = null; }
    const px = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    if (s.tier >= 2) {                                      // 증축 (위로 솟는 구조물)
      const rise = Math.round(16 * g), cx = b.x + b.w / 2 + 52;           // 마을 이름(가운데) 오른쪽에
      if (v.id === 'school') { px('#c9a94a', cx - 11, b.y - rise, 22, rise + 2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, b.y - rise + 8, 6, 0, 7); ctx.fill(); px('#3a3a3a', cx - 1, b.y - rise + 4, 2, 5); px('#3a3a3a', cx, b.y - rise + 8, 4, 1); }
      if (v.id === 'clinic') { px('#fff', cx - 12, b.y - rise, 24, rise + 2); px('#e5533d', cx - 2, b.y - rise + 2, 4, 12); px('#e5533d', cx - 6, b.y - rise + 6, 12, 4); }
      if (v.id === 'fire') { const x = b.x + 40; px('#8a2a22', x, b.y - rise - 4, 16, rise + 6); px('#fff6b0', x + 4, b.y - rise, 8, 6); px(Math.floor(t * 4) % 2 ? '#ff3b30' : '#5ec8f2', x + 5, b.y - rise - 8, 6, 4); }
      if (v.id === 'library') { ctx.fillStyle = '#8b7ab8'; ctx.beginPath(); ctx.arc(cx, b.y + 2, 18 * g, Math.PI, 0); ctx.fill(); px('#ffe48a', cx - 1, b.y - 18 * g - 4, 2, 5); px('#fff6b0', cx - 6, b.y - 8, 4, 6); px('#fff6b0', cx + 2, b.y - 8, 4, 6); }
    }
    // 1단계 소품
    if (v.id === 'school') { const x = b.x + 34, w = Math.sin(t * 5) * 1.5; px('#6a6a6a', x, b.y - 20, 2, 46); px('#2f6fb5', x + 2, b.y - 20 + w, 15, 10); G.icons.stars(ctx, x + 6, b.y - 18 + w, 1, 1, 1); }   // 교기(파란 바탕 노란 별)
    if (v.id === 'clinic' || v.id === 'fire') {
      const x = b.x + b.w - 64, y = b.y + 50, red = v.id === 'fire';
      px(red ? '#d9342b' : '#f4f6f8', x, y, 34, 14); px(red ? '#a8231b' : '#c9d6e0', x + 22, y - 5, 12, 6);
      px('#2a2a2a', x + 5, y + 13, 7, 5); px('#2a2a2a', x + 23, y + 13, 7, 5);
      if (red) { px('#c0c6cc', x + 2, y - 3, 18, 2); px('#c0c6cc', x + 4, y - 6, 2, 4); px('#c0c6cc', x + 14, y - 6, 2, 4); }
      else { px('#e5533d', x + 8, y + 3, 6, 2); px('#e5533d', x + 10, y + 1, 2, 6); }
      px(Math.floor(t * 4) % 2 ? '#5ec8f2' : '#e5533d', x + 26, y - 7, 4, 2);
    }
    if (v.id === 'library') for (let i = 0; i < 4; i++) { const x = b.x + 40 + i * 44; px('#6b4423', x, b.y + 47, 24, 4); ['#e86a5c', '#ffd84a', '#d18ad9'].forEach((c, k) => px(c, x + 3 + k * 8, b.y + 43, 4, 4)); }
    // 지붕 별 (단장 단계)
    for (let i = 0; i < s.tier; i++) G.icons.stars(ctx, b.x + b.w - 44 - i * 9, b.y + 7, 1, 1, 1);
    if (s.upT != null) for (let i = 0; i < 6; i++) {        // 공사 먼지
      const k = s.upT / 1.2; ctx.globalAlpha = 0.6 * (1 - k); ctx.fillStyle = '#e8dcc0';
      ctx.beginPath(); ctx.arc(b.x + 20 + i * 36, b.y + b.h - 8 - k * 20, 6 + k * 10, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  function darkWindows(ctx, b) { ctx.fillStyle = '#3b4250'; for (let i = 0; i < 4; i++) ctx.fillRect(b.x + 40 + i * 44, b.y + 30, 24, 16); }

  function draw(ctx, S) {
    for (const v of G.world.villages) {
      const s = S.vstate[v.id], b = v.body, y = v.yard, hurt = s.hurtT > 0;
      if (!S.openVillages.has(v.id)) {               // 아직 안 열린 마을: 어둡게 + 팻말
        ctx.fillStyle = 'rgba(30,36,46,.55)'; ctx.fillRect(b.x - 3, b.y, b.w + 6, b.h); ctx.fillRect(y.x, y.y, y.w, y.h);
        ctx.fillStyle = '#fffdf6'; ctx.fillRect(b.x + b.w / 2 - 40, b.y + 30, 80, 22);
        G.world.text(ctx, '곧 열려요', b.x + b.w / 2, b.y + 41, 12, '#4a3f2a');
        continue;
      }
      upLook(ctx, v, s);
      const blink = Math.floor(s.t * 3) % 2 === 0;
      if (v.id === 'fire') {                         // 경광등: 평소 빨강 깜빡, 피해 시 회색
        ctx.fillStyle = hurt ? '#7d7d7d' : blink ? '#ff3b30' : '#a8231b';
        ctx.fillRect(b.x + b.w - 30, b.y - 6, 10, 7);
      }
      if (hurt) {
        const fade = Math.min(1, s.hurtT / 0.5);      // 마지막 0.5초 서서히 회복
        ctx.globalAlpha = fade;
        if (v.id === 'school') {
          darkWindows(ctx, b);
          person(ctx, y.x + 150, y.y + 34, '#e86a5c', true); person(ctx, y.x + 170, y.y + 36, '#5b8fb9', true);
          G.world.text(ctx, '…', y.x + 160, y.y + 14, 12, '#fff');
        } else if (v.id === 'clinic') {
          [0, 1, 2].forEach(i => person(ctx, y.x + 22 + i * 15, y.y + 36, ['#7aa36b', '#c98a5a', '#8b7ab8'][i]));
          ctx.fillStyle = '#5ec8f2'; if (blink) ctx.fillRect(y.x + 56, y.y + 16, 2, 3);
          G.world.text(ctx, '대기 중', y.x + 100, y.y + 22, 12, '#fff');
        } else if (v.id === 'fire') {
          ctx.fillStyle = '#7d8590'; ctx.fillRect(b.x + 2, b.y + 26, 30, 44);
          ctx.fillStyle = '#6a7179'; for (let k = 0; k < 6; k++) ctx.fillRect(b.x + 2, b.y + 30 + k * 7, 30, 2);
          darkWindows(ctx, b);
        } else if (v.id === 'library') {
          darkWindows(ctx, b);
          ctx.fillStyle = '#fffdf6'; ctx.fillRect(b.x + 1, b.y + 44, 32, 16);
          ctx.fillStyle = '#3a3a3a'; ctx.fillRect(b.x + 16, b.y + 38, 2, 6);
          G.world.text(ctx, '휴관', b.x + 17, b.y + 53, 12, '#d9342b');
        }
        ctx.globalAlpha = 1;
      }
      face(ctx, b.x + b.w - 12, b.y + 11, hurt ? -1 : s.happyT > 0 ? 1 : 0);
    }
  }

  // 신뢰도 위기: 화면 가장자리가 붉게 맥박친다
  function dangerEdge(ctx, S) {
    if (S.trust > C.TRUST_DANGER) return;
    const W = C.VIEW.w, H = C.VIEW.h, top = C.HUD_H, k = 0.25 + 0.2 * Math.sin(S.elapsed * 6), D = 46;
    const edge = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(229,60,45,' + k + ')'); g.addColorStop(1, 'rgba(229,60,45,0)');
      ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh);
    };
    edge(0, top, 0, top + D, 0, top, W, D);
    edge(0, H, 0, H - D, 0, H - D, W, D);
    edge(0, 0, D, 0, 0, top, D, H - top);
    edge(W, 0, W - D, 0, W - D, top, D, H - top);
  }
  return { init, update, onFail, onSuccess, draw, dangerEdge, limitMult };
})();
