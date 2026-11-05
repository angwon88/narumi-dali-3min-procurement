"""타이틀·일시정지 화면용 둥근 글꼴(Jua, OFL) 부분 글꼴 만들기.
화면에 새 글자를 넣으면 (result·missions·screens·intro.js의 한글은 자동, 그 밖은 STRS에 추가) 다시 실행: python3 tools/subset_font.py
Google Fonts의 text= 기능으로 필요한 글자만 담은 woff2를 받는다 (인터넷 필요)."""
import urllib.parse, urllib.request, re, string, os
STRS = ['나르미와 달이의', '2분 조달작전', '조달관 5대 임무', '조건 맞춰 가성비 납품', '페이퍼컴퍼니 적발', '브로커 차단', '새싹을 혁신제품으로', '위기 대응',
        '작전 시작', '소개 다시 보기', '소리 켜기', '소리 끄기', '음악 켜기', '음악 끄기', 'AI 조사: 자동 사용', 'AI 조사: 직접 사용(Q)',
        '터치·클릭으로 이동 · Space 브로커 · Enter 시작 · M 소리', '최고 점수 최고 등급', '조달청 공식 마스코트', '나르미', '달이',
        # 일시정지
        # 시연 영상 자막 (tools/record_demo.cjs)
        '조건(★)을 맞춘 공방 중 가장 싼 곳에서 사요', '너무 싸고 좋은 새 공방? 나르미 실사로 페이퍼컴퍼니 적발!', '계약을 가로채는 브로커를 눌러 차단 · 입찰참가자격 제한',
        '새싹 공방의 첫 고객이 되어 혁신제품으로 키워요', '태풍엔 긴급조달 · 원자재는 쌀 때 비축해요', '브로커 3명 적발 → 데이터로 한 번에 찾아내는 AI 조사', '최후의 20초 · 브로커 총출동, 점수 1.5배!',
        '조달관 5대 임무', 'AI 조사', '결전', '실제 플레이 화면 · 2분 한 판을 줄여 보여 드려요',
        '잠깐 쉬는 중', '작전 일시정지', '계속하기', '처음부터', '타이틀로', '남은 시간', '점수', '임무', '아낀 세금', '만원', 'Esc·P 계속', '시간이 멈춰 있어요']
# 결과 화면은 판마다 문장이 달라서, 이 파일들에 나오는 한글을 모두 담는다
ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = ''.join(open(os.path.join(ROOT, 'js', f), encoding='utf-8').read() for f in ['result.js', 'missions.js', 'screens.js', 'intro.js', 'ult.js', 'score.js', 'director.js', 'thanks.js', 'connect.js', 'broker.js'])
hangul = {ch for ch in SRC if '\uac00' <= ch <= '\ud7a3'}
chars = hangul | set(''.join(STRS)) | set(string.ascii_letters + string.digits + string.punctuation + ' ·★✔→—~')
url = 'https://fonts.googleapis.com/css2?family=Jua&text=' + urllib.parse.quote(''.join(sorted(chars)))
ua = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36'}
css = urllib.request.urlopen(urllib.request.Request(url, headers=ua)).read().decode()
src = re.search(r"url\((.*?)\) format\('woff2'\)", css).group(1)
data = urllib.request.urlopen(src).read()
out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'Jua-title.woff2')
open(out, 'wb').write(data); print('assets/Jua-title.woff2', len(data), 'bytes,', len(chars), '글자')
