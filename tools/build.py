"""제출용 단일 html 빌드: index.html의 css·js를 안에 넣고, 'assets/...' 경로를 data URI로 바꾼다.
사용: python3 tools/build.py  →  dist/index.html (인터넷 없이 실행)"""
import base64, mimetypes, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2'}

def data_uri(rel):
    p = ROOT / rel
    return f"data:{MIME.get(p.suffix) or mimetypes.guess_type(p.name)[0]};base64," + base64.b64encode(p.read_bytes()).decode()

html = (ROOT / 'index.html').read_text(encoding='utf-8')
# 개발 전용 스크립트(data-dev, 예: 시간 건너뛰기)는 제출용에서 뺀다
html = re.sub(r'<script src="[^"]+" data-dev></script>\n?', '', html)
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
              lambda m: '<style>\n' + (ROOT / m.group(1)).read_text(encoding='utf-8') + '</style>', html)
html = re.sub(r'<script src="([^"]+)"></script>',
              lambda m: '<script>\n' + (ROOT / m.group(1)).read_text(encoding='utf-8').replace('</script', '<\\/script') + '</script>', html)
used = sorted(set(re.findall(r"assets/[\w.\-]+\.(?:png|jpg|woff2)", html)))
for rel in used:
    html = html.replace(rel, data_uri(rel))
out = ROOT / 'dist' / 'index.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(f'{out.relative_to(ROOT)}  {out.stat().st_size / 1024:.0f} KB  (자산 {len(used)}개 내장)')
