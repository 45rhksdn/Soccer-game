import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {newCareer,retire} from '../src/career';
import {attributes} from '../src/engine';
import {applyDaily} from '../src/development';
import {applyAging} from '../src/aging';
import {encode,decode} from '../src/storage';
import {generateCandidates,careerFromCandidate} from '../src/scouting';
import {contrastRival,growthOutlook,playerIntroduction,recordAge} from '../src/origins';
import {emptyLegacy,recordRetirement,potentialBonus,scoutLevel} from '../src/legacy';
import {trainingGrowthMultiplier,trainingFatigueMultiplier,injuryChanceMultiplier,TRAIT_DEFS} from '../src/traits';
const profile={name:'이야기',age:16,pos:'CM' as const,secondary:'ST' as const,foot:'오른',height:178,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'};
it('stories and outlook reflect actual skills; uncertainty does not reveal potential; reads consume no RNG',()=>{
 const c=newCareer(profile,0,11);c.player.a=attributes(40);c.player.a.speed=c.player.a.acceleration=80;
 expect(playerIntroduction(c.player)).toContain('달리기');const before=structuredClone(c);
 for(let i=0;i<50;i++)growthOutlook(c.player,c.id!,i);
 expect(c).toEqual(before);expect(growthOutlook(c.player,c.id!,12).note).toContain(c.player.curve);
 const list=generateCandidates(20,'seoul-boin',0);expect(list).toEqual(generateCandidates(20,'seoul-boin',0));
 const a=careerFromCandidate(list[0],20);expect(a.story?.intro).toBe(playerIntroduction(list[0]));expect(a.player.a).toEqual(list[0].a);
});
it('rival specialty differs without an artificial total ability advantage; persists through save',()=>{
 const c=newCareer(profile,0,20);c.player.a=attributes(50);c.player.a.passing=c.player.a.vision=65;
 const rival=structuredClone(c.player),sum=(a:typeof rival.a)=>Object.values(a).reduce((n,v)=>n+v,0),before=sum(rival.a);
 contrastRival(c.player,rival);expect(sum(rival.a)).toBe(before);expect(rival.a.dribbling).toBe(54);expect(rival.a.passing).toBe(61);
 expect(c.development.rival.school).not.toBe(c.school);expect(c.development.rival.player.pos).toBe(c.player.pos);
 expect(decode(encode(c))).toEqual(c);
});
it('early retirement archives but cannot farm rewards; completed seasons reward once and keep age records',()=>{
 const c=newCareer(profile,0,21);retire(c);const early=recordRetirement(emptyLegacy(),c);
 expect(early.legacy.retired).toHaveLength(1);expect(early.rewarded).toBe(false);expect(potentialBonus(early.legacy)).toBe(0);expect(scoutLevel(early.legacy)).toBe(0);
 const mature=newCareer(profile,0,22);mature.world.records=Array.from({length:3},(_,i)=>({year:2026+i,club:'학교',league:'고교',rank:1,appearances:10,minutes:900,goals:0,assists:3,rating:7,champion:'학교'}));
 recordAge(mature);recordAge(mature);expect(mature.story!.ageRecords).toHaveLength(1);retire(mature);
 const out=recordRetirement(early.legacy,mature);expect(out.rewarded).toBe(true);expect(potentialBonus(out.legacy)).toBe(1);expect(scoutLevel(out.legacy)).toBe(1);
 expect(recordRetirement(out.legacy,decode(encode(mature))).rewarded).toBe(false);
 const old={version:1 as const,retired:[{id:'old',name:'선배',year:2040,age:36,pos:'CM'}]};expect(potentialBonus(old)).toBe(1);
});
it('old saves stay unmodified; malformed optional story rejected',()=>{
 const c=newCareer(profile,0,12);delete c.story;expect(decode(encode(c))).toEqual(c);
 const broken={...c,story:{intro:1,ageRecords:[]}};expect(()=>decode(encode(broken as never))).toThrow();
});
it('trait combinations cannot multiply growth, fatigue or injury into extreme values',()=>{
 for(const a of TRAIT_DEFS)for(const b of TRAIT_DEFS)for(const d of TRAIT_DEFS){const t=[a.id,b.id,d.id];expect(trainingGrowthMultiplier(t)).toBeLessThanOrEqual(1.35);expect(trainingGrowthMultiplier(t)).toBeGreaterThanOrEqual(.8);expect(trainingFatigueMultiplier(t)).toBeLessThanOrEqual(1.3);expect(injuryChanceMultiplier(t)).toBeLessThanOrEqual(1.4);}
});
it('paired long-term training model: outliers remain manageable across identical seeds and recovery',()=>{
 const groups=[[],['천재'],['행운아'],['유리몸'],['강철몸'],['불운'],['게으름']];
 const result=groups.map(traits=>{let total=0;for(let seed=1;seed<=12;seed++){
  const c=newCareer(profile,0,seed);c.player.a=attributes(45);c.player.potential=85;c.player.learning=1;c.development.traits=traits;c.seed=seed;
  for(let age=16;age<=32;age++){c.player.age=age;applyAging(c.player.a,traits,age);for(let week=0;week<12;week++){
   for(const day of ['passing','running','rest','passing','rest','rest','rest'] as const)applyDaily(c,c.player,day,traits);
   if(c.player.injuryWeeks)c.player.injuryWeeks--;
  }}total+=c.player.a.passing;
 }return {traits:traits.join(' + ')||'없음',meanPassingAt32:total/12};});
 const base=result[0].meanPassingAt32;
 for(const r of result)expect(Math.abs(r.meanPassingAt32-base)).toBeLessThan(8);
 writeFileSync('reports/v013-training.json',JSON.stringify({model:'12 seeds × 17 ages × 12 weeks; training/recovery only, not full matches',result},null,2));
},60000);
