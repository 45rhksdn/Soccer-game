import {it,expect} from 'vitest';
import {SCHOOLS_KR,REGIONS,SCHOOL_SOURCES,schoolById,schoolsIn,searchSchools} from '../src/schools';
import {generateCandidates,careerFromCandidate,newScoutState,nextList,listNumber,validScoutState,worldSlotFor,CANDIDATES_PER_LIST,FIELD_POSITIONS} from '../src/scouting';
import {prepareWeek} from '../src/development';
import {finishMatch} from '../src/engine';
import {settle,teamName} from '../src/career';
import {encode,decode} from '../src/storage';
import {TRAIT_LIMIT,TRAIT_DEFS} from '../src/traits';

it('school catalogue: unique stable ids, every 시·도 covered, every school has a 2026 source',()=>{
  expect(new Set(SCHOOLS_KR.map(s=>s.id)).size).toBe(SCHOOLS_KR.length);
  for(const r of REGIONS)expect(schoolsIn(r).length).toBeGreaterThan(0);
  for(const s of SCHOOLS_KR){
    expect(s.status).toBe('verified');expect(s.sources.length).toBeGreaterThan(0);
    for(const k of s.sources)expect(SCHOOL_SOURCES[k].published.startsWith('2026')).toBe(true);
    expect(/^[a-z0-9-]+$/.test(s.id)).toBe(true);
  }
  expect(searchSchools('보인')[0].id).toBe('seoul-boin');expect(searchSchools('',('제주')).length).toBe(schoolsIn('제주').length);
  expect(searchSchools('수원삼성').map(s=>s.id)).toEqual(['gyeonggi-maetan']);
});

it('candidate lists are deterministic per (seed, school, list) and differ between lists and schools',()=>{
  const a=generateCandidates(77,'seoul-boin',0),b=generateCandidates(77,'seoul-boin',0);
  expect(a).toEqual(b);expect(a).toHaveLength(CANDIDATES_PER_LIST);
  expect(generateCandidates(77,'seoul-boin',1).map(c=>c.name)).not.toEqual(a.map(c=>c.name));
  expect(generateCandidates(77,'jeju-daegi',0).map(c=>c.name)).not.toEqual(a.map(c=>c.name));
  expect(generateCandidates(78,'seoul-boin',0).map(c=>c.name)).not.toEqual(a.map(c=>c.name));
});

it('candidates are complete fictional profiles with honest potential estimates',()=>{
  let withTraits=0,total=0;
  for(const school of SCHOOLS_KR)for(let list=0;list<5;list++)for(const c of generateCandidates(2026,school.id,list)){
    total++;if(c.traits.length)withTraits++;
    expect([16,17]).toContain(c.age);expect(FIELD_POSITIONS).toContain(c.pos);expect(c.secondary).not.toBe(c.pos);
    expect(c.traits.length).toBeLessThanOrEqual(TRAIT_LIMIT);
    expect(c.potentialRange[0]).toBeLessThanOrEqual(c.potential);expect(c.potentialRange[1]).toBeGreaterThan(c.potential);
    expect(Object.values(c.a).every(v=>v>=20&&v<=85)).toBe(true);
    expect(c.name).toHaveLength(3);expect(c.height).toBeGreaterThan(160);expect(c.height).toBeLessThan(200);
  }
  const expectedAny=1-TRAIT_DEFS.reduce((n,d)=>n*(1-d.chance),1);expect(withTraits/total).toBeGreaterThan(expectedAny-.05);expect(withTraits/total).toBeLessThan(expectedAny+.05);
});

it('rerolling is persisted state: list numbers advance per school without mutating the old state',()=>{
  const s0=newScoutState(5),s1=nextList(s0,'seoul-boin'),s2=nextList(s1,'seoul-boin');
  expect(listNumber(s0,'seoul-boin')).toBe(0);expect(listNumber(s2,'seoul-boin')).toBe(2);expect(listNumber(s2,'jeju-daegi')).toBe(0);
  expect(validScoutState(JSON.parse(JSON.stringify(s2)))).toBe(true);expect(validScoutState({seed:1.5,lists:{}})).toBe(false);
});

it('choosing a candidate starts a playable career at the real school with exactly that player',()=>{
  const school=schoolById('daegu-hyeonpung')!,cand=generateCandidates(9,school.id,3)[2];
  const c=careerFromCandidate(cand,9);
  expect(c.player.name).toBe(cand.name);expect(c.player.a).toEqual(cand.a);expect(c.player.potential).toBe(cand.potential);
  expect(c.development.traits).toEqual(cand.traits);
  expect(c.schoolRef).toEqual({id:school.id,name:school.name,region:school.region});
  expect(c.school).toBe(worldSlotFor(school.id));expect(teamName(c)).toBe(school.name);
  expect(careerFromCandidate(cand,9)).toEqual(c);
  prepareWeek(c,['passing','rest','running','rest','shooting','rest','rest']);finishMatch(c.match!);settle(c);
  const n=decode(encode(c));expect(n.schoolRef).toEqual(c.schoolRef);expect(teamName(n)).toBe(school.name);expect(n.week).toBe(1);
});
