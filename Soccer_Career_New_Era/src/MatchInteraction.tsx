import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Pitch,screenToEngineVector} from './Pitch';
import {ACTIONS,DEFENSE_ACTIONS,PLAYER_DEFENSE_ACTIONS,availableActions,actionChance,act,defend,type Match,type Action} from './engine';
import {MissionStrip} from './EngagementPanels';
import {defenseChance,nearbyOpponents,distance,passTargets,matchCommentary,offside,chanceLabel,chanceLevel,type AttackOptions} from './tactical';

/**
 * Probability as one continuous bar (filled length = success chance) plus a word label.
 * 0.8: no numbers in the match UI; `tone` picks colours for dark tiles or the light panel.
 */
function Chance({p,prefix='',tone='dark'}:{p:number,prefix?:string,tone?:'dark'|'light'}){
 const pct=Math.round(Math.max(0,Math.min(1,p))*100);
 return <span className={`chance-bar ${tone} lv${chanceLevel(p)}`}><span className="track" aria-hidden="true"><span className="fill" style={{width:`${pct}%`}}/></span><span className="label">{prefix}{chanceLabel(p)}</span></span>;
}
/** Simple line icons for the action tiles. */
const ICON:Record<string,string>={
 closeShot:'M12 3a9 9 0 1 0 .01 0M12 7l3 2.2-1.2 3.6h-3.6L9 9.2z',longShot:'M12 3a9 9 0 1 0 .01 0M12 7a5 5 0 1 0 .01 0M12 11a1 1 0 1 0 .01 0',
 curl:'M5 19C5 9 12 5 19 6M15 3l4 3-3 4',dribble:'M5 19L19 5M10 5h9v9',pass:'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4',
 tackle:'M4 18h10l6-6M14 18l-4-6M4 12h6',slide:'M3 17h11c3 0 5-2 7-5M3 17l4-4',press:'M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z',predict:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 9a3 3 0 1 0 .01 0',
};
function Icon({name}:{name:string}){return <svg className="tile-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[name]??ICON.pass}/></svg>;}

/** 0.8.1: when 드리블 is chosen its tile turns into an eight-way pad (each arrow shows its chance bar). */
function DribblePad({m,onPick,onCancel}:{m:Match,onPick:(v:{x:number,y:number})=>void,onCancel:()=>void}){
 const cells=[['↖',-1,-1],['↑',0,-1],['↗',1,-1],['←',-1,0],null,['→',1,0],['↙',-1,1],['↓',0,1],['↘',1,1]] as const;
 return <div className="action-card attack dribble-pad selected" role="group" aria-label="드리블 방향">
  <span className="tile-top"><strong>드리블 방향</strong><button type="button" className="pad-close" aria-label="드리블 취소" onClick={onCancel}>×</button></span>
  <div className="pad">{cells.map((c,i)=>{if(!c)return <span key={i} className="pad-center" aria-hidden="true">●</span>;const [label,x,y]=c,vector=screenToEngineVector(m,x,y),p=actionChance(m,'dribble',{vector});
   return <button key={label} type="button" className={`pad-cell lv${chanceLevel(p)}`} aria-label={`드리블 ${label}`} title={chanceLabel(p)} aria-description={chanceLabel(p)} onClick={()=>onPick(vector)}><b>{label}</b><span className="mini"><span style={{width:`${Math.round(p*100)}%`}}/></span></button>;})}</div>
  <small>경기장을 눌러도 됩니다 · 위쪽이 공격 방향</small>
 </div>;
}
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
   <MissionStrip m={m}/>
   <div className="live-commentary" aria-live="polite"><b>현장 중계</b><p>{matchCommentary(m)}</p></div>
   {!m.ended&&<section className="match-actions">
    {(m.decision||m.defending)&&<div className="distance-strip"><strong>{m.defending?'볼 소유 상대':'가장 가까운 수비수'} {gap<=6?`${gap.toFixed(1)}m`:'6m 초과'}</strong>{m.decision&&<span>6m 이내 수비수 {near.count}명</span>}<small>가까운 수비수가 많고 강할수록 성공 가능성이 낮아집니다.</small></div>}
    {m.defending?<div className="action-grid defense-grid" role="group" aria-label="수비 선택">{PLAYER_DEFENSE_ACTIONS.map(a=><button key={a} className="action-card defense" aria-label={`수비 ${DEFENSE_ACTIONS[a].label}`} onClick={()=>{defend(m,a);setMode(null);onChange();}}><span className="tile-top"><strong>{DEFENSE_ACTIONS[a].label}</strong><Icon name={a}/></span><Chance p={defenseChance(m,a)}/><small>{DEFENSE_ACTIONS[a].desc}</small></button>)}</div>
    :m.decision?<>
     <div className="action-grid" role="group" aria-label="공격 선택">{availableActions(m).map(a=>a==='dribble'&&mode==='dribble'?<DribblePad key={a} m={m} onPick={vector=>execute('dribble',{vector})} onCancel={()=>setMode(null)}/>:<button key={a} className={`action-card attack${mode===a?' selected':''}`} onClick={()=>a==='pass'||a==='dribble'?setMode(mode===a?null:a):execute(a)}><span className="tile-top"><strong>{ACTIONS[a]}</strong><Icon name={a}/></span>{a==='pass'?<Chance p={actionChance(m,'pass')}/>:a==='dribble'?<Chance p={actionChance(m,'dribble',{vector:screenToEngineVector(m,0,-1)})}/>:<Chance p={actionChance(m,a)}/>}</button>)}</div>
     {mode==='pass'&&<div className="target-options" role="group" aria-label="패스 받을 동료"><p>경기장의 동료를 누르거나 아래에서 고르세요. 오프사이드 위치의 동료는 고를 수 없습니다.</p>{passTargets(m).map(q=><button key={q.id} disabled={offside(m,q)} onClick={()=>execute('pass',{targetId:q.id})}><span>#{q.number} {q.name}{offside(m,q)?' (오프사이드)':''} · {distance(u,q).toFixed(0)}m</span>{!offside(m,q)&&<Chance tone="light" p={actionChance(m,'pass',{targetId:q.id})}/>}</button>)}</div>}
    </>:<div className="offball">{(['shape','run','press','defend','call'] as const).map((a,i)=><button disabled={m.userOnPitch===false} className={m.offball===a?'secondary selected':'secondary'} key={a} onClick={()=>{m.offball=a;onChange();}}>{['전술 위치 유지','공간 침투','압박','수비 가담','패스 요청'][i]}</button>)}</div>}
   </section>}
   {toolbar}
  </div>
 </div>;
}

