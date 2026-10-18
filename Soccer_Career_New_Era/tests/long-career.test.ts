import {it,expect} from 'vitest';
import {nextSeason} from '../src/career';
import {finishMatch,overall} from '../src/engine';
import {prepareWeek} from '../src/development';
import {acceptOffer,clubOf} from '../src/world';
import {encode,decode} from '../src/storage';
import {generateCandidates,careerFromCandidate} from '../src/scouting';
import {TRAIT_LIMIT} from '../src/traits';
import {settle} from '../src/career';

// A scouted, trait-carrying player plays every week through school, graduation and
// several professional seasons, with a save/load round trip each season.
it('long career: scouted player with traits, rival growth and transfers, save/load every season',async()=>{
  const cand=generateCandidates(4242,'gyeonggi-maetan',0).find(c=>c.age===17)??generateCandidates(4242,'gyeonggi-maetan',1)[0];
  let c=careerFromCandidate(cand,4242);
  c.development.traits=['유리몸','노력파'];c.development.rival.traits=['천재'];
  const plan=['passing','running','rest','shooting','rest','rest','rest'] as const;
  const rivalStart=overall(c.development.rival.player.a),rivalClubs=new Set<string>([c.development.rival.clubId]);
  let weeks=0,injuredWeeks=0,seasons=0;
  while(seasons<5&&weeks<400){
    if(c.world.phase==='offseason'){
      // Graduation or contract end: take the first valid offer, then start the next season.
      if((c.player.age>=18&&clubOf(c.world).league===0)||(clubOf(c.world).league>0&&c.world.contract.years===0)){
        const offer=c.world.offers.find(o=>o.status==='open');
        if(!offer){c.world.currentDay=c.day;prepareWeek(c,[...plan]);weeks++;continue;}
        acceptOffer(c.world,offer.clubId,c.player.name);
      }
      nextSeason(c);seasons++;rivalClubs.add(c.development.rival.clubId);
      c=decode(encode(c));
      continue;
    }
    prepareWeek(c,[...plan]);weeks++;if(weeks%5===0)await new Promise(r=>setTimeout(r,0));
    if(c.player.injuryWeeks)injuredWeeks++;
    if(c.match){finishMatch(c.match);settle(c);}
    expect(c.development.active).toBeUndefined();
    expect(c.player.injuryWeeks??0).toBeLessThanOrEqual(2);
  }
  expect(seasons).toBe(5);
  expect(c.player.age).toBe(cand.age+5);
  expect(clubOf(c.world).league).toBeGreaterThan(0);
  expect(c.development.traits).toEqual(['유리몸','노력파']);expect(c.development.rival.traits).toEqual(['천재']);
  expect(c.development.rival.player.age).toBe(c.player.age);
  expect(overall(c.development.rival.player.a)).toBeGreaterThan(rivalStart);
  expect(rivalClubs.size).toBeGreaterThan(1);
  expect(c.world.records.length).toBeGreaterThanOrEqual(5);
  expect(c.world.clubs.flatMap(x=>x.roster).every(p=>Array.isArray(p.traits)&&p.traits.length<=TRAIT_LIMIT)).toBe(true);
  expect(c.world.clubs.every(x=>x.roster.length===20)).toBe(true);
  expect(c.schoolRef?.name).toBe('매탄고');
  console.log(`    ${weeks} weeks, ${seasons} seasons, injured during ${injuredWeeks} weeks, rival clubs ${rivalClubs.size}, final league ${clubOf(c.world).league}`);
},400000); // 0.15: 35-week seasons
