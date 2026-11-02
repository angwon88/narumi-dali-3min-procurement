/* 나르미와 달이의 3분 조달작전 — 수치 상수 (기획서 8장). [초기값]은 플레이테스트로 조정 */
'use strict';
const G = window.G = {};
G.C = {
  VIEW: { w: 960, h: 540 }, HUD_H: 44, DT: 1 / 60,
  GAME_SECONDS: 180, END_HOLD: 1.5,
  DALI_SPEED: 170, NARMI_SPEED: 420, CHAR_SCALE: 0.75,
  INSPECT_TIME: 1.0, INSPECT_COOLDOWN: 3.5,   // 인증제 도입으로 6 → 3.5
  BUY_DWELL: 0.4, BAG_START: 2, BAG_MAX: 4,
  TRUST_START: 50, TRUST_DANGER: 25,
  DELIVER_BASE: 100, TIME_BONUS: 50, SAVING_MULT: 20,
  TRUST_ON_TIME: 4, TRUST_FAST: 6, TRUST_FAIL: -10, TRUST_FRAUD: -15, TRUST_CATCH: 5, CATCH_SCORE: 500, CATCH_BANK: 3, CATCH_STREAK_BONUS: 200,
  PRICE_NORMAL: [0.80, 0.95], PRICE_FAKE: [0.45, 0.55], PRICE_REROLL_SEC: 20,   // 20초마다 행별 가격을 새로 뽑음(싼 쪽이 50% 확률로 바뀜)
  MONOPOLY_MULT: 1.3, STREAK_WARN: 3, STREAK_CLOSE: 5, REOPEN_SEC: 20, REOPEN_FAKE_CHANCE: 0.4,
  FAKE_VANISH_SEC: 3, INNOV_PRICE_MULT: 0.9, INNOV_SCORE_MULT: 1.5, INNOV_TRUST_BONUS: 2,
  INNOV_TRIAL: 3, INNOV_TRIAL_FAIL: 0.25, INNOV_MATURE_MULT: 1.8,   // 혁신제품 시범 사용 3건, '보완 필요' 25%, 성공 판정 뒤 ×1.8
  LEVEL_REQ: [3, 7, 12, 18, 25, 33, 42, 52],
  FINAL_RUSH_AT: 150, FINAL_RUSH_MULT: 1.5,
  STORM: { warnAt: 88, start: 90, end: 110, limit: 18, mult: 2, slow: 0.9 },
  MAX_REQ_PER_VILLAGE: 2, MAX_REQ_TOTAL: 6,
  REQ_FIRST_AT: 2, REQ_INTERVAL: 6.0, REQ_LIMIT: 35, REQ_EMPTY_FILL: 1,   // 기본값. 실제 구간별 값은 director.js
  COMBO_STEP: 0.1, COMBO_MAX_MULT: 2.0,   // 제때 연속 납품마다 점수 +10%, 최대 ×2
  // 인증제 (2026-11-02): 인증된 공방에서만 구매. 인증은 CERT_SEC초 뒤 만료, 남은 시간이 CERT_RENEW_AT초 이하면 재검증 가능
  CERT_SEC: 40, CERT_START: [20, 40], CERT_RENEW_AT: 20,
  FAKE_BID_SEC: 20,                 // 수상한 공방을 이 시간 안에 적발 못 하면 '부정 낙찰' (요청 하나 미납)
  DATA_LV: [3, 6, 10],              // 나르미 데이터 성장: 검증 누적 횟수
  STOCK_COST: 3, STOCK_MAX: 3, STOCK_DWELL: 0.5,   // 원자재 비축: 저금통 3만원 → 1상자
  SURGE: { mult: 1.6 },
  // 사건 켜고 끄기 (false면 그 사건이 아예 일어나지 않음 — 빼고 싶을 때 여기 한 곳만 바꾸면 됨)
  EVENTS: { fake: true, dust: true, storm: false, surge: true },
  // 사건 배치 (2026-11-02, 반쯤 랜덤): 모든 사건이 매 판 한 번씩, 아래 '자리'에 섞어서 배치. 자리 안에서 시작 시점도 흔듦
  EVENT_SLOTS: [[60, 72], [94, 104], [126, 134]],   // 각 자리의 시작 시점 범위(초)
  EVENT_DUR: { dust: 15, storm: 20, surge: 20 },     // 사건 길이(초)
  EVENT_NOT_FIRST: ['surge'],                        // 첫 자리(1:00 무렵)에 오면 안 되는 사건 (비축할 시간이 필요)
  EVENT_FIXED: false,                                // true면 고정 순서 (시연 영상 촬영용)
  EVENT_FIXED_AT: { dust: 65, storm: 97, surge: 125 },
  FORECAST_SEC: 15,                                  // 사건 예보: 시작 15초 전
  PREP_BONUS: 100, PREP_TRUST: 2,                    // 예보 보고 미리 준비한 물건을 사건 중 납품하면 보너스                             // 원자재 가격 폭등 배율
  GIFT_STEP: 7, GIFT_TRUST: 3, GIFT_SCORE: 100,   // 세금 저금통: 7만원마다 마을 선물
  GRADE: { S: [9000, 80], A: [6000, 60], B: [3000, 0] },
};
G.FONT = 'Galmuri11';
