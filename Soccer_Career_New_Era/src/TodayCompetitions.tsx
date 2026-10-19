import type {Career} from './career';
import {clubOf,sortedTable,LEAGUES,type Bracket} from './world';
import {clubName} from './season';
import {SchoolTable,BracketView} from './SeasonPanel';
export function TodayCompetitions({c}:{c:Career}){
 const w=c.world,club=clubOf(w),s=w.calendar?w.season:undefined,ss=s?.school,me=ss?.entrants.find(e=>e.clubId===w.clubId);
 const name=(id:string)=>ss?.entrants.find(e=>e.id===id)?.name??clubName(w,id);
 const mine=(id:string)=>id===w.clubId||id===me?.id||id==='KOR';
 const brackets:[string,Bracket|undefined][]=club.league===0?[[`${me?.region??''} 지역 토너먼트`,me?ss?.regional[me.region]:undefined],['전국 고교대회',ss?.national]]:[[`${LEAGUES[club.league]} 컵`,s?.cups[club.league]],...Object.entries(s?.continental??{}).map(([key,b])=>[`대륙 클럽 컵 · ${key}`,b] as [string,Bracket]),['국제 초청대회',s?.national]];
 return <div className="today-competitions" aria-label="리그 순위 및 토너먼트 현황">
 <h3>리그 순위표</h3>
 {ss&&me?<SchoolTable ss={ss} region={me.region} mine={me.id}/>:<div className="table-wrap"><table><thead><tr><th>순위</th><th>팀</th><th>경기</th><th>득실</th><th>승점</th></tr></thead><tbody>{sortedTable(w,club.league).map((t,i)=><tr key={t.id} className={t.id===w.clubId?'mine':''}><td>{i+1}</td><td>{name(t.id)}{t.id===w.clubId?' · 소속팀':''}</td><td>{t.played}</td><td>{t.gf-t.ga}</td><td>{t.points}</td></tr>)}</tbody></table></div>}
 <h3>토너먼트 현황판</h3>
 {!s?<p className="muted">이전 저장의 시즌을 진행 중입니다. 다음 시즌부터 새 대회 대진이 표시됩니다.</p>:brackets.map(([title,b])=><details key={title} className="today-bracket" open={!!b}><summary>{title}{b?.champion?` · 우승 ${name(b.champion)}`:b?' · 진행 현황':' · 대진 준비 중'}</summary>{b?<BracketView b={b} name={name} mine={mine}/>:<p className="muted">진출팀이 확정되면 실제 대진과 결과가 표시됩니다.</p>}</details>)}
 </div>;
}
