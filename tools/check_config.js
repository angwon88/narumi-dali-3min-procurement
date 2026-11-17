/* 설정 검사: ① js/*.js 문법 검사(주석이 코드를 삼킨 실수 찾기, 2026-11-04 추가) ② 코드에서 쓰는 C.이름이 js/config.js에 실제로 정의돼 있는지 (주석에 실수로 묻힌 설정 찾기)
   사용: node tools/check_config.js */
'use strict';
const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..');
const vm = require('vm'), bad = [];
for (const f of fs.readdirSync(path.join(dir, 'js')).filter(f => f.endsWith('.js'))) {
  try { new vm.Script(fs.readFileSync(path.join(dir, 'js', f), 'utf8'), { filename: f }); } catch (e) { bad.push(f + ': ' + e.message); }
}
// ①-2 (2026-11-18 추가) 줄 중간 주석이 코드를 삼킨 흔적: 주석 끝이 } ) ] 로 끝나거나 주석 안에 ctx.그리기( · if ( 같은 코드가 있으면 오류
//      (문법이 우연히 맞아 ①을 통과하는 경우까지 잡음. 이 대화에서만 세 번 겪음: 닫는 괄호, CI 그리기, 초록 십자)
for (const f of fs.readdirSync(path.join(dir, 'js')).filter(f => f.endsWith('.js'))) {
  fs.readFileSync(path.join(dir, 'js', f), 'utf8').split('\n').forEach((l, i) => {
    const m = l.match(/(^|[^:'"\\])\/\/(.*)$/); if (!m) return;
    if (/\s[}\])];?\s*$/.test(m[2]) || /\b(ctx|px|G|S|C|T)\.\w+\(|\bif \(|; \w+\(/.test(m[2])) bad.push(f + ':' + (i + 1) + ' 주석 안에 코드가 묻힌 것 같아요 → 주석을 줄 끝이나 따로 한 줄로: ' + m[2].trim().slice(-60));
  });
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
