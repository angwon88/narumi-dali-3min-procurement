/* 설정 검사: ① js/*.js 문법 검사(주석이 코드를 삼킨 실수 찾기, 2026-11-04 추가) ② 코드에서 쓰는 C.이름이 js/config.js에 실제로 정의돼 있는지 (주석에 실수로 묻힌 설정 찾기)
   사용: node tools/check_config.js */
'use strict';
const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..');
const vm = require('vm'), bad = [];
for (const f of fs.readdirSync(path.join(dir, 'js')).filter(f => f.endsWith('.js'))) {
  try { new vm.Script(fs.readFileSync(path.join(dir, 'js', f), 'utf8'), { filename: f }); } catch (e) { bad.push(f + ': ' + e.message); }
}
console.log('문법 검사 ' + (bad.length ? '오류 ' + bad.length + '개\n  ' + bad.join('\n  ') : '통과'));
if (bad.length) process.exit(1);
global.G = {}; global.window = global;
eval(fs.readFileSync(path.join(dir, 'js/config.js'), 'utf8'));
const used = new Set();
for (const f of fs.readdirSync(path.join(dir, 'js'))) for (const m of fs.readFileSync(path.join(dir, 'js', f), 'utf8').matchAll(/\bC\.([A-Z][A-Z0-9_]+)/g)) used.add(m[1]);
const missing = [...used].filter(k => G.C[k] === undefined);
console.log('코드에서 쓰는 설정 ' + used.size + '개 · 정의 안 된 것: ' + (missing.length ? missing.join(', ') : '없음'));
process.exit(missing.length ? 1 : 0);
