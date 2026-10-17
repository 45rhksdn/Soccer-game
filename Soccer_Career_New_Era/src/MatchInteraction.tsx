import {useState} from 'react';
import {Pitch} from './Pitch';
import {ACTIONS,DEFENSE_ACTIONS,PLAYER_DEFENSE_ACTIONS,availableActions,actionChance,act,defend,type Match,type Action} from './engine';
import {defenseChance,nearbyOpponents,distance,passTargets,matchCommentary,offside,type AttackOptions} from './tactical';
export function MatchInteraction({m,onChange}:{m:Match;onChange:()=>void}){
 const [mode,setMode]=useState<'pass'|'dribble'|null>(null);
 const u=m.players[m.userId],o=m.ball.owner===null?null:m.players[m.ball.owner];
 const near=nearbyOpponents(m,u),gap=m.defending&&o?distance(u,o):near.distance;
 const execute=(a:Action,opts:AttackOptions={})=>{act(m,a,opts);setMode(null);onChange();};
 const directions=[['↖',-1,-1],['↑',0,-1],['↗',1,-1],['←',-1,0],['→',1,0],['↙',-1,1],['↓',0,1],['↘',1,1]] as const;
 return <>
  <div className="pitch-wrap interactive-pitch"><Pitch match={m} selectable={m.decision&&mode==='pass'} onPlayer={id=>execute('pass',{targetId:id})}/>
    <div className="live-badge">{m.decision?'공격 선택':m.defending?'수비 선택':m.ended?'경기 종료':'LIVE'}</div>
  </div>
  <div className="live-commentary" aria-live="polite"><b>현장 중계</b><p>{matchCommentary(m)}</p></div>
  {!m.ended&&<section className="match-actions">
   {(m.decision||m.defending)&&<div className="distance-strip"><strong>{m.defending?'볼 소유 상대':'가장 가까운 수비수'} {gap<=6?`${gap.toFixed(1)}m`:'6m 초과'}</strong>{m.decision&&<span>6m 이내 수비수 {near.count}명 · 모든 선택 −{near.count*5}%p</span>}<small>가까운 상대의 능력·거리도 반영됩니다. 수비수 1명당 성공률 −5%p.</small></div>}
   {m.defending?<div className="action-grid defense-grid" role="group" aria-label="수비 선택">{PLAYER_DEFENSE_ACTIONS.map(a=><button key={a} aria-label={`수비 ${DEFENSE_ACTIONS[a].label}`} onClick={()=>{defend(m,a);setMode(null);onChange();}}><strong>{DEFENSE_ACTIONS[a].label}</strong><b>성공 확률 {(defenseChance(m,a)*100).toFixed(1)}%{a==='predict'?' 평균':''}</b><small>{DEFENSE_ACTIONS[a].desc}</small></button>)}</div>
   :m.decision?<>
    <div className="action-grid" role="group" aria-label="공격 선택">{availableActions(m).map(a=><button key={a} className={mode===a?'selected':''} onClick={()=>a==='pass'||a==='dribble'?setMode(a):execute(a)}><strong>{ACTIONS[a]}</strong><small>{a==='pass'?'동료 선택':a==='dribble'?'방향 선택':`득점 확률 ${(actionChance(m,a)*100).toFixed(1)}%`}</small></button>)}</div>
    {mode==='pass'&&<div className="target-options" role="group" aria-label="패스 받을 동료"><p>경기장의 동료를 누르거나 아래에서 선택하세요. 오프사이드 위치의 동료는 선택할 수 없습니다.</p>{passTargets(m).map(q=><button key={q.id} disabled={offside(m,q)} onClick={()=>execute('pass',{targetId:q.id})}>#{q.number} {q.name}{offside(m,q)?" (오프사이드)":""} · {distance(u,q).toFixed(1)}m · {(actionChance(m,'pass',{targetId:q.id})*100).toFixed(1)}%</button>)}</div>}
    {mode==='dribble'&&<div className="direction-options" role="group" aria-label="드리블 방향">{directions.map(([label,x,y])=><button key={label} aria-label={`드리블 ${label}`} onClick={()=>execute('dribble',{vector:{x,y}})}><b>{label}</b> {(actionChance(m,'dribble',{vector:{x,y}})*100).toFixed(1)}%</button>)}<small>화면 기준 방향입니다. 경로 1m 이내 수비수가 있으면 성공률이 감소합니다.</small></div>}
   </>:<div className="offball">{(['shape','run','press','defend','call'] as const).map((a,i)=><button disabled={m.userOnPitch===false} className={m.offball===a?'secondary selected':'secondary'} key={a} onClick={()=>{m.offball=a;onChange();}}>{['전술 위치 유지','공간 침투','압박','수비 가담','패스 요청'][i]}</button>)}</div>}
  </section>}
 </>;
}
