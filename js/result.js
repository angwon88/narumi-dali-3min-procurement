/* 결과 화면 (기획서 5.5): 등급 도장 + 점수 + 오늘의 칭호 → 기록 카드 5장 → "오늘 한 일, 실제로는?"(내 숫자 → 실제 제도, 판마다 다르게) → 고정 문구 + CI
   제도명은 여기서만 연결한다(기획서 원칙). 문구 근거는 기획서 부록 B. */
'use strict';
G.result = (() => {
  const C = G.C, W = C.VIEW.w;
  let t = 0, stamped = false;

  // S등급은 점수·신뢰 + 조달관 5대 임무를 모두 해야 (2026-11-03). 점수는 S인데 임무가 모자라면 A + 안내
  function grade(S) {
    S.gradeNote = '';
    let g0 = 'C';
    for (const g of ['S', 'A', 'B']) {
      const [sc, tr] = C.GRADE[g];
      if (S.score >= sc && S.trust >= tr && (g !== 'S' || G.missions.count(S) >= 5)) { g0 = g; break; }
    }
    // 2026-11-03 S가 아니면 S까지 무엇이 모자란지 정확히 (점수 · 마을 신뢰 · 남은 임무 이름)
    if (g0 !== 'S') {
      const [sc, tr] = C.GRADE.S, need = [];
      if (S.score < sc) need.push('점수 +' + (sc - S.score).toLocaleString());
      if (S.trust < tr) need.push('신뢰 +' + Math.ceil(tr - S.trust));
      const left = G.missions.LIST.filter(m => !S.missions || S.missions[m.id] == null);
      if (left.length === 1) need.push("임무 '" + left[0].name + "'");
      else if (left.length) need.push('임무 ' + left.length + '개');
      S.gradeNote = 'S까지: ' + need.join(' · ');
      S.gradeLeft = left.map(m => m.name);
    }
    return g0;
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
      me: (S, s) => s.brokerCaught ? '브로커를 ' + s.brokerCaught + '번 차단했어요' + (s.brokerWon ? ' (뺏긴 계약 ' + s.brokerWon + '건)' : '') : s.brokerWon ? '브로커에게 계약 ' + s.brokerWon + '건을 뺏겼어요' : '브로커를 ' + n(s.brokerBlocked) + '번 막아 냈어요',
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
    { key: 'storm', tag: '재난 · 긴급조달', col: '#0f8a96', when: (S, s) => n(s.urgentMade) > 0,
      weight: (S, s) => 0.5 + n(s.urgentDone) * 0.15,
      me: (S, s) => '재난 때 긴급 계약 ' + n(s.urgentDone) + '건을 해결했어요' + (n(s.urgentMade) > n(s.urgentDone) ? ' (' + s.urgentMade + '건 중)' : ''),
      facts: ['재난 땐 보통 7~40일 걸리는 입찰 대신 5일짜리 긴급입찰과 수의계약으로 절차를 줄여 빨리 사요.',
              '재난 복구 물자는 납품검사도 간소화하고, 나라장터 긴급 구매는 2단계 경쟁을 면제해 더 빨리 보내요.',
              '조달청은 호우·산불·가뭄 같은 재난이 나면 긴급조달 지침을 정해 피해 지역에 물자를 서둘러 공급해요.'] },
    { key: 'growth', tag: '함께 성장', col: '#b08800', when: (S, s) => n(s.shopGrow) + n(s.villageUp) > 0,
      weight: (S, s) => (n(s.shopGrow) + n(s.villageUp) * 1.2) / 6,
      me: (S, s) => '공방 ' + n(s.shopGrow) + '번 성장' + (s.shopFactory ? '(공장 ' + s.shopFactory + '곳)' : '') + ', 마을 ' + n(s.villageUp) + '번 단장했어요',
      facts: ['공공조달 규모는 한 해 225조 원(2024년 계약 기준)으로 역대 가장 커요. 이 돈이 성실한 업체의 매출과 일자리가 돼요.',
              '조달청은 혁신제품 공공구매를 2030년까지 3조 원 수준으로 늘려, 기술 있는 기업이 공공시장에서 자라도록 도와요.'] },
    { key: 'stock', tag: '원자재 비축', col: '#2e9b3a', when: (S, s) => n(s.stocked) > 0,
      weight: (S, s) => n(s.stocked) * 0.45 + (n(s.released) ? 0.4 : 0),
      me: (S, s) => '아낀 세금 ' + n(s.stockSpent) + '만원으로 원자재 ' + s.stocked + '상자 비축' + (s.released ? ' · 폭등 때 풀었어요' : ''),
      facts: ['조달청은 알루미늄·구리 등 원자재 6종을 쌀 때 사 두었다가, 값이 오르거나 모자라면 중소기업에 팔아요.',
              '돈이 부족한 중소기업은 비축 원자재를 외상으로 사거나, 먼저 빌려 쓰고 나중에 현물로 갚을 수 있어요.',
              '비축은 가격이 안정됐을 때 사고 급등할 때 풀어서, 물가와 원자재 수급을 안정시키는 일이에요.'] },
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
    { name: '브로커 사냥꾼', sub: '브로커를 놓치지 않는 눈', score: (S, s) => n0(s.brokerCaught) >= 3 ? n0(s.brokerCaught) / 5 : 0 },
    { name: '철벽 수비대', sub: '계약을 하나도 안 뺏겼어요', score: (S, s) => brokerAny(s) && !s.brokerWon && n0(s.brokerCaught) + n0(s.brokerBlocked) >= 3 ? 0.95 : 0 },
    { name: '가성비 장인', sub: '조건 맞춘 곳 중 늘 가장 싸게', score: (S, s) => n0(s.valueBest) >= 12 && n0(s.valueMiss) <= 1 ? n0(s.valueBest) / 22 : 0 },
    { name: '새싹 키우미', sub: '스타트업을 혁신제품으로', score: (S, s) => n0(s.innov) ? 0.8 + n0(s.innov) * 0.3 : 0 },
    { name: '꼼꼼한 검수왕', sub: '검수 불합격 0건', score: (S, s) => !s.qFail && n0(s.passed) >= 15 ? n0(s.passed) / 28 : 0 },
    { name: '알뜰 살림꾼', sub: '국민 세금을 듬뿍 아꼈어요', score: S => S.saved >= 50 ? S.saved / 85 : 0 },
    { name: '번개 배달부', sub: '끊김 없는 연속 납품', score: S => n0(S.maxCombo) >= 12 ? S.maxCombo / 18 : 0 },
    { name: '페이퍼컴퍼니 탐정', sub: '수상한 새 공방을 척척', score: (S, s) => n0(s.caught) >= 4 ? n0(s.caught) / 6 : 0 },
    { name: '비축 전략가', sub: '가격 폭등에 미리 대비', score: (S, s) => n0(s.stocked) >= 2 ? 0.7 + n0(s.released) * 0.1 : 0 },
    { name: '동네 성장 도우미', sub: '공방은 자라고 마을은 새 단장', score: (S, s) => n0(s.shopGrow) + n0(s.villageUp) >= 5 ? (n0(s.shopGrow) + n0(s.villageUp)) / 7 : 0 },
    { name: 'AI 데이터 조사관', sub: 'AI 조사로 부정 업체를 싹', score: (S, s) => n0(s.ult) ? 0.9 + n0(s.ult) * 0.3 : 0 },
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
    const gk = S.hard ? 'bestGrade_hard' : 'bestGrade', order = 'CBAS', best = G.store.get(gk, 'C');
    S.newBestGrade = order.indexOf(S.grade) > order.indexOf(best);
    if (S.newBestGrade) G.store.set(gk, S.grade);
    S.resFacts = pickFacts(S); S.resTitle = pickTitle(S);
  }
  function update(dt) {
    t += dt;
    if (!stamped && t >= 0.7) { stamped = true; G.audio.play(G.S.grade === 'S' || G.S.grade === 'A' ? 'levelup' : 'ok'); }
  }

  // 2026-11-03 타이틀·일시정지와 같은 톤: 일러스트 배경 + 둥근 크림 판 + 둥근 글꼴(Jua) + 스티커 제목
  function draw(ctx, S) {
    const s = S.stats || {}, K = G.soft, J = K.J, H = C.VIEW.h;
    K.bg(ctx);
    ctx.fillStyle = 'rgba(40,30,20,.5)'; ctx.fillRect(0, 0, W, H);

    // 1. 스티커 제목 + 점수 + 오늘의 칭호
    const hx = W / 2 - 110;
    const tg = ctx.createLinearGradient(0, 18, 0, 70); tg.addColorStop(0, '#fff17a'); tg.addColorStop(0.55, '#ffc93a'); tg.addColorStop(1, '#ff9a26');
    K.softShadow(ctx, 10, 5, .35); J(ctx, '작전 종료!', hx, 42, 50, '#fff', { stroke: [['#fff', 16]] }); K.noShadow(ctx);
    J(ctx, '작전 종료!', hx, 42, 50, tg, { stroke: [['#2f4f8a', 8]] });
    if (S.hard) { K.rr(ctx, hx + 128, 16, 66, 24, 12); ctx.fillStyle = '#d9342b'; ctx.fill(); J(ctx, 'HARD', hx + 161, 29, 16, '#fff'); }
    J(ctx, '점수 ' + S.score.toLocaleString() + (S.newBest ? '  · 최고 기록!' : ''), hx, 86, 24, S.newBest ? '#fff3b0' : '#fff', { stroke: [['rgba(40,28,10,.6)', 5]] });
    if (S.resTitle && t >= 0.3) {                                    // 오늘의 칭호 리본(둥근 알약)
      const tl = S.resTitle, k = Math.min(1, (t - 0.3) / 0.25);
      ctx.save(); ctx.globalAlpha = k;
      ctx.font = '18px ' + '"Jua", sans-serif'; const nw = ctx.measureText(tl.name).width; ctx.font = '13px "Jua", sans-serif'; const lw = ctx.measureText('오늘의 칭호').width;
      const tw = nw + lw + 40, rx = hx - tw / 2, ry = 102;
      K.softShadow(ctx, 8, 3, .3); K.rr(ctx, rx, ry, tw, 28, 14); ctx.fillStyle = '#d9342b'; ctx.fill(); K.noShadow(ctx);
      J(ctx, '오늘의 칭호', rx + 14, ry + 15, 13, '#ffd6cc', { align: 'left' });
      J(ctx, tl.name, rx + 26 + lw, ry + 15, 18, '#ffe45a', { align: 'left' });
      ctx.restore();
      J(ctx, tl.sub + '  ·  신뢰 ' + Math.round(S.trust) + '  ·  아낀 세금 ' + S.saved + '만원', hx, 145, 15, '#fff6dc', { stroke: [['rgba(40,28,10,.55)', 4]] });
    }
    // 등급 도장 (흰 원판 위) + 3D 나르미·달이
    const gx = W / 2 + 190, gy = 72, col = GRADE_COL[S.grade];
    const im = G.img.mascot3d;
    if (im && im.naturalWidth) { const h = 124, w = im.naturalWidth * h / im.naturalHeight, jump = t > 0.5 && t < 0.9 ? -Math.sin((t - 0.5) / 0.4 * Math.PI) * 10 : 0; ctx.imageSmoothingEnabled = true; ctx.drawImage(im, gx + 170 - w / 2, gy - 62 + jump, w, h); ctx.imageSmoothingEnabled = false; }
    else G.spr.drawChar(ctx, 'narmi', t < 0.9 ? 'act' : 'rot', 'sw', t, gx + 92, gy + 38, 1.1);
    if (t >= 0.5) {
      const k = Math.min(1, (t - 0.5) / 0.2), sc = 2.4 - 1.4 * k;
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(-0.14); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, k * 1.5);
      K.softShadow(ctx, 10, 4, .35); ctx.fillStyle = 'rgba(255,251,240,.96)'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.fill(); K.noShadow(ctx);
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 28, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
      J(ctx, S.grade, 0, 3, 46, col);
      ctx.restore(); ctx.globalAlpha = 1;
      if (t >= 0.8) {
        J(ctx, GRADE_MSG[S.grade] + (S.newBestGrade ? ' (최고 등급!)' : ''), gx, gy + 54, 15, '#fff3b0', { stroke: [['rgba(40,28,10,.6)', 4]] });
        if (S.gradeNote) J(ctx, S.gradeNote, gx, gy + 76, 14, '#ffd0c8', { stroke: [['rgba(40,28,10,.65)', 4]] });
      }
    }

    // 2. 조달관 5대 임무 카드: 둥근 카드 + 임무 색 머리 + ✔ 도장
    const cw = 170, ch = 64, gap = 9, cx0 = (W - (cw * 5 + gap * 4)) / 2, cy = 184;
    const late = s.reqExpired || 0, qf = s.qFail || 0, stop = (s.brokerBlocked || 0) + (s.brokerCaught || 0);
    const info = {
      value: ['가성비 ' + (s.valueBest || 0) + '번', '합격 ' + S.delivered + (qf || late ? ' · 불합격 ' + qf + ' · 늦음 ' + late : '건')],
      paper: ['적발 ' + (s.caught || 0) + '곳', '실사 ' + ((s.certified || 0) + (s.caught || 0)) + '번'],
      broker: ['차단 ' + stop + '번', s.brokerWon ? '뺏긴 계약 ' + s.brokerWon + '건' : '한 번도 안 뺏김!'],
      sprout: ['혁신제품 ' + (s.innov || 0) + '곳', '새싹 실적 ' + (s.sproutBuy || 0) + ' · 공방 성장 ' + (s.shopGrow || 0)],
      prep: ['대응 ' + ((s.prepared || 0) + (s.urgentDone || 0)) + '번', '긴급 해결 ' + (s.urgentDone || 0) + ' · 비축 방출 ' + (s.released || 0)],
    };
    const mk = G.missions.count(S);
    J(ctx, mk === 5 ? '★ 5대 임무 완수! 완벽한 조달관 ★' : '조달관 5대 임무 ' + mk + '/5', W / 2, cy - 13, 15, mk === 5 ? '#ffe45a' : '#fff6dc', { stroke: [['rgba(40,28,10,.6)', 4]] });
    G.missions.LIST.forEach((m, i) => {
      const x = cx0 + (cw + gap) * i, on = S.missions && S.missions[m.id] != null, [main, sub] = info[m.id];
      K.softShadow(ctx, 10, 4, .3); K.rr(ctx, x, cy, cw, ch, 14); ctx.fillStyle = on ? 'rgba(255,251,240,.97)' : 'rgba(225,220,208,.94)'; ctx.fill(); K.noShadow(ctx);
      ctx.save(); K.rr(ctx, x, cy, cw, ch, 14); ctx.clip(); ctx.fillStyle = on ? m.col : '#8a909a'; ctx.fillRect(x, cy, cw, 22); ctx.restore();
      J(ctx, (i + 1) + '  ' + m.name, x + cw / 2, cy + 12, 14, '#fff');
      J(ctx, main, x + cw / 2 - (on ? 14 : 0), cy + 38, 19, on ? m.col : '#6a6a6a');
      J(ctx, sub, x + cw / 2, cy + 55, 12, '#7a6a4a');
      if (on) {
        ctx.save(); ctx.translate(x + cw - 22, cy + 39); ctx.rotate(-0.2);
        ctx.strokeStyle = m.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        J(ctx, '✔', 0, 1, 16, m.col); ctx.restore();
      }
    });

    // 3. 오늘 한 일, 실제로는? (크림색 둥근 판)
    const bx = cx0, by = 266, bw = W - cx0 * 2, bh = 180;
    K.softShadow(ctx, 18, 6, .3); K.rr(ctx, bx, by, bw, bh, 18); ctx.fillStyle = 'rgba(255,251,240,.97)'; ctx.fill(); K.noShadow(ctx);
    K.rr(ctx, bx + 20, by - 13, 200, 26, 13); ctx.fillStyle = '#2f4f8a'; ctx.fill();
    J(ctx, '오늘 한 일, 실제로는?', bx + 120, by + 1, 16, '#fff');
    // 글자 크기: 3개가 다 들어가는 가장 큰 크기(14 → 13 → 12)
    const facts = S.resFacts || [];
    let fs = 14, LH = 16, wrapped;
    for (fs = 14; fs >= 12; fs--) {
      LH = fs + 2; ctx.font = fs + 'px "Jua", sans-serif';
      wrapped = facts.map(f => wrap(ctx, '→ 실제로는 ' + f.text, bw - 186));
      if (28 + wrapped.reduce((h, ls) => h + 19 + ls.length * LH + 8, 0) - 8 <= bh) break;
    }
    const used = 28 + wrapped.reduce((h, ls) => h + 19 + ls.length * LH + 8, 0) - 8;
    let y = by + 28 + Math.max(0, Math.min(16, (bh - used) / 2));      // 남는 공간이 있으면 가운데 쪽으로
    facts.forEach((f, i) => {
      if (t < 1.0 + i * 0.35) return;                                   // 한 줄씩 차례로 등장
      const lines = wrapped[i]; if (y + 8 + lines.length * LH > by + bh) return;   // 그래도 넘치면 그 사실은 생략
      K.rr(ctx, bx + 16, y - 11, 138, 22, 11); ctx.fillStyle = f.col; ctx.fill();
      J(ctx, f.tag, bx + 85, y + 1, 13, '#fff');
      J(ctx, f.me, bx + 168, y + 1, 17, f.col, { align: 'left' });
      lines.forEach((ln, j) => J(ctx, ln, bx + 168, y + 19 + j * LH, fs, '#5a4e36', { align: 'left' }));
      y += 19 + lines.length * LH + 8;
    });

    // 4. 고정 문구
    J(ctx, '필요한 것을, 공정하게, 효율적으로, 필요한 곳에 제때 — 그게 조달입니다.', W / 2, 457, 17, '#fff', { stroke: [['rgba(40,28,10,.65)', 5]] });
  }
  return { start, update, draw, grade };
})();
