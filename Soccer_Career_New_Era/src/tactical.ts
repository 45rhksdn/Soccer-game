/** Pure action rules. Percentages shown by the UI are the exact engine probabilities. */
import {clamp,direction,type Match,type Footballer,type Action,type Attr,type DefenseAction} from './engine';
export type AttackOptions={targetId?:number;vector?:{x:number;y:number}};
export const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const active=(p:Footballer)=>!p.red&&!p.injured;
export function nearbyOpponents(m:Match,p:Footballer){
 const opponents=m.players.filter(q=>q.team!==p.team&&active(q)).sort((a,b)=>distance(a,p)-distance(b,p));
 return {nearest:opponents[0],distance:opponents[0]?distance(p,opponents[0]):Infinity,count:opponents.filter(q=>distance(p,q)<=6).length};
}
export const goalDistance=(m:Match,p:Footballer)=>Math.hypot((direction(m,p.team)>0?105:0)-p.x,34-p.y);
export function passTargets(m:Match){const p=m.ball.owner===null?null:m.players[m.ball.owner];return p?m.players.filter(q=>q.team===p.team&&q.id!==p.id&&active(q)):[];}
export function offside(m:Match,q:Footballer){
 const p=m.ball.owner===null?null:m.players[m.ball.owner];if(!p)return false;
 const d=direction(m,p.team),line=m.players.filter(o=>o.team!==p.team&&active(o)).map(o=>o.x*d).sort((a,b)=>b-a)[1]??105;
 return q.x*d>p.x*d&&q.x*d>line&&q.x*d>52.5*d;
}
export function attackAllowed(m:Match,a:Action,opts:AttackOptions={}){
 const p=m.ball.owner===null?null:m.players[m.ball.owner];if(!p||!active(p)||m.ended)return false;
 const r=goalDistance(m,p);
 if(a==='closeShot')return r<=22;
 if(a==='longShot')return r>=16.5&&r<=55;
 if(a==='curl')return r>=12&&r<=28;
 if(a==='shoot')return r<=55;
 if(a==='pass'||a==='safe'||a==='forward'||a==='through')return opts.targetId===undefined?passTargets(m).length>0:passTargets(m).some(q=>q.id===opts.targetId&&!offside(m,q));
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
 const low=.05+.10*progress,high=kind==='closeShot'?.15+.60*progress:.10+.25*progress;
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
export function attackChance(m:Match,a:Action,opts:AttackOptions={}){
 if(!attackAllowed(m,a,opts))return 0;
 const p=m.players[m.ball.owner!],near=nearbyOpponents(m,p),q=near.nearest;
 const proximity=q?clamp(1-near.distance/6,0,1):0;
 const opponent=q?(q.a.marking*.45+q.a.defending*.35+q.a.anticipation*.20)/100:0;
 // Separate crowd penalty (5 points each) from distance/quality pressure (up to 12 points).
 const passing=['pass','safe','forward','through'].includes(a);
 // Passes feel pressure less than shots and dribbles (the ball leaves the foot first).
 const penalty=passing?near.count*PASS.crowd+proximity*opponent*PASS.pressure:near.count*.05+proximity*opponent*.12;
 let base=0;
 if(['shoot','closeShot','longShot','curl'].includes(a)){
   base=baseShotChance(m,p,a);
   // A defender farther than the close-pressure radius can still block the shot.
   base*=1-.4*shotBlockAt(m,p.team,p.x,p.y);
 }
 else if(a==='dribble'){
   base=.35+.49*Math.pow(p.a.dribbling/100,1.4)+.07*p.a.speed/100+.07*p.a.anticipation/100;
   const v=opts.vector??{x:direction(m,p.team),y:0},len=Math.hypot(v.x,v.y)||1,dx=v.x/len*4,dy=v.y/len*4;
   if(m.players.some(o=>{if(o.team===p.team||!active(o))return false;const t=clamp(((o.x-p.x)*dx+(o.y-p.y)*dy)/16,0,1);return Math.hypot(o.x-p.x-dx*t,o.y-p.y-dy*t)<=1;}))base-=.20;
 }else if(a==='hold')base=.55+.35*p.a.strength/100;
 else{
   const target=m.players.find(q=>q.id===opts.targetId);if(!target||target.team!==p.team||target.id===p.id||!active(target))return 0;
   const d=distance(p,target),longWeight=longPassWeight(d);
   const skill=p.a.passing*(1-longWeight)+p.a.longPassing*longWeight;
   // 0.7.1: an unpressured short pass is safe (skill 60 ≈ 89 %, 95 ≈ 97 %); length, a forward or
   // through ball, an intercepting defender in the lane and pressure on the passer lower it.
   base=PASS.base+PASS.skill*skill/100+PASS.anticipation*p.a.anticipation/100-Math.max(0,d-PASS.shortRange)*PASS.perMetre;
   const ahead=(target.x-p.x)*direction(m,p.team);
   base-=a==='through'?PASS.through:a==='forward'||(a==='pass'&&ahead>PASS.forwardMetres)?PASS.forward:0;
   const dx=target.x-p.x,dy=target.y-p.y,l=dx*dx+dy*dy||1;
   let risk=0;
   for(const o of m.players){if(o.team===p.team||!active(o))continue;const t=((o.x-p.x)*dx+(o.y-p.y)*dy)/l;if(t>.08&&t<.95)risk=Math.max(risk,clamp(1-Math.hypot(o.x-p.x-t*dx,o.y-p.y-t*dy)/3,0,1)*(o.a.anticipation/100));}
   base-=risk*.18;
 }
 const boost=m.beatenBoost?.to===p.id&&m.clock<=m.beatenBoost.until?m.beatenBoost.amount:0;
 const playmaker=m.assistBoost?.to===p.id?m.assistBoost.mult:1;
 return clamp(base*(.8+p.energy/500)*playmaker-penalty+boost,0,.99);
}
export function defenseChance(m:Match,a:DefenseAction,predicted=false):number{
 const u=m.players[m.userId],o=m.ball.owner===null?null:m.players[m.ball.owner];
 if(!o||o.team===u.team||!active(u)||distance(u,o)>6)return 0;
 if(a==='predict')return (defenseChance(m,'tackle',true)+defenseChance(m,'slide',true)+defenseChance(m,'press',true))/3;
 const gap=distance(u,o),skill=a==='slide'?u.a.sliding:a==='press'?u.a.marking:u.a.defending;
 const opponent=(o.a.control*.45+o.a.dribbling*.4+o.a.strength*.15)/100;
 const base=a==='slide'?.15+.32*skill/100+.10*u.a.strength/100:a==='press'?.49+.28*skill/100+.10*u.a.strength/100-gap*.018:.38+.32*skill/100+.10*u.a.strength/100-gap*.035;
 return clamp(base*(.8+u.energy/500)-opponent*.12+(predicted?u.a.anticipation/100*.10:0),.02,.95);
}
export function matchCommentary(m:Match){
 const u=m.players[m.userId],o=m.ball.owner===null?null:m.players[m.ball.owner];
 if(m.ended)return '경기 종료 휘슬! 선수들이 오늘의 승부를 마무리합니다.';
 if(m.defending&&o)return `골문 ${goalDistance(m,o).toFixed(0)}m 앞, ${o.name}의 앞을 가로막는 ${u.name}. 어떻게 대응할까요?`;
 if(m.decision){
   const zone=goalDistance(m,u)<22?'페널티 박스 근처':goalDistance(m,u)>45?'중원':'상대 진영';
   const from=m.lastPass?.to===u.id?m.players[m.lastPass.from].name:null;
   const count=nearbyOpponents(m,u).count;
   return `${zone}에서 ${from?`${from}의 패스를 받은 `:''}${u.name}! ${count>=2?'수비가 에워쌉니다. 빠른 판단이 필요합니다.':count?'상대 수비와 마주합니다.':'앞에 공간이 열렸습니다.'}`;
 }
 return m.log.at(-1)?.text??'선수들이 전술 대형을 정비하며 기회를 살핍니다.';
}

/** 0.8: in-game probabilities are shown as words, never as numbers. */
export const CHANCE_BANDS=[{max:.2,label:'매우 낮은 확률'},{max:.4,label:'낮은 확률'},{max:.6,label:'중간 확률'},{max:.8,label:'높은 확률'},{max:Infinity,label:'매우 높은 확률'}] as const;
/** Band index 0 (매우 낮은) … 4 (매우 높은) for a probability 0–1. */
export const chanceLevel=(p:number)=>CHANCE_BANDS.findIndex(b=>p<b.max);
export const chanceLabel=(p:number)=>CHANCE_BANDS[chanceLevel(p)].label;
