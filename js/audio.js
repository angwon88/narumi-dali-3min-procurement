/* 효과음: Web Audio로 코드에서 합성 (음원 파일 없음 → 저작권 문제 없음)
   브라우저 정책상 첫 클릭·키 입력 때 AudioContext를 깨운다. M 키로 켜기/끄기(저장됨). */
'use strict';
G.audio = (() => {
  let ac = null, master = null, muted = G.store.get('muted', false);
  function wake() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.35; master.connect(ac.destination);
  }
  addEventListener('pointerdown', wake); addEventListener('keydown', wake);
  // 음 하나: 주파수(또는 [시작, 끝]), 길이, 파형, 시작 지연, 음량
  function tone(f, dur, type = 'square', delay = 0, vol = 0.5) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    if (Array.isArray(f)) { o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(f[1], t + dur); } else o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, delay = 0, vol = 0.3, lp = 1200) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay, n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  const SFX = {
    buy: () => { tone(880, 0.06, 'square', 0, 0.25); tone(1320, 0.08, 'square', 0.05, 0.2); },
    deliver: (n = 0) => { const k = Math.pow(2, Math.min(n, 12) / 24); tone(660 * k, 0.09, 'square', 0, 0.3); tone(990 * k, 0.16, 'square', 0.08, 0.3); },
    fail: () => { tone([392, 196], 0.35, 'sawtooth', 0, 0.25); },
    scam: () => { noise(0.15, 0, 0.35, 400); tone([220, 110], 0.4, 'triangle', 0.05, 0.4); },
    catch: () => { noise(0.12, 0, 0.4, 600); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.1 + i * 0.07, 0.28)); },
    ok: () => { tone(784, 0.08, 'triangle', 0, 0.3); tone(1047, 0.12, 'triangle', 0.07, 0.3); },
    whoosh: () => { noise(0.25, 0, 0.18, 2500); },
    levelup: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.1, 'square', i * 0.06, 0.25)); },
    gift: () => { [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.12, 'triangle', i * 0.08, 0.25)); },
    click: () => tone(600, 0.04, 'square', 0, 0.2),
    warn: () => { tone(880, 0.09, 'square', 0, 0.18); tone(880, 0.09, 'square', 0.14, 0.18); },
    tick: () => tone(1200, 0.03, 'square', 0, 0.18),
    end: () => { [784, 659, 523, 784].forEach((f, i) => tone(f, 0.16, 'square', i * 0.12, 0.25)); },
    banner: () => { tone(660, 0.08, 'triangle', 0, 0.2); tone(880, 0.1, 'triangle', 0.08, 0.2); },
  };
  function play(name, arg) { try { if (SFX[name]) SFX[name](arg); } catch (e) { /* 소리는 실패해도 게임 진행 */ } }
  function toggle() {
    muted = !muted; G.store.set('muted', muted);
    if (master) master.gain.value = muted ? 0 : 0.35;
    return muted;
  }
  return { play, toggle, wake, isMuted: () => muted, raw: () => ({ ac, master }) };   // raw: 배경음악(music.js)용
})();
