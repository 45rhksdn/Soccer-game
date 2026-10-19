import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {newCareer,settle,selection,startCareerMatch,ratingTrust,nextStatus,statusOf,signOffer,initialTrust,payWeeks,capTrust,currentMatchup,nextSeason,type Career} from '../src/career';
import {finishMatch,attributes,type Attr} from '../src/engine';
import {encode,decode} from '../src/storage';
import {newWorld,clubOf,generateOffers,clubLevel,transferWindow,WINDOW_WEEKS,GUARANTEE_GAP,matchupFor,resolveWeek} from '../src/world';
import {LEAGUE_DATA,LEAGUES,WORLD_CLUB_COUNT} from '../src/leagues';
import {SEASON_WEEKS,PRO_SLOTS,SCHOOL_SLOTS,MATCH_DAY_ODDS,MIN_REST_DAYS,drawMatchDays,leagueRounds,makeBracket,playRound,scoutBonusFor,SCOUT_MAX,stageReached} from '../src/season';
import {playToday,startTodayMatch,isMatchToday,matchDayIndex,vacationPrice,ceil2,focusPrice,focusGrow,FOCUS,DAILY,FOCUS_KEYS} from '../src/development';
import {grow} from '../src/career';
import {roleAbility} from '../src/roles';
import {SCHOOLS_KR} from '../src/schools';

const profile={name:'시즌',age:17,pos:'CM' as const,secondary:'ST' as const,foot:'오른',height:178,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'};
/** Plays one career week day by day (rest on non-match days, the match simulated to the end). */
/** Yield to the test runner (vitest's worker RPC times out on long synchronous loops). */
const tick=()=>new Promise(r=>setTimeout(r,0));
function playWeek(c:Career,day:'rest'|'passing'='rest'){
 for(let guard=0;guard<9;guard++){
  if(c.world.phase==='offseason'&&!c.development.active)return;
  if(isMatchToday(c)){startTodayMatch(c);finishMatch(c.match!);settle(c);if(!c.development.active)return;continue;}
  if(playToday(c,day).weekDone)return;
 }
 throw Error('week did not finish');
}
const pro=(seed=11,clubId='c6')=>{const c=newCareer({...profile,age:22},0,seed,{traits:[]});const club=c.world.clubs.find(x=>x.id===clubId)!;c.world.clubId=club.id;c.world.contract={salary:20000,years:2,role:'주전 경쟁'};c.player.a=attributes(roleAbility(club.roster[5].a,'CM')+1);c.world.seasonClubs=[club.id];return c;};

it('11 professional leagues of 8 clubs (pre-0.15 ids kept), 28 league rounds, 35 one-match weeks',()=>{
 const w=newWorld(3,0);
 expect(w.clubs).toHaveLength(WORLD_CLUB_COUNT);expect(WORLD_CLUB_COUNT).toBe(94);
 expect(LEAGUE_DATA.filter(l=>l.id>0)).toHaveLength(11);
 for(let l=1;l<LEAGUE_DATA.length;l++){const clubs=w.clubs.filter(c=>c.league===l);expect(clubs).toHaveLength(8);
  expect(clubs.slice(0,6).map(c=>c.id)).toEqual(Array.from({length:6},(_,i)=>'c'+(l*6+i)));
  for(const club of clubs){const games=w.fixtures.flat().filter(f=>f.home===club.id||f.away===club.id);expect(games).toHaveLength(28);expect(games.filter(f=>f.home===club.id)).toHaveLength(14);
   for(const other of clubs.filter(x=>x!==club))expect(games.filter(f=>f.home===other.id||f.away===other.id)).toHaveLength(4);}}
 expect(w.clubs.filter(c=>c.league===0)).toHaveLength(6);
 // every round: every pro club plays exactly once
 for(const r of w.fixtures){const ids=r.flatMap(f=>[f.home,f.away]);expect(new Set(ids).size).toBe(ids.length);expect(ids).toHaveLength(88);}
 expect(PRO_SLOTS).toHaveLength(SEASON_WEEKS);expect(SCHOOL_SLOTS).toHaveLength(SEASON_WEEKS);
 expect(PRO_SLOTS.filter(s=>s.kind==='league')).toHaveLength(28);
 expect(PRO_SLOTS.filter(s=>s.kind==='cup')).toHaveLength(3);expect(PRO_SLOTS.filter(s=>s.kind==='continental')).toHaveLength(2);expect(PRO_SLOTS.filter(s=>s.kind==='national')).toHaveLength(2);
 expect(SCHOOL_SLOTS.filter(s=>s.kind==='school')).toHaveLength(25);expect(SCHOOL_SLOTS.filter(s=>s.kind==='regional')).toHaveLength(4);expect(SCHOOL_SLOTS.filter(s=>s.kind==='schoolNational')).toHaveLength(5);
 expect(leagueRounds(['a','b','c','d','e','f','g','h'])).toHaveLength(28);
 // real club names
 expect(w.clubs.filter(c=>c.league===3).map(c=>c.name)).toContain('맨체스터 시티');expect(LEAGUES[1]).toBe('K리그1');
});

it('match weekdays follow the odds, keep a rest gap and survive save/load',()=>{
 const counts=Array(7).fill(0);
 for(let y=0;y<40;y++){const days=drawMatchDays(77+y,2026+y);expect(days).toHaveLength(35);days.forEach((d,k)=>{counts[d]++;if(k)expect(d+7-days[k-1]).toBeGreaterThanOrEqual(MIN_REST_DAYS);});}
 const share=counts.map(n=>n/(40*35));expect(share[5]).toBeGreaterThan(share[0]);expect(share[6]).toBeGreaterThan(share[3]);expect(Math.abs(share[5]-MATCH_DAY_ODDS[5])).toBeLessThan(.08);
 const c=newCareer(profile,0,5),days=[...c.world.season!.matchDays];expect(new Set(days).size).toBeGreaterThan(2);
 const back=decode(encode(c));expect(back.world.season!.matchDays).toEqual(days);expect(matchDayIndex(back)).toBe(days[0]);
 // the match is on the saved day; training is blocked that day; after the match the next day follows
 let guard=0;while(!isMatchToday(c)&&guard++<7)playToday(c,'rest');
 expect(c.development.active?.cursor??0).toBe(days[0]);expect(()=>playToday(c,'rest')).toThrow();
 startTodayMatch(c);finishMatch(c.match!);settle(c);
 if(days[0]<6){expect(c.development.active?.cursor).toBe(days[0]+1);expect(isMatchToday(c)).toBe(false);}else expect(c.development.active).toBeUndefined();
});

it('knockouts: byes, a single-entrant region, results decide who goes through',()=>{
 const b=makeBracket('t',['a','b','c','d','e'],0);expect(b.size).toBe(8);expect(b.rounds[0].filter(t=>!t.b).map(t=>t.a)).toEqual(['a','b','c']);
 const forced=new Map([['d',{score:[0,2] as [number,number]}]]);playRound(b,0,1,()=>50,forced);
 expect(b.rounds[0].find(t=>t.a==='d'||t.b==='d')!.winner).toBe('e');expect(b.rounds[1]).toHaveLength(2);
 playRound(b,1,1,()=>50,new Map([['a',{score:[1,1] as [number,number],winnerA:false}]]));expect(stageReached(b,'a')).toBe(1);
 playRound(b,2,1,()=>50,new Map());expect(b.champion).toBeDefined();expect(b.runnerUp).toBeDefined();expect(stageReached(b,b.champion!)).toBe(3);
 const one=makeBracket('one',['x'],0);expect(one.champion).toBe('x');expect(one.rounds).toHaveLength(0);
});

it('a full school season: weekly school matches, regional knockouts, a 32-school national with every regional champion, scout bonus on contracts only',async()=>{
 const c=newCareer(profile,0,2026,{schoolRef:{id:SCHOOLS_KR[0].id,name:SCHOOLS_KR[0].name,region:SCHOOLS_KR[0].region}});
 const ss=c.world.season!.school!;const mine=ss.entrants.find(e=>e.clubId===c.world.clubId)!;expect(mine.name).toBe(SCHOOLS_KR[0].name);
 const before={...c.player.a};let weeks=0;
 while(c.world.phase!=='offseason'&&weeks<40){
  // a fast deterministic week: the user's match is simulated by the engine, everything else by resolveWeek
  const mu=currentMatchup(c)!;expect(mu).toBeDefined();
  if(weeks<25)expect(['school'].includes(mu.kind)).toBe(true);
  playWeek(c);weeks++;await tick();
 }
 expect(weeks).toBe(35);expect(c.world.season!.played).toBe(35);expect(c.world.season!.log).toHaveLength(35);
 const s=c.world.season!.school!;
 const regions=new Set(s.entrants.map(e=>e.region));expect(Object.keys(s.regional).length).toBe(regions.size);
 for(const b of Object.values(s.regional))expect(b.champion).toBeDefined();
 expect(s.national!.size).toBe(32);const field=s.national!.rounds[0].flatMap(t=>[t.a,t.b]);expect(new Set(field).size).toBe(32);
 for(const b of Object.values(s.regional))expect(field).toContain(b.champion);
 expect(s.national!.champion).toBeDefined();expect(s.national!.rounds).toHaveLength(5);
 // scout bonus: the scaled value is stored and never touches the real attributes
 const bonus=c.world.scoutBonus!;expect(bonus.year).toBe(c.world.year);expect(bonus.value).toBeGreaterThanOrEqual(0);expect(bonus.value).toBeLessThanOrEqual(SCOUT_MAX);
 expect(c.world.records.at(-1)!.club).toBe(SCHOOLS_KR[0].name);
 for(const k of Object.keys(before) as Attr[])expect(c.player.a[k]).toBeGreaterThanOrEqual(before[k]); // only growth, no bonus
 console.log(`    school season: national stage ${bonus.stage}, bonus ${bonus.value}, champion ${s.entrants.find(e=>e.id===s.national!.champion)?.name}`);
},120000);

it('scout bonus: 32강 .5 … 우승 6, MVP +2, scaled by minutes and form, at most 8; offers improve, the real OVR does not change',()=>{
 const u=(minutes:number,avg:number,n=5)=>({entrant:'x',matches:n,minutes,ratingSum:avg*n,goals:0,assists:0,team:5});
 expect(scoutBonusFor(5,true,u(450,7.2),450)).toBe(SCOUT_MAX);expect(scoutBonusFor(5,false,u(450,7.5),450)).toBe(6);
 expect(scoutBonusFor(0,false,u(90,7.5,1),90)).toBe(.5);expect(scoutBonusFor(3,false,u(225,7,5),450)).toBe(1.8);
 expect(scoutBonusFor(4,false,u(0,0,0),360)).toBe(0);expect(scoutBonusFor(-1,true,u(450,8),450)).toBe(0);
 const c=newCareer({...profile,age:18},0,31);c.player.a=attributes(58);c.world.phase='offseason';
 const ability=roleAbility(c.player.a,c.player.pos),a0=structuredClone(c.player.a);
 generateOffers(c.world,{...c.player,age:19},6.8,0);const plain=new Map(c.world.offers.map(o=>[o.clubId,o.salary]));
 generateOffers(c.world,{...c.player,age:19},6.8,6);
 expect(c.player.a).toEqual(a0);expect(roleAbility(c.player.a,c.player.pos)).toBe(ability);
 const shared=c.world.offers.filter(o=>plain.has(o.clubId)&&!o.pitch);expect(shared.length+c.world.offers.length).toBeGreaterThan(0);
 for(const o of shared)expect(o.salary).toBeGreaterThanOrEqual(plain.get(o.clubId)!);
});

it('offers vary (prospect / guaranteed start / premium / growth); a guaranteed start needs a real gap within 8',()=>{
 const c=newCareer({...profile,age:20},0,9);c.player.a=attributes(66);c.world.phase='offseason';
 const kinds=new Set<string>();
 for(const bonus of [0,4,8]){generateOffers(c.world,{...c.player,age:20},7.2,bonus);const real=roleAbility(c.player.a,c.player.pos);
  for(const o of c.world.offers){if(o.pitch)kinds.add(o.pitch);if(o.pitch==='주전 보장'){const club=c.world.clubs.find(x=>x.id===o.clubId)!;expect(clubLevel(club,c.player.pos)-real).toBeLessThanOrEqual(GUARANTEE_GAP);}}
  expect(c.world.offers.filter(o=>o.pitch).length).toBe(new Set(c.world.offers.filter(o=>o.pitch).map(o=>o.pitch)).size);}
 expect(kinds.size).toBeGreaterThanOrEqual(3);
 expect(initialTrust({pitch:'주전 보장'})).toBe(72);expect(initialTrust({role:'주전 경쟁'})).toBe(60);expect(initialTrust({role:'로테이션'})).toBe(45);expect(initialTrust({role:'유망주 / 벤치'})).toBe(35);
});

it('coach trust: rating table at the shown precision, minutes scaling, ≤ 6.5 always costs ≥ 1, trait multiplier on gains only, mission never makes a poor match positive',()=>{
 expect(ratingTrust(5.4,90,[])).toBe(-12);expect(ratingTrust(5.5,90,[])).toBe(-9);expect(ratingTrust(6.0,90,[])).toBe(-5);expect(ratingTrust(6.5,90,[])).toBe(-5);
 expect(ratingTrust(6.504,90,[])).toBe(-5); // shown as 6.50
 expect(ratingTrust(6.51,90,[])).toBe(3);expect(ratingTrust(7.0,90,[])).toBe(6);expect(ratingTrust(7.5,90,[])).toBe(10);
 expect(ratingTrust(7.5,30,[])).toBeCloseTo(6.5);expect(ratingTrust(7.5,10,[])).toBeCloseTo(2.5);expect(ratingTrust(7.5,0,[])).toBe(0);
 expect(ratingTrust(6.2,10,[])).toBe(-1.25);expect(ratingTrust(6.4,3,[])).toBeLessThanOrEqual(-1);
 for(const m of [1,5,19,20,44,45,90])expect(ratingTrust(6.5,m,[])).toBeLessThanOrEqual(-1);
 expect(ratingTrust(7.5,90,['성실함'])).toBeGreaterThan(10);expect(ratingTrust(5,90,['성실함'])).toBe(-12);
 expect(ratingTrust(7.5,90,['감독과 불화'])).toBeLessThan(10);expect(ratingTrust(5,90,['감독과 불화'])).toBe(-12);
 // mission bonus after a poor match: still a net loss of at least 1
 expect(capTrust(60,62,6.4,true)).toBe(59);expect(capTrust(60,57,6.4,true)).toBe(57);expect(capTrust(60,66,7.1,true)).toBe(66);expect(capTrust(60,62,6.4,false)).toBe(62);
});

it('squad status bands with hysteresis (55 keeps 주전, 63 needed to regain it)',()=>{
 let s=nextStatus(60,undefined);expect(s).toBe('로테이션');s=nextStatus(70,s);expect(s).toBe('주전');
 s=nextStatus(56,s);expect(s).toBe('주전');s=nextStatus(54,s);expect(s).toBe('로테이션');
 s=nextStatus(58,s);expect(s).toBe('로테이션');s=nextStatus(62.9,s);expect(s).toBe('로테이션');s=nextStatus(63,s);expect(s).toBe('주전');
 expect(nextStatus(80,s)).toBe('핵심 주전');expect(nextStatus(34,'로테이션')).toBe('후보');expect(nextStatus(35,'후보')).toBe('로테이션');
});

it('selection by status: 주전 starts, 로테이션 comes on at 60′, 후보 at 75′ or is left out; a guaranteed start beats low trust',()=>{
 const c=pro();
 c.player.trust=70;c.player.status='주전';expect(selection(c).index).toBeGreaterThanOrEqual(0);
 c.player.trust=45;c.player.status='로테이션';let plan=selection(c);expect(plan.index).toBe(-1);expect(plan.benchMinute).toBe(60);
 startCareerMatch(c);expect(c.match!.userOnPitch).toBe(false);expect(c.match!.benchEntry?.minute).toBe(60);
 finishMatch(c.match!);expect(c.match!.players[c.match!.userId].stats.minutes).toBeGreaterThan(20);
 settle(c);expect(c.history[0].stats.minutes).toBeGreaterThan(20);expect(c.player.lastTrust).toBeDefined();
 c.player.trust=20;c.player.status='후보';plan=selection(c);expect(plan.index).toBe(-1);expect([75,undefined]).toContain(plan.benchMinute);
 c.world.contract.trialMatches=3;c.player.energy=90;plan=selection(c);expect(plan.index).toBeGreaterThanOrEqual(0);expect(plan.role).toContain('주전 보장');
 c.player.injuryWeeks=1;expect(selection(c).index).toBe(-1);
});

it('trust recovers from 로테이션 back to 주전 through good matches (63 threshold)',()=>{
 const c=pro(13);c.player.trust=50;c.player.status='로테이션';let matches=0;
 while(statusOf(c.player)!=='주전'&&matches<30){c.player.trust=Math.max(c.player.trust,50); // isolate the rule: good ratings only
  const t0=c.player.trust;c.player.trust=Math.min(100,t0+ratingTrust(7.6,60,[]));c.player.status=nextStatus(c.player.trust,c.player.status);matches++;}
 expect(statusOf(c.player)).toBe('주전');expect(c.player.trust).toBeGreaterThanOrEqual(63);expect(matches).toBe(2);
});

it('guaranteed starts use up only available club matches; a mid-season move keeps the season record of both clubs',async()=>{
 const c=pro(21);playWeek(c);playWeek(c);
 expect(transferWindow(c.world)).toBe(true);expect(WINDOW_WEEKS).toEqual([0,1,2,16,17]);
 // a formal offer in the window: guaranteed start at another K-League club
 const target=c.world.clubs.find(x=>x.league===1&&x.id!==c.world.clubId)!;
 c.world.offers=[{clubId:target.id,salary:30000,years:2,fee:0,role:'주전 보장 계약',pitch:'주전 보장',negotiated:false,status:'open',kind:'transfer',issuedDay:c.day,expiresDay:c.day+14}];
 const oldTrust=c.player.trust,oldClub=c.world.clubId;signOffer(c,target.id);
 expect(c.world.clubId).toBe(target.id);expect(c.player.trust).toBe(72);expect(c.world.contract.trialMatches).toBe(3);
 expect(c.world.trustLog!.at(-1)).toMatchObject({trust:Math.round(oldTrust*10)/10});expect(c.world.seasonClubs).toEqual([oldClub,target.id]);
 c.player.injuryWeeks=2;playWeek(c);expect(c.world.contract.trialMatches).toBe(3); // injured: not used
 playWeek(c);expect(c.world.contract.trialMatches).toBe(3);c.player.injuryWeeks=0;
 c.player.energy=100;c.player.trust=30;c.player.status='후보';expect(selection(c).index).toBeGreaterThanOrEqual(0);
 playWeek(c);expect(c.world.contract.trialMatches).toBe(2);expect(c.history[0].club).toBe(target.id);
 let guard=0;while(c.world.phase!=='offseason'&&guard++<40){playWeek(c);await tick();}
 const recs=c.world.records.filter(r=>r.year===c.world.year);expect(recs.map(r=>r.club)).toEqual([c.world.clubs.find(x=>x.id===oldClub)!.name,target.name]);
 expect(recs[0].appearances+recs[1].appearances).toBeGreaterThan(0);
 expect(c.world.tables.filter(t=>c.world.clubs.find(x=>x.id===t.id)!.league===1).every(t=>t.played===28)).toBe(true);
 const cup=c.world.season!.cups[1];expect(cup.champion).toBeDefined();expect(Object.values(c.world.season!.continental).every(b=>b.champion)).toBe(true);
},180000);

it('weekly salary: 35 payments add up to the contract exactly, never twice (save/load, transfer), budgets never negative',()=>{
 const c=pro(41);const S=c.world.contract.salary=12345;const club=clubOf(c.world),budget=club.budget,w0=c.development.wallet,wealth0=c.world.wealth;
 const s=c.world.season!;
 for(let k=1;k<=35;k++){s.played=k;payWeeks(c);expect(payWeeks(c)).toBe(0);if(k===10){const back=decode(encode(c));expect(payWeeks(back)).toBe(0);}}
 expect(c.world.wealth-wealth0).toBe(S);expect(c.development.wallet-w0).toBe(S);expect(club.budget).toBe(budget-S);
 const poor=pro(42);clubOf(poor.world).budget=100;poor.world.season!.played=35;payWeeks(poor);expect(clubOf(poor.world).budget).toBe(0);
});

it('focused training: the chosen attribute grows most, the total is never above a normal session, exact fee, 3 a week, no fee on rest or cap',()=>{
 const c=newCareer(profile,0,61,{traits:[]});
 // the growth split itself
 const p1=structuredClone(c.player),p2=structuredClone(c.player);
 const normal=grow(p1,DAILY.shooting.keys,.06);const focused=focusGrow(p2,DAILY.shooting.keys,FOCUS_KEYS.shooting,'finishing',.06);
 expect(focused).toBeLessThanOrEqual(normal+1e-9);expect(focused).toBeGreaterThan(normal*.9);
 const gains=FOCUS_KEYS.shooting.map(k=>p2.a[k]-c.player.a[k]);expect(Math.max(...gains)).toBe(p2.a.finishing-c.player.a.finishing);
 for(const k of ['anticipation','positioning','decisions','composure'])expect(FOCUS_KEYS.reading as readonly string[]).toContain(k);
 // fees through the daily schedule
 expect(focusPrice(c)).toBe(1.4);c.development.wallet=5;
 const before=c.player.a.longShot;playToday(c,'shooting','longShot');expect(c.development.wallet).toBeCloseTo(3.6);expect(c.player.a.longShot).toBeGreaterThan(before);
 c.player.energy=10;const w=c.development.wallet;playToday(c,'shooting','longShot');expect(c.development.wallet).toBe(w); // turned into rest: free
 c.player.energy=100;c.player.a.curve=c.player.potential;expect(()=>playToday(c,'shooting','curve')).toThrow(/한계/);expect(c.development.wallet).toBe(w); // capped: told first, free
 c.development.wallet=1;expect(()=>playToday(c,'passing','longPassing')).toThrow();expect(c.development.wallet).toBe(1);
 c.development.wallet=100;let n=0;while(n<5&&!isMatchToday(c)){try{playToday(c,'passing','vision');n++;}catch{break;}}
 expect(c.development.active?.user?.paidFocus??3).toBeLessThanOrEqual(FOCUS.perWeek);
});

it('vacation costs about 1 % of the salary, rounded up to two digits (5만원 without a salary)',()=>{
 expect(ceil2(54)).toBe(54);expect(ceil2(234)).toBe(240);expect(ceil2(15980)).toBe(16000);expect(ceil2(123.4)).toBe(130);expect(ceil2(5.4)).toBe(6);
 const c=newCareer(profile,0,3);expect(vacationPrice(c)).toBe(5);
 const p=pro();p.world.contract.salary=54000;expect(vacationPrice(p)).toBe(540);p.world.contract.salary=23400;expect(vacationPrice(p)).toBe(240);
});

it('a v8 save with a live match: 72 → 94 clubs, ids/players/contract/match kept, the old season finishes on the old rules, the next one has the calendar',async()=>{
 const text=readFileSync(new URL('./fixtures/v8-live-match.json',import.meta.url),'utf8'),raw=JSON.parse(JSON.parse(text).payload);
 expect(raw.version).toBe(8);expect(raw.world.clubs).toHaveLength(72);
 const c=decode(text);
 expect(c.version).toBe(10);expect(c.world.clubs).toHaveLength(94);expect(c.world.calendar).toBeUndefined();
 expect(c.world.clubs.slice(0,72).map(x=>x.id)).toEqual(raw.world.clubs.map((x:{id:string})=>x.id));
 expect(c.world.clubs.slice(0,72).map(x=>x.roster)).toEqual(raw.world.clubs.map((x:{roster:unknown})=>x.roster));
 expect(c.world.clubId).toBe(raw.world.clubId);expect(clubOf(c.world).name).toBe(LEAGUE_DATA[1].clubs[0][0]);
 expect(c.world.contract).toEqual(raw.world.contract);expect(c.player.trust).toBe(raw.player.trust);expect(c.development.wallet).toBe(raw.development.wallet);
 expect(c.match).toEqual(raw.match);expect(c.history).toEqual(raw.history);
 finishMatch(c.match!);settle(c);expect(c.world.round).toBe(raw.world.round+1);
 let guard=0;while(c.world.phase!=='offseason'&&guard++<30){playWeek(c);await tick();}
 expect(c.world.phase).toBe('offseason');expect(c.world.calendar).toBeUndefined();
 c.world.contract.years=Math.max(1,c.world.contract.years);nextSeason(c);
 expect(c.world.calendar).toBe(35);expect(c.world.season!.played).toBe(0);expect(c.world.fixtures).toHaveLength(28);
 expect(matchupFor(c.world,c.world.clubId)).toBeDefined();
 const again=decode(encode(c));expect(again.world.season).toEqual(c.world.season);
},120000);

it('resolveWeek keeps one shared result when the user meets the rival club',()=>{
 const c=pro(71);const mu=currentMatchup(c)!;expect(mu.kind).toBe('league');
 const results=new Map([[c.world.clubId,{gf:3,ga:1}]]);resolveWeek(c.world,results);
 const f=c.world.fixtures[0].find(f=>f.home===c.world.clubId||f.away===c.world.clubId)!;
 expect(f.score).toEqual(f.home===c.world.clubId?[3,1]:[1,3]);
 const opp=c.world.tables.find(t=>t.id===mu.opponentId)!;expect(opp.ga).toBe(3);expect(opp.gf).toBe(1);
});
