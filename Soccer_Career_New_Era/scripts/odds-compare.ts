// Same seed set before/after: goals, shots, pass success, dribble success, tackles, ratings by position.
import {createMatch,step,attributes,rating} from '../src/engine';
import {writeFileSync} from 'node:fs';
const N=Number(process.argv[2]??400),out=process.argv[3];
let goals=0,shots=0,passes=0,completed=0,dribbles=0,dribbleTries=0,tackles=0,onTarget=0;const pos:Record<string,number[]>={};
for(let s=0;s<N;s++){
 const m=createMatch(20261018+s*7919,{name:'u',pos:(['ST','CM','CB','LW'] as const)[s%4],a:attributes(45+(s%5)*10),energy:100},40+(s%6)*8);
 const push=m.log.push.bind(m.log);m.log.push=(...e:any[])=>{for(const x of e){if(x.text.includes('치고 나갑니다'))dribbles++;if(x.text.includes('치고 나갑니다')||x.text.includes('볼 탈취'))dribbleTries++;}return push(...e);};
 while(!m.ended)step(m,.5,true);
 goals+=m.score[0]+m.score[1];shots+=m.shots[0]+m.shots[1];
 for(const p of m.players){passes+=p.stats.passes;completed+=p.stats.completed;tackles+=p.stats.tackles;onTarget+=p.stats.onTarget;if(p.stats.minutes>=45)(pos[p.pos]??=[]).push(rating(p));}
}
const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;
const r={matches:N,goals:goals/N,shots:shots/N,onTarget:onTarget/N,passSuccess:completed/passes,passesPerMatch:passes/N,dribbleSuccess:dribbles/Math.max(1,dribbleTries),dribblesPerMatch:dribbleTries/N,tacklesPerMatch:tackles/N,ratings:Object.fromEntries(Object.entries(pos).map(([k,v])=>[k,+mean(v).toFixed(3)]))};
console.log(JSON.stringify(r));if(out)writeFileSync(out,JSON.stringify(r,null,2));
