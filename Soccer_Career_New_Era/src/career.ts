import {ensureDevelopment,configureTrait,applyInsights,playRival,afterScheduledMatch,announceOffers,ageRival,news,syncRival,type Development} from './development';
import {ROLE_KEYS,roleAbility} from './roles';
import {newWorld,clubOf,nextOpponent,chooseLineup,selectionScore,advanceLeague,startPostseason,advanceCup,sortedTable,LEAGUES,advanceWorldYear,type World,type RosterPlayer} from './world';
import {createMatch,userPerformance} from './engine';
import {
  ATTRS,
  attributes,
  clamp,
  random,
  rating,
  type Attributes,
  type Attr,
  type Position,
  type Match,
  type Stat,
} from "./engine";
export const SCHOOLS = [
  {
    name: "부산 해온고",
    area: "부산",
    style: "패스 & 움직임",
    boost: "passing",
  },
  {
    name: "서울 한울고",
    area: "서울",
    style: "빠른 공격 전환",
    boost: "speed",
  },
  {
    name: "수원 청명고",
    area: "경기",
    style: "탄탄한 수비 조직",
    boost: "defending",
  },
];
export type Player = {
  name: string;
  age: number;
  pos: Position;
  secondary: Position;
  foot: string;
  height: number;
  weight: number;
  style: string;
  curve: string;
  a: Attributes;
  potential: number;
  learning: number;
  energy: number;
  fatigue: number;
  trust: number;
  injuryWeeks?: number;
};
export type Result = {
  id: number;
  date: string;
  opponent: string;
  score: [number, number];
  rating: number;
  stats: Stat;
  shots: [number, number];
  xg: [number, number];
  gain: number;
  year?:number;
  competition?:string;
};
export type Career = {
  version: 4;
  development: Development;
  world: World;
  seed: number;
  player: Player;
  school: number;
  day: number;
  week: number;
  trainingCount: number;
  history: Result[];
  growth: { week: number; overall: number }[];
  feed: string[];
  match: Match | null;
};
export const dateOf = (day: number) =>
  new Date(Date.UTC(2026, 2, 2 + day)).toISOString().slice(0, 10);
export const opponentOf=(c:Career)=>c.world?nextOpponent(c.world).name:'친선 상대';
export const teamName=(c:Career)=>c.world?.phase==='national'?'대한민국 대표팀':c.world?clubOf(c.world).name:SCHOOLS[c.school].name;
export const competitionName=(c:Career)=>!c.world?'친선 경기':c.world.phase==='league'?LEAGUES[clubOf(c.world).league]:c.world.phase==='cup'?'국내 컵':c.world.phase==='international'?'대륙 클럽 컵':c.world.phase==='national'?'국제 초청대회':'시즌 종료';
export function newCareer(
  p: Omit<
    Player,
    "a" | "potential" | "learning" | "energy" | "fatigue" | "trust"
  >,
  school: number,
  seed = 2026,
): Career {
  const r = { seed },
    a = attributes(43);
  for (const k of ATTRS) a[k] += random(r) * 10;
  if (p.pos === "ST") a.shooting += 9;
  if (p.pos === "CM") {
    a.passing += 7;
    a.vision += 7;
  }
  if (["CB", "LB", "RB"].includes(p.pos)) {
    a.defending += 10;
    a.strength += 5;
  }
  if (["LW", "RW"].includes(p.pos)) {
    a.speed += 8;
    a.dribbling += 8;
  }
  if (p.style === "테크니션") {
    a.control += 6;
    a.dribbling += 4;
  }
  if (p.style === "피지컬") {
    a.strength += 6;
    a.stamina += 4;
  }
  if (p.style === "플레이메이커") {
    a.passing += 5;
    a.vision += 5;
  }
  const c = {
    version: 4,
    world: newWorld(seed,school),
    seed: r.seed,
    player: {
      ...p,
      a,
      potential: 76 + random(r) * 13,
      learning: 0.85 + random(r) * 0.3,
      energy: 100,
      fatigue: 0,
      trust: 50,
    },
    school,
    day: 0,
    week: 0,
    trainingCount: 0,
    history: [],
    growth: [{ week: 0, overall: roleAbility(a,p.pos) }],
    feed: [
      `${SCHOOLS[school].name} 축구부 입단 · 등번호 10번의 여정이 시작됩니다.`,
    ],
    match: null,
  } as unknown as Career;
  ensureDevelopment(c);return c;
}
export const TRAINING = {
  shooting: {
    label: "피니시 훈련",
    desc: "슈팅 · 침착성 · 위치선정",
    keys: ["shooting", "composure", "positioning"],
  },
  passing: {
    label: "패스 & 시야",
    desc: "패스 · 시야 · 판단력",
    keys: ["passing", "vision", "decisions"],
  },
  dribbling: {
    label: "볼 마스터리",
    desc: "드리블 · 볼 컨트롤 · 가속도",
    keys: ["dribbling", "control", "acceleration"],
  },
  physical: {
    label: "피지컬 훈련",
    desc: "체력 · 스피드 · 몸싸움",
    keys: ["stamina", "speed", "strength"],
  },
  defending: {
    label: "수비 조직",
    desc: "수비 · 위치선정 · 판단력",
    keys: ["defending", "positioning", "decisions"],
  },
  rest: { label: "회복 & 휴식", desc: "컨디션 회복 · 피로 감소", keys: [] },
} as const;
export type Training = keyof typeof TRAINING;
export function grow(p: Player, keys: readonly string[], amount: number) {
  let total = 0;
  const curve =
    p.curve === "조기 성장형" ? (p.age < 20 ? 1.2 : p.age < 25 ? .8 : .5) : p.curve === "대기만성형" ? (p.age < 20 ? .85 : p.age < 28 ? 1.2 : .7) : (p.age < 25 ? 1 : .7);
  for (const key of keys) {
    const k = key as Attr;
    const gain =
      amount *
      p.learning *
      curve *
      clamp((p.potential - p.a[k]) / 45, 0, 0.95) *
      (0.4 + p.energy / 167);
    const actual=Math.min(Math.max(p.potential,p.a[k]),p.a[k]+gain)-p.a[k];
    p.a[k]+=actual;total+=actual;
  }
  return total;
}
/**
 * Legacy 0.2 training (3 sessions per week with intensity). The game UI now uses
 * the 7-day schedule in development.ts (applyDaily); this remains only because
 * existing tests exercise growth limits through it. Note that the training-injury
 * roll below exists only here, so the weekly schedule currently has no training injuries.
 */
export function train(c: Career, type: Training, intensity: number) {
  if (c.world?.phase === "retired") throw Error("은퇴한 커리어입니다.");
  if (c.match || c.trainingCount >= 3)
    throw Error("이번 주 훈련이 끝났습니다. 경기에 출전해 주세요.");
  const p = c.player;
  if (type !== "rest" && p.energy < 30)
    throw Error("컨디션이 낮습니다. 회복을 선택해 주세요.");
  let gain = 0;
  if (type === "rest") {
    p.energy = clamp(p.energy + 30, 0, 100);
    p.fatigue = Math.max(0, p.fatigue - 25);
  } else {
    if (p.injuryWeeks) throw Error('부상 회복 중에는 휴식을 선택해 주세요.');
    gain = grow(p, TRAINING[type].keys, 0.33 * intensity * (c.world?clubOf(c.world).development:1));
    if(intensity>1 && p.fatigue>50 && random(c)<.06){p.injuryWeeks=1;c.feed.unshift('훈련 중 근육 부상 · 다음 경기 휴식');}
    p.energy = clamp(p.energy - 9 * intensity, 0, 100);
    p.fatigue = clamp(p.fatigue + 6 * intensity, 0, 100);
    p.trust = clamp(p.trust + 0.3, 0, 100);
  }
  c.trainingCount++;
  c.day++;
  c.feed.unshift(
    `${dateOf(c.day)} · ${TRAINING[type].label}${gain ? ` · 능력치 합계 +${gain.toFixed(2)}` : " · 컨디션 +30"}`,
  );
  c.feed = c.feed.slice(0, 30);
  return gain;
}
export function settle(c: Career) {
  const m = c.match;
  if (!m?.ended) throw Error("경기가 아직 진행 중입니다.");
  if (c.history.some((r) => r.id === c.week))
    throw Error("이미 반영된 경기입니다.");
  ensureDevelopment(c);applyInsights(c,m);
  const rivalResult=playRival(c,m);
  const p = userPerformance(m),
    r = rating(p),
    keys: Attr[] = ROLE_KEYS[c.player.pos];
  const appeared=p.stats.minutes>0;
  const gain = appeared ? grow(c.player, keys, (0.2 + (r - 5) * 0.06)*Math.min(1,p.stats.minutes/75)) : 0;
  c.player.trust = clamp(c.player.trust + (appeared?(r - 6) * 2:0), 0, 100);
  c.player.potential = Math.min(94, c.player.potential + (appeared&&r >= 7 ? 0.015 : 0));
  c.player.energy = appeared?clamp(p.energy + 30, 20, 100):Math.min(100,c.player.energy+20);
  c.player.fatigue = Math.max(0, c.player.fatigue - 15);
  c.history.unshift({
    id: c.week,
    date: dateOf(c.development.active?c.day:c.week * 7 + 5),
    opponent: opponentOf(c),
    score: [...m.score],
    rating: appeared?r:0,
    year:c.world?.year,
    competition:m.competition??"친선 경기",
    stats: { ...p.stats },
    shots: [...m.shots],
    xg: [...m.xg],
    gain,
  });
  if(appeared&&r>=7.5)news(c,`${c.player.name} · 평점 ${r.toFixed(2)}의 맹활약!`,'rating');
  if(c.world && m.competition){
    for(const [i,fp] of m.players.entries()){
      const id=m.rosterIds?.[i];const rp=c.world.clubs.flatMap(x=>x.roster).find(x=>x.id===id);
      if(rp){rp.energy=fp.energy;rp.form=rating(fp);rp.goals+=fp.stats.goals;rp.appearances++;}
    }
    for(const replaced of m.replacedPlayers??[]){const rp=c.world.clubs.flatMap(x=>x.roster).find(x=>x.id===replaced.rosterId);if(rp){rp.energy=replaced.player.energy;rp.form=rating(replaced.player);rp.goals+=replaced.player.stats.goals;rp.appearances++;}}

    const w=c.world;
    if(w.phase==='league'){advanceLeague(w,m.score,rivalResult);if(w.round===10)startPostseason(w,roleAbility(c.player.a,c.player.pos),c.player.age);}
    else {if(w.phase==='national'&&appeared){w.nationalCaps++;w.nationalGoals+=p.stats.goals;}
      const won=m.score[0]===m.score[1]?random(w)<.5:m.score[0]>m.score[1];
      if(m.score[0]===m.score[1])c.feed.unshift(`무승부 · 승부차기 ${won?'승리':'패배'} (간소화 판정)`);
      advanceCup(w,won,roleAbility(c.player.a,c.player.pos),c.player.age);
    }
    for(const club of w.clubs)for(const rp of club.roster)rp.energy=Math.min(100,rp.energy+8);
    if(w.phase==='offseason')completeSeason(c);
  }
  if(c.player.injuryWeeks)c.player.injuryWeeks--;
  if(appeared&&p.energy<35&&random(c)<.04){c.player.injuryWeeks=2;c.feed.unshift('경기 후 근육 부상 · 2경기 회복');}

  c.feed.unshift(
    `경기 종료 · 평점 ${appeared?r.toFixed(1):"출전 없음"} · 감독 신뢰 ${c.player.trust.toFixed(0)}`,
  );
  c.match = null;afterScheduledMatch(c);
}

export function selection(c:Career){
 const club=clubOf(c.world),p=c.player;
 const recent=c.history.filter(r=>r.stats.minutes>0).slice(0,5);
 const hero:RosterPlayer&{secondary:Position}={id:'hero',name:p.name,pos:p.pos,secondary:p.secondary,age:p.age,a:p.a,potential:p.potential,energy:p.energy,form:recent.length?recent.reduce((n,r)=>n+r.rating,0)/recent.length:6.5,goals:0,appearances:0,years:0};
 const lineup=chooseLineup(club,p.injuryWeeks?undefined:hero),index=lineup.findIndex(x=>x.id==='hero');
 const targetIndex=Math.max(0,lineup.findIndex(x=>x.slotPos===p.pos));
 const competitor=lineup[targetIndex];
 const yourScore=selectionScore(p.a,p.pos,p.pos,p.age,p.energy,hero.form,club.coach,p.secondary);
 const rivalScore=selectionScore(competitor.a,competitor.pos,p.pos,competitor.age,competitor.energy,competitor.form,club.coach);
 return {lineup,hero,index,targetIndex,yourScore,rivalScore,role:p.injuryWeeks?'부상 결장':index>=0?'선발':yourScore>=rivalScore-16?'교체 대기':'명단 제외'};
}
export function startCareerMatch(c:Career){
 ensureDevelopment(c);syncRival(c);
 if(c.match)throw Error('이미 진행 중인 경기입니다.');
 if(['offseason','retired'].includes(c.world.phase))throw Error('시즌 메뉴에서 다음 진행을 선택하세요.');
 const w=c.world,own=clubOf(w),other=nextOpponent(w),plan=selection(c);
 const m=createMatch(c.seed+c.week*7919,{name:c.player.name,pos:c.player.pos,a:c.player.a,energy:c.player.energy},other.strength);
 m.competition=competitionName(c);m.tactics=[own.coach.style,other.club?.coach.style??'역습'];
 if(w.phase==='national'){m.userOnPitch=!c.player.injuryWeeks;if(!m.userOnPitch)m.players[m.userId].name='대표팀 동료';configureTrait(c,m);c.match=m;return;}
 const lineup=plan.lineup;const opposition=other.club?chooseLineup(other.club):null;
 for(let t=0;t<2;t++)for(let i=0;i<11;i++){
   const source=(t?opposition:lineup)?.[i],slot=m.players[t*11+i];if(!source)continue;
   slot.name=source.name;slot.a={...source.a};slot.energy=source.energy;slot.pos=source.slotPos;
   slot.number=source.id==='hero'?10:i+1;
   const fourFour=(t?other.club?.coach:own.coach)?.formation==='4-4-2';
   if(fourFour){const anchors=[[5,34],[25,10],[21,26],[21,42],[25,58],[46,9],[40,25],[40,43],[46,59],[67,25],[67,43]];slot.homeX=anchors[i][0];slot.homeY=anchors[i][1];slot.x=t?105-slot.homeX:slot.homeX;slot.y=slot.homeY;}
 }
 m.rosterIds=[...lineup.map(p=>p.id),...(opposition?.map(p=>p.id)??[])];
 m.userId=plan.index>=0?plan.index:plan.targetIndex;m.userOnPitch=plan.index>=0;
 if(!m.userOnPitch&&plan.role==='교체 대기')m.benchEntry={minute:60,name:c.player.name,a:{...c.player.a},energy:c.player.energy,number:10};
 if(m.userOnPitch&&c.player.energy<70){
   const replacement=own.roster.filter(r=>!lineup.some(x=>x.id===r.id)).sort((a,b)=>selectionScore(b.a,b.pos,c.player.pos,b.age,b.energy,b.form,own.coach)-selectionScore(a.a,a.pos,c.player.pos,a.age,a.energy,a.form,own.coach))[0];
   if(replacement){m.userExitMinute=65;m.exitReplacement={name:replacement.name,a:{...replacement.a},energy:replacement.energy,number:19,rosterId:replacement.id};}
 }
 if(m.userOnPitch&&m.userId!==9)m.players[9].number=m.userId+1;
 if(m.ball.owner!==null){m.ball.x=m.players[m.ball.owner].x;m.ball.y=m.players[m.ball.owner].y;}
 m.decision=m.ball.owner===m.userId&&m.userOnPitch;
 configureTrait(c,m);c.match=m;
}
function completeSeason(c:Career){
 const w=c.world,club=clubOf(w),ranked=sortedTable(w),rank=ranked.findIndex(t=>t.id===club.id)+1;
 const results=c.history.filter(r=>r.year===w.year&&r.competition!=='국제 초청대회'&&r.competition!=='친선 경기');
 const played=results.filter(r=>r.stats.minutes>0),mean=played.length?played.reduce((n,r)=>n+r.rating,0)/played.length:0;
 w.records.push({year:w.year,club:club.name,league:LEAGUES[club.league],rank,appearances:played.length,minutes:played.reduce((n,r)=>n+r.stats.minutes,0),goals:played.reduce((n,r)=>n+r.stats.goals,0),assists:played.reduce((n,r)=>n+r.stats.assists,0),rating:mean,champion:w.clubs.find(x=>x.id===ranked[0].id)!.name});
 if(rank===1)w.achievements.unshift(`${w.year} ${LEAGUES[club.league]} 우승`);
 if(played.length>=6&&mean>=7.5)w.achievements.unshift(`${w.year} 시즌 베스트 선수`);
 const pay=Math.min(club.budget,w.contract.salary);club.budget-=pay;w.wealth+=pay;w.contract.years=Math.max(0,w.contract.years-1);
 c.development.wallet+=pay;announceOffers(c);
 c.feed.unshift(`${w.year} 시즌 종료 · ${rank}위 · 평균 ${mean.toFixed(2)}`);
}
export function nextSeason(c:Career){
 ensureDevelopment(c);if(c.development.active)throw Error('진행 중인 주간 일정을 완료하세요.');const w=c.world;if(w.phase!=='offseason')throw Error('시즌 종료 후 가능합니다.');
 if(c.player.age>=18&&clubOf(w).league===0)throw Error('졸업 예정입니다. 이적 시장에서 프로 계약을 선택해 주세요.');
 if(clubOf(w).league>0&&w.contract.years===0)throw Error('계약이 만료되었습니다. 재계약 또는 이적을 선택해 주세요.');
 c.player.age++;ageRival(c);if(c.player.age>=36){w.year++;retire(c);return;}
 if(c.player.age>29)for(const k of ['speed','acceleration','stamina'] as Attr[])c.player.a[k]=Math.max(20,c.player.a[k]-.8);
 advanceWorldYear(w);syncRival(c);c.week=Math.max(c.week,Math.round((w.year-2026)*365.25/7));c.day=c.week*7;w.currentDay=c.day;w.currentSeasonStart=c.week;
 c.player.energy=100;c.player.fatigue=0;c.player.injuryWeeks=0;c.trainingCount=0;c.feed.unshift(`${w.year} 새 시즌 · ${teamName(c)} · ${c.player.age}세`);
}
export function retire(c:Career){if(c.match)throw Error('진행 중인 경기를 완료하세요.');c.world.phase='retired';c.world.achievements.unshift(`${c.world.year} ${c.player.name} 은퇴 · 커리어 기록 보존`);}
