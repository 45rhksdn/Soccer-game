import {it,expect} from 'vitest';
import {newCareer,startCareerMatch,settle,nextSeason} from '../src/career';
import {finishMatch} from '../src/engine';
import {playToday,syncRival,playRival} from '../src/development';
import {chooseLineup,npcInjuryWeek,matchInjury,npcRecovery,NPC_WEEKLY_INJURY,clubOf,type RosterPlayer} from '../src/world';
import {TRAIT_DEFS,RARITY_CHANCE,rollTraits} from '../src/traits';
import {encode,decode} from '../src/storage';

const profile={name:'부상검증',age:17,pos:'CM' as const,secondary:'ST' as const,foot:'오른',height:178,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'};
const career=(seed=61)=>newCareer(profile,0,seed);

it('rarity: strong or harsh traits (incl. 유리몸) appear at half the common chance; trait-free players remain common',()=>{
  const rare=TRAIT_DEFS.filter(d=>d.rarity==='rare').map(d=>d.id);
  expect(rare).toEqual(['천재','실전파','행운아','강철몸','유리몸','불운','조기 노화']);
  for(const d of TRAIT_DEFS)expect(d.chance).toBe(d.rarity==='rare'?RARITY_CHANCE.common/2:RARITY_CHANCE.common);
  expect(TRAIT_DEFS).toHaveLength(34);
  const rng={seed:5};let none=0,glass=0,max=0;const n=40000;
  for(let i=0;i<n;i++){const t=rollTraits(rng);if(!t.length)none++;if(t.includes('유리몸'))glass++;max=Math.max(max,t.length);}
  expect(none/n).toBeGreaterThan(.33);expect(max).toBeLessThanOrEqual(3);expect(glass/n).toBeLessThan(.02);expect(glass/n).toBeGreaterThan(.01);
});

it('NPC weekly injuries follow trait multipliers and recover week by week',()=>{
  const c=career();const w=c.world;const all=()=>w.clubs.flatMap(x=>x.roster);
  const count=(traits:string[])=>{for(const p of all())p.traits=[...traits];let hurt=0,total=0;for(let week=0;week<300;week++){for(const p of all())delete p.injuryWeeks;npcInjuryWeek(w,week);for(const p of all()){total++;if(p.injuryWeeks)hurt++;}}return hurt/total;};
  const plain=count([]),glass=count(['유리몸']),tough=count(['회복력']);
  expect(plain).toBeGreaterThan(NPC_WEEKLY_INJURY*.8);expect(plain).toBeLessThan(NPC_WEEKLY_INJURY*1.2);
  expect(glass/plain).toBeGreaterThan(1.3);expect(tough/plain).toBeLessThan(.65);
  // recovery: 3 weeks → 0 after three weekly ticks; 회복력 shortens and 잔부상 lengthens the injury (via injuryWeeks)
  const p=all()[3];p.traits=[];p.injuryWeeks=3;for(let i=0;i<3;i++)npcInjuryWeek(w,1000+i,all().filter(x=>x!==p).map(x=>x.id));expect(p.injuryWeeks).toBeUndefined();
  expect(matchInjury(1,'x',80,[])).toBe(0);
  let longer=0;for(let s=0;s<4000;s++){const a=matchInjury(s,'k',10,['잔부상']);if(a){expect(a).toBe(3);longer++;}const b=matchInjury(s,'k',10,['회복력']);if(b)expect(b).toBe(1);}
  expect(longer).toBeGreaterThan(0);
  expect(npcRecovery({traits:['강철 체력']} as RosterPlayer)).toBeGreaterThan(npcRecovery({traits:[]} as RosterPlayer));
  expect(npcRecovery({traits:['유리몸']} as RosterPlayer)).toBeLessThan(8);
});

it('injured players (and an injured rival) are left out of lineups and do not play',()=>{
  const c=career(62),club=clubOf(c.world);
  const first=chooseLineup(club);const star=club.roster.find(p=>p.id===first[5].id)!;star.injuryWeeks=2;
  expect(chooseLineup(club).some(p=>p.id===star.id)).toBe(false);
  const r=c.development.rival;r.player.injuryWeeks=3;syncRival(c);
  const rivalClub=c.world.clubs.find(x=>x.id===r.clubId)!;expect(rivalClub.roster.find(p=>p.id===r.id)!.injuryWeeks).toBe(3);
  expect(chooseLineup(rivalClub).some(p=>p.id===r.id)).toBe(false);
  // The rival's own league match: no rating while injured.
  for(let i=0;i<5;i++)playToday(c,'rest');r.player.injuryWeeks=3;syncRival(c);
  const before=r.history.length;startCareerMatch(c);expect(c.match!.rosterIds!.includes(r.id)).toBe(false);
  finishMatch(c.match!);settle(c);expect(r.history.length).toBe(before);
  playToday(c,'rest');expect(r.player.injuryWeeks).toBe(2); // recovers a week per week
});

it('injuries survive save/load mid-week and are cleared for a new season',()=>{
  const c=career(63);const npc=c.world.clubs[5].roster[2];npc.injuryWeeks=2;c.development.rival.player.injuryWeeks=1;syncRival(c);
  playToday(c,'passing');const back=decode(encode(c));expect(back.world.clubs[5].roster[2].injuryWeeks).toBe(2);expect(back.development.rival.player.injuryWeeks).toBe(1);
  c.world.phase='offseason';nextSeason(c);
  expect(c.world.clubs.flatMap(x=>x.roster).some(p=>p.injuryWeeks)).toBe(false);expect(c.development.rival.player.injuryWeeks).toBe(0);
});

it('a season with NPC injuries: some happen, nobody stays out forever, lineups stay complete',()=>{
  const c=career(64);let seen=0;
  for(let week=0;week<12&&c.world.phase!=='offseason';week++){
    for(let i=0;i<5;i++)playToday(c,i%2?'rest':'passing');
    if(c.match===null&&!['offseason','retired'].includes(c.world.phase)){startCareerMatch(c);finishMatch(c.match!);settle(c);}
    playToday(c,'rest');
    seen+=c.world.clubs.flatMap(x=>x.roster).filter(p=>p.injuryWeeks).length;
    for(const club of c.world.clubs)expect(chooseLineup(club)).toHaveLength(11);
    expect(c.world.clubs.flatMap(x=>x.roster).every(p=>(p.injuryWeeks??0)<=8)).toBe(true);
  }
  expect(seen).toBeGreaterThan(0);
  void playRival;
},120000);
