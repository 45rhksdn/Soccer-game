import {it,expect} from 'vitest';
import {createMatch,attributes,direction,act,actionChance,CARRY,ATTRS,type Attributes} from '../src/engine';
import {attackOdds,dribbleAdvance,dribbleMinimum,stopsCarry,ODDS} from '../src/tactical';

// v0.13: unmarked chances are finished at realistic rates; a dribble takes time and both teams move meanwhile.
type Place={x:number,y:number,a?:Partial<Attributes>|number};
const flat=(v:number)=>Object.fromEntries(ATTRS.map(k=>[k,v])) as Attributes;
function scene(me:Place,opp:Place[],keeper=60){
  const m=createMatch(777,{name:'나',pos:'ST',a:attributes(60),energy:100});const d=direction(m,0);
  const X=(x:number)=>d>0?x:105-x;
  for(const p of m.players){p.x=X(p.team?60:20);p.y=p.team?4+p.id:40+p.id*.3;p.energy=100;}
  const u=m.players[m.userId];u.x=X(me.x);u.y=me.y;u.a=typeof me.a==='number'?flat(me.a):{...flat(70),...me.a};
  const field=m.players.filter(p=>p.team===1&&p.pos!=='GK');
  opp.forEach((o,i)=>{const q=field[i];q.x=X(o.x);q.y=o.y;q.a=typeof o.a==='number'?flat(o.a):{...flat(60),...o.a};});
  const gk=m.players.find(p=>p.team===1&&p.pos==='GK')!;gk.x=X(103);gk.y=34;gk.a=flat(keeper);
  m.ball={x:u.x,y:u.y,owner:u.id,flight:null};m.decision=true;m.insight={chance:0,gains:{},events:[]};
  return {m,u,d,X,field};
}
const close=(r:number,a:number,opp:Place[]=[],y=34)=>{const s=scene({x:105-r,y,a},opp);return actionChance(s.m,'closeShot');};

it('an unmarked chance in front of goal is finished at a realistic rate',()=>{
  // 70-rated finisher, central, average keeper, nobody near: about half from 6 m, about a third from the spot.
  expect(close(6,70)).toBeGreaterThanOrEqual(.45);expect(close(6,70)).toBeLessThan(.7);
  expect(close(11,70)).toBeGreaterThanOrEqual(.3);expect(close(11,70)).toBeLessThan(.45);
  expect(close(6,85)).toBeGreaterThan(close(6,70));expect(close(6,50)).toBeGreaterThanOrEqual(.35);
  // Closer is always better (from 6 m: nearer than that the keeper standing at 2 m is himself the challenger).
  let last=1;for(let r=6;r<=21;r+=1){const p=close(r,70);expect(p).toBeLessThanOrEqual(last+1e-12);last=p;}
  // A tight angle still costs.
  expect(close(6,70,[],22)).toBeLessThan(close(6,70)*.7);
});

it('a defender in the shooting lane or on the shooter still makes it hard; long shots stay hard',()=>{
  const open=close(8,70),blocked=close(8,70,[{x:99,y:34}]),tight=close(8,70,[{x:97.5,y:36}]);
  expect(blocked).toBeLessThan(open*.3);expect(tight).toBeLessThan(open*.75);
  const far=scene({x:80,y:34,a:{longShot:95,finishing:95}},[]);expect(actionChance(far.m,'longShot')).toBeLessThan(.2);
  // A strong keeper still matters.
  const good=scene({x:97,y:34},[],95),poor=scene({x:97,y:34},[],25);
  expect(actionChance(good.m,'closeShot')).toBeLessThan(actionChance(poor.m,'closeShot'));
});

it('headers and volleys keep the keeper’s close save (less power off a cross)',()=>{
  const s=scene({x:98,y:34},[]);s.m.aerial={to:s.u.id,until:s.m.clock+9};
  const h=attackOdds(s.m,'header').p,v=attackOdds(s.m,'volley').p,c=(()=>{const t=scene({x:98,y:34},[]);return actionChance(t.m,'closeShot');})();
  expect(h).toBeLessThan(c);expect(v).toBeLessThan(c);expect(ODDS.shot.aerialSave).toBeGreaterThanOrEqual(.3);
});

it('a successful dribble takes time: the clock runs and both teams move while the dribbler carries the ball',()=>{
  const s=scene({x:50,y:34},[{x:56,y:44},{x:62,y:30}]);
  const st=s.m.players.find(p=>p.team===0&&p.id!==s.u.id&&p.pos==='ST')??s.m.players.find(p=>p.team===0&&p.pos==='LW')!;st.x=s.X(58);st.y=24;
  const v={x:s.d,y:0},gain=dribbleAdvance(s.m,s.u,v);let done=false;
  for(let k=0;k<40&&!done;k++){
    const m=structuredClone(s.m);m.seed=k*2654435761>>>0;const u=m.players[m.userId],t0=m.clock;
    const before=m.players.map(p=>({x:p.x,y:p.y})),x0=u.x;
    act(m,'dribble',{vector:v});
    if(m.ball.owner!==m.userId)continue;
    done=true;
    const carried=Math.abs(u.x-x0);expect(carried).toBeLessThanOrEqual(gain+1e-9);expect(carried).toBeGreaterThanOrEqual(Math.min(gain,dribbleMinimum(s.m,s.u,v))-.51);expect(m.decision).toBe(true);
    if(carried<gain-1e-6)expect(m.log.at(-1)!.text).toContain('멈춰 섭니다'); // Collision is detected before the other players finish this slice.
    expect(m.clock-t0).toBeGreaterThan(0);expect(m.clock-t0).toBeLessThanOrEqual(CARRY.maxSlices*CARRY.dt*6);
    const moved=(team:number)=>m.players.filter(p=>p.team===team&&p.id!==m.userId&&Math.hypot(p.x-before[p.id].x,p.y-before[p.id].y)>.3).length;
    expect(moved(0)).toBeGreaterThan(3);expect(moved(1)).toBeGreaterThan(3);
    // The nearest defender closes the dribbler down; the striker keeps running ahead of the ball.
    const near=m.players[s.field[0].id];const d0=Math.hypot(before[near.id].x-before[m.userId].x,before[near.id].y-before[m.userId].y);
    expect(Math.hypot(near.x-u.x,near.y-u.y)).toBeLessThan(d0+gain);
    expect((m.players[st.id].x-before[st.id].x)*s.d).toBeGreaterThan(0);
    expect(m.ball.x).toBe(u.x);expect(m.ball.y).toBe(u.y);
  }
  expect(done).toBe(true);
});

it('the carry never crosses half time and is deterministic',()=>{
  const s=scene({x:50,y:34},[]);s.m.clock=2699;
  const a=structuredClone(s.m);act(a,'dribble',{vector:{x:s.d,y:0}});
  if(a.ball.owner===a.userId)expect(a.clock).toBeLessThan(2700);
  const b=structuredClone(s.m),c=structuredClone(s.m);b.clock=c.clock=1200;
  act(b,'dribble',{vector:{x:s.d,y:0},run:true});act(c,'dribble',{vector:{x:s.d,y:0},run:true});
  expect(JSON.stringify(b)).toBe(JSON.stringify(c));
});
