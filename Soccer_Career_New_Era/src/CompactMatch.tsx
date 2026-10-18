import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Pitch,screenToEngineVector} from './Pitch';
import {ACTIONS,DEFENSE_ACTIONS,PLAYER_DEFENSE_ACTIONS,availableActions,act,defend,type Match,type Action} from './engine';
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
export function CompactMatch({m,onChange,toolbar}:{m:Match;onChange:()=>void;toolbar?:ReactNode}){
 const [mode,setMode]=useState<'dribble'|'pass'|'shot'>('dribble'),[run,setRun]=useState(false);
 const [target,setTarget]=useState<number|null>(null),[shot,setShot]=useState<Action|null>(null);
 const u=m.players[m.userId],owner=m.ball.owner===null?null:m.players[m.ball.owner];
 const allowed=availableActions(m),activeMode=mode==='dribble'&&!allowed.includes('dribble')?(allowed.includes('header')?'shot':'pass'):mode,near=nearbyOpponents(m,u),gap=m.defending&&owner?distance(u,owner):near.distance;
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{root.current?.closest('.match-board')?.scrollIntoView({block:'start'});},[]);
 // A new possession starts on the pad. Consecutive dribbles retain the same pad and run mode.
 useEffect(()=>{if(!m.decision){setMode('dribble');setTarget(null);setShot(null);}},[m.decision]);
 const execute=(a:Action,opts:AttackOptions={})=>{if(!m.decision||!availableActions(m).includes(a))return;act(m,a,opts);setTarget(null);setShot(null);setMode('dribble');onChange();};
 const targets=passTargets(m),selected=targets.find(p=>p.id===target),validTarget=selected&&!offside(m,selected);
 const pickTarget=(id:number)=>{if(targets.some(p=>p.id===id&&!offside(m,p)))setTarget(id);};
 const switchMode=(next:typeof mode)=>{setMode(next);setTarget(null);setShot(null);};
 return <div ref={root} className="match-layout cm-match">
  <div className="match-field"><div className="pitch-wrap interactive-pitch">
   <Pitch match={m} selectable={m.decision&&activeMode==='pass'} onPlayer={pickTarget} selectedTarget={target} premium/>
   <span className="live-badge">{m.ended?'FULL TIME':m.decision?'공격 선택':m.defending?'수비 선택':'LIVE'}</span>
   {m.decision&&activeMode==='pass'&&<div className="pitch-hint">동료 선택 후 패스하기</div>}
  </div></div>
  <div className="match-side">
   <div className="live-commentary" aria-live="polite"><b>현장 중계</b><p>{matchCommentary(m)}</p></div>
   {!m.ended&&<section className="match-actions">
    {(m.decision||m.defending)&&<div className="cm-distance"><span>상대와의 거리 <strong>{opponentDistanceLabel(gap)}</strong></span>{m.decision&&<span>주변 상대 {near.count}명</span>}<details><summary aria-label="성공률 안내">ⓘ</summary><p>상대와의 거리·위치 및 능력 차이가 성공률에 영향을 줍니다. !는 진행 경로에 상대가 있다는 뜻입니다.</p></details></div>}
    {m.decision&&m.dribbleBeat?.by===m.userId&&m.dribbleBeat.ids.length>0&&<div className="beat-badge">드리블 성공 · 제친 수비수 {m.dribbleBeat.ids.length}명의 영향 −70% (이번 선택까지)</div>}
    {m.defending?<div className="cm-defense" role="group" aria-label="수비 선택">{PLAYER_DEFENSE_ACTIONS.map(a=>{const o=defenseOdds(m,a);return <button key={a} title={o.why.join(' · ')} onClick={()=>{defend(m,a);switchMode('dribble');onChange();}}><strong>{DEFENSE_ACTIONS[a].label}</strong><Gauge p={o.p}/></button>;})}</div>
    :m.decision?<div role="group" aria-label="공격 선택">
     <div className="cm-control-body">
      {activeMode==='dribble'?<>
       <div className="cm-mode" role="group" aria-label="드리블 방식"><button aria-pressed={!run} onClick={()=>setRun(false)}>드리블</button><button aria-pressed={run} onClick={()=>setRun(true)}>치고 달리기</button></div>
       <div className="cm-pad" role="group" aria-label="드리블 방향">{DIRECTIONS.map((cell,i)=>{if(!cell)return <span key={i} className="cm-center" aria-hidden="true">●</span>;const [label,x,y]=cell,vector=screenToEngineVector(m,x,y),o=attackOdds(m,'dribble',{vector,run}),blocked=routeBlocked(m,vector,run);return <button key={label} disabled={!allowed.includes('dribble')} aria-label={`${run?'치고 달리기':'드리블'} ${label}`} aria-description={`${chanceLabel(o.p)}${blocked?' · 진행 경로에 상대':''}`} title={[chanceLabel(o.p),...o.why].join(' · ')} onClick={()=>execute('dribble',{vector,run})}><b>{label}</b>{blocked&&<em className="cm-warning" aria-label="진행 경로에 상대">!</em>}<Gauge p={o.p} label={false}/></button>;})}</div>
       <div className="cm-legend">방향을 누르면 바로 이동 <span>! 경로에 상대</span></div>
      </>:activeMode==='pass'?<>
       <p className="cm-instruction">경기장 또는 아래에서 동료를 고르세요</p>
       <div className="cm-targets" role="group" aria-label="패스 받을 동료">{targets.map(p=><button key={p.id} disabled={offside(m,p)} aria-pressed={target===p.id} onClick={()=>pickTarget(p.id)}><span>#{p.number} {p.name}</span><small>{distance(u,p).toFixed(0)}m{offside(m,p)?' · 오프사이드':''}</small>{!offside(m,p)&&<Gauge p={attackOdds(m,'pass',{targetId:p.id}).p} label={false}/>}</button>)}</div>
       <button className="cm-confirm" disabled={!validTarget||!allowed.includes('pass')} onClick={()=>validTarget&&execute('pass',{targetId:selected.id})}>{selected?`${selected.name}에게 패스하기`:'동료를 선택하세요'}</button>
       <div className="cm-special">{(['cross','cutback'] as Action[]).filter(a=>allowed.includes(a)).map(a=><button key={a} onClick={()=>execute(a)}>{ACTIONS[a]}<Gauge p={attackOdds(m,a).p} label={false}/></button>)}</div>
      </>:<>
       <div className="cm-shots" role="group" aria-label="슛 종류">{SHOTS.filter(a=>!['header','volley'].includes(a)||allowed.includes(a)).map(a=><button key={a} disabled={!allowed.includes(a)} aria-pressed={shot===a} onClick={()=>setShot(a)}><strong>{ACTIONS[a]}</strong>{allowed.includes(a)?<Gauge p={attackOdds(m,a).p}/>:<small>현재 위치에서 선택 불가</small>}</button>)}</div>
       <button className="cm-confirm" disabled={!shot||!allowed.includes(shot)} onClick={()=>shot&&execute(shot)}>{shot?`${ACTIONS[shot]} 실행`:'슛 종류를 선택하세요'}</button>
      </>}
     </div>
     <nav className="cm-tabs" aria-label="공격 방식">{(['dribble','pass','shot'] as const).map((a,i)=><button key={a} aria-pressed={activeMode===a} onClick={()=>switchMode(a)}>{['드리블','패스','슛'][i]}</button>)}</nav>
    </div>:<div className="offball">{(['shape','run','press','defend','call'] as const).map((a,i)=><button disabled={m.userOnPitch===false} aria-pressed={m.offball===a} key={a} onClick={()=>{m.offball=a;onChange();}}>{['전술 위치 유지','공간 침투','압박','수비 가담','패스 요청'][i]}</button>)}</div>}
   </section>}
   {toolbar}
   <details className="cm-mission"><summary>경기 목표</summary><MissionStrip m={m}/></details>
  </div>
 </div>;
}
