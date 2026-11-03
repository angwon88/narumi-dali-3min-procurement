/* 마을의 감사 선물 (2026-11-04): 여러 판에 걸쳐 업적을 이루면 마을이 조달청 앞 광장에 감사 선물을 놓아 준다.
   - 화폐·상점 없음(아낀 세금으로 기관을 꾸미는 건 메시지가 어긋남) → "일을 잘하면 시민이 고마워해요"
   - 그림만 그리고 충돌 영역이 없음 → 달이·브로커 이동을 막지 않음. 말풍선·비축칸·시세판과 겹치지 않는 광장 빈자리에 놓음
   - 기록은 이 브라우저(localStorage)에만: 'thanks' = 받은 선물 id 목록, 'thanksCum' = 누적 기록 */
'use strict';
G.thanks = (() => {
  const C = G.C, n = v => v || 0;
  // at: 광장 위치(발밑 기준). 위쪽 공방 발판(~172)과 아래쪽 마을 말풍선(~328) 사이, 조달청·시세판을 피해서
  const LIST = [
    { id: 'pot',     name: '학교의 감사 화분',     how: '한 판에 납품 15건 이상',              at: [150, 222], ok: (S, s, c) => S.delivered >= 15 },
    { id: 'plaque',  name: '보건소의 감사패',      how: '검수 불합격 0건으로 A등급 이상',       at: [235, 262], ok: (S, s) => !s.qFail && 'AS'.includes(S.grade) },
    { id: 'flag',    name: '소방서의 감사 깃발',   how: '긴급 계약 누적 10건 해결',             at: [70, 268],  ok: (S, s, c) => c.urgent >= 10 },
    { id: 'books',   name: '도서관의 감사 책탑',   how: '페이퍼컴퍼니 누적 20곳 적발',          at: [318, 218], ok: (S, s, c) => c.caught >= 20 },
    { id: 'trophy',  name: '브로커 차단 트로피',   how: '브로커 누적 30명 적발',                at: [645, 218], ok: (S, s, c) => c.broker >= 30 },
    { id: 'tree',    name: '혁신 새싹 나무',       how: '한 판에 혁신 보상 4가지 모두',          at: [728, 262], ok: S => S.innovCats && S.innovCats.size >= 4 },
    { id: 'statue',  name: '황금 나르미 동상',     how: '처음으로 S등급',                       at: [812, 222], ok: S => S.grade === 'S' },
    { id: 'banner',  name: '명예 조달관 현판',     how: '하드 모드 A등급 이상',                 at: [892, 268], ok: S => S.hard && 'AS'.includes(S.grade) },
  ];
  const got = () => { try { return G.store.get('thanks', []) || []; } catch (e) { return []; } };
  const has = id => got().includes(id);
  // 결과가 나올 때 한 번: 누적 기록을 더하고 새로 받은 선물을 돌려줌
  function check(S) {
    const s = S.stats || {}, c = Object.assign({ urgent: 0, caught: 0, broker: 0, games: 0 }, G.store.get('thanksCum', {}));
    c.urgent += n(s.urgentDone); c.caught += n(s.caught); c.broker += n(s.brokerCaught); c.games++;
    G.store.set('thanksCum', c);
    const have = got(), fresh = LIST.filter(g => !have.includes(g.id) && g.ok(S, s, c));
    if (fresh.length) G.store.set('thanks', have.concat(fresh.map(g => g.id)));
    S.thanksNew = fresh; S.thanksCum = c;
    return fresh;
  }
  // 진행 상황 (타이틀 설명용): 누적 조건은 지금 몇인지
  function progress(g) {
    const c = G.store.get('thanksCum', {});
    if (g.id === 'flag') return ' (' + Math.min(10, n(c.urgent)) + '/10)';
    if (g.id === 'books') return ' (' + Math.min(20, n(c.caught)) + '/20)';
    if (g.id === 'trophy') return ' (' + Math.min(30, n(c.broker)) + '/30)';
    return '';
  }

  // ---------- 그림 (픽셀 톤, 발밑 (x, y) 기준) ----------
  const px = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const shadow = (ctx, x, y, w) => { ctx.fillStyle = 'rgba(40,30,15,.25)'; ctx.beginPath(); ctx.ellipse(x, y, w, 4, 0, 0, 7); ctx.fill(); };
  let goldBird = null;
  function goldNarmi() {                                                 // 나르미 그림을 금빛으로 물들여 한 번만 만들어 둠
    if (goldBird) return goldBird;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    try { G.spr.drawChar(g, 'narmi', 'rot', 's', 0, 32, 60, 0.9); } catch (e) { return null; }
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(0.5, '#ffc93a'); gr.addColorStop(1, '#b07800');
    g.globalAlpha = 0.85; g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (goldBird = c);
  }
  function drawOne(ctx, id, x, y, t) {
    if (id === 'pot') {
      shadow(ctx, x, y, 11); px(ctx, '#b0583a', x - 8, y - 12, 16, 12); px(ctx, '#c86a48', x - 9, y - 14, 18, 3);
      px(ctx, '#3f8a35', x - 1, y - 22, 2, 8); px(ctx, '#4cb04c', x - 7, y - 20, 6, 3); px(ctx, '#4cb04c', x + 1, y - 24, 6, 3);
      [['#ff7a9a', -6, -27], ['#ffd84a', 0, -30], ['#fff', 5, -26]].forEach(([c, dx, dy]) => { px(ctx, c, x + dx - 2, y + dy, 5, 5); px(ctx, '#e0a800', x + dx, y + dy + 2, 1, 1); });
    } else if (id === 'plaque') {
      shadow(ctx, x, y, 12); px(ctx, '#6b4423', x - 2, y - 10, 4, 10);
      px(ctx, '#7a4a22', x - 12, y - 30, 24, 20); px(ctx, '#e0b84a', x - 10, y - 28, 20, 16); px(ctx, '#fff3b0', x - 10, y - 28, 20, 2);
      px(ctx, '#7a5a00', x - 6, y - 23, 12, 1); px(ctx, '#7a5a00', x - 6, y - 19, 12, 1); px(ctx, '#e5533d', x - 2, y - 26, 4, 3);
    } else if (id === 'flag') {
      shadow(ctx, x, y, 8); px(ctx, '#8a8f99', x - 1, y - 40, 2, 40); px(ctx, '#ffd84a', x - 2, y - 42, 4, 3);
      const w = Math.sin(t * 5) * 1.5;
      ctx.fillStyle = '#d9342b'; ctx.beginPath(); ctx.moveTo(x + 1, y - 39); ctx.lineTo(x + 20, y - 36 + w); ctx.lineTo(x + 20, y - 25 + w); ctx.lineTo(x + 1, y - 27); ctx.fill();
      G.icons.stars(ctx, x + 7, y - 36 + w * 0.6, 1, 1, 1);
    } else if (id === 'books') {
      shadow(ctx, x, y, 12);
      [['#2f6fb5', -10, 20], ['#e5533d', -8, 17], ['#46b04a', -11, 21], ['#d39e00', -7, 15], ['#7a3fb0', -9, 18]].forEach(([c, dx, w], i) => { px(ctx, c, x + dx, y - 6 - i * 6, w, 6); px(ctx, '#fffbf0', x + dx + w - 3, y - 5 - i * 6, 2, 4); });
    } else if (id === 'trophy') {
      shadow(ctx, x, y, 11); px(ctx, '#5a3a22', x - 9, y - 6, 18, 6); px(ctx, '#7a5236', x - 7, y - 9, 14, 3);
      px(ctx, '#b08800', x - 2, y - 16, 4, 7); px(ctx, '#ffc93a', x - 9, y - 30, 18, 14); px(ctx, '#fff2a0', x - 7, y - 29, 3, 10);
      px(ctx, '#ffc93a', x - 13, y - 28, 4, 8); px(ctx, '#ffc93a', x + 9, y - 28, 4, 8); px(ctx, '#b08800', x - 9, y - 17, 18, 2);
      if (Math.floor(t * 2) % 3 === 0) px(ctx, '#fff', x + 4, y - 33, 2, 2);
    } else if (id === 'tree') {
      shadow(ctx, x, y, 12); px(ctx, '#6b4423', x - 2, y - 14, 4, 14);
      const blob = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); };
      blob(x, y - 24, 11, '#3f8f45'); blob(x - 6, y - 19, 7, '#3f8f45'); blob(x + 6, y - 19, 7, '#3f8f45'); blob(x - 2, y - 27, 6, '#5cc060');
      const p = 1 + Math.sin(t * 3) * 0.1; ctx.save(); ctx.translate(x, y - 38); ctx.scale(p, p); ctx.fillStyle = '#ffd84a'; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.5 : 6, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); ctx.restore();
    } else if (id === 'statue') {
      shadow(ctx, x, y, 14); px(ctx, '#9a9184', x - 12, y - 8, 24, 8); px(ctx, '#b5ad9f', x - 12, y - 8, 24, 2); px(ctx, '#857c70', x - 9, y - 12, 18, 4);
      const im = goldNarmi(); if (im) ctx.drawImage(im, x - 20, y - 50, 40, 40);
      if (Math.floor(t * 2) % 3 === 1) px(ctx, '#fff', x + 8, y - 44, 2, 2);
    } else if (id === 'banner') {
      shadow(ctx, x, y, 16); px(ctx, '#5a3a22', x - 15, y - 30, 3, 30); px(ctx, '#5a3a22', x + 12, y - 30, 3, 30);
      px(ctx, '#2f4f8a', x - 13, y - 30, 26, 18); px(ctx, '#ffd84a', x - 13, y - 30, 26, 2); px(ctx, '#ffd84a', x - 13, y - 14, 26, 2);
      ctx.font = '10px Galmuri9, ' + G.FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('명예', x, y - 21);
    }
  }
  // 게임 화면: 받은 선물을 광장에 (달이·브로커보다 먼저 그려서 캐릭터가 위로 지나감)
  function drawWorld(ctx, S) {
    const have = got(); if (!have.length) return;
    const t = (S && S.elapsed) || 0;
    for (const g of LIST) if (have.includes(g.id)) drawOne(ctx, g.id, g.at[0], g.at[1], t);
  }
  // 타이틀: 왼쪽 위 '감사 선물 n/8' 버튼 + 마우스 올리거나 누르면 목록
  const BTN = { x: 14, y: 14, w: 150, h: 30 };
  function tipLines() {
    const have = got();
    return ['마을의 감사 선물 ' + have.length + '/' + LIST.length + ' (조달청 앞 광장에 놓여요)'].concat(LIST.map(g => (have.includes(g.id) ? '✔ ' + g.name : '· ' + g.how + progress(g))));
  }
  return { LIST, check, has, got, drawWorld, drawOne, tipLines, BTN };
})();
