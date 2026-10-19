import {useState} from 'react';
import {type Career,currentMatchup,contractNeeded,nextSeason} from './career';
import {clubOf,LEAGUES,sortedTable,roundName,money,WINDOW_WEEKS,type Bracket} from './world';
import {PRO_SLOTS,SCHOOL_SLOTS,SEASON_WEEKS,MIN_REST_DAYS,schoolRank,clubName,type SchoolSeason} from './season';
import {WEEKDAYS} from './development';
import {roleAbility} from './roles';

/** 0.15 season page: the 35-week calendar, the knockout brackets and the tables (pro league or school region). */
export function SeasonPanel({c,update,onNeedContract}:{c:Career,update:(f:(c:Career)=>void)=>void,onNeedContract?:(message:string)=>void}){
 const w=c.world,s=w.season!,club=clubOf(w),school=club.league===0,ss=s.school;
 const me=ss?.entrants.find(e=>e.clubId===w.clubId);
 const [league,setLeague]=useState(club.league||1);
 const [view,setView]=useState<'calendar'|'brackets'|'table'>('calendar');
 const name=(id:string)=>id.startsWith('s:')||id.startsWith('c:')?ss?.entrants.find(e=>e.id===id)?.name??id:clubName(w,id);
 const mine=(id:string)=>id===w.clubId||id===me?.id||id==='KOR';
 const slots=school?SCHOOL_SLOTS:PRO_SLOTS,mu=currentMatchup(c);
 const plannedOpponent=(k:number)=>{if(school)return '';const slot=PRO_SLOTS[k];if(slot.kind!=='league')return '';const f=w.fixtures[slot.round]?.find(f=>f.home===w.clubId||f.away===w.clubId);return f?name(f.home===w.clubId?f.away:f.home):'';};
 const brackets:[string,Bracket|undefined][]=school?[[`${me?.region??''} 지역 토너먼트`,me?ss!.regional[me.region]:undefined],['전국 고교대회 (32강)',ss?.national]]
  :[[`${LEAGUES[club.league]} 컵`,s.cups[club.league]],...Object.entries(s.continental).map(([conf,b])=>[`대륙 클럽 컵 · ${conf}`,b] as [string,Bracket]),['국제 초청대회',s.national]];
 return <>
  <div className="page-heading"><div><div className="eyebrow">LEAGUE & SEASON</div><h1>{w.year} 시즌</h1><p>{w.phase==='offseason'?'시즌 종료 · 이적시장':`${Math.min(SEASON_WEEKS,s.played+1)} / ${SEASON_WEEKS}주차 · 이번 주 ${mu?.competition??'-'} · 상대 ${mu?.opponentName??'-'}`}</p></div></div>
  {w.phase==='offseason'&&<SeasonReview c={c} update={update} onNeedContract={onNeedContract}/>}
  <div className="intensity season-tabs" role="tablist">{([['calendar','시즌 일정'],['brackets','토너먼트'],['table',school?'지역 리그 순위':'리그 순위']] as const).map(([k,label])=><button key={k} role="tab" aria-selected={view===k} className={view===k?'selected':''} onClick={()=>setView(k)}>{label}</button>)}</div>
  {view==='calendar'&&<section className="card season-calendar" aria-label="35주 시즌 일정">
   <h3>{school?(me?.name??club.name):club.name} · 35주 일정</h3>
   <ol>{slots.map((slot,k)=>{const log=s.log.find(x=>x.week===k),current=k===s.played&&w.phase!=='offseason';
    return <li key={k} className={log?'done':current?'today':''} aria-current={current?'step':undefined}>
     <span className="wk">{k+1}주</span><span className="wd">{WEEKDAYS[s.matchDays[k]]}</span>
     <span className="what">{current&&mu?mu.competition:log?.label??slot.label}{WINDOW_WEEKS.includes(k)&&!school?<em className="window-tag">이적시장</em>:null}</span>
     <span className="vs">{log?log.opponent:current&&mu?mu.opponentName:plannedOpponent(k)}</span>
     <b className="sc">{log?log.score.join(' : '):''}</b>
    </li>;})}</ol>
   <small className="muted">매주 한 경기 · 경기 요일은 시즌 시작 때 정해져 저장됩니다 (월 3% · 화 10% · 수 15% · 목 7% · 금 10% · 토 30% · 일 25%, 직전 경기와 최소 {MIN_REST_DAYS}일 간격).</small>
  </section>}
  {view==='brackets'&&<div className="bracket-list">{brackets.map(([title,b])=><section className="card bracket" key={title}><h3>{title}</h3>{b?<BracketView b={b} name={name} mine={mine}/>:<p className="muted">{school?(title.startsWith('전국')?'지역 토너먼트가 끝나면 17개 지역 우승교 + 준우승·성적 우수 15개교로 32강 대진이 정해집니다.':'정규 25주 종료 후 지역 상위 16개교로 대진이 정해집니다.'):title.startsWith('대륙')?'리그 종료 후 연맹별 4개 구단이 출전합니다.':'대진 준비 중'}</p>}</section>)}
   {!school&&!Object.keys(s.continental).length&&<section className="card bracket"><h3>대륙 클럽 컵</h3><p className="muted">리그 28라운드 종료 후 연맹별 상위 4개 구단(우승팀 우선)으로 4강 대진이 정해집니다.</p></section>}
   {school&&ss&&<ScoutInfo c={c} ss={ss}/>}
  </div>}
  {view==='table'&&(school&&ss&&me?<SchoolTable ss={ss} region={me.region} mine={me.id}/>:<>
   <div className="intensity">{LEAGUES.map((n,i)=>i>0&&<button className={league===i?'selected':''} key={i} onClick={()=>setLeague(i)}>{n}</button>)}</div>
   <section className="card table-wrap"><table><thead><tr><th>순위</th><th>팀</th><th>선수 평균</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr></thead><tbody>{sortedTable(w,league).map((t,i)=>{const cl=w.clubs.find(x=>x.id===t.id)!;return <tr key={t.id}><td>{i+1}</td><td><strong>{cl.name}{t.id===w.clubId?' · 소속팀':''}</strong></td><td>{(cl.roster.reduce((n,p)=>n+roleAbility(p.a,p.pos),0)/cl.roster.length).toFixed(1)}</td><td>{t.played}</td><td>{t.won}</td><td>{t.draw}</td><td>{t.lost}</td><td>{t.gf} : {t.ga}</td><td><b>{t.points}</b></td></tr>;})}</tbody></table></section></>)}
  <div className="note">프로: 8개 구단 리그 28라운드 + 국내 컵(8강·4강·결승) + 대륙 클럽 컵(4강·결승) + 국제 초청대회(4강·결승, 대표 발탁 시). 고교: 정규·교류전 25주 + 지역 토너먼트 4주 + 전국대회 5주(32강) + 스카우트 쇼케이스. 무승부 토너먼트 경기는 간소화된 승부차기로 결정됩니다. 구단·학교 이름은 실제 이름을 쓰지만 선수와 기록은 모두 가상입니다.</div>
 </>;
}
export function BracketView({b,name,mine}:{b:Bracket,name:(id:string)=>string,mine:(id:string)=>boolean}){
 return <div className="bracket-rounds">{b.rounds.map((ties,r)=><div className="bracket-round" key={r}><h4>{roundName(b,r)}</h4>{ties.map((t,i)=><div className={`tie${mine(t.a)||mine(t.b)?' mine':''}`} key={i}>
  <span className={t.winner===t.a?'win':''}>{name(t.a)}</span>{t.b?<><b>{t.score?t.score.join(':'):'vs'}{t.shootout?' (PK)':''}</b><span className={t.winner===t.b?'win':''}>{name(t.b)}</span></>:<small>부전승</small>}
 </div>)}</div>)}{b.champion&&<div className="bracket-round champion"><h4>우승</h4><div className="tie mine-none"><span className="win">🏆 {name(b.champion)}</span></div></div>}</div>;
}
export function SchoolTable({ss,region,mine}:{ss:SchoolSeason,region:string,mine:string}){
 const ids=schoolRank(ss,ss.entrants.filter(e=>e.region===region).map(e=>e.id));
 return <section className="card table-wrap"><h3>{region} 지역 리그</h3><table><thead><tr><th>순위</th><th>학교</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr></thead><tbody>{ids.map((id,i)=>{const t=ss.table[id],e=ss.entrants.find(x=>x.id===id)!;return <tr key={id} className={id===mine?'mine':''}><td>{i+1}</td><td><strong>{e.name}{id===mine?' · 우리 학교':''}</strong></td><td>{t.p}</td><td>{t.w}</td><td>{t.d}</td><td>{t.l}</td><td>{t.gf} : {t.ga}</td><td><b>{t.pts}</b></td></tr>;})}</tbody></table><small className="muted">정규 시즌 상위 16개교가 지역 토너먼트에 진출합니다 (학교 수가 2의 거듭제곱이 아니면 상위 시드 부전승).</small></section>;
}
function ScoutInfo({c,ss}:{c:Career,ss:SchoolSeason}){
 const u=ss.user,avg=u.matches?u.ratingSum/u.matches:0,b=c.world.scoutBonus;
 return <section className="card bracket"><h3>스카우트 평가 (전국대회)</h3>
  <p>전국대회 출전 {u.matches}/{u.team??0}경기 · {u.minutes}분 · 평균 평점 {avg?avg.toFixed(2):'—'} · {u.goals}골 {u.assists}도움</p>
  {ss.mvp&&<p>대회 MVP · <b>{ss.mvp.name}</b> ({ss.mvp.school})</p>}
  {b&&<p>최근 평가 <b>+{b.value.toFixed(1)}</b> ({b.year}년)</p>}
  <small className="muted">32강 +0.5 · 16강 +1 · 8강 +2 · 4강 +3.5 · 준우승 +5 · 우승 +6, MVP +2 (최대 +8). 출전 시간과 평점에 따라 0–100% 반영. 실제 능력치는 바뀌지 않고, 프로 구단의 계약·연봉·역할 평가에만 쓰입니다.</small>
 </section>;
}
function SeasonReview({c,update,onNeedContract}:{c:Career,update:(f:(c:Career)=>void)=>void,onNeedContract?:(message:string)=>void}){
 const w=c.world,recs=w.records.filter(r=>r.year===w.year);
 return <section className="card result"><div><span className="eyebrow">SEASON REVIEW</span><h2>시즌을 마쳤습니다.</h2>
  {recs.map((r,i)=><p className="season-review" key={i}>{r.year} 시즌 · {r.club} · {r.league} <b>{r.rank}위</b> (우승 {r.champion})<br/>출전 {r.appearances}경기 · {r.minutes}분 · {r.goals}골 · {r.assists}도움 · 평균 평점 {r.rating?r.rating.toFixed(2):'—'}</p>)}
  {w.scoutBonus?.year===w.year&&<p>전국대회 스카우트 평가 +{w.scoutBonus.value.toFixed(1)} · 계약 제안에 반영됩니다.</p>}
  <p>누적 수령 연봉 {money(w.wealth)} · 계약 만료·고교 졸업 예정이라면 이적 시장에서 계약을 선택하세요.</p></div>
  <button className="primary" disabled={!!c.match} onClick={()=>{const need=contractNeeded(c);if(need&&onNeedContract)onNeedContract(need);else update(nextSeason);}}>다음 시즌 시작</button></section>;
}
