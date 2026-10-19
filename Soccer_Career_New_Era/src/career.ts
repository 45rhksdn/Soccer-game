import {recordConnections,recordMove,matchOccasion,type CareerConnections} from './careerMoments';
import {makeStory,recordAge,storySchool,type PlayerStory} from './origins';
import {returnFromLoan,acceptOffer} from './world';
import {growthPace,ensureDevelopment,configureTrait,applyInsights,playRival,afterScheduledMatch,announceOffers,ageRival,news,syncRival,finishWeek,type Development} from './development';
import {ROLE_KEYS,roleAbility} from './roles';
import {matchInjury,npcRecovery,clearInjuries,newWorld,clubOf,nextOpponent,chooseLineup,selectionScore,advanceLeague,startPostseason,advanceCup,sortedTable,LEAGUES,advanceWorldYear,matchupFor,resolveWeek,type World,type RosterPlayer,type Matchup,type WeekResults} from './world';
import {newSchoolSeason,stageReached,scoutBonusFor,schoolRank,SEASON_WEEKS,type Bracket} from './season';
import {createMatch,userPerformance} from './engine';
import {injuryChanceMultiplier,injuryWeeks,matchFx,trustGainMultiplier,seedFrom} from './traits';
import {matchAttributesOf} from './equipment';
import {createMission,settleMission,recordDeeds,deedsOf,type MissionState,type Signature} from './engagement';
import {growthAgeFactor,experienceAgeFactor,applyAging,EXPERIENCE_KEYS} from './aging';
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
  /** 0.15 squad status from coach trust (with hysteresis) and the last match's trust change. */
  status?: SquadStatus;
  lastTrust?: number;
  injuryWeeks?: number;
};
/** 0.15 squad status: 80+ 핵심 주전, 55+ 주전 (63 needed to regain it), 35+ 로테이션 (60′ sub), below 후보. */
export type SquadStatus='핵심 주전'|'주전'|'로테이션'|'후보';
export const STATUS={core:80,starter:55,regain:63,rotation:35} as const;
export function nextStatus(trust:number,prev:SquadStatus|undefined):SquadStatus{
  if(trust>=STATUS.core)return '핵심 주전';
  if(trust>=STATUS.regain)return '주전';
  if(trust>=STATUS.starter)return prev==='주전'||prev==='핵심 주전'?'주전':'로테이션';
  return trust>=STATUS.rotation?'로테이션':'후보';
}
/** Saves without a status (pre-0.15) are treated as 주전 from 55 (no demotion just for upgrading). */
export const statusOf=(p:Player)=>p.status??nextStatus(p.trust,'주전');
/** 0.15 trust change from the match rating (two decimals, as shown) scaled by minutes; ≤ 6.5 always costs at least 1. */
export const TRUST_BY_RATING:[number,number][]=[[5.5,-12],[6,-9],[6.5,-5],[7,3],[7.5,6],[Infinity,10]];
export function ratingTrust(rating:number,minutes:number,traits:readonly string[]){
  if(minutes<=0)return 0;
  const r=Math.round(rating*100)/100,base=r<5.5?-12:r<6?-9:r<=6.5?-5:r<7?3:r<7.5?6:10,share=minutes>=45?1:minutes>=20?.65:.25;
  const delta=base>0?base*share*trustGainMultiplier(traits):base*share;
  return r<=6.5?Math.min(-1,delta):delta;
}
/** A mission bonus never turns a poor match (rating ≤ 6.5 at the shown precision) into a net trust gain: at least −1. */
export const capTrust=(before:number,after:number,rating:number,appeared:boolean)=>appeared&&Math.round(rating*100)/100<=6.5&&after>before-1?clamp(before-1,0,100):after;
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
  /** 0.15 club the match was played for (season records after a mid-season transfer). */
  club?:string;
  /** 0.15 match type (friendlies and national-team matches are left out of club season records). */
  kind?:string;
};
/** Optional link to a real school from the catalogue; `school` (0–2) stays the world slot for compatibility. */
export type SchoolRef={id:string,name:string,region:string};
/** Values chosen in scouting that override the generated starting profile. */
export type CareerPreset={a?:Attributes,potential?:number,learning?:number,traits?:string[],schoolRef?:SchoolRef,
  /** 0.14 the scouting card's id, so the signed player keeps the story shown on the card. */ storyId?:string,
 /** Unique player id (retirement rewards are granted once per id). Defaults to a value derived from the seed. */
 id?:string,
 /** Account-wide max-potential increase from retirements (legacy.ts); only raises the top of the random range. */
 potentialBonus?:number};
export type Career = {
  version: 10;
  connections?:CareerConnections;
  /** Stable player id (0.5): same across backups/archives of this player, different for every new player. */
  id?: string;
  schoolRef?: SchoolRef;
  story?: PlayerStory;
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
export const opponentOf=(c:Career)=>c.world?.calendar?currentMatchup(c)?.opponentName??'시즌 종료':c.world?nextOpponent(c.world).name:'친선 상대';
export const teamName=(c:Career)=>(c.world?.calendar?currentMatchup(c)?.national:c.world?.phase==='national')?'대한민국 대표팀':c.world?clubOf(c.world).name:SCHOOLS[c.school].name;
/** 0.15 national-team call-up for the invitational weeks (as before: 19+, position ability 66+, fit). */
export const nationalSelected=(c:Career)=>c.player.age>=19&&roleAbility(c.player.a,c.player.pos)>=66&&!c.player.injuryWeeks;
/** 0.15 this week's match of the user's club (undefined: a pre-0.15 season or the season is over). */
export const currentMatchup=(c:Career):Matchup|undefined=>{const s=c.world?.season;if(!c.world?.calendar||!s)return undefined;
 const national=s.pending?.week===s.played?s.pending.national:nationalSelected(c);return matchupFor(c.world,c.world.clubId,{nationalSelected:national});};
export const isBigMatch=(c:Career)=>c.world?.calendar?!!currentMatchup(c)?.big:c.world.phase!=='league';
export const competitionName=(c:Career)=>!c.world?'친선 경기':c.world.calendar?currentMatchup(c)?.competition??'시즌 종료':c.world.phase==='league'?LEAGUES[clubOf(c.world).league]:c.world.phase==='cup'?'국내 컵':c.world.phase==='international'?'대륙 클럽 컵':c.world.phase==='national'?'국제 초청대회':'시즌 종료';
export function newCareer(
  p: Omit<
    Player,
    "a" | "potential" | "learning" | "energy" | "fatigue" | "trust"
  >,
  school: number,
  seed = 2026,
  preset: CareerPreset = {},
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
    version: 10,
    id: preset.id ?? `p-${seedFrom(seed >>> 0, `${p.name}|${p.pos}|${school}`).toString(36)}`,
    world: newWorld(seed,school),
    seed: r.seed,
    player: {
      ...p,
      a,
      potential: 76 + random(r) * (13 + Math.max(0, preset.potentialBonus ?? 0)),
      learning: 0.85 + random(r) * 0.3,
      energy: 100,
      fatigue: 0,
      // 0.15 a new school player starts as a regular starter (주전 band) for his school coach
      trust: 60,
      status: '주전',
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
  if(preset.a){c.player.a={...preset.a};c.growth=[{week:0,overall:roleAbility(c.player.a,p.pos)}];}
  if(preset.potential!==undefined)c.player.potential=preset.potential;
  if(preset.learning!==undefined)c.player.learning=preset.learning;
  if(preset.schoolRef){c.schoolRef={...preset.schoolRef};const club=c.world.clubs.find(x=>x.id===c.world.clubId);if(club)club.name=preset.schoolRef.name;c.feed=[`${preset.schoolRef.name} 축구부 입단 · 등번호 10번의 여정이 시작됩니다.`];}
  // 0.15 the school competitions know which entrant is the user's school (a real school or the fictional slot).
  c.world.userSchool={clubId:'c'+school,schoolId:preset.schoolRef?.id};if(c.world.season)c.world.season.school=newSchoolSeason(c.world,c.world.userSchool);
  c.story=makeStory(c.player,c.schoolRef?storySchool(c.schoolRef):{name:SCHOOLS[school].name,region:SCHOOLS[school].area},preset.storyId??c.id,preset.traits);
  ensureDevelopment(c,{traits:preset.traits});return c;
}
/** Match-experience growth per full match (game-reading attributes, see aging.ts). */
export const MATCH_EXPERIENCE = 0.08;
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
/** Coach-trust change after a match: trait multipliers scale gains only, never losses. */
export const trustChange = (traits: readonly string[], delta: number) => (delta > 0 ? delta * trustGainMultiplier(traits) : delta);
/**
 * Permanent growth towards the potential cap. `ageFactor` defaults to the age model of the
 * player's growth curve (aging.ts); match experience passes its own factor.
 */
export function grow(p: Player, keys: readonly string[], amount: number, ageFactor = growthAgeFactor(p.curve, p.age)) {
  let total = 0;
  const curve = ageFactor;
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
/** 0.9: what settle earned besides the match record (shown by the UI). */
export type SettleResult={mission?:MissionState,signatures:Signature[]};
export function settle(c: Career):SettleResult {
  const m = c.match;
  if (!m?.ended) throw Error("경기가 아직 진행 중입니다.");
  if (c.history.some((r) => r.id === c.week))
    throw Error("이미 반영된 경기입니다.");
  ensureDevelopment(c);deedsOf(c); // older saves seed the deeds from the history before this match is added
  const insight=applyInsights(c,m);
  const rivalResult=playRival(c,m);
  const week=c.world?.calendar?currentMatchup(c):undefined,weekKind=week?(week.friendly?'friendly':week.kind):undefined;
  const p = userPerformance(m),
    r = rating(p),
    keys: Attr[] = ROLE_KEYS[c.player.pos];
  const appeared=p.stats.minutes>0;
  const share = Math.min(1, p.stats.minutes / 75)*growthPace(c);
  // Match growth (role attributes, by form) plus match experience (game reading), which keeps working up to the peak.
  const gain = appeared ? grow(c.player, keys, (0.2 + (r - 5) * 0.06) * share) + grow(c.player, EXPERIENCE_KEYS, MATCH_EXPERIENCE * share, experienceAgeFactor(c.player.age)) : 0;
  // 0.15 coach trust from the rating (shown precision, minutes-scaled; ≤ 6.5 always costs ≥ 1), applied after the mission below.
  const trustBefore=c.player.trust,ratingDelta=appeared?ratingTrust(r,p.stats.minutes,c.development.traits):0;
  c.player.trust = clamp(c.player.trust + ratingDelta, 0, 100);
  // Good matches nudge the potential up to 94; a higher potential (scouting reward) is never reduced.
  if (appeared && r >= 7 && c.player.potential < 94) c.player.potential = Math.min(94, c.player.potential + 0.015*growthPace(c));
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
    club:c.world?.clubId,
    kind:weekKind,
    stats: { ...p.stats },
    shots: [...m.shots],
    xg: [...m.xg],
    gain,
  });
  if(appeared&&r>=7.5)news(c,`${c.player.name} · 평점 ${r.toFixed(2)}의 맹활약!`,'rating');
  recordConnections(c,m,!!week?.national||m.competition?.includes('초청'));
  const mission=settleMission(c,m),signatures=recordDeeds(c,p.stats);
  // A mission bonus never turns a poor match (≤ 6.5) into a net trust gain.
  c.player.trust=capTrust(trustBefore,c.player.trust,r,appeared);
  c.player.lastTrust=Math.round((c.player.trust-trustBefore)*10)/10;c.player.status=nextStatus(c.player.trust,c.player.status);
  if(c.world && m.competition){
    for(const [i,fp] of m.players.entries()){
      const id=m.rosterIds?.[i];const rp=c.world.clubs.flatMap(x=>x.roster).find(x=>x.id===id);
      if(rp){rp.energy=fp.energy;rp.form=rating(fp);rp.goals+=fp.stats.goals;rp.appearances++;
        // NPCs follow the same match-injury rule as the user (the rival is handled in playRival).
        if(rp.id!==c.development.rival.id&&fp.stats.minutes>0){const weeks=matchInjury(c.seed^c.week,rp.id,fp.energy,rp.traits);if(weeks)rp.injuryWeeks=weeks;}}
    }
    for(const replaced of m.replacedPlayers??[]){const rp=c.world.clubs.flatMap(x=>x.roster).find(x=>x.id===replaced.rosterId);if(rp){rp.energy=replaced.player.energy;rp.form=rating(replaced.player);rp.goals+=replaced.player.stats.goals;rp.appearances++;}}

    const w=c.world;
    if(w.calendar&&w.season){if(week)settleCalendarWeek(c,m,week,p.stats,appeared?r:0,rivalResult);}
    else{
    if(w.phase!=='national'&&(w.contract.trialMatches??0)>0)w.contract.trialMatches!--;
    if(w.phase==='league'){advanceLeague(w,m.score,rivalResult);if(w.round===10)startPostseason(w,roleAbility(c.player.a,c.player.pos),c.player.age);}
    else {if(w.phase==='national'&&appeared){w.nationalCaps++;w.nationalGoals+=p.stats.goals;}
      const won=m.score[0]===m.score[1]?random(w)<.5:m.score[0]>m.score[1];
      if(m.score[0]===m.score[1])c.feed.unshift(`무승부 · 승부차기 ${won?'승리':'패배'} (간소화 판정)`);
      advanceCup(w,won,roleAbility(c.player.a,c.player.pos),c.player.age);
    }
    }
    for(const club of w.clubs)for(const rp of club.roster)rp.energy=Math.min(100,rp.energy+npcRecovery(rp));
    if(w.phase==='offseason')(w.calendar?completeCalendarSeason:completeSeason)(c);
  }
  if(c.player.injuryWeeks)c.player.injuryWeeks--;
  if(appeared&&p.energy<35&&random(c)<.04*injuryChanceMultiplier(c.development.traits)){c.player.injuryWeeks=injuryWeeks(c.development.traits,2);c.feed.unshift(`경기 후 근육 부상 · ${c.player.injuryWeeks}경기 회복`);}

  c.feed.unshift(
    `경기 종료 · 평점 ${appeared?r.toFixed(1):"출전 없음"} · 감독 신뢰 ${c.player.trust.toFixed(0)}`,
  );
  c.match = null;afterScheduledMatch(c,insight);
  return {mission,signatures};
}

export type Selection={lineup:(RosterPlayer&{slotPos:Position,secondary?:Position})[],hero:RosterPlayer&{secondary:Position},index:number,targetIndex:number,yourScore:number,rivalScore:number,role:string,
 /** 0.15 minute the user comes off the bench (로테이션 60′, 후보 75′). */ benchMinute?:number,status?:SquadStatus,guaranteed?:boolean};
export function selection(c:Career):Selection{
 const club=clubOf(c.world),p=c.player;
 const recent=c.history.filter(r=>r.stats.minutes>0).slice(0,5);
 // Selection and the match use match-day attributes (base + equipment).
 const gear=matchAttributesOf(c);
 const hero:RosterPlayer&{secondary:Position}={id:'hero',name:p.name,pos:p.pos,secondary:p.secondary,age:p.age,a:gear,potential:p.potential,energy:p.energy,form:recent.length?recent.reduce((n,r)=>n+r.rating,0)/recent.length:6.5,goals:0,appearances:0,years:0};
 const lineup=chooseLineup(club,p.injuryWeeks?undefined:hero);let index=lineup.findIndex(x=>x.id==='hero');
 const targetIndex=Math.max(0,lineup.findIndex(x=>x.slotPos===p.pos));
 const competitor=lineup[targetIndex];
 const yourScore=selectionScore(gear,p.pos,p.pos,p.age,p.energy,hero.form,club.coach,p.secondary);
 const rivalScore=selectionScore(competitor.a,competitor.pos,p.pos,competitor.age,competitor.energy,competitor.form,club.coach);
 const trial=(c.world.contract.trialMatches??0)>0;
 if(c.world.calendar){
  // 0.15 the coach picks by trust: 핵심 주전 / 주전 start, 로테이션 comes on at 60′, 후보 at 75′ (or is left out).
  // A guaranteed-start contract starts the first available club matches (fit: not injured, energy 50+).
  const status=statusOf(p),guaranteed=trial&&!p.injuryWeeks&&p.energy>=50;
  // position competition still counts, but trust is a real preference: a 주전 starts within 8 of the best rival at his position (핵심 주전 12)
  const start=!p.injuryWeeks&&(guaranteed||(status==='핵심 주전'&&(index>=0||yourScore>=rivalScore-12))||(status==='주전'&&(index>=0||yourScore>=rivalScore-8)));
  if(start&&index<0){lineup[targetIndex]={...hero,slotPos:lineup[targetIndex].slotPos};index=targetIndex;}
  if(!start&&index>=0){const slot=lineup[index].slotPos,repl=club.roster.filter(r=>!r.injuryWeeks&&!lineup.some(x=>x.id===r.id)).sort((a,b)=>selectionScore(b.a,b.pos,slot,b.age,b.energy,b.form,club.coach)-selectionScore(a.a,a.pos,slot,a.age,a.energy,a.form,club.coach))[0];if(repl){lineup[index]={...repl,slotPos:slot};index=-1;}}
  // goalkeepers are not brought on as substitutes (a keeper change mid-match is an injury case only)
  const benchMinute=index>=0||p.injuryWeeks||p.pos==='GK'?undefined:status==='로테이션'||status==='주전'||status==='핵심 주전'?60:yourScore>=rivalScore-16?75:undefined;
  const role=p.injuryWeeks?'부상 결장':index>=0?(guaranteed&&status!=='핵심 주전'&&status!=='주전'?'선발 (주전 보장)':'선발'):benchMinute===60?'교체 대기 · 60분 투입':benchMinute===75?'교체 대기 · 75분 투입':p.pos==='GK'&&!p.injuryWeeks?'벤치 대기 (교체 골키퍼)':'명단 제외';
  return {lineup,hero,index,targetIndex,yourScore,rivalScore,role,benchMinute,status,guaranteed};
 }
 if(!p.injuryWeeks&&index<0&&trial&&p.energy>=70&&yourScore>=rivalScore-3){lineup[targetIndex]={...hero,slotPos:p.pos};index=targetIndex;}
 return {lineup,hero,index,targetIndex,yourScore,rivalScore,role:p.injuryWeeks?'부상 결장':index>=0?'선발':yourScore>=rivalScore-16?'교체 대기':'명단 제외',benchMinute:index<0&&!p.injuryWeeks&&yourScore>=rivalScore-16?60:undefined};
}
export function startCareerMatch(c:Career){
 ensureDevelopment(c);syncRival(c);
 if(c.match)throw Error('이미 진행 중인 경기입니다.');
 if(['offseason','retired'].includes(c.world.phase))throw Error('시즌 메뉴에서 다음 진행을 선택하세요.');
 const w=c.world,own=clubOf(w),mu=currentMatchup(c);if(w.calendar&&!mu)throw Error('이번 시즌 일정이 모두 끝났습니다.');
 const other=nextOpponent(w),plan=selection(c);
 const m=createMatch(c.seed+c.week*7919,{name:c.player.name,pos:c.player.pos,a:matchAttributesOf(c),energy:c.player.energy},mu?.strength??other.strength);
 m.competition=competitionName(c);m.tactics=[own.coach.style,(mu?mu.club:other.club)?.coach.style??'역습'];
 if(mu&&w.season)w.season.pending={week:w.season.played,national:mu.national};
 m.mission=createMission(c);
 if(mu?.national||(!w.calendar&&w.phase==='national')){
  m.userOnPitch=!c.player.injuryWeeks;if(!m.userOnPitch)m.players[m.userId].name='대표팀 동료';
  const rival=c.development.rival;
  if(!rival.retired&&!rival.player.injuryWeeks&&rival.player.age>=19&&roleAbility(rival.player.a,rival.player.pos)>=66){
   const slot=m.players.filter(p=>p.team===0&&p.id!==m.userId&&p.pos===rival.player.pos).sort((a,b)=>roleAbility(a.a,a.pos)-roleAbility(b.a,b.pos))[0];
   if(slot&&roleAbility(rival.player.a,rival.player.pos)>=roleAbility(slot.a,slot.pos)){
    m.rosterIds=m.players.map(p=>p.id===m.userId?'hero':'national-'+p.id);m.rosterIds[slot.id]=rival.id;
    slot.name=rival.player.name;slot.a={...rival.player.a};slot.energy=rival.player.energy;
   }
  }
  matchOccasion(c,m,undefined,true);configureTrait(c,m);c.match=m;return;
 }
 const lineup=plan.lineup,oppClub=mu?mu.club:other.club;
 // 0.15 a real school without its own club in the world plays with a stand-in squad (copied ids, so no NPC record changes).
 const standIn=!!mu&&!!oppClub&&oppClub.league===0&&mu.opponentId!==oppClub.id;
 const opposition=oppClub?chooseLineup(oppClub).map(p=>standIn?{...p,id:'x'+p.id}:p):null;
 for(let t=0;t<2;t++)for(let i=0;i<11;i++){
   const source=(t?opposition:lineup)?.[i],slot=m.players[t*11+i];if(!source)continue;
   slot.name=source.name;slot.a={...source.a};slot.energy=source.energy;slot.pos=source.slotPos;
   slot.number=source.id==='hero'?10:i+1;
   const fourFour=(t?oppClub?.coach:own.coach)?.formation==='4-4-2';
   if(fourFour){const anchors=[[5,34],[25,10],[21,26],[21,42],[25,58],[46,9],[40,25],[40,43],[46,59],[67,25],[67,43]];slot.homeX=anchors[i][0];slot.homeY=anchors[i][1];slot.x=t?105-slot.homeX:slot.homeX;slot.y=slot.homeY;}
 }
 m.rosterIds=[...lineup.map(p=>p.id),...(opposition?.map(p=>p.id)??[])];
 m.userId=plan.index>=0?plan.index:plan.targetIndex;m.userOnPitch=plan.index>=0;
 if(!m.userOnPitch&&plan.benchMinute)m.benchEntry={minute:plan.benchMinute,name:c.player.name,a:matchAttributesOf(c),energy:c.player.energy,number:10};
 // 0.15 a substitute's 감독 미션 is scaled to the minutes left (a 'max' mission is unchanged)
 // a late (75′) substitute gets no mission: too little time for a fair objective
 if(m.benchEntry&&m.benchEntry.minute>=75)m.mission=undefined;
 if(m.benchEntry&&m.mission&&m.mission.cmp!=='max'){const t=Math.max(1,Math.ceil(m.mission.target*(90-m.benchEntry.minute)/90));if(t!==m.mission.target){m.mission.label=m.mission.label.replace(String(m.mission.target),String(t));m.mission.target=t;}}
 if(m.userOnPitch&&c.player.energy<70){
   const replacement=own.roster.filter(r=>!lineup.some(x=>x.id===r.id)).sort((a,b)=>selectionScore(b.a,b.pos,c.player.pos,b.age,b.energy,b.form,own.coach)-selectionScore(a.a,a.pos,c.player.pos,a.age,a.energy,a.form,own.coach))[0];
   if(replacement){m.userExitMinute=65;m.exitReplacement={name:replacement.name,a:{...replacement.a},energy:replacement.energy,number:19,rosterId:replacement.id,fx:matchFx(replacement.traits)};}
 }
 if(m.userOnPitch&&m.userId!==9)m.players[9].number=m.userId+1;
 if(m.ball.owner!==null){m.ball.x=m.players[m.ball.owner].x;m.ball.y=m.players[m.ball.owner].y;}
 m.decision=m.ball.owner===m.userId&&m.userOnPitch;
 matchOccasion(c,m,mu?.opponentId??oppClub?.id);
 configureTrait(c,m);c.match=m;
}
/** 0.15 the calendar part of settle: this week everywhere (resolveWeek), titles, caps, school stats, guaranteed starts. */
function settleCalendarWeek(c:Career,m:Match,mu:Matchup,stats:Stat,r:number,rival:{clubId:string,score:[number,number]}|undefined){
 const w=c.world,s=w.season!,idx=s.played,appeared=stats.minutes>0;
 let won:boolean|undefined;
 if(m.score[0]===m.score[1]&&!mu.friendly&&mu.kind!=='league'&&mu.kind!=='school'){won=random(w)<.5;c.feed.unshift(`무승부 · 승부차기 ${won?'승리':'패배'} (간소화 판정)`);}
 const results:WeekResults=new Map();
 if(!mu.friendly)results.set(mu.national?'KOR':w.clubId,{gf:m.score[0],ga:m.score[1],won});
 if(rival&&!results.has(rival.clubId)&&rival.clubId!==w.clubId)results.set(rival.clubId,{gf:rival.score[0],ga:rival.score[1]});
 const ss=s.school,me=ss?.entrants.find(e=>e.clubId===w.clubId)?.id;
 const watch:[Bracket|undefined,string|undefined,string][]=[[s.cups[clubOf(w).league],w.clubId,`${LEAGUES[clubOf(w).league]} 컵 우승`],[Object.values(s.continental).find(b=>b.rounds[0]?.some(t=>t.a===w.clubId||t.b===w.clubId)),w.clubId,'대륙 클럽 컵 우승'],[mu.national?s.national:undefined,'KOR','국제 초청대회 우승 (대한민국 대표팀)'],
  [me?Object.values(ss!.regional).find(b=>b.rounds[0]?.some(t=>t.a===me||t.b===me)):undefined,me,'지역 토너먼트 우승'],[ss?.national,me,'전국 고교대회 우승']];
 const open=watch.filter(([b])=>b&&!b.champion);
 resolveWeek(w,results);
 s.log.push({week:idx,label:mu.competition,opponent:mu.opponentName,score:[m.score[0],m.score[1]]});
 // Weekly salary: week k pays floor(S·k/35) − floor(S·(k−1)/35), so a full season pays exactly S; each week is paid once.
 payWeeks(c);
 for(const [b,id,label] of open)if(id&&b!.champion===id&&!mu.friendly){w.achievements.unshift(`${w.year} ${label}`);news(c,`${w.year} ${label}!`);}
 if(mu.national&&appeared){w.nationalCaps++;w.nationalGoals+=stats.goals;}
 // Guaranteed starts count club matches the player was available for (national duty and injuries do not use them up).
 if(!mu.national&&!c.player.injuryWeeks&&(w.contract.trialMatches??0)>0)w.contract.trialMatches!--;
 if(mu.kind==='schoolNational'&&!mu.friendly&&ss){const u=ss.user;u.team=(u.team??0)+1;if(appeared){u.matches++;u.minutes+=stats.minutes;u.ratingSum+=r;u.goals+=stats.goals;u.assists+=stats.assists;}}
 if(s.played===16&&clubOf(w).league>0&&w.phase!=='offseason'){news(c,'여름 이적시장 개방 · 17–18주차에 이적·계약 제안을 검토할 수 있습니다.');announceOffers(c,0);}
}
export function payWeeks(c:Career){
 const w=c.world,s=w.season;if(!w.calendar||!s)return 0;let total=0;
 while((s.paid??0)<s.played){const k=(s.paid??0)+1,S=w.contract.salary,club=clubOf(w);
  if(S>0&&club.league>0){const due=Math.floor(S*k/SEASON_WEEKS)-Math.floor(S*(k-1)/SEASON_WEEKS),pay=Math.min(club.budget,due);club.budget-=pay;w.wealth+=pay;c.development.wallet+=pay;total+=pay;}
  s.paid=k;}
 return total;
}
/** Initial coach trust at a new club by the contract: guaranteed start 72, regular starter 60, rotation 45, prospect 35. */
export function initialTrust(o:{role?:string,pitch?:string,trialMatches?:number}){
 if(o.pitch==='주전 보장'||o.role==='주전 도전 계획'||(o.trialMatches??0)>0)return 72;
 return o.role==='핵심 선수'||o.role==='주전 경쟁'?60:o.role==='로테이션'?45:35;
}
/** 0.15 signs an offer (offseason or an in-season window): the old club's trust is logged, the new club starts from the contract's trust. */
export function signOffer(c:Career,clubId:string){
 if(c.match)throw Error('진행 중인 경기를 완료하세요.');
 const w=c.world,from=clubOf(w),offer=w.offers.find(o=>o.clubId===clubId&&o.status==='open');
 acceptOffer(w,clubId,c.player.name);
 recordMove(c,from.id,w.clubId);
 if(w.clubId===from.id)return;
 w.trustLog=[...(w.trustLog??[]),{club:from.name,trust:Math.round(c.player.trust*10)/10,year:w.year}].slice(-20);
 const trust=initialTrust({...offer,trialMatches:w.contract.trialMatches});c.player.trust=trust;c.player.lastTrust=undefined;
 c.player.status=trust>=STATUS.starter?nextStatus(trust,'주전'):nextStatus(trust,undefined);
 if(w.calendar&&w.phase!=='offseason')w.seasonClubs=[...new Set([...(w.seasonClubs??[]),w.clubId])];
 news(c,`${clubOf(w).name} 합류 · 감독 신뢰 ${trust} (${c.player.status}) · 이전 구단 신뢰 ${w.trustLog.at(-1)!.trust.toFixed(0)} 기록`);
}
/** 0.15 season end on the calendar: a record per club played for, scout evaluation of the national tournament (school). */
function completeCalendarSeason(c:Career){
 const w=c.world,s=w.season!,current=clubOf(w);
 const clubs=[...new Set([...(w.seasonClubs??[]),w.clubId])];
 let best=0;
 for(const id of clubs){
  const club=w.clubs.find(x=>x.id===id);if(!club)continue;
  const results=c.history.filter(r=>r.year===w.year&&(r.club??w.clubId)===id&&r.kind!=='friendly'&&r.kind!=='national');
  if(id!==w.clubId&&!results.length)continue;
  const played=results.filter(r=>r.stats.minutes>0),mean=played.length?played.reduce((n,r)=>n+r.rating,0)/played.length:0;
  let rank:number,champion:string;
  if(club.league>0){const ranked=sortedTable(w,club.league);rank=ranked.findIndex(t=>t.id===id)+1;champion=w.clubs.find(x=>x.id===ranked[0].id)!.name;}
  else{const ss=s.school!,e=ss.entrants.find(x=>x.clubId===id);const region=ss.entrants.filter(x=>x.region===e?.region).map(x=>x.id);rank=e?schoolRank(ss,region).indexOf(e.id)+1:0;champion=ss.entrants.find(x=>x.id===ss.national?.champion)?.name??'-';}
  w.records.push({year:w.year,club:club.name,league:LEAGUES[club.league],rank,appearances:played.length,minutes:played.reduce((n,r)=>n+r.stats.minutes,0),goals:played.reduce((n,r)=>n+r.stats.goals,0),assists:played.reduce((n,r)=>n+r.stats.assists,0),rating:mean,champion});
  if(rank===1&&club.league>0&&played.length)w.achievements.unshift(`${w.year} ${LEAGUES[club.league]} 우승`);
  if(played.length>=6&&mean>=7.5)best++;
  if(id===w.clubId)c.feed.unshift(`${w.year} 시즌 종료 · ${club.name} ${rank}위 · 평균 ${mean.toFixed(2)}`);
 }
 if(best)w.achievements.unshift(`${w.year} 시즌 베스트 선수`);
 // School: the national tournament is the scouts' stage (contracts, salary and role only — never the real ability).
 const ss=s.school;
 if(current.league===0&&ss?.national){
  const u=ss.user,stage=stageReached(ss.national,u.entrant),avg=u.matches?u.ratingSum/u.matches:0;
  const champ=ss.entrants.find(e=>e.id===ss.national!.champion);
  const mvp=!!champ&&champ.id===u.entrant&&u.matches>=3&&(avg>=7.2||(avg>=6.9&&u.goals+u.assists>=4));
  ss.mvp={name:mvp?c.player.name:`${champ?.name??''} 에이스`,school:champ?.name??'',user:mvp};
  const value=scoutBonusFor(stage,mvp,u,(u.team??0)*90);
  w.scoutBonus={value,year:w.year,stage,mvp};
  if(stage>=0)news(c,`전국대회 ${['32강','16강','8강','4강','준우승','우승'][Math.min(5,stage)]}${mvp?' · 대회 MVP':''} · 스카우트 평가 +${value.toFixed(1)} (계약 조건에만 반영)`);
  if(mvp)w.achievements.unshift(`${w.year} 전국 고교대회 MVP`);
 }
 w.contract.years=Math.max(0,w.contract.years-1);
 const loyalty=w.loyalty?.clubId===current.id?w.loyalty:{clubId:current.id,seasons:0};loyalty.seasons++;w.loyalty=loyalty;
 if(loyalty.seasons===3||loyalty.seasons===5)w.achievements.unshift(`${current.name} · ${loyalty.seasons}시즌 동행, 팬들의 신뢰`);
 returnFromLoan(w);announceOffers(c);
}
function completeSeason(c:Career){
 const w=c.world,club=clubOf(w),ranked=sortedTable(w),rank=ranked.findIndex(t=>t.id===club.id)+1;
 const results=c.history.filter(r=>r.year===w.year&&r.competition!=='국제 초청대회'&&r.competition!=='친선 경기');
 const played=results.filter(r=>r.stats.minutes>0),mean=played.length?played.reduce((n,r)=>n+r.rating,0)/played.length:0;
 w.records.push({year:w.year,club:club.name,league:LEAGUES[club.league],rank,appearances:played.length,minutes:played.reduce((n,r)=>n+r.stats.minutes,0),goals:played.reduce((n,r)=>n+r.stats.goals,0),assists:played.reduce((n,r)=>n+r.stats.assists,0),rating:mean,champion:w.clubs.find(x=>x.id===ranked[0].id)!.name});
 if(rank===1)w.achievements.unshift(`${w.year} ${LEAGUES[club.league]} 우승`);
 if(played.length>=6&&mean>=7.5)w.achievements.unshift(`${w.year} 시즌 베스트 선수`);
 const pay=Math.min(club.budget,w.contract.salary);club.budget-=pay;w.wealth+=pay;w.contract.years=Math.max(0,w.contract.years-1);
 c.development.wallet+=pay;
 const loyalty=w.loyalty?.clubId===club.id?w.loyalty:{clubId:club.id,seasons:0};loyalty.seasons++;w.loyalty=loyalty;
 if(loyalty.seasons===3||loyalty.seasons===5)w.achievements.unshift(`${club.name} · ${loyalty.seasons}시즌 동행, 팬들의 신뢰`);
 returnFromLoan(w);announceOffers(c);
 c.feed.unshift(`${w.year} 시즌 종료 · ${rank}위 · 평균 ${mean.toFixed(2)}`);
}
/** Why the next season cannot start without a new contract (graduation or an expired contract), or null. */
export function contractNeeded(c:Career){
 const w=c.world;if(w.phase!=='offseason')return null;
 if(c.player.age>=18&&clubOf(w).league===0)return '졸업 예정입니다. 이적 시장에서 프로 계약을 선택해 주세요.';
 if(clubOf(w).league>0&&w.contract.years===0)return '계약이 만료되었습니다. 재계약 또는 이적을 선택해 주세요.';
 return null;
}
export function nextSeason(c:Career){
 ensureDevelopment(c);if(c.match)throw Error('진행 중인 경기를 완료하세요.');
 // Days are the unit of play: an unfinished week is closed (recorded in the growth notes) instead of blocking the new season.
 if(c.development.active)finishWeek(c);const w=c.world;if(w.phase!=='offseason')throw Error('시즌 종료 후 가능합니다.');
 const need=contractNeeded(c);if(need)throw Error(need);
 recordAge(c);c.player.age++;ageRival(c);if(c.player.age>=36){w.year++;retire(c);return;}
 applyAging(c.player.a,c.development.traits,c.player.age);
 advanceWorldYear(w);clearInjuries(w,[c.development.rival.id]);c.development.rival.player.injuryWeeks=0;syncRival(c);c.week=Math.max(c.week,Math.round((w.year-2026)*365.25/7));c.day=c.week*7;w.currentDay=c.day;w.currentSeasonStart=c.week;
 c.player.energy=100;c.player.fatigue=0;c.player.injuryWeeks=0;c.trainingCount=0;c.feed.unshift(`${w.year} 새 시즌 · ${teamName(c)} · ${c.player.age}세`);
}
export function retire(c:Career){if(c.match)throw Error('진행 중인 경기를 완료하세요.');recordAge(c);c.world.phase='retired';c.world.achievements.unshift(`${c.world.year} ${c.player.name} 은퇴 · 커리어 기록 보존`);}
