import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {newCareer,startCareerMatch,settle,nextSeason} from '../src/career';
import {attributes,finishMatch,random} from '../src/engine';
import {applyDaily,TRAINING_INJURY_CHANCE} from '../src/development';
import {newWorld,advanceWorldYear} from '../src/world';
import {encode,decode,validate} from '../src/storage';
import {TRAIT_DEFS,TRAIT_LIMIT,rollTraits,matchAttributes,injuryChanceMultiplier,injuryWeeks,agingDecline,traitDef} from '../src/traits';

const profile={name:'특성검증',age:16,pos:'CM' as const,secondary:'ST' as const,foot:'오른',height:178,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'};
const career=(seed=31)=>newCareer(profile,0,seed);
function seedFor(lo:number,hi:number){for(let i=0;i<200000;i++){const v=random({seed:i});if(v>=lo&&v<hi)return i;}throw Error('seed');}

it('trait rolls: independent low chances, 0–3 traits, no duplicates or conflicts (50,000 players)',()=>{
  const N=50000,rng={seed:12345},count=new Map<string,number>(),sizes=[0,0,0,0];
  for(let i=0;i<N;i++){
    const t=rollTraits(rng);sizes[t.length]++;
    expect(t.length).toBeLessThanOrEqual(TRAIT_LIMIT);expect(new Set(t).size).toBe(t.length);
    for(const id of t){count.set(id,(count.get(id)??0)+1);for(const ex of traitDef(id)!.excludes??[])expect(t.includes(ex as never)).toBe(false);}
  }
  for(const d of TRAIT_DEFS){
    const rate=(count.get(d.id)??0)/N;
    // Conflicts remove a little of the nominal chance, never add to it.
    expect(rate).toBeLessThan(d.chance+.004);expect(rate).toBeGreaterThan(d.chance-(d.rarity==='rare'?.006:.008));
  }
  const expectedNone=TRAIT_DEFS.reduce((n,d)=>n*(1-d.chance),1);
  expect(sizes[0]/N).toBeGreaterThan(expectedNone-.015);expect(sizes[0]/N).toBeLessThan(expectedNone+.015);
  expect(sizes[2]).toBeGreaterThan(0);
  console.log('    distribution',Object.fromEntries(TRAIT_DEFS.map(d=>[d.id,((count.get(d.id)??0)/N*100).toFixed(2)+'%'])),'sizes',sizes.map(n=>(n/N*100).toFixed(2)+'%'));
});

it('유리몸: training fatigue ×1.5 and injury chance ×1.5; 강철 체력 ×0.7',()=>{
  const base=career();base.player.fatigue=0;base.player.energy=100;
  const fatigue=(t:string[])=>{const c=structuredClone(base);applyDaily(c,c.player,'passing',t);return c.player.fatigue;};
  expect(fatigue([])).toBeCloseTo(12,8);expect(fatigue(['유리몸'])).toBeCloseTo(18,8);expect(fatigue(['강철 체력'])).toBeCloseTo(8.4,8);
  expect(injuryChanceMultiplier(['유리몸'])).toBe(1.5);expect(injuryChanceMultiplier(['회복력'])).toBe(.5);
  // Deterministic: a roll between the base and 유리몸 thresholds injures only the fragile player.
  const lo=TRAINING_INJURY_CHANCE,hi=TRAINING_INJURY_CHANCE*1.5;
  let seed=0;for(;;seed++){const r={seed};random(r);const v=random(r);if(v>=lo&&v<hi&&(()=>{const q={seed};return random(q)>=.09;})())break;}
  const run=(t:string[])=>{const c=structuredClone(base);c.player.fatigue=70;c.seed=seed;applyDaily(c,c.player,'passing',t);return c.player.injuryWeeks??0;};
  expect(run([])).toBe(0);expect(run(['유리몸'])).toBe(1);
  // Statistical: 40,000 tired training days each.
  const rate=(t:string[])=>{let hurt=0;const c=structuredClone(base);for(let i=0;i<40000;i++){c.player.fatigue=70;c.player.energy=100;c.player.injuryWeeks=0;c.player.a=attributes(40);applyDaily(c,c.player,'passing',t);if(c.player.injuryWeeks)hurt++;}return hurt/40000;};
  const normal=rate([]),fragile=rate(['유리몸']);
  expect(normal).toBeGreaterThan(.016);expect(normal).toBeLessThan(.024);expect(fragile/normal).toBeGreaterThan(1.3);expect(fragile/normal).toBeLessThan(1.7);
  console.log('    training injury rate',(normal*100).toFixed(2)+'%','유리몸',(fragile*100).toFixed(2)+'%');
});

it('training growth: 천재 ×1.7, 노력파 ×1.2, 게으름 ×0.8, combinations multiply',()=>{
  const base=career();base.player.a=attributes(40);base.player.potential=95;base.seed=seedFor(.1,.2);
  const gain=(t:string[])=>{const c=structuredClone(base);applyDaily(c,c.player,'passing',t);return c.player.a.passing-40;};
  const plain=gain([]);
  expect(gain(['천재'])/plain).toBeCloseTo(1.7,8);expect(gain(['노력파'])/plain).toBeCloseTo(1.2,8);expect(gain(['게으름'])/plain).toBeCloseTo(.8,8);
  expect(gain(['천재','노력파'])/plain).toBeCloseTo(1.7*1.2,8);
});

it('match-only effects: 강심장/새가슴 change the match copy, never permanent attributes',()=>{
  const a=attributes(60),roll=()=>.99;
  expect(matchAttributes(['강심장'],a,roll).a.composure).toBe(66);expect(matchAttributes(['새가슴'],a,roll).a.decisions).toBe(56);
  const c=career();c.player.a=attributes(60);c.development.traits=['새가슴'];startCareerMatch(c);
  expect(c.match!.players[c.match!.userId].a.composure).toBe(54);expect(c.player.a.composure).toBe(60);
  finishMatch(c.match!);settle(c);expect(c.player.a.composure).toBeGreaterThanOrEqual(60);
});

it('injury weeks and aging: 회복력 shortens, 조기 노화 starts 3 years early at ×1.5',()=>{
  expect(injuryWeeks([],2)).toBe(2);expect(injuryWeeks(['회복력'],2)).toBe(1);expect(injuryWeeks(['회복력'],1)).toBe(1);
  expect(agingDecline([],29,29,.8)).toBe(0);expect(agingDecline([],30,29,.8)).toBeCloseTo(.8,8);
  expect(agingDecline(['조기 노화'],27,29,.8)).toBeCloseTo(1.2,8);expect(agingDecline(['조기 노화'],26,29,.8)).toBe(0);
  const make=(t:string[])=>{const c=career(5);c.player.age=26;c.development.rival.player.age=26;c.player.a=attributes(70);c.world.phase='offseason';c.world.clubId=c.world.clubs.find(x=>x.league===1)!.id;c.world.contract={salary:100,years:2};c.development.traits=t;nextSeason(c);return c.player.a.speed;};
  expect(make([])).toBe(70);expect(make(['조기 노화'])).toBeCloseTo(68.8,8);
});

it('NPCs: every generated player has a deterministic trait list that follows the same rules',()=>{
  const w=newWorld(99,0),again=newWorld(99,0);
  const all=w.clubs.flatMap(c=>c.roster);
  expect(all.every(p=>Array.isArray(p.traits)&&p.traits.length<=TRAIT_LIMIT)).toBe(true);
  expect(all.map(p=>p.traits)).toEqual(again.clubs.flatMap(c=>c.roster).map(p=>p.traits));
  const withAny=all.filter(p=>p.traits!.length).length/all.length,expectedAny=1-TRAIT_DEFS.reduce((n,d)=>n*(1-d.chance),1);expect(withAny).toBeGreaterThan(expectedAny-.08);expect(withAny).toBeLessThan(expectedAny+.08);
  advanceWorldYear(w);expect(w.clubs.flatMap(c=>c.roster).every(p=>Array.isArray(p.traits))).toBe(true);
});

it('user, rival and NPC traits survive save/load unchanged; rival traits sync into the roster',()=>{
  const c=career(77);c.development.traits=['천재','유리몸'];c.development.rival.traits=['강심장'];
  startCareerMatch(c);finishMatch(c.match!);settle(c);
  const n=decode(encode(c));
  expect(n.development.traits).toEqual(['천재','유리몸']);expect(n.development.rival.traits).toEqual(['강심장']);
  expect(n.world.clubs.flatMap(x=>x.roster).find(p=>p.id===n.development.rival.id)!.traits).toEqual(['강심장']);
  expect(n.world.clubs.flatMap(x=>x.roster).map(p=>p.traits)).toEqual(c.world.clubs.flatMap(x=>x.roster).map(p=>p.traits));
});

for(const file of ['v4-weeks.json','v4-live-match.json'])it(`real v4 save (${file}) migrates to v5 without losing the existing trait or progress`,()=>{
  const text=readFileSync(new URL('./fixtures/'+file,import.meta.url),'utf8');
  const old=JSON.parse(JSON.parse(text).payload);
  expect(old.version).toBe(4);
  const n=decode(text);
  expect(n.version).toBe(5);
  expect(n.development.traits).toEqual([old.development.trait]);
  expect(n.development.rival.traits).toEqual([old.development.rival.trait]);
  expect('trait' in n.development).toBe(false);
  expect(n.player).toEqual(old.player);expect(n.history).toEqual(old.history);expect(n.week).toBe(old.week);expect(n.day).toBe(old.day);
  expect(n.match).toEqual(old.match);expect(n.development.active).toEqual(old.development.active);
  expect(n.world.clubs.flatMap(x=>x.roster).every(p=>Array.isArray(p.traits))).toBe(true);
  expect(decode(text)).toEqual(n);expect(decode(encode(n))).toEqual(n);
  // The migrated career keeps playing.
  if(n.match){finishMatch(n.match);settle(n);}
  expect(validate(n).version).toBe(5);
});
