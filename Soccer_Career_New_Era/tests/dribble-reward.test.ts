import {it,expect} from 'vitest';
import {createMatch,attributes,direction,act,actionChance,rating,emptyStats,DRIBBLE_RATING,DRIBBLE_RATING_CAP,ATTRS,type Attributes} from '../src/engine';
import {attackOdds,interferers,dribbleAdvance,dribbleMinimum,dribbleTargets,stopsCarry,ODDS} from '../src/tactical';

// v0.14 dribble reward: a beaten defender hinders 70% less until the next choice; longer carries that stop
// when a non-chasing opponent comes within 6 m; successful dribbles in records and (a little) in the rating.
type Place={x:number,y:number,a?:Partial<Attributes>|number};
const flat=(v:number)=>Object.fromEntries(ATTRS.map(k=>[k,v])) as Attributes;
function scene(me:Place,opp:Place[]){
  const m=createMatch(777,{name:'나',pos:'ST',a:attributes(60),energy:100});const d=direction(m,0);
  const X=(x:number)=>d>0?x:105-x;
  for(const p of m.players){p.x=X(p.team?100:8);p.y=p.team?2+p.id%11*0.3:64-p.id*0.3;p.energy=100;}
  const u=m.players[m.userId];u.x=X(me.x);u.y=me.y;u.a={...flat(75)};
  const field=m.players.filter(p=>p.team===1&&p.pos!=='GK');
  opp.forEach((o,i)=>{const q=field[i];q.x=X(o.x);q.y=o.y;q.a=typeof o.a==='number'?flat(o.a):{...flat(50),...o.a};});
  m.ball={x:u.x,y:u.y,owner:u.id,flight:null};m.decision=true;m.insight={chance:0,gains:{},events:[]};
  return {m,u,d,X,field};
}
const fwd=(d:number)=>({x:d,y:0});

it('dribbling at a defender and winning: he hinders the next choice 70% less, shown as a reason, and only until that choice',()=>{
  const s=scene({x:50,y:34},[{x:53,y:34.5}]);const v=fwd(s.d),def=s.field[0];
  expect(dribbleTargets(s.m,s.u,v)).toContain(def.id);
  let won:typeof s.m|undefined;
  for(let k=0;k<60&&!won;k++){const m=structuredClone(s.m);m.seed=k*7919;act(m,'dribble',{vector:v});if(m.ball.owner===m.userId)won=m;}
  expect(won).toBeDefined();const m=won!,u=m.players[m.userId],o=m.players[def.id];
  expect(m.dribbleBeat).toEqual({by:u.id,ids:[def.id]});
  // Put the beaten man right back in the way: his interference is 30% of an unbeaten one's.
  o.x=u.x+3*s.d;o.y=u.y;const beaten=interferers(m,u,s.d,0).find(x=>x.o.id===o.id)!.i;
  const fresh=structuredClone(m);fresh.dribbleBeat=undefined;const normal=interferers(fresh,fresh.players[u.id],s.d,0).find(x=>x.o.id===o.id)!.i;
  expect(beaten).toBeCloseTo(normal*ODDS.beaten.factor,12);
  expect(actionChance(m,'dribble',{vector:v})).toBeGreaterThan(actionChance(fresh,'dribble',{vector:v}));
  for(const a of ['dribble','pass'] as const)expect(attackOdds(m,a,a==='pass'?{targetId:m.players.find(p=>p.team===0&&p.pos==='CM')!.id}:{vector:v}).why).toContain('제친 수비수 영향 −70%');
  // The next choice uses it up (a pass here); losing the ball also ends it.
  act(m,'pass',{targetId:m.players.find(p=>p.team===0&&p.pos==='CM')!.id});expect(m.dribbleBeat).toBeUndefined();
});

it('a dribble into open space beats nobody (no reward state), and goes 5× the old distance',()=>{
  const s=scene({x:40,y:34},[]);const v=fwd(s.d);expect(dribbleTargets(s.m,s.u,v)).toEqual([]);
  expect(dribbleAdvance(s.m,s.u,v)).toBeCloseTo(dribbleMinimum(s.m,s.u,v)*ODDS.advance.open,9);
  let done=false;
  for(let k=0;k<30&&!done;k++){const m=structuredClone(s.m);m.seed=k*104729;const u=m.players[m.userId],x0=u.x;act(m,'dribble',{vector:v});
    if(m.ball.owner!==m.userId)continue;done=true;expect(m.dribbleBeat).toBeUndefined();
    expect(Math.abs(u.x-x0)).toBeGreaterThan(dribbleMinimum(s.m,s.u,v)*2);}
  expect(done).toBe(true);
});

it('a long carry stops where an opponent who is not chasing comes within 6 m; a chaser from behind never stops it',()=>{
  // A defender 20 m ahead, slightly off the line: the open carry (≈25–35 m) must stop about 6 m short of him.
  const ahead=scene({x:40,y:34},[{x:62,y:36}]);const v=fwd(ahead.d);
  for(let k=0;k<30;k++){const m=structuredClone(ahead.m);m.seed=k*31337;const u=m.players[m.userId],x0=u.x;act(m,'dribble',{vector:v});
    if(m.ball.owner!==m.userId)continue;const o=m.players[ahead.field[0].id];
    expect(Math.hypot(o.x-u.x,o.y-u.y)).toBeLessThanOrEqual(ODDS.advance.stopRadius+.6);
    expect(Math.abs(u.x-x0)).toBeLessThan(dribbleAdvance(ahead.m,ahead.u,v)-1);
    expect(m.log.at(-1)!.text).toContain('멈춰 섭니다');break;}
  // Only a chaser behind: the carry runs its full length.
  const chased=scene({x:40,y:34},[{x:37,y:34,a:{speed:40,acceleration:40}}]);const plan=dribbleAdvance(chased.m,chased.u,v);
  expect(stopsCarry(chased.m,chased.u,chased.field[0],chased.u,chased.d,0)).toBe(false);
  for(let k=0;k<30;k++){const m=structuredClone(chased.m);m.seed=k*7;const u=m.players[m.userId],x0=u.x;act(m,'dribble',{vector:v});
    if(m.ball.owner!==m.userId)continue;const travelled=Math.abs(u.x-x0),limit=Math.min(plan,(chased.d>0?104:x0-1)-(chased.d>0?x0:0));expect(travelled).toBeLessThanOrEqual(limit+1e-6);expect(travelled).toBeGreaterThan(dribbleMinimum(chased.m,chased.u,v));if(travelled<limit-1e-6)expect(m.log.at(-1)!.text).toContain('멈춰 섭니다'); /* With time proportional to distance, another defender can now close the route. */break;}
});

it('successful dribbles add a little to the match rating (capped)',()=>{
  const m=createMatch(3,{name:'평점',pos:'LW',a:attributes(60),energy:100}),p=m.players[m.userId];p.stats=emptyStats();p.stats.minutes=90;
  const base=rating(p);p.stats.dribbles=3;expect(rating(p)-base).toBeCloseTo(3*DRIBBLE_RATING,9);
  p.stats.dribbles=50;expect(rating(p)-base).toBeCloseTo(DRIBBLE_RATING_CAP,9);expect(DRIBBLE_RATING_CAP).toBeLessThanOrEqual(.3);
});
