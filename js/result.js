/* 결과 화면 (기획서 5.5): 등급 도장 + 점수 + 오늘의 칭호 → 기록 카드 5장 → "오늘 한 일, 실제로는?"(내 숫자 → 실제 제도, 판마다 다르게) → 고정 문구 + CI
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

  // "오늘 한 일, 실제로는?" (2026-11-03 개편): 이번 판에서 두드러진 주제 3개를 골라
  //   '오늘 나는 …'(내 숫자) → '실제로는 …'(주제마다 사실 2~4개를 돌아가며) 로 보여 준다.
  //   두드러짐 = weight(이번 판 수치), 약간의 무작위, 지난 판에 나온 주제는 조금 덜. 근거는 기획서 부록 B.
  const n = v => v || 0;
  const brokerAny = s => n(s.brokerWon) + n(s.brokerBlocked) + n(s.brokerCaught) > 0;
  const FACTS = [
    { key: 'broker', tag: '브로커 · 페이퍼컴퍼니', col: '#d9342b', when: (S, s) => brokerAny(s),
      weight: (S, s) => (n(s.brokerCaught) + n(s.brokerWon) * 1.5 + n(s.brokerBlocked)) / 4,
      me: (S, s) => s.brokerCaught ? '꼼수 브로커를 ' + s.brokerCaught + '번 적발했어요' + (s.brokerWon ? ' (뺏긴 계약 ' + s.brokerWon + '건)' : '') : s.brokerWon ? '꼼수에게 계약 ' + s.brokerWon + '건을 뺏겼어요' : '꼼수를 ' + n(s.brokerBlocked) + '번 막아 냈어요',
      facts: ['조달청은 데이터로 페이퍼컴퍼니 의심 업체를 골라 입찰보증금을 물려요. 낙찰만 노리는 입찰을 막기 위해서예요.',
              '직접 만든다고 해 놓고 몰래 맡겨 만든 물건을 납품한 업체는 계약 해지와 입찰참가자격 제한을 받아요.',
              '외국산을 국산으로 원산지를 속여 관공서에 납품한 업체도 적발돼 입찰참가자격 제한을 받았어요.'] },
    { key: 'caught', tag: '새 공방 실사', col: '#b0472b', when: (S, s) => n(s.caught) > 0,
      weight: (S, s) => n(s.caught) / 6 * (brokerAny(s) ? 0.6 : 1),
      me: (S, s) => '수상한 새 공방 ' + s.caught + '곳을 실사로 적발했어요',
      facts: ["너무 싸고 너무 좋은 공방의 실제 이름은 '페이퍼컴퍼니'. 만들 능력 없이 낙찰만 노리는 업체예요.",
              '조달청은 현장 조사와 데이터 분석으로 실제로 만들 능력이 있는 업체인지 확인해요.'] },
    { key: 'contract', tag: '계약 조건 · 검수', col: '#2f4f8a', when: (S, s) => n(s.passed) + n(s.qFail) > 0,
      weight: (S, s) => s.qFail ? 1.1 : n(s.passed) / 32,
      me: (S, s) => s.qFail ? '검수에서 ' + s.qFail + '번 불합격했어요' : n(s.passed) + '건 모두 검수 합격!',
      facts: ['공공기관은 품질·규격 같은 계약 조건을 정하고, 납품되면 조건대로 왔는지 검수해요. 못 미치면 받지 않아요.',
              '조달청 조달품질원은 납품검사를 하고, 공장이나 납품 장소에 직접 찾아가 품질점검도 해요.',
              '품질점검에서 부적합 판정을 받은 물품은 1년 동안 납품검사를 면제받지 못해요.'] },
    { key: 'value', tag: '가성비 따지기', col: '#2e9b3a', when: (S, s) => n(s.valueBest) + n(s.valueMiss) > 0,
      weight: (S, s) => n(s.valueBest) / 26 + n(s.valueMiss) * 0.12,
      me: (S, s) => '가성비 최고 선택 ' + n(s.valueBest) + '번' + (s.valueMiss ? ', 더 싼 곳을 ' + s.valueMiss + '번 놓쳤어요' : '!'),
      facts: ['무조건 가장 싼 곳이 아니라, 조건을 맞추는 업체 중에서 가격을 따져 골라요.',
              '조달청은 품질·성능이 비슷한 여러 업체와 미리 계약해 두고, 기관이 나라장터 쇼핑몰에서 골라 사게 해요(다수공급자계약).',
              "필요 이상으로 좋은 걸 비싸게 사는 것도 세금 낭비예요. '예정가격'이 기준이 돼요."] },
    { key: 'innov', tag: '혁신제품 · 새싹', col: '#e0a800', when: (S, s) => n(s.innov) + n(s.sproutBuy) > 0,
      weight: (S, s) => n(s.innov) * 0.8 + n(s.sproutBuy) * 0.12,
      me: (S, s) => s.innov ? '새싹 공방 ' + s.innov + '곳을 혁신제품으로 키웠어요' : '새싹 공방 실적 ' + n(s.sproutBuy) + '건을 쌓았어요',
      facts: ['조달청이 새 기술 제품의 첫 구매자가 되어, 공공기관이 써 보게 하고 기업의 성장을 도와요.',
              '혁신제품을 사다 문제가 생겨도 고의나 중대한 잘못이 없으면 담당자에게 책임을 묻지 않아요(구매면책).',
              '혁신제품으로 지정되면 공공기관이 경쟁 입찰 없이 수의계약으로 살 수 있어요.',
              '시범구매사업은 조달청 예산으로 혁신제품을 사서 공공기관이 직접 써 보게 해요.'] },
    { key: 'storm', tag: '재난 · 긴급 조달', col: '#2f6fb5', when: (S, s) => n(s.urgentMade) > 0,
      weight: (S, s) => 0.5 + n(s.urgentDone) * 0.15,
      me: (S, s) => '태풍 때 긴급 계약 ' + n(s.urgentDone) + '건을 해결했어요' + (n(s.urgentMade) > n(s.urgentDone) ? ' (' + s.urgentMade + '건 중)' : ''),
      facts: ['폭우·폭염·한파 같은 재난 때 필요한 긴급 물자는 절차를 줄여 더 빨리 살 수 있게 했어요(다수공급자계약 2단계 경쟁 예외).',
              '위기 때일수록 소방서·보건소 같은 곳에 필요한 물건이 제때 가야 해요. 미리 대비하면 더 빨리 보낼 수 있어요.'] },
    { key: 'stock', tag: '원자재 비축', col: '#2e9b3a', when: (S, s) => n(s.stocked) > 0,
      weight: (S, s) => n(s.stocked) * 0.45 + (n(s.released) ? 0.4 : 0),
      me: (S, s) => '원자재를 ' + s.stocked + '상자 비축했어요' + (s.released ? ' · 가격 폭등 때 풀었어요' : ''),
      facts: ['조달청은 알루미늄·구리 같은 원자재를 비축해 두었다가, 실제로 쓰는 제조업체와 중소기업에 팔아요.',
              '원자재 값이 크게 흔들릴 때도 기업들이 버틸 수 있도록, 나라가 미리 원자재를 사 둬요.'] },
    { key: 'compete', tag: '공정한 경쟁', col: '#7a5ab8', when: (S, s) => n(s.closedByStreak) > 0,
      weight: (S, s) => n(s.closedByStreak) * 0.6,
      me: (S, s) => '한 공방에만 몰아줘서 ' + s.closedByStreak + '곳이 문을 닫았어요',
      facts: ['한 업체에만 몰아주면 경쟁이 사라져 가격이 올라요. 공정한 경쟁이 좋은 물건을 싸게 만들어요.',
              '업체끼리 미리 짜고 값을 맞추는 입찰 담합은 적발되면 고발되고 부당이득을 돌려내야 해요.'] },
    { key: 'saved', tag: '아낀 세금', col: '#2e9b3a', when: S => S.saved > 0,
      weight: S => S.saved / 130,
      me: S => '국민 세금 ' + S.saved + '만원을 아꼈어요',
      facts: ["공공기관은 '예정가격'을 기준으로 여러 업체가 경쟁하게 해서 국민 세금을 아껴요."] },
    { key: 'ontime', tag: '나라장터', col: '#2f4f8a', when: () => true,
      weight: S => 0.25 + (S.stats.reqExpired ? 0 : 0.2),
      me: S => '계약 ' + S.delivered + '건을 제때 납품했어요',
      facts: ["마을 요청은 조달청의 전자조달 시스템 '나라장터'로 들어온 주문이에요.",
              '학교·소방서 같은 공공기관에 필요한 물건을 대신 구해 제때 보내는 일, 그게 조달청의 일이에요.'] },
  ];
  function pickFacts(S) {
    const s = S.stats || {}, last = G.store.get('factLast', []), vi = G.store.get('factVar', {});
    const scored = FACTS.filter(f => f.when(S, s)).map(f => ({ f, w: Math.min(1.3, f.weight(S, s)) * (0.75 + Math.random() * 0.5) * (last.includes(f.key) ? 0.7 : 1) }));   // 한 주제가 늘 1등 하지 않게 상한
    const top = scored.sort((a, b) => b.w - a.w).slice(0, 3).map(({ f }) => {
      const i = (vi[f.key] || 0) % f.facts.length; vi[f.key] = i + 1;            // 주제마다 사실을 돌아가며
      return { key: f.key, tag: f.tag, col: f.col, me: f.me(S, s), text: f.facts[i] };
    });
    G.store.set('factVar', vi); G.store.set('factLast', top.map(x => x.key));
    return top;
  }

  // 오늘의 칭호: 이번 판에서 가장 두드러진 플레이
  const n0 = v => v || 0;
  const TITLES = [
    { name: '꼼수 사냥꾼', sub: '브로커를 놓치지 않는 눈', score: (S, s) => n0(s.brokerCaught) >= 3 ? n0(s.brokerCaught) / 5 : 0 },
    { name: '철벽 수비대', sub: '계약을 하나도 안 뺏겼어요', score: (S, s) => brokerAny(s) && !s.brokerWon && n0(s.brokerCaught) + n0(s.brokerBlocked) >= 3 ? 0.95 : 0 },
    { name: '가성비 장인', sub: '조건 맞춘 곳 중 늘 가장 싸게', score: (S, s) => n0(s.valueBest) >= 12 && n0(s.valueMiss) <= 1 ? n0(s.valueBest) / 22 : 0 },
    { name: '새싹 키우미', sub: '스타트업을 혁신제품으로', score: (S, s) => n0(s.innov) ? 0.8 + n0(s.innov) * 0.3 : 0 },
    { name: '꼼꼼한 검수왕', sub: '검수 불합격 0건', score: (S, s) => !s.qFail && n0(s.passed) >= 15 ? n0(s.passed) / 28 : 0 },
    { name: '알뜰 살림꾼', sub: '국민 세금을 듬뿍 아꼈어요', score: S => S.saved >= 50 ? S.saved / 85 : 0 },
    { name: '번개 배달부', sub: '끊김 없는 연속 납품', score: S => n0(S.maxCombo) >= 12 ? S.maxCombo / 18 : 0 },
    { name: '페이퍼컴퍼니 탐정', sub: '수상한 새 공방을 척척', score: (S, s) => n0(s.caught) >= 4 ? n0(s.caught) / 6 : 0 },
    { name: '비축 전략가', sub: '가격 폭등에 미리 대비', score: (S, s) => n0(s.stocked) >= 2 ? 0.7 + n0(s.released) * 0.1 : 0 },
    { name: '위기 해결사', sub: '태풍 속 긴급 계약을 척척', score: (S, s) => n0(s.urgentDone) >= 3 ? n0(s.urgentDone) / 5 : 0 },
    { name: '마을 수호천사', sub: '마을 신뢰를 끝까지 지켰어요', score: (S, s) => S.trust >= 95 && n0(s.reqExpired) <= 1 ? 1.0 : 0 },
  ];
  function pickTitle(S) {
    const s = S.stats || {};
    const lastT = G.store.get('titleLast', '');
    const c = TITLES.map(x => ({ x, v: Math.min(1.3, x.score(S, s)) * (0.8 + Math.random() * 0.4) * (x.name === lastT ? 0.8 : 1) })).filter(o => o.v > 0).sort((a, b) => b.v - a.v)[0];   // 상한 + 지난 판 칭호는 조금 덜
    if (c) G.store.set('titleLast', c.x.name);
    return c ? c.x : { name: '새내기 조달관', sub: '다음 작전이 기대돼요' };
  }

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
    S.resFacts = pickFacts(S); S.resTitle = pickTitle(S);
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
    T(ctx, main, x + w / 2, y + 37, 20, mainCol);
    if (sub) T(ctx, sub, x + w / 2, y + 54, 12, '#6a5a3a');
  }

  function draw(ctx, S) {
    const s = S.stats || {};
    ctx.fillStyle = '#1e2a3a'; ctx.fillRect(0, 0, W, C.VIEW.h);
    ctx.fillStyle = '#25344a'; for (let x = 0; x < W; x += 32) ctx.fillRect(x, 0, 16, C.VIEW.h);   // 은은한 줄무늬

    // 1. 제목 + 점수 + 등급 도장(나르미가 찍음)
    T(ctx, '작전 종료!', W / 2 - 80 + 3, 40 + 3, 36, '#2f4f8a'); T(ctx, '작전 종료!', W / 2 - 80, 40, 36, '#ffd84a');
    T(ctx, '점수 ' + S.score.toLocaleString() + (S.newBest ? '  · 최고 기록!' : ''), W / 2 - 80, 82, 20, S.newBest ? '#ffe48a' : '#fff');
    if (S.resTitle && t >= 0.3) {                                    // 오늘의 칭호 리본
      const tl = S.resTitle, k = Math.min(1, (t - 0.3) / 0.25);
      ctx.save(); ctx.globalAlpha = k; ctx.font = '16px "Galmuri11 Bold", ' + G.FONT;
      const tw = ctx.measureText('오늘의 칭호  ' + tl.name).width + 28, rx = W / 2 - 80 - tw / 2, ry = 96;
      ctx.fillStyle = '#a8231b'; ctx.fillRect(rx - 8, ry + 4, 8, 16); ctx.fillRect(rx + tw, ry + 4, 8, 16);
      ctx.fillStyle = '#d9342b'; ctx.fillRect(rx, ry, tw, 22);
      ctx.fillStyle = '#ffd84a'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(tl.name, rx + 14 + ctx.measureText('오늘의 칭호  ').width, ry + 12);
      ctx.font = '12px ' + G.FONT; ctx.fillStyle = '#fff'; ctx.fillText('오늘의 칭호', rx + 14, ry + 12);
      ctx.restore();
      T(ctx, tl.sub + '  ·  마을 신뢰 ' + Math.round(S.trust), W / 2 - 80, 128, 12, '#cfe3f5');
    }
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
    const cw = 168, ch = 64, gap = 10, cx0 = (W - (cw * 5 + gap * 4)) / 2, cy = 144;
    const late = s.reqExpired || 0, cheat = (s.scammed || 0) + (s.stolen || 0), qf = s.qFail || 0;
    card(ctx, cx0, cy, cw, ch, '검수 합격 납품', S.delivered + '건', '#2a2416', qf || late ? '불합격 ' + qf + '건 · 늦음 ' + late + '건' : '불합격·늦음 없음!');
    card(ctx, cx0 + (cw + gap), cy, cw, ch, '아낀 국민 세금', '+' + S.saved + '만원', '#2e9b3a', S.wasted > 0 ? '낭비한 세금 ' + S.wasted + '만원' : '낭비 없음!');
    card(ctx, cx0 + (cw + gap) * 2, cy, cw, ch, '가성비 최고 선택', (s.valueBest || 0) + '번', '#2f6fb0', s.valueMiss ? '더 싼 적합 업체 놓침 ' + s.valueMiss + '번' : '늘 최고의 선택!');
    const stop = (s.brokerBlocked || 0) + (s.brokerCaught || 0);
    card(ctx, cx0 + (cw + gap) * 4, cy, cw, ch, '키운 새싹 공방', '혁신 ' + (s.innov || 0) + '곳', s.innov ? '#b08800' : '#9a9080', '새싹 실적 ' + (s.sproutBuy || 0) + '건');
    card(ctx, cx0 + (cw + gap) * 3, cy, cw, ch, '꼼수 브로커', '막음 ' + stop + '번', '#d9342b', s.brokerWon ? '뺏긴 계약 ' + s.brokerWon + '건' : cheat ? '속은 횟수 ' + cheat + '번' : '한 번도 안 뺏김!');

    // 3. 오늘 한 일, 실제로는?
    const bx = cx0, by = 228, bw = W - cx0 * 2, bh = 192;
    ctx.fillStyle = 'rgba(255,253,246,.96)'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2); ctx.lineWidth = 1;
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(bx, by - 12, 186, 24);
    T(ctx, '오늘 한 일, 실제로는?', bx + 93, by, 16, '#2a2416');
    let y = by + 24;
    (S.resFacts || []).forEach((f, i) => {
      if (t < 1.0 + i * 0.35) return;                                   // 한 줄씩 차례로 등장
      ctx.font = '12px ' + G.FONT;
      const lines = wrap(ctx, '→ 실제로는 ' + f.text, bw - 176);
      if (y + 16 + lines.length * 15 > by + bh) return;
      ctx.fillStyle = f.col; ctx.fillRect(bx + 14, y - 9, 132, 20);
      T(ctx, f.tag, bx + 80, y + 1, 12, '#fff');
      ctx.font = '16px "Galmuri11 Bold", ' + G.FONT; ctx.fillStyle = f.col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(f.me, bx + 158, y + 1);
      lines.forEach((ln, j) => T(ctx, ln, bx + 158, y + 20 + j * 15, 12, '#4a3f2a', 'left'));
      y += 20 + lines.length * 15 + 16;
    });

    // 4. 고정 문구 + 버튼 + CI
    T(ctx, '필요한 것을, 공정하게, 효율적으로, 필요한 곳에 제때 — 그게 조달입니다.', W / 2, 436, 16, '#fff');
  }
  return { start, update, draw, grade };
})();
