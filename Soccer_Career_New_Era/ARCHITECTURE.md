# v0.7 구조 변경

- `tactical.ts`: 공격/수비 가능 조건, 공통 성공 확률, 거리·인원·패스 경로 평가. UI와 엔진이 동일 함수를 사용한다.
- `MatchInteraction.tsx`: 공 소유/수비/오프볼 상태에 맞는 선택, 방향과 동료 선택. `Pitch.tsx`는 렌더링·클릭 좌표만 처리한다.
- `KoreaMap.tsx`: 독립 제작 SVG와 기존 학교 데이터 연결. 표식은 지역 대표 좌표다.
- `engine.ts`: 전원 이동 목적지를 계산한 뒤 동시에 적용하여 선수 배열 순서에 따른 편향을 줄인다. 공간 탐색 결과는 경기 시간 12초 캐시하며 시드와 저장 상태에 포함한다.
- 저장 v7은 기존 13개 속성 키를 보존하고 7개 속성을 추가한다. v6 가져오기는 기존 슛/패스/수비 값으로 신규 속성을 초기화한다. 경기 이벤트 `goals`와 `goalNoticeSeen`도 함께 저장한다.
- 빠른 시뮬레이션의 여러 골은 실제 득점 이벤트를 한 알림에 모은다. 실제 경기 결과와 독립된 가상 득점은 만들지 않는다.

아래는 이전 구조 기록이며, 충돌 시 위 v0.7 변경이 우선한다.

# Architecture — 0.5.0

React + TypeScript + Vite, Canvas 2D, IndexedDB. 앱의 플레이에는 서버나 외부 AI API가 필요 없다. 원작 코드/리소스를 복제하지 않았다.

## 모듈 경계
| 모듈 | 책임 |
|---|---|
| engine.ts | Match, Footballer, Stat, 고정 tick, 소유권/비행, 공간 평가, 행동 utility, 평점 |
| roles.ts | 포지션별 핵심 능력과 roleAbility |
| world.ts | 영속 Club/RosterPlayer/Coach, 일정·순위, Offer/계약/원장, 연간 세계 변화 |
| career.ts | 사용자 Player, 훈련, 감독 선발과 엔진 연결, 결과 정산, 시즌 종료·은퇴 |
| storage.ts | 검증·v1/v2/v3→v4 migration·체크섬·IndexedDB·백업 |
| Pitch.tsx | 읽기 전용 Canvas 렌더링 |
| App.tsx / WorldPanels.tsx | 입력, 화면, 저장 상태, 시즌·이적·기록 |

## 결정론과 경기
DOM/네트워크/현재 시각/Math.random에 의존하지 않는 엔진이다. Match.seed를 저장하는 uint32 LCG를 사용한다. dt=0.5 고정, 시뮬레이션 1초는 경기 6초. 배속은 동일 tick을 추가 실행하며 빠른 경기 역시 같은 step/act를 호출한다. World는 별도 seed로 경량 경기/시장/연간 변화를 진행한다. 화면 조회는 난수를 소비하지 않는다.

공은 owner 또는 flight 상태다. flight에는 시작/목표 좌표, 수신/발신 슬롯, 진행률, 성공 여부, 슈팅 확률, 유효슈팅 여부를 저장한다. 선택창 확률은 실제 act와 같은 계산을 사용한다. 소유권 변경 시 유효하지 않은 마지막 패스 연결은 해제한다.

선수 상태는 공격/지원/압박/복귀 등 제한된 상태 모델과 utility 점수로 결정된다. 정식 다층 HFSM 전체 구현은 향후 작업이다. Worker는 아직 사용하지 않는다.

## 영속 ID와 교체
월드 선수는 고유 문자열 ID, 경기 선수는 0~21 슬롯 ID를 사용한다. Match.rosterIds가 둘을 연결하고 replacedPlayers가 퇴장한 교체 선수의 통계를 보존한다. 사용자 교체 아웃 시 userFinalStats/userFinalEnergy를 고정하여 후임자의 기록이 사용자에게 섞이지 않는다. userPerformance는 선발·교체·결장을 통일해 정산한다. 실점은 실점 당시 필드에 있던 선수에게 누적한다.

## 세계와 시즌
24개 구단이 4개 리그에 6개씩 배치되고 각 팀에 20명이 있다. 시즌은 홈/원정 10라운드. 플레이 경기 점수는 실제 엔진 결과, 나머지는 팀 능력 기반 경량 Poisson 모델로 생성해 해당 순위표에 누적한다. 사용자 경기가 끝날 때 다른 리그도 같은 라운드를 진행한다.

World.phase는 league→cup→international→national→offseason이며 조건 미충족 대회는 건너뛴다. 사용자 관련 컵은 축약 준결승/결승이고 전체 세계 컵 대진 엔진은 아니다. 시즌 종료에 기록·급여·계약을 정산하고, 다음 시즌에 연령/노화·신인·감독 교체·AI 이적·일정을 갱신한다. 36세 은퇴 이후 기록은 유지한다.

## 시장과 감독
포메이션 슬롯별 포지션 적성·역할 능력·폼·컨디션·감독 전술/선호를 점수화해 명단을 구성한다. 교체 계획은 60분 투입/저체력 선발 65분 아웃의 기본 규칙이다. 부상자는 결장한다.

오퍼는 포지션 수요·나이·능력·잠재력 추정·예산에 기반한다. 수락 시 이적료를 매수 구단에서 차감하고 매도 구단에 더한 뒤 소속/계약을 함께 변경한다. 한 번의 15% 연봉 협상을 지원한다. AI 이적은 약한 자리의 선수 교환과 이적료 원장으로 구현한다. NPC 급여 전체 회계는 미구현이다.

## 저장 경계와 호환
Career.version=4. Player, World, Match(진행 중 포함), Result[], 성장 로그를 한 스냅샷으로 보존한다. IndexedDB `soccer-career-new-era`의 `saves`에 slot1..3, backup1..3, activeSlot을 저장한다. 직렬 쓰기 큐와 단일 트랜잭션으로 슬롯/백업/활성 슬롯을 변경하며 성공 완료 이후 저장 완료를 표시한다.

JSON envelope는 SCNE 형식, FNV 체크섬, payload다. 체크섬은 손상 검출이며 보안 서명이 아니다. v1→v2는 누락 성장/피드 필드, v2→v3는 가상 세계를 생성한다. 기존 선수/기록/진행 중 경기는 보존한다. 과거 친선 결과를 가짜 리그 기록으로 전환하지 않는다. 새 평점은 이후 경기부터 적용하며 과거 확정 평점을 다시 쓰지 않는다.

## 이후 확장
engine/match, engine/world, engine/market와 repositories 분리, LocalSaveRepository/FutureRemoteRepository 계약, 입력 replay와 엔진 버전, Worker tickBatch, 이벤트 기반 전술·대회·계약 처리로 확장한다. 현재 로컬 저장 API는 storage.ts 경계에 있어 UI/엔진과 별도로 서버 저장을 추가할 수 있으나 서버 구현은 아직 없다.

## 0.2.1 경기 변경
패스 비행 중 가상 공격 기준점은 패스 목표 좌표와 발신 팀으로 구성한다. 실제 소유권이나 결정 이벤트를 바꾸지 않고 전술 이동에만 사용한다. CM 지원은 공격 방향 좌표로 계산하므로 양 진영에 동일하게 적용된다. 타깃 선정에는 오프사이드와 수신 위치의 슈팅 품질을 반영한다. 슈팅 품질은 골문 중심선까지의 수비수 거리를 추가 평가하며 동일 함수가 선택 UI와 실제 결과에 사용된다. 기존 저장 스키마는 그대로다.

## 0.3 주간 진행과 라이벌
Development에는 trait, wallet, 마지막 plan[7], active(시작일·cursor·성장 전 스냅샷·경기 완료 여부), 주간 notes, 날짜별 news, rival, interestIds를 저장한다. prepareWeek→advanceSchedule은 경기일 전까지 순차 처리하고 Match를 생성한 상태로 멈춘다. settle은 기록을 한 번 반영한 뒤 남은 일정을 실행한다. 주/날짜는 전체 일정 완료 시 증가하며, 진행 도중 저장/복원해도 이미 소비한 훈련·이벤트 RNG를 다시 실행하지 않는다.

라이벌은 career-rival 고정 ID로 실제 구단 로스터에 등록한다. 일반 NPC 자동 은퇴/교환에서 제외하고 별도로 사용자의 나이와 함께 나이를 올린다. 훈련은 동일한 7일 플랜에 자신의 능력·피로·특성을 적용한다. 직접 맞붙거나 같은 팀에서 출전하면 동일 Match 통계를 사용하고, 다른 리그 경기는 순수 엔진으로 진행해 해당 fixture 결과에도 반영한다. 사용자 상대팀의 라이벌이 벤치면 가상의 별도 경기를 만들지 않는다. 컵 주간의 독립적인 라이벌 컵 대진은 미구현이며 이때도 훈련은 계속한다.

Match.insight와 rivalInsight는 발동률, 능력별 누적 영구 증가, 경기 중 이벤트를 보존한다. 경기 안에서는 즉시 증가, 영구 능력은 settle에서 한 번 반영한다. 실전파는 경기 슬롯/교체 대기 복사본에만 ×1.3을 적용하며 영구 능력에 덮어쓰지 않는다.

World.currentDay와 Offer.issuedDay/expiresDay가 만료 기준이다. 관심 ID는 졸업 가능한 시즌까지 보존하고 제안 생성에 강제 포함한다. 연봉/이적료는 예산 내에서 구성한다. 협상과 수락 직전에도 만료를 검사한다. 비시즌에도 일정으로 날짜를 진행할 수 있고, 만료 후 재구직 경로로 진행 불능을 방지한다.

## 0.4 특성·고교 발굴·선수 변경하기
`traits.ts`가 특성 데이터 표와 효과 계층을 소유한다. 게임 로직은 `trainingGrowthMultiplier`, `trainingFatigueMultiplier`, `injuryChanceMultiplier`, `injuryWeeks`, `luckChance`, `matchAttributes`, `agingDecline`만 호출하므로 새 특성은 표에 추가하면 된다(새 효과 종류만 코드 추가). 경기 효과는 `configureTrait`에서 경기 사본 능력치에만 적용한다. 사용자·라이벌의 실전파 판정은 기존처럼 커리어 RNG를 쓰고(특성이 없으면 난수 소비 순서가 0.3과 같다), NPC는 `seedFrom(시드, id)` 해시 RNG를 써서 커리어·월드 RNG를 흔들지 않는다.

`schools.ts`는 실제 학교 카탈로그(불변 id·시·도·출처), `scouting.ts`는 `seedFrom(스카우트 시드, 학교#목록)`으로 후보를 만든다. 후보 선택은 `newCareer(..., preset)`으로 능력치·잠재력·특성·`schoolRef`를 넘긴다. `school`(0~2)은 가상 리그 구조의 슬롯으로 유지되어 기존 저장·월드 생성과 호환된다.

저장은 v5. `validate()`가 v1→v2→v3→v4→v5를 차례로 적용한다. 슬롯 외에 `archive{n}`(교체 전 선수)과 `scouting`을 같은 store에 둔다. `save()`는 내용이 같으면 쓰지 않고, 읽을 수 있는 이전 슬롯만 `backup{n}`으로 옮긴다.

## 0.5 규칙·장비·은퇴 보상
- `aging.ts`가 나이 모델을 소유한다: `growthAgeFactor`(career `grow()` 기본값), `experienceAgeFactor`(settle의 경기 경험 성장), `applyAging`/`agingLoss`(주인공·라이벌 연 1회, NPC는 `advanceWorldYear`), `npcGrowthRate`. 계수 변경은 이 파일만 고치면 된다.
- 확률: `insightChance`(경기 엔진 `Insight.chance`), `trainingLuckChance(traits, age)`(applyDaily). 엔진 `insightAttempt`는 `Insight.base`가 있으면 기본 능력치+누적 깨달음으로 100 한도를 판단한다(경기 사본 능력치는 장비·특성 포함).
- `equipment.ts`: `player.a`는 항상 기본 능력치. 경기 진입 지점(`selection` 영웅 능력치, `createMatch`, `benchEntry`, `configureTrait`의 특성 적용 기준)만 `matchAttributesOf(c)`를 쓴다. 장비 변경은 경기 중 금지.
- `legacy.ts` + `storage.claimRetirement`: 은퇴한 커리어를 `legacy` 키에 id 기준으로 한 번 기록(읽기·쓰기 단일 readwrite 트랜잭션). App은 은퇴 상태 커리어를 볼 때마다 호출(멱등). `potentialBonus(legacy)`를 `generateCandidates(..., bonus)`와 `newCareer(..., {potentialBonus})`에 넘긴다 — 같은 난수에서 상한 쪽만 넓어져 다른 필드는 그대로.
- NPC 부상(`world.ts`): `npcInjuryWeek`(finishWeek에서 주 1회), `matchInjury`(상세 경기 후, NPC·라이벌), `available()`로 라인업 제외. 모두 `seedFrom` 해시 난수라 월드·커리어 RNG를 소비하지 않는다.
- 저장 v6: `migrateV5`가 `Career.id`를 생성 시 고정값으로 만든다. `deleteSlot(n)`은 `slotN`·`backupN`만 지운다.
