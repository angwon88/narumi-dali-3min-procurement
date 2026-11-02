/* 결과 화면 (기획서 5.5): 등급 도장 + 점수 → 기록 카드 4장 → "오늘 한 일, 실제로는?" → 고정 문구 + CI
   제도명은 여기서만 연결한다(기획서 원칙). 문구 근거는 기획서 부록 B. */
'use strict';
G.result = (() => {
  const C = G.C, W = C.VIEW.w, T = (...a) => G.world.text(...a);
  let t = 0, stamped = false;

  function grade(S) {
    for (const g of ['S', 'A', 'B']) { const [sc, tr] = C.GRADE[g]; if (S.score >= sc && S.trust >= tr) return g; }
    return 'C';
  }
  const GRADE_COL = { S: '#e0a800', A: '#2e9b3a', B: '#2f6fb0', C: '#8a7a6a' };
  const GRADE_MSG = { S: '최고의 조달 파트너!', A: '믿음직한 조달 작전!', B: '마을이 고마워해요', C: '다음엔 더 잘할 수 있어요' };

  // "오늘 한 일, 실제로는?" — 이번 판에서 실제로 일어난 일만, 우선순위 순서로 최대 3줄
  const FACTS = [
    { key: 'caught', tag: '페이퍼컴퍼니 적발', col: '#d9342b', when: (S, s) => s.caught > 0 && !((s.scammed || 0) + (s.stolen || 0)),   // 피해가 있었으면 그쪽 한 줄만
      text: "수상한 공방의 실제 이름은 '페이퍼컴퍼니'. 만들 능력 없이 낙찰만 노리는 업체예요. 조달청은 현장 조사와 데이터 분석으로 이런 업체를 걸러내요." },
    { key: 'scammed', tag: '페이퍼컴퍼니 피해', col: '#d9342b', when: (S, s) => (s.scammed || 0) + (s.stolen || 0) > 0,
      text: '표시와 다른 불량품은 검수에서 걸러도, 세금과 시간은 이미 쓴 뒤예요. 페이퍼컴퍼니 때문에 성실한 업체가 기회를 잃기도 해요. 그래서 계약 전 실사가 중요해요.' },
    { key: 'contract', tag: '계약 조건 · 검수', col: '#2f4f8a', when: (S, s) => (s.passed || 0) + (s.qFail || 0) > 0,
      text: '공공기관은 물건을 살 때 품질·규격 같은 계약 조건을 정하고, 납품되면 조건대로 왔는지 검수해요. 조건에 못 미치면 받지 않아요.' },
    { key: 'value', tag: '가성비 따지기', col: '#2e9b3a', when: (S, s) => (s.valueBest || 0) + (s.valueMiss || 0) > 0,
      text: '조달은 무조건 가장 싼 곳이 아니라, 조건을 맞추는 업체 중에서 가격을 따져 골라요. 필요 이상으로 좋은 걸 비싸게 사도 세금 낭비예요.' },
    { key: 'innov', tag: '혁신제품 시범구매', col: '#e0a800', when: (S, s) => s.innov > 0,
      text: '조달청이 새 기술 제품의 첫 구매자가 되어 공공기관이 써 보게 하고, 그 기업이 성장하도록 도와요. 시범 사용 중 문제는 구매면책으로 담당자가 책임지지 않아요.' },
    { key: 'stock', tag: '원자재 비축', col: '#2e9b3a', when: (S, s) => s.stocked > 0,
      text: '조달청은 알루미늄·구리 같은 원자재를 미리 사서 비축해 두었다가, 값이 크게 오르면 기업에 풀어 가격을 안정시켜요.' },
    { key: 'compete', tag: '공정한 경쟁', col: '#7a5ab8', when: (S, s) => s.closedByStreak > 0,
      text: '한 업체에만 몰아주면 경쟁이 사라져 가격이 올라요. 공정한 경쟁이 좋은 물건을 싸게 만들어요.' },
    { key: 'saved', tag: '예정가격과 경쟁', col: '#2e9b3a', when: S => S.saved > 0,
      text: "공공기관은 '예정가격'을 기준으로 여러 업체가 경쟁하게 해서 국민 세금을 아껴요." },
    { key: 'ontime', tag: '나라장터', col: '#2f4f8a', when: () => true,
      text: "마을 요청은 조달청의 전자조달 시스템 '나라장터'로 들어온 주문이에요. 학교·소방서 같은 공공기관에 필요한 물건을 제때 보내는 일, 그게 조달청의 일이에요." },
  ];
  const facts = S => FACTS.filter(f => f.when(S, S.stats || {})).slice(0, 3);

  function wrap(ctx, s, maxW) {
    const out = []; let line = '';
    for (const word of s.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; } else line = next;
    }
    if (line) out.push(line);
    return out;
  }

  function start(S) {
    t = 0; stamped = false;
    S.grade = grade(S);
    const order = 'CBAS', best = G.store.get('bestGrade', 'C');
    S.newBestGrade = order.indexOf(S.grade) > order.indexOf(best);
    if (S.newBestGrade) G.store.set('bestGrade', S.grade);
  }
  function update(dt) {
    t += dt;
    if (!stamped && t >= 0.7) { stamped = true; G.audio.play(G.S.grade === 'S' || G.S.grade === 'A' ? 'levelup' : 'ok'); }
  }

  function card(ctx, x, y, w, h, title, main, mainCol, sub) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 3, y + 4, w, h);
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#2f4f8a'; ctx.fillRect(x, y, w, 22);
    T(ctx, title, x + w / 2, y + 11, 12, '#fff');
    T(ctx, main, x + w / 2, y + 44, 20, mainCol);
    if (sub) T(ctx, sub, x + w / 2, y + 68, 12, '#6a5a3a');
  }

  function draw(ctx, S) {
    const s = S.stats || {};
    ctx.fillStyle = '#1e2a3a'; ctx.fillRect(0, 0, W, C.VIEW.h);
    ctx.fillStyle = '#25344a'; for (let x = 0; x < W; x += 32) ctx.fillRect(x, 0, 16, C.VIEW.h);   // 은은한 줄무늬

    // 1. 제목 + 점수 + 등급 도장(나르미가 찍음)
    T(ctx, '작전 종료!', W / 2 - 80 + 3, 40 + 3, 36, '#2f4f8a'); T(ctx, '작전 종료!', W / 2 - 80, 40, 36, '#ffd84a');
    T(ctx, '점수 ' + S.score.toLocaleString() + (S.newBest ? '  · 최고 기록!' : ''), W / 2 - 80, 82, 20, S.newBest ? '#ffe48a' : '#fff');
    T(ctx, '마을 신뢰 ' + Math.round(S.trust) + '  ·  최대 콤보 ' + (S.maxCombo || 0), W / 2 - 80, 106, 12, '#cfe3f5');
    const gx = W / 2 + 190, gy = 66, col = GRADE_COL[S.grade];
    G.spr.drawChar(ctx, 'narmi', t < 0.9 ? 'act' : 'rot', 'sw', t, gx + 92, gy + 38, 1.1);
    if (t >= 0.5) {
      const k = Math.min(1, (t - 0.5) / 0.2), sc = 2.4 - 1.4 * k;
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(-0.14); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
      ctx.font = '40px "Galmuri11 Bold", ' + G.FONT; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.grade, 0, 2);
      ctx.restore(); ctx.globalAlpha = 1;
      if (t >= 0.8) T(ctx, GRADE_MSG[S.grade] + (S.newBestGrade ? ' (최고 등급!)' : ''), gx, gy + 52, 12, '#ffe48a');
    }

    // 2. 기록 카드 4장
    const cw = 210, ch = 82, gap = 12, cx0 = (W - (cw * 4 + gap * 3)) / 2, cy = 134;
    const late = s.reqExpired || 0, cheat = (s.scammed || 0) + (s.stolen || 0), qf = s.qFail || 0;
    card(ctx, cx0, cy, cw, ch, '검수 합격 납품', S.delivered + '건', '#2a2416', qf || late ? '불합격 ' + qf + '건 · 늦음 ' + late + '건' : '불합격·늦음 없음!');
    card(ctx, cx0 + (cw + gap), cy, cw, ch, '아낀 국민 세금', '+' + S.saved + '만원', '#2e9b3a', S.wasted > 0 ? '낭비한 세금 ' + S.wasted + '만원' : '낭비 없음!');
    card(ctx, cx0 + (cw + gap) * 2, cy, cw, ch, '가성비 최고 선택', (s.valueBest || 0) + '번', '#2f6fb0', s.valueMiss ? '더 싼 적합 업체 놓침 ' + s.valueMiss + '번' : '늘 최고의 선택!');
    card(ctx, cx0 + (cw + gap) * 3, cy, cw, ch, '수상한 공방', '적발 ' + (s.caught || 0) + '곳', '#d9342b', cheat ? '속은 횟수 ' + cheat + '번' : '한 번도 안 속음!');

    // 3. 오늘 한 일, 실제로는?
    const bx = cx0, by = 234, bw = W - cx0 * 2, bh = 178;
    ctx.fillStyle = 'rgba(255,253,246,.96)'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2); ctx.lineWidth = 1;
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(bx, by - 12, 186, 24);
    T(ctx, '오늘 한 일, 실제로는?', bx + 93, by, 16, '#2a2416');
    let y = by + 30;
    ctx.font = '12px ' + G.FONT;
    facts(S).forEach(f => {
      ctx.fillStyle = f.col; ctx.fillRect(bx + 14, y - 10, 132, 20);
      T(ctx, f.tag, bx + 80, y + 1, 12, '#fff');
      ctx.font = '16px ' + G.FONT;
      const lines = wrap(ctx, f.text, bw - 180);
      lines.forEach((ln, i) => T(ctx, ln, bx + 160, y + 1 + i * 20, 16, '#2a2416', 'left'));
      y += Math.max(1, lines.length) * 20 + 12;
    });

    // 4. 고정 문구 + 버튼 + CI
    T(ctx, '필요한 것을, 공정하게, 효율적으로, 필요한 곳에 제때 — 그게 조달입니다.', W / 2, 436, 16, '#fff');
  }
  return { start, update, draw, grade };
})();
