import {it,expect} from 'vitest';
import {createMatch,attributes,direction,act,defend,step,availableActions,actionChance,ATTRS,type Match,type Footballer,type Attributes} from '../src/engine';
import {attackOdds,defenseOdds,interferers,edge,chanceLevel,opponentDistanceLabel,nearbyOpponents,ODDS} from '../src/tactical';
import {newCareer} from '../src/career';
import {encode,decode} from '../src/storage';

// v0.11 matchup odds: the 11 required checks of the probability rework.
type Place={x:number,y:number,a?:Partial<Attributes>|number};
const flat=(v:number)=>Object.fromEntries(ATTRS.map(k=>[k,v])) as Attributes;
/** One attacker (team 0, slot 9) on the ball at `me`, chosen opponents placed, everyone else far away. */
function scene(me:Place,opp:Place[],opts:{mate?:Place,keeper?:number}={}){
  const m=createMatch(777,{name:'나',pos:'ST',a:attributes(60),energy:100});const d=direction(m,0);
  const X=(x:number)=>d>0?x:105-x; // scene coordinates: team 0 attacks towards x = 105
  for(const p of m.players){p.x=X(p.team?95:8);p.y=p.team?4+p.id%11*0.4:64-p.id*0.3;p.energy=100;}
  const u=m.players[m.userId];u.x=X(me.x);u.y=me.y;u.a=typeof me.a==='number'?flat(me.a):{...flat(60),...me.a};
  const field=m.players.filter(p=>p.team===1&&p.pos!=='GK');
  opp.forEach((o,i)=>{const q=field[i];q.x=X(o.x);q.y=o.y;q.a=typeof o.a==='number'?flat(o.a):{...flat(50),...o.a};});
  const gk=m.players.find(p=>p.team===1&&p.pos==='GK')!;gk.x=X(103);gk.y=34;gk.a=flat(opts.keeper??50);
  if(opts.mate){const mate=m.players.find(p=>p.team===0&&p.pos==='CM')!;mate.x=X(opts.mate.x);mate.y=opts.mate.y;}
  m.ball={x:u.x,y:u.y,owner:u.id,flight:null};m.decision=true;
  return {m,u,d,field,gk,mate:m.players.find(p=>p.team===0&&p.pos==='CM')!};
}
const fwd=(d:number)=>({x:d,y:0}),back=(d:number)=>({x:-d,y:0});

it('1. raising my own relevant ability never lowers the chance (dribble, pass, shot, tackle)',()=>{
  for(const [key,action] of [['dribbling','dribble'],['passing','pass'],['shooting','closeShot'],['finishing','closeShot']] as const){
    let last=-1;
    for(let v=20;v<=95;v+=5){
      const s=scene({x:80,y:34,a:{[key]:v}},[{x:83,y:35,a:55},{x:86,y:30,a:55}],{mate:{x:70,y:40}});
      const p=action==='dribble'?actionChance(s.m,'dribble',{vector:fwd(s.d)}):action==='pass'?actionChance(s.m,'pass',{targetId:s.mate.id}):actionChance(s.m,action);
      expect(p).toBeGreaterThanOrEqual(last-1e-12);last=p;
    }
  }
  let last=-1;
  for(let v=20;v<=95;v+=5){const s=scene({x:60,y:34},[{x:62,y:34,a:55}]);s.u.a.defending=v;s.m.ball.owner=s.field[0].id;s.m.decision=false;s.m.defending=true;
    const p=defenseOdds(s.m,'tackle').p;expect(p).toBeGreaterThanOrEqual(last-1e-12);last=p;}
});

it('2. raising the opponent’s relevant ability never raises my chance',()=>{
  const cases:[string,(v:number)=>number][]=[
    ['dribble vs marking',v=>{const s=scene({x:70,y:34},[{x:73,y:34,a:{marking:v,defending:v}}]);return actionChance(s.m,'dribble',{vector:fwd(s.d)});}],
    ['pass vs lane reading',v=>{const s=scene({x:60,y:34},[{x:66,y:35,a:{anticipation:v,positioning:v}}],{mate:{x:72,y:36}});return actionChance(s.m,'pass',{targetId:s.mate.id});}],
    ['shot vs keeper',v=>{const s=scene({x:92,y:34},[],{keeper:v});return actionChance(s.m,'closeShot');}],
    ['shot vs presser',v=>{const s=scene({x:90,y:34},[{x:91.5,y:35,a:{marking:v,anticipation:v}}]);return actionChance(s.m,'closeShot');}],
  ];
  for(const [,f] of cases){let last=2;for(let v=20;v<=95;v+=5){const p=f(v);expect(p).toBeLessThanOrEqual(last+1e-12);last=p;}}
  let last=2;
  for(let v=20;v<=95;v+=5){const s=scene({x:60,y:34},[{x:62,y:34,a:{control:v,dribbling:v,strength:v}}]);s.m.ball.owner=s.field[0].id;s.m.defending=true;s.m.decision=false;
    const p=defenseOdds(s.m,'tackle').p;expect(p).toBeLessThanOrEqual(last+1e-12);last=p;}
});

it('3. a defender who has been beaten (now behind) hinders far less than when he blocked the way',()=>{
  const front=scene({x:70,y:34},[{x:73,y:34}]),behind=scene({x:70,y:34},[{x:67,y:34}]);
  const iFront=interferers(front.m,front.u,front.d,0)[0].i,iBehind=interferers(behind.m,behind.u,behind.d,0)[0].i;
  expect(iBehind).toBeLessThan(iFront*.35);
  expect(actionChance(behind.m,'dribble',{vector:fwd(behind.d)})-actionChance(front.m,'dribble',{vector:fwd(front.d)})).toBeGreaterThan(.12);
  // Smooth: moving the defender 0.5 m changes the chance only a little.
  let last:number|undefined;
  for(let x=74;x>=66;x-=.5){const s=scene({x:70,y:34},[{x,y:34.5}]);const p=actionChance(s.m,'dribble',{vector:fwd(s.d)});if(last!==undefined)expect(Math.abs(p-last)).toBeLessThan(.06);last=p;}
});

it('4. dribbling backwards turns the defender behind into the main obstacle again',()=>{
  const s=scene({x:70,y:34},[{x:67,y:34}]);
  expect(actionChance(s.m,'dribble',{vector:back(s.d)})).toBeLessThan(actionChance(s.m,'dribble',{vector:fwd(s.d)})-.12);
  expect(interferers(s.m,s.u,-s.d,0)[0].where).toBe('front');
});

it('5. a defender covering the path ahead counts more than a closer one already behind',()=>{
  const s=scene({x:70,y:34},[{x:68,y:34},{x:74.5,y:34.5}]);
  const list=interferers(s.m,s.u,s.d,0);
  expect(list[0].o.id).toBe(s.field[1].id);expect(list[0].where).toBe('front');
  expect(attackOdds(s.m,'dribble',{vector:fwd(s.d)}).why).toContain('정면 수비 견제');
});

it('6. a low-rated dribbler facing weaker defenders from a good position gets a high chance',()=>{
  // Favourable: the defender beside / slightly behind, or still 6 m away in front.
  const side=scene({x:70,y:34,a:45},[{x:69,y:37,a:25}]),ahead=scene({x:70,y:34,a:45},[{x:76,y:35,a:25}]);
  expect(chanceLevel(actionChance(side.m,'dribble',{vector:fwd(side.d)}))).toBeGreaterThanOrEqual(3); // 높은 확률 or better
  expect(chanceLevel(actionChance(ahead.m,'dribble',{vector:fwd(ahead.d)}))).toBeGreaterThanOrEqual(3);
  expect(attackOdds(side.m,'dribble',{vector:fwd(side.d)}).why.join()).toMatch(/우세|여유|약함|견제/);
  // …and a high-rated one facing much better defenders head-on struggles.
  const tough=scene({x:70,y:34,a:85},[{x:72,y:34,a:99},{x:73,y:31,a:99}]);
  expect(chanceLevel(actionChance(tough.m,'dribble',{vector:fwd(tough.d)}))).toBeLessThanOrEqual(2);
});

it('7. weak defenders do not make a long-range shot likely',()=>{
  const s=scene({x:75,y:34,a:{longShot:95,finishing:95,shooting:95,composure:95}},[{x:78,y:35,a:20},{x:80,y:32,a:20}],{keeper:30});
  const p=actionChance(s.m,'longShot');expect(p).toBeGreaterThan(0);expect(p).toBeLessThan(.4);
  expect(attackOdds(s.m,'longShot').why).toContain('먼 거리');
});

it('8. the shown chance follows the chosen teammate / direction and equals the actual success rate',()=>{
  const base=scene({x:60,y:34},[{x:64,y:30,a:60},{x:66,y:39,a:70}],{mate:{x:72,y:40}});
  const st=base.m.players.find(p=>p.team===0&&p.pos==='ST'&&p.id!==base.u.id)??base.m.players.find(p=>p.team===0&&p.pos==='LW')!;st.x=base.d>0?70:35;st.y=30;
  const a=actionChance(base.m,'pass',{targetId:base.mate.id}),b=actionChance(base.m,'pass',{targetId:st.id});
  expect(a).not.toBeCloseTo(b,3);
  const rate=(f:(m:Match)=>boolean)=>{let ok=0;for(let k=0;k<1500;k++){const m=structuredClone(base.m);m.seed=k*2654435761>>>0;m.insight={chance:0,gains:{},events:[]};if(f(m))ok++;}return ok/1500;};
  for(const id of [base.mate.id,st.id]){const shown=actionChance(base.m,'pass',{targetId:id});
    expect(Math.abs(rate(m=>{act(m,'pass',{targetId:id});return !!m.ball.flight?.success;})-shown)).toBeLessThan(.04);}
  for(const v of [fwd(base.d),{x:0,y:1}]){const shown=actionChance(base.m,'dribble',{vector:v});
    expect(Math.abs(rate(m=>{act(m,'dribble',{vector:v});return m.ball.owner===m.userId;})-shown)).toBeLessThan(.04);}
});

it('9. pass arrival, goals and tackle turnovers follow the judged outcome',()=>{
  for(let k=0;k<40;k++){
    const s=scene({x:60,y:34},[{x:64,y:31}],{mate:{x:70,y:38}});s.m.seed=k*7919;s.m.insight={chance:0,gains:{},events:[]};
    act(s.m,'pass',{targetId:s.mate.id});const ok=s.m.ball.flight!.success;
    for(let i=0;i<10&&s.m.ball.flight;i++)step(s.m,.5,true);
    if(ok)expect(s.m.ball.owner).toBe(s.mate.id);else expect(s.m.players[s.m.ball.owner!].team).toBe(1);
  }
  for(let k=0;k<40;k++){
    const s=scene({x:96,y:34},[]);s.m.seed=k*104729;s.m.insight={chance:0,gains:{},events:[]};const before=s.m.score[0];
    act(s.m,'closeShot');const ok=s.m.ball.flight!.success;for(let i=0;i<10&&s.m.ball.flight;i++)step(s.m,.5,true);
    expect(s.m.score[0]-before).toBe(ok?1:0);
  }
  let wins=0,tries=0;
  for(let k=0;k<60;k++){
    const s=scene({x:60,y:34},[{x:61.5,y:34}]);s.m.seed=k*31337;s.m.insight={chance:0,gains:{},events:[]};
    s.m.ball={x:s.field[0].x,y:s.field[0].y,owner:s.field[0].id,flight:null};s.m.decision=false;s.m.defending=true;
    const tackles=s.u.stats.tackles;defend(s.m,'tackle');tries++;
    if(s.u.stats.tackles>tackles){wins++;expect(s.m.ball.owner).toBe(s.u.id);}else expect(s.m.ball.owner).toBe(s.field[0].id);
  }
  expect(wins).toBeGreaterThan(0);expect(wins).toBeLessThan(tries);
});

it('10. reading odds, reasons and labels never consumes the match random stream',()=>{
  const s=scene({x:80,y:30},[{x:83,y:31},{x:85,y:36}],{mate:{x:75,y:40}});const seed=s.m.seed,copy=JSON.stringify(s.m);
  for(const a of availableActions(s.m)){attackOdds(s.m,a);actionChance(s.m,a);}
  for(const v of [fwd(s.d),back(s.d),{x:0,y:1}])attackOdds(s.m,'dribble',{vector:v});
  attackOdds(s.m,'pass',{targetId:s.mate.id});interferers(s.m,s.u,1,0);nearbyOpponents(s.m,s.u);
  expect(s.m.seed).toBe(seed);expect(JSON.stringify(s.m)).toBe(copy);
  const dm=structuredClone(s.m);dm.ball.owner=s.field[0].id;dm.defending=true;const dcopy=JSON.stringify(dm);
  for(const a of ['tackle','slide','press','predict'] as const)defenseOdds(dm,a);
  expect(JSON.stringify(dm)).toBe(dcopy);
});

it('11. a saved and restored match shows and judges exactly the same',()=>{
  const c=newCareer({name:'복원',age:17,pos:'ST',secondary:'LW',foot:'오른',height:180,weight:72,style:'플레이메이커',curve:'꾸준한 성장형'},0,9,{traits:[]});
  const s=scene({x:80,y:30},[{x:83,y:31,a:40},{x:85,y:36,a:70}],{mate:{x:75,y:40}});c.match=s.m;
  const back=decode(encode(c)).match!;
  for(const a of availableActions(s.m))expect(attackOdds(back,a)).toEqual(attackOdds(s.m,a));
  expect(attackOdds(back,'pass',{targetId:s.mate.id})).toEqual(attackOdds(s.m,'pass',{targetId:s.mate.id}));
  const x=structuredClone(s.m),y=structuredClone(back);act(x,'dribble',{vector:fwd(s.d)});act(y,'dribble',{vector:fwd(s.d)});
  expect(y.ball.owner).toBe(x.ball.owner);expect(y.seed).toBe(x.seed);
});

it('distance label, smooth edge and the same edge for dribble and tackle',()=>{
  expect(opponentDistanceLabel(2.04)).toBe('2.0m');expect(opponentDistanceLabel(6)).toBe('6.0m');expect(opponentDistanceLabel(6.01)).toBe('6m 이상');expect(opponentDistanceLabel(Infinity)).toBe('주변 상대 없음');
  expect(edge(0)).toBe(0);expect(edge(10)).toBeCloseTo(-edge(-10),12);expect(edge(5)).toBeLessThan(.12);expect(edge(50)).toBeGreaterThan(.7);
  // Keepers are not counted as nearby field opponents; the real distance is not clipped.
  const s=scene({x:99,y:34},[]);expect(nearbyOpponents(s.m,s.u).distance).toBeGreaterThan(6);expect(ODDS.gkReach).toBe(3);
});
