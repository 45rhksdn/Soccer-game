import {useMemo,useState} from 'react';
import {ATTRS,LABELS} from './engine';
import {REGIONS,SCHOOL_SOURCES,DISCLAIMER,schoolById,searchSchools,type Region,type School} from './schools';
import {generateCandidates,candidateOverall,listNumber,type Candidate,type ScoutState} from './scouting';
import {TraitList} from './TraitBadges';

// Schematic tile map of the 17 시·도 (column, row). Positions are approximate, not geographic.
const TILES:Record<Region,[number,number]>={
  경기:[1,0],강원:[2,0],
  인천:[0,1],서울:[1,1],충북:[2,1],경북:[3,1],
  충남:[0,2],세종:[1,2],대전:[2,2],대구:[3,2],울산:[4,2],
  전북:[1,3],경남:[2,3],부산:[3,3],
  광주:[0,4],전남:[1,4],
  제주:[1,5],
};

export function RegionMap({value,onChange}:{value:Region|null,onChange:(r:Region|null)=>void}){
  return <div className="region-map" role="group" aria-label="시·도 선택 지도 (약도)">
    {REGIONS.map(r=>{const [c,row]=TILES[r],count=searchSchools('',r).length;return <button key={r} type="button" className={value===r?'region-tile selected':'region-tile'} style={{gridColumn:c+1,gridRow:row+1}} aria-pressed={value===r} aria-label={`${r} · 축구부 ${count}개 학교`} onClick={()=>onChange(value===r?null:r)}><strong>{r}</strong><small>{count}</small></button>;})}
  </div>;
}

function Potential({c}:{c:Candidate}){return <span>{c.potentialRange[0]}–{c.potentialRange[1]}</span>;}

export function ScoutPanel({scout,onReroll,onPick,school,setSchool}:{scout:ScoutState,onReroll:(schoolId:string)=>void,onPick:(c:Candidate)=>void,school:string|null,setSchool:(id:string|null)=>void}){
  const [region,setRegion]=useState<Region|null>(()=>school?schoolById(school)?.region??null:null);
  const [query,setQuery]=useState('');
  const results=useMemo(()=>searchSchools(query,region??undefined),[query,region]);
  const selected=school?schoolById(school):undefined;
  const list=selected?listNumber(scout,selected.id):0;
  const candidates=useMemo(()=>selected?generateCandidates(scout.seed,selected.id,list):[],[scout.seed,selected?.id,list]);
  const best=(k:keyof Candidate['a'])=>Math.max(...candidates.map(c=>c.a[k]));
  return <div className="scout">
    <section className="card scout-pick">
      <div className="section-title"><h3>1. 지역과 학교</h3><span className="muted">{region??'전국'} · {results.length}개 학교</span></div>
      <div className="scout-columns">
        <div>
          <RegionMap value={region} onChange={r=>{setRegion(r);}}/>
          <small className="muted">지역 배치는 약도입니다. 지역을 다시 누르면 전국 보기로 돌아갑니다.</small>
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
    {selected&&<SchoolCandidates school={selected} list={list} candidates={candidates} best={best} onReroll={()=>onReroll(selected.id)} onPick={onPick}/>}
    <div className="note scout-note">{DISCLAIMER}</div>
  </div>;
}

function SchoolCandidates({school,list,candidates,best,onReroll,onPick}:{school:School,list:number,candidates:Candidate[],best:(k:keyof Candidate['a'])=>number,onReroll:()=>void,onPick:(c:Candidate)=>void}){
  return <>
    <section className="card">
      <div className="section-title"><h3>2. {school.name} 후보 선수</h3><span className="muted">후보 목록 #{list+1}</span></div>
      <p className="muted scout-source">축구부 확인: {school.sources.map((k,i)=><span key={k}>{i?' · ':''}<a href={SCHOOL_SOURCES[k].url} target="_blank" rel="noreferrer">{SCHOOL_SOURCES[k].title}</a> ({SCHOOL_SOURCES[k].published})</span>)} · 확인일 {school.verifiedAt}</p>
      <div className="candidate-grid">
        {candidates.map(c=><article className="candidate" key={c.id} aria-label={`후보 ${c.name}`}>
          <div className="candidate-top"><span className="tag">{c.pos} / {c.secondary}</span><strong className="candidate-ovr">{candidateOverall(c).toFixed(1)}<small>OVR</small></strong></div>
          <h4>{c.name}</h4>
          <p className="muted">{c.age}세 · {c.height}cm / {c.weight}kg · {c.foot}발<br/>{c.style} · {c.curve}</p>
          <dl className="candidate-facts"><div><dt>잠재력 추정</dt><dd><Potential c={c}/></dd></div><div><dt>학습 효율</dt><dd>{Math.round(c.learning*100)}%</dd></div></dl>
          <TraitList traits={c.traits} empty="특성 없음"/>
          <button type="button" className="primary full" onClick={()=>onPick(c)} aria-label={`${c.name} 선수로 커리어 시작`}>이 선수로 시작</button>
        </article>)}
      </div>
      <div className="scout-actions"><button type="button" className="secondary" onClick={onReroll}>새 후보 목록 생성</button><small className="muted">새 목록을 만들어도 이 학교의 이전 목록은 같은 결과로 다시 만들 수 있으며, 생성 기록은 기기에 저장됩니다.</small></div>
    </section>
    <section className="card table-wrap compare">
      <div className="section-title"><h3>3. 능력치 비교</h3><span className="muted">초록: 후보 중 최고</span></div>
      <table><thead><tr><th>능력치</th>{candidates.map(c=><th key={c.id}>{c.name}<br/><small>{c.pos}</small></th>)}</tr></thead>
        <tbody>{ATTRS.map(k=><tr key={k}><td>{LABELS[k]}</td>{candidates.map(c=><td key={c.id} className={c.a[k]===best(k)?'best':''}>{c.a[k].toFixed(1)}</td>)}</tr>)}
          <tr><td>잠재력 추정</td>{candidates.map(c=><td key={c.id}><Potential c={c}/></td>)}</tr>
        </tbody></table>
    </section>
  </>;
}
