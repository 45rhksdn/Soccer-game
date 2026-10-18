# 0.14 노마크 마무리 · 드리블 중 시간 흐름

요청: "노마크 오픈 찬스에서의 골 성공률이 너무 낮다" / "드리블 성공 시 내 캐릭터만 움직인다".

## 1. 마무리 (tactical.ts `ODDS.shot`, `ODDS.close`)
- **원인**: 거리별 기본 확률(근거리·중거리·감아차기 범위)은 '압박 없는 득점 확률'로 만든 값이다. 그런데 0.11에서 골키퍼 선방을 따로 곱하면서 가까운 슛도 33%를 한 번 더 깎았다(이중 차감).
- **골키퍼**: 선방 = `0.03 × (거리 − 5m)`, 최대 62%다. 가까울수록 반응할 시간이 없다. 먼 슛은 0.11과 비슷하다(25m에서 60% 대 54%). 골키퍼 능력 보정(±0.24 × (0.5 − 능력))은 그대로다.
- **헤더·발리**: 크로스를 맞히는 슛은 힘과 방향이 약해 최소 33% 선방을 유지한다(`aerialSave`).
- **근거리 기본 상한**: `0.15 + 0.60 × 진행도` → `0.20 + 0.70 × 진행도`.
- **압박·차단**: 막힌 슛은 계속 어렵게 하려고 압박 계수 0.7 → 1.2(최대 0.75 → 0.9), 경로 차단 0.4 → 0.6으로 올렸다. 노마크 슛에는 영향이 없다.
- **AI**: 슈팅 성향(확률 × 7.5)은 그대로다. 이름만 `AI.shotWeight`로 붙였다.

### 근거리·중거리 득점 확률 (정면 y=34, 평균 골키퍼 60, 상대 없음 / 2m 앞 수비)
0.12:

| 거리 | 능력 50 | 능력 70 | 능력 85 | 능력 70 · 측면(y=24) | 능력 70 · 2m 앞 수비 |
|---|---|---|---|---|---|
| r=6 | 50: closeShot 24% | 70: closeShot 30% | 85: closeShot 35% | 70 angle y=24: closeShot 18% | 70 marked 2m front: closeShot 11% |
| r=8 | 50: closeShot 22% | 70: closeShot 27% | 85: closeShot 31% | 70 angle y=24: closeShot 16% curl 15% | 70 marked 2m front: closeShot 10% |
| r=11 | 50: closeShot 18% | 70: closeShot 23% | 85: closeShot 26% | 70 angle y=24: closeShot 13% curl 14% | 70 marked 2m front: closeShot 9% |
| r=14 | 50: closeShot 14% curl 15% | 70: closeShot 18% curl 17% | 85: closeShot 20% curl 19% | 70 angle y=24: closeShot 10% longShot 13% curl 13% | 70 marked 2m front: closeShot 7% curl 7% |
| r=18 | 50: closeShot 9% longShot 13% curl 13% | 70: closeShot 11% longShot 15% curl 15% | 85: closeShot 13% longShot 17% curl 17% | 70 angle y=24: closeShot 6% longShot 11% curl 11% | 70 marked 2m front: closeShot 4% longShot 6% curl 6% |
| r=22 | 50: closeShot 5% longShot 11% curl 11% | 70: closeShot 6% longShot 12% curl 12% | 85: closeShot 6% longShot 14% curl 14% | 70 angle y=24: longShot 9% curl 9% | 70 marked 2m front: closeShot 2% longShot 5% curl 5% |
| r=25 | 50: longShot 9% curl 9% | 70: longShot 11% curl 11% | 85: longShot 12% curl 12% | 70 angle y=24: longShot 8% curl 8% | 70 marked 2m front: longShot 7% curl 7% |

0.14:

| 거리 | 능력 50 | 능력 70 | 능력 85 | 능력 70 · 측면(y=24) | 능력 70 · 2m 앞 수비 |
|---|---|---|---|---|---|
| r=6 | 50: closeShot 41% | 70: closeShot 52% | 85: closeShot 61% | 70 angle y=24: closeShot 27% | 70 marked 2m front: closeShot 8% |
| r=8 | 50: closeShot 35% | 70: closeShot 44% | 85: closeShot 52% | 70 angle y=24: closeShot 24% curl 18% | 70 marked 2m front: closeShot 6% |
| r=11 | 50: closeShot 27% | 70: closeShot 34% | 85: closeShot 40% | 70 angle y=24: closeShot 19% curl 16% | 70 marked 2m front: closeShot 5% |
| r=14 | 50: closeShot 20% curl 18% | 70: closeShot 25% curl 20% | 85: closeShot 29% curl 23% | 70 angle y=24: closeShot 14% longShot 15% curl 15% | 70 marked 2m front: closeShot 4% curl 3% |
| r=18 | 50: closeShot 12% longShot 14% curl 14% | 70: closeShot 15% longShot 16% curl 16% | 85: closeShot 17% longShot 18% curl 18% | 70 angle y=24: closeShot 8% longShot 11% curl 11% | 70 marked 2m front: closeShot 2% longShot 2% curl 2% |
| r=22 | 50: closeShot 6% longShot 10% curl 10% | 70: closeShot 7% longShot 12% curl 12% | 85: closeShot 8% longShot 13% curl 13% | 70 angle y=24: longShot 8% curl 8% | 70 marked 2m front: closeShot 1% longShot 2% curl 2% |
| r=25 | 50: longShot 8% curl 8% | 70: longShot 9% curl 9% | 85: longShot 10% curl 10% | 70 angle y=24: longShot 7% curl 7% | 70 marked 2m front: longShot 3% curl 3% |

## 2. 드리블 중 시간 흐름 (engine.ts `carry`, `moveTeams`)
- `step`의 선수 이동 부분을 `moveTeams`로 떼어 냈다. 동작은 같다.
- 사용자의 드리블이 성공하면 출발점에서 도착점까지 1~3 구간(구간당 3초, 드리블 속도로 계산)에 걸쳐 공을 몰고 간다.
  - 구간마다 시계·점유·체력·출전 시간이 흐르고, 양 팀은 기존 이동 규칙(공격 지원, 침투, 압박, 수비 라인)대로 움직인다.
  - 전반·후반 종료 시각은 넘지 않는다. 난수와 추가 경합은 없다(성공 여부는 이미 판정됐다).
- AI 선수의 드리블은 이미 다음 행동까지 대기(`nextAI`)하는 동안 모두가 움직이므로 바꾸지 않았다.
- 화면(Pitch): 그려지는 위치가 실제 위치를 매 프레임 16%씩 따라가서, 몇 초 분량의 움직임이 미끄러지듯 보인다. 25m 넘게 바뀌면(킥오프) 바로 옮긴다.

## 측정
| | 0.12 | 0.14 |
|---|---|---|
| 표준 300경기 득점 / 슈팅 | 2.67 / 23.5 | 2.61 / 21.2 |
| 시뮬레이션 슈팅당 기대득점 | 0.109 | 0.122 |
| 노마크(4m 안 수비 없음) 슈팅 기대득점 | 0.184 | 0.265 |
| 압박 받은 슈팅 기대득점 | 0.094 | 0.097 |
| 400경기 묶음 득점 / 슈팅 | 4.22 / 31.7 | 4.58 / 28.6 |
| 400경기 묶음 드리블 / 경기 | 17.1 (치고 달리기 5.0) | 13.5 (3.8) |

드리블 수가 줄어든 이유: 사용자 드리블이 시간을 쓰게 되어(성공 1회당 3~9초) 같은 경기 시간 안의 사용자 결정 횟수가 줄었다. 2,000경기 결과는 TEST_REPORT에 있다.

## 계수 조정 과정
1. 골키퍼 곡선과 근거리 상한만 바꿨을 때 표준 4.18골 · 27.2슈팅이었다. 가까운 거리(11m 안) 슈팅이 경기당 12회로 많고, 그 대부분이 압박 받은 슛이었기 때문이다.
2. 압박 0.95, 차단 0.6: 3.19골. AI 슈팅 가중치 6: 3.16골(효과 미미해 7.5로 되돌림). 헤더·발리 선방 유지: 3.13골.
3. 압박 1.2, 최대 0.9: 2.61골 · 21.2슈팅. 노마크 확률은 그대로 유지된다.
