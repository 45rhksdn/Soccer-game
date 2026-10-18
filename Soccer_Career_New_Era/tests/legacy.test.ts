import {it,expect} from 'vitest';
import {newCareer,nextSeason,settle} from '../src/career';
import {finishMatch} from '../src/engine';
import {prepareWeek,type Daily} from '../src/development';
import {acceptOffer,clubOf} from '../src/world';
import {encode,decode,validate} from '../src/storage';
import {generateCandidates,careerFromCandidate} from '../src/scouting';
import {emptyLegacy,recordRetirement,potentialBonus,RETIREMENT_POTENTIAL_STEP,RETIREMENT_POTENTIAL_MAX_BONUS,validLegacy,type Legacy} from '../src/legacy';

const profile={name:'은퇴선수',age:16,pos:'CM' as const,secondary:'ST' as const,foot:'오른',height:178,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'};
const plan:Daily[]=['passing','running','rest','shooting','rest','rest','rest'];

/** Plays a whole career (weekly runner) until retirement; returns the number of seasons. */
async function playToRetirement(c:ReturnType<typeof newCareer>){
  let seasons=0,guard=0;
  while(c.world.phase!=='retired'&&guard++<3000){
    if(guard%10===0)await new Promise(r=>setTimeout(r,0));
    if(c.world.phase==='offseason'){
      if((c.player.age>=18&&clubOf(c.world).league===0)||(clubOf(c.world).league>0&&c.world.contract.years===0)){
        const offer=c.world.offers.find(o=>o.status==='open');
        if(!offer){c.world.currentDay=c.day;prepareWeek(c,[...plan]);continue;}
        acceptOffer(c.world,offer.clubId,c.player.name);
      }
      nextSeason(c);seasons++;continue;
    }
    prepareWeek(c,[...plan]);if(c.match){finishMatch(c.match);settle(c);}
  }
  return seasons;
}
/** Fast path to retirement for tests that only need a retired career. */
function retireNow(c:ReturnType<typeof newCareer>){c.world.records=Array.from({length:3},(_,i)=>({year:2026+i,club:'검증팀',league:'검증리그',rank:1,appearances:10,minutes:900,goals:0,assists:0,rating:6.5}));c.player.age=35;c.world.phase='offseason';c.world.contract.years=1;c.world.clubId=c.world.clubs.find(x=>x.league>0)!.id;nextSeason(c);expect(c.world.phase).toBe('retired');return c;}

it('constants: the increase per retirement and its limit are adjustable numbers',()=>{
  expect(RETIREMENT_POTENTIAL_STEP).toBeGreaterThan(0);expect(RETIREMENT_POTENTIAL_MAX_BONUS).toBeGreaterThanOrEqual(RETIREMENT_POTENTIAL_STEP);
  const l:Legacy={version:1,retired:Array.from({length:20},(_,i)=>({id:'x'+i,name:'n',year:2040,age:36,pos:'ST'}))};
  expect(potentialBonus(emptyLegacy())).toBe(0);expect(potentialBonus({...l,retired:l.retired.slice(0,2)})).toBe(2*RETIREMENT_POTENTIAL_STEP);
  expect(potentialBonus(l)).toBe(RETIREMENT_POTENTIAL_MAX_BONUS);expect(validLegacy(l)).toBe(true);
  expect(validLegacy({version:1,retired:[l.retired[0],l.retired[0]]})).toBe(false);
});

it('a retirement is rewarded once per player: reloads, backups and switching cannot repeat it',()=>{
  const c=retireNow(newCareer(profile,0,77,{id:'player-a'}));
  const first=recordRetirement(emptyLegacy(),c);expect(first.rewarded).toBe(true);expect(first.legacy.retired).toHaveLength(1);
  // Same save restored from a backup / file, or opened again after switching slots.
  const restored=decode(encode(c));expect(restored.id).toBe('player-a');
  const again=recordRetirement(first.legacy,restored);expect(again.rewarded).toBe(false);expect(again.legacy).toBe(first.legacy);
  // The same player copied into another slot (archive swap) keeps the id: still once.
  expect(recordRetirement(first.legacy,structuredClone(c)).rewarded).toBe(false);
  // A career that has not retired is never recorded.
  expect(recordRetirement(first.legacy,newCareer(profile,0,78,{id:'player-b'})).rewarded).toBe(false);
  // A different retired player is.
  const b=retireNow(newCareer(profile,1,79,{id:'player-b'}));const second=recordRetirement(first.legacy,b);
  expect(second.rewarded).toBe(true);expect(potentialBonus(second.legacy)).toBe(2*RETIREMENT_POTENTIAL_STEP);
  expect(first.legacy.retired).toHaveLength(1); // inputs are never mutated
});

it('only the maximum potential of new candidates rises; the minimum and every other field stay the same',()=>{
  const lists=Array.from({length:60},(_,i)=>i);
  const plain=lists.flatMap(l=>generateCandidates(9,'seoul-boin',l)),boosted=lists.flatMap(l=>generateCandidates(9,'seoul-boin',l,undefined,6));
  expect(boosted.map(({potential,potentialRange,...rest})=>rest)).toEqual(plain.map(({potential,potentialRange,...rest})=>rest));
  boosted.forEach((b,i)=>expect(b.potential).toBeGreaterThanOrEqual(plain[i].potential));
  const min=(xs:typeof plain)=>Math.min(...xs.map(x=>x.potential)),max=(xs:typeof plain)=>Math.max(...xs.map(x=>x.potential));
  expect(max(plain)).toBeLessThanOrEqual(92);expect(max(boosted)).toBeGreaterThan(max(plain));expect(max(boosted)).toBeLessThanOrEqual(98);
  expect(min(boosted)-min(plain)).toBeLessThan(.6); // the lowest draw maps to (almost) the same value
  for(const b of boosted)expect(b.potentialRange[0]).toBeLessThanOrEqual(Math.floor(b.potential));
});

it('custom players: the bonus widens only the top of the range',()=>{
  const pots=(bonus:number)=>Array.from({length:400},(_,i)=>newCareer(profile,0,1000+i,{potentialBonus:bonus}).player.potential);
  const a=pots(0),b=pots(6);
  expect(Math.max(...a)).toBeLessThanOrEqual(89);expect(Math.max(...b)).toBeGreaterThan(89);expect(Math.min(...b)).toBeGreaterThanOrEqual(76);
  a.forEach((x,i)=>expect(b[i]).toBeGreaterThanOrEqual(x));
});

it('existing players are never changed by a later reward; potentials above 94 are not cut by matches',()=>{
  const c=newCareer(profile,0,80,{potential:97});const before=structuredClone(c.player);
  recordRetirement(emptyLegacy(),retireNow(newCareer(profile,0,81,{id:'other'})));
  expect(c.player).toEqual(before);
});

it('v5 saves get a stable id: the same old save always maps to the same id, different players differ',()=>{
  const old=(seed:number,name='예전선수')=>{const c=newCareer({...profile,name},0,seed);delete (c as {id?:string}).id;(c as {version:number}).version=5;return c;};
  const a1=validate(old(5)),a2=validate(structuredClone(old(5))),b=validate(old(6)),d=validate(old(5,'다른선수'));
  expect(a1.version).toBe(8);expect(a1.id).toBe(a2.id);expect(a1.id).not.toBe(b.id);expect(a1.id).not.toBe(d.id);
  const bad=structuredClone(a1);(bad as {id:unknown}).id=42;expect(()=>validate(bad)).toThrow('손상');
});

it('integration: scouted player → full career → retirement → reward → stronger next generation → second retirement',async()=>{
  let legacy=emptyLegacy();
  const cand=generateCandidates(4242,'gyeonggi-maetan',0)[0];
  const c=careerFromCandidate(cand,4242,undefined,'gen-1');
  const seasons=await playToRetirement(c);
  expect(c.world.phase).toBe('retired');expect(c.player.age).toBe(36);expect(seasons).toBeGreaterThanOrEqual(cand.age===16?20:19);
  expect(c.world.records.length).toBeGreaterThanOrEqual(18);
  const saved=decode(encode(c));expect(saved).toEqual(c);
  let r=recordRetirement(legacy,saved);expect(r.rewarded).toBe(true);legacy=r.legacy;
  r=recordRetirement(legacy,c);expect(r.rewarded).toBe(false);
  // Next generation: the same scouting list now allows a higher maximum potential.
  const next=generateCandidates(4242,'gyeonggi-maetan',0,undefined,potentialBonus(legacy));
  expect(next.map(x=>x.name)).toEqual(generateCandidates(4242,'gyeonggi-maetan',0).map(x=>x.name));
  const gen2=careerFromCandidate(next[1],4242,undefined,'gen-2');expect(gen2.id).toBe('gen-2');
  retireNow(gen2);r=recordRetirement(legacy,gen2);expect(r.rewarded).toBe(true);expect(r.legacy.retired.map(x=>x.id)).toEqual(['gen-1','gen-2']);
},300000);
