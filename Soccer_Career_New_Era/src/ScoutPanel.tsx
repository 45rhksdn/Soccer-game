import {growthOutlook,strengths} from './origins';
import {scoutLevel,type Legacy} from './legacy';
import {useMemo,useState} from 'react';
import {ATTRS,LABELS} from './engine';
import {REGIONS,SCHOOL_SOURCES,DISCLAIMER,schoolById,searchSchools,type Region,type School} from './schools';
import {generateCandidates,candidateOverall,candidateStory,listNumber,type Candidate,type ScoutState} from './scouting';
import {TraitList} from './TraitBadges';

export {KoreaMap as RegionMap} from './KoreaMap';
import {KoreaMap as RegionMap} from './KoreaMap';

function Potential({c}:{c:Candidate}){return <span>{growthOutlook(c,c.id).label}</span>;}

export function ScoutPanel({scout,onReroll,onPick,school,setSchool,potentialBonus=0,legacy}:{legacy?:Legacy|null,scout:ScoutState,potentialBonus?:number,onReroll:(schoolId:string)=>void,onPick:(c:Candidate)=>void,school:string|null,setSchool:(id:string|null)=>void}){
  const [region,setRegion]=useState<Region|null>(()=>school?schoolById(school)?.region??null:null);
  const [query,setQuery]=useState('');
  const results=useMemo(()=>searchSchools(query,region??undefined),[query,region]);
  const selected=school?schoolById(school):undefined;
  const list=selected?listNumber(scout,selected.id):0;
  const candidates=useMemo(()=>selected?generateCandidates(scout.seed,selected.id,list,6+Math.min(2,scoutLevel(legacy)),potentialBonus):[],[scout.seed,selected?.id,list,potentialBonus,legacy]);
  const best=(k:keyof Candidate['a'])=>Math.max(...candidates.map(c=>c.a[k]));
  return <div className="scout">
    <section className="card scout-pick">
      <div className="section-title"><h3>1. 지역과 학교</h3><span className="muted">{region??'전국'} · {results.length}개 학교</span></div>
      <div className="scout-columns">
        <div>
          <RegionMap value={region} onChange={r=>{setRegion(r);}}/>
          
        </div>
        <div className="school-search">
          <label>학교 검색<input type="search" value={query} placeholder="예: 보인, 제주, 수원삼성" onChange={e=>setQuery(e.target.value)} aria-label="학교 검색"/></label>
          <ul className="school-results" aria-label="축구부 운영 고등학교 목록">
            {results.map(s=><li key={s.id}><button type="button" className={selected?.id===s.id?'school-row selected':'school-row'} aria-pressed={selected?.id===s.id} onClick={()=>setSchool(s.id)}>
              <strong>{s.name}</strong><small>{s.region}{s.affiliation?` · ${s.affiliation}`:''}</small><span aria-hidden="true">{selected?.id===s.id?'●':'○'}</span>
            </button></li>)}
            {!results.length&&<li className="muted">검색 결과가 없습니다.</li>}
          </ul>
        </div>
      </div>
    </section>
    {selected&&<SchoolCandidates school={selected} list={list} candidates={candidates} best={best} onReroll={()=>onReroll(selected.id)} onPick={onPick} scoutExperience={scoutLevel(legacy)}/>}
    <div className="note scout-note">{DISCLAIMER}</div>
  </div>;
}

function SchoolCandidates({school,list,candidates,best,onReroll,onPick,scoutExperience}:{scoutExperience:number,school:School,list:number,candidates:Candidate[],best:(k:keyof Candidate['a'])=>number,onReroll:()=>void,onPick:(c:Candidate)=>void}){
  return <>
    <section className="card">
      <div className="section-title"><h3>2. {school.name} 후보 선수 <span className="tag fictional">가상 선수</span></h3><span className="muted">후보 목록 #{list+1}</span></div>
      <p className="note fictional-note">학교는 실제 축구부 운영 학교이고, 아래 후보는 모두 게임이 만든 <strong>가상 인물</strong>입니다. 이름·신체·능력치는 실존 선수와 관계없습니다.</p>
      <details className="scout-source"><summary>학교 정보 출처</summary><p className="muted">축구부 확인: {school.sources.map((k,i)=><span key={k}>{i?' · ':''}<a href={SCHOOL_SOURCES[k].url} target="_blank" rel="noreferrer">{SCHOOL_SOURCES[k].title}</a> ({SCHOOL_SOURCES[k].published})</span>)} · 확인일 {school.verifiedAt}</p></details>
      <div className="candidate-grid">
        {candidates.map(c=><article className="candidate" key={c.id} aria-label={`후보 ${c.name}`}>
          <div className="candidate-top"><span className="tag">{c.pos} / {c.secondary}</span><span className="tag fictional" title="게임이 만든 가상 선수">가상</span><strong className="candidate-ovr">{candidateOverall(c).toFixed(1)}<small>OVR</small></strong></div>
          <h4>{c.name}</h4>
          {(()=>{const t=candidateStory(c,school);return <><div className="candidate-story"><p className="story-headline">{t.headline}</p>{' '}<p>{t.chapters[0]}</p></div>
            <details className="story-more"><summary>사연 더 읽기</summary><div className="story-rest">{t.chapters.slice(1).map((x,i)=><p key={i}>{x}</p>)}<blockquote>{t.quote}<cite>{school.name} 축구부 코치</cite></blockquote></div></details></>;})()}
          <p className="muted">{c.age}세 · {c.height}cm / {c.weight}kg · {c.foot}발<br/>{c.style} · 강점 {strengths(c.a)}</p>
          <p className="candidate-outlook">{growthOutlook(c,c.id,0,scoutExperience).label}</p><details className="candidate-detail"><summary>코치의 관찰과 특성 설명</summary><p>{growthOutlook(c,c.id,0,scoutExperience).note}</p><TraitList traits={c.traits} detail empty="특성 없이도 훈련과 경기 경험으로 성장할 수 있습니다."/></details>
          <TraitList traits={c.traits} empty="특성 없음"/>
          <button type="button" className="primary full" onClick={()=>onPick(c)} aria-label={`${c.name} 선수로 커리어 시작`}>이 선수로 시작</button>
        </article>)}
      </div>
      <div className="scout-actions"><button type="button" className="secondary" onClick={onReroll}>새 후보 목록 생성</button><small className="muted">새 목록을 만들어도 이 학교의 이전 목록은 같은 결과로 다시 만들 수 있으며, 생성 기록은 기기에 저장됩니다.</small></div>
    </section>
    <details className="card table-wrap compare"><summary>후보 능력치 자세히 비교</summary>
      <div className="section-title"><h3>3. 능력치 비교</h3><span className="muted">초록: 후보 중 최고</span></div>
      <table><thead><tr><th>능력치</th>{candidates.map(c=><th key={c.id}>{c.name}<br/><small>{c.pos}</small></th>)}</tr></thead>
        <tbody>{ATTRS.map(k=><tr key={k}><td>{LABELS[k]}</td>{candidates.map(c=><td key={c.id} className={c.a[k]===best(k)?'best':''}>{c.a[k].toFixed(1)}</td>)}</tr>)}
          <tr><td>성장 전망</td>{candidates.map(c=><td key={c.id}><Potential c={c}/></td>)}</tr>
        </tbody></table>
    </details>
  </>;
}
