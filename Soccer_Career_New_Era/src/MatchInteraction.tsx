import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Pitch,screenToEngineVector} from './Pitch';
import {ACTIONS,DEFENSE_ACTIONS,PLAYER_DEFENSE_ACTIONS,availableActions,actionChance,act,defend,type Match,type Action} from './engine';
import {defenseChance,nearbyOpponents,distance,passTargets,matchCommentary,offside,chanceLabel,chanceLevel,type AttackOptions} from './tactical';

/** Probability as a word badge (0.8: no numbers in the match UI). */
function Chance({p,prefix=''}:{p:number,prefix?:string}){return <span className={`chance lv${chanceLevel(p)}`}>{prefix}{chanceLabel(p)}</span>;}

export function MatchInteraction({m,onChange,toolbar}:{m:Match;onChange:()=>void;toolbar?:ReactNode}){
 const [mode,setMode]=useState<'pass'|'dribble'|null>(null);
 const u=m.players[m.userId],o=m.ball.owner===null?null:m.players[m.ball.owner];
 const near=nearbyOpponents(m,u),gap=m.defending&&o?distance(u,o):near.distance;
 const execute=(a:Action,opts:AttackOptions={})=>{act(m,a,opts);setMode(null);onChange();};
 // Screen directions on the vertical pitch (up = toward the goal we attack).
 const directions=[['↖',-1,-1],['↑',0,-1],['↗',1,-1],['←',-1,0],['→',1,0],['↙',-1,1],['↓',0,1],['↘',1,1]] as const;
 const dribbleMode=m.decision&&mode==='dribble';
 // Bring the whole match board (scoreboard + pitch) into view when the match screen opens.
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{root.current?.closest('.match-board')?.scrollIntoView({block:'start'});},[]);
 return <div className="match-layout" ref={root}>
  <div className="match-field">
   <div className="pitch-wrap interactive-pitch"><Pitch match={m} selectable={m.decision&&mode==='pass'} onPlayer={id=>execute('pass',{targetId:id})} dribble={dribbleMode} onDribble={vector=>execute('dribble',{vector})}/>
    <div className="live-badge">{m.decision?'공격 선택':m.defending?'수비 선택':m.ended?'경기 종료':'LIVE'}</div>
    {dribbleMode&&<div className="pitch-hint">경기장을 눌러 드리블 방향을 정하세요</div>}
    {m.decision&&mode==='pass'&&<div className="pitch-hint">노란 테두리 동료를 눌러 패스하세요</div>}
   </div>
  </div>
  <div className="match-side">
   <div className="live-commentary" aria-live="polite"><b>현장 중계</b><p>{matchCommentary(m)}</p></div>
   {!m.ended&&<section className="match-actions">
    {(m.decision||m.defending)&&<div className="distance-strip"><strong>{m.defending?'볼 소유 상대':'가장 가까운 수비수'} {gap<=6?`${gap.toFixed(1)}m`:'6m 초과'}</strong>{m.decision&&<span>6m 이내 수비수 {near.count}명</span>}<small>가까운 수비수가 많고 강할수록 성공 가능성이 낮아집니다.</small></div>}
    {m.defending?<div className="action-grid defense-grid" role="group" aria-label="수비 선택">{PLAYER_DEFENSE_ACTIONS.map(a=><button key={a} className="action-card defense" aria-label={`수비 ${DEFENSE_ACTIONS[a].label}`} onClick={()=>{defend(m,a);setMode(null);onChange();}}><strong>{DEFENSE_ACTIONS[a].label}</strong><Chance p={defenseChance(m,a)} prefix={a==='predict'?'평균 · ':''}/><small>{DEFENSE_ACTIONS[a].desc}</small></button>)}</div>
    :m.decision?<>
     <div className="action-grid" role="group" aria-label="공격 선택">{availableActions(m).map(a=><button key={a} className={`action-card attack${mode===a?' selected':''}`} onClick={()=>a==='pass'||a==='dribble'?setMode(mode===a?null:a):execute(a)}><strong>{ACTIONS[a]}</strong>{a==='pass'?<small>받을 동료 선택</small>:a==='dribble'?<small>경기장에서 방향 선택</small>:<Chance p={actionChance(m,a)} prefix="득점 · "/>}</button>)}</div>
     {mode==='pass'&&<div className="target-options" role="group" aria-label="패스 받을 동료"><p>경기장의 동료를 누르거나 아래에서 고르세요. 오프사이드 위치의 동료는 고를 수 없습니다.</p>{passTargets(m).map(q=><button key={q.id} disabled={offside(m,q)} onClick={()=>execute('pass',{targetId:q.id})}><span>#{q.number} {q.name}{offside(m,q)?' (오프사이드)':''} · {distance(u,q).toFixed(0)}m</span>{!offside(m,q)&&<Chance p={actionChance(m,'pass',{targetId:q.id})}/>}</button>)}</div>}
     {mode==='dribble'&&<div className="direction-options" role="group" aria-label="드리블 방향">{directions.map(([label,x,y])=>{const vector=screenToEngineVector(m,x,y);return <button key={label} aria-label={`드리블 ${label}`} onClick={()=>execute('dribble',{vector})}><b>{label}</b><Chance p={actionChance(m,'dribble',{vector})}/></button>;})}<small>경기장을 눌러도 됩니다. 위쪽이 우리가 공격하는 골문입니다. 가는 길에 수비수가 있으면 어려워집니다.</small></div>}
    </>:<div className="offball">{(['shape','run','press','defend','call'] as const).map((a,i)=><button disabled={m.userOnPitch===false} className={m.offball===a?'secondary selected':'secondary'} key={a} onClick={()=>{m.offball=a;onChange();}}>{['전술 위치 유지','공간 침투','압박','수비 가담','패스 요청'][i]}</button>)}</div>}
   </section>}
   {toolbar}
  </div>
 </div>;
}
