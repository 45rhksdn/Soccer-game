import {it,expect} from 'vitest';
import {newCareer} from '../src/career';
import {ATTRS,random} from '../src/engine';
import {scoutInterest} from '../src/development';
import {encode,validate,isRestorableSave} from '../src/storage';

const profile={name:'수정검증',age:17,pos:'CM' as const,secondary:'ST' as const,foot:'오른',height:178,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'};

it('rival scouting still runs when no club fits the user', ()=>{
  const c=newCareer(profile,0,77);
  // Make the user far stronger than every club so the user has no candidates,
  // while the rival keeps ordinary ability and does have candidates.
  for(const k of ATTRS)c.player.a[k]=99;
  // Pick an RNG state where both the user's and the rival's weekly 35% roll succeed,
  // which is exactly the week the old early `return` skipped the rival.
  let seed=1;for(;;seed++){const r={seed};if(random(r)<=.35&&random(r)<=.35)break;}
  c.seed=seed;scoutInterest(c);
  expect(c.development.interestIds).toHaveLength(0);
  expect(c.development.rival.interests).toHaveLength(1);
  expect(c.world.interestedClubIds).toEqual([]);
});

it('only a readable save is rotated into the backup slot', ()=>{
  const c=newCareer(profile,0,78);
  const good=encode(c);
  expect(isRestorableSave(good)).toBe(true);
  expect(isRestorableSave(undefined)).toBe(false);
  expect(isRestorableSave('{"format":"SCNE","checksum":"0","payload":"{}"}')).toBe(false);
  expect(isRestorableSave(good.replace('수정검증','손상검증'))).toBe(false);
});

it('malformed trait lists are rejected for the user and the rival; unknown future ids are kept', ()=>{
  const c=newCareer(profile,0,79);
  const userBad=structuredClone(c);(userBad.development as {traits:unknown}).traits='천재';
  expect(()=>validate(userBad)).toThrow('육성');
  const rivalBad=structuredClone(c);(rivalBad.development.rival as {traits:unknown}).traits=['천재','행운아','노력파','유리몸'];
  expect(()=>validate(rivalBad)).toThrow('육성');
  const future=structuredClone(c);future.development.traits=['미래특성'];
  expect(validate(future).development.traits).toEqual(['미래특성']);
  expect(()=>validate(c)).not.toThrow();
});
