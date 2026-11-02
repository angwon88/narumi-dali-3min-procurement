/* 배경음악 (2026-11-03, 기획서 7.2 선택 기능): Web Audio 칩튠을 코드로 직접 작곡·합성 (음원 파일 없음 → 저작권 문제 없음)
   v2 (2026-11-03 "단조롭다" 피드백): 8마디 반복 → 약 1분짜리 곡
     평소 곡(C장조 132BPM): 전주 2마디 → A 주제 8 → B 당김음 8 → A' 높은 변주 8 → 간주(느린 긴 음) 8 → A로 반복
       구간마다 베이스(통통·걷는·긴 음)·드럼(킥·스네어·하이햇·필인)·높은 아르페지오 대선율이 달라짐
     태풍 곡(A단조): 8마디, 16분 아르페지오 + 긴 멜로디 + 고동치는 베이스
   막바지(FINAL_RUSH_AT 이후) 템포 ×1.15, 일시정지·레벨업 때 작게, 결과 화면에서 멈춤.
   '음악 끄기'는 효과음과 따로 저장(musicOff). 효과음 전체 끄기(M)를 하면 음악도 함께 꺼짐(같은 master 음량). */
'use strict';
G.music = (() => {
  const C = G.C, BPM = 132, LOOK = 0.15;
  let gain = null, mode = 'off', step = 0, next = 0, off = G.store.get('musicOff', false), timer = null;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- 악보 ----------
  // 음 이름 → MIDI ("C5" = 72, "G#5" = 80, "r" = 쉼표). 길이는 16분음표 단위, 한 마디 = 16
  const NAME = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = s => s === 'r' ? null : 12 * (+s[s.length - 1] + 1) + NAME[s[0]] + (s[1] === '#' ? 1 : 0);
  const bar = str => str.trim().split(/\s+/).map(t => { const [n, d] = t.split(':'); return [midi(n), +d]; });
  // 화음: 베이스 근음(MIDI)과 화음 구성(반음)
  const CH = { C: [36, [0, 4, 7]], Am: [33, [0, 3, 7]], F: [29, [0, 4, 7]], G: [31, [0, 4, 7]], Em: [28, [0, 3, 7]], Dm: [26, [0, 3, 7]], E: [28, [0, 4, 7]] };
  const A = [
    ['C', 'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4'], ['Am', 'A5:3 G5:1 E5:2 C5:2 E5:4 r:4'],
    ['F', 'F5:2 A5:2 C6:2 A5:2 G5:3 F5:1 E5:4'], ['G', 'D5:2 r:1 D5:1 G5:4 B5:2 A5:2 G5:4'],
    ['C', 'E5:2 G5:2 C6:4 D6:2 C6:2 G5:4'], ['Am', 'A5:2 C6:2 E6:4 D6:2 C6:1 B5:1 A5:4'],
    [['Dm', 'G'], 'F5:2 A5:2 D6:4 B5:2 G5:2 D5:4'], ['C', 'C6:6 G5:2 E5:4 r:4'],
  ];
  const B = [
    ['F', 'r:2 A4:2 C5:2 F5:3 E5:1 F5:2 A5:4'], ['G', 'r:2 B4:2 D5:2 G5:3 F5:1 G5:2 B5:4'],
    ['Em', 'G5:3 E5:3 B4:2 E5:2 G5:2 B5:4'], ['Am', 'A5:3 E5:3 C5:2 E5:2 A5:2 C6:4'],
    ['Dm', 'D6:2 C6:2 A5:2 F5:2 D5:4 F5:4'], ['G', 'G5:2 F5:2 D5:2 B4:2 G4:4 B4:2 D5:2'],
    ['C', 'E5:2 D5:1 E5:1 G5:4 C6:4 E6:4'], ['G', 'D6:4 B5:2 G5:2 A5:2 B5:2 D6:4'],
  ];
  const A2 = A.slice(0, 4).concat([
    ['C', 'G5:2 C6:2 E6:4 D6:2 C6:2 G5:4'], ['Am', 'E6:2 D6:2 C6:2 A5:2 C6:4 E6:4'],
    [['Dm', 'G'], 'F6:3 E6:1 D6:4 B5:2 D6:2 G6:4'], ['C', 'C6:4 G5:2 E5:2 C5:8'],
  ]);
  const BRIDGE = [
    ['Am', 'A5:8 G5:4 E5:4'], ['F', 'F5:8 A5:4 C6:4'], ['C', 'G5:8 E5:4 C5:4'], ['G', 'D5:8 G5:4 B5:4'],
    ['Am', 'C6:8 B5:4 A5:4'], ['F', 'A5:6 G5:2 F5:8'], ['Dm', 'F5:4 A5:4 D6:4 C6:4'], ['E', 'B5:8 G#5:4 E5:4'],
  ];
  const INTRO = [['C', 'r:16'], ['G', 'r:16']];
  const STORM = [
    ['Am', 'E5:8 D5:8'], ['F', 'C5:8 A4:8'], ['Dm', 'F5:8 E5:8'], ['E', 'G#5:16'],
    ['Am', 'E5:6 F5:2 E5:8'], ['F', 'C5:8 F5:8'], ['G', 'D5:6 E5:2 B4:8'], ['E', 'E5:4 G#5:4 B5:8'],
  ];
  // 구간 = [이름, 마디들]. 반복은 전주를 빼고 A부터
  function song(parts) {
    const bars = [];
    for (const [sec, list] of parts) list.forEach(([ch, mel], i) => {
      const notes = {}; let pos = 0;
      for (const [m, d] of bar(mel)) { if (m != null) notes[pos] = [m, d]; pos += d; }
      bars.push({ sec, ch: Array.isArray(ch) ? ch : [ch, ch], notes, last: i === list.length - 1 });
    });
    return bars;
  }
  const MAIN = song([['intro', INTRO], ['A', A], ['B', B], ['A2', A2], ['bridge', BRIDGE]]), LOOP_FROM = INTRO.length;
  const STORM_SONG = song([['storm', STORM]]);

  // ---------- 소리 ----------
  function ctx() { const a = G.audio.raw(); if (!a.ac) return null; if (!gain) { gain = a.ac.createGain(); gain.gain.value = 0; gain.connect(a.master); } return a.ac; }
  function note(ac, f, t, dur, type, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; if (Array.isArray(f)) { o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(f[1], t + dur); } else o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol * 0.8, t + Math.max(0.02, dur * 0.6)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(gain); o.start(t); o.stop(t + dur + 0.03);
  }
  let noiseBuf = null;
  function noise(ac, t, dur, vol, hp) {                               // 하이햇(hp 높음) · 스네어(hp 낮음)
    if (!noiseBuf) { const n = Math.floor(ac.sampleRate * 0.25); noiseBuf = ac.createBuffer(1, n, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'highpass'; f.frequency.value = hp; s.buffer = noiseBuf;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(gain); s.start(t); s.stop(t + dur + 0.02);
  }
  const kick = (ac, t, v = 0.22) => note(ac, [150, 45], t, 0.16, 'sine', v);
  const snare = (ac, t, v = 0.09) => { noise(ac, t, 0.12, v, 1500); note(ac, [220, 160], t, 0.06, 'triangle', v * 0.6); };
  const hat = (ac, t, v = 0.03) => noise(ac, t, 0.035, v, 7000);

  // 16분음표 한 칸 연주. i = 곡 안의 16분 칸 번호, s = 16분음표 길이(초)
  function play(ac, bars, i, t, s) {
    const b = bars[Math.floor(i / 16) % bars.length], p = i % 16, [root, tri] = CH[b.ch[p < 8 ? 0 : 1]], sec = b.sec;
    const n = b.notes[p];
    if (n) {                                                           // 멜로디
      const [m, d] = n;
      if (sec === 'bridge') note(ac, hz(m), t, d * s * 0.95, 'triangle', 0.11);
      else note(ac, hz(m), t, d * s * 0.9, 'square', sec === 'storm' ? 0.04 : 0.045);
    }
    const fill = b.last && p >= 12;                                    // 구간 마지막 박: 스네어 필인
    if (sec === 'storm') {
      note(ac, hz(root + 36 + tri[[0, 1, 2, 1][p % 4]] + (p >= 8 ? 12 : 0)), t, s * 0.9, 'triangle', 0.05);   // 16분 아르페지오
      if (p % 2 === 0) note(ac, hz(root + 12), t, s * 1.6, 'triangle', 0.13);
      if (p % 4 === 0) kick(ac, t, 0.2);
      if (p === 4 || p === 12) snare(ac, t, 0.07);
      if (p % 2) hat(ac, t, 0.025);
      return;
    }
    // 베이스
    const R = root + 12, five = R + 7;
    if (sec === 'A' || sec === 'A2' || sec === 'intro') { if (p % 2 === 0) note(ac, hz([R, R, five, R, R, R + 12, five, R][p / 2]), t, s * 1.6, 'triangle', 0.12); }
    else if (sec === 'B') { if (p % 4 === 0) note(ac, hz(R + [0, tri[1], tri[2], tri[1]][p / 4]), t, s * 3.5, 'triangle', 0.13); }
    else if (sec === 'bridge') { if (p === 0) note(ac, hz(R), t, s * 7.5, 'triangle', 0.12); if (p === 8) note(ac, hz(five), t, s * 7.5, 'triangle', 0.1); }
    // 높은 아르페지오 대선율 (B·A')
    if ((sec === 'B' || sec === 'A2') && p % 2 === 1) note(ac, hz(root + 48 + tri[(p >> 1) % 3]), t, s * 0.8, 'triangle', 0.022);
    // 드럼
    if (sec === 'intro') { if (p === 0) kick(ac, t); if (p % 2 === 0) hat(ac, t, 0.02); return; }
    if (sec === 'bridge') { if (p === 0) kick(ac, t, 0.16); if (p % 4 === 2) hat(ac, t, 0.02); if (fill && p % 2 === 0) snare(ac, t, 0.06); return; }
    if (p === 0 || p === 8 || (sec !== 'A' && p === 10)) kick(ac, t);
    if ((sec === 'B' || sec === 'A2') && (p === 4 || p === 12)) snare(ac, t);
    if (fill) snare(ac, t, 0.05 + (p - 12) * 0.015);                  // 필인: 마지막 박 16분 스네어가 점점 세게
    else if (sec === 'A2' || p % 2 === 0) hat(ac, t, p % 4 === 2 ? 0.04 : 0.025);
  }
  function tick() {
    const ac = ctx(); if (!ac || mode === 'off' || off) return;
    const rush = G.S && G.screen !== 'title' && G.S.elapsed >= C.FINAL_RUSH_AT;
    const s = 60 / BPM / 4 / (rush ? 1.15 : 1);
    const bars = mode === 'storm' ? STORM_SONG : MAIN, total = bars.length * 16;
    if (next < ac.currentTime) next = ac.currentTime + 0.05;
    while (next < ac.currentTime + LOOK) {
      if (step >= total) step = mode === 'storm' ? 0 : LOOP_FROM * 16;   // 반복은 전주 빼고
      play(ac, bars, step, next, s); step++; next += s;
    }
  }
  // 매 프레임: 화면에 따라 곡·음량 정하기
  let mainPos = 0;
  function update() {
    const ac = ctx(); if (!ac) return;
    const sc = G.screen, S = G.S;
    const want = off || sc === 'result' || sc === 'end' || sc === 'boot' ? 'off' : S && sc !== 'title' && sc !== 'intro' && S.storm ? 'storm' : 'main';
    if (want !== mode) {
      if (mode === 'main') mainPos = step;                             // 태풍이 끝나면 평소 곡을 이어서 (다음 마디부터)
      step = want === 'storm' ? 0 : want === 'main' && mode === 'storm' ? Math.ceil(mainPos / 16) * 16 : 0;
      if (want === 'off' || mode === 'off') next = 0;
      mode = want;
    }
    const vol = 0.6 * (mode === 'off' ? 0 : sc === 'pause' || sc === 'levelup' ? 0.25 : sc === 'title' || sc === 'intro' ? 0.7 : 1);   // 효과음이 묻히지 않게 전체 0.6
    gain.gain.setTargetAtTime(vol, ac.currentTime, 0.15);
    if (!timer) timer = setInterval(tick, 25);
  }
  function toggle() { off = !off; G.store.set('musicOff', off); return off; }
  // 악보 검사용: 16칸이 아닌 마디 수 (0이어야 함)
  function check() { return [...A, ...B, ...A2, ...BRIDGE, ...INTRO, ...STORM].map(([, m]) => bar(m).reduce((a, [, d]) => a + d, 0)).filter(x => x !== 16).length; }
  return { update, toggle, isOff: () => off, node: () => gain, check, bars: () => MAIN.length };
})();
