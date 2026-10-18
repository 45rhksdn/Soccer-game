import {Crosshair,Target,CornerUpRight,CornerDownLeft,Wind,ArrowUpRight,Goal} from 'lucide-react';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Pitch,screenToEngineVector,type PitchMotion} from './Pitch';
import {RUN_SPEED,ACTIONS,DEFENSE_ACTIONS,PLAYER_DEFENSE_ACTIONS,availableActions,act,defend,type Match,type Action} from './engine';
import {MissionStrip} from './EngagementPanels';
import {attackOdds,defenseOdds,nearbyOpponents,distance,passTargets,matchCommentary,offside,chanceLabel,opponentDistanceLabel,dribbleAdvance,type AttackOptions} from './tactical';
import './compact-match.css';

const DIRECTIONS=[['↖',-1,-1],['↑',0,-1],['↗',1,-1],['←',-1,0],null,['→',1,0],['↙',-1,1],['↓',0,1],['↘',1,1]] as const;
const SHOTS:Action[]=['closeShot','longShot','curl','header','volley'];
/** Visual warning only. Uses the planned engine carry distance; never consumes RNG or changes odds. */
export function routeBlocked(m:Match,vector:{x:number,y:number},run=false){
 const u=m.players[m.userId],len=Math.hypot(vector.x,vector.y)||1,dx=vector.x/len,dy=vector.y/len;
 const reach=dribbleAdvance(m,u,vector,run);
 return m.players.some(p=>{if(p.team===u.team||p.red||p.injured)return false;
 const x=p.x-u.x,y=p.y-u.y,along=x*dx+y*dy;
 return along>0&&along<=reach&&Math.abs(x*dy-y*dx)<=1.5;
 });
}
function Gauge({p,label=true}:{p:number;label?:boolean}){
 return <span className="cm-chance" aria-label={chanceLabel(p)}><span className="cm-track"><i style={{width:`${Math.max(0,Math.min(1,p))*100}%`}}/></span>{label&&<small>{chanceLabel(p)}</small>}</span>;
}
const ATTACK_BUTTONS=[['closeShot',Goal],['longShot',Target],['curl',Wind],['cross',CornerUpRight],['cutback',CornerDownLeft],['header',ArrowUpRight],['volley',Crosshair]] as const;
const passBand=(p:number)=>p>=.7?'높음':p>=.4?'보통':'낮음';
export function CompactMatch({m,onChange,toolbar,onAnimating}:{m:Match;onChange:()=>void;toolbar?:ReactNode;onAnimating?:(busy:boolean)=>void}){
 const [run,setRun]=useState(false),[target,setTarget]=useState<number|null>(null),[motion,setMotion]=useState<PitchMotion|null>(null);
 const busy=!!motion,gate=useRef(false),root=useRef<HTMLDivElement>(null);
 const u=m.players[m.userId],owner=m.ball.owner===null?null:m.players[m.ball.owner],allowed=availableActions(m);
 const near=nearbyOpponents(m,u),gap=m.defending&&owner?distance(u,owner):near.distance;
 const targets=passTargets(m).sort((a,b)=>distance(u,a)-distance(u,b)||a.id-b.id),selected=targets.find(p=>p.id===target);
 const validTarget=selected&&!offside(m,selected),passP=selected?attackOdds(m,'pass',{targetId:selected.id}).p:0;
 useEffect(()=>{root.current?.closest('.match-board')?.scrollIntoView({block:'start'});return()=>{onAnimating?.(false);};},[]);
 useEffect(()=>{if(!motion)return;const timer=setTimeout(()=>{setMotion(null);gate.current=false;onAnimating?.(false);},motion.duration);return()=>clearTimeout(timer);},[motion]);
 useEffect(()=>{if(!m.decision)setTarget(null);},[m.decision]);
 const execute=(a:Action,opts:AttackOptions={})=>{
  if(gate.current||!m.decision||!availableActions(m).includes(a))return;
  const from=Object.fromEntries(m.players.map(p=>[p.id,{x:p.x,y:p.y}]));from[-1]={x:m.ball.x,y:m.ball.y};
  const start={x:u.x,y:u.y},energy=u.energy;
  act(m,a,opts);setTarget(null);
  const metres=distance(start,u);
  if(a==='dribble'&&metres>.1){
   const metresPerSecond=(2.6+u.a.speed/32)*(.55+energy/222)*.68*(opts.run?RUN_SPEED:1);
   const duration=1000*metres/Math.max(2,metresPerSecond);
   gate.current=true;onAnimating?.(true);setMotion({from,started:performance.now(),duration});
  }
  onChange();
 };
 const pickTarget=(id:number)=>{if(!busy&&m.decision&&targets.some(p=>p.id===id))setTarget(id);};
 return <div ref={root} className="match-layout cm-match cm-sidebar-layout">
  <div className="live-commentary" aria-live="polite"><b>현장 중계</b><p>{busy?`${u.name}, 공을 몰고 전진합니다.`:matchCommentary(m)}</p></div>
  <div className="match-field"><div className="pitch-wrap interactive-pitch">
   <Pitch match={m} selectable={m.decision&&!busy&&allowed.includes('pass')} onPlayer={pickTarget} selectedTarget={target} motion={motion} premium/>
   <span className="live-badge">{busy?'드리블 진행':m.ended?'FULL TIME':m.decision?'공격 선택':m.defending?'수비 선택':'LIVE'}</span>
   {selected&&m.decision&&!busy&&<div className="cm-pass-card" role="status"><strong>#{selected.number} {selected.name}</strong><span>거리 {distance(u,selected).toFixed(1)}m · 성공 {validTarget?passBand(passP):'불가 · 오프사이드'}</span><button disabled={!validTarget} onClick={()=>execute('pass',{targetId:selected.id})}>패스하기</button><button aria-label="패스 선택 취소" onClick={()=>setTarget(null)}>×</button></div>}
  </div></div>
  <div className="match-side" inert={busy}>
   {!m.ended&&<section className="match-actions">
    {(m.decision||m.defending)&&<div className="cm-distance"><span>상대와의 거리 <strong>{opponentDistanceLabel(gap)}</strong></span>{m.decision&&<span>주변 상대 {near.count}명</span>}<small>거리·위치·능력 차이 반영</small>{m.decision&&m.dribbleBeat&&m.dribbleBeat.ids.length>0&&<em className="beat-badge">드리블 성공 · 제친 수비수 {m.dribbleBeat.ids.length}명의 영향 −70% (이번 선택까지)</em>}</div>}
    {m.defending?<div className="cm-defense" role="group" aria-label="수비 선택">{PLAYER_DEFENSE_ACTIONS.map(a=>{const o=defenseOdds(m,a);return <button key={a} aria-label={`수비 ${DEFENSE_ACTIONS[a].label}`} title={[chanceLabel(o.p),...o.why].join(' · ')} onClick={()=>{defend(m,a);onChange();}}><strong>{DEFENSE_ACTIONS[a].label}</strong><Gauge p={o.p}/></button>;})}</div>
    :m.decision?<div className="cm-attack-stack" role="group" aria-label="공격 선택">
     <div className="cm-location-actions" role="group" aria-label="위치별 공격 버튼">{ATTACK_BUTTONS.filter(([a])=>!['header','volley'].includes(a)||allowed.includes(a)).map(([a,Icon])=><button key={a} disabled={!allowed.includes(a)} aria-label={ACTIONS[a]} title={allowed.includes(a)?chanceLabel(attackOdds(m,a).p):'현재 위치에서 선택 불가'} onClick={()=>execute(a)}><Icon size={20}/><span>{ACTIONS[a]}</span>{allowed.includes(a)&&<Gauge p={attackOdds(m,a).p} label={false}/>}</button>)}</div>
     <p className="cm-tap-help">동료를 터치하거나 아래에서 골라 패스</p>
     {allowed.includes('pass')&&<div className="cm-targets" role="group" aria-label="패스 받을 동료">{targets.slice(0,6).map(p=><button key={p.id} aria-pressed={target===p.id} aria-label={`패스 · #${p.number} ${p.name} ${distance(u,p).toFixed(0)}m`} title={offside(m,p)?'오프사이드 위치':chanceLabel(attackOdds(m,'pass',{targetId:p.id}).p)} onClick={()=>pickTarget(p.id)}><b>#{p.number}</b><span>{p.name}</span><small>{distance(u,p).toFixed(0)}m</small><Gauge p={offside(m,p)?0:attackOdds(m,'pass',{targetId:p.id}).p} label={false}/></button>)}</div>}
     <div className="cm-dribble-dock">
      <div className="cm-mode" role="group" aria-label="드리블 방식"><button aria-pressed={!run} onClick={()=>setRun(false)}>드리블</button><button aria-pressed={run} onClick={()=>setRun(true)}>치고 달리기</button></div>
      <div className="cm-pad" role="group" aria-label="드리블 방향">{DIRECTIONS.map((cell,i)=>{if(!cell)return <span key={i} className="cm-center">●</span>;const [label,x,y]=cell,vector=screenToEngineVector(m,x,y),o=attackOdds(m,'dribble',{vector,run});return <button key={label} disabled={!allowed.includes('dribble')} aria-label={`${run?'치고 달리기':'드리블'} ${label}`} title={[chanceLabel(o.p),...o.why].join(' · ')} onClick={()=>execute('dribble',{vector,run})}><b>{label}</b>{routeBlocked(m,vector,run)&&<em className="cm-warning">!</em>}<Gauge p={o.p} label={false}/></button>;})}</div>
      <small className="cm-legend">! 진행 경로에 상대</small>
     </div>
    </div>:<div className="offball">{(['shape','run','press','defend','call'] as const).map((a,i)=><button disabled={m.userOnPitch===false} aria-pressed={m.offball===a} key={a} onClick={()=>{m.offball=a;onChange();}}>{['위치 유지','공간 침투','압박','수비 가담','패스 요청'][i]}</button>)}</div>}
   </section>}
  </div>
  <div className="cm-bottom" inert={busy}>{toolbar}<details className="cm-mission"><summary>경기 목표</summary><MissionStrip m={m}/></details></div>
 </div>;
}
