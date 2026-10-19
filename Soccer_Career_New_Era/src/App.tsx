import {OriginPanel} from './OriginPanel';
import {MatchInteraction} from "./MatchInteraction";
import {traitNotice} from './traitPresentation';
import {GrowthNotes,RivalPanel} from './WeeklyPanels';
import {MissionResult,SignaturePanel,RivalCompare} from './EngagementPanels';
import {headlines} from './engagement';
import {TraitList} from './TraitBadges';
import {ScoutPanel} from './ScoutPanel';
import {PlayerSlots} from './PlayerSlots';
import {TodayPanel} from './TodayPanel';
import {playToday,startTodayMatch,matchDayIndex,WEEKDAYS,LUCKY_NEWS,INSIGHT_NEWS,type TodayResult} from './development';
import {GrowthPopup,type PopupInfo} from './GrowthPopup';
import {EquipmentPanel} from './EquipmentPanel';
import {buyEquipment,equip,unequip,equipmentBonus} from './equipment';
import {careerFromCandidate,newScoutState,nextList,type ScoutState} from './scouting';
import {potentialBonus,type Legacy} from './legacy';
import {WorldPanel} from './WorldPanels';
import {teamName,competitionName,selection,statusOf,STATUS} from './career';
import {clubOf} from './world';
import {roleAbility} from './roles';
import {userPerformance,defend,tackleChance,DEFENSE_ACTIONS,type DefenseAction} from './engine';
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  Download,
  Dumbbell,
  Flag,
  FolderHeart,
  Home,
  Menu,
  Pause,
  Play,
  Plus,
  Shield,
  Target,
  Trophy,
  Upload,
  User,
  Users,
  Volume2,
  Zap,
} from "lucide-react";
import {
  ACTIONS,
  ATTRS,
  LABELS,
  actionChance,
  act,
  availableActions,
  finishMatch,
  rating,
  step,
  type Position,
} from "./engine";
import {
  SCHOOLS,
  dateOf,
  newCareer,
  opponentOf,
  settle,
  type Career,
  type Player,
} from "./career";
import * as storage from "./storage";
import { Pitch } from "./Pitch";
type Tab = "home" | "training" | "player" | "records" | "saves" | "players" | "team" | "season" | "market" | "career" | "rival";
export default function App() {
  const matchAnimating=useRef(false);
  const [c, setC] = useState<Career | null>(null),
    [tab, setTab] = useState<Tab>("home"),
    [creating, setCreating] = useState(false),
    [slot, setSlot] = useState(1),
    [saved, setSaved] = useState("로컬 저장"),
    [notice, setNotice] = useState(""),
    [slots, setSlots] = useState<Awaited<ReturnType<typeof storage.slots>>>([]),
    [ready, setReady] = useState(false),
    [paused, setPaused] = useState(false),
    [speed, setSpeed] = useState(1),
    [tick, setTick] = useState(0),
    [menu, setMenu] = useState(false),
    [createMode, setCreateMode] = useState<"scout" | "manual">("scout"),
    [targetSlot, setTargetSlot] = useState(1),
    [scout, setScout] = useState<ScoutState | null>(null),
    [scoutSchool, setScoutSchool] = useState<string | null>(null),
    [today, setToday] = useState<TodayResult | null>(null),
    [popup, setPopup] = useState<PopupInfo | null>(null),
    [legacy, setLegacy] = useState<Legacy | null>(null);
  // 깨달음 popup: compare the user's insight events of the current match with what was already shown.
  const insightSeen = useRef({ key: "", count: 0 });
  useEffect(() => {
    const key = c?.match ? `${c.seed}:${c.week}` : "",
      count = c?.match?.insight?.events.length ?? 0;
    if (key !== insightSeen.current.key) { insightSeen.current = { key, count }; return; }
    if (count <= insightSeen.current.count || popup) return;
    insightSeen.current.count = count;
    setPopup({ kind: "insight", text: INSIGHT_NEWS, resume: !paused && !c!.match!.ended });
    setPaused(true);
  });
  // Keep acknowledgements outside mutable match snapshots as well: initial
  // StrictMode loads and restoring a cloned state must not reopen a dismissed goal.
  const goalSeen = useRef({ key: "", id: 0 });
  useEffect(() => {
    const m = c?.match;
    if (!m || popup) return;
    const key = `${c.id ?? c.seed}:${c.world.year}:${c.week}`;
    if (goalSeen.current.key !== key) goalSeen.current = { key, id: 0 };
    const seen = Math.max(m.goalNoticeSeen ?? 0, goalSeen.current.id);
    m.goalNoticeSeen = seen;
    const goals = m.goals?.filter(g => g.id > seen) ?? [];
    if (!goals.length) return;
    const last = Math.max(...goals.map(g => g.id));
    goalSeen.current.id = last;
    m.goalNoticeSeen = last;
    setPopup({ kind: 'goal', text: goals.map(goal =>
      `${goal.scorer} 골!\n${goal.assister ? `${goal.assister} 도움` : '도움 없음'}`
    ).join('\n\n'), resume: !paused && !m.ended });
    setPaused(true);
  });
  const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
  /** A new id for every newly created player (retirement rewards are granted once per id). */
  const freshId = () => `p-${Date.now().toString(36)}-${freshSeed().toString(36)}`;
  useEffect(() => {
    storage.loadLegacy().then(setLegacy).catch(() => {});
  }, []);
  // A retired career is recorded once in the shared progress (idempotent: reloads, restores and switches are safe).
  useEffect(() => {
    if (!c || c.world.phase !== "retired" || !c.id) return;
    storage
      .claimRetirement(c)
      .then((r) => {
        setLegacy(r.legacy);
        if (r.rewarded) inform(`은퇴 누적 보상 · 새 선수 후보의 잠재력 최대 상한이 +${potentialBonus(r.legacy)}(으)로 올랐습니다.`);
      })
      .catch(() => {});
  }, [c?.id, c?.world.phase]);
  useEffect(() => {
    storage
      .loadScouting()
      .then((s) => s ?? newScoutState(freshSeed()))
      .catch(() => newScoutState(freshSeed()))
      .then((s) => {
        setScout(s);
        storage.saveScouting(s).catch(() => {});
      });
  }, []);
  const live = useRef(c);
  live.current = c;
  const currentSlot = useRef(slot);
  currentSlot.current = slot;
  useEffect(() => {
    // The live match scrolls its own board into view (MatchInteraction).
    if (!(c?.match && tab === "home")) window.scrollTo(0, 0);
  }, [tab, creating, !!c?.match]);
  const inform = (s: string) => {
    setNotice(s);
  };
  const saveRevision = useRef(0);
  async function persist(state: Career, target = slot) {
    const revision = ++saveRevision.current;
    setSaved("저장 중…");
    try {
      await storage.save(target, state);
      if (revision === saveRevision.current) setSaved("저장 완료");
    } catch (e) {
      if (revision !== saveRevision.current) return;
      setSaved("저장 실패");
      inform(
        "저장에 실패했습니다. 저장 관리에서 JSON 파일을 내보내 주세요. " +
          String(e),
      );
    }
  }
  useEffect(() => {
    storage.slots().then(setSlots);
    storage
      .activeSlot()
      .then(async (n) => {
        setSlot(n);
        return storage.load(n);
      })
      .then((value) => {
        setC(value);
        setReady(true);
      })
      .catch(() => {
        inform(
          "자동 저장을 읽을 수 없습니다. 저장 관리에서 백업 복원을 선택해 주세요.",
        );
        setReady(true);
      });
  }, []);
  useEffect(() => {
    if (c) persist(c);
  }, [c]);
  useEffect(() => {
    const timer = setInterval(() => {
      const state = live.current;
      if (state) persist(state, currentSlot.current);
    }, 5000);
    const visibility = () => {
      if (document.hidden && live.current)
        persist(live.current, currentSlot.current);
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (!c?.match || c.match.ended || paused) return;
    const interval = setInterval(() => {
      const m = live.current?.match;
      if (!m || m.ended || m.decision || m.defending || matchAnimating.current) return;
      const goals=m.goals?.length??0,insights=m.insight?.events.length??0;
      for (let i = 0; i < speed; i++) {
        step(m, 0.5);
        if (m.decision || m.defending || m.ended || (m.goals?.length??0)>goals || (m.insight?.events.length??0)>insights) break;
      }
      setTick((v) => v + 1);
      if (m.decision || m.defending || m.ended) persist(live.current!, currentSlot.current);
    }, 50);
    return () => clearInterval(interval);
  }, [c?.match, paused, speed]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 7000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const update = (fn: (n: Career) => void) => {
    if (!c) return;
    try {
      const n = structuredClone(c);
      fn(n);
      ++saveRevision.current;
      setSaved("저장 중…");
      if(n.match&&!c.match){setPaused(false);setTab("home");}
      setC(n);
    } catch (e) {
      inform((e as Error).message);
    }
  };
  const nav = [
    { id: "home", label: "커리어 홈", icon: Home },
    { id: "player", label: "내 선수", icon: User },
    { id: "training", label: "오늘의 일정", icon: Dumbbell },
    { id: "records", label: "경기 기록", icon: ChartNoAxesCombined },
    { id: "rival", label: "라이벌", icon: User },
    { id: "team", label: "팀 · 주전 경쟁", icon: Shield },
    { id: "season", label: "시즌 · 리그", icon: Trophy },
    { id: "market", label: "이적 · 계약", icon: Flag },
    { id: "career", label: "커리어 · 업적", icon: CalendarDays },
    { id: "players", label: "선수 변경하기", icon: Users },
    { id: "saves", label: "저장 관리", icon: FolderHeart },
  ] as const;
  function go(t: Tab) {
    setTab(t);
    setMenu(false);
    if (t === "saves" || t === "players") storage.slots().then(setSlots);
  }
  async function openSlot(n: number, backup = false) {
    try {
      const value = await storage.load(n, backup);
      if (!value) {
        inform("이 슬롯은 비어 있습니다.");
        return;
      }
      setSlot(n);
      setC(value);
      setToday(null);
      setCreating(false);
      setTab("home");
      inform(backup ? "직전 백업을 복원했습니다." : "커리어를 불러왔습니다.");
    } catch (e) {
      inform(String(e));
    }
  }
  function exportSave() {
    if (!c) return;
    const blob = new Blob([storage.encode(c)], { type: "application/json" }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `SoccerCareer-${c.player.name}-week${c.week + 1}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importSave(file: File | undefined) {
    if (!file) return;
    try {
      const next = storage.decode(await file.text());
      await storage.save(slot, next);
      setC(next);
      setCreating(false);
      inform("저장 파일을 가져왔습니다.");
    } catch (e) {
      inform(String(e));
    }
  }
  /** Starts the creation flow for an explicit slot; occupied slots need confirmation. */
  function startNew(n: number) {
    const s = slots.find((x) => x.slot === n);
    if (
      s?.summary &&
      !confirm(
        `슬롯 ${n}의 ${s.summary.name} 선수를 새 선수로 교체할까요? 기존 선수는 ‘교체 전 선수’로 보관되어 복원할 수 있습니다.`,
      )
    )
      return;
    setTargetSlot(n);
    setCreateMode("scout");
    setCreating(true);
    setMenu(false);
  }
  /** Saves the current player, archives an occupied target slot, then starts the new career there. */
  async function beginCareer(next: Career) {
    const target = targetSlot;
    try {
      if (c) await persist(c, slot);
      await storage.archiveSlot(target);
    } catch (e) {
      inform(String(e));
      return;
    }
    setSlot(target);
    setC(next);
    setCreating(false);
    setScoutSchool(null);
    setTab("home");
    inform(`입단을 축하합니다. 슬롯 ${target}에 저장됩니다. 이번주 일정을 정해 보세요.`);
  }
  async function switchTo(n: number) {
    if (c) await persist(c, slot);
    await openSlot(n);
    storage.slots().then(setSlots);
  }
  /** Deletes the player of slot n (and its backup) after confirmation; the archive and retirement record stay. */
  async function deleteSlotPlayer(n: number) {
    const s = slots.find((x) => x.slot === n), name = s?.summary?.name ?? "손상된 저장";
    if (!confirm(`슬롯 ${n}의 ${name}을(를) 삭제할까요? 이 슬롯의 선수와 자동 백업이 지워지며 되돌릴 수 없습니다. (교체 전 선수와 은퇴 기록은 유지됩니다)`)) return;
    try {
      const active = !!c && n === slot;
      if (active) { live.current = null; setC(null); setToday(null); }
      else if (c) await persist(c, slot);
      await storage.deleteSlot(n);
      if (active) {
        const rest = (await storage.slots()).find((x) => x.slot !== n && x.summary);
        if (rest) await openSlot(rest.slot); else { setCreating(true); setTargetSlot(n); }
      }
      inform(`슬롯 ${n}의 ${name}을(를) 삭제했습니다.`);
    } catch (e) {
      inform(String(e));
    }
    storage.slots().then(setSlots);
  }
  async function restoreArchive(n: number) {
    if (!confirm(`슬롯 ${n}의 교체 전 선수를 복원할까요? 지금 슬롯 ${n}에 있는 선수는 대신 보관됩니다.`)) return;
    try {
      if (c) await persist(c, slot);
      await storage.swapArchive(n);
      await openSlot(n);
      inform("교체 전 선수를 복원했습니다. 바뀐 선수는 다시 보관되었습니다.");
    } catch (e) {
      inform(String(e));
    }
    storage.slots().then(setSlots);
  }
  if (!ready)
    return (
      <div className="loading">
        SC<span>커리어를 불러오는 중…</span>
      </div>
    );
  const p = c?.player,
    m = c?.match;
  return (
    <div className="app">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <div className="brand-icon">
            SC<span>↗</span>
          </div>
          <div>
            SOCCER CAREER<small>NEW ERA</small>
          </div>
        </a>
        <div className="nav-label">YOUR JOURNEY</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {tab === n.id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-season">
          <div className="mini-pitch">
            <Flag size={24} />
          </div>
          <small>첫 번째 챕터</small>
          <strong>꿈은 여기서 시작된다.</strong>
          <p>고교 무대에서, 더 큰 세상으로.</p>
          <span>CHAPTER 01 / HIGH SCHOOL</span>
        </div>
        <div className="version">
          <span className="dot" /> 오프라인 플레이 지원
          <small>0.15 · 35주 시즌 · 고교 전국대회</small>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <button
            className="mobile-menu icon-button"
            onClick={() => setMenu(!menu)}
            aria-label="메뉴"
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            커리어 <ChevronRight size={14} />
            <strong>{nav.find((n) => n.id === tab)?.label}</strong>
          </div>
          <div className="header-right">
            <span className="save-state">
              <span className="dot" />
              {saved}
            </span>
            <span className="avatar">{p?.name.slice(0, 1) || "SC"}</span>
          </div>
        </header>
        <main>
          {popup && <GrowthPopup info={popup} onClose={() => {
            if (popup.kind === "goal" && c?.match) {
              c.match.goalNoticeSeen = Math.max(c.match.goalNoticeSeen ?? 0, goalSeen.current.id);
              void persist(c);
            }
            if (popup.resume) setPaused(false);
            setPopup(null);
          }} />}
          {notice && (
            <div className="toast" role="status">
              {notice}
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
          {creating ? (
            <>
              <div className="create-mode" role="tablist" aria-label="선수 생성 방식">
                <button role="tab" type="button" aria-selected={createMode === "scout"} className={createMode === "scout" ? "selected" : ""} onClick={() => setCreateMode("scout")}>실제 고교에서 발굴</button>
                <button role="tab" type="button" aria-selected={createMode === "manual"} className={createMode === "manual" ? "selected" : ""} onClick={() => setCreateMode("manual")}>직접 만들기</button>
                <span className="muted">저장 위치 · 슬롯 {targetSlot}</span>
              </div>
              {createMode === "scout" ? (
                <>
                  <Heading
                    eyebrow="SCOUTING / 01"
                    title="실제 고교 축구부에서 시작하세요."
                    text="지역과 학교, 희망 포지션을 고르면 그 자리에서 뛰는 학생 한 명을 만납니다. 그의 이야기와 특성, 가능성을 보고 함께할지 정하세요."
                  />
                  {scout ? (
                    <ScoutPanel
                      scout={scout}
                      potentialBonus={potentialBonus(legacy)}
                      legacy={legacy}
                      school={scoutSchool}
                      setSchool={setScoutSchool}
                      onReroll={(id) => {
                        const n = nextList(scout, id);
                        setScout(n);
                        storage.saveScouting(n).catch((e) => inform(String(e)));
                      }}
                      onPick={(cand) => beginCareer(careerFromCandidate(cand, scout.seed, undefined, freshId()))}
                    />
                  ) : (
                    <div className="note">스카우트 정보를 불러오는 중…</div>
                  )}
                  <button className="text-button" type="button" onClick={() => setCreating(false)}>돌아가기</button>
                </>
              ) : (
                <Create
                  onCancel={() => setCreating(false)}
                  onCreate={(player, school) => beginCareer(newCareer(player, school, freshSeed(), { id: freshId(), potentialBonus: potentialBonus(legacy) }))}
                />
              )}
            </>
          ) : !c && tab !== "saves" && tab !== "players" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">THE NEXT CHAPTER IS YOURS</div>
                  <h1>당신의 축구가 시작되는 곳.</h1>
                  <p>이름 없는 유망주에서, 잊히지 않을 선수로.</p>
                </div>
                <span className="pill">
                  <span className="dot" /> SINGLE PLAYER
                </span>
              </div>
              <section className="welcome">
                <div className="welcome-copy">
                  <span className="tag light">SOCCER CAREER — NEW ERA</span>
                  <h2>
                    작은 운동장.
                    <br />
                    커다란 가능성.
                  </h2>
                  <p>
                    한 번의 패스, 한 번의 선택.
                    <br />
                    당신만의 축구 인생을 만들어 가세요.
                  </p>
                  <button
                    className="primary cream"
                    onClick={() => startNew(slot)}
                  >
                    새로운 커리어 시작 <ArrowRight size={18} />
                  </button>
                  <small>실제 고교 축구부 · 가상의 선수 · 22인 경기 · 나만의 선수 육성</small>
                </div>
                <div className="welcome-pitch">
                  <Pitch ambient />
                  <span className="pitch-caption">
                    YOUR FIRST SEASON / 2026
                  </span>
                </div>
              </section>
              <div className="intro-grid">
                {[
                  {
                    n: "01",
                    icon: User,
                    title: "나만의 선수",
                    text: "포지션과 플레이 스타일을 정하고 고교 축구부에 입단하세요.",
                  },
                  {
                    n: "02",
                    icon: Dumbbell,
                    title: "매일 조금 더 강하게",
                    text: "훈련과 회복의 균형. 당신의 선택이 선수를 바꿉니다.",
                  },
                  {
                    n: "03",
                    icon: Target,
                    title: "결정적인 순간의 선택",
                    text: "실시간 경기를 관전하고 공을 받으면 직접 판단하세요.",
                  },
                ].map((x) => (
                  <article className="card intro" key={x.n}>
                    <div className="intro-top">
                      <x.icon />
                      <span>{x.n}</span>
                    </div>
                    <h3>{x.title}</h3>
                    <p>{x.text}</p>
                  </article>
                ))}
              </div>
              <div className="note">
                <Shield size={16} /> 독립적으로 제작한 축구 커리어 게임입니다.
                고교부터 프로·해외·국가대표까지 진행하는 커리어 베타입니다. 대회와 이적은 축약된 규칙을 사용합니다.
              </div>
            </>
          ) : (
            <>
              {m && tab === "home" ? (
                <>
                  <div className="page-heading">
                    <div className="eyebrow">
                      MATCHDAY LIVE · {dateOf(c!.development.active?c!.day:c!.week * 7 + 5)}
                    </div>
                    <span className="pill">{competitionName(c!)} · {clubOf(c!.world).coach.formation}</span>
                  </div>
                  <section className="match-board">
                    <div className="scoreboard">
                      <div>
                        <Shield size={30} />
                        <strong>{teamName(c!)}</strong>
                        <small>HOME</small>
                      </div>
                      <div className="score">
                        <span>{m.score[0]}</span>
                        <i>:</i>
                        <span>{m.score[1]}</span>
                        <small>
                          {m.ended
                            ? "FULL TIME"
                            : `${Math.floor(m.clock / 60)}′ ${m.half === 1 ? "전반" : "후반"}`}
                        </small>
                      </div>
                      <div>
                        <Shield size={30} />
                        <strong>{opponentOf(c!)}</strong>
                        <small>AWAY</small>
                      </div>
                    </div>
                    <MatchInteraction m={m} onAnimating={busy=>{matchAnimating.current=busy;}} onChange={()=>{setTick(v=>v+1);persist(c!);}} toolbar={
                    <div className="match-toolbar">
                      <button
                        className="secondary"
                        onClick={() => setPaused(!paused)}
                        disabled={m.ended}
                      >
                        {paused ? <Play size={16} /> : <Pause size={16} />}{" "}
                        {paused ? "계속" : "일시정지"}
                      </button>
                      <div className="speeds">
                        {[1, 2].map((v) => (
                          <button
                            className={speed === v ? "selected" : ""}
                            onClick={() => setSpeed(v)}
                            key={v}
                          >
                            {v}×
                          </button>
                        ))}
                      </div>
                      <button
                        className="text-button"
                        disabled={m.ended}
                        onClick={() => {
                          finishMatch(m);
                          setTick(tick + 1);
                          persist(c!);
                        }}
                      >
                        빠른 시뮬레이션 <ArrowRight size={16} />
                      </button>
                    </div>
                    }/>
                  </section>
                  {m.userOnPitch===false&&!m.ended&&<div className="note">{m.benchEntry?`벤치 대기 · ${m.benchEntry.minute}분 교체 투입 예정`:m.userFinalStats?"교체 아웃 · 남은 경기를 관전합니다.":"이번 경기는 결장입니다. 경기를 관전하거나 빠르게 진행할 수 있습니다."}</div>}
                  {m.ended ? (
                    <section className="card result">
                      <div>
                        <span className="eyebrow">FULL TIME REPORT</span>
                        <h2>오늘의 플레이가 내일의 실력이 됩니다.</h2>
                        <p>
                          {p!.name} · 슈팅 {userPerformance(m).stats.shots} ·
                          골 {userPerformance(m).stats.goals} · 도움{" "}
                          {userPerformance(m).stats.assists} · 드리블 성공{" "}
                          {userPerformance(m).stats.dribbles ?? 0}
                        </p>
                        <p>가로채기 {userPerformance(m).stats.interceptions} · 태클 성공 {userPerformance(m).stats.tackles} · 볼 경합 {userPerformance(m).stats.duelAttempts??0}회 · 결정적 수비 {userPerformance(m).stats.decisiveDefenses??0}</p>
                        <p>패스 {userPerformance(m).stats.completed}/{userPerformance(m).stats.passes} · 전진 패스 {userPerformance(m).stats.progressivePasses ?? 0} · 키패스 {userPerformance(m).stats.keyPasses ?? 0} · 기대 도움 {(userPerformance(m).stats.expectedAssists ?? 0).toFixed(2)}</p>
                        <MissionResult m={m}/>
                        {(m.traitNotes??(m.traitBoost?['실전파 발동! 오늘은 몸놀림이 남다릅니다.']:[])).map((t)=><p key={t} className="note">{traitNotice(t)}</p>)}
                        <small className="muted">키패스는 동료의 슈팅으로 연결한 패스입니다. 동료가 놓쳐도 평점에 반영됩니다.</small>
                      </div>
                      <div className="rating">
                        {(userPerformance(m).stats.minutes>0?rating(userPerformance(m)).toFixed(1):"—")}
                        <small>경기 평점</small>
                      </div>
                      <button
                        className="primary"
                        onClick={() => {
                          // The season ends inside settle (last league/cup/national match): go straight to the season summary.
                          let seasonEnded = false, earned: string[] = [];
                          update((n) => { const was = n.world.phase; earned = settle(n).signatures.map((s) => `「${s.id}」\n${s.effect}`); seasonEnded = was !== "offseason" && n.world.phase === "offseason"; });
                          if (earned.length) setPopup({ kind: "signature", text: earned.join("\n\n") });
                          setTab(seasonEnded ? "season" : "home");
                          if (seasonEnded) inform("시즌이 끝났습니다. 시즌 결산을 확인하세요.");
                          setPaused(false);
                          setToday(null);
                        }}
                      >
                        {c?.development.active?.mode === "daily" ? "결과 반영" : "결과 반영 · 남은 일정 진행"} <ArrowRight size={17} />
                      </button>
                    </section>
                  ) : (
                    null
                  )}
                  <div className="two-col">
                    <section className="card">
                      <div className="section-title">
                        <h3>경기 기록</h3>
                        <Activity size={18} />
                      </div>
                      {[
                        ["슈팅", m.shots[0], m.shots[1]],
                        ["드리블 성공", ...([0, 1] as const).map((t) => m.players.filter((q) => q.team === t).reduce((n, q) => n + (q.stats.dribbles ?? 0), 0))],
                        ["기대 득점", m.xg[0].toFixed(2), m.xg[1].toFixed(2)],
                        [
                          "점유율",
                          Math.round(
                            (m.possession[0] /
                              (m.possession.reduce((a, b) => a + b, 0) || 1)) *
                              100,
                          ) + "%",
                          Math.round(
                            (m.possession[1] /
                              (m.possession.reduce((a, b) => a + b, 0) || 1)) *
                              100,
                          ) + "%",
                        ],
                      ].map(([k, a, b]) => (
                        <div className="stat-row" key={k}>
                          <b>{a}</b>
                          <span>{k}</span>
                          <b>{b}</b>
                        </div>
                      ))}
                    </section>
                    <section className="card">
                      <div className="section-title">
                        <h3>터치라인</h3>
                        <Volume2 size={18} />
                      </div>
                      <div className="commentary" aria-live="polite">
                        {m.log
                          .slice(-5)
                          .reverse()
                          .map((e, i) => (
                            <p key={i}>
                              <time>{Math.floor(e.time / 60)}′</time>
                              {e.text}
                            </p>
                          ))}
                      </div>
                    </section>
                  </div>
                </>
              ) : tab === "home" && c ? (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        SEASON {c.world.year} / WEEK {String(c.week + 1).padStart(2, "0")}
                      </div>
                    </div>
                    <span className="date">
                      <CalendarDays size={17} />
                      {dateOf(c.day).replaceAll("-", ". ")}
                    </span>
                  </div>
                  <section className="career-hero">
                    <div>
                      <span className="tag light">
                        {competitionName(c)}
                      </span>
                      <h2>지난주 주요 뉴스</h2>
                      <div className="headline-news">{headlines(c).map((n,i)=><p key={i}>{traitNotice(n.text)}</p>)}{!headlines(c).length&&<p>새로운 한 주의 활약을 기다리고 있습니다.</p>}</div>
                    </div>
                    <div className="hero-number">
                      10
                      <span>
                        {p!.pos} / {p!.name}
                      </span>
                    </div>
                    <div className="hero-pattern" />
                  </section>
                  <TodayPanel
                    c={c}
                    last={today}
                    onTrain={(t, focus) => update((n) => { const r = playToday(n, t, focus); setToday(r); if (r.lucky) setPopup({ kind: "lucky", text: LUCKY_NEWS }); })}
                    onMatch={() => { setToday(null); update(startTodayMatch); }}
                  />
                  <div className="metrics">
                    {[
                      {
                        label: "포지션 능력치",
                        value: roleAbility(p!.a,p!.pos).toFixed(1),
                        unit: "OVR",
                        icon: Activity,
                        sub: "성장의 시작점",
                      },
                      {
                        label: "컨디션",
                        value: Math.round(p!.energy),
                        unit: "%",
                        icon: Zap,
                        sub:
                          p!.energy > 65
                            ? "좋은 몸 상태를 유지 중"
                            : "회복 훈련을 추천해요",
                      },
                      {
                        label: "감독 신뢰",
                        value: p!.trust.toFixed(0),
                        unit: "/ 100",
                        icon: Shield,
                        sub: c.world.calendar ? `${statusOf(p!)}${p!.lastTrust !== undefined ? ` · 지난 경기 ${p!.lastTrust > 0 ? "+" : ""}${p!.lastTrust}` : ""}` : "훈련과 경기 평가 반영",
                      },
                      {
                        label: "통산 출전",
                        value: c.history.filter(r=>r.stats.minutes>0).length,
                        unit: "경기",
                        icon: Flag,
                        sub: `${c.history.reduce((a, r) => a + r.stats.goals, 0)} 골 · ${c.history.reduce((a, r) => a + r.stats.assists, 0)} 도움`,
                      },
                    ].map((x) => (
                      <section className="card metric" key={x.label}>
                        <div>
                          {x.label}
                          <x.icon size={18} />
                        </div>
                        <strong>
                          {x.value}
                          <small>{x.unit}</small>
                        </strong>
                        <p>{x.sub}</p>
                      </section>
                    ))}
                  </div>
                  <div className="home-grid">
                    <section className="card next-match">
                      <div className="section-title">
                        <h3>다가오는 경기</h3>
                        <span className="pill">{competitionName(c)}</span>
                      </div>
                      <p className="muted">
                        {dateOf((c.development.active?.startDay??c.day) + matchDayIndex(c))} ({WEEKDAYS[matchDayIndex(c)]}) · {selection(c).role}
                      </p>
                      <div className="fixture">
                        <div>
                          <div className="crest home-crest">H</div>
                          <strong>{teamName(c)}</strong>
                          <small>HOME</small>
                        </div>
                        <span>VS</span>
                        <div>
                          <div className="crest away-crest">A</div>
                          <strong>{opponentOf(c)}</strong>
                          <small>AWAY</small>
                        </div>
                      </div>
                      <button className="primary full" onClick={()=>go(c.world.phase==='offseason'?'season':c.world.phase==='retired'?'career':'training')}>{c.world.phase==='offseason'?'시즌 결산 · 다음 시즌':c.world.phase==='retired'?'은퇴 기록 보기':'오늘의 일정으로 이동'}</button>
                      <small className="center muted">{c.world.calendar ? "매주 한 경기 · 경기 요일은 시즌 일정에 따라 달라집니다." : "경기는 매주 토요일입니다."} 오늘의 일정에서 하루씩 진행하세요.</small>
                    </section>
                    <GrowthNotes c={c}/>
                  </div>
                  <div className="home-grid eg-grid">
                    <SignaturePanel c={c}/>
                    <RivalCompare c={c}/>
                  </div>
                  <section className="card feed">
                    <div className="section-title">
                      <h3>커리어 소식</h3>
                      <span className="eyebrow">LATEST UPDATES</span>
                    </div>
                    {c.feed.slice(0, 3).map((f, i) => (
                      <p key={i}>
                        <span className="dot" />
                        {f}
                      </p>
                    ))}
                  </section>
                </>
              ) : null}
              {tab === "training" && c && !m && (
                <>
                  <Heading eyebrow="DAILY ROUTINE" title="오늘의 일정" text="하루에 한 가지를 고르면 하루가 지나고 바로 반영됩니다. 경기일은 시즌 일정에 표시됩니다. 훈련 타일의 '세부훈련'을 펼치면 유료 세부훈련(주 3회)을 할 수 있습니다." />
                  <TodayPanel
                    c={c}
                    last={today}
                    onTrain={(t, focus) => update((n) => { const r = playToday(n, t, focus); setToday(r); if (r.lucky) setPopup({ kind: "lucky", text: LUCKY_NEWS }); })}
                    onMatch={() => { setToday(null); update(startTodayMatch); }}
                  />
                  <GrowthNotes c={c} />
                </>
              )}
              {tab === "rival" && c && <RivalPanel c={c}/>}
              {tab === "player" && c && (
                <>
                  <Heading
                    eyebrow="PLAYER PROFILE"
                    title={`${p!.name}, 아직 쓰이지 않은 이야기.`}
                    text={`${teamName(c)} · ${p!.age}세 · ${p!.height}cm / ${p!.weight}kg · ${p!.foot}발`}
                  />
                  <div className="profile-header card">
                    <div className="shirt">10</div>
                    <div>
                      <span className="tag">
                        {p!.pos} / {p!.secondary}
                      </span>
                      <h2>{p!.name}</h2>
                      <p>
                        {p!.style} · {p!.curve}
                      </p>
                      <TraitList traits={c.development.traits} detail empty="보유 특성 없음" />
                    </div>
                    <div className="ovr">
                      {roleAbility(p!.a,p!.pos).toFixed(1)}
                      <small>OVERALL</small>
                    </div>
                  </div>
                  <div className="two-col">
                    <section className="card">
                      <div className="section-title">
                        <h3>선수 능력치</h3>
                        <span className="muted">0 — 100</span>
                      </div>
                      <div className="attributes">
                        {ATTRS.map((k) => { const bonus = equipmentBonus(c.development.equipment)[k] ?? 0; return (
                          <div className="attribute" key={k}>
                            <label>{LABELS[k]}</label>
                            <div className="bar">
                              <i style={{ width: p!.a[k] + "%" }} />
                              {bonus > 0 && <i className="gear" style={{ left: p!.a[k] + "%", width: Math.min(bonus, 100 - p!.a[k]) + "%" }} />}
                            </div>
                            <b title={bonus ? `기본 ${p!.a[k].toFixed(1)} + 장비 ${bonus}` : undefined}>{p!.a[k].toFixed(1)}{bonus > 0 && <small className="gear-bonus"> +{bonus}</small>}</b>
                          </div>
                        ); })}
                      </div>
                    </section>
                    <section className="card">
                      <h3>성장 기록</h3>
                      <p className="muted">경기 후 포지션 능력치 추이</p>
                      <Growth values={c.growth.map((x) => x.overall)} />
                      <div className="profile-facts">
                        <p>
                          성장 유형 <strong>{p!.curve}</strong>
                        </p>
                        <p>
                          감독 신뢰 <strong>{p!.trust.toFixed(1)} / 100</strong>
                        </p>
                        {c.world.calendar && <p>
                          팀 내 위치 <strong>{statusOf(p!)}</strong>
                        </p>}
                        {p!.lastTrust !== undefined && <p>
                          지난 경기 신뢰 변화 <strong>{p!.lastTrust > 0 ? "+" : ""}{p!.lastTrust}</strong>
                        </p>}
                        {c.world.calendar && (statusOf(p!) === "로테이션" || statusOf(p!) === "후보") && <p>
                          주전 복귀 기준 <strong>신뢰 {STATUS.regain} 이상 (현재 {p!.trust.toFixed(0)})</strong>
                        </p>}
                        {(c.world.contract.trialMatches ?? 0) > 0 && <p>
                          선발 보장 <strong>{c.world.contract.trialMatches}경기 남음</strong>
                        </p>}
                        <p>
                          주간 훈련 <strong>{c.trainingCount} / 3</strong>
                        </p>
                        <p>
                          선수 역할 <strong>{selection(c).role}</strong>
                        </p>
                      </div>
                      <div className="coach-tip">
                        <span>DEVELOPMENT NOTE</span>
                        <p>
                          잠재력은 숨겨진 성장 한계입니다. 좋은 경기 경험은 그
                          가능성을 조금씩 넓힙니다.
                        </p>
                      </div>
                    </section>
                  </div>
                  <OriginPanel c={c} legacy={legacy}/>
                  <EquipmentPanel
                    c={c}
                    onBuy={(id) => update((n) => buyEquipment(n, id))}
                    onEquip={(id) => update((n) => equip(n, id))}
                    onUnequip={(slot) => update((n) => unequip(n, slot))}
                  />
                </>
              )}
              {tab === "records" && c && (
                <>
                  <Heading
                    eyebrow="MATCH HISTORY"
                    title="당신의 발자취."
                    text="실제로 치른 경기의 결과와 개인 기록이 쌓입니다."
                  />
                  {!c.history.length ? (
                    <section className="card empty">
                      <Trophy size={36} />
                      <h3>첫 번째 기록을 남겨 보세요.</h3>
                      <p>경기를 완료하고 결과를 반영하면 이곳에 저장됩니다.</p>
                      <button className="primary" onClick={() => go("home")}>
                        경기 일정 보기
                      </button>
                    </section>
                  ) : (
                    <>
                      <div className="metrics five">
                        {[
                          ["출전", c.history.filter(r=>r.stats.minutes>0).length],
                          [
                            "골",
                            c.history.reduce((a, r) => a + r.stats.goals, 0),
                          ],
                          [
                            "도움",
                            c.history.reduce((a, r) => a + r.stats.assists, 0),
                          ],
                          ["드리블 성공", c.history.reduce((a, r) => a + (r.stats.dribbles ?? 0), 0)],
                          [
                            "평균 평점",
                            (
                              c.history.reduce((a, r) => a + r.rating, 0) /
                              Math.max(1,c.history.filter(r=>r.stats.minutes>0).length)
                            ).toFixed(2),
                          ],
                        ].map(([k, v]) => (
                          <section className="card metric" key={k}>
                            <div>{k}</div>
                            <strong>{v}</strong>
                          </section>
                        ))}
                      </div>
                      <section className="card table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>경기일 / 상대</th>
                              <th>결과</th>
                              <th>골 / 도움</th>
                              <th>드리블</th>
                              <th>패스 성공</th><th>전진 / 키패스</th>
                              <th>평점</th>
                              <th>성장 합계</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.history.map((r) => (
                              <tr key={r.id}>
                                <td>
                                  <small>{r.date}</small>
                                  <strong>{r.opponent}</strong>
                                </td>
                                <td>
                                  <span className="score-pill">
                                    {r.score.join(" : ")}
                                  </span>
                                </td>
                                <td>
                                  {r.stats.goals} / {r.stats.assists}
                                </td>
                                <td>{r.stats.dribbles ?? 0}</td>
                                <td>
                                  {r.stats.completed} / {r.stats.passes}
                                </td><td>{r.stats.progressivePasses ?? 0} / {r.stats.keyPasses ?? 0}</td>
                                <td>
                                  <span className="rating-pill">
                                    {r.stats.minutes>0?r.rating.toFixed(1):"—"}
                                  </span>
                                </td>
                                <td>+{r.gain.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>
                    </>
                  )}
                  <div className="note">
                    경기 결과는 리그 순위·출전 경쟁·성장에 반영됩니다. 과거 버전의 친선 경기 기록도 그대로 보존됩니다.
                  </div>
                </>
              )}
              {c&&["team","season","market","career"].includes(tab)&&<WorldPanel c={c} tab={tab} update={update} onNeedContract={(message)=>{inform(message);setTab("market");}}/>}
              {tab === "players" && (
                <PlayerSlots
                  slots={slots}
                  current={slot}
                  hasCareer={!!c}
                  onSwitch={switchTo}
                  onNew={startNew}
                  onRestore={(n) => openSlot(n, true)}
                  onRestoreArchive={restoreArchive}
                  legacy={legacy}
                  onDelete={deleteSlotPlayer}
                />
              )}
              {tab === "saves" && (
                <>
                  <Heading
                    eyebrow="SAVE & CONTINUE"
                    title="당신의 여정을 안전하게."
                    text="5초마다 자동 저장 · 3개 슬롯 · 파일로 내보내기 및 복원"
                  />
                  <div className="save-grid">
                    {[1, 2, 3].map((n) => {
                      const s = slots.find((s) => s.slot === n);
                      return (
                        <section className="card save-card" key={n}>
                          <span className="eyebrow">
                            SLOT 0{n} {slot === n ? "· 현재 슬롯" : ""}
                          </span>
                          <FolderHeart size={32} />
                          <h3>{s?.name || "새로운 가능성"}</h3>
                          <p>
                            {s?.name
                              ? `${(s.week ?? 0) + 1}주 차 커리어`
                              : "비어 있는 저장 슬롯"}
                          </p>
                          <button
                            className="primary full"
                            disabled={!s?.name || s?.broken}
                            onClick={() => openSlot(n)}
                          >
                            이어하기
                          </button>
                          <button
                            className="secondary full"
                            disabled={!c}
                            onClick={async () => {
                              if (
                                s?.name &&
                                n !== slot &&
                                !confirm("이 슬롯을 현재 커리어로 덮어쓸까요?")
                              )
                                return;
                              await persist(c!, n);
                              setSlot(n);
                              setSlots(await storage.slots());
                            }}
                          >
                            여기에 저장
                          </button>
                          <button
                            className="text-button"
                            onClick={() => openSlot(n, true)}
                          >
                            직전 백업 복원
                          </button>
                        </section>
                      );
                    })}
                  </div>
                  <section className="card save-tools">
                    <div>
                      <h3>커리어 파일 백업</h3>
                      <p>
                        다른 기기로 옮기거나 브라우저 데이터를 정리하기 전에
                        내보내세요.
                      </p>
                    </div>
                    <button
                      className="secondary"
                      disabled={!c}
                      onClick={exportSave}
                    >
                      <Download size={17} />
                      내보내기
                    </button>
                    <label className="secondary file-input">
                      <Upload size={17} />
                      가져오기
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          // Reset first so picking the same file again still fires onChange.
                          e.target.value = "";
                          if (
                            file &&
                            c &&
                            !confirm("현재 슬롯에 가져온 커리어를 저장할까요?")
                          )
                            return;
                          importSave(file);
                        }}
                      />
                    </label>
                  </section>
                  <button
                    className="text-button"
                    onClick={() => {
                      go("players");
                    }}
                  >
                    <Plus size={17} /> 새 커리어 만들기
                  </button>
                  <div className="note">
                    저장 데이터는 이 브라우저에만 보관됩니다. 개인정보 보호
                    모드·브라우저 데이터 삭제 시 사라질 수 있습니다. 손상 시
                    직전 백업 또는 내보낸 파일로 복구할 수 있습니다.
                  </div>
                </>
              )}
            </>
          )}
          <footer>
            <span>
              SOCCER CAREER <b>NEW ERA</b>
            </span>
            <span>한 명의 선수. 무한한 가능성.</span>
            <small>CAREER BETA · 0.15</small>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Heading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
function Growth({ values }: { values: number[] }) {
  const min = Math.min(...values) - 0.15,
    max = Math.max(...values) + 0.15;
  return (
    <div className="growth">
      <svg
        viewBox="0 0 400 150"
        aria-label="포지션 능력치 성장 그래프"
        role="img"
      >
        <line x1="15" y1="135" x2="385" y2="135" stroke="#d9ded4" />
        <polyline
          points={values
            .map(
              (v, i) =>
                `${15 + (i / Math.max(1, values.length - 1)) * 370},${130 - ((v - min) / (max - min)) * 110}`,
            )
            .join(" ")}
          fill="none"
          stroke="#27654e"
          strokeWidth="3"
        />
        {values.map((v, i) => (
          <circle
            key={i}
            cx={15 + (i / Math.max(1, values.length - 1)) * 370}
            cy={130 - ((v - min) / (max - min)) * 110}
            r="4"
            fill="#27654e"
          />
        ))}
      </svg>
      <div>
        <span>입단 {values[0].toFixed(1)}</span>
        <strong>현재 {values.at(-1)!.toFixed(1)}</strong>
      </div>
    </div>
  );
}
function Create({
  onCreate,
  onCancel,
}: {
  onCreate: (
    p: Omit<
      Player,
      "a" | "potential" | "learning" | "energy" | "fatigue" | "trust"
    >,
    school: number,
  ) => void;
  onCancel: () => void;
}) {
  const [school, setSchool] = useState(0);
  return (
    <>
      <Heading
        eyebrow="CREATE YOUR PLAYER / 01"
        title="모든 전설에는 시작이 있다."
        text="어떤 선수가 되고 싶나요? 첫 번째 축구 인생을 만들어 보세요."
      />
      <form
        className="create-form"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          onCreate(
            {
              name: String(data.get("name")).trim() || "유망주",
              age: Number(data.get("age")),
              pos: data.get("pos") as Position,
              secondary: data.get("secondary") as Position,
              foot: String(data.get("foot")),
              height: Number(data.get("height")),
              weight: Number(data.get("weight")),
              style: String(data.get("style")),
              curve: String(data.get("curve")),
            },
            school,
          );
        }}
      >
        <section className="card">
          <div className="section-title">
            <h3>선수 기본 정보</h3>
            <User size={20} />
          </div>
          <div className="form-grid">
            <label>
              선수 이름
              <input
                name="name"
                defaultValue="양관우"
                maxLength={20}
                required
              />
            </label>
            <label>
              입학 나이
              <select name="age">
                <option value="16">16세</option>
                <option value="17">17세</option>
              </select>
            </label>
            <label>
              주 포지션
              <select aria-label="주 포지션" name="pos" defaultValue="CM">
                {["ST", "CM", "CB", "LW", "RW", "LB", "RB"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              보조 포지션
              <select
                aria-label="보조 포지션"
                name="secondary"
                defaultValue="ST"
              >
                {["ST", "CM", "CB", "LW", "RW", "LB", "RB"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              주발
              <select name="foot">
                <option>오른</option>
                <option>왼</option>
                <option>양</option>
              </select>
            </label>
            <label>
              플레이 스타일
              <select name="style">
                <option>플레이메이커</option>
                <option>테크니션</option>
                <option>피지컬</option>
              </select>
            </label>
            <label>
              신장 (cm)
              <input
                name="height"
                type="number"
                min="150"
                max="205"
                defaultValue="178"
                required
              />
            </label>
            <label>
              체중 (kg)
              <input
                name="weight"
                type="number"
                min="45"
                max="110"
                defaultValue="70"
                required
              />
            </label>
            <label className="span-2">
              성장 유형
              <select name="curve">
                <option>꾸준한 성장형</option>
                <option>조기 성장형</option>
                <option>대기만성형</option>
              </select>
            </label>
          </div>
          <small className="muted">
            신체·주발의 경기 보정은 후속
            단계에서 추가됩니다. 보조 포지션은 선발 평가에 반영됩니다.
          </small>
        </section>
        <section className="card">
          <div className="section-title">
            <h3>첫 번째 유니폼</h3>
            <Flag size={20} />
          </div>
          <p className="muted">모든 학교와 선수는 가상으로 제작되었습니다.</p>
          <div className="school-list">
            {SCHOOLS.map((s, i) => (
              <button
                type="button"
                className={school === i ? "school selected" : "school"}
                key={s.name}
                onClick={() => setSchool(i)}
              >
                <div className="crest">{["H", "U", "C"][i]}</div>
                <div>
                  <strong>{s.name}</strong>
                  <small>
                    {s.area} · {s.style}
                  </small>
                </div>
                <span>{school === i ? "●" : "○"}</span>
              </button>
            ))}
          </div>
          <div className="coach-tip">
            <span>YOUR FIRST CHAPTER</span>
            <p>
              고교 정규 리그에서 시작합니다. 학교마다 감독의 전술과 선수단이 다르며, 선발 경쟁을 거쳐 출전합니다.
            </p>
          </div>
          <button className="primary full" type="submit">
            입단하고 커리어 시작 <ArrowRight size={17} />
          </button>
          <button className="text-button" type="button" onClick={onCancel}>
            돌아가기
          </button>
        </section>
      </form>
    </>
  );
}

