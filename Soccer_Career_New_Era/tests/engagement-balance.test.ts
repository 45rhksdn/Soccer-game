import {it,expect} from 'vitest';
import {newCareer,nextSeason,settle} from '../src/career';
import {finishMatch} from '../src/engine';
import {prepareWeek} from '../src/development';
import {acceptOffer,clubOf} from '../src/world';
import {deedsOf} from '../src/engagement';

// 0.9 balance: 감독 미션 is a real challenge (not automatic, not hopeless) for every role in auto play,
// and no signature is handed out in the first season.
const SECOND={ST:'LW',CM:'CB',CB:'CM',GK:'CB'} as const;
async function play(pos:keyof typeof SECOND,seed:number,seasons:number){
  const c=newCareer({name:'균형선수',age:17,pos,secondary:SECOND[pos],foot:'오른',height:180,weight:72,style:'플레이메이커',curve:'꾸준한 성장형'},0,seed,{traits:[]});
  const plan=['passing','running','rest','shooting','rest','rest','rest'] as const;
  let weeks=0,done=0,tried=0,firstSeasonSigs=-1,played=0;
  while(played<seasons&&weeks<300){
    if(c.world.phase==='offseason'){
      if(played===0)firstSeasonSigs=(c.development.signatures??[]).length;
      if((c.player.age>=18&&clubOf(c.world).league===0)||(clubOf(c.world).league>0&&c.world.contract.years===0)){const o=c.world.offers.find(o=>o.status==='open');if(!o){prepareWeek(c,[...plan]);weeks++;continue;}acceptOffer(c.world,o.clubId,c.player.name);}
      nextSeason(c);played++;continue;
    }
    prepareWeek(c,[...plan]);weeks++;
    // Yield now and then: a long synchronous test blocks vitest's worker RPC ("Timeout calling onTaskUpdate").
    if(weeks%20===0)await new Promise(r=>setTimeout(r,0));
    if(c.match){finishMatch(c.match);const r=settle(c);if(r.mission?.played){tried++;if(r.mission.done)done++;}}
  }
  return {rate:done/Math.max(1,tried),tried,firstSeasonSigs,c};
}
for(const pos of ['ST','CM','CB','GK'] as const)
  it(`감독 미션 success stays between 25 % and 70 % (${pos}), no signature in the first season`,async()=>{
    const r=await play(pos,23,3);
    console.log(`    ${pos}: ${(r.rate*100).toFixed(0)}% of ${r.tried} missions · signatures after season 1: ${r.firstSeasonSigs} · deeds ${JSON.stringify(deedsOf(r.c))}`);
    expect(r.tried).toBeGreaterThan(15);
    expect(r.rate).toBeGreaterThan(.25);expect(r.rate).toBeLessThan(.7);
    expect(r.firstSeasonSigs).toBe(0);
  },600000);
