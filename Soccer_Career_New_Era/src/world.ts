import {LEAGUE_DATA,leagueDef,leagueLevel,LEAGUES,leagueNames,WORLD_CLUB_COUNT,OLD_WORLD_CLUB_COUNT,clubIdOf,AVG_SALARY,OLD_INCOME} from './leagues';
import {SEASON_WEEKS,PRO_SLOTS,SCHOOL_SLOTS,BIG_KINDS,NATIONS,drawMatchDays,leagueRounds,newProSeason,drawContinental,newSchoolSeason,schoolPairings,drawRegional,drawSchoolNational,schoolStrength,recordSchool,playRound,openTies,quickScore,type Season,type SlotKind,type Bracket,type Tie} from './season';
export {LEAGUES,leagueNames} from './leagues';
import {attributes,clamp,random,type Attributes,type Position} from './engine';
import {roleAbility} from './roles';
import {npcTraits,trainingGrowthMultiplier,lateBloom,abroadGrowthMultiplier,injuryChanceMultiplier,injuryWeeks,seedFrom,restRecoveryMultiplier,trainingFatigueMultiplier} from './traits';
import {agingLoss,npcGrowthRate} from './aging';
export type RosterPlayer={id:string,traits?:string[],
 /** Weeks out injured (0.5). Injured players are left out of lineups until recovered. */
 injuryWeeks?:number,name:string,pos:Position,age:number,a:Attributes,potential:number,energy:number,form:number,goals:number,appearances:number,years:number};
export type Coach={name:string,style:'점유'|'역습'|'수비',preference:'유망주'|'현재 실력'|'베테랑',formation:'4-3-3'|'4-4-2'};
export type Club={id:string,name:string,league:number,budget:number,reputation:number,development:number,coach:Coach,roster:RosterPlayer[],baseLevel?:number};
export type Fixture={home:string,away:string,score?:[number,number]};
export type Standing={id:string,played:number,won:number,draw:number,lost:number,gf:number,ga:number,points:number};
export type Offer={clubId:string,salary:number,years:number,fee:number,role:string,negotiated:boolean,status:'open'|'rejected',reason?:string,competition?:{name:string,ability:number}[],expectedStarts?:string,kind?:'transfer'|'loan',loanAllowed?:boolean,issuedDay?:number,expiresDay?:number,
 /** 0.15 what the club is selling: a prospect deal, a guaranteed start, a salary premium or a growth environment. */ pitch?:OfferPitch};
export type OfferPitch='유망주 육성'|'주전 보장'|'연봉 프리미엄'|'성장 환경';
export type SeasonRecord={year:number,club:string,league:string,rank:number,appearances:number,minutes:number,goals:number,assists:number,rating:number,champion:string};
export type ScoutReport={clubId:string,stage:'관찰'|'면담'|'공식 관심',observations:number,lastWeek:number,reason:string,reserved?:number};
export type Contract={salary:number,years:number,role?:string,loanAllowed?:boolean,trialMatches?:number};
export type World={
 /** 0.15 35-week calendar (absent = a pre-0.15 season still running on the old 10-round rules). */ calendar?:35,season?:Season,
 /** 0.15 the user's school for the school competitions (set by the career). */ userSchool?:{clubId:string,schoolId?:string},
 /** 0.15 clubs played for this season (a mid-season transfer keeps both). */ seasonClubs?:string[],
 /** 0.15 national-tournament scout evaluation (contracts only; never the real ability). */ scoutBonus?:{value:number,year:number,stage:number,mvp:boolean},
 /** 0.15 coach trust left behind at former clubs. */ trustLog?:{club:string,trust:number,year:number}[],
 /** 0.14 money scale: 2 = realistic salaries and budgets (older saves are migrated by migrateEconomy). */economy?:number,targetClubId?:string,priority?:'출전'|'성장'|'연봉'|'우승',scouting?:ScoutReport[],loan?:{parentId:string,parentContract:Contract,returnYear:number},loyalty?:{clubId:string,seasons:number},currentDay?:number,interestedClubIds?:string[],seed:number,year:number,clubId:string,clubs:Club[],round:number,fixtures:Fixture[][],tables:Standing[],phase:'league'|'cup'|'international'|'national'|'offseason'|'retired',knockoutRound:number,opponentId:string|null,nationalCaps:number,nationalGoals:number,offers:Offer[],contract:Contract,wealth:number,records:SeasonRecord[],achievements:string[],news:string[],ledger:{year:number,from:string,to:string,fee:number,player:string}[],currentSeasonStart:number,nextId:number};
const POS:Position[]=['GK','LB','CB','CB','RB','CM','CM','CM','LW','ST','RW','GK','LB','CB','RB','CM','CM','LW','ST','RW'];
export const lineupSlots=(coach:Coach):Position[]=>coach.formation==='4-4-2'?['GK','LB','CB','CB','RB','LW','CM','CM','RW','ST','ST']:POS.slice(0,11);
const NAME_POOLS:Record<string,[string[],string[]]>={
 '일본':[['사토','스즈키','다나카','이토','야마다','모리'],['렌','유토','하루','켄타','소타','타쿠미','료','카이']],
 '사우디':[['알하산','알살림','알카림','알사이드','알누르','알라시드'],['오마르','살렘','파하드','알리','하산','칼리드','나세르','사미']],
 '튀르키예':[['데미르','카야','일마즈','아르슬란','첼리크','아이딘'],['에미르','케렘','알프','데니즈','칸','메르트','에렌','부라크']],
 '유럽':[['마르틴','실바','베커','로시','뒤랑','얀센'],['루카','레오','노아','테오','에릭','마르코','다니엘','올리버']],
 '브라질':[['실바','산투스','올리베이라','코스타','리마','페레이라'],['루카스','가브리엘','마테우스','페드루','하파엘','브루누','비토르','카이우']],
};
function npcName(w:{seed:number},league:number){const country=leagueDef(league).country,pool=NAME_POOLS[country]??(league>=2?NAME_POOLS['유럽']:undefined);const a=Math.floor(random(w)*6),b=Math.floor(random(w)*8);return pool?pool[1][b]+' '+pool[0][a]:['김','이','박','정','강','최'][a]+['준서','도윤','태성','민호','현준','재민','우진','지훈'][b];}
function rookie(w:{seed:number,nextId:number},league:number,pos:Position,age?:number,level?:number):RosterPlayer{const base=level??leagueLevel(league),a=attributes(base);for(const key of Object.keys(a) as (keyof Attributes)[])a[key]=clamp(base+(random(w)-.5)*15,25,92);const id='p'+w.nextId++;return {id,traits:npcTraits(w.seed,id),name:npcName(w,league),pos,age:age??(league===0?16+Math.floor(random(w)*3):19+Math.floor(random(w)*15)),a,potential:clamp(base+8+random(w)*15,45,95),energy:100,form:6.5,goals:0,appearances:0,years:1+Math.floor(random(w)*3)};}
export function newWorld(seed:number,school:number,startWeek=0):World{const w:World={economy:2,seed:seed^0x4f1a,year:2026,clubId:'c'+school,clubs:[],round:0,fixtures:[],tables:[],phase:'league',knockoutRound:0,opponentId:null,nationalCaps:0,nationalGoals:0,offers:[],contract:{salary:0,years:0},wealth:0,records:[],achievements:[],news:[],ledger:[],currentSeasonStart:startWeek,nextId:1};// The first six clubs of every league in the pre-0.15 order (ids c0…c71), then the 7th and 8th pro clubs (c72…).
 for(const extra of [false,true])for(let l=0;l<LEAGUE_DATA.length;l++)for(let i=extra?6:0;i<(extra?leagueDef(l).clubs.length:6);i++)w.clubs.push(makeClub(w,l,i));
 resetSeason(w);return w;}
const COACHES=['박정호','이성민','김도현','정태훈','최준혁','서민우','한동훈','오세진'];
/** 0.15 squad tiers: 2 core starters (+5), regular starters (+1), rotation (−3), prospects (18–20, −7, higher potential);
 *  one weak position group per club (−4), so clubs differ in where a newcomer could start. */
export const SQUAD_TIER={core:5,regular:1,rotation:-3,prospect:-7,weakGroup:-4} as const;
const GROUPS:Position[][]=[['LB','CB','RB'],['CM'],['LW','ST','RW']];
function makeClub(w:World,l:number,i:number):Club{
 const def=leagueDef(l),level=def.clubs[i][1];
 const club:Club={id:clubIdOf(l,i),name:leagueNames[l][i],league:l,baseLevel:level,budget:def.income*4,reputation:level,development:def.development+(random(w)-.5)*.1,coach:{name:COACHES[i%COACHES.length],style:(['점유','역습','수비'] as const)[i%3],preference:(['유망주','현재 실력','베테랑'] as const)[i%3],formation:i%2?'4-4-2':'4-3-3'},roster:[]};
 const weak=GROUPS[Math.floor(random(w)*GROUPS.length)],core=new Set([1+Math.floor(random(w)*10),1+Math.floor(random(w)*10)]);
 const shifts=POS.map((pos,k)=>(k<11?(core.has(k)?SQUAD_TIER.core:SQUAD_TIER.regular):k<17?SQUAD_TIER.rotation:SQUAD_TIER.prospect)+(weak.includes(pos)?SQUAD_TIER.weakGroup:0));
 // the squad's mean stays at the club's authored level (league balance unchanged); only the spread differs
 const mean=shifts.reduce((n,x)=>n+x,0)/shifts.length;
 club.roster=POS.map((pos,k)=>{const shift=shifts[k]-mean;
  const p=rookie(w,l,pos,l>0&&k>=17?18+Math.floor(random(w)*3):undefined,level+shift);if(l>0&&k>=17)p.potential=clamp(p.potential+6,45,95);return p;});
 return club;
}
export const clubOf=(w:World)=>w.clubs.find(c=>c.id===w.clubId)!;
export const sortedTable=(w:World,league=clubOf(w).league)=>w.tables.filter(t=>w.clubs.find(c=>c.id===t.id)!.league===league).sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.id.localeCompare(b.id));
/** Pre-0.15 fixtures: a 6-club double round robin in 10 rounds (kept for older saves finishing their season). */
export function legacyFixtures(ids:string[]){const rounds:Fixture[][]=Array.from({length:10},()=>[]);const list=[...ids];for(let r=0;r<5;r++){for(let i=0;i<3;i++){const a=list[i],b=list[5-i];rounds[r].push({home:r%2?a:b,away:r%2?b:a});rounds[r+5].push({home:r%2?b:a,away:r%2?a:b});}list.splice(1,0,list.pop()!);}return rounds;}
/** 0.15 a new 35-week season: 28 league rounds per pro league, cups, continental and national brackets, school season. */
export function resetSeason(w:World){
 w.round=0;w.phase='league';w.opponentId=null;w.knockoutRound=0;w.offers=[];w.seasonClubs=[w.clubId];
 w.tables=w.clubs.map(c=>({id:c.id,played:0,won:0,draw:0,lost:0,gf:0,ga:0,points:0}));
 w.fixtures=Array.from({length:28},()=>[]);
 for(const l of LEAGUE_DATA.filter(l=>l.id>0)){const ids=w.clubs.filter(c=>c.league===l.id).map(c=>c.id);leagueRounds(ids).forEach((r,k)=>w.fixtures[k].push(...r));}
 w.calendar=35;const seed=w.seed^0x35a1;
 w.season={version:1,year:w.year,matchDays:drawMatchDays(seed,w.year),played:0,...newProSeason(w,seed),school:newSchoolSeason(w,w.userSchool),log:[]};
}
export function nextFixture(w:World){return w.phase==='league'?w.fixtures[w.round]?.find(f=>f.home===w.clubId||f.away===w.clubId):undefined;}
export function nextOpponent(w:World):{name:string,strength:number,club?:Club}{if(w.calendar&&w.season){const m=matchupFor(w,w.clubId);return m?{name:m.opponentName,strength:m.strength,club:m.club}:{name:'시즌 종료',strength:45};}if(w.phase==='national')return {name:w.knockoutRound===0?'일본 대표팀':'브라질 대표팀',strength:w.knockoutRound===0?68:76};const f=nextFixture(w);const id=f?(f.home===w.clubId?f.away:f.home):w.opponentId;const club=w.clubs.find(c=>c.id===id);return {name:club?.name??'시즌 종료',strength:club?teamStrength(club):45,club};}
// ── 0.15 calendar: this week's match for a club, and resolving the week for every competition ─────────
/** Index of the current season week (0…34), or -1 for a pre-0.15 season. */
export const weekIndex=(w:World)=>w.calendar&&w.season?w.season.played:-1;
export type Matchup={kind:SlotKind,label:string,competition:string,opponentId?:string,opponentName:string,strength:number,club?:Club,big:boolean,friendly:boolean,national:boolean,home:boolean,entrant?:string};
const hashPick=<T,>(w:World,key:string,xs:T[])=>xs[seedFrom(w.seed>>>0,key)%Math.max(1,xs.length)];
/** Stand-in squad for a real school without a club in the world (players are always generated). */
function standIn(w:World,exclude:string[]){const pool=w.clubs.filter(c=>c.league===0&&!exclude.includes(c.id));return hashPick(w,'standin:'+exclude.join(','),pool);}
/** The match of `clubId` in the current week (league fixture, a live cup tie, a school pairing …) or a friendly. */
export function matchupFor(w:World,clubId:string,opts:{nationalSelected?:boolean,exclude?:string[]}={}):Matchup|undefined{
 const s=w.season;if(!w.calendar||!s||s.played>=SEASON_WEEKS)return undefined;
 const idx=s.played,club=w.clubs.find(c=>c.id===clubId);if(!club)return undefined;
 const friendly=(label:string):Matchup=>{
  if(club.league===0){const ss=s.school!,mine=ss.entrants.find(e=>e.clubId===clubId),others=ss.entrants.filter(e=>e.id!==mine?.id);const e=hashPick(w,`friendly:${w.year}:${idx}:${clubId}`,others.filter(x=>x.region===mine?.region).length?others.filter(x=>x.region===mine?.region):others);
   const sc=e.clubId?w.clubs.find(c=>c.id===e.clubId):standIn(w,[clubId,...(opts.exclude??[])]);return {kind:'school',label,competition:label,opponentId:e.clubId,opponentName:e.name,strength:e.strength,club:sc,big:false,friendly:true,national:false,home:true,entrant:e.id};}
  const near=w.clubs.filter(c=>c.league>0&&c.id!==clubId).sort((a,b)=>Math.abs((a.baseLevel??0)-(club.baseLevel??0))-Math.abs((b.baseLevel??0)-(club.baseLevel??0))).slice(0,6);
  const o=hashPick(w,`friendly:${w.year}:${idx}:${clubId}`,near);return {kind:'league',label,competition:label,opponentId:o.id,opponentName:o.name,strength:teamStrength(o),club:o,big:false,friendly:true,national:false,home:true};
 };
 if(club.league===0){
  const ss=s.school!,slot=SCHOOL_SLOTS[idx],me=ss.entrants.find(e=>e.clubId===clubId);if(!me)return friendly('친선 경기');
  const vs=(other:string,kind:SlotKind,label:string,home:boolean):Matchup=>{const e=ss.entrants.find(x=>x.id===other)!;const sc=e.clubId?w.clubs.find(c=>c.id===e.clubId):standIn(w,[clubId,...(opts.exclude??[])]);return {kind,label,competition:label,opponentName:e.name,strength:e.strength,club:sc,opponentId:e.clubId,big:BIG_KINDS.includes(kind),friendly:false,national:false,home,entrant:e.id};};
  if(slot.kind==='school'){const pair=schoolPairings(ss,w.seed^0x35a1,w.year,idx).find(p=>p.includes(me.id));if(!pair)return friendly('교류 친선 경기');const other=pair[0]===me.id?pair[1]:pair[0];const e=ss.entrants.find(x=>x.id===other)!;return vs(other,'school',e.region===me.region?`지역 리그 ${idx+1}주차`:`교류전 ${idx+1}주차`,pair[0]===me.id);}
  const tieIn=(b:Bracket|undefined,r:number)=>b?openTies(b,r).find(t=>t.a===me.id||t.b===me.id):undefined;
  if(slot.kind==='regional'){const b=ss.regional[me.region],r=b?idx-b.start:-1,t=r>=0?tieIn(b,r):undefined;if(t&&t.b)return vs(t.a===me.id?t.b:t.a,'regional',`${me.region} 지역 토너먼트 ${roundName(b!,r)}`,t.a===me.id);return friendly('친선 경기');}
  if(slot.kind==='schoolNational'){const b=ss.national,r=idx-29,t=tieIn(b,r);if(t&&t.b)return vs(t.a===me.id?t.b:t.a,'schoolNational',`전국대회 ${roundName(b!,r)}`,t.a===me.id);return friendly('친선 경기');}
  return {...friendly('스카우트 쇼케이스'),kind:'showcase',label:'스카우트 쇼케이스',competition:'스카우트 쇼케이스'};
 }
 const slot=PRO_SLOTS[idx],lg=LEAGUES[club.league];
 if(slot.kind==='league'){const f=w.fixtures[slot.round]?.find(f=>f.home===clubId||f.away===clubId);if(!f)return friendly('친선 경기');const o=w.clubs.find(c=>c.id===(f.home===clubId?f.away:f.home))!;return {kind:'league',label:slot.label,competition:`${lg} ${slot.round+1}라운드`,opponentId:o.id,opponentName:o.name,strength:teamStrength(o),club:o,big:false,friendly:false,national:false,home:f.home===clubId};}
 if(slot.kind==='national'&&opts.nationalSelected){const b=s.national!,t=openTies(b,slot.round).find(t=>t.a==='KOR'||t.b==='KOR');if(t){const o=NATIONS.find(n=>n.id===(t.a==='KOR'?t.b:t.a))!;return {kind:'national',label:slot.label,competition:slot.label,opponentId:o.id,opponentName:o.name,strength:o.strength,big:true,friendly:false,national:true,home:true};}}
 const b=slot.kind==='cup'?s.cups[club.league]:slot.kind==='continental'?s.continental[leagueDef(club.league).confederation]:undefined;
 const t=b?openTies(b,slot.round).find(t=>t.a===clubId||t.b===clubId):undefined;
 if(b&&t&&t.b){const o=w.clubs.find(c=>c.id===(t.a===clubId?t.b:t.a))!;return {kind:slot.kind,label:slot.label,competition:slot.kind==='cup'?`${lg} 컵 · ${roundName(b,slot.round)}`:`대륙 클럽 컵 · ${roundName(b,slot.round)}`,opponentId:o.id,opponentName:o.name,strength:teamStrength(o),club:o,big:true,friendly:false,national:false,home:t.a===clubId};}
 return friendly(slot.kind==='national'?'대표팀 휴식기 평가전':`${slot.label} 기간 친선 경기`);
}
/** 0.15 transfer windows: season weeks 1–3 and 17–18 (and the offseason). */
export const WINDOW_WEEKS=[0,1,2,16,17];
export const transferWindow=(w:World)=>w.phase==='offseason'||!!(w.calendar&&w.season&&WINDOW_WEEKS.includes(w.season.played));
/** "8강", "4강", "결승" … from a bracket's size and round. */
export function roundName(b:Bracket,r:number){const left=b.size/2**r;return left<=2?'결승':left===4?'4강':`${left}강`;}
/** Club-perspective results this week (goals for/against, shoot-out win on a draw), keyed by club id or 'KOR'. */
export type WeekResults=Map<string,{gf:number,ga:number,won?:boolean}>;
function forcedTies(results:WeekResults,key:(clubId:string)=>string|undefined){const m=new Map<string,{score:[number,number],winnerA?:boolean}>();for(const [id,r] of results){const k=key(id);if(k)m.set(k,{score:[r.gf,r.ga],winnerA:r.won});}return m;}
function npcMatchDay(w:World,club:Club,goals:number){const lineup=chooseLineup(club);for(const p of lineup){const original=club.roster.find(x=>x.id===p.id)!;original.appearances++;original.form=clamp(6.3+random(w)*1.2+(goals>1?.2:0),5,9);original.energy=clamp(original.energy-5+random(w)*10,65,100);}const attackers=club.roster.filter(p=>['ST','LW','RW'].includes(p.pos));for(let i=0;i<goals;i++)attackers[Math.floor(random(w)*attackers.length)].goals++;}
/**
 * Plays the current week everywhere: the league round or knockout round of every pro competition and the school
 * week, using the given results for the user's / rival's matches and simulated scores for everyone else.
 */
export function resolveWeek(w:World,results:WeekResults){
 const s=w.season;if(!w.calendar||!s||s.played>=SEASON_WEEKS)return;
 const idx=s.played,seed=w.seed^0x35a1,cache=new Map<string,number>();
 const strength=(id:string)=>{if(!cache.has(id)){const n=NATIONS.find(x=>x.id===id),c=w.clubs.find(x=>x.id===id);cache.set(id,n?n.strength:c?teamStrength(c):44);}return cache.get(id)!;};
 const slot=PRO_SLOTS[idx];
 if(slot.kind==='league'){
  for(const f of w.fixtures[slot.round]){
   const home=w.clubs.find(c=>c.id===f.home)!,away=w.clubs.find(c=>c.id===f.away)!,h=results.get(f.home),a=results.get(f.away);
   const score:[number,number]=h?[h.gf,h.ga]:a?[a.ga,a.gf]:lightweight(w,home,away);tableResult(w,f,score);
   if(!h&&!a){npcMatchDay(w,home,score[0]);npcMatchDay(w,away,score[1]);}
  }
  w.round=slot.round+1;
  if(slot.round===27)s.continental=drawContinental(strength,l=>sortedTable(w,l));
 }else if(slot.kind==='cup'){const f=forcedTies(results,id=>id);for(const b of Object.values(s.cups))playRound(b,slot.round,seed^w.year,strength,f);}
 else if(slot.kind==='continental'){const f=forcedTies(results,id=>id);for(const b of Object.values(s.continental))playRound(b,slot.round,seed^w.year,strength,f);}
 else if(slot.kind==='national'&&s.national){playRound(s.national,slot.round,seed^w.year,strength,forcedTies(results,id=>id==='KOR'?'KOR':undefined));}
 const ss=s.school;
 if(ss){
  const entrantOf=(clubId:string)=>ss.entrants.find(e=>e.clubId===clubId)?.id,forced=forcedTies(results,entrantOf);
  const sslot=SCHOOL_SLOTS[idx],st=(id:string)=>schoolStrength(ss,id);
  if(sslot.kind==='school'){
   schoolPairings(ss,seed,w.year,idx).forEach(([a,b],i)=>{const f=forced.get(a),g=forced.get(b);const score:[number,number]=f?f.score:g?[g.score[1],g.score[0]]:quickScore({seed:seedFrom(seed>>>0,`school:${w.year}:${idx}:${i}`)},st(a),st(b));recordSchool(ss,a,b,score);});
   if(idx===24)drawRegional(ss);
  }else if(sslot.kind==='regional'){for(const b of Object.values(ss.regional)){const r=idx-b.start;if(r>=0&&r<b.rounds.length)playRound(b,r,seed^w.year,st,forced);}if(idx===28)drawSchoolNational(ss,seed,w.year);}
  else if(sslot.kind==='schoolNational'&&ss.national)playRound(ss.national,idx-29,seed^w.year,st,forced);
 }
 s.played=idx+1;
 if(s.played>=SEASON_WEEKS)w.phase='offseason';
}
export type {Season,Bracket,Tie,SlotKind};
export function selectionScore(a:Attributes,pos:Position,target:Position,age:number,energy:number,form:number,coach:Coach,secondary?:Position){const fit=pos===target?0:secondary===target?-3:(['LB','RB'].includes(pos)&&['LB','RB'].includes(target)||['LW','RW'].includes(pos)&&['LW','RW'].includes(target))?-5:-18;const tactical=coach.style==='점유'?a.passing:coach.style==='역습'?a.speed:a.defending;const preference=coach.preference==='유망주'?clamp(23-age,-5,5)*.45:coach.preference==='베테랑'?clamp(age-24,-5,5)*.4:0;return roleAbility(a,target)+fit+(form-6.5)*3-(100-energy)*.12+(tactical-50)*.035+preference;}
/** Injured players sit out; if a club ever had fewer than 11 fit players, the least injured would fill in. */
function available(roster:RosterPlayer[]){const fit=roster.filter(p=>!p.injuryWeeks);return fit.length>=11?fit:[...fit,...roster.filter(p=>p.injuryWeeks).sort((a,b)=>a.injuryWeeks!-b.injuryWeeks!).slice(0,11-fit.length)];}
export function chooseLineup(club:Club,hero?:RosterPlayer&{secondary?:Position}){const pool=[...available(club.roster),...(hero?[hero]:[])],used=new Set<string>();return lineupSlots(club.coach).map(target=>{const sorted=pool.filter(p=>!used.has(p.id)).sort((a,b)=>selectionScore(b.a,b.pos,target,b.age,b.energy,b.form,club.coach,b.id==='hero'?hero?.secondary:undefined)-selectionScore(a.a,a.pos,target,a.age,a.energy,a.form,club.coach,a.id==='hero'?hero?.secondary:undefined));const p=sorted[0];used.add(p.id);return {...p,slotPos:target};});}
export function teamStrength(c:Club){return chooseLineup(c).reduce((n,p)=>n+roleAbility(p.a,p.slotPos)*(0.75+p.energy/400),0)/11;}
function poisson(w:World,mean:number){let product=1,n=0;do{n++;product*=random(w);}while(product>Math.exp(-mean)&&n<12);return n-1;}
export function lightweight(w:World,home:Club,away:Club):[number,number]{const diff=teamStrength(home)-teamStrength(away);return [poisson(w,clamp(1.35+diff*.045,.25,3.5)),poisson(w,clamp(1.2-diff*.045,.25,3.5))];}
function tableResult(w:World,f:Fixture,score:[number,number]){if(f.score)throw Error('이미 처리한 경기입니다.');f.score=score;const h=w.tables.find(t=>t.id===f.home)!,a=w.tables.find(t=>t.id===f.away)!;for(const [t,gf,ga]of [[h,score[0],score[1]],[a,score[1],score[0]]] as [Standing,number,number][]){t.played++;t.gf+=gf;t.ga+=ga;if(gf>ga){t.won++;t.points+=3;}else if(gf===ga){t.draw++;t.points++;}else t.lost++;}}
export function advanceLeague(w:World,score:[number,number],extra?:{clubId:string,score:[number,number]}){for(const f of w.fixtures[w.round]){const home=w.clubs.find(c=>c.id===f.home)!,away=w.clubs.find(c=>c.id===f.away)!;const own=f.home===w.clubId||f.away===w.clubId;const result=own?(f.home===w.clubId?score:[score[1],score[0]] as [number,number]):extra&&(f.home===extra.clubId||f.away===extra.clubId)?(f.home===extra.clubId?extra.score:[extra.score[1],extra.score[0]] as [number,number]):lightweight(w,home,away);tableResult(w,f,result);if(!own)for(const [club,goals] of [[home,result[0]],[away,result[1]]] as [Club,number][]){const lineup=chooseLineup(club);for(const p of lineup){const original=club.roster.find(x=>x.id===p.id)!;original.appearances++;original.form=clamp(6.3+random(w)*1.2+(goals>1?.2:0),5,9);original.energy=clamp(original.energy-5+random(w)*10,65,100);}const attackers=club.roster.filter(p=>['ST','LW','RW'].includes(p.pos));for(let i=0;i<goals;i++)attackers[Math.floor(random(w)*attackers.length)].goals++;}}w.round++;}
export function startPostseason(w:World,ability:number,age:number){const ranked=sortedTable(w);if(ranked.findIndex(t=>t.id===w.clubId)<4){w.phase='cup';w.knockoutRound=0;w.opponentId=ranked.filter(t=>t.id!==w.clubId)[0].id;}else startInternational(w,ability,age);}
export function startInternational(w:World,ability:number,age:number){if(clubOf(w).league>0&&sortedTable(w).findIndex(t=>t.id===w.clubId)<2){w.phase='international';w.knockoutRound=0;w.opponentId=w.clubs.filter(c=>c.id!==w.clubId&&c.league>0&&leagueDef(c.league).confederation===leagueDef(clubOf(w).league).confederation).sort((a,b)=>teamStrength(b)-teamStrength(a))[0].id;}else startNational(w,ability,age);}
export function startNational(w:World,ability:number,age:number){if(age>=19&&ability>=66){w.phase='national';w.knockoutRound=0;w.opponentId=null;w.news.unshift('국가대표 발탁 · 국제 초청대회 출전');}else w.phase='offseason';}
export function advanceCup(w:World,won:boolean,ability:number,age:number){if(won&&w.knockoutRound===0){w.knockoutRound=1;if(w.phase!=='national'){const candidates=w.clubs.filter(c=>c.id!==w.clubId&&c.id!==w.opponentId&&(w.phase==='cup'?c.league===clubOf(w).league:c.league>0&&leagueDef(c.league).confederation===leagueDef(clubOf(w).league).confederation));w.opponentId=candidates[Math.floor(random(w)*candidates.length)].id;}return;}if(won)w.achievements.unshift(`${w.year} ${w.phase==='cup'?'국내 컵':w.phase==='national'?'국제 초청대회':'대륙 클럽 컵'} 우승`);if(w.phase==='cup')startInternational(w,ability,age);else if(w.phase==='international')startNational(w,ability,age);else w.phase='offseason';}
/** 0.14 transfer fee in 만원 (×40 the pre-0.14 scale, so fees sit next to realistic salaries). */
export const FEE_SCALE=40;
export function marketValue(ability:number,age:number,form:number,years:number){return Math.round(FEE_SCALE*Math.max(50,(ability-35)**2*2*(age<24?1.35:age>31?.55:1)*(1+(form-6.5)*.12)*(.65+Math.min(3,years)*.12)));}
/** A club's level for one position: mean role ability of its two best players there (the likely starters). */
export function clubLevel(club:Club,pos:Position){const xs=club.roster.filter(r=>r.pos===pos).map(r=>roleAbility(r.a,pos)).sort((a,b)=>b-a).slice(0,2);if(!xs.length){const all=club.roster.filter(r=>r.pos!=='GK').map(r=>roleAbility(r.a,pos)).sort((a,b)=>b-a).slice(0,2);return all.reduce((n,x)=>n+x,0)/Math.max(1,all.length);}return xs.reduce((n,x)=>n+x,0)/xs.length;}
/**
 * Offer window by fit (= player's role ability − club level at that position).
 * Clubs only bid for players who would roughly start or rotate there (min…max); under-22s may be
 * signed as prospects a little below; clubs far weaker than the player do not bid.
 */
export const OFFER_FIT={min:-6,youthMin:-10,max:10,interestedMin:-12} as const;
/** Offers follow the player's current position ability (0.6). */
export function offerDetails(club:Club,p:{a:Attributes,pos:Position,age:number},form=6.5,scoutBonus=0){
 const ability=roleAbility(p.a,p.pos)+scoutBonus,fit=ability-clubLevel(club,p.pos);
 const competition=club.roster.filter(r=>r.pos===p.pos).sort((a,b)=>roleAbility(b.a,p.pos)-roleAbility(a.a,p.pos)).slice(0,3).map(r=>({name:r.name,ability:roleAbility(r.a,p.pos)}));
 const role=fit>=4?'핵심 선수':fit>=0?'주전 경쟁':fit>=-4?'로테이션':'유망주 / 벤치';
 const expectedStarts=fit>=4?'높음':fit>=0?'보통 이상':fit>=-4?'보통':'낮음';
 const reason=fit>=4?'부족한 포지션을 이끌 중심 선수':p.age<23&&fit<0?'미래 주전으로 육성':club.coach.style==='점유'?'패스와 볼 소유를 담당할 선수':club.coach.style==='역습'?'빠른 전환과 침투를 담당할 선수':'수비 조직과 안정성을 보강할 선수';
 return {fit,role,expectedStarts,competition,reason:reason+(form>=7.3?' · 최근 활약 주목':'')};
}
/** Guaranteed starts are only offered when the real ability is at most this far below the club's level. */
export const GUARANTEE_GAP=8;
export function generateOffers(w:World,p:{a:Attributes,pos:Position,age:number,energy:number},form:number,scoutBonus=0){
 // `ability` is how scouts rate the player (real + national-tournament bonus): fit, salary and role only.
 const real=roleAbility(p.a,p.pos),ability=real+scoutBonus,current=clubOf(w),fee=current.league===0||w.contract.years<=0?0:marketValue(ability,p.age,form,w.contract.years);
 w.offers=[];if(p.age<19&&current.league===0)return;
 const pro=w.clubs.filter(c=>c.league>0).map(club=>({club,fit:ability-clubLevel(club,p.pos)}));
 const make=(club:Club):Offer=>{const details=offerDetails(club,p,form,scoutBonus);return {clubId:club.id,salary:contractSalary(club,p.age,details.fit),years:2,fee:club.id===w.clubId?0:fee,issuedDay:w.currentDay??0,expiresDay:(w.currentDay??0)+14,...details,kind:'transfer',loanAllowed:details.fit<0,negotiated:false,status:'open'};};
 for(const {club,fit} of pro){
  const current=club.id===w.clubId,guaranteed=!!w.interestedClubIds?.includes(club.id);
  const inWindow=fit>=(p.age<22?OFFER_FIT.youthMin:OFFER_FIT.min)&&fit<=OFFER_FIT.max;
  if(!current&&!guaranteed&&!inWindow)continue;
  const o=make(club);
  if(!guaranteed&&club.budget<o.fee+o.salary*o.years)continue;
  // Formal interest always produces the promised written offer. Acceptance still checks funds.
  w.offers.push(o);
 }
 if(!w.offers.some(o=>o.clubId!==w.clubId))for(const {club} of pro.filter(x=>x.club.id!==w.clubId).sort((a,b)=>Math.abs(a.fit-2)-Math.abs(b.fit-2))){const o=make(club);if(club.budget>=o.fee+o.salary*o.years)w.offers.push(o);if(w.offers.filter(x=>x.clubId!==w.clubId).length>=2)break;}
 w.offers=pickOffers(w,w.offers,new Map(pro.map(x=>[x.club.id,x.fit])));
 assignPitches(w,p,real);
 const priority=w.priority??'출전';
 w.offers.sort((a,b)=>{const score=(o:Offer)=>{const cl=w.clubs.find(c=>c.id===o.clubId)!;return (o.clubId===w.targetClubId?1000:0)+(priority==='연봉'?o.salary:priority==='성장'?cl.development*100:priority==='우승'?cl.reputation:-(Math.abs(ability-clubLevel(cl,p.pos)-3)));};return score(b)-score(a);});
}
/**
 * 0.15 offer variety: one prospect deal at a stronger club (22 and under), one guaranteed-start deal (only when the real
 * gap to the club is within GUARANTEE_GAP), one salary premium (+10–30 %) and one growth deal (best training environment).
 */
function assignPitches(w:World,p:{a:Attributes,pos:Position,age:number},real:number){
 const others=w.offers.filter(o=>o.clubId!==w.clubId&&o.kind!=='loan'),club=(o:Offer)=>w.clubs.find(c=>c.id===o.clubId)!,gap=(o:Offer)=>clubLevel(club(o),p.pos)-real;
 const free=()=>others.filter(o=>!o.pitch),afford=(o:Offer,salary:number,years=o.years)=>club(o).budget>=o.fee+salary*years;
 const prospect=p.age<=22?free().filter(o=>gap(o)>4).sort((a,b)=>club(b).reputation-club(a).reputation)[0]:undefined;
 if(prospect&&afford(prospect,prospect.salary,3)){prospect.pitch='유망주 육성';prospect.years=3;prospect.role='유망주 / 벤치';prospect.expectedStarts='낮음 · 육성 계획';prospect.reason='3년 육성 계획 · 상위 구단 훈련 환경';}
 const start=free().filter(o=>gap(o)<=GUARANTEE_GAP&&gap(o)>-4).sort((a,b)=>gap(b)-gap(a))[0];
 if(start){start.pitch='주전 보장';start.role='주전 보장 계약';start.expectedStarts='첫 3경기 선발 보장';start.salary=Math.round(start.salary*.95/100)*100;start.reason='첫 3경기 선발 보장 (부상·국가대표 경기는 제외)';}
 const premium=free().filter(o=>gap(o)<=0).sort((a,b)=>gap(a)-gap(b))[0];
 if(premium){const pct=10+seedFrom(w.seed>>>0,`premium:${w.year}:${premium.clubId}`)%21,salary=Math.round(premium.salary*(1+pct/100)/100)*100;if(afford(premium,salary)){premium.pitch='연봉 프리미엄';premium.salary=salary;premium.reason=`연봉 ${pct}% 프리미엄 제시`;}}
 const growth=free().sort((a,b)=>club(b).development-club(a).development)[0];
 if(growth){growth.pitch='성장 환경';growth.reason=`훈련 환경 ×${club(growth).development.toFixed(2)} · 성장 중심 계획`;}
}
/** 0.9.1: at most this many clubs bid in one window (the current club's renewal included). */
export const MAX_OFFERS=6;
/**
 * Keeps the renewal, the target club and the clubs with formal interest, then fills the remaining places
 * league by league in turn (best-fitting club of each league first), so offers span as many leagues as possible.
 */
function pickOffers(w:World,offers:Offer[],fit:Map<string,number>){
 if(offers.length<=MAX_OFFERS)return offers;
 const league=(o:Offer)=>w.clubs.find(c=>c.id===o.clubId)!.league,score=(o:Offer)=>Math.abs((fit.get(o.clubId)??0)-2);
 const must=(o:Offer)=>o.clubId===w.clubId?0:o.clubId===w.targetClubId?1:w.interestedClubIds?.includes(o.clubId)?2:9;
 const picked=offers.filter(o=>must(o)<9).sort((a,b)=>must(a)-must(b)||score(a)-score(b)).slice(0,MAX_OFFERS);
 const byLeague=new Map<number,Offer[]>();
 for(const o of offers.filter(o=>!picked.includes(o)).sort((a,b)=>score(a)-score(b)))byLeague.set(league(o),[...(byLeague.get(league(o))??[]),o]);
 // Each round, leagues with the fewest offers so far go first.
 while(picked.length<MAX_OFFERS&&[...byLeague.values()].some(q=>q.length)){
  const order=[...byLeague.keys()].filter(l=>byLeague.get(l)!.length).sort((a,b)=>picked.filter(o=>league(o)===a).length-picked.filter(o=>league(o)===b).length||score(byLeague.get(a)![0])-score(byLeague.get(b)![0]));
  for(const l of order){if(picked.length>=MAX_OFFERS)break;picked.push(byLeague.get(l)!.shift()!);}
 }
 return picked;
}
export type Negotiation='salary'|'short'|'role'|'loan';
export function negotiate(w:World,clubId:string,choice:Negotiation='salary'){
 expireOffers(w);const o=w.offers.find(o=>o.clubId===clubId);if(!o||o.status!=='open'||o.negotiated)throw Error('협상 가능한 제안이 없습니다.');
 if(!transferWindow(w))throw Error('협상은 이적시장 기간(시즌 종료 후, 1–3주차, 17–18주차)에 가능합니다.');
 o.negotiated=true;const club=w.clubs.find(c=>c.id===clubId)!;
 if(choice==='short'){o.years=1;o.salary=Math.round(o.salary*.9);w.news.unshift(`${club.name} · 연봉을 조정하고 1년 계약 수락`);}
 else if(choice==='loan'){o.loanAllowed=true;o.salary=Math.round(o.salary*.95);w.news.unshift(`${club.name} · 향후 임대 요청 허용 합의`);}
 else if(choice==='role'){if(o.expectedStarts==='낮음'){w.news.unshift(`${club.name} · 주전 약속은 어려워 기존 역할 유지`);}else{o.role='주전 도전 계획';o.salary=Math.round(o.salary*.95);w.news.unshift(`${club.name} · 첫 3경기 주전 경쟁 계획 합의 (컨디션과 실력 격차 조건)`);}}
 else if(random(w)<.68&&club.budget>=o.fee+o.salary*1.15*o.years){o.salary=Math.round(o.salary*1.15);w.news.unshift(`${club.name} · 연봉 인상 수락`);}else w.news.unshift(`${club.name} · 인상 거절, 기존 조건 유지`);
}
export function acceptOffer(w:World,clubId:string,name:string){
 expireOffers(w);if(!transferWindow(w))throw Error('이적은 이적시장 기간(시즌 종료 후, 1–3주차, 17–18주차)에 가능합니다.');
 const o=w.offers.find(o=>o.clubId===clubId&&o.status==='open');if(!o)throw Error('유효한 제안이 아닙니다.');
 const buyer=w.clubs.find(c=>c.id===clubId)!,seller=clubOf(w);if(buyer.budget<o.fee+o.salary*o.years)throw Error('구단 예산이 부족합니다.');
 if(o.kind==='loan'){
  if(w.loan||seller.league===0||w.contract.years<1)throw Error('임대 가능한 프로 계약이 없습니다.');
  if(w.phase!=='offseason')throw Error('임대는 시즌 종료 후 가능합니다.');
  w.loan={parentId:seller.id,parentContract:{...w.contract},returnYear:w.year+1};
 }else if(w.loan)throw Error('임대 복귀 후 완전 이적할 수 있습니다.');
 if(buyer.id!==seller.id&&o.fee>0){buyer.budget-=o.fee;seller.budget+=o.fee;w.ledger.push({year:w.year,from:buyer.id,to:seller.id,fee:o.fee,player:name});}
 if(buyer.id!==seller.id&&!w.loan)w.loyalty={clubId:buyer.id,seasons:0};
 w.clubId=buyer.id;w.contract={salary:o.salary,years:o.years,role:o.role,loanAllowed:o.loanAllowed,trialMatches:o.role==='주전 도전 계획'||o.pitch==='주전 보장'?3:0};w.offers=[];w.interestedClubIds=[];w.scouting=[];
 w.news.unshift(`${name} · ${buyer.name} ${o.kind==='loan'?'1시즌 임대':o.years+'년 계약'} · ${o.role}`);
}
export function requestLoan(w:World,p:{a:Attributes,pos:Position,age:number,energy:number}){
 if(w.phase!=='offseason'||clubOf(w).league===0||w.loan||w.contract.years<1)throw Error('유효한 프로 계약이 있는 비시즌에 임대를 요청할 수 있습니다.');
 const own=clubOf(w),ability=roleAbility(p.a,p.pos);
 if(!w.contract.loanAllowed&&ability>=clubLevel(own,p.pos))throw Error('현재 주전 경쟁이 가능한 선수입니다. 임대 허용 조건을 먼저 협상하세요.');
 const destinations=w.clubs.filter(c=>c.league>0&&c.id!==own.id).map(club=>({club,fit:ability-clubLevel(club,p.pos)})).filter(x=>x.fit>=0&&x.fit<=12).sort((a,b)=>Math.abs(a.fit-3)-Math.abs(b.fit-3)).slice(0,6);
 const offers=destinations.map(({club,fit}):Offer=>({clubId:club.id,salary:Math.min(w.contract.salary,contractSalary(club,p.age,fit)),years:1,fee:0,kind:'loan',...offerDetails(club,p),reason:'출전 경험을 위한 1시즌 임대',negotiated:false,status:'open',issuedDay:w.currentDay??0,expiresDay:(w.currentDay??0)+14})).filter(o=>w.clubs.find(c=>c.id===o.clubId)!.budget>=o.salary);
 if(!offers.length)throw Error('현재 주전 기회를 제공할 임대 구단이 없습니다.');w.offers=offers;w.news.unshift('임대 요청 수락 · 원소속팀과 계약은 보존됩니다.');
}
export function returnFromLoan(w:World){if(!w.loan||w.year<w.loan.returnYear)return;const loan=w.loan;w.clubId=loan.parentId;w.contract={...loan.parentContract,years:Math.max(0,loan.parentContract.years-1)};delete w.loan;w.offers=[];w.news.unshift(`${clubOf(w).name} · 임대 종료 후 복귀, 새 시즌 경쟁을 시작합니다.`);}
export function advanceWorldYear(w:World){w.year++;for(const c of w.clubs){c.budget+=leagueDef(c.league).income;for(let i=0;i<c.roster.length;i++){const p=c.roster[i];if(p.id==='career-rival')continue;p.age++;p.years=Math.max(0,p.years-1);if(p.age>=(c.league===0?19:36)){c.roster[i]=rookie(w,c.league,p.pos,c.league===0?16:18,c.baseLevel);continue;}const bloom=lateBloom(p.traits),late=bloom&&p.age>=bloom.startAge&&p.age<bloom.startAge+6?.6:0,rate=npcGrowthRate(p.age)*trainingGrowthMultiplier(p.traits)*abroadGrowthMultiplier(p.traits,c.league);
// Same age model as the user and the rival (aging.ts): growth slows towards 32, decline from 33.
for(const k of Object.keys(p.a) as (keyof Attributes)[])p.a[k]=clamp(p.a[k]+Math.max(0,p.potential-p.a[k])*rate-agingLoss(p.traits,p.age,k)+late,20,96);p.energy=100;p.goals=0;p.appearances=0;}
if(random(w)<.22){c.coach.preference=(['유망주','현재 실력','베테랑'] as const)[Math.floor(random(w)*3)];c.coach.style=(['점유','역습','수비'] as const)[Math.floor(random(w)*3)];c.coach.name='신임 '+c.coach.name.replace('신임 ','');w.news.unshift(`${c.name} · 감독 교체`);}}
// AI clubs buy for a weak position with an explicit balanced transfer ledger.
for(const buyer of w.clubs.filter(c=>c.league>0)){const weakest=buyer.roster.filter(p=>p.id!=='career-rival').sort((a,b)=>roleAbility(a.a,a.pos)-roleAbility(b.a,b.pos))[0];const others=w.clubs.filter(c=>c.league===buyer.league&&c.id!==buyer.id),seller=others[Math.floor(random(w)*others.length)];const candidate=seller.roster.filter(p=>p.id!=='career-rival'&&p.pos===weakest.pos&&roleAbility(p.a,p.pos)>roleAbility(weakest.a,weakest.pos)+2).sort((a,b)=>roleAbility(b.a,b.pos)-roleAbility(a.a,a.pos))[0];if(!candidate)continue;const fee=marketValue(roleAbility(candidate.a,candidate.pos),candidate.age,candidate.form,candidate.years);if(buyer.budget<fee+2000+(w.scouting?.find(r=>r.clubId===buyer.id)?.reserved??0))continue;buyer.budget-=fee;seller.budget+=fee;buyer.roster=buyer.roster.filter(p=>p.id!==weakest.id);seller.roster=seller.roster.filter(p=>p.id!==candidate.id);buyer.roster.push(candidate);seller.roster.push(weakest);candidate.years=3;w.ledger.push({year:w.year,from:buyer.id,to:seller.id,fee,player:candidate.name});}w.news=w.news.slice(0,60);w.ledger=w.ledger.slice(-200);resetSeason(w);}

/**
 * 0.14 annual salary (만원) = league average × club standing × treatment in the squad × youth contract.
 * - club standing: exp(0.08 × (club level − league average)) — a title contender pays ~1.6×, a bottom club ~0.6×.
 * - treatment: exp(0.09 × fit) where fit = my ability − the club's level at my position (core player up to 2.5×,
 *   bench prospect down to 0.35×).
 * - youth: first professional deals (18–20) at 60–87%; a floor of 2,400만원 (a minimum first-team wage).
 */
export const SALARY={club:.08,role:.09,roleMin:.35,roleMax:2.5,youthAge:21,youthMin:.6,floor:2400} as const;
export function contractSalary(club:Club,age:number,fit:number){
 const avg=AVG_SALARY[club.league]??0;if(!avg)return 0;
 const level=club.baseLevel??club.reputation,team=Math.exp(SALARY.club*(level-leagueLevel(club.league)));
 const role=clamp(Math.exp(SALARY.role*fit),SALARY.roleMin,SALARY.roleMax);
 const youth=age<SALARY.youthAge?SALARY.youthMin+(1-SALARY.youthMin)*clamp((age-18)/(SALARY.youthAge-18),0,1):1;
 return Math.round(Math.max(SALARY.floor,avg*team*role*youth)/100)*100;
}
/** League-typical salary for an ability (an average club, an average treatment for that ability). */
export const roleSalary=(ability:number,league:number)=>{const avg=AVG_SALARY[league]??0;if(!avg)return 0;return Math.round(Math.max(SALARY.floor,avg*clamp(Math.exp(SALARY.role*(ability-leagueLevel(league))),SALARY.roleMin,SALARY.roleMax))/100)*100;};
/** 0.14 older saves: budgets to the new scale, the running contract and open offers re-priced, fees ×FEE_SCALE. */
export function migrateEconomy(w:World,p:{a:Attributes,pos:Position,age:number}){
 if(w.economy===2)return;
 for(const c of w.clubs)if(c.league>0&&OLD_INCOME[c.league])c.budget=Math.round(c.budget*leagueDef(c.league).income/OLD_INCOME[c.league]);
 const ability=roleAbility(p.a,p.pos),club=clubOf(w);
 if(w.contract.salary>0&&club.league>0)w.contract.salary=contractSalary(club,p.age,ability-clubLevel(club,p.pos));
 for(const o of w.offers){const cl=w.clubs.find(c=>c.id===o.clubId);if(!cl)continue;o.salary=contractSalary(cl,p.age,ability-clubLevel(cl,p.pos));o.fee*=FEE_SCALE;}
 w.economy=2;
}
export function expireOffers(w:World){w.offers=w.offers.filter(o=>(o.expiresDay??Infinity)>(w.currentDay??0));}

// ── NPC injuries (0.5) ─────────────────────────────────────────────
// NPCs use the same trait effects as the user (유리몸/잔부상 raise the chance, 회복력/강철몸 lower it,
// injuryWeeks adds/removes weeks). Rolls use a hashed RNG per player and week, so they never shift
// the world's or the career's random streams.
/** Weekly chance of an NPC picking up a knock in training or a match not simulated in detail. */
export const NPC_WEEKLY_INJURY=.008;
/** Match injury rule shared by the user, the rival and NPCs: tired (< 35 energy) players risk 4 %. */
export const MATCH_INJURY_ENERGY=35,MATCH_INJURY_CHANCE=.04;
const roll=(seed:number,key:string)=>random({seed:seedFrom(seed>>>0,key)});
/** One week for every NPC: injured players recover a week, fit players may get injured. The rival is handled by the career. */
export function npcInjuryWeek(w:World,week:number,skip:string[]=[]){
  for(const c of w.clubs)for(const p of c.roster){
    if(skip.includes(p.id))continue;
    if(p.injuryWeeks){p.injuryWeeks--;if(!p.injuryWeeks)delete p.injuryWeeks;continue;}
    const r=roll(w.seed^week,'inj:'+p.id);
    if(r<NPC_WEEKLY_INJURY*injuryChanceMultiplier(p.traits))p.injuryWeeks=injuryWeeks(p.traits,1+Math.floor(roll(w.seed^week,'len:'+p.id)*3));
  }
}
/** Injury after a detailed match, from end-of-match energy (same rule for everyone). Returns weeks or 0. */
export function matchInjury(seed:number,key:string,energy:number,traits:readonly string[]|undefined,baseWeeks=2){
  if(energy>=MATCH_INJURY_ENERGY)return 0;
  return roll(seed,'match-inj:'+key)<MATCH_INJURY_CHANCE*injuryChanceMultiplier(traits)?injuryWeeks(traits,baseWeeks):0;
}
/** Between-match energy recovery for NPCs, scaled by fatigue/recovery traits (강철 체력, 유리몸, 강철몸 …). */
export const npcRecovery=(p:RosterPlayer,base=8)=>base*restRecoveryMultiplier(p.traits)/trainingFatigueMultiplier(p.traits);
export function clearInjuries(w:World,skip:string[]=[]){for(const c of w.clubs)for(const p of c.roster)if(!skip.includes(p.id))delete p.injuryWeeks;}

/** Upgrade the old four-league world without discarding its players, results or live match. */
export function expandWorld(w:World){
 if(w.clubs.length>=OLD_WORLD_CLUB_COUNT)return;
 if(w.clubs.length!==24)throw Error('이전 리그 데이터가 손상되었습니다.');
 const fresh=newWorld(w.seed^w.year,0,w.currentSeasonStart);
 for(const club of w.clubs){const spec=leagueDef(club.league).clubs[Number(club.id.slice(1))%6];club.name=spec[0];club.baseLevel=spec[1];}
 const added=fresh.clubs.slice(24,OLD_WORLD_CLUB_COUNT);
 for(const c of added)for(const p of c.roster)p.id='p'+w.nextId++;
 w.clubs.push(...added);w.tables.push(...added.map(c=>({id:c.id,played:0,won:0,draw:0,lost:0,gf:0,ga:0,points:0})));
 // The running season keeps the old 10-round rules: the new leagues get the same fixtures and catch up on played rounds.
 const leagues=[...new Set(added.map(c=>c.league))];
 for(const l of leagues){const ids=added.filter(c=>c.league===l).map(c=>c.id);legacyFixtures(ids).forEach((round,r)=>{if(!w.fixtures[r])return;w.fixtures[r].push(...round);if(r<w.round)for(const f of round)tableResult(w,f,lightweight(fresh,w.clubs.find(c=>c.id===f.home)!,w.clubs.find(c=>c.id===f.away)!));});}
 w.news.unshift('축구 세계 확장 · 기존 선수·계약·경기 기록을 보존했습니다. 이전 유럽 리그는 네덜란드/잉글랜드로 연결됩니다.');
}
/**
 * 0.15 save migration: 6 → 8 clubs per pro league. Existing clubs keep their ids, players, budgets and results
 * (only their display names become the real club names, the user's school keeps its name); two new clubs per
 * league get ids c72…. A season already running finishes on the old rules (the new clubs join next season).
 */
export function expandTo8(w:World){
 if(w.clubs.length===WORLD_CLUB_COUNT)return;
 if(w.clubs.length!==OLD_WORLD_CLUB_COUNT)throw Error('이전 리그 데이터가 손상되었습니다.');
 for(const club of w.clubs)if(club.league>0){const i=Number(club.id.slice(1))-club.league*6;const spec=leagueDef(club.league).clubs[i];if(spec){club.name=spec[0];}}
 const rng={seed:(w.seed^0x8c1b)>>>0,nextId:w.nextId};
 for(let l=1;l<LEAGUE_DATA.length;l++)for(let i=6;i<leagueDef(l).clubs.length;i++){const club=makeClub(rng as unknown as World,l,i);w.clubs.push(club);}
 w.nextId=rng.nextId;
 if(!w.calendar)w.news.unshift('리그 확장 · 각 프로 리그가 8개 구단으로 늘었습니다. 새 구단은 다음 시즌부터 경기에 참가합니다.');
}
/** 0.14 money in Korean units from 만원: 2억 3,400만원 / 7,500만원 / 0원. */
export function money(manwon:number){
 const v=Math.round(manwon);if(v<=0)return '0원';
 const eok=Math.floor(v/10000),rest=v%10000;
 return eok?`${eok.toLocaleString()}억${rest?` ${rest.toLocaleString()}만`:''}원`:`${rest.toLocaleString()}만원`;
}
