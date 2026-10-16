/** Pure seeded football simulation. No DOM, timers, or external services. Pitch 105 x 68m. */
export const ATTRS = [
  "shooting",
  "passing",
  "dribbling",
  "control",
  "speed",
  "acceleration",
  "stamina",
  "strength",
  "defending",
  "positioning",
  "decisions",
  "vision",
  "composure",
] as const;
export type Attr = (typeof ATTRS)[number];
export type Attributes = Record<Attr, number>;
export const LABELS: Record<Attr, string> = {
  shooting: "슈팅",
  passing: "패스",
  dribbling: "드리블",
  control: "볼 컨트롤",
  speed: "스피드",
  acceleration: "가속도",
  stamina: "체력",
  strength: "몸싸움",
  defending: "수비",
  positioning: "위치선정",
  decisions: "판단력",
  vision: "시야",
  composure: "침착성",
};
export type Position = "ST" | "CM" | "CB" | "LW" | "RW" | "LB" | "RB" | "GK";
export type Action =
  "safe" | "forward" | "through" | "dribble" | "shoot" | "hold";
export const ACTIONS: Record<Action, string> = {
  safe: "안전한 패스",
  forward: "전진 패스",
  through: "스루패스",
  dribble: "드리블 돌파",
  shoot: "슈팅",
  hold: "볼 지키기",
};
export type Stat = {
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  onTarget: number;
  passes: number;
  completed: number;
  tackles: number;
  interceptions: number;
  losses: number;
  saves: number;
  goalsConceded?: number;
  progressivePasses?: number;
  keyPasses?: number;
  expectedAssists?: number;
  /** Balls won back by the same player shortly after losing them (집념). */
  grit?: number;
};
/** Engine-side trait effects for one player. Absent = no effect and no extra state. */
export type MatchFx = {
  /** Next action of the teammate receiving my completed pass: success ×(1+value). Not stackable. */
  playmaker?: number;
  /** After my goal or assist: team stamina drain ×drain for `seconds`; ends when the team concedes. */
  momentum?: { seconds: number; drain: number };
  /** Winning the ball back within `window` seconds of losing it: +energy and a rating bonus. */
  grit?: { energy: number; window: number };
};
export const emptyStats = (): Stat => ({
  minutes: 0,
  goals: 0,
  assists: 0,
  shots: 0,
  onTarget: 0,
  passes: 0,
  completed: 0,
  tackles: 0,
  interceptions: 0,
  losses: 0,
  saves: 0,
  goalsConceded: 0,
  progressivePasses: 0,
  keyPasses: 0,
  expectedAssists: 0,
});
export type Footballer = {
  id: number;
  name: string;
  team: 0 | 1;
  number: number;
  pos: Position;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  a: Attributes;
  energy: number;
  stats: Stat;
  yellow: number;
  red: boolean;
  injured: boolean;
  mode: "shape" | "press" | "support" | "attack" | "recover";
  fx?: MatchFx;
};
export type Ball = {
  x: number;
  y: number;
  owner: number | null;
  flight: null | {
    from: number;
    to: number | null;
    x: number;
    y: number;
    kind: "pass" | "shot";
    progress: number;
    duration: number;
    startX: number;
    startY: number;
    success: boolean;
    xg: number;
    onTarget?: boolean;
  };
};
export type Insight = {chance:number,gains:Partial<Record<Attr,number>>,events:{minute:number,key:Attr}[]};
export type Match = {
  insight?:Insight;
  rivalInsight?:Insight & {playerId:number};
  traitBoost?:boolean;
  /** 플레이메이커: pending boost for the next action of one receiver. */
  assistBoost?: { to: number; mult: number } | null;
  /** 분위기 메이커: per team, clock until which stamina drain is reduced, and the drain factor. */
  momentum?: [number, number];
  momentumDrain?: [number, number];
  /** 집념: clock of each tracked player's last ball loss. */
  lostBall?: Record<number, number>;
  seed: number;
  clock: number;
  half: 1 | 2;
  endAt: number;
  players: Footballer[];
  userId: number;
  score: [number, number];
  shots: [number, number];
  xg: [number, number];
  ball: Ball;
  decision: boolean;
  cooldown: number;
  ended: boolean;
  log: { time: number; text: string }[];
  lastPass: { from: number; to: number; time: number } | null;
  offball: "shape" | "run" | "press" | "defend" | "call";
  possession: [number, number];
  subs: [number, number];
  nextAI: number;
  userOnPitch?: boolean;
  benchEntry?: {minute:number,name:string,a:Attributes,energy:number,number:number,fx?:MatchFx};
  userExitMinute?: number;
  userFinalStats?: Stat;
  userFinalEnergy?: number;
  replacedPlayers?: {rosterId:string,player:Footballer}[];
  exitReplacement?: {name:string,a:Attributes,energy:number,number:number,rosterId:string,fx?:MatchFx};
  rosterIds?: string[];
  competition?: string;
  tactics?: [string,string];
};
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export function random(s: { seed: number }) {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
export function attributes(base: number): Attributes {
  return Object.fromEntries(ATTRS.map((k) => [k, base])) as Attributes;
}
export function overall(a: Attributes) {
  return ATTRS.reduce((v, k) => v + a[k], 0) / ATTRS.length;
}
const positions: Position[] = [
  "GK",
  "LB",
  "CB",
  "CB",
  "RB",
  "CM",
  "CM",
  "CM",
  "LW",
  "ST",
  "RW",
];
const shape = [
  [5, 34],
  [25, 10],
  [21, 26],
  [21, 42],
  [25, 58],
  [44, 18],
  [39, 34],
  [44, 50],
  [66, 11],
  [70, 34],
  [66, 57],
];
const surnames = [
  "김",
  "이",
  "박",
  "정",
  "최",
  "윤",
  "강",
  "조",
  "한",
  "서",
  "장",
];
const names = [
  "도윤",
  "준서",
  "지훈",
  "민재",
  "시우",
  "현우",
  "태성",
  "건우",
  "우진",
  "승호",
  "지호",
];
export function createMatch(
  seed: number,
  user: { name: string; pos: Position; a: Attributes; energy: number },
  opponent = 47,
): Match {
  const m: Match = {
    seed: seed >>> 0,
    clock: 0,
    half: 1,
    endAt: 90 * 60 + 120,
    players: [],
    userId: 0,
    score: [0, 0],
    shots: [0, 0],
    xg: [0, 0],
    ball: { x: 52.5, y: 34, owner: null, flight: null },
    decision: false,
    cooldown: 3,
    ended: false,
    log: [],
    lastPass: null,
    offball: "shape",
    possession: [0, 0],
    subs: [0, 0],
    nextAI: 0,
  };
  const userSlot = Math.max(0, positions.indexOf(user.pos));
  m.userId = userSlot;
  for (let t = 0; t < 2; t++)
    for (let i = 0; i < 11; i++) {
      const a = attributes(45);
      for (const k of ATTRS)
        a[k] = clamp((t ? opponent : 46) + (random(m) - 0.5) * 24, 20, 90);
      const p: Footballer = {
        id: t * 11 + i,
        name: surnames[i] + names[(i + t * 3) % 11],
        team: t as 0 | 1,
        number: i === 0 ? 1 : i + 1,
        pos: positions[i],
        x: t ? 105 - shape[i][0] : shape[i][0],
        y: shape[i][1],
        homeX: shape[i][0],
        homeY: shape[i][1],
        a,
        energy: 100,
        stats: emptyStats(),
        yellow: 0,
        red: false,
        injured: false,
        mode: "shape",
      };
      if (t === 0 && i === userSlot) {
        p.name = user.name;
        p.a = { ...user.a };
        p.energy = user.energy;
      }
      m.players.push(p);
    }
  if (userSlot !== 9) {
    m.players[9].number = m.players[userSlot].number;
    m.players[userSlot].number = 10;
  }
  kickoff(m, 0);
  event(m, "킥오프 · 고교 친선 경기");
  return m;
}
export const direction = (m: Match, t: number) =>
  (t === 0 ? 1 : -1) * (m.half === 1 ? 1 : -1);
const active = (p: Footballer) => !p.red && !p.injured;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
function event(m: Match, text: string) {
  m.log.push({ time: m.clock, text });
  if (m.log.length > 120) m.log.shift();
}
function kickoff(m: Match, team: 0 | 1) {
  for (const p of m.players) {
    p.x = direction(m, p.team) > 0 ? p.homeX : 105 - p.homeX;
    p.y = p.homeY;
  }
  const p =
    m.players.find((p) => p.team === team && p.pos === "ST" && active(p)) ||
    m.players.find((p) => p.team === team && active(p))!;
  p.x = 52.5;
  p.y = 34;
  own(m, p);
  m.lastPass = null;
  m.cooldown = 4;
}
function own(m: Match, p: Footballer) {
  if (m.lastPass && m.players[m.lastPass.from].team !== p.team) m.lastPass = null;
  if (m.assistBoost && m.assistBoost.to !== p.id) m.assistBoost = null;
  m.ball = { x: p.x, y: p.y, owner: p.id, flight: null };
  m.decision = p.id === m.userId && m.userOnPitch !== false;
  m.nextAI = shotQuality(m,p)>=.22 ? .5 : 1.8;
}
/** 집념 bookkeeping for a turnover from `loser` to `winner`. No state unless a player has the effect. */
export function turnover(m: Match, loser: Footballer, winner: Footballer) {
  if (loser.fx?.grit) (m.lostBall ??= {})[loser.id] = m.clock;
  const lost = m.lostBall?.[winner.id], g = winner.fx?.grit;
  if (g && lost !== undefined && m.clock - lost <= g.window) {
    winner.energy = Math.min(100, winner.energy + g.energy);
    winner.stats.grit = (winner.stats.grit ?? 0) + 1;
    delete m.lostBall![winner.id];
    event(m, `${winner.name} · 집념! 잃은 공을 되찾음`);
  }
}
const boostFor = (m: Match, p: Footballer) => (m.assistBoost?.to === p.id ? m.assistBoost.mult : 1);
export function pressure(m: Match, p: Footballer) {
  return m.players
    .filter((q) => q.team !== p.team && active(q))
    .reduce((n, q) => n + Math.max(0, 1 - dist(p, q) / 9), 0);
}
function laneRisk(m: Match, p: Footballer, q: Footballer) {
  const dx = q.x - p.x,
    dy = q.y - p.y,
    l = dx * dx + dy * dy;
  return m.players
    .filter((o) => o.team !== p.team && active(o))
    .reduce((risk, o) => {
      const u = clamp(((o.x - p.x) * dx + (o.y - p.y) * dy) / (l || 1), 0, 1);
      return Math.max(
        risk,
        Math.max(
          0,
          1 - Math.hypot(o.x - p.x - u * dx, o.y - p.y - u * dy) / 5,
        ) * (u > 0.08 && u < 0.95 ? 1 : 0.2),
      );
    }, 0);
}
export function shotQuality(m: Match, p: Footballer) {
  const d = direction(m, p.team),
    gx = d > 0 ? 105 : 0,
    r = Math.hypot(gx - p.x, 34 - p.y),
    angle = Math.max(0.18, 1 - Math.abs(34 - p.y) / 37);
  // A goal-facing defender can block a shot even when outside close-pressure range.
  const dx=gx-p.x,dy=34-p.y,length2=dx*dx+dy*dy;
  let block=0;
  for(const q of m.players){
    if(q.team===p.team || q.pos==='GK' || !active(q))continue;
    const u=((q.x-p.x)*dx+(q.y-p.y)*dy)/(length2||1);
    if(u>.08 && u<.95)block=Math.max(block,Math.max(0,1-Math.hypot(q.x-p.x-u*dx,q.y-p.y-u*dy)/3));
  }
  return clamp(
    ((Math.exp(-r / 20) *
      0.40 *
      angle *
      (0.65 + p.a.shooting / 100) *
      (0.9 + p.a.composure / 300)) /
      (1 + pressure(m, p) * 0.35)) *
      (0.6 + p.energy / 250) * (1-.4*block) * clamp(1+(50-(m.players.find(q=>q.team!==p.team&&q.pos==="GK")?.a.defending??50))/180,.7,1.25),
    0.008,
    0.65,
  );
}
function targets(m: Match, p: Footballer, act: Action) {
  const d = direction(m, p.team);
  const line = m.players.filter(q=>q.team!==p.team && active(q)).map(q=>q.x*d).sort((a,b)=>b-a)[1]??105;
  const offside = (q:Footballer) => q.x*d > p.x*d && q.x*d > line && q.x*d > 52.5*d;
  return m.players
    .filter((q) => q.team === p.team && q.id !== p.id && active(q) && !offside(q))
    .map((q) => ({
      p: q,
      score:
        (act === "safe"
          ? 0
          : (q.x - p.x) * d * (act === "through" ? 0.9 : 0.55)) -
        dist(p, q) * 0.18 -
        pressure(m, q) * 7 -
        laneRisk(m, p, q) * 22 +
        (q.pos === "GK" ? -10 : 0) +
        (act === "safe" ? 0 : shotQuality(m,q) * 38 * (.5+p.a.vision/100)),
    }))
    .sort((a, b) => b.score - a.score);
}
export function actionChance(m: Match, action: Action) {
  const p = m.players.find((p) => p.id === m.ball.owner);
  if (!p) return 0;
  const pr = pressure(m, p), b = boostFor(m, p);
  if (action === "shoot") return b === 1 ? shotQuality(m, p) : Math.min(0.95, shotQuality(m, p) * b);
  if (action === "dribble")
    return Math.min(0.97, clamp(0.44 + p.a.dribbling / 180 - pr * 0.14, 0.12, 0.92) * b);
  if (action === "hold")
    return Math.min(0.97, clamp(0.65 + p.a.strength / 260 - pr * 0.15, 0.15, 0.95) * b);
  const q = targets(m, p, action)[0]?.p;
  if (!q) return 0;
  return Math.min(0.99, b * clamp(
    0.76 +
      p.a.passing / 330 -
      dist(p, q) * 0.003 -
      laneRisk(m, p, q) * 0.25 -
      pr * 0.055 -
      (action === "through" ? 0.12 : 0),
    0.15,
    0.97,
  ));
}
export function availableActions(m: Match): Action[] {
  const p = m.players.find((p) => p.id === m.ball.owner);
  if (!p) return [];
  return (Object.keys(ACTIONS) as Action[]).filter(
    (a) =>
      a !== "shoot" ||
      Math.hypot((direction(m, p.team) > 0 ? 105 : 0) - p.x, 34 - p.y) < 43,
  );
}
export function chooseAction(m: Match, p: Footballer): Action {
  const acts = availableActions(m);
  const d = direction(m, p.team),
    distance = Math.hypot((d > 0 ? 105 : 0) - p.x, 34 - p.y);
  let best: Action = "safe",
    score = -Infinity;
  for (const a of acts) {
    let utility = actionChance(m, a);
    if (a === "shoot")
      utility = shotQuality(m, p) * 5.42 + (distance < 21 ? 0.25 : -0.32);
    if (a === "forward") utility += 0.12;
    if (a === "through") utility += p.a.vision / 550;
    if (a === "safe") utility -= 0.05;
    if (a === "dribble") utility += pressure(m, p) < 0.6 ? 0.24 : -0.22;
    if (a === "hold") utility -= 0.42;
    utility += (random(m) - 0.5) * (1 - p.a.decisions / 120) * 0.42;
    if (utility > score) {
      best = a;
      score = utility;
    }
  }
  return best;
}
export function insightAttempt(m:Match,p:Footballer,keys:Attr[]){
  const state=p.id===m.userId&&m.userOnPitch!==false?m.insight:m.rivalInsight?.playerId===p.id?m.rivalInsight:undefined;
  if(!state||random(m)>=state.chance)return;
  const key=keys[Math.floor(random(m)*keys.length)];if(p.a[key]>=100)return;
  state.gains[key]=(state.gains[key]??0)+1;p.a[key]=Math.min(100,p.a[key]+1);state.events.push({minute:m.clock/60,key});
  event(m,`${p.name} · 깨달음! ${LABELS[key]} +1`);
}
export function act(m: Match, action: Action) {
  if (m.ended || m.ball.owner === null || !availableActions(m).includes(action))
    return;
  const p = m.players[m.ball.owner],
    d = direction(m, p.team),
    chance = actionChance(m, action),
    boost = boostFor(m, p);
  if (m.assistBoost?.to === p.id) m.assistBoost = null; // one action only, never stacks
  insightAttempt(m,p,action==='shoot'?['shooting','composure']:action==='dribble'?['dribbling']:action==='hold'?['strength']:['passing']);
  m.decision = false;
  m.nextAI = 2.5;
  if (action === "shoot") {
    p.stats.shots++;
    m.shots[p.team]++;
    const xg = boost === 1 ? shotQuality(m, p) : Math.min(0.95, shotQuality(m, p) * boost);
    m.xg[p.team] += xg;
    // Credit the creator at the shot, independent of the finisher's outcome.
    if (m.lastPass?.to === p.id && m.clock - m.lastPass.time < 90) {
      const creator = m.players[m.lastPass.from];
      if (creator.team === p.team && creator.id !== p.id) {
        creator.stats.keyPasses = (creator.stats.keyPasses ?? 0) + 1;
        creator.stats.expectedAssists = (creator.stats.expectedAssists ?? 0) + xg;
      }
    }
    const targetChance = Math.max(
      xg,
      clamp(0.35 + p.a.shooting / 220 - pressure(m, p) * 0.06, 0.2, 0.8),
    );
    const onTarget = random(m) < targetChance;
    if (onTarget) p.stats.onTarget++;
    m.ball.flight = {
      from: p.id,
      to: null,
      x: d > 0 ? 105 : 0,
      y: onTarget ? 34 + (random(m) - 0.5) * 6 : 25 + random(m) * 18,
      kind: "shot",
      progress: 0,
      duration: Math.max(0.5, Math.abs((d > 0 ? 105 : 0) - p.x) / 24),
      startX: p.x,
      startY: p.y,
      success: onTarget && random(m) < xg / targetChance,
      onTarget,
      xg,
    };
    m.ball.owner = null;
    event(m, `${p.name} · 슈팅!`);
    return;
  }
  if (action === "dribble" || action === "hold") {
    if (random(m) < chance) {
      p.x = clamp(p.x + (action === "dribble" ? 4 : 1) * d, 2, 103);
      p.y = clamp(p.y + (random(m) - 0.5) * 4, 3, 65);
      m.ball.x = p.x;
      m.ball.y = p.y;
    } else {
      const q = m.players
        .filter((q) => q.team !== p.team && active(q))
        .sort((a, b) => dist(a, p) - dist(b, p))[0];
      p.stats.losses++;
      q.stats.tackles++;
      own(m, q);
      turnover(m, p, q);
      event(m, `${q.name} · 볼 탈취`);
    }
    m.nextAI = 3;
    return;
  }
  const q = targets(m, p, action)[0]?.p;
  if (!q) return;
  // Offside judged at release: receiver beyond ball and second-last defender.
  const defenders = m.players
    .filter((q) => q.team !== p.team && active(q))
    .map((q) => q.x * d)
    .sort((a, b) => b - a);
  if (
    q.x * d > p.x * d &&
    q.x * d > (defenders[1] ?? 105) &&
    q.x * d > 52.5 * d
  ) {
    event(m, `${q.name} · 오프사이드`);
    const o = m.players
      .filter((o) => o.team !== p.team && active(o))
      .sort((a, b) => dist(a, q) - dist(b, q))[0];
    own(m, o);
    m.cooldown = 2;
    return;
  }
  p.stats.passes++;
  m.ball.flight = {
    from: p.id,
    to: q.id,
    x: clamp(q.x + (action === "through" ? 4 * d : 0), 2, 103),
    y: q.y,
    kind: "pass",
    progress: 0,
    duration: Math.max(0.5, dist(p, q) / 18),
    startX: p.x,
    startY: p.y,
    success: random(m) < chance,
    xg: 0,
  };
  m.ball.owner = null;
}
export function step(m: Match, dt = 0.5, auto = false) {
  if (m.ended || (m.decision && !auto)) return;
  if (m.decision && auto) {
    act(m, chooseAction(m, m.players[m.userId]));
  }
  const prev = m.clock;
  m.clock += dt * 6;
  m.cooldown = Math.max(0, m.cooldown - dt);
  m.nextAI -= dt;
  if (prev < 2700 && m.clock >= 2700) {
    m.half = 2;
    for (const p of m.players) p.energy = clamp(p.energy + 8, 0, 100);
    event(m, "하프타임 · 진영 교체");
    kickoff(m, 1);
  }
  if (m.clock >= m.endAt) {
    m.ended = true;
    m.decision = false;
    m.clock = m.endAt;
    event(m, "경기 종료");
    return;
  }
  if (m.benchEntry && m.clock >= m.benchEntry.minute * 60) {
    const slot = m.players[m.userId], incoming = m.benchEntry;
    (m.replacedPlayers??=[]).push({rosterId:m.rosterIds?.[m.userId]??'unknown',player:structuredClone(slot)});
    if(m.rosterIds)m.rosterIds[m.userId]='hero';
    slot.name = incoming.name; slot.a = {...incoming.a}; slot.energy = incoming.energy;
    slot.number = incoming.number; slot.stats = emptyStats(); slot.yellow = 0; slot.fx = incoming.fx;
    m.userOnPitch = true; m.benchEntry = undefined;
    if (m.ball.owner === slot.id) own(m, slot);
    event(m, `${slot.name} 교체 투입 · 감독의 출전 결정`);
  }
  if (m.userExitMinute && m.clock >= m.userExitMinute * 60 && m.userOnPitch !== false && !m.players[m.userId].red) {
    const slot=m.players[m.userId]; m.userFinalStats={...slot.stats};m.userFinalEnergy=slot.energy;
    (m.replacedPlayers??=[]).push({rosterId:'hero',player:structuredClone(slot)});
    const replacement=m.exitReplacement;
    slot.name=replacement?.name??'교체 선수';slot.a=replacement?.a??slot.a;slot.stats=emptyStats();slot.energy=replacement?.energy??100;slot.number=replacement?.number??19;slot.fx=replacement?.fx;
    if(m.rosterIds)m.rosterIds[m.userId]=replacement?.rosterId??'unknown';
    m.userOnPitch=false;m.decision=false;event(m,'감독 교체 지시 · 오늘의 출전 종료');
  }
  const owner = m.ball.owner === null ? null : m.players[m.ball.owner];
  if (owner) m.possession[owner.team] += dt;
  // Keep the attacking shape while a pass travels, rather than returning to kickoff anchors.
  const attack = owner ?? (m.ball.flight?.kind === "pass" ? {...m.players[m.ball.flight.from],id:-1,x:m.ball.flight.x,y:m.ball.flight.y} : null);
  for (const p of m.players) {
    if (!active(p)) continue;
    p.stats.minutes += dt / 10;
    const drain = m.momentum && m.momentum[p.team] > m.clock ? m.momentumDrain![p.team] : 1;
    p.energy = Math.max(8, p.energy - dt * (p.a.stamina > 65 ? 0.027 : 0.035) * drain);
    const d = direction(m, p.team);
    let tx = d > 0 ? p.homeX : 105 - p.homeX,
      ty = p.homeY;
    p.mode = "shape";
    if (attack) {
      if (attack.id === p.id) {
        p.mode = "attack";
        tx = clamp(p.x + d * 9, 3, 102);
        ty = p.y + (34 - p.y) * 0.1;
      } else if (attack.team === p.team) {
        p.mode = "support";
        tx = clamp(tx + (attack.x - 52.5) * 0.35 + d * (m.tactics?.[p.team] === "역습" ? 13 : m.tactics?.[p.team] === "수비" ? 5 : 9), 4, 100);
        if(p.pos === "CM") tx=clamp(d*Math.max(tx*d,attack.x*d-12),4,101);
        ty = p.homeY + (attack.y - 34) * 0.22;
        const progress=attack.x*d+(d<0?105:0),phase=m.clock/42+p.id*1.7;
        if(['ST','LW','RW'].includes(p.pos)){
          const run=5+Math.sin(phase)*3+p.a.positioning/25;
          tx=clamp(d*Math.max(tx*d,attack.x*d+run),5,100);
          if(p.pos!=='ST'&&progress>68)ty+=(34-ty)*.36;
          ty+=Math.sin(phase)*4;
          const backLine=m.players.filter(q=>q.team!==p.team&&active(q)).map(q=>q.x*d).sort((a,b)=>b-a)[1]??105;
          if(attack.x*d<backLine)tx=d*Math.min(tx*d,backLine-1.5);
        }else if(p.pos==='CM'){
          ty=clamp(ty+Math.sin(phase)*5+(34-ty)*(progress>65?.2:0),7,61);
        }else if(['LB','RB'].includes(p.pos)&&progress>55&&m.tactics?.[p.team]!=='수비')tx+=d*5;
        // Separate support lanes instead of stacking players on a single anchor.
        for(const q of m.players)if(q.team===p.team&&q.id!==p.id&&active(q)){
          const gap=dist(p,q);if(gap>0&&gap<5){tx+=(p.x-q.x)/gap*(5-gap)*.5;ty+=(p.y-q.y)/gap*(5-gap)*.7;}
        }
      } else {
        const nearest = m.players
          .filter((q) => q.team === p.team && q.pos !== "GK" && active(q))
          .sort((a, b) => dist(a, attack) - dist(b, attack))
          .slice(0, 2);
        if (nearest.includes(p)) {
          p.mode = "press";
          tx = attack.x;
          ty = attack.y;
        } else {
          p.mode = "recover";
          tx = clamp(tx + (attack.x - 52.5) * 0.35 - d * 7, 4, 101);
          ty = p.homeY + (attack.y - 34) * 0.25;
          const threat=m.players.filter(q=>q.team!==p.team&&q.pos!=='GK'&&active(q)&&dist(q,p)<18).sort((a,b)=>dist(a,p)-dist(b,p))[0];
          if(threat){tx=tx*.65+(threat.x-d*3)*.35;ty=ty*.6+threat.y*.4;}
        }
      }
    }
    if (m.ball.flight && m.ball.flight.to === p.id) {
      tx = m.ball.flight.x;
      ty = m.ball.flight.y;
      p.mode = "support";
    }
    if (p.id === m.userId && m.userOnPitch !== false && owner?.id !== p.id) {
      if (m.offball === "run") {
        tx = clamp(tx + d * 14, 5, 100);
        p.mode = "attack";
      }
      if (m.offball === "press") {
        tx = m.ball.x;
        ty = m.ball.y;
        p.mode = "press";
      }
      if (m.offball === "defend") {
        tx -= d * 12;
        p.mode = "recover";
      }
      if (m.offball === "call" && owner?.team === p.team) {
        tx = owner.x + d * 9;
        ty = owner.y + (p.y < 34 ? -10 : 10);
      }
    }
    if (p.pos === "GK") {
      tx = d > 0 ? 5 : 100;
      ty = clamp(34 + (m.ball.y - 34) * 0.18, 27, 41);
    }
    const distance = Math.hypot(tx - p.x, ty - p.y),
      v =
        (2.6 + p.a.speed / 32) *
        (0.55 + p.energy / 222) *
        (owner?.id === p.id ? 0.68 : 1) *
        dt;
    const ratio = Math.min(1, v / (distance || 1));
    p.x = clamp(p.x + (tx - p.x) * ratio, 1, 104);
    p.y = clamp(p.y + (ty - p.y) * ratio, 1, 67);
  }
  if (m.ball.flight) {
    const f = m.ball.flight;
    f.progress += dt / f.duration;
    const u = Math.min(1, f.progress);
    m.ball.x = f.startX + (f.x - f.startX) * u;
    m.ball.y = f.startY + (f.y - f.startY) * u;
    if (u >= 1) {
      const from = m.players[f.from];
      if (f.kind === "shot") {
        if (f.success) {
          m.score[from.team]++;
          for (const defender of m.players) if(defender.team!==from.team && active(defender)) defender.stats.goalsConceded=(defender.stats.goalsConceded??0)+1;
          from.stats.goals++;
          const assister = m.lastPass?.to === from.id && m.clock - m.lastPass.time < 90 ? m.players[m.lastPass.from] : null;
          if (assister) assister.stats.assists++;
          // 분위기 메이커: the conceding team's momentum ends; a scorer/assister with the effect starts it.
          if (m.momentum) m.momentum[1 - from.team] = 0;
          const mood = from.fx?.momentum ?? (assister?.team === from.team ? assister.fx?.momentum : undefined);
          if (mood) {
            (m.momentum ??= [0, 0])[from.team] = m.clock + mood.seconds;
            (m.momentumDrain ??= [1, 1])[from.team] = mood.drain;
            event(m, "분위기 메이커! 팀의 체력 소모가 줄어듭니다");
          }
          event(m, `GOAL! ${from.name} · ${m.score[0]} : ${m.score[1]}`);
          kickoff(m, (1 - from.team) as 0 | 1);
        } else {
          const g =
            m.players.find(
              (p) => p.team !== from.team && p.pos === "GK" && active(p),
            ) || m.players.find((p) => p.team !== from.team && active(p))!;
          if (f.onTarget) g.stats.saves++;
          own(m, g);
          event(m, "골키퍼 처리 · 공격 전환");
        }
      } else {
        const target = m.players[f.to!];
        if (f.success && active(target)) {
          from.stats.completed++;
          if ((f.x - f.startX) * direction(m, from.team) >= 10) {
            from.stats.progressivePasses = (from.stats.progressivePasses ?? 0) + 1;
          }
          m.lastPass = { from: from.id, to: target.id, time: m.clock };
          target.x = f.x;
          target.y = f.y;
          own(m, target);
          if (from.fx?.playmaker && target.team === from.team && target.id !== from.id)
            m.assistBoost = { to: target.id, mult: 1 + from.fx.playmaker };
        } else {
          const o = m.players
            .filter((p) => p.team !== from.team && active(p))
            .sort((a, b) => dist(a, m.ball) - dist(b, m.ball))[0];
          o.stats.interceptions++;
          from.stats.losses++;
          own(m, o);
          turnover(m, from, o);
          m.lastPass = null;
        }
      }
    }
  } else if (owner) {
    m.ball.x = owner.x;
    m.ball.y = owner.y;
    if (m.cooldown <= 0) {
      const near = m.players
        .filter(
          (p) => p.team !== owner.team && active(p) && dist(p, owner) < 2.3,
        )
        .sort((a, b) => dist(a, owner) - dist(b, owner))[0];
      if (near && random(m) < dt * 0.16) {
        insightAttempt(m,near,['defending']);
        if (random(m) < 0.16) {
          event(m, `${near.name} · 파울, 프리킥`);
          if (random(m) < 0.24) {
            near.yellow++;
            event(m, `${near.name} · 경고`);
            if (near.yellow >= 2) {
              near.red = true;
              event(m, `${near.name} · 퇴장`);
            }
          }
          m.cooldown = 3;
          owner.x = clamp(owner.x, 4, 101);
        } else if (
          random(m) <
          0.4 + (near.a.defending - owner.a.control) / 180
        ) {
          near.stats.tackles++;
          owner.stats.losses++;
          own(m, near);
          turnover(m, owner, near);
          m.cooldown = 1;
        }
      }
      if (m.ball.owner === owner.id && m.nextAI <= 0) {
        if (owner.id === m.userId && m.userOnPitch !== false && !auto) {
          m.decision = true;
        } else act(m, chooseAction(m, owner));
      }
    }
  }
}
export function finishMatch(m: Match) {
  let limit = 0;
  while (!m.ended && limit++ < 12000) step(m, 0.5, true);
  if (!m.ended) throw Error("Match tick limit");
  return m;
}
export function rating(p: Footballer) {
  const s = p.stats;
  const midfielder = p.pos === "CM";
  const failedPasses = Math.max(0, s.passes - s.completed);
  // A short, safe pass loop has a limited reward. Threat creation has its own caps.
  const accuracy = s.passes ? (s.completed / s.passes - .7) * Math.min(1, s.passes / 10) * .8 : 0;
  const distribution = Math.min(midfielder ? .5 : .3, s.completed * (midfielder ? .018 : .01));
  const progression = Math.min(.65, (s.progressivePasses ?? 0) * (midfielder ? .065 : .045));
  const creation = Math.min(1.2, (s.keyPasses ?? 0) * (midfielder ? .22 : .12) + (s.expectedAssists ?? 0) * (midfielder ? .5 : .3));
  // Failed passes already reduce accuracy; do not charge the full turnover penalty twice.
  const turnovers = Math.min(1.5, Math.max(0, s.losses - failedPasses) * .035 + failedPasses * .008);
  return clamp(
    6 + s.goals * (p.pos === "ST" ? .45 : .65) + s.assists * .45 +
    accuracy + distribution + progression + creation +
    Math.min(.8, (s.tackles + s.interceptions) * (["CB", "LB", "RB"].includes(p.pos) ? .075 : midfielder ? .04 : .012)) +
    Math.min(1.3, s.saves * .13) +
    Math.min(.45, (s.grit ?? 0) * .15) +
    ((p.pos==='GK'||['CB','LB','RB'].includes(p.pos)) && s.minutes>=60 && s.goalsConceded===0 ? .45 : 0) -
    (['GK','CB','LB','RB'].includes(p.pos) ? (s.goalsConceded??0)*.06 : 0) - turnovers - p.yellow * .15 - (p.red ? .7 : 0),
    3, 10,
  );
}

export function userPerformance(m:Match):Footballer {
 const p=m.players[m.userId];
 return {...p,energy:m.userFinalEnergy??p.energy,stats:m.userFinalStats??(m.userOnPitch===false?emptyStats():p.stats)};
}
