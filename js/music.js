/* 배경음악 (2026-11-03, 기획서 7.2 선택 기능): Web Audio 칩튠을 코드로 직접 작곡·합성 (음원 파일 없음 → 저작권 문제 없음)
   곡: 평소 = C장조 8마디(멜로디 사각파 + 베이스 삼각파 + 킥·하이햇), 태풍 = A단조 아르페지오(긴장),
       막바지(FINAL_RUSH_AT 이후) 템포 ×1.15, 일시정지·레벨업 때 작게, 결과 화면에서 멈춤.
   '음악 끄기'는 효과음과 따로 저장(musicOff). 효과음 전체 끄기(M)를 하면 음악도 함께 꺼짐(같은 master 음량). */
'use strict';
G.music = (() => {
  const C = G.C, BPM = 132, LOOK = 0.15;
  let gain = null, mode = 'off', step = 0, next = 0, off = G.store.get('musicOff', false), timer = null;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const _ = null;
  // 평소 곡: 8분음표 64칸 (8마디 × 8). 숫자 = MIDI 음 높이
  const MELODY = [
    76, 79, 84, 79, 76, _, 74, 76,   72, 76, 81, 76, 72, _, 71, 72,     // C  | Am
    69, 72, 77, 72, 81, 79, 77, 76,  74, _, 79, _, 71, 74, 79, _,       // F  | G
    79, 76, 72, 76, 79, 81, 79, 76,  81, 76, 72, 76, 81, 83, 84, 81,    // C  | Am
    77, 81, 84, 81, 79, 83, 86, 83,  84, _, 79, _, 84, _, _, _,         // F G | C
  ];
  const ROOTS = [48, 45, 41, 43, 48, 45, [41, 43], 48];                  // 마디별 베이스 근음 (7마디는 F→G)
  // 태풍 곡: Am | F | Dm | E (각 2마디) 화음을 위아래로 오르내리는 아르페지오
  const STORM_CHORDS = [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]];

  function ctx() { const a = G.audio.raw(); if (!a.ac) return null; if (!gain) { gain = a.ac.createGain(); gain.gain.value = 0; gain.connect(a.master); } return a.ac; }
  function note(ac, f, t, dur, type, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; if (Array.isArray(f)) { o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(f[1], t + dur); } else o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(gain); o.start(t); o.stop(t + dur + 0.03);
  }
  let hat = null;
  function hihat(ac, t, vol) {
    if (!hat) { const n = Math.floor(ac.sampleRate * 0.04); hat = ac.createBuffer(1, n, ac.sampleRate); const d = hat.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); }
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = vol; s.buffer = hat; s.connect(f); f.connect(g); g.connect(gain); s.start(t);
  }
  function play(ac, i, t, e) {                                         // e = 8분음표 길이(초)
    const bar = Math.floor(i / 8) % 8, k = i % 8;
    if (mode === 'storm') {
      const ch = STORM_CHORDS[Math.floor(bar / 2)], seq = [0, 1, 2, 1, 0, 1, 2, 1];
      note(ac, hz(ch[seq[k]] + 12), t, e * 0.9, 'square', 0.035);
      if (k % 2 === 0) note(ac, hz(ch[0] - 12), t, e * 1.8, 'triangle', 0.13);
      if (k === 0 || k === 4) note(ac, [140, 45], t, 0.18, 'sine', 0.22);
      if (k % 2) hihat(ac, t, 0.05);
      return;
    }
    const m = MELODY[i % 64];
    if (m != null) note(ac, hz(m), t, e * 0.85, 'square', 0.045);
    let r = ROOTS[bar]; if (Array.isArray(r)) r = r[k < 4 ? 0 : 1];
    const bass = [r, r, r + 7, r, r, r, r + 7, r + 12][k];
    note(ac, hz(bass), t, e * 0.8, 'triangle', 0.12);
    if (k === 0 || k === 4) note(ac, [150, 50], t, 0.15, 'sine', 0.2);    // 킥
    if (k % 2) hihat(ac, t, 0.035);
  }
  function tick() {
    const ac = ctx(); if (!ac || mode === 'off' || off) return;
    const rush = G.S && G.screen !== 'title' && G.S.elapsed >= C.FINAL_RUSH_AT;
    const e = 60 / BPM / 2 / (rush ? 1.15 : 1);
    if (next < ac.currentTime) next = ac.currentTime + 0.05;
    while (next < ac.currentTime + LOOK) { play(ac, step, next, e); step++; next += e; }
  }
  // 매 프레임: 화면에 따라 곡·음량 정하기
  function update() {
    const ac = ctx(); if (!ac) return;
    const sc = G.screen, S = G.S;
    const want = off || sc === 'result' || sc === 'end' || sc === 'boot' ? 'off' : S && sc !== 'title' && sc !== 'intro' && S.storm ? 'storm' : 'main';
    if (want !== mode) { if (want === 'off' || mode === 'off') { step = 0; next = 0; } else step = step - (step % 8) + 8; mode = want; }   // 곡이 바뀌면 다음 마디부터
    const vol = 0.6 * (mode === 'off' ? 0 : sc === 'pause' || sc === 'levelup' ? 0.25 : sc === 'title' || sc === 'intro' ? 0.7 : 1);   // 효과음이 묻히지 않게 전체 0.6
    gain.gain.setTargetAtTime(vol, ac.currentTime, 0.15);
    if (!timer) timer = setInterval(tick, 25);
  }
  function toggle() { off = !off; G.store.set('musicOff', off); return off; }
  return { update, toggle, isOff: () => off, node: () => gain };   // node: 테스트에서 음악만 측정
})();
