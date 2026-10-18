import {DAILY,WEEKDAYS,todayIndex,isMatchToday,type Daily,type TodayResult} from './development';
import {LABELS,type Attr} from './engine';
import {dateOf,opponentOf,competitionName,selection,type Career} from './career';

// One glyph per daily activity (24×24 stroke icons).
const ICONS:Record<Daily,string>={
  shooting:'M3 19V7h18v12M3 7l3 3h12l3-3M12 13.5a2.2 2.2 0 1 0 .01 0',
  running:'M13 4a2 2 0 1 0 .01 0M8 21l3-6 3 2v4M6 12l3-3 4 1 3 3 3-1M11 15l-2-4',
  passing:'M4 17c4-8 10-10 16-10M16 4l4 3-4 3M7 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  dribbling:'M12 21a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 6c3 0 3 3 6 3s3-3 6-3 3 3 4 3',
  defending:'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z',
  reading:'M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 6v16',
  rest:'M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z',
  vacation:'M4 20h16M12 20V9M12 9c-2-3-6-3-8-1M12 9c2-3 6-3 8-1M12 9c-1-3-4-5-6-5M12 9c1-3 4-5 6-5',
};
export function DailyIcon({type,size=26}:{type:Daily,size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={ICONS[type]}/></svg>;
}
const effect=(t:Daily)=>t==='rest'?'컨디션 +30 · 피로 −25':t==='vacation'?'컨디션 +65 · 피로 −60 · 5만원':(DAILY[t].keys as readonly Attr[]).map(k=>LABELS[k]).join(' · ');

export function TodayPanel({c,last,onTrain,onMatch}:{c:Career,last:TodayResult|null,onTrain:(t:Daily)=>void,onMatch:()=>void}){
  const p=c.player,d=c.development,idx=todayIndex(c),match=isMatchToday(c),retired=c.world.phase==='retired';
  const day=WEEKDAYS[idx],done=d.active?.entries.length??0;
  return <section className="card today" aria-labelledby="today-title">
    <div className="section-title">
      <div><span className="eyebrow">TODAY · {dateOf(c.day).replaceAll('-','. ')}</span><h3 id="today-title">오늘의 일정 진행</h3></div>
      <span className="pill">{day}요일 · 이번 주 {idx+1}/7일차</span>
    </div>
    <ol className="week-strip" aria-label="이번 주 진행">
      {WEEKDAYS.map((w,i)=><li key={w} className={i<idx?'done':i===idx?'today':''} aria-current={i===idx?'date':undefined}>
        <span>{w}</span><small>{i<idx?'✓':i===5&&c.world.phase!=='offseason'?'경기':''}</small>
      </li>)}
    </ol>
    {retired?<p className="muted">은퇴한 커리어입니다. 커리어 기록에서 지난 여정을 확인하세요.</p>
    :match?<div className="match-today" role="status">
      <strong>오늘은 경기가 있는 날입니다</strong>
      <p>{competitionName(c)} · 상대 {opponentOf(c)} · 출전 계획 {selection(c).role}</p>
      <p className="muted">컨디션 {Math.round(p.energy)}% · 피로 {Math.round(p.fatigue)}%</p>
      <button type="button" className="primary" onClick={onMatch}>경기 진행</button>
    </div>
    :<>
      <div className="today-help" aria-label="오늘 상태">
        <span><small>컨디션</small><b>{Math.round(p.energy)}%</b></span>
        <span><small>피로도</small><b>{Math.round(p.fatigue)}%</b></span>
        <span><small>잔액</small><b>{d.wallet.toLocaleString()}만원</b></span>
      </div>
      <div className="today-grid">
        {(Object.keys(DAILY) as Daily[]).map(t=><button key={t} type="button" className={`today-tile ${t}${t==='rest'||t==='vacation'?' recovery':' training'}`} disabled={t==='vacation'&&d.wallet<5} onClick={()=>onTrain(t)} aria-label={`오늘 ${DAILY[t].label.replace(' · 5만원','')}`}>
          <DailyIcon type={t} size={t==='rest'||t==='vacation'?20:16}/><strong>{DAILY[t].label.replace(' · 5만원','')}</strong><small>{effect(t)}</small>
        </button>)}
      </div>
    </>}
    {last&&<div className={`today-result${last.lucky?' lucky':''}`} role="status" aria-live="polite">
      {last.lucky&&<span className="lucky-burst">럭키! 놀라운 성장!</span>}
      <p>{WEEKDAYS[last.day]}요일 · {last.text}</p>
      {last.gain>0&&<small>종합 능력 +{last.gain.toFixed(2)}</small>}
      {last.weekDone&&<small>한 주가 끝났습니다. 성장노트에 기록되었습니다.</small>}
    </div>}
    {done>0&&!last&&<p className="muted">이번 주 {done}일을 진행했습니다.</p>}
  </section>;
}
