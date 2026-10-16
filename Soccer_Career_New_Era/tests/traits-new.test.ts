import {it,expect} from 'vitest';
import {newCareer} from '../src/career';
import {attributes,createMatch,finishMatch,step,actionChance,act,rating,turnover,type Match,type Footballer} from '../src/engine';
import {applyDaily,prepareWeek,releaseExperience} from '../src/development';
import {encode,decode} from '../src/storage';
import {matchFx,trainingFatigueMultiplier,injuryChanceMultiplier,restRecoveryMultiplier} from '../src/traits';

const profile={name:'신특성',age:16,pos:'CM' as const,secondary:'ST' as const,foot:'오른',height:178,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'};
const career=(seed=41)=>newCareer(profile,0,seed);
const match=(seed=5)=>createMatch(seed,{name:'검증',pos:'CM',a:attributes(60),energy:100});
const mate=(m:Match,p:Footballer)=>m.players.find(q=>q.team===p.team&&q.id!==p.id&&q.pos!=='GK')!;
/** Completes a pass from `from` to `to` on the next tick. */
function completePass(m:Match,from:Footballer,to:Footballer){
  m.ball={x:from.x,y:from.y,owner:null,flight:{from:from.id,to:to.id,x:to.x,y:to.y,kind:'pass',progress:.999,duration:1,startX:from.x,startY:from.y,success:true,xg:0}};
  m.decision=false;m.nextAI=99;m.cooldown=99;step(m,.5,false);
}

it('강철몸: fatigue −40 %, injury −60 %, rest recovery +50 %',()=>{
  expect(trainingFatigueMultiplier(['강철몸'])).toBeCloseTo(.6,8);expect(injuryChanceMultiplier(['강철몸'])).toBeCloseTo(.4,8);expect(restRecoveryMultiplier(['강철몸'])).toBe(1.5);
  const c=career();c.player.fatigue=0;applyDaily(c,c.player,'passing',['강철몸']);expect(c.player.fatigue).toBeCloseTo(7.2,8);
  const rest=(t:string[],type:'rest'|'vacation')=>{const x=career();x.player.fatigue=95;applyDaily(x,x.player,type,t);return 95-x.player.fatigue;};
  expect(rest([],'rest')).toBe(25);expect(rest(['강철몸'],'rest')).toBe(37.5);expect(rest(['강철몸'],'vacation')).toBe(90);
});

it('플레이메이커: the receiver’s next action gets ×1.1 once, never stacks, and is dropped on a turnover',()=>{
  const m=match(),me=m.players[m.userId],t=mate(m,me);me.fx=matchFx(['플레이메이커']);
  completePass(m,me,t);
  expect(m.ball.owner).toBe(t.id);expect(m.assistBoost).toEqual({to:t.id,mult:1.1});
  const plain=structuredClone(m);plain.assistBoost=null;
  for(const a of ['dribble','hold','safe'] as const){const b=actionChance(m,a),p=actionChance(plain,a);if(p*1.1<.97)expect(b/p).toBeCloseTo(1.1,8);}
  // A second pass does not stack.
  completePass(m,t,me);completePass(m,me,t);expect(m.assistBoost).toEqual({to:t.id,mult:1.1});
  act(m,'hold');expect(m.assistBoost).toBeNull();
  // A teammate without the trait gives no boost.
  const n=match(),u=n.players[n.userId],v=mate(n,u);completePass(n,u,v);expect(n.assistBoost??null).toBeNull();
});

it('분위기 메이커: a goal halves the team’s stamina drain for 10 minutes; conceding ends it',()=>{
  const m=match(9),me=m.players[m.userId];me.fx=matchFx(['분위기 메이커']);
  m.ball={x:me.x,y:me.y,owner:null,flight:{from:me.id,to:null,x:105,y:34,kind:'shot',progress:.999,duration:1,startX:me.x,startY:me.y,success:true,xg:.3,onTarget:true}};
  m.decision=false;step(m,.5,true);
  expect(m.momentum![me.team]).toBeGreaterThan(m.clock);expect(m.momentumDrain![me.team]).toBe(.5);
  const t=mate(m,me),control=structuredClone(m);control.momentum=[0,0];
  const before=t.energy;t.energy=control.players[t.id].energy=80;step(m,.5,true);step(control,.5,true);
  expect(80-m.players[t.id].energy).toBeCloseTo((80-control.players[t.id].energy)/2,6);void before;
  const opp=m.players.find(p=>p.team!==me.team&&p.pos!=='GK')!;
  m.ball={x:opp.x,y:opp.y,owner:null,flight:{from:opp.id,to:null,x:0,y:34,kind:'shot',progress:.999,duration:1,startX:opp.x,startY:opp.y,success:true,xg:.3,onTarget:true}};
  step(m,.5,true);expect(m.momentum![me.team]).toBe(0);
});

it('집념: winning the ball back within 60 s restores energy and adds rating (capped)',()=>{
  const m=match(),me=m.players[m.userId],opp=m.players.find(p=>p.team!==me.team)!;me.fx=matchFx(['집념']);me.energy=50;
  turnover(m,me,opp);m.clock+=30;turnover(m,opp,me);expect(me.energy).toBe(56);expect(me.stats.grit).toBe(1);
  turnover(m,me,opp);m.clock+=61;turnover(m,opp,me);expect(me.stats.grit).toBe(1);
  const base=rating({...me,stats:{...me.stats,grit:0}});
  expect(rating({...me,stats:{...me.stats,grit:1}})-base).toBeCloseTo(.15,8);expect(rating({...me,stats:{...me.stats,grit:9}})-base).toBeCloseTo(.45,8);
  // Fires in real play: a team of 집념 players over several matches.
  let fired=0;for(let s=1;s<=6;s++){const x=match(s);for(const p of x.players)if(p.team===0)p.fx=matchFx(['집념']);finishMatch(x);fired+=x.players.reduce((n,p)=>n+(p.stats.grit??0),0);}
  expect(fired).toBeGreaterThan(0);
});

it('engine effects never change a match for players without them',()=>{
  const a=match(77),b=match(77);for(const p of b.players)if(p.team===1)p.fx=undefined;
  finishMatch(a);finishMatch(b);expect(a.score).toEqual(b.score);expect(a.log).toEqual(b.log);
  expect(a.assistBoost??null).toBeNull();expect(a.momentum).toBeUndefined();expect(a.lostBall).toBeUndefined();
});

function weekGain(traits:string[],userRating:number,rivalRating:number){
  const c=career(7);c.player.a=attributes(40);c.player.potential=95;c.development.traits=traits;
  c.week=1;c.day=7;c.history=[{id:0,date:'2026-03-07',opponent:'x',score:[0,0],rating:userRating,stats:{minutes:90,goals:0,assists:0,shots:0,onTarget:0,passes:0,completed:0,tackles:0,interceptions:0,losses:0,saves:0},shots:[0,0],xg:[0,0],gain:0}];
  c.development.rival.history=[{week:0,rating:rivalRating,goals:0,club:'c1'}];
  prepareWeek(c,['passing','rest','rest','rest','rest','rest','rest']);return {c,gain:c.player.a.passing-40};
}
it('라이벌 의식: first training of the week ×2 only when the rival out-rated you last week',()=>{
  const plain=weekGain([],6,7.5).gain,driven=weekGain(['라이벌 의식'],6,7.5),ahead=weekGain(['라이벌 의식'],8,7.5).gain;
  expect(driven.gain/plain).toBeCloseTo(2,6);expect(ahead/plain).toBeCloseTo(1,6);
  expect(driven.c.development.news.some(n=>n.text.includes('라이벌 의식'))).toBe(true);
});

it('독학파: three sessions of the same training add one extra session, once per week',()=>{
  const run=(t:string[],plan:string[])=>{const c=career(8);c.player.a=attributes(40);c.player.potential=95;c.development.traits=t;c.development.rival.traits=[];prepareWeek(c,plan as never);return c;};
  const plan=['passing','passing','passing','passing','rest','rest','rest'];
  const plain=run([],plan),focused=run(['독학파'],plan);
  expect(focused.player.a.passing).toBeGreaterThan(plain.player.a.passing);
  expect(focused.development.news.filter(n=>n.text.includes('독학파!')).length).toBe(1);
  const mixed=run(['독학파'],['passing','running','passing','running','rest','rest','rest']);expect(mixed.development.news.some(n=>n.text.includes('독학파!'))).toBe(false);
});

it('대기만성: banks 30 % of young training growth, releases it weekly from age 28, survives save/load',()=>{
  const c=career(9);c.player.a=attributes(40);c.player.potential=95;c.development.traits=['대기만성'];
  const before=c.player.a.passing;applyDaily(c,c.player,'passing',c.development.traits);
  const gained=c.player.a.passing-before+0;expect(c.development.experienceBank!).toBeGreaterThan(0);
  expect(c.development.experienceBank!).toBeLessThanOrEqual(60);void gained;
  c.development.experienceBank=10;expect(releaseExperience(c,false)).toBe(0);
  c.player.age=28;const role=c.player.a.passing;expect(releaseExperience(c,false)).toBeCloseTo(.8,8);
  expect(c.player.a.passing).toBeGreaterThan(role);expect(c.development.experienceBank).toBeCloseTo(9.2,8);
  expect(decode(encode(c)).development.experienceBank).toBeCloseTo(9.2,8);
  c.development.experienceBank=.2;expect(releaseExperience(c,false)).toBeCloseTo(.2,8);expect(c.development.experienceBank).toBe(0);
});
