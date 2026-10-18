import {it,expect} from 'vitest';
import {createMatch,attributes,direction,act,actionChance,aiDribble,ATTRS,type Match,type Attributes} from '../src/engine';
import {attackOdds,defenseOdds,dribbleAdvance,touchChance,paceOf,chanceLevel,ODDS} from '../src/tactical';

// v0.12 dribbles: an open path is near-certain, pace races against nearby opponents, and 치고 달리기.
type Place={x:number,y:number,a?:Partial<Attributes>|number};
const flat=(v:number)=>Object.fromEntries(ATTRS.map(k=>[k,v])) as Attributes;
function scene(me:Place,opp:Place[]){
  const m=createMatch(777,{name:'나',pos:'ST',a:attributes(60),energy:100});const d=direction(m,0);
  const X=(x:number)=>d>0?x:105-x;
  for(const p of m.players){p.x=X(p.team?100:8);p.y=p.team?2+p.id%11*0.3:64-p.id*0.3;p.energy=100;}
  const u=m.players[m.userId];u.x=X(me.x);u.y=me.y;u.a=typeof me.a==='number'?flat(me.a):{...flat(60),...me.a};
  const field=m.players.filter(p=>p.team===1&&p.pos!=='GK');
  opp.forEach((o,i)=>{const q=field[i];q.x=X(o.x);q.y=o.y;q.a=typeof o.a==='number'?flat(o.a):{...flat(60),...o.a};});
  m.ball={x:u.x,y:u.y,owner:u.id,flight:null};m.decision=true;m.insight={chance:0,gains:{},events:[]};
  return {m,u,d,field,X};
}
const fwd=(d:number)=>({x:d,y:0});
const speed=(v:number)=>({speed:v,acceleration:v});
const dribble=(m:Match,d:number,run=false)=>actionChance(m,'dribble',run?{vector:fwd(d),run}:{vector:fwd(d)});

it('an open path is near-certain: only the touch can fail (95–99%, never 100%)',()=>{
  for(const r of [40,50,60,75,90,99]){
    const s=scene({x:50,y:34,a:r},[]);const p=dribble(s.m,s.d);
    expect(p).toBeGreaterThanOrEqual(.95);expect(p).toBeLessThan(1);expect(p).toBeCloseTo(Math.min(.99,touchChance(s.u)),12);
  }
  // A defender beside the path but well clear of it hardly matters; one standing 10 m ahead is beyond the reach.
  const far=scene({x:50,y:34},[{x:61,y:34}]);expect(dribble(far.m,far.d)).toBeCloseTo(touchChance(far.u),12);
  // Fatigue and a poor first touch still cost a little.
  const tired=scene({x:50,y:34,a:40},[]);const fresh=dribble(tired.m,tired.d);tired.u.energy=30;
  expect(dribble(tired.m,tired.d)).toBeLessThan(fresh);
  expect(attackOdds(far.m,'dribble',{vector:fwd(far.d)}).why).toContain('진행 방향 공간 열림');
});

it('a defender walking into the path lowers the chance smoothly and monotonically',()=>{
  let last=1;
  for(let gap=12;gap>=2.5;gap-=.25){
    const s=scene({x:50,y:34},[{x:50+gap,y:34.5}]);const p=dribble(s.m,s.d);
    expect(p).toBeLessThanOrEqual(last+1e-12);expect(last-p).toBeLessThan(.06);last=p;
  }
  expect(last).toBeLessThan(.6);
  // Inside 2.5 m the bearing is blended towards 'beside' so a man passed by does not flip the odds (0.11 smoothness);
  // body contact still keeps the chance about as low as at 2.5 m.
  for(const gap of [2,1.5,1]){const s=scene({x:50,y:34},[{x:50+gap,y:34.5}]);expect(Math.abs(dribble(s.m,s.d)-last)).toBeLessThan(.1);}
});

it('pace: my speed never lowers and the opponent’s never raises my dribble / knock-on chance',()=>{
  const spots=[{x:53,y:34},{x:56,y:34},{x:50,y:37},{x:48,y:34},{x:51,y:31}];
  for(const run of [false,true])for(const o of spots){
    let up=-1,down=2;
    for(let v=30;v<=99;v+=3){
      const a=scene({x:50,y:34,a:speed(v)},[o]);const pa=dribble(a.m,a.d,run);expect(pa).toBeGreaterThanOrEqual(up-1e-12);up=pa;
      const b=scene({x:50,y:34},[{...o,a:speed(v)}]);const pb=dribble(b.m,b.d,run);expect(pb).toBeLessThanOrEqual(down+1e-12);down=pb;
    }
  }
});

it('a faster player escapes a chaser; a slower one gets caught',()=>{
  for(const run of [false,true]){
    const quick=scene({x:50,y:34,a:speed(85)},[{x:48,y:34,a:speed(55)}]),slow=scene({x:50,y:34,a:speed(55)},[{x:48,y:34,a:speed(85)}]);
    const q=dribble(quick.m,quick.d,run),s=dribble(slow.m,slow.d,run);
    expect(q-s).toBeGreaterThan(run?.2:.1);expect(chanceLevel(q)).toBe(4);
    expect(attackOdds(quick.m,'dribble',{vector:fwd(quick.d),run}).why).toContain('속도 우위');
    expect(attackOdds(slow.m,'dribble',{vector:fwd(slow.d),run}).why).toContain('속도 열세');
  }
  // From the side too, but less than from behind; for a knock-on the side race matters fully.
  const sideQ=scene({x:50,y:34,a:speed(85)},[{x:50,y:37,a:speed(55)}]),sideS=scene({x:50,y:34,a:speed(55)},[{x:50,y:37,a:speed(85)}]);
  expect(dribble(sideQ.m,sideQ.d)-dribble(sideS.m,sideS.d)).toBeGreaterThan(.08);
});

it('pace alone does not open a defender standing right in the path',()=>{
  const s=scene({x:50,y:34,a:speed(99)},[{x:53,y:34,a:speed(40)}]);
  expect(dribble(s.m,s.d)).toBeLessThan(.6);         // not 높음 — beat him with skill, or go around
  expect(dribble(s.m,s.d,true)).toBeLessThan(.75);   // a knock-on straight into him is a gamble
  const even=scene({x:50,y:34},[{x:53,y:34}]);
  expect(dribble(even.m,even.d,true)).toBeLessThan(dribble(even.m,even.d)); // and worse than a dribble at equal pace
});

it('치고 달리기: 8–10 m by pace, a short dribble 3–7 m by space and pace; space and pace decide the knock-on',()=>{
  const slow=scene({x:50,y:34,a:speed(40)},[]),fast=scene({x:50,y:34,a:speed(90)},[]);
  expect(dribbleAdvance(slow.m,slow.u,fwd(slow.d),true)).toBeCloseTo(ODDS.advance.runMin,0);
  expect(dribbleAdvance(fast.m,fast.u,fwd(fast.d),true)).toBeCloseTo(ODDS.advance.runMax,0);
  const crowded=scene({x:50,y:34,a:speed(40)},[{x:53,y:34}]);
  expect(dribbleAdvance(crowded.m,crowded.u,fwd(crowded.d))).toBeGreaterThanOrEqual(3);
  expect(dribbleAdvance(fast.m,fast.u,fwd(fast.d))).toBeLessThanOrEqual(7);
  expect(dribbleAdvance(fast.m,fast.u,fwd(fast.d))).toBeGreaterThan(dribbleAdvance(crowded.m,crowded.u,fwd(crowded.d)));
  // An open knock-on is very likely, a little riskier than a short dribble (the long touch).
  const p=dribble(fast.m,fast.d,true);expect(chanceLevel(p)).toBe(4);expect(p).toBeLessThan(dribble(fast.m,fast.d));
  // A defender 8 m ahead hardly bothers a short dribble but does threaten a long knock-on.
  const ahead=scene({x:50,y:34},[{x:58,y:34}]);expect(dribble(ahead.m,ahead.d,true)).toBeLessThan(dribble(ahead.m,ahead.d)-.05);
});

it('the knock-on in play: the shown chance is the real rate; success moves 8–10 m, a loss goes to the nearest to the ball',()=>{
  const base=scene({x:50,y:34,a:speed(75)},[{x:49,y:36,a:speed(65)},{x:60,y:37}]);
  const shown=dribble(base.m,base.d,true),gain=dribbleAdvance(base.m,base.u,fwd(base.d),true);let ok=0;const N=1500;
  for(let k=0;k<N;k++){
    const m=structuredClone(base.m);m.seed=k*2654435761>>>0;const u=m.players[m.userId],x0=u.x,e0=u.energy;
    act(m,'dribble',{vector:fwd(base.d),run:true});
    // A lost knock-on costs exactly the sprint; a won one also the few seconds of running that follow (0.13 carry).
    if(m.ball.owner===m.userId){expect(u.energy).toBeLessThanOrEqual(e0-ODDS.run.energy);expect(u.energy).toBeGreaterThan(e0-ODDS.run.energy-.5);}else expect(u.energy).toBe(e0-ODDS.run.energy);
    if(m.ball.owner===m.userId){ok++;expect(Math.abs(u.x-x0)).toBeCloseTo(gain,6);}
    else{const landing={x:x0+base.d*gain,y:34},q=m.players[m.ball.owner!];expect(q.team).toBe(1);
      const nearest=m.players.filter(p=>p.team===1).sort((a,b)=>Math.hypot(a.x-landing.x,a.y-landing.y)-Math.hypot(b.x-landing.x,b.y-landing.y))[0];
      expect(q.id).toBe(nearest.id);}
  }
  expect(Math.abs(ok/N-shown)).toBeLessThan(.04);
});

it('the AI dribbles by the same odds without touching the random stream; it knocks on into space, not into a man',()=>{
  const open=scene({x:50,y:34,a:speed(85)},[]);const seed=open.m.seed,copy=JSON.stringify(open.m);
  const choice=aiDribble(open.m,open.u);expect(choice.run).toBe(true);
  expect(open.m.seed).toBe(seed);expect(JSON.stringify(open.m)).toBe(copy);
  const blocked=scene({x:50,y:34,a:speed(85)},[{x:54,y:34,a:70}]);const b=aiDribble(blocked.m,blocked.u);expect(b.run&&b.vector!.y===0).toBeFalsy(); // never straight into him
  for(const s of [open,blocked]){const c=aiDribble(s.m,s.u);expect(c.vector!.x*s.d).toBeGreaterThan(0);}
});

it('tackling and pressing: chasing a quicker carrier is harder, a slower one easier (sliding is a lunge, not a race)',()=>{
  const odds=(mine:number,his:number,a:'tackle'|'press'|'slide')=>{
    const s=scene({x:50,y:34},[{x:48,y:34,a:speed(his)}]); // the carrier (team 1) heads to lower x: we chase from behinds.u.a={...s.u.a,...speed(mine)};
    s.m.ball.owner=s.field[0].id;s.m.decision=false;s.m.defending=true;return defenseOdds(s.m,a);
  };
  for(const a of ['tackle','press'] as const){expect(odds(85,55,a).p).toBeGreaterThan(odds(55,85,a).p+.02);expect(odds(55,85,a).why).toContain('속도 열세');}
  expect(odds(85,55,'slide').p-odds(55,85,'slide').p).toBeLessThan(.02);
  expect(paceOf(scene({x:50,y:34,a:speed(80)},[]).u)).toBeGreaterThan(paceOf(scene({x:50,y:34,a:speed(60)},[]).u));
});
