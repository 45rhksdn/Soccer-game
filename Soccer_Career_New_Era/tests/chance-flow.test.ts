import {it,expect} from 'vitest';
import {createMatch,attributes,step,act,shotQuality,defend} from '../src/engine';
import {writeFileSync} from 'node:fs';
it('measures user midfield passes and the following shot',async()=>{
 const stats={matches:200,passes:0,completed:0,keyPasses:0,xA:0,assists:0,goodReceipts:0,shotsFromGoodReceipts:0,goalsFromGoodReceipts:0,qualityAtReceipt:0,qualityAtShot:0};
 for(let seed=1;seed<=200;seed++){
  const m=createMatch(seed,{name:'CM',pos:'CM',a:attributes(60),energy:100},60);
  let receipt:{id:number,time:number,quality:number}|undefined;
  for(let ticks=0;!m.ended&&ticks<15000;ticks++){
   if(m.decision)act(m,'forward');
   if(m.defending)defend(m,'none'); // 0.6: live play also asks for defensive choices; leave them to the AI
   const flight=m.ball.flight, previousLast=m.lastPass;
   step(m,.5,false);
   if(flight?.kind==='pass'&&flight.from===m.userId&&m.lastPass!==previousLast&&m.lastPass?.from===m.userId){
    const q=m.players[m.lastPass.to],quality=shotQuality(m,q);
    receipt={id:q.id,time:m.lastPass.time,quality};if(quality>=.15)stats.goodReceipts++;
   }
   if(receipt&&m.ball.flight?.kind==='shot'&&flight!==m.ball.flight&&m.ball.flight.from===receipt.id&&m.lastPass?.time===receipt.time){
    if(receipt.quality>=.15){stats.shotsFromGoodReceipts++;stats.qualityAtReceipt+=receipt.quality;stats.qualityAtShot+=m.ball.flight.xg;if(m.ball.flight.success)stats.goalsFromGoodReceipts++;}receipt=undefined;
   }
  }
  expect(m.ended).toBe(true);const s=m.players[m.userId].stats;stats.passes+=s.passes;stats.completed+=s.completed;stats.keyPasses+=s.keyPasses??0;stats.xA+=s.expectedAssists??0;stats.assists+=s.assists;
  if(seed%20===0)await new Promise(r=>setTimeout(r,0));
 }
 console.log(stats);writeFileSync('reports/chance-flow.json',JSON.stringify(stats,null,2));
 expect(stats.keyPasses).toBeGreaterThanOrEqual(40);expect(stats.xA).toBeGreaterThan(5);expect(stats.assists).toBeGreaterThan(0);
},60000);
