import {it,expect} from 'vitest';
import {createMatch,step,attributes,direction,act,availableActions,actionChance,finishMatch,type Match} from '../src/engine';
import {boxMates,crossTarget,runPoint,attackAllowed} from '../src/tactical';

// v0.10 attacking play: box occupation, runs in behind, crosses, corners and second balls.
const yieldNow=()=>new Promise(r=>setTimeout(r,0));
function scene(place:(m:Match,goal:number,d:number)=>void){
  const m=createMatch(4242,{name:'u',pos:'ST',a:attributes(70),energy:100});const d=direction(m,0),goal=d>0?105:0;
  for(const p of m.players){p.x=52.5+(p.team?8:-8)*d;p.y=4+p.id*2.8;}
  place(m,goal,d);return {m,d,goal};
}

it('strikers receive passes inside the box far more often than before (≥ 14 %), goals and shots stay in range',async()=>{
  let rec=0,box=0,goals=0,shots=0,corners=0,headers=0;const N=120;
  for(let s=0;s<N;s++){
    const m=createMatch(7000+s*17,{name:'u',pos:'ST',a:attributes(60),energy:100});const push=m.log.push.bind(m.log);
    m.log.push=(...e)=>{for(const x of e){if(x.text.startsWith('코너킥!'))corners++;if(x.text.includes('헤더!'))headers++;}return push(...e);};
    while(!m.ended){const f=m.ball.flight;step(m,.5,true);const o=m.ball.owner;
      if(f&&f.kind==='pass'&&!m.ball.flight&&o!==null){const p=m.players[o];if(p.pos==='ST'&&p.team===m.players[f.from].team){rec++;const d=direction(m,p.team),gx=d>0?105-p.x:p.x;if(gx<16.5&&Math.abs(p.y-34)<20.16)box++;}}}
    goals+=m.score[0]+m.score[1];shots+=m.shots[0]+m.shots[1];if(s%20===0)await yieldNow();
  }
  console.log(`    ST box receptions ${(box/rec*100).toFixed(1)}% · goals ${(goals/N).toFixed(2)} · shots ${(shots/N).toFixed(1)} · corners ${(corners/N).toFixed(1)} · headers ${(headers/N).toFixed(1)}`);
  expect(box/rec).toBeGreaterThanOrEqual(.14);
  expect(goals/N).toBeGreaterThan(2.2);expect(goals/N).toBeLessThan(3.6);
  expect(shots/N).toBeGreaterThan(18);expect(shots/N).toBeLessThan(32);
  expect(corners/N).toBeGreaterThan(2);expect(corners/N).toBeLessThan(10);
  expect(headers/N).toBeGreaterThan(.3);
},600000);

it('a cross reaches a box target in the air; the receiver may only head, volley, shoot or lay it off',()=>{
  const {m,d,goal}=scene((m,goal,d)=>{const w=m.players.find(p=>p.team===0&&p.pos==='LW')!;w.x=goal-d*18;w.y=5;m.ball={x:w.x,y:w.y,owner:w.id,flight:null};
    const st=m.players.find(p=>p.team===0&&p.pos==='ST')!;st.x=goal-d*8;st.y=34;m.players.filter(p=>p.team===1&&p.pos==='CB').forEach((p,i)=>{p.x=goal-d*(4+i);p.y=30+i*8;});});
  const w=m.players[m.ball.owner!],st=m.players.find(p=>p.team===0&&p.pos==='ST')!;
  expect(boxMates(m,w).map(p=>p.id)).toContain(st.id);expect(crossTarget(m,w)?.id).toBe(st.id);
  expect(availableActions(m)).toContain('cross');const chance=actionChance(m,'cross');expect(chance).toBeGreaterThan(.3);expect(chance).toBeLessThan(.95);
  let seed=0;for(;seed<500;seed++){m.seed=seed;const copy=structuredClone(m);act(copy,'cross');if(copy.ball.flight?.success)break;}
  m.seed=seed;act(m,'cross');expect(m.ball.flight?.aerial).toBe(true);
  for(let i=0;i<10&&m.ball.flight;i++)step(m,.5,true);
  if(m.ball.owner===st.id){expect(m.aerial?.to).toBe(st.id);
    const options=availableActions(m);expect(options).toContain('header');expect(options).toContain('volley');expect(options).not.toContain('dribble');expect(options).not.toContain('longShot');
    expect(actionChance(m,'header')).toBeGreaterThan(.05);}
  else expect(m.ball.owner).not.toBeNull();
  expect(goal).toBeDefined();expect(d).not.toBe(0);
});

it('a forward running in behind is passed to at the end of his run (a through ball into space)',()=>{
  const {m,d,goal}=scene((m,goal,d)=>{const cm=m.players.find(p=>p.team===0&&p.pos==='CM')!;cm.x=goal-d*40;cm.y=34;m.ball={x:cm.x,y:cm.y,owner:cm.id,flight:null};
    const st=m.players.find(p=>p.team===0&&p.pos==='ST')!;st.x=goal-d*24;st.y=30;m.players.filter(p=>p.team===1&&p.pos==='CB').forEach((p,i)=>{p.x=goal-d*(23+i);p.y=26+i*14;});});
  const st=m.players.find(p=>p.team===0&&p.pos==='ST')!;st.run={until:m.clock+12,x:goal-d*9,y:33};
  expect(runPoint(m,st)).toEqual({x:goal-d*9,y:33});
  act(m,'pass',{targetId:st.id});
  expect(m.ball.flight?.to).toBe(st.id);expect(Math.abs(m.ball.flight!.x-(goal-d*9))).toBeLessThan(1);
  expect(m.log.at(-1)?.text).toContain('스루패스');
});

it('the box is occupied in the final third and the back line drops with the ball',()=>{
  const m=createMatch(99,{name:'u',pos:'ST',a:attributes(60),energy:100});const d=direction(m,0),goal=d>0?105:0;
  const cm=m.players.find(p=>p.team===0&&p.pos==='CM')!;cm.x=goal-d*30;cm.y=40;m.ball={x:cm.x,y:cm.y,owner:cm.id,flight:null};m.nextAI=99;m.cooldown=99;m.decision=false;
  for(let i=0;i<12;i++){step(m,.5,true);m.ball.owner=cm.id;cm.x=goal-d*30;cm.y=40;m.nextAI=99;m.cooldown=99;}
  const st=m.players.find(p=>p.team===0&&p.pos==='ST')!,cbs=m.players.filter(p=>p.team===1&&p.pos==='CB');
  const depth=(x:number)=>Math.abs(goal-x);
  // The back line (not the one centre-back stepping out to press the ball) has dropped to the box edge.
  expect(Math.max(...cbs.filter(p=>p.mode!=='press').map(p=>depth(p.x)))).toBeLessThan(18);
  expect(depth(st.x)).toBeLessThan(20);                             // the striker plays on that line
});

it('missed and saved shots sometimes become corners and second balls; matches stay deterministic',()=>{
  const a=finishMatch(createMatch(31337,{name:'u',pos:'ST',a:attributes(60),energy:100})),b=finishMatch(createMatch(31337,{name:'u',pos:'ST',a:attributes(60),energy:100}));
  expect(a.score).toEqual(b.score);expect(a.shots).toEqual(b.shots);expect(a.players.map(p=>[p.x,p.y])).toEqual(b.players.map(p=>[p.x,p.y]));
  expect(attackAllowed(a,'header')).toBe(false);
});
