/* 그림·글꼴 경로. 빌드(tools/build.py)가 'assets/...' 문자열을 data URI로 바꿔 넣는다.
   나르미·달이 프레임 정보는 이전 공모전 버전의 픽셀아트(공모전 첨부 이미지를 보고 코드로 생성)에서 그림 데이터만 가져온 것. */
'use strict';
G.ASSET_SRC = {
  dali: 'assets/dali.png', narmi: 'assets/narmi.png',
  ci_h: 'assets/ci_h.png', ci_v: 'assets/ci_v.png', mascot3d: 'assets/mascot3d.png', title_bg: 'assets/title_bg.jpg',   // title_bg: 이미지 AI(Leonardo.ai Lucid Origin)로 만든 타이틀 배경   // mascot3d: 공모전 제공 공식 3D 이미지를 줄인 것(타이틀·결과)
};
G.FONT_SRC = {
  'Galmuri11': 'assets/Galmuri11.woff2',
  'Galmuri11 Bold': 'assets/Galmuri11-Bold.woff2',
  'Galmuri9': 'assets/Galmuri9.woff2',
  'Jua': 'assets/Jua-title.woff2',   // 2026-11-03 타이틀 전용 둥근 글꼴(OFL, 타이틀 화면 글자만 담은 부분 글꼴 43KB)
};
G.CHAR_META = {"dali": {"cell": 64, "cols": 9, "draw": 60.08, "smooth": true, "foot": [32.5, 58], "anims": {"rot": {"fps": 1, "dirs": {"e": [0], "se": [1], "s": [2], "sw": [3], "w": [4], "nw": [5], "n": [6], "ne": [7]}}, "walk": {"fps": 10, "dirs": {"e": [0, 8, 9, 8, 0, 10, 11, 10], "se": [1, 12, 13, 12, 1, 14, 15, 14], "s": [2, 16, 17, 16, 2, 18, 19, 18], "sw": [3, 20, 21, 20, 3, 22, 23, 22], "w": [4, 24, 25, 24, 4, 26, 27, 26], "nw": [5, 28, 29, 28, 5, 30, 31, 30], "n": [6, 32, 33, 32, 6, 34, 35, 34], "ne": [7, 36, 37, 36, 7, 38, 39, 38]}}, "act": {"fps": 12, "dirs": {"e": [0, 40, 41, 42], "se": [1, 43, 44, 45], "s": [2, 46, 47, 48], "sw": [3, 49, 50, 51], "w": [4, 52, 53, 54], "nw": [5, 55, 56, 57], "n": [6, 58, 59, 60], "ne": [7, 61, 62, 63]}}, "hurt": {"fps": 12, "hold": 0.1, "dirs": {"e": [64, 64, 65], "se": [66, 66, 67], "s": [68, 68, 69], "sw": [70, 70, 71], "w": [72, 72, 73], "nw": [74, 74, 75], "n": [76, 76, 77], "ne": [78, 78, 79]}}}}, "narmi": {"cell": 64, "cols": 10, "draw": 54.52, "smooth": true, "foot": [32.0, 57], "anims": {"rot": {"fps": 1, "dirs": {"e": [0], "se": [1], "s": [2], "sw": [3], "w": [4], "nw": [5], "n": [6], "ne": [7]}}, "walk": {"fps": 10, "dirs": {"e": [0, 8, 9, 8, 0, 10, 11, 10], "se": [1, 12, 13, 12, 1, 14, 15, 14], "s": [2, 16, 17, 16, 2, 18, 19, 18], "sw": [3, 20, 21, 20, 3, 22, 23, 22], "w": [4, 24, 25, 24, 4, 26, 27, 26], "nw": [5, 28, 29, 28, 5, 30, 31, 30], "n": [6, 32, 33, 32, 6, 34, 35, 34], "ne": [7, 36, 37, 36, 7, 38, 39, 38]}}, "act": {"fps": 12, "dirs": {"e": [0, 40, 41, 42], "se": [1, 43, 44, 45], "s": [2, 46, 47, 48], "sw": [3, 49, 50, 51], "w": [4, 52, 53, 54], "nw": [5, 55, 56, 57], "n": [6, 58, 59, 60], "ne": [7, 61, 62, 63]}}, "hurt": {"fps": 12, "hold": 0.1, "dirs": {"e": [64, 65, 66], "se": [67, 68, 69], "s": [70, 71, 72], "sw": [73, 74, 75], "w": [76, 77, 78], "nw": [79, 80, 81], "n": [82, 83, 84], "ne": [85, 86, 87]}}}}};
G.img = {};
G.loadAssets = function (done) {
  const jobs = [];
  for (const [k, src] of Object.entries(G.ASSET_SRC)) {
    jobs.push(new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = src; G.img[k] = im; }));
  }
  if (window.FontFace && document.fonts) {
    for (const [name, src] of Object.entries(G.FONT_SRC)) {
      jobs.push(new FontFace(name, 'url(' + src + ')').load().then(f => document.fonts.add(f)).catch(() => {}));
    }
  }
  Promise.all(jobs).then(done);
};
