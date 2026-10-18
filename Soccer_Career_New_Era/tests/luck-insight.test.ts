import {it,expect} from 'vitest';
import {newCareer,startCareerMatch,settle} from '../src/career';
import {attributes,createMatch,finishMatch,insightAttempt,random,ATTRS} from '../src/engine';
import {applyDaily,playToday,LUCKY_NEWS,INSIGHT_NEWS,applyInsights} from '../src/development';
import {insightChance,trainingLuckChance,trainingLuckBase,INSIGHT_CHANCE,luckMultiplier} from '../src/traits';

const profile={name:'확률선수',age:16,pos:'CM' as const,secondary:'ST' as const,foot:'오른',height:178,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'};
const career=(seed=31)=>newCareer(profile,0,seed);
function seedFor(lo:number,hi:number){for(let i=0;i<200000;i++){const v=random({seed:i});if(v>=lo&&v<hi)return i;}throw Error('seed');}

it('insight: 0.5 % per action, 행운아 0.75 %, 불운 ×0.75 — independent of age',()=>{
  expect(INSIGHT_CHANCE).toBe(.005);
  expect(insightChance([])).toBe(.005);expect(insightChance(['행운아'])).toBeCloseTo(.0075,12);expect(insightChance(['불운'])).toBeCloseTo(.005*.75,12);
  expect(insightChance(['행운아','천재'])).toBeCloseTo(.0075,12);
});

it('training lucky by age: ≤20 4.5 %, 21–24 3.5 %, 25–32 2.5 %, 33+ 0.5 %; 행운아 ×1.5, 불운 ×0.75',()=>{
  const table:[number,number][]=[[16,.045],[20,.045],[21,.035],[24,.035],[25,.025],[32,.025],[33,.005],[35,.005]];
  for(const [age,chance] of table){
    expect(trainingLuckBase(age)).toBe(chance);
    expect(trainingLuckChance([],age)).toBeCloseTo(chance,12);
    expect(trainingLuckChance(['행운아'],age)).toBeCloseTo(chance*1.5,12);
    expect(trainingLuckChance(['불운'],age)).toBeCloseTo(chance*.75,12);
  }
  expect(luckMultiplier(['노력파'])).toBe(1);
});

it('measured rates: training lucky follows the age table, insight per attempt follows 0.5 / 0.75 %',()=>{
  for(const [age,traits,expected] of [[17,[],.045],[22,[],.035],[29,['행운아'],.0375],[34,[],.005]] as [number,string[],number][]){
    const c=career(age);c.player.age=age;c.player.potential=99;let hits=0;const n=6000;
    for(let i=0;i<n;i++){c.player.energy=100;c.player.fatigue=0;c.player.a=attributes(40);applyDaily(c,c.player,'passing',traits);if(c.development.news[0]?.kind==='lucky'){hits++;c.development.news.shift();}}
    const rate=hits/n;expect(rate).toBeGreaterThan(expected*.75-.002);expect(rate).toBeLessThan(expected*1.25+.002);
  }
  for(const chance of [insightChance([]),insightChance(['행운아'])]){
    const m=createMatch(7,{name:'검증',pos:'CM',a:attributes(40),energy:100});m.insight={chance,gains:{},events:[]};const p=m.players[m.userId];
    const n=60000;for(let i=0;i<n;i++){p.a.passing=40;insightAttempt(m,p,['passing']);}
    const rate=(m.insight.gains.passing??0)/n;expect(rate).toBeGreaterThan(chance*.8);expect(rate).toBeLessThan(chance*1.2);
  }
});

it('lucky news hides the stat and amount; the growth history keeps the exact value',()=>{
  const c=career(40);c.development.traits=[];c.seed=seedFor(0,.04);
  const r=playToday(c,'passing');expect(r.lucky).toBe(true);
  const n=c.development.news.find(x=>x.kind==='lucky')!;expect(n.text).toBe(LUCKY_NEWS);expect(n.text).toBe('훈련 중 무언가를 느꼈다!');
  expect(n.text).not.toMatch(/패스|\+\d/);
  expect(c.development.active!.entries[0]).toMatch(/럭키! ×10 · 패스훈련 · OVR \+\d/);
});

it('insight news hides the stat; exact gains go to the growth history and the attributes',()=>{
  const c=career(41);c.development.traits=[];for(let i=0;i<5;i++)playToday(c,'rest');
  startCareerMatch(c);c.match!.insight!.chance=0;c.match!.insight!.gains={passing:1,vision:2};const before={...c.player.a};
  finishMatch(c.match!);settle(c);
  expect(c.player.a.vision).toBeGreaterThanOrEqual(before.vision+2);
  const news=c.development.news.filter(x=>x.kind==='insight'&&!x.text.startsWith('라이벌 '));expect(news).toHaveLength(1);expect(news[0].text).toBe(INSIGHT_NEWS);expect(news[0].text).toBe('경기 중에 깨달음을 얻었다!');
  expect(c.development.active!.entries.at(-1)).toContain('깨달음 짧은 패스 +1 · 시야 +2');
});

it('insight at 100: no gain once the permanent value is 100',()=>{
  const c=career(42);c.player.a.passing=100;const m=createMatch(1,{name:'x',pos:'CM',a:attributes(40),energy:100});m.insight={chance:0,gains:{passing:1},events:[]};
  expect(applyInsights(c,m)).toBe('');expect(c.player.a.passing).toBe(100);expect(c.development.news.some(x=>x.kind==='insight')).toBe(false);
  for(const k of ATTRS)expect(c.player.a[k]).toBeLessThanOrEqual(100);
});
