/* 나르미와 달이의 2분 조달작전 (2026-11-03 3분 → 2분) — 수치 상수 (기획서 8장). [초기값]은 플레이테스트로 조정 */
'use strict';
const G = window.G = {};
G.C = {
  VIEW: { w: 960, h: 540 }, HUD_H: 44, DT: 1 / 60,
  RES: 2, RES_AUTO: true,   // RES_AUTO: 창 크기에 맞춰 RES를 바꿈(화면 실제 픽셀 = 캔버스 픽셀, 8.15단계). false면 RES 고정
   // 11-16 8.8단계: 실제 캔버스 해상도 배율(960×540 좌표로 그리되 1920×1080으로 그림 → 화면에 늘릴 때 덜 뭉개짐). 느린 기기면 1로
  GAME_SECONDS: 120, END_HOLD: 1.5,   // 2026-11-03 3분 → 2분 (앞쪽 대기 시간을 줄이고 일정 전체를 당김)
  LATE_AT: 60,                        // 이 시각부터 '후반'(수상한 공방 더 자주·동시 2곳, 브로커 쉬는 시간 짧게)
  DALI_SPEED: 185, NARMI_SPEED: 420, CHAR_SCALE: 0.75,
  INSPECT_TIME: 1.3, INSPECT_COOLDOWN: 3.5,   // 2026-11-03 실사 보고서를 읽을 수 있게 1.0 → 1.3   // 인증제 도입으로 6 → 3.5
  BUY_DWELL: 0.4, BAG_START: 2, BAG_MAX: 4,
  TRUST_START: 50, TRUST_DANGER: 25,
  DELIVER_BASE: 100, TIME_BONUS: 50, SAVING_MULT: 20,
  TRUST_ON_TIME: 4, TRUST_FAST: 6, TRUST_FAIL: -10, TRUST_FRAUD: -15, TRUST_CATCH: 5, CATCH_SCORE: 500, CATCH_BANK: 3, CATCH_STREAK_BONUS: 200,
  PRICE_NORMAL: [0.80, 0.95], PRICE_FAKE: [0.45, 0.55], PRICE_REROLL_SEC: 20,   // 20초마다 행별 가격을 새로 뽑음(싼 쪽이 50% 확률로 바뀜)
  MONOPOLY_MULT: 1.3, STREAK_WARN: 3, STREAK_CLOSE: 5, REOPEN_SEC: 20, REOPEN_FAKE_CHANCE: 0.4,
  FAKE_VANISH_SEC: 3, INNOV_PRICE_MULT: 1.0, INNOV_SCORE_MULT: 1.2,   // 11-04 실제 제도처럼 혁신제품이라고 더 싸지 않음(0.9→1.0), 점수 1.5→1.2
  INNOV_TRUST_BONUS: 2,
  INNOV_TRIAL: 3, INNOV_TRIAL_FAIL: 0.15, INNOV_MATURE_MULT: 1.2,   // 11-04 1.8→1.2: 혁신 공방만 쓰면 늘 정답이 되던 문제 (가성비 비교가 계속 필요하게)
    // 혁신제품 시범 사용, '보완 필요' 15%(2026-11-03 2분판이라 25 → 15), 성공 판정 뒤 ×1.8
  LEVEL_REQ: [3, 6, 10, 14, 19, 25, 32, 40],   // 2분 기준
  FINAL_RUSH_AT: 999, FINAL_RUSH_MULT: 1.5,   // 마지막 20초 결전. 11-16 8.0단계: 4단계(태풍)와 겹쳐서 끔(999 = 일어나지 않음, 되살리려면 100)
  STORM: { warnAt: 88, start: 90, end: 110, limit: 18, mult: 2, slow: 0.9 },
  MAX_REQ_PER_VILLAGE: 2, MAX_REQ_TOTAL: 4,   // 개편(2026-11-02): 6 → 4, '빨리'보다 '잘 고르기'
  REQ_LIMIT_MULT: 1.3, REQ_INTERVAL_MULT: 1.15,   // 개편: 구간표의 제한 시간 ×1.3, 요청 간격 ×1.15 (계약 조건을 읽을 시간)
  // 개편: 품질(★1~3)과 가격. 공방마다 물건별 품질이 정해져 있고(공방이 바뀔 때까지 고정), 가격은 품질 구간 안에서 20초마다 다시 뽑음
  Q_PRICE: { 1: [0.55, 0.68], 2: [0.72, 0.84], 3: [0.88, 0.98] },   // 예정가격 대비 배율
  Q_BARGAIN: 0.12,                  // 숨은 가성비: ★2·★3인데 한 단계 아래 가격대일 확률
  Q_REQ_W: [3, 4, 2],               // 계약 조건 ★1·★2·★3 이상 뽑는 가중치 (그 물건을 맞출 수 있는 공방이 있을 때만)
  VALUE_BONUS: 100,                 // 가성비 최고(조건을 맞춘 곳 중 가장 쌈) 보너스 점수
  TRUST_QFAIL: -6,                  // 검수 불합격(품질 미달) 신뢰도
  CHECK_SEC: 1.6,                   // 검수표 보여 주는 시간
  // 성장 (2026-11-03): 공방은 달이에게 판 누적 금액(만원)으로 작업장 → 공장, 마을은 검수 합격 납품 수로 1·2단계 단장
  SHOP_TIER: [22, 50],   // 2분 기준 (3분 때 30/70)
  SHOP_TIER_PRICE: [1, 0.95, 0.9],   // 작업장 값 -5%, 공장 값 -10% + 가격 폭등 영향 없음
  VILLAGE_TIER: [3, 7],   // 2분 기준 (3분 때 4/9)
  VILLAGE_LIMIT_MULT: 1.15, VILLAGE_T2_SCORE: 1.2, VILLAGE_T2_TRUST: 1,   // 1단계 새 계약 시간 +15%, 2단계 납품 점수 ×1.2·신뢰 +1
  TIER_SCORE: 100, TIER_TRUST: 2,
  // 새싹 공방 (개편 2단계): 실적 없는 스타트업. 품질은 좋지만 처음엔 조금 비쌈. 정상 납품 실적 SPROUT_GOAL건 → 혁신제품 지정
  EASY: { limit: 1.35, brokerSpeed: 0.8 },   // 11-16 8.18단계 초보 모드: 계약 시간 ×1.35 · 브로커 속도 ×0.8 + 다음 할 일 화살표(connect.js drawCoach)
  HARD: { limit: 0.68, brokerRest: 0.7, brokerSpeed: 1.15, fakeEvery: 1 },   // 11-04 하드 모드: 계약 시간 -32% · 브로커 더 자주(쉬는 시간 -30%)·더 빠르게(+15%). 페이퍼컴퍼니를 늘리면 적발 점수가 늘어 오히려 쉬워져서 그대로
  SPROUT_AT: [15, 38, 62, 85],   // 11-03 4곳(혁신 보상 4호까지)   // 2분 기준
  SPROUT_PRICE_MULT: 1.25, SPROUT_GOAL: 2, SPROUT_TRUST: 2, SPROUT_SCORE: 80, SPROUT_GRAD_SCORE: 1000, SPROUT_GRAD_TRUST: 8,   // 2분 기준 실적 2건 (3분 때 3건)
  FAKE_BID: true,                   // 2026-11-03 다시 켬: 수상한 새 공방을 FAKE_BID_SEC초 안에 실사하지 않으면 그 업종 계약 하나를 부정 낙찰로 가로챔 (Space 연타 대신 '알아보고 실사'하게)
  // 브로커 (개편): 계약을 가로채 불량품을 납품하려는 AI 라이벌
  // 필살기 'AI 데이터 일제 조사' (2026-11-03): 브로커 ULT_NEED명 적발로 충전
  ULT_NEED: 3, ULT_SCAN: 1.2, ULT_SCORE: 300, ULT_BROKER_PAUSE: 12,
  ULT_HIDDEN: [3, 4], ULT_HIDDEN_SCORE: 200,   // 11-16 8.16단계: AI 조사 때 들통나는 숨은 브로커 수(3단계·4단계), 한 명 점수(연속일수록 +50씩)
  // 덜어내기 (2026-11-03): 레벨업 카드·세금 저금통(마을 선물)·나르미 데이터 단계 끔. 능력은 혁신제품 지정으로만
  LEVELUP: false, GIFTS: false, DATA_LEVELS: false,
  COMPETE: false,                   // 2026-11-03 경쟁 유지(한 공방에 몰아주면 옆 공방 폐업·독점) 끔: 터치 조작에선 잘 안 보이고 공방이 갑자기 닫혀 헷갈림
  BROKER: true, BROKER_FIRST_AT: 62, BROKER_SPEED: [115, 165], BROKER_GRAB: 1.5, BROKER_REST: 5,   // 2026-11-02 강화: 0:55→0:45, 100~145→115~165, 쉬는 시간 7→5 / 11-03 BROKER_GRAB: 등장 뒤 두리번(알아챌 틈) 1.0→1.5
  TRUST_BROKER: -12, BROKER_BLOCK_SCORE: 150, BROKER_CATCH_BONUS: 300, BROKER_CATCH_TIME: 0.5, BROKER_BLOCK_SEC: 1.0, BROKER_BLOCK_CD: 2.5,   // 달이가 닿으면 브로커 1초 멈칫(검거 아님), 2.5초에 한 번
  REQ_FIRST_AT: 2, REQ_INTERVAL: 6.0, REQ_LIMIT: 35, REQ_EMPTY_FILL: 1,   // 기본값. 실제 구간별 값은 director.js
  COMBO_STEP: 0.1, COMBO_MAX_MULT: 2.0,   // 제때 연속 납품마다 점수 +10%, 최대 ×2
  // 인증제 (2026-11-02): 인증된 공방에서만 구매. 인증은 CERT_SEC초 뒤 만료, 남은 시간이 CERT_RENEW_AT초 이하면 재검증 가능
  CERT_SEC: 55, CERT_START: [30, 55], CERT_RENEW_AT: 25,   // 2026-11-02 바쁨 완화: 40 → 55초
  FAKE_BID_SEC: 25,                 // 수상한 공방을 이 시간 안에 적발 못 하면 '부정 낙찰' (요청 하나 미납)
  DATA_LV: [2, 4, 7],   // 개편: 실사는 새 공방만이라 횟수가 줄어 기준도 낮춤              // 나르미 데이터 성장: 검증 누적 횟수
  STOCK_COST: 0, STOCK_MAX: 3, STOCK_DWELL: 0.5,
  STOCK_BUDGET: 9, MAT_PRICE: 3, MAT_PRICE_FORECAST: 4.5,   // 2026-11-03 실제처럼: 비축 예산으로 원자재를 '쌀 때' 산다. 폭등 예보가 뜨면 시세가 올라 비싸짐
    // 원자재 비축 (2026-11-03 단순화): 가격 폭등 '예보' 동안만, 비축칸에 0.5초마다 1상자, 돈 안 듦
  SURGE: { mult: 1.6 },
  // 계약 연결 시험판 (2026-11-06, 개편안.md 7.0단계): 카드 → 공방을 눌러 체결하면 수레가 자동 납품. false면 옛 조작(달이 이동·구매)
  CONNECT: true,
  CONNECT_SLOTS: [1, 2, 2],   // 공방 단계별(공방·작업장·공장) 동시 납품 수
  DRONE_STRAIGHT: true,   // 11-16 8.20단계: 배송 드론은 공방 → 마을까지 곧게 날아감
  CONNECT_SHIP_SPEED: 170, CONNECT_SHIP_SEC: [3, 5],   // 수레 속도(px/초)와 납품 시간 범위(초)
  CONNECT_BROKER_MIN: 2,   // 브로커는 도착까지 이 초 이상 남은 수레의 계약을 먼저 노림
  CONTRACT_AUTO: 1, CONTRACT_AUTO_DELAY: 0.7,   // 단가계약: 직접 계약하면 같은 물건 다음 1건 자동 체결(값 고정, 어느 마을이든 — 실제 단가계약도 여러 기관이 함께 씀), 카드가 뜨고 0.7초 뒤. 11-16 8.1단계 3 → 2, 8.2단계 2 → 1 (한가하다는 소감). 태풍 긴급 계약은 자동 제외(connect.js)
  CONNECT_BROKER_SPEED: [210, 260], CONNECT_BROKER_GRAB: 1.0,   // (수레 추격일 때) 브로커가 수레를 쫓는 속도(px/초)와 등장 뒤 출발까지
  CONNECT_BROKER_MODE: 'card',   // 11-16 8.5단계: 'card' = 아직 계약 안 한 카드를 노려 그 마을로 걸어감(먼저 계약하거나 브로커를 눌러 막음) / 'ship' = 7.1단계 수레 추격(나오자마자 빼앗아 대처하기 어렵다는 소감)
  CONNECT_CARD_BROKER_SPEED: [110, 150],   // 'card'일 때 걷는 속도(px/초). 화면 끝 → 마을까지 약 3~5초 + 두리번 BROKER_GRAB초
  NEWSHOP_AT: [32, 39, 46, 53, 96],   // 새 공방(달이 실사): 2단계에 4곳(새싹 → 페이퍼컴퍼니 → 섞어서 2곳), 4단계에 1곳. 겉모습은 같고 달이가 실사해 고름 (8.0단계 33·45·96 3곳 → 8.13단계 5곳: '실사를 몇 번 안 한다'는 소감)
  WRONG_FAKE_TRUST: -20, WRONG_FAKE_SCORE: -800, WRONG_SPROUT_TRUST: -5,   // 잘못 고른 실사
  STOCK: false,   // 원자재 비축 (시험판에서 끔). 폭등도 함께 끄려면 EVENTS.surge
  // 사건 켜고 끄기 (false면 그 사건이 아예 일어나지 않음 — 빼고 싶을 때 여기 한 곳만 바꾸면 됨)
  EVENTS: { fake: true, dust: false, storm: true, surge: false },   // 2026-11-03 사건 2개: 태풍(긴급조달) → 원자재 폭등 (미세먼지 뺌)   // 2026-11-03 태풍 위기 구현(기획서 4.2)
  STORM: { limit: 24, mult: 2, every: 6, speed: 0.9 },   // 긴급 계약 제한 시간·점수 배율, 태풍 중 긴급 계약 간격(초), 달이 이동 배율(비)
  // 사건 배치 (2026-11-02, 반쯤 랜덤): 모든 사건이 매 판 한 번씩, 아래 '자리'에 섞어서 배치. 자리 안에서 시작 시점도 흔듦
  EVENT_SLOTS: [[58, 66]],   // 2분·사건 2개 기준 (폭등은 첫 자리에 못 오니 늘 태풍 → 폭등)   // 각 자리의 시작 시점 범위(초)
  EVENT_DUR: { dust: 15, storm: 40, surge: 20 },     // 사건 길이(초). 태풍은 4단계 끝까지(판이 먼저 끝남)
  EVENT_NOT_FIRST: ['surge'],                        // 첫 자리(1:00 무렵)에 오면 안 되는 사건 (비축할 시간이 필요)
  EVENT_FIXED: true,                                 // true면 고정 시점. 11-16 8.0단계: 태풍은 늘 4단계 시작과 함께
  EVENT_FIXED_AT: { dust: 40, storm: 90.5, surge: 82 },
  FORECAST_SEC: 0,                                   // 사건 예보(초 전). 0 = 예보 없음 (11-16: 단계 시작 안내가 대신함, 전에는 15)
  PREP_BONUS: 100, PREP_TRUST: 2,                    // 예보 보고 미리 준비한 물건을 사건 중 납품하면 보너스                             // 원자재 가격 폭등 배율
  GIFT_STEP: 7, GIFT_TRUST: 3, GIFT_SCORE: 100,   // 세금 저금통: 7만원마다 마을 선물
  // 업무 4단계 (2026-11-16, 개편안.md 8.0단계): 한 판을 시간 기준 4단계로 나눔. 단계 이름·목표·사실 문장은 missions.js
  STAGE_AT: [0, 30, 60, 90],   // 각 단계가 시작하는 시각(초). 마지막 단계는 GAME_SECONDS까지
  STAGE_INTRO_SEC: 2.6, STAGE_CARD_SEC: 7,   // 단계 시작 안내 · 끝 카드가 저절로 넘어가는 시간(초, 게임은 멈춤)
  STAGE_ULT_START: 2,   // 3단계(브로커) 시작 때 AI 조사 칸을 이만큼 채워 줌(3칸 중). 30초 안에 한 번은 써 보게: 한 명만 적발하면 충전
  FUTURE: true,   // 11-16 8.13단계: 미래형 바닥(풀밭 → 보도 데크·네모 화단·LED 가로등·화분 나무). false면 예전 풀밭
  TAG_ON_SELECT: true,   // 11-16 8.12단계: 공방 가격표는 카드를 골랐을 때 그 업종 공방에만. false면 늘 보임
  QUIET: true,   // 화면 정보 줄이기: 상단은 시간·단계·점수만, 성장 배너·신뢰/세금 글자·콤보 표시 숨김(값은 그대로 계산)
  GRADE: { S: [20000, 80], A: [13000, 60], B: [6000, 0] },   // 2026-11-03 덜어내기 뒤 2분 기준 (봇 0.7 ≈ 16,000~25,000 · 0.45 ≈ 10,000~19,000)
};
G.FONT = 'Galmuri11';
G.VERSION = 'v8.26 · 업무 4단계';   // 타이틀 왼쪽 아래 표시 (어느 판이 떠 있는지 확인용)
