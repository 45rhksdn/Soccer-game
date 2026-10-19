/** Visible, deterministic tactical reactions. No odds modifiers or extra random draws. */
import {direction,type Match,type Footballer,type Action} from './engine';
export type Habit={at:number;kind:'dribble'|'pass';dx:number;dy:number;target?:number};
export type MatchDynamics={habits:Record<number,Habit[]>};
const fit=(p:Footballer)=>!p.red&&!p.injured;
export function rememberPlay(m:Match,p:Footballer,a:Action,vector?:{x:number,y:number},target?:number){
 if(a!=='dribble'&&!['pass','safe','forward','through'].includes(a))return;
 const d=m.dynamics??={habits:{}},v=vector??{x:direction(m,p.team),y:0},l=Math.hypot(v.x,v.y)||1;
 const list=(d.habits[p.id]??[]).filter(h=>m.clock-h.at<1200);
 list.push({at:m.clock,kind:a==='dribble'?'dribble':'pass',dx:v.x/l,dy:v.y/l,target});d.habits[p.id]=list.slice(-6);
}
export function tendency(m:Match,p:Footballer){
 const list=(m.dynamics?.habits[p.id]??[]).filter(h=>m.clock-h.at<1200);
 const dribbles=list.filter(h=>h.kind==='dribble');
 if(dribbles.length>=3){const x=dribbles.reduce((n,h)=>n+h.dx,0)/dribbles.length,y=dribbles.reduce((n,h)=>n+h.dy,0)/dribbles.length,l=Math.hypot(x,y);if(l>.8)return {kind:'dribble' as const,x:x/l,y:y/l};}
 const passes=list.filter(h=>h.kind==='pass'&&h.target!==undefined);
 for(const h of passes){if(passes.filter(q=>q.target===h.target).length>=3){const target=m.players[h.target!];if(target&&fit(target))return {kind:'pass' as const,target};}}
 return undefined;
}
export function gamePlan(m:Match,team:number){
 const gap=m.score[team]-m.score[1-team],late=Math.max(0,Math.min(1,(m.clock/60-45)/35));
 return gap<0?{line:8*late,width:3*late,press:1+late*.25,label:late>.25?'동점골을 위해 수비 라인을 올립니다.':''}:gap>0?{line:-6*late,width:-3*late,press:1-late*.2,label:late>.25?'리드를 지키기 위해 중앙을 좁힙니다.':''}:{line:0,width:0,press:1,label:''};
}
/** Applies to both teams; only defenders close enough can react. Capped shift leaves the opposite lane open. */
export function adaptiveTarget(m:Match,p:Footballer,owner:Footballer|null,tx:number,ty:number){
 const d=direction(m,p.team),plan=gamePlan(m,p.team);
 if(p.pos!=='GK'){tx+=d*plan.line;ty+=(Math.sign(p.homeY-34)||1)*plan.width;}
 if(owner&&owner.team!==p.team&&p.pos!=='GK'){
  const gap=Math.hypot(owner.x-p.x,owner.y-p.y),h=tendency(m,owner);
  if(gap<12&&h?.kind==='dribble'){tx=tx*.45+(owner.x+h.x*2.5)*.55;ty=ty*.45+(owner.y+h.y*2.5)*.55;}
  if(h?.kind==='pass'&&Math.hypot(h.target.x-p.x,h.target.y-p.y)<14){tx=tx*.5+(owner.x+(h.target.x-owner.x)*.78)*.5;ty=ty*.5+(owner.y+(h.target.y-owner.y)*.78)*.5;}
  // A booked defender stays goal-side rather than charging through the carrier.
  if(p.yellow&&gap<7){tx=tx*.6+(owner.x-d*2)*.4;ty=ty*.6+owner.y*.4;}
 }
 return {x:Math.max(1,Math.min(104,tx)),y:Math.max(1,Math.min(67,ty))};
}
export function tacticalNote(m:Match){
 const owner=m.ball.owner===null?undefined:m.players[m.ball.owner];
 if(owner){const h=tendency(m,owner);if(h)return h.kind==='dribble'?`${owner.name}의 반복 돌파 방향을 수비가 경계합니다.`:`${h.target.name}에게 향하는 패스 길을 수비가 좁힙니다.`;}
 const opponent=1-m.players[m.userId].team,plan=gamePlan(m,opponent);
 return plan.label?`상대가 ${plan.label}`:'';
}
