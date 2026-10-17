import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {settle,newCareer,nextSeason} from '../src/career';
import {finishMatch} from '../src/engine';
import {playToday,todayIndex,startTodayMatch} from '../src/development';
import {decode,encode,validate,SAVE_VERSION} from '../src/storage';
import {buyEquipment,equip} from '../src/equipment';
import {emptyLegacy,recordRetirement} from '../src/legacy';
import {generateCandidates,careerFromCandidate,nextList,newScoutState,validScoutState,listNumber,CANDIDATES_PER_LIST} from '../src/scouting';
import {SCHOOLS_KR as REAL,REGIONS} from '../src/schools';

const fixture=(n:string)=>readFileSync(new URL(`./fixtures/${n}`,import.meta.url),'utf8');
const raw=(n:string)=>JSON.parse(JSON.parse(fixture(n)).payload);

it('real v5 saves (0.4, daily week and live match) load as v6 without losing anything',()=>{
  expect(SAVE_VERSION).toBe(8);
  for(const name of ['v5-daily.json','v5-live-match.json']){
    const before=raw(name),c=decode(fixture(name));
    expect(before.version).toBe(5);expect(c.version).toBe(8);expect(typeof c.id).toBe('string');
    expect(c.player).toMatchObject(before.player);expect(c.development.traits).toMatchObject(before.development.traits);
    expect(c.development.rival.player).toMatchObject(before.development.rival.player);expect(c.development.rival.traits).toMatchObject(before.development.rival.traits);
    expect(c.development.rival.history).toMatchObject(before.development.rival.history);
    expect(c.history).toMatchObject(before.history);expect(c.world.records).toMatchObject(before.world.records);for(const old of before.world.clubs){const {name,...rest}=old;expect(c.world.clubs.find(x=>x.id===old.id)).toMatchObject(rest);}
    expect(c.development.active).toMatchObject(before.development.active);expect(c.match).toMatchObject(before.match);expect(c.schoolRef).toMatchObject(before.schoolRef);
    expect(c.development.equipment).toBeUndefined();
    // The same old save always maps to the same id (backups and archives of it cannot be rewarded twice).
    expect(decode(fixture(name)).id).toBe(c.id);
  }
  expect(decode(fixture('v5-daily.json')).id).toBe(decode(fixture('v5-live-match.json')).id);
});

it('a migrated v5 save continues: the daily schedule resumes and the live match finishes',()=>{
  const daily=decode(fixture('v5-daily.json'));expect(todayIndex(daily)).toBe(2);
  playToday(daily,'shooting');playToday(daily,'rest');playToday(daily,'running');startTodayMatch(daily);finishMatch(daily.match!);settle(daily);playToday(daily,'rest');
  expect(daily.development.active).toBeUndefined();expect(daily.week).toBe(raw('v5-daily.json').week+1);
  const live=decode(fixture('v5-live-match.json'));expect(live.match!.ended).toBe(false);finishMatch(live.match!);settle(live);
  expect(todayIndex(live)).toBe(6);expect(decode(encode(live))).toEqual(live);
});

it('older chains still work: v4 fixtures go v4 → v5 → v6',()=>{
  for(const name of ['v4-weeks.json','v4-live-match.json']){const c=decode(fixture(name));expect(c.version).toBe(8);expect(c.id).toMatch(/^legacy-/);expect(c.player.name).toBe(raw(name).player.name);}
});

it('round trip with every 0.5 field (equipment, injuries, id) is lossless',()=>{
  const c=newCareer({name:'왕복',age:16,pos:'CM',secondary:'ST',foot:'오른',height:178,weight:70,style:'플레이메이커',curve:'대기만성형'},2,321,{id:'round-trip'});
  c.development.wallet=500;buyEquipment(c,'gear-band');equip(c,'gear-band');c.world.clubs[3].roster[4].injuryWeeks=2;c.development.rival.player.injuryWeeks=1;
  expect(decode(encode(c))).toEqual(c);expect(validate(structuredClone(c))).toEqual(c);
});

it('reward duplication across slots: three slots holding the same and different players',()=>{
  const make=(id:string)=>{const c=newCareer({name:id,age:16,pos:'ST',secondary:'LW',foot:'오른',height:180,weight:72,style:'테크니션',curve:'꾸준한 성장형'},0,5,{id});c.player.age=35;c.world.phase='offseason';c.world.contract.years=1;c.world.clubId=c.world.clubs.find(x=>x.league>0)!.id;return c;};
  const slot1=make('A'),slot2=make('B');
  for(const c of [slot1,slot2])nextSeason(c);
  const slot3=decode(encode(slot1)),backup1=decode(encode(slot1)),archive2=structuredClone(slot2);
  let l=emptyLegacy(),granted=0;
  for(const c of [slot1,slot3,backup1,slot2,archive2,slot1,slot2]){const r=recordRetirement(l,c);l=r.legacy;if(r.rewarded)granted++;}
  expect(granted).toBe(2);expect(l.retired.map(x=>x.id)).toEqual(['A','B']);
});

it('scouting: 73 real schools kept; every new list is a genuinely new set of fictional players',()=>{
  expect(REAL).toHaveLength(73);expect(REGIONS).toHaveLength(17);
  let s=newScoutState(2026);const school='seoul-boin';const seen=new Set<string>();
  for(let i=0;i<40;i++){
    const list=generateCandidates(s.seed,school,listNumber(s,school));expect(list).toHaveLength(CANDIDATES_PER_LIST);
    for(const c of list){const key=`${c.name}|${c.pos}|${c.age}|${c.height}|${Object.values(c.a).join(',')}`;expect(seen.has(key)).toBe(false);seen.add(key);}
    const next=nextList(s,school);expect(listNumber(next,school)).toBe(listNumber(s,school)+1);expect(listNumber(s,school)).toBe(i);s=next;
  }
  expect(seen.size).toBe(40*CANDIDATES_PER_LIST);
  // Persisted state round-trips and previous lists regenerate exactly (no conflict with saved careers).
  const stored=JSON.parse(JSON.stringify(s));expect(validScoutState(stored)).toBe(true);
  expect(generateCandidates(stored.seed,school,7)).toEqual(generateCandidates(s.seed,school,7));
  const cand=generateCandidates(s.seed,school,3)[2],career=careerFromCandidate(cand,s.seed,undefined,'scout-x');
  const saved=decode(encode(career));expect(saved.player.name).toBe(cand.name);expect(saved.schoolRef!.id).toBe(school);
  s=nextList(s,school);expect(decode(encode(career))).toEqual(saved); // rerolling never touches existing careers
  // Different browsers (seeds) get different players at the same school.
  expect(generateCandidates(1,school,0).map(c=>c.name)).not.toEqual(generateCandidates(2,school,0).map(c=>c.name));
});
