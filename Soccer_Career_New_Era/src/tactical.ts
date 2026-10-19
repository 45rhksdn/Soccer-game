import {tacticalNote} from './matchDynamics';
/** Pure action rules. Percentages shown by the UI are the exact engine probabilities. */
import {clamp,direction,type Match,type Footballer,type Action,type Attr,type DefenseAction,type SignatureAction} from './engine';
/** `run`: 0.12 치고 달리기 — the dribble is played as a long knock-on and a sprint (with `vector`). */
export type AttackOptions={targetId?:number;vector?:{x:number;y:number};run?:boolean};
export const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const active=(p:Footballer)=>!p.red&&!p.injured;
/** Nearest opponent field players (keepers are judged separately) and how many stand within 6 m. */
/** 0.11 '상대와의 거리' text: one decimal within 6 m, '6m 이상' beyond, '주변 상대 없음' without one (the value itself is never clipped). */
export const opponentDistanceLabel=(d:number)=>!Number.isFinite(d)?'주변 상대 없음':d<=6?`${d.toFixed(1)}m`:'6m 이상';
export function nearbyOpponents(m:Match,p:Footballer){
 const opponents=m.players.filter(q=>q.team!==p.team&&active(q)&&q.pos!=='GK').sort((a,b)=>distance(a,p)-distance(b,p));
 return {nearest:opponents[0],distance:opponents[0]?distance(p,opponents[0]):Infinity,count:opponents.filter(q=>distance(p,q)<=6).length};
}
/** 0.10 where a pass to `q` is aimed: the end of a timed run in behind (while q is still onside), else q. */
export const runPoint=(m:Match,q:Footballer)=>q.run&&q.run.until>m.clock?{x:q.run.x,y:q.run.y}:{x:q.x,y:q.y};
export const goalDistance=(m:Match,p:Footballer)=>Math.hypot((direction(m,p.team)>0?105:0)-p.x,34-p.y);
export function passTargets(m:Match){const p=m.ball.owner===null?null:m.players[m.ball.owner];return p?m.players.filter(q=>q.team===p.team&&q.id!==p.id&&active(q)):[];}
export function offside(m:Match,q:Footballer){
 const p=m.ball.owner===null?null:m.players[m.ball.owner];if(!p)return false;
 const d=direction(m,p.team),line=m.players.filter(o=>o.team!==p.team&&active(o)).map(o=>o.x*d).sort((a,b)=>b-a)[1]??105;
 return q.x*d>p.x*d&&q.x*d>line&&q.x*d>52.5*d;
}
// ── 0.10 crosses, cut-backs, headers and volleys ─────────────────────────
const lineDist=(m:Match,team:number,x:number)=>Math.abs((direction(m,team)>0?105:0)-x);
export function throughEligible(m:Match,p:Footballer,q:Footballer){
 const d=direction(m,p.team);return q.id!==p.id&&q.team===p.team&&active(q)&&q.pos!=='GK'&&!offside(m,q)&&(q.x-p.x)*d>-8&&distance(p,q)<48&&lineDist(m,p.team,q.x)>5;
}
/** Space pass preview: deterministic candidate search, no new attribute and no random draws. */
export function throughPlan(m:Match,p:Footballer,q:Footballer){
 const d=direction(m,p.team),speed=(r:Footballer)=>(2.6+r.a.speed/32)*(.55+r.energy/222)*1.65;
 const defenders=m.players.filter(o=>o.team!==p.team&&active(o));
 const read=(p.a.vision*.4+p.a.decisions*.3+p.a.anticipation*.3)/100;
 let best={aim:{x:q.x,y:q.y},duration:1,margin:-9,score:-Infinity};
 for(const lead of [4,7,10])for(const lateral of [-3,0,3]){
  const aim={x:clamp(q.x+d*lead,2,103),y:clamp(q.y+lateral,2,66)},length=distance(p,aim);
  const duration=Math.max(.65,length/14),run=distance(q,aim)/speed(q)+(1-q.a.positioning/100)*.2;
  const enemy=Math.min(...defenders.map(o=>distance(o,aim)/speed(o)+(1-o.a.anticipation/100)*.2));
  const margin=enemy-run,space=Math.min(...defenders.map(o=>distance(o,aim)));
  const score=margin*(.5+read)+space*.04-Math.max(0,run-duration)*2-Math.abs(lateral)*.03;
  if(score>best.score)best={aim,duration,margin,score};
 }
 const allowed=throughEligible(m,p,q);
 const reason=offside(m,q)?'오프사이드 위치':!allowed?'침투 공간 부족':best.margin>.25?'동료의 침투 우위':best.margin<-.3?'상대의 선점 위험':'동료와 수비의 경합';
 return {...best,allowed,reason,read};
}
/** Teammates in the box who can attack a cross (not offside). */
export function boxMates(m:Match,p:Footballer){return m.players.filter(q=>q.team===p.team&&q.id!==p.id&&active(q)&&q.pos!=='GK'&&lineDist(m,p.team,q.x)<=16.5&&Math.abs(q.y-34)<=16&&!offside(m,q));}
/** Teammates arriving at the penalty spot / edge of the box for a cut-back. */
export function cutbackMates(m:Match,p:Footballer){return m.players.filter(q=>q.team===p.team&&q.id!==p.id&&active(q)&&q.pos!=='GK'&&lineDist(m,p.team,q.x)>=6&&lineDist(m,p.team,q.x)<=20&&Math.abs(q.y-34)<=13&&!offside(m,q));}
const markers=(m:Match,q:Footballer,r:number)=>m.players.filter(o=>o.team!==q.team&&active(o)&&distance(o,q)<=r).length;
/** Best aerial target: strength, positioning and finishing, minus tight markers. */
export function crossTarget(m:Match,p:Footballer){return boxMates(m,p).map(q=>({q,s:q.a.strength*.4+q.a.positioning*.3+q.a.finishing*.3-12*markers(m,q,2.5)})).sort((a,b)=>b.s-a.s)[0]?.q;}
export function cutbackTarget(m:Match,p:Footballer){return cutbackMates(m,p).map(q=>({q,s:q.a.finishing*.5+q.a.shooting*.3-10*markers(m,q,3)-Math.abs(q.y-34)*.5})).sort((a,b)=>b.s-a.s)[0]?.q;}
/** Cross delivery and finishing tuning (balance.test keeps goals/shots in range). */
export const CROSS={base:.40,skill:.32,marker:.06,wide:13,range:40,header:{base:.06,skill:.34},volley:{base:.05,skill:.36},reach:18} as const;
export function attackAllowed(m:Match,a:Action,opts:AttackOptions={}){
 const p=m.ball.owner===null?null:m.players[m.ball.owner];if(!p||!active(p)||m.ended)return false;
 const r=goalDistance(m,p),aerial=!!m.aerial&&m.aerial.to===p.id&&m.clock<=m.aerial.until;
 if(a==='header'||a==='volley')return aerial&&r<=CROSS.reach;
 // A ball dropping from a cross is struck, laid off or controlled for a quick shot — no dribbling or long shots.
 if(aerial&&!['closeShot','pass','safe','forward','through'].includes(a))return false;
 if(a==='cross')return Math.abs(p.y-34)>=CROSS.wide&&lineDist(m,p.team,p.x)<=CROSS.range&&(opts.targetId!==undefined?boxMates(m,p).some(q=>q.id===opts.targetId):boxMates(m,p).length>0);
 if(a==='cutback')return lineDist(m,p.team,p.x)<=13&&Math.abs(p.y-34)>=7&&Math.abs(p.y-34)<=24&&cutbackMates(m,p).length>0;
 if(a==='closeShot')return r<=22;
 if(a==='longShot')return r>=16.5&&r<=55;
 if(a==='curl')return r>=12&&r<=28;
 if(a==='shoot')return r<=55;
 if(a==='through')return opts.targetId===undefined?passTargets(m).some(q=>throughEligible(m,p,q)):passTargets(m).some(q=>q.id===opts.targetId&&throughEligible(m,p,q));
 if(a==='pass'||a==='safe'||a==='forward')return opts.targetId===undefined?passTargets(m).length>0:passTargets(m).some(q=>q.id===opts.targetId&&!offside(m,q));
 if(a==='dribble'&&opts.vector)return Number.isFinite(opts.vector.x)&&Number.isFinite(opts.vector.y)&&Math.hypot(opts.vector.x,opts.vector.y)>0;
 return a==='dribble'||a==='hold';
}
/** Share of long-pass skill in a pass of this length (0 = short-pass skill only, 1 = long-pass skill only). */
export const longPassWeight=(d:number)=>clamp((d-8)/32,0,1);
/**
 * 깨달음 targets for a pass: the skill that decides this pass, in the same proportion as the success
 * formula (short ≤ 8 m: 짧은 패스, ≥ 40 m: 긴 패스, between: mixed), plus 예측력 (one third, as before).
 * Built as six equally likely slots so the engine still draws exactly one random number.
 */
export function passInsightKeys(d:number):Attr[]{
 const long=Math.round(4*longPassWeight(d));
 return [...Array(4-long).fill('passing'),...Array(long).fill('longPassing'),'anticipation','anticipation'] as Attr[];
}
export function attackKeys(a:Action):Attr[]{
 if(a==='header')return ['strength','finishing'];
 if(a==='volley')return ['finishing','control'];
 if(a==='cross')return ['curve','longPassing'];
 if(a==='cutback')return ['passing','vision'];
 if(a==='longShot')return ['longShot','finishing'];
 if(a==='curl')return ['curve','finishing'];
 if(a==='shoot'||a==='closeShot')return ['shooting','finishing'];
 if(a==='dribble')return ['dribbling','speed','anticipation'];
 if(a==='hold')return ['strength']; // only strength decides a hold
 return ['passing','longPassing','anticipation'];
}
/** Unpressured shot envelope: low attributes 5–15%, max long shot 10–35%. */
export function baseShotChance(m:Match,p:Footballer,a:Action){
 const r=goalDistance(m,p),kind=a==='shoot'?(r<=22?'closeShot':'longShot'):a;
 const quality=(kind==='curl'?.7*p.a.curve+.3*p.a.finishing: .55*p.a[kind==='longShot'?'longShot':'shooting']+.45*p.a.finishing)/100;
 const progress=kind==='closeShot'?clamp((22-r)/21,0,1):clamp((52.5-r)/36,0,1);
 const low=.05+.10*progress,high=kind==='closeShot'?ODDS.close.high+ODDS.close.slope*progress:.10+.25*progress;
 const angle=clamp(1-Math.abs(34-p.y)/60,.45,1);
 return (low+(high-low)*quality)*angle;
}
/** How strongly the nearest outfield defender stands in the shooting lane from (x, y) to goal (0 = open, 1 = fully blocked). */
export function shotBlockAt(m:Match,team:number,x:number,y:number){
 const dx=(direction(m,team)>0?105:0)-x,dy=34-y,l=dx*dx+dy*dy||1;
 let block=0;
 for(const o of m.players){
   if(o.team===team||o.pos==='GK'||!active(o))continue;
   const t=((o.x-x)*dx+(o.y-y)*dy)/l;
   if(t>.08&&t<.95)block=Math.max(block,clamp(1-Math.hypot(o.x-x-t*dx,o.y-y-t*dy)/3,0,1));
 }
 return block;
}
/** Pass success tuning (0.7.1). Exact engine probabilities; the UI shows the same numbers. */
export const PASS={base:.74,skill:.22,anticipation:.03,shortRange:12,perMetre:.006,forward:.03,forwardMetres:8,through:.12,crowd:.04,pressure:.08} as const;
// ── 0.11 matchup odds ────────────────────────────────────────────────────
/**
 * One model for the screen, the actual roll and the AI (attackOdds / defenseOdds are pure: no RNG).
 * - Interference: each opponent hinders an action by proximity × direction relative to where the action goes
 *   (front > side > behind, smooth in distance and angle). The main hinderer counts fully, the next ones less (cover).
 * - Ability: the gap between my action skill and that opponent's matching skill goes through a logistic `edge`
 *   (−1…1), so a small advantage changes the odds a little and a large one a lot; dribble and tackle use the same edge.
 * - Dribble / pass / cross: additive penalties in probability points (base − Σ). Shots, headers, volleys:
 *   multiplicative (base × (1 − pressure) × keeper), so pressure from weak defenders never makes a long shot likely.
 * - Each opponent is counted once per action (passes take the larger of his pressure on the passer and his lane threat).
 */
export const ODDS={
 edgeScale:25,
 reachFront:8,reachSide:6,dirFloor:.2,dirPow:1.3,cover:[1,.7,.45,.3],gkReach:3,closeBlend:3,
 // 0.12 a dribble fails in two ways: a loose touch (no opponent needed) or a defender winning the ball.
 dribble:{touch:.93,touchSkill:.065,touchTired:.05,block:.8,edgeShare:.75},
 // 0.14 beginners: a low absolute dribbling skill (dribbleSkill ≤ 50) loses 10% of the success chance, fading out by 70.
 lowSkill:{full:50,none:70,cut:.1},
 // 0.12 치고 달리기: a longer, looser touch; its duel is a sprint (pace), the path reaches farther.
 run:{touch:.84,touchSkill:.1,touchTired:.08,block:.72,paceShare:.85,skillShare:.2,reach:1.45,energy:3},
 // 0.12 pace race per hinderer: how much a pace gap shrinks (faster) or grows (slower) his interference,
 // scaled by where he stands — a chaser from behind most, a defender right in the path least.
 pace:{faster:.7,slower:1,behind:1,side:.7,frontNear:.2,frontFar:.45,frontFarAt:8,tackle:.12,defend:.08},
 advance:{dribbleMin:3,dribbleMax:7,runMin:8,runMax:10,
  // 0.14 farther carries: a contested dribble ×2.5, an open one ×5 (smoothly by the space ahead); an open
  // 치고 달리기 goes 1.3× an open dribble (never less than 2.5× its old 8–10 m). A carry stops early when an
  // opponent who is not chasing from behind comes within stopRadius (after the old distance is covered).
  contested:2.5,open:5,runOverDribble:1.3,stopRadius:6},
 // 0.14 a defender just beaten by a dribble hinders the dribbler's next choice 70% less.
 beaten:{factor:.3,minI:.12},
 passer:{block:.2,edgeShare:.6},
 lane:{reach:2.5,reachRead:1.5,base:.13,skill:.24},
 // 0.13 keeper: close in he barely reacts (from 5 m), farther out he sees it coming (+3%/m, up to 62%).
 shot:{press:1.2,edgeShare:.6,gkFrom:5,gkPerMetre:.03,gkMax:.62,gk:.24,pressMax:.9,block:.6,aerialSave:.33},
 // 0.13 close-range envelope ceiling (an unpressured close shot): high = closeHigh + closeSlope × progress.
 close:{high:.2,slope:.7},
 hold:{block:.3,edgeShare:.6},
 tackle:{base:.40,skill:.12,edge:.26},slide:{base:.20,skill:.12,edge:.22},press:{base:.55,skill:.10,edge:.18},
} as const;
const smooth01=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
/** Ability edge in −1…1 for a gap of `delta` rating points (logistic; ±25 → ±0.46, ±50 → ±0.76). */
export const edge=(delta:number)=>2/(1+Math.exp(-delta/ODDS.edgeScale))-1;
export type Interference={o:Footballer,i:number,where:'front'|'side'|'behind',dist:number,cos:number};
/** How strongly each opponent hinders an action by `p` heading along (ux, uy), strongest first. */
export function interferers(m:Match,p:Footballer,ux:number,uy:number,reachScale=1):Interference[]{
 const len=Math.hypot(ux,uy)||1;ux/=len;uy/=len;const out:Interference[]=[];
 for(const o of m.players){
  if(o.team===p.team||!active(o))continue;
  const dx=o.x-p.x,dy=o.y-p.y,d=Math.hypot(dx,dy)||.01;
  if(o.pos==='GK'&&d>ODDS.gkReach)continue; // a keeper only counts when he comes to challenge
  const cos=(dx*ux+dy*uy)/d,reach=(ODDS.reachSide+(ODDS.reachFront-ODDS.reachSide)*Math.max(0,cos))*reachScale;
  const prox=smooth01(1-d/reach);if(prox<=0)continue;
  // Right next to the player the direction is ill-defined: blend towards the side weight so passing by is smooth.
  const raw=ODDS.dirFloor+(1-ODDS.dirFloor)*Math.pow((1+cos)/2,ODDS.dirPow),sideW=ODDS.dirFloor+(1-ODDS.dirFloor)*Math.pow(.5,ODDS.dirPow);
  const dir=sideW+(raw-sideW)*smooth01(d/ODDS.closeBlend);
  out.push({o,i:prox*dir*beatenFactor(m,p,o),where:cos>.5?'front':cos>-.5?'side':'behind',dist:d,cos});
 }
 return out.sort((a,b)=>b.i-a.i);
}
/** 0.14 1 for most opponents; ODDS.beaten.factor for one the ball carrier has just dribbled past. */
export function beatenFactor(m:Match,p:Footballer,o:Footballer){return m.dribbleBeat&&m.dribbleBeat.by===p.id&&m.dribbleBeat.ids.includes(o.id)?ODDS.beaten.factor:1;}
/** Σ cover[k] × value_k over the strongest contributions (each opponent once). */
const covered=(values:number[])=>values.sort((a,b)=>b-a).slice(0,ODDS.cover.length).reduce((n,v,k)=>n+v*ODDS.cover[k],0);
export const dribbleSkill=(p:Footballer)=>p.a.dribbling*.6+p.a.speed*.15+p.a.acceleration*.1+p.a.anticipation*.15;
export const dribbleStop=(o:Footballer)=>o.a.marking*.4+o.a.defending*.35+o.a.strength*.15+o.a.speed*.1;
export const pressSkill=(o:Footballer)=>o.a.marking*.5+o.a.anticipation*.3+o.a.defending*.2;
export const laneRead=(o:Footballer)=>o.a.anticipation*.4+o.a.positioning*.35+o.a.defending*.25;
export const ballCarry=(o:Footballer)=>o.a.control*.45+o.a.dribbling*.4+o.a.strength*.15;
export const keeperQuality=(g:Footballer)=>(g.a.positioning*.4+g.a.anticipation*.35+g.a.composure*.25)/100;
/** 0.12 sprint pace: top speed and acceleration, worn down by fatigue. */
export const paceOf=(p:Footballer)=>(p.a.speed*.6+p.a.acceleration*.4)*(.85+.15*clamp(p.energy,0,100)/100);
/** How much a pace gap matters against an opponent at this angle (cos of his bearing vs. the run) and distance. */
export function paceWeight(cos:number,d:number,run=false){
 const P=ODDS.pace,front=run?P.frontNear:P.frontNear+(P.frontFar-P.frontNear)*smooth01((d-2)/(P.frontFarAt-2));
 const side=run?1:P.side;
 return cos<=0?side+(P.behind-side)*(-cos):side+(front-side)*cos;
}
/** Interference after the pace race: faster → smaller, slower → larger (never above 1). */
export function paced(x:Interference,myPace:number,run=false){
 const e=edge(myPace-paceOf(x.o)),w=paceWeight(x.cos,x.dist,run);
 return {e,i:Math.min(1,x.i*(1-(e>0?ODDS.pace.faster:ODDS.pace.slower)*e*w))};
}
/** Clean-touch chance of a dribble (or a knock-on) — the part no defender is needed for. */
export function touchChance(p:Footballer,run=false){
 const k=run?ODDS.run:ODDS.dribble,skill=run?p.a.control*.3+p.a.dribbling*.3+p.a.speed*.4:p.a.control*.5+p.a.dribbling*.5;
 return clamp(k.touch+k.touchSkill*skill/100-k.touchTired*(1-clamp(p.energy,0,100)/100),.5,.995);
}
/** Metres gained by a successful dribble (3–7 m by space ahead and pace) or 치고 달리기 (8–10 m by pace). */
export function dribbleBase(m:Match,p:Footballer,vector:{x:number,y:number},run=false){
 const A=ODDS.advance,paceN=clamp((paceOf(p)-40)/50,0,1);
 if(run)return {metres:A.runMin+(A.runMax-A.runMin)*paceN,space:dribbleSpace(m,p,vector)};
 const space=dribbleSpace(m,p,vector);
 return {metres:A.dribbleMin+(A.dribbleMax-A.dribbleMin)*(space*.5+paceN*.5),space};
}
/** 1 = nobody ahead in the chosen direction, 0 = fully blocked. */
export function dribbleSpace(m:Match,p:Footballer,vector:{x:number,y:number}){
 const ahead=interferers(m,p,vector.x,vector.y).filter(x=>x.cos>0).reduce((n,x)=>n+x.i,0);return 1-clamp(ahead,0,1);
}
/** Planned metres of a successful dribble / 치고 달리기 (before an opponent may stop the carry early). */
export function dribbleAdvance(m:Match,p:Footballer,vector:{x:number,y:number},run=false){
 const A=ODDS.advance,d=dribbleBase(m,p,vector,false),dribble=d.metres*(A.contested+(A.open-A.contested)*d.space);
 if(!run)return dribble;
 return Math.max(dribbleBase(m,p,vector,true).metres*A.contested,dribble*A.runOverDribble);
}
/** Metres always gained before the stop rule applies (the pre-0.14 distance). */
export const dribbleMinimum=(m:Match,p:Footballer,vector:{x:number,y:number},run=false)=>dribbleBase(m,p,vector,run).metres;
/** True when `o` stops a carry at `at` heading along (ux, uy): an opponent within stopRadius ahead in the path (not a chaser) and not just beaten. */
export function stopsCarry(m:Match,p:Footballer,o:Footballer,at:{x:number,y:number},ux:number,uy:number){
 if(o.team===p.team||!active(o))return false;
 if(m.dribbleBeat?.by===p.id&&m.dribbleBeat.ids.includes(o.id))return false;
 const dx=o.x-at.x,dy=o.y-at.y,d=Math.hypot(dx,dy);if(d>ODDS.advance.stopRadius)return false;
 // In the path means ahead of the carrier (cos > 0.2); anyone level or behind is a chaser and never stops it.
 const l=Math.hypot(ux,uy)||1;return d>.5&&(dx*ux+dy*uy)/(l*d)>.2;
}
/** The defenders a dribble along `vector` goes at (beaten on success): in front or beside, clearly in the way. */
export function dribbleTargets(m:Match,p:Footballer,vector:{x:number,y:number}){
 return interferers(m,p,vector.x,vector.y).filter(x=>x.where!=='behind'&&x.i>=ODDS.beaten.minI).map(x=>x.o.id);
}
/** Pace gap (−1…1 edge) between two players, weighted by where `chaser` stands relative to `runner`'s heading. */
export function paceDuel(m:Match,runner:Footballer,chaser:Footballer){
 const d=direction(m,runner.team),dx=chaser.x-runner.x,dy=chaser.y-runner.y,dd=Math.hypot(dx,dy)||.01;
 return edge(paceOf(runner)-paceOf(chaser))*paceWeight(dx*d/dd,dd);
}
const opponentKeeper=(m:Match,p:Footballer)=>m.players.find(q=>q.team!==p.team&&q.pos==='GK'&&active(q));
/** Lane threat of one opponent on a pass from p to aim (0 when he is not between them). */
function laneThreat(o:Footballer,p:Footballer,aim:{x:number,y:number},skill:number){
 const dx=aim.x-p.x,dy=aim.y-p.y,l=dx*dx+dy*dy||1,t=((o.x-p.x)*dx+(o.y-p.y)*dy)/l;
 if(t<=.05||t>=.97)return 0;
 const h=Math.hypot(o.x-p.x-t*dx,o.y-p.y-t*dy),reach=ODDS.lane.reach+ODDS.lane.reachRead*o.a.anticipation/100;
 return smooth01(1-h/reach)*(ODDS.lane.base+ODDS.lane.skill*(1+edge(laneRead(o)-skill))/2);
}
export type Odds={p:number,why:string[]};
const why=(list:[number,string][])=>list.filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]).slice(0,2).map(x=>x[1]);
/** Words for where the main hinderer stands (or the open space). */
function placeWhy(list:Interference[]):[number,string][]{
 const top=list[0];if(!top)return [[.3,'주변 공간 여유']];
 if(top.where==='front'&&top.i>.3)return [[top.i,'정면 수비 견제']];
 if(top.where==='side'&&top.i>.2)return [[top.i*.9,'측면 견제']];
 if(top.where==='behind')return [[.25,'뒤쪽 압박 약함']];
 return top.i<.15?[[.2,'압박 약함']]:[];
}
export function attackOdds(m:Match,a:Action,opts:AttackOptions={}):Odds{
 if(!attackAllowed(m,a,opts))return {p:0,why:[]};
 const p=m.players[m.ball.owner!],d=direction(m,p.team),goal={x:d>0?105:0,y:34};
 const passing=['pass','safe','forward','through','cross','cutback'].includes(a);
 const reasons:[number,string][]=[];
 let base=0,pen=0,mult=1,energyless=false;
 const shotLike=(r:number,b:number)=>{
   // Shots: distance/angle/skill base, lane block, then pressure and the keeper as multipliers.
   const list=interferers(m,p,goal.x-p.x,goal.y-p.y),skill=p.a.composure*.5+p.a.finishing*.3+p.a.strength*.2;
   const press=Math.min(ODDS.shot.pressMax,covered(list.map(x=>x.i*ODDS.shot.press*(1-ODDS.shot.edgeShare*edge(skill-pressSkill(x.o))))));
   const block=shotBlockAt(m,p.team,p.x,p.y),g=opponentKeeper(m,p),gq=g?keeperQuality(g):.5;
   // The keeper: an average one saves more the farther out the shot is (0 at 5 m, +3%/m, up to gkMax).
   // Headers and volleys off a cross carry less power and placement: the keeper keeps at least the 0.11 close save.
   const save=Math.max(a==='header'||a==='volley'?ODDS.shot.aerialSave:0,Math.min(ODDS.shot.gkMax,ODDS.shot.gkPerMetre*Math.max(0,r-ODDS.shot.gkFrom)));
   mult=(1-press)*(1-ODDS.shot.block*block)*(1-save+ODDS.shot.gk*(.5-gq));
   reasons.push([r>25?.6:0,'먼 거리'],[r<10?.5:0,'골문 가까움'],[clamp(1-Math.abs(34-p.y)/60,.45,1)<.62?.45:0,'각도 좁음'],[block>.35?block:0,'슈팅 경로 차단'],[press>.12?press+.1:0,'주변 압박'],[gq>.7?.3:gq<.35?.3:0,gq>.7?'골키퍼 강함':'골키퍼 약함']);
   return b;
 };
 if(a==='header'||a==='volley'){
   const r=goalDistance(m,p),k=a==='header'?CROSS.header:CROSS.volley;
   const q=a==='header'?(p.a.strength*.45+p.a.finishing*.35+p.a.positioning*.2)/100:(p.a.finishing*.6+p.a.control*.4)/100;
   base=shotLike(r,(k.base+k.skill*q)*clamp((CROSS.reach-r)/12,.25,1)*clamp(1-Math.abs(34-p.y)/60,.45,1));
 }
 else if(['shoot','closeShot','longShot','curl'].includes(a))base=shotLike(goalDistance(m,p),baseShotChance(m,p,a));
 else if(a==='dribble'||a==='hold'){
   const v=opts.vector??{x:d,y:0},run=a==='dribble'&&!!opts.run,list=interferers(m,p,v.x,v.y,run?ODDS.run.reach:1);
   if(a==='dribble'){
     // 0.12 success = clean touch × not dispossessed. With nobody in the chosen path only the touch can fail.
     const skill=dribbleSkill(p),myPace=paceOf(p),touch=touchChance(p,run);
     const parts=list.map(x=>{const r=paced(x,myPace,run),e=run?edge(myPace-paceOf(x.o))*paceWeight(x.cos,x.dist,true)*ODDS.run.paceShare+edge(skill-dribbleStop(x.o))*ODDS.run.skillShare:edge(skill-dribbleStop(x.o));
       return {x,pe:r.e,e,v:r.i*(run?ODDS.run.block:ODDS.dribble.block)*(1-(run?1:ODDS.dribble.edgeShare)*clamp(e,-1,1))};});
     const steal=clamp(covered(parts.map(x=>x.v)),0,1);
     const L=ODDS.lowSkill,low=clamp((L.none-skill)/(L.none-L.full),0,1);
     base=touch*(1-steal)*(1-L.cut*low);energyless=true;
     if(low>.5)reasons.push([.3,'드리블 기술 미숙']);
     const top=parts[0];
     if(top&&top.x.i>.12){
       if(!run)reasons.push([Math.abs(top.e)>.15?.7:0,top.e>0?'돌파 능력 우세':'돌파 능력 열세']);
       reasons.push([Math.abs(top.pe)>.15&&top.x.where!=='front'?.75:Math.abs(top.pe)>.3?.5:0,top.pe>0?'속도 우위':'속도 열세']);
     }
     const open=!top||top.x.i<.05;
     if(open)reasons.push([.8,'진행 방향 공간 열림'],[!run&&touch<.93?.6:0,'볼 터치 불안']);
     else reasons.push(...placeWhy(list));
     if(run&&open)reasons.push([.4,'긴 터치 위험']);
   }else{
     base=.55+.35*p.a.strength/100;
     pen=covered(list.map(x=>x.i*ODDS.hold.block*(1-ODDS.hold.edgeShare*edge(p.a.strength-x.o.a.strength))));
     reasons.push(...placeWhy(list));
   }
 }
 else{
   const target=m.players.find(q=>q.id===opts.targetId)??(a==='cross'?crossTarget(m,p):a==='cutback'?cutbackTarget(m,p):undefined);
   if(!target||target.team!==p.team||target.id===p.id||!active(target))return {p:0,why:[]};
   const plan=a==='through'?throughPlan(m,p,target):undefined;
   const aim=plan?.aim??(a==='pass'||a==='cross'||a==='cutback'?target:runPoint(m,target)),intoSpace=a==='through';
   const dist=distance(p,aim),longWeight=longPassWeight(dist),skill=p.a.passing*(1-longWeight)+p.a.longPassing*longWeight;
   if(a==='cross'){
     base=CROSS.base+CROSS.skill*(p.a.curve*.45+p.a.longPassing*.35+p.a.vision*.2)/100-Math.min(.18,markers(m,target,3)*CROSS.marker);
     reasons.push([markers(m,target,3)?.5:.3,markers(m,target,3)?'타깃 견제':'노마크 타깃']);
   }else{
     // 0.7.1 pass base: an unpressured short pass is safe; length, a forward or through ball lower it.
     base=PASS.base+PASS.skill*skill/100+PASS.anticipation*p.a.anticipation/100-Math.max(0,dist-PASS.shortRange)*PASS.perMetre;
     if(plan){base+=(plan.read-.5)*.10;reasons.push([.8,plan.reason]);}
     const ahead=(aim.x-p.x)*d;
     if(a!=='cutback')base-=a==='through'||intoSpace?PASS.through:a==='forward'||(a==='pass'&&ahead>PASS.forwardMetres)?PASS.forward:0;
     else base-=Math.min(.2,markers(m,target,3)*.07);
     reasons.push([dist>30?.55:0,'먼 거리'],[intoSpace?.4:0,'뒷공간 패스'],[dist<=PASS.shortRange?.25:0,'짧은 거리']);
   }
   // Each opponent once: the larger of his pressure on the passer and his threat to the lane.
   const near=interferers(m,p,aim.x-p.x,aim.y-p.y),threats:number[]=[];let laneMax=0,pressMax=0;
   for(const o of m.players){
     if(o.team===p.team||!active(o)||o.pos==='GK')continue;
     const lane=a==='cross'?0:laneThreat(o,p,aim,skill)*beatenFactor(m,p,o),hit=near.find(x=>x.o===o),press=hit?hit.i*ODDS.passer.block*(1-ODDS.passer.edgeShare*edge(skill-pressSkill(o))):0;
     laneMax=Math.max(laneMax,lane);pressMax=Math.max(pressMax,press);threats.push(Math.max(lane,press));
   }
   pen=covered(threats);
   reasons.push([laneMax>.08?laneMax*3:0,'패스 길 차단'],[pressMax>.05?pressMax*3:0,'패스 전 압박']);
 }
 // 0.14 the reward for a dribble past a defender is visible on every option until the next choice.
 if(m.dribbleBeat?.by===p.id&&m.dribbleBeat.ids.length)reasons.push([.85,'제친 수비수 영향 −70%']);
 const boost=m.beatenBoost?.to===p.id&&m.clock<=m.beatenBoost.until?m.beatenBoost.amount:0;
 const playmaker=m.assistBoost?.to===p.id?m.assistBoost.mult:1;
 // 0.9 시그니처 (user only): a small multiplier on the action's base chance.
 const sig=p.fx?.signature?.[passing?'pass':a as SignatureAction]??0;
 // A dribble already carries fatigue in its touch and pace (0.12); other actions keep the energy factor.
 return {p:clamp(base*mult*(1+sig)*(energyless?1:.8+p.energy/500)*playmaker-pen+boost,0,.99),why:why(reasons)};
}
export function attackChance(m:Match,a:Action,opts:AttackOptions={}){return attackOdds(m,a,opts).p;}
/** Tackle duel shared by the user's 스탠딩 태클 and the AI's challenges (same edge as a dribble). */
export const tackleEdge=(def:Footballer,att:Footballer)=>edge(def.a.defending*.75+def.a.strength*.25-ballCarry(att));
export function defenseOdds(m:Match,a:DefenseAction,predicted=false):Odds{
 const u=m.players[m.userId],o=m.ball.owner===null?null:m.players[m.ball.owner];
 if(!o||o.team===u.team||!active(u)||distance(u,o)>6)return {p:0,why:[]};
 if(a==='predict'){const p=(defenseOdds(m,'tackle',true).p+defenseOdds(m,'slide',true).p+defenseOdds(m,'press',true).p)/3;return {p,why:['세 수비 중 무작위','예측력 보너스']};}
 const gap=distance(u,o),k=a==='slide'?ODDS.slide:a==='press'?ODDS.press:ODDS.tackle;
 const skill=a==='slide'?u.a.sliding:a==='press'?u.a.marking:u.a.defending;
 const e=a==='slide'?edge(u.a.sliding*.75+u.a.strength*.25-ballCarry(o)):a==='press'?edge(u.a.marking*.6+u.a.anticipation*.25+u.a.speed*.15-ballCarry(o)):tackleEdge(u,o);
 // 0.12 tackle / press: a pace race against the carrier (strongest when chasing from behind); a slide is a lunge.
 const pace=a==='slide'?0:-paceDuel(m,o,u);
 const base=k.base+k.skill*skill/100+.10*u.a.strength/100-(a==='press'?gap*.018:a==='tackle'?gap*.035:0)+k.edge*e+ODDS.pace.defend*pace;
 const sig=u.fx?.signature?.[a as SignatureAction]??0;
 const reasons:[number,string][]=[[Math.abs(e)>.15?.7:0,e>0?'수비 능력 우세':'수비 능력 열세'],[a!=='slide'&&gap>3.5?.5:0,'거리 멂'],[a!=='slide'&&gap<2?.4:0,'바짝 붙음'],[Math.abs(pace)>.2?.6:0,pace>0?'속도 우위':'속도 열세']];
 return {p:clamp(base*(1+sig)*(.8+u.energy/500)+(predicted?u.a.anticipation/100*.10:0),.02,.95),why:why(reasons)};
}
export function defenseChance(m:Match,a:DefenseAction,predicted=false):number{return defenseOdds(m,a,predicted).p;}
export function matchCommentary(m:Match){
 const u=m.players[m.userId],o=m.ball.owner===null?null:m.players[m.ball.owner];
 if(m.ended)return '경기 종료 휘슬! 선수들이 오늘의 승부를 마무리합니다.';
 if(m.defending&&o)return `골문 ${goalDistance(m,o).toFixed(0)}m 앞, ${o.name}의 앞을 가로막는 ${u.name}. 어떻게 대응할까요?`;
 if(m.decision&&m.aerial?.to===u.id)return `${u.name}에게 크로스가 날아옵니다! 헤더로 돌려놓을까요, 발리로 때릴까요?`;
 if(m.decision&&m.setPiece==='corner')return `코너킥 키커는 ${u.name}! 박스 안 동료에게 크로스를 올리세요.`;
 if(m.decision){
   const zone=goalDistance(m,u)<22?'페널티 박스 근처':goalDistance(m,u)>45?'중원':'상대 진영';
   const from=m.lastPass?.to===u.id?m.players[m.lastPass.from].name:null;
   const count=nearbyOpponents(m,u).count;
   return `${zone}에서 ${from?`${from}의 패스를 받은 `:''}${u.name}! ${count>=2?'수비가 에워쌉니다. 빠른 판단이 필요합니다.':count?'상대 수비와 마주합니다.':'앞에 공간이 열렸습니다.'}`;
 }
 return tacticalNote(m)||m.occasion||m.log.at(-1)?.text||'선수들이 전술 대형을 정비하며 기회를 살핍니다.';
}

/** 0.8: in-game probabilities are shown as words, never as numbers. */
export const CHANCE_BANDS=[{max:.2,label:'매우 낮은 확률'},{max:.4,label:'낮은 확률'},{max:.6,label:'중간 확률'},{max:.8,label:'높은 확률'},{max:Infinity,label:'매우 높은 확률'}] as const;
/** Band index 0 (매우 낮은) … 4 (매우 높은) for a probability 0–1. */
export const chanceLevel=(p:number)=>CHANCE_BANDS.findIndex(b=>p<b.max);
export const chanceLabel=(p:number)=>CHANCE_BANDS[chanceLevel(p)].label;

