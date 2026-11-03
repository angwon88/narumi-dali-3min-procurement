/* 설정 검사: js/*.js에서 쓰는 C.이름이 js/config.js에 실제로 정의돼 있는지 확인 (주석에 실수로 묻힌 설정을 찾기)
   사용: node tools/check_config.js */
'use strict';
const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..');
global.G = {}; global.window = global;
eval(fs.readFileSync(path.join(dir, 'js/config.js'), 'utf8'));
const used = new Set();
for (const f of fs.readdirSync(path.join(dir, 'js'))) for (const m of fs.readFileSync(path.join(dir, 'js', f), 'utf8').matchAll(/\bC\.([A-Z][A-Z0-9_]+)/g)) used.add(m[1]);
const missing = [...used].filter(k => G.C[k] === undefined);
console.log('코드에서 쓰는 설정 ' + used.size + '개 · 정의 안 된 것: ' + (missing.length ? missing.join(', ') : '없음'));
process.exit(missing.length ? 1 : 0);
