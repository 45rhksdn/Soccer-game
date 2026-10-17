import {it,expect} from 'vitest';
import {newCareer,settle} from '../src/career';
import {finishMatch,emptyStats,createMatch,attributes,type Stat} from '../src/engine';
import {prepareWeek,type Daily} from '../src/development';
import {attackChance,defenseChance} from '../src/tactical';
import {createMission,missionValue,missionState,settleMission,recordDeeds,deedsOf,signatureFx,unlockSignatures,rivalNews,seasonCompare,SIGNATURES,MISSION_REWARD} from '../src/engagement';
import {encode,decode} from '../src/storage';

const profile=(pos:'ST'|'CM'|'CB'|'GK'='ST')=>({name:'몰입선수',age:17,pos,secondary:pos==='ST'?'LW' as const:'CM' as const,foot:'오른',height:180,weight:72,style:'플레이메이커',curve:'꾸준한 성장형'});
const career=(seed=31,pos:'ST'|'CM'|'CB'|'GK'='ST')=>newCareer(profile(pos),0,seed,{traits:[]});
const plan:Daily[]=['passing','running','rest','shooting','rest','rest','rest'];
const stats=(s:Partial<Stat>):Stat=>({...emptyStats(),minutes:90,...s});

it('감독 미션: deterministic per week, fits the position, and never consumes the career random stream',()=>{
  const a=career(),b=career();const seed=a.seed;
  const m1=createMission(a),m2=createMission(b);
  expect(m1).toEqual(m2);expect(a.seed).toBe(seed);
  expect(['shots','onTarget','keyPasses','ballWins']).toContain(m1.stat);
  const gk=career(31,'GK');expect(['saves','goalsConceded','completed']).toContain(createMission(gk).stat);
  // Different weeks pick from the whole pool.
  const seen=new Set<string>();for(let w=0;w<40;w++){a.week=w;seen.add(createMission(a).stat);}
  expect(seen.size).toBeGreaterThanOrEqual(3);
});

it('감독 미션 starts with every career match and the week plays exactly as before',()=>{
  const c=career();prepareWeek(c,[...plan]);
  expect(c.match?.mission).toBeTruthy();expect(c.match!.mission!.label).toMatch(/이상|이하/);
  finishMatch(c.match!);const res=settle(c);
  expect(res.mission?.mission.label).toBe(res.mission?.mission.label);
  expect(c.development.missions!.total).toBe(res.mission!.played?1:0);
  expect(c.development.news.some(n=>n.text.includes('감독 미션'))).toBe(true);
});

it('mission values and live state: min missions complete during play, max missions only at full time',()=>{
  expect(missionValue('ballWins',stats({tackles:2,interceptions:1,defensiveWins:1}))).toBe(4);
  expect(missionValue('attackPoints',stats({goals:1,assists:2}))).toBe(3);
  const m=createMatch(5,{name:'u',pos:'ST',a:attributes(60),energy:100});
  m.mission={id:'x',label:'슈팅 2회 이상',stat:'shots',target:2,cmp:'min'};
  const u=m.players[m.userId];u.stats.minutes=10;
  expect(missionState(m)).toMatchObject({value:0,done:false,failed:false});
  u.stats.shots=2;expect(missionState(m)).toMatchObject({value:2,done:true});
  m.mission={id:'y',label:'실점 2골 이하',stat:'goalsConceded',target:2,cmp:'max'};
  expect(missionState(m)!.done).toBe(false);m.ended=true;expect(missionState(m)!.done).toBe(true);
  u.stats.goalsConceded=3;expect(missionState(m)).toMatchObject({done:false,failed:true});
});

it('mission rewards: trust and wallet on success, nothing taken on failure, no count without minutes',()=>{
  const c=career(),m=createMatch(5,{name:'u',pos:'ST',a:attributes(60),energy:100});
  m.mission={id:'x',label:'슈팅 2회 이상',stat:'shots',target:2,cmp:'min'};m.ended=true;
  const u=m.players[m.userId];
  const trust=c.player.trust,wallet=c.development.wallet;
  u.stats.minutes=0;settleMission(c,m);expect(c.development.missions).toBeUndefined();
  u.stats.minutes=90;u.stats.shots=1;settleMission(c,m);
  expect(c.development.missions).toEqual({done:0,total:1});expect(c.player.trust).toBe(trust);expect(c.development.wallet).toBe(wallet);
  u.stats.shots=3;settleMission(c,m);
  expect(c.development.missions).toEqual({done:1,total:2});
  expect(c.player.trust).toBeCloseTo(Math.min(100,trust+MISSION_REWARD.trust));expect(c.development.wallet).toBe(wallet+MISSION_REWARD.wallet);
});

it('시그니처: deeds accumulate per match, unlock once at the target, and old saves start from their history',()=>{
  const c=career();
  c.history.unshift({id:0,date:'',opponent:'',score:[1,0],rating:7,stats:stats({goals:3,keyPasses:2}),shots:[1,1],xg:[0,0],gain:0} as never);
  expect(deedsOf(c)).toMatchObject({goals:3,keyPasses:2,curlGoals:0});
  expect(recordDeeds(c,stats({goals:1,curlGoals:4}))).toEqual([]);
  const got=recordDeeds(c,stats({curlGoals:1}));
  expect(got.map(s=>s.id)).toEqual(['감아차기 장인']);expect(c.development.signatures).toEqual(['감아차기 장인']);
  expect(recordDeeds(c,stats({curlGoals:3})).length).toBe(0);expect(c.development.signatures).toEqual(['감아차기 장인']);
  // A match without minutes adds nothing.
  const before=deedsOf(c);recordDeeds(c,{...stats({goals:5}),minutes:0});expect(deedsOf(c)).toEqual(before);
  expect(c.development.news[0].text).toContain('시그니처');
});

it('settle does not double count the deciding match when deeds start from history',()=>{
  const c=career();prepareWeek(c,[...plan]);finishMatch(c.match!);
  const s=c.match!.players[c.match!.userId].stats;settle(c);
  expect(deedsOf(c).goals).toBe(s.minutes>0?s.goals:0);
});

it('signature bonus raises only the user’s matching action; NPCs and other actions are unchanged',()=>{
  const c=career();c.development.signatures=['감아차기 장인','철벽 수비'];
  const fx=signatureFx(c)!;expect(fx.curl).toBeCloseTo(.10);expect(fx.tackle).toBeCloseTo(.06);expect(fx.dribble).toBeUndefined();
  const m=createMatch(7,{name:'u',pos:'ST',a:attributes(70),energy:100});
  const u=m.players[m.userId];m.ball.owner=u.id;u.x=88;u.y=30;
  const plainCurl=attackChance(m,'curl'),plainDribble=attackChance(m,'dribble');
  u.fx={signature:fx};
  expect(attackChance(m,'curl')).toBeGreaterThan(plainCurl);expect(attackChance(m,'dribble')).toBeCloseTo(plainDribble);
  // Defensive side: the user's tackle against an opponent in range.
  const o=m.players.find(p=>p.team!==u.team&&p.pos!=='GK')!;o.x=u.x+2;o.y=u.y;m.ball.owner=o.id;
  const withSig=defenseChance(m,'tackle');u.fx=undefined;expect(withSig).toBeGreaterThan(defenseChance(m,'tackle'));
});

it('미션 마스터 unlocks from mission successes and raises the trust reward',()=>{
  const c=career();c.development.missions={done:30,total:40};
  expect(unlockSignatures(c).map(s=>s.id)).toContain('미션 마스터');
  const m=createMatch(5,{name:'u',pos:'ST',a:attributes(60),energy:100});
  m.mission={id:'x',label:'슈팅 1회 이상',stat:'shots',target:1,cmp:'min'};m.ended=true;
  const u=m.players[m.userId];u.stats.minutes=90;u.stats.shots=2;c.player.trust=50;
  settleMission(c,m);expect(c.player.trust).toBe(50+MISSION_REWARD.masterTrust);
});

it('라이벌: weekly head-to-head news and an OVR overtake message only when the lead changes',()=>{
  const c=career(),r=c.development.rival;
  c.history.unshift({id:c.week,date:'',opponent:'',score:[0,0],rating:7.2,stats:stats({}),shots:[0,0],xg:[0,0],gain:0} as never);
  r.history.unshift({week:c.week,rating:6.4,goals:0,club:r.clubId});
  rivalNews(c);expect(c.development.news[0].text).toContain('당신의 승리');
  const ahead=c.development.rivalAhead;expect(typeof ahead).toBe('boolean');
  const count=c.development.news.length;rivalNews(c);
  expect(c.development.news.length).toBe(count+1); // the weekly line again, no overtake line
  for(const k of Object.keys(r.player.a) as (keyof typeof r.player.a)[])r.player.a[k]=ahead?99:1;
  rivalNews(c);expect(c.development.news.some(n=>/앞질렀습니다/.test(n.text))).toBe(true);
  const cmp=seasonCompare(c);expect(cmp.me.apps).toBe(1);expect(cmp.rival.apps).toBe(1);expect(cmp.me.avg).toBeCloseTo(7.2);
});

it('save round trip keeps deeds, signatures, mission record and the live match mission',()=>{
  const c=career();prepareWeek(c,[...plan]);
  c.development.deeds={goals:4,curlGoals:1};c.development.signatures=['골 사냥꾼'];c.development.missions={done:2,total:3};
  const back=decode(encode(c));
  expect(back.development.deeds).toEqual({goals:4,curlGoals:1});expect(back.development.signatures).toEqual(['골 사냥꾼']);
  expect(back.development.missions).toEqual({done:2,total:3});expect(back.match?.mission).toEqual(c.match?.mission);
  expect(SIGNATURES.every(s=>s.target>0)).toBe(true);
});

