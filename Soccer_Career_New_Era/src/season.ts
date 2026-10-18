// 0.15 the 35-week season: one team match every week on a seeded weekday.
// Pro: 28 league rounds (8 clubs, home & away twice), a domestic cup (QF/SF/F), a continental cup (SF/F)
// and a national-team invitational (SF/F). School: 25 regular/exchange weeks, a regional knockout (4 weeks),
// a 32-school national knockout (5 weeks) and a scout showcase. Every NPC result is simulated, so brackets
// always finish with a real winner. Pure world data: no engine changes.
import {random,clamp} from './engine';
import {seedFrom} from './traits';
import {LEAGUE_DATA,leagueDef} from './leagues';
import {SCHOOLS_KR,type Region} from './schools';
import type {World,Club,Fixture,Standing} from './world';

export const SEASON_WEEKS=35;
/**
 * Growth per active week in a 35-week season, so a year still grows about as much as the ~11 active weeks of a
 * pre-0.15 season (training, match growth/experience, 깨달음 chance, potential nudges, late-bloom release).
 */
export const GROWTH_PACE=11/35;
/** Weekday odds for the match (월…일). */
export const MATCH_DAY_ODDS=[.03,.10,.15,.07,.10,.30,.25] as const;
/** Minimum days between two matches (this week's day − last week's day + 7). */
export const MIN_REST_DAYS=3;

export type SlotKind='league'|'cup'|'continental'|'national'|'school'|'regional'|'schoolNational'|'showcase';
/** Pro slots by week index (0-based). */
export const PRO_SLOTS:{kind:SlotKind,round:number,label:string}[]=[
 ...Array.from({length:14},(_,i)=>({kind:'league' as SlotKind,round:i,label:`리그 ${i+1}라운드`})),
 {kind:'cup',round:0,label:'국내 컵 8강'},{kind:'cup',round:1,label:'국내 컵 4강'},
 ...Array.from({length:14},(_,i)=>({kind:'league' as SlotKind,round:14+i,label:`리그 ${15+i}라운드`})),
 {kind:'cup',round:2,label:'국내 컵 결승'},
 {kind:'continental',round:0,label:'대륙 클럽 컵 4강'},{kind:'continental',round:1,label:'대륙 클럽 컵 결승'},
 {kind:'national',round:0,label:'국제 초청대회 4강'},{kind:'national',round:1,label:'국제 초청대회 결승'},
];
/** School slots: 25 regular / exchange weeks, 4 regional knockout weeks, 5 national knockout weeks, 1 showcase. */
export const SCHOOL_SLOTS:{kind:SlotKind,round:number,label:string}[]=[
 ...Array.from({length:25},(_,i)=>({kind:'school' as SlotKind,round:i,label:`지역 리그 · 교류전 ${i+1}주차`})),
 ...Array.from({length:4},(_,i)=>({kind:'regional' as SlotKind,round:i,label:`지역 토너먼트 ${i+1}주차`})),
 ...['32강','16강','8강','4강','결승'].map((r,i)=>({kind:'schoolNational' as SlotKind,round:i,label:`전국대회 ${r}`})),
 {kind:'showcase',round:0,label:'스카우트 쇼케이스'},
];
export const BIG_KINDS:SlotKind[]=['cup','continental','national','regional','schoolNational'];

export type Tie={a:string,b:string,score?:[number,number],winner?:string,shootout?:boolean};
/** Knockout: rounds[r] holds the ties of round r; round r+1 is drawn from the winners. `start` = week index of round 0. */
export type Bracket={name:string,rounds:Tie[][],size:number,start:number,champion?:string,runnerUp?:string};
export type SchoolRow={p:number,w:number,d:number,l:number,gf:number,ga:number,pts:number};
export type Entrant={id:string,name:string,region:Region|string,strength:number,clubId?:string};
export type SchoolSeason={entrants:Entrant[],table:Record<string,SchoolRow>,regional:Record<string,Bracket>,national?:Bracket,
 /** The user's national-tournament record (minutes/ratings) for the scout bonus. */
 user:{entrant:string,matches:number,minutes:number,ratingSum:number,goals:number,assists:number,
  /** national-tournament matches the user's school played (possible minutes = team × 90). */ team?:number},mvp?:{name:string,school:string,user:boolean}};
export type Season={version:1,year:number,matchDays:number[],played:number,
 /** Weeks of salary already paid this season (weekly pay; never paid twice). */ paid?:number,
 /** The user's match of this week as started (national duty fixed at kick-off). */ pending?:{week:number,national:boolean},
 cups:Record<string,Bracket>,continental:Record<string,Bracket>,national?:Bracket,school?:SchoolSeason,
 /** The user's results this season for the calendar (week index → opponent / score / competition). */
 log:{week:number,label:string,opponent:string,score:[number,number]}[]};

const rng=(seed:number,key:string)=>({seed:seedFrom(seed>>>0,key)});
/** Weekday per week, respecting a minimum rest between consecutive matches. */
export function drawMatchDays(seed:number,year:number){
 const days:number[]=[];
 for(let k=0;k<SEASON_WEEKS;k++){
  const r=rng(seed,`day:${year}:${k}`);let day=6;
  for(let tries=0;tries<20;tries++){let x=random(r),d=0;for(;d<6&&x>=MATCH_DAY_ODDS[d];d++)x-=MATCH_DAY_ODDS[d];
   if(!k||d+7-days[k-1]>=MIN_REST_DAYS){day=d;break;}}
  if(k&&day+7-days[k-1]<MIN_REST_DAYS)day=days[k-1]+MIN_REST_DAYS-7; // never closer than the minimum rest
  days.push(day);
 }
 return days;
}
/** Double round robin played twice: 8 clubs → 28 rounds of 4 matches (every pair twice home, twice away). */
export function leagueRounds(ids:string[]):Fixture[][]{
 const n=ids.length,list=[...ids],single:[string,string][][]=[];
 for(let r=0;r<n-1;r++){const round:[string,string][]=[];for(let i=0;i<n/2;i++){const a=list[i],b=list[n-1-i];round.push(r%2?[a,b]:[b,a]);}single.push(round);list.splice(1,0,list.pop()!);}
 const mirror=single.map(r=>r.map(([h,a])=>[a,h] as [string,string]));
 return [...single,...mirror,...single,...mirror].map(r=>r.map(([home,away])=>({home,away})));
}
function shuffled<T>(xs:T[],r:{seed:number}){const out=[...xs];for(let i=out.length-1;i>0;i--){const j=Math.floor(random(r)*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
/** A knockout of `entrants` (byes when not a power of two: top seeds pass round 0). */
export function makeBracket(name:string,entrants:string[],start:number):Bracket{
 let size=1;while(size<entrants.length)size*=2;
 const ties:Tie[]=[];for(let i=0;i<size/2;i++){const a=entrants[i],b=entrants[size-1-i];if(a===undefined)continue;ties.push(b===undefined?{a,b:'',winner:a}:{a,b});}
 return {name,size,start,rounds:size>1?[ties]:[],champion:size===1?entrants[0]:undefined};
}
export const bracketRounds=(b:Bracket)=>Math.round(Math.log2(Math.max(1,b.size)));
/** Ties of round r still to play. */
export const openTies=(b:Bracket,r:number)=>(b.rounds[r]??[]).filter(t=>!t.winner);
function nextRound(b:Bracket,r:number){
 const winners=b.rounds[r].map(t=>t.winner!);
 if(winners.length===1){b.champion=winners[0];const f=b.rounds[r][0];b.runnerUp=f.a===winners[0]?(f.b||undefined):f.a;return;}
 const ties:Tie[]=[];for(let i=0;i<winners.length;i+=2)ties.push({a:winners[i],b:winners[i+1]});b.rounds[r+1]=ties;
}
/** Stage reached by an entrant: 0 = round 0 loss … bracketRounds = champion. */
export function stageReached(b:Bracket|undefined,id:string){if(!b)return -1;if(b.champion===id)return bracketRounds(b);let s=-1;b.rounds.forEach((ties,r)=>{if(ties.some(t=>t.a===id||t.b===id))s=r;});return s;}
const poisson=(r:{seed:number},mean:number)=>{let product=1,n=0;do{n++;product*=random(r);}while(product>Math.exp(-mean)&&n<12);return n-1;};
/** Lightweight score from two strengths (same shape as world.lightweight). */
export function quickScore(r:{seed:number},home:number,away:number):[number,number]{const diff=home-away;return [poisson(r,clamp(1.35+diff*.045,.25,3.5)),poisson(r,clamp(1.2-diff*.045,.25,3.5))];}
/** Settles a tie; a draw goes to a shoot-out (the stronger side slightly favoured). `forced` = the played result. */
export function playTie(t:Tie,r:{seed:number},sa:number,sb:number,forced?:{score:[number,number],winnerA?:boolean}){
 if(t.winner)return;if(!t.b){t.winner=t.a;return;}
 const score=forced?.score??quickScore(r,sa,sb);t.score=score;
 if(score[0]!==score[1])t.winner=score[0]>score[1]?t.a:t.b;
 else{t.shootout=true;const aWins=forced?.winnerA??random(r)<clamp(.5+(sa-sb)*.01,.3,.7);t.winner=aWins?t.a:t.b;}
}
/** Plays every open tie of round r (the user's / rival's tie forced when given) and draws the next round. */
export function playRound(b:Bracket,r:number,seed:number,strength:(id:string)=>number,forced:Map<string,{score:[number,number],winnerA?:boolean}>){
 const ties=b.rounds[r];if(!ties||b.champion)return;
 ties.forEach((t,i)=>{const f=forced.get(t.a)??(t.b?(()=>{const g=forced.get(t.b);return g?{score:[g.score[1],g.score[0]] as [number,number],winnerA:g.winnerA===undefined?undefined:!g.winnerA}:undefined;})():undefined);
  playTie(t,rng(seed,`${b.name}:${r}:${i}`),strength(t.a),t.b?strength(t.b):0,f);});
 if(ties.every(t=>t.winner))nextRound(b,r);
}

// ── Pro competitions ─────────────────────────────────────────────────────
export const CONFEDERATIONS=['유럽','아시아','남미'] as const;
export const NATIONS:{id:string,name:string,strength:number}[]=[{id:'KOR',name:'대한민국 대표팀',strength:70},{id:'JPN',name:'일본 대표팀',strength:68},{id:'BRA',name:'브라질 대표팀',strength:76},{id:'ENG',name:'잉글랜드 대표팀',strength:78}];
export function newProSeason(w:World,seed:number):Pick<Season,'cups'|'continental'|'national'>{
 const cups:Record<string,Bracket>={};
 for(const l of LEAGUE_DATA.filter(l=>l.id>0)){const ids=w.clubs.filter(c=>c.league===l.id).map(c=>c.id);cups[l.id]=makeBracket(`cup-${l.id}`,shuffled(ids,rng(seed,`cup:${w.year}:${l.id}`)),14);}
 return {cups,continental:{},national:makeBracket('national',['KOR','JPN','BRA','ENG'],33)};
}
/** After the league: 4 clubs per confederation — league winners first (by strength), then runners-up. */
export function drawContinental(strength:(id:string)=>number,table:(league:number)=>Standing[]){
 const out:Record<string,Bracket>={};
 for(const conf of CONFEDERATIONS){
  const leagues=LEAGUE_DATA.filter(l=>l.id>0&&l.confederation===conf).map(l=>l.id);const picked:string[]=[];
  for(let place=0;picked.length<4&&place<8;place++){const cands=leagues.map(l=>table(l)[place]?.id).filter((x):x is string=>!!x).sort((a,b)=>strength(b)-strength(a));for(const id of cands)if(picked.length<4)picked.push(id);}
  if(picked.length>=2)out[conf]=makeBracket(`continental-${conf}`,picked,31);
 }
 return out;
}

// ── School competitions ──────────────────────────────────────────────────
const AREA:Record<string,Region>={부산:'부산',서울:'서울',수원:'경기',인천:'인천',대전:'대전',광주:'광주'};
/** Entrants: the real schools (catalogue) plus fictional school clubs (the user's or the rival's when fictional). */
export function schoolEntrants(w:World,user?:{clubId:string,schoolId?:string}):Entrant[]{
 const out:Entrant[]=[];
 for(const s of SCHOOLS_KR){const base=41+seedFrom(w.seed>>>0,'school:'+s.id)%7+(s.affiliation?3:0);out.push({id:'s:'+s.id,name:s.name,region:s.region,strength:base,clubId:user?.schoolId===s.id?user.clubId:undefined});}
 for(const c of w.clubs.filter(c=>c.league===0)){if(user?.schoolId&&c.id===user.clubId)continue;const area=AREA[c.name.split(' ')[0]]??'서울';out.push({id:'c:'+c.id,name:c.name,region:area,strength:c.baseLevel??44,clubId:c.id});}
 return out;
}
export function newSchoolSeason(w:World,user?:{clubId:string,schoolId?:string}):SchoolSeason{
 const entrants=schoolEntrants(w,user),table:Record<string,SchoolRow>={};for(const e of entrants)table[e.id]={p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0};
 const mine=entrants.find(e=>e.clubId===user?.clubId);
 return {entrants,table,regional:{},user:{entrant:mine?.id??'',matches:0,minutes:0,ratingSum:0,goals:0,assists:0}};
}
/** Weekly pairings of the regular / exchange weeks: within the region first, leftovers across regions (교류전). */
export function schoolPairings(s:SchoolSeason,seed:number,year:number,week:number):[string,string][]{
 const r=rng(seed,`school-pair:${year}:${week}`),byRegion=new Map<string,string[]>(),left:string[]=[],pairs:[string,string][]=[];
 for(const e of s.entrants)byRegion.set(e.region,[...(byRegion.get(e.region)??[]),e.id]);
 for(const ids of [...byRegion.values()]){const order=shuffled(ids,r);while(order.length>=2)pairs.push([order.pop()!,order.pop()!]);left.push(...order);}
 const rest=shuffled(left,r);while(rest.length>=2)pairs.push([rest.pop()!,rest.pop()!]);
 return pairs; // with an odd total one school rests (a training match, not recorded)
}
export const schoolRank=(s:SchoolSeason,ids:string[])=>[...ids].sort((a,b)=>{const x=s.table[a],y=s.table[b];return y.pts-x.pts||(y.gf-y.ga)-(x.gf-x.ga)||y.gf-x.gf||a.localeCompare(b);});
/** Regional knockouts after week 25: the best 16 of each region by the regular table; the final falls in week 29. */
export function drawRegional(s:SchoolSeason){
 const byRegion=new Map<string,string[]>();for(const e of s.entrants)byRegion.set(e.region,[...(byRegion.get(e.region)??[]),e.id]);
 for(const [region,ids] of byRegion){const seeded=schoolRank(s,ids).slice(0,16);const b=makeBracket(`regional-${region}`,seeded,0);b.start=29-bracketRounds(b);s.regional[region]=b;}
}
/** 32 schools: every regional champion, then runners-up and semi-finalists by region size, strength and goal difference. */
export function drawSchoolNational(s:SchoolSeason,seed:number,year:number){
 const champs=Object.values(s.regional).map(b=>b.champion!).filter(Boolean);
 const size=(id:string)=>s.entrants.filter(e=>e.region===s.entrants.find(x=>x.id===id)!.region).length;
 const merit=(id:string)=>{const e=s.entrants.find(x=>x.id===id)!,b=s.regional[e.region],row=s.table[id];return stageReached(b,id)*3+Math.log2(1+size(id))*2+e.strength*.15+(row.gf-row.ga)*.05+row.pts/Math.max(1,row.p);};
 const rest=s.entrants.map(e=>e.id).filter(id=>!champs.includes(id)).sort((a,b)=>merit(b)-merit(a));
 const field=[...champs,...rest].slice(0,32);
 s.national=makeBracket('school-national',shuffled(field,rng(seed,`school-national:${year}`)),29);
}
export const schoolStrength=(s:SchoolSeason,id:string)=>s.entrants.find(e=>e.id===id)?.strength??44;
export function recordSchool(s:SchoolSeason,a:string,b:string,score:[number,number]){
 for(const [id,gf,ga] of [[a,score[0],score[1]],[b,score[1],score[0]]] as [string,number,number][]){const t=s.table[id];if(!t)continue;t.p++;t.gf+=gf;t.ga+=ga;if(gf>ga){t.w++;t.pts+=3;}else if(gf===ga){t.d++;t.pts++;}else t.l++;}
}

// ── Scout evaluation from the national tournament (contracts only) ──────────
/** OVR bonus by the best stage reached (32강 … 우승); MVP adds 2; scaled 0–100% by minutes and rating; at most 8. */
export const SCOUT_BONUS=[.5,1,2,3.5,5,6] as const,SCOUT_MVP=2,SCOUT_MAX=8;
export function scoutBonusFor(stage:number,mvp:boolean,u:SchoolSeason['user'],possibleMinutes:number){
 if(stage<0)return 0;const base=SCOUT_BONUS[Math.min(5,stage)]+(mvp?SCOUT_MVP:0);
 const minutes=clamp(u.minutes/Math.max(1,possibleMinutes),0,1),avg=u.matches?u.ratingSum/u.matches:0;
 const form=clamp((avg-5.5)/1.5,0,1); // 5.5 → 0 %, 7.0 → 100 %
 return Math.round(Math.min(SCOUT_MAX,base*minutes*form)*10)/10;
}
export const leagueOf=(w:World,id:string)=>w.clubs.find(c=>c.id===id)?.league??0;
export const clubName=(w:World,id:string)=>w.clubs.find((c:Club)=>c.id===id)?.name??NATIONS.find(n=>n.id===id)?.name??id;
export const confederationOf=(w:World,clubId:string)=>leagueDef(leagueOf(w,clubId)).confederation;
