/**
 * 0.9 engagement systems, layered on the existing career without touching any random stream:
 *  - 감독 미션: one pre-match objective per match, chosen with a hashed seed (seedFrom), rewarded in settle.
 *  - 시그니처 도전: career deeds unlock signature skills (small success bonus for the user only).
 *  - 라이벌 비교: season head-to-head numbers and weekly rival news.
 * Every field it stores is optional, so v7 saves load unchanged.
 */
import {seedFrom} from './traits';
import {overall,userPerformance,type Match,type MatchMission,type Position,type SignatureAction,type Stat} from './engine';
import {news,HIDDEN_NEWS,type News} from './development';
import {clubOf} from './world';
import {leagueLevel} from './leagues';
import type {Career} from './career';

// ── 감독 미션 ───────────────────────────────────────────────────────────
export type MissionStat='shots'|'onTarget'|'keyPasses'|'completed'|'progressivePasses'|'ballWins'|'saves'|'goalsConceded'|'attackPoints';
type MissionDef=[stat:MissionStat,target:number,label:(t:number)=>string,cmp?:'min'|'max'];
const L={
 shots:(t:number)=>`슈팅 ${t}회 이상`,onTarget:(t:number)=>`유효 슈팅 ${t}회 이상`,keyPasses:(t:number)=>`키패스 ${t}회 이상`,
 completed:(t:number)=>`패스 성공 ${t}회 이상`,progressivePasses:(t:number)=>`전진 패스 ${t}회 이상`,ballWins:(t:number)=>`볼 탈취 ${t}회 이상`,
 saves:(t:number)=>`선방 ${t}회 이상`,goalsConceded:(t:number)=>`실점 ${t}골 이하`,attackPoints:(t:number)=>`공격 포인트 ${t}개 이상`,
};
/**
 * Targets sit near the median of real career matches for each role (tests/missions.test.ts measures them),
 * so a mission is a coin flip in auto play and clearly reachable when the player plays it out.
 */
const POOL:Record<'striker'|'wing'|'mid'|'centre'|'full'|'keeper',MissionDef[]>={
 striker:[['shots',2,L.shots],['onTarget',1,L.onTarget],['keyPasses',1,L.keyPasses],['ballWins',5,L.ballWins]],
 wing:[['shots',2,L.shots],['keyPasses',1,L.keyPasses],['completed',10,L.completed],['attackPoints',1,L.attackPoints]],
 mid:[['progressivePasses',4,L.progressivePasses],['completed',7,L.completed],['ballWins',4,L.ballWins]],
 centre:[['ballWins',2,L.ballWins],['progressivePasses',2,L.progressivePasses],['completed',4,L.completed]],
 full:[['ballWins',2,L.ballWins],['progressivePasses',1,L.progressivePasses],['completed',2,L.completed]],
 keeper:[['saves',5,L.saves],['goalsConceded',1,L.goalsConceded,'max'],['completed',6,L.completed]],
};
const GROUP:Record<Position,keyof typeof POOL>={ST:'striker',LW:'wing',RW:'wing',CM:'mid',CB:'centre',LB:'full',RB:'full',GK:'keeper'};
export const MISSION_REWARD={trust:2,masterTrust:3,wallet:3} as const;

/** The mission for this week's match. Hashed seed: the career's random stream is untouched. */
export function createMission(c:Career):MatchMission{
 const pool=POOL[GROUP[c.player.pos]],seed=seedFrom((c.seed^c.week)>>>0,`mission:${c.world.year}`);
 const [stat,base,label,cmp='min']=pool[seed%pool.length];
 // Higher leagues ask a little more (attackers shoot more, defenders face more attacks).
 const target=cmp==='min'&&base>=2&&leagueLevel(clubOf(c.world).league)>=70?base+1:base;
 return {id:`${c.week}:${stat}`,label:label(target),stat,target,cmp};
}
export function missionValue(stat:string,s:Stat){
 switch(stat as MissionStat){
  case 'ballWins':return s.tackles+s.interceptions+(s.defensiveWins??0);
  case 'attackPoints':return s.goals+s.assists;
  case 'keyPasses':return s.keyPasses??0;
  case 'progressivePasses':return s.progressivePasses??0;
  case 'goalsConceded':return s.goalsConceded??0;
  default:return (s as unknown as Record<string,number>)[stat]??0;
 }
}
export type MissionState={mission:MatchMission,value:number,done:boolean,failed:boolean,played:boolean};
/** Live state for the match screen; a 'max' mission is only "done" once the match has ended. */
export function missionState(m:Match):MissionState|undefined{
 const mission=m.mission;if(!mission)return undefined;
 const s=userPerformance(m).stats,value=missionValue(mission.stat,s),played=s.minutes>0;
 const done=mission.cmp==='min'?value>=mission.target:m.ended&&played&&value<=mission.target;
 const failed=mission.cmp==='max'?value>mission.target:m.ended&&!done;
 return {mission,value,done,failed,played};
}
/** Applies the mission result in settle. Returns the state (undefined: no mission this match). */
export function settleMission(c:Career,m:Match){
 const st=missionState(m);if(!st)return undefined;
 const d=c.development;
 if(!st.played){news(c,`감독 미션 · 출전하지 못해 「${st.mission.label}」 미션은 다음 기회로 넘어갑니다.`);return st;}
 const rec=d.missions??={done:0,total:0};rec.total++;
 if(st.done){
  rec.done++;const trust=hasSignature(c,'미션 마스터')?MISSION_REWARD.masterTrust:MISSION_REWARD.trust;
  c.player.trust=Math.min(100,c.player.trust+trust);d.wallet+=MISSION_REWARD.wallet;
  news(c,`감독 미션 달성! 「${st.mission.label}」 · 감독 신뢰 +${trust} · 보너스 ${MISSION_REWARD.wallet}만원`);
 }else news(c,`감독 미션 실패 · 「${st.mission.label}」 (${st.value}/${st.mission.target}) · 다음 경기에서 다시 도전하세요.`);
 return st;
}

// ── 시그니처 도전 ───────────────────────────────────────────────────────
export type DeedKey='goals'|'longShotGoals'|'curlGoals'|'dribbles'|'keyPasses'|'ballWins'|'saves'|'missions';
export type Signature={id:string,deed:DeedKey,target:number,unit:string,fx:Partial<Record<SignatureAction,number>>,effect:string};
/**
 * Career goals that turn the player's own way of playing into a lasting identity. Targets are sized so a
 * position's natural signatures take about 3–6 seasons of auto play (tests/engagement-balance.test.ts);
 * 중거리 저격수 / 감아차기 장인 only count shots the player chose in live play.
 */
export const SIGNATURES:Signature[]=[
 {id:'골 사냥꾼',deed:'goals',target:30,unit:'골',fx:{closeShot:.06},effect:'근거리 슛 성공률이 조금 오릅니다.'},
 {id:'중거리 저격수',deed:'longShotGoals',target:5,unit:'중거리 슛 골',fx:{longShot:.10},effect:'중거리 슛 성공률이 조금 오릅니다.'},
 {id:'감아차기 장인',deed:'curlGoals',target:5,unit:'감아차기 골',fx:{curl:.10},effect:'감아차기 성공률이 조금 오릅니다.'},
 {id:'드리블 마법사',deed:'dribbles',target:120,unit:'드리블 성공',fx:{dribble:.05},effect:'드리블 성공률이 조금 오릅니다.'},
 {id:'킬패스 장인',deed:'keyPasses',target:60,unit:'키패스',fx:{pass:.03},effect:'패스 성공률이 조금 오릅니다.'},
 {id:'철벽 수비',deed:'ballWins',target:150,unit:'볼 탈취',fx:{tackle:.06,slide:.06,press:.04},effect:'태클·압박 성공률이 조금 오릅니다.'},
 {id:'거미손',deed:'saves',target:200,unit:'선방',fx:{},effect:'골키퍼의 명예 칭호입니다.'},
 {id:'미션 마스터',deed:'missions',target:30,unit:'미션 달성',fx:{},effect:'감독 미션 보상 신뢰가 +3으로 오릅니다.'},
];
export const hasSignature=(c:Career,id:string)=>!!c.development.signatures?.includes(id);
/** Deeds so far. Older saves start from the recorded match history (shot types and dribbles were not tracked). */
export function deedsOf(c:Career):Record<DeedKey,number>{
 const d=c.development;
 if(!d.deeds){
  const sum=(f:(s:Stat)=>number)=>c.history.reduce((a,r)=>a+f(r.stats),0);
  d.deeds={goals:sum(s=>s.goals),keyPasses:sum(s=>s.keyPasses??0),ballWins:sum(s=>missionValue('ballWins',s)),saves:sum(s=>s.saves),dribbles:sum(s=>s.dribbles??0),longShotGoals:0,curlGoals:0};
 }
 const x=d.deeds;
 return {goals:x.goals??0,longShotGoals:x.longShotGoals??0,curlGoals:x.curlGoals??0,dribbles:x.dribbles??0,keyPasses:x.keyPasses??0,ballWins:x.ballWins??0,saves:x.saves??0,missions:d.missions?.done??0};
}
/** Adds one match to the deeds and unlocks reached signatures. Returns the newly earned ones. */
export function recordDeeds(c:Career,s:Stat):Signature[]{
 const d=c.development,before=deedsOf(c);
 if(s.minutes>0)d.deeds={...d.deeds,goals:before.goals+s.goals,longShotGoals:before.longShotGoals+(s.longShotGoals??0),curlGoals:before.curlGoals+(s.curlGoals??0),
  dribbles:before.dribbles+(c.player.pos==='GK'?0:s.dribbles??0), // a keeper's AI ball-carrying is not a dribble signature
 keyPasses:before.keyPasses+(s.keyPasses??0),ballWins:before.ballWins+missionValue('ballWins',s),saves:before.saves+s.saves};
 return unlockSignatures(c);
}
export function unlockSignatures(c:Career):Signature[]{
 const d=c.development,now=deedsOf(c),earned:Signature[]=[];
 for(const sig of SIGNATURES)if(!hasSignature(c,sig.id)&&now[sig.deed]>=sig.target){(d.signatures??=[]).push(sig.id);earned.push(sig);news(c,`시그니처 획득! 「${sig.id}」 · ${sig.effect}`);}
 return earned;
}
/** Merged signature bonuses for the user's match copy (undefined when none apply). */
export function signatureFx(c:Career){
 const fx:Partial<Record<SignatureAction,number>>={};let any=false;
 for(const sig of SIGNATURES)if(hasSignature(c,sig.id))for(const [k,v] of Object.entries(sig.fx)){fx[k as SignatureAction]=(fx[k as SignatureAction]??0)+v;any=true;}
 return any?fx:undefined;
}
/** Signatures in display order: the ones this position earns most naturally first. */
export function signatureOrder(pos:Position){
 const first:Record<Position,string[]>={ST:['골 사냥꾼','중거리 저격수','감아차기 장인'],LW:['드리블 마법사','감아차기 장인','킬패스 장인'],RW:['드리블 마법사','감아차기 장인','킬패스 장인'],
  CM:['킬패스 장인','중거리 저격수','드리블 마법사'],CB:['철벽 수비'],LB:['철벽 수비','드리블 마법사'],RB:['철벽 수비','드리블 마법사'],GK:['거미손']};
 const top=first[pos];return [...SIGNATURES].sort((a,b)=>(top.includes(a.id)?top.indexOf(a.id):9)-(top.includes(b.id)?top.indexOf(b.id):9));
}

// ── 라이벌 비교 ─────────────────────────────────────────────────────────
export type SeasonLine={apps:number,goals:number,avg:number,ovr:number};
/** This season's numbers for the user and the rival (weeks since the season started). */
export function seasonCompare(c:Career):{me:SeasonLine,rival:SeasonLine}{
 const start=c.world.currentSeasonStart,r=c.development.rival;
 const mine=c.history.filter(h=>h.id>=start&&h.rating>0),theirs=r.history.filter(h=>h.week>=start&&h.rating>0);
 const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
 return {me:{apps:mine.length,goals:mine.reduce((a,h)=>a+h.stats.goals,0),avg:avg(mine.map(h=>h.rating)),ovr:overall(c.player.a)},
  rival:{apps:theirs.length,goals:theirs.reduce((a,h)=>a+h.goals,0),avg:avg(theirs.map(h=>h.rating)),ovr:overall(r.player.a)}};
}
// ── 홈 '지난주 주요 뉴스' ─────────────────────────────────────────────
/**
 * 0.9.1: the two most important lines of the last 7 days. 깨달음 / 럭키 and minor rival notes are never
 * shown (HIDDEN_NEWS); rival news is limited to transfers and high-rated matches.
 */
export function headlines(c:Career,count=2){
 const weight=(n:News)=>n.kind==='offer'||n.text.includes('입단')?5:n.text.startsWith('시그니처')?4:n.kind==='rating'&&!n.text.startsWith('라이벌')?3:n.text.startsWith('감독 미션 달성')?2:n.kind==='rating'?2:1;
 return c.development.news.map((n,i)=>({n,i}))
  .filter(({n})=>n.day>=c.day-7&&!HIDDEN_NEWS.includes(n.kind)&&!n.text.startsWith('보유 특성'))
  .sort((a,b)=>weight(b.n)-weight(a.n)||a.i-b.i).slice(0,count).map(x=>x.n);
}

