import {growthOutlook,strengths} from './origins';
import {scoutLevel,type Legacy} from './legacy';
import {useMemo,useState} from 'react';
import {ATTRS,LABELS,type Position} from './engine';
import {potentialForecast} from './forecast';
import {REGIONS,SCHOOL_SOURCES,DISCLAIMER,schoolById,searchSchools,type Region,type School} from './schools';
import {generateCandidates,candidateOverall,candidateStory,listNumber,scoutKey,FIELD_POSITIONS,type Candidate,type ScoutState} from './scouting';
import {TraitList} from './TraitBadges';

export {KoreaMap as RegionMap} from './KoreaMap';
import {KoreaMap as RegionMap} from './KoreaMap';

/** 0.14 wished positions in the creation flow. */
export const POSITION_LABEL:Record<string,string>={ST:'스트라이커',LW:'왼쪽 윙어',RW:'오른쪽 윙어',CM:'중앙 미드필더',LB:'왼쪽 풀백',RB:'오른쪽 풀백',CB:'센터백'};

export function ScoutPanel({scout,onReroll,onPick,school,setSchool,potentialBonus=0,legacy}:{legacy?:Legacy|null,scout:ScoutState,potentialBonus?:number,onReroll:(schoolId:string)=>void,onPick:(c:Candidate)=>void,school:string|null,setSchool:(id:string|null)=>void}){
  const [region,setRegion]=useState<Region|null>(()=>school?schoolById(school)?.region??null:null);
  const [query,setQuery]=useState('');
  const results=useMemo(()=>searchSchools(query,region??undefined),[query,region]);
  const selected=school?schoolById(school):undefined;
  const [wish,setWish]=useState<Position|null>(null);
  const key=selected&&wish?scoutKey(selected.id,wish):null;
  const list=key?listNumber(scout,key):0;
  // 0.14 one student at a time: the chosen school, the wished position, then a story to get to know.
  const student=useMemo(()=>selected&&wish?generateCandidates(scout.seed,selected.id,list,1,potentialBonus,wish)[0]:null,[scout.seed,selected?.id,wish,list,potentialBonus]);
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
    {selected&&<section className="card wish-position">
      <div className="section-title"><h3>2. 희망 포지션</h3><span className="muted">{selected.name} 축구부</span></div>
      <div className="position-picks" role="radiogroup" aria-label="희망 포지션">{FIELD_POSITIONS.map(p=><button key={p} type="button" role="radio" aria-checked={wish===p} className={wish===p?'on':''} onClick={()=>setWish(p)}><strong>{p}</strong><small>{POSITION_LABEL[p]}</small></button>)}</div>
      {!wish&&<p className="muted">포지션을 고르면 그 자리에서 뛰는 학생 한 명을 만나게 됩니다.</p>}
    </section>}
    {selected&&student&&<StudentCard school={selected} list={list} c={student} onReroll={()=>onReroll(key!)} onPick={onPick} scoutExperience={scoutLevel(legacy)}/>}
    <div className="note scout-note">{DISCLAIMER}</div>
  </div>;
}

function StudentCard({school,list,c,onReroll,onPick,scoutExperience}:{scoutExperience:number,school:School,list:number,c:Candidate,onReroll:()=>void,onPick:(c:Candidate)=>void}){
  const t=candidateStory(c,school),outlook=growthOutlook(c,c.id,0,scoutExperience);
  return <section className="card student" aria-label={`후보 ${c.name}`}>
    <div className="section-title"><h3>3. {school.name}에서 만난 학생 <span className="tag fictional">가상 선수</span></h3><span className="muted">{list+1}번째 만남</span></div>
    <article className="candidate student-card">
      <div className="candidate-top"><span className="tag">{c.pos} / {c.secondary}</span><span className="tag fictional" title="게임이 만든 가상 선수">가상</span><strong className="candidate-ovr">{candidateOverall(c).toFixed(1)}<small>OVR</small></strong></div>
      <h4>{c.name}</h4>
      <p className="muted">{c.age}세 · {c.height}cm / {c.weight}kg · {c.foot}발 · {c.style} · 강점 {strengths(c.a)}</p>
      <div className="candidate-story"><p className="story-headline">{t.headline}</p>{' '}<p>{t.chapters[0]}</p></div>
      <div className="story-rest">{t.chapters.slice(1).map((x,i)=><p key={i}>{x}</p>)}<blockquote>{t.quote}<cite>{school.name} 축구부 코치</cite></blockquote></div>
      <div className="student-traits"><strong>타고난 특성</strong><TraitList traits={c.traits} detail empty="눈에 띄는 특성은 없습니다. 훈련과 경기 경험으로 자신만의 색을 만들어 갈 선수입니다."/></div>
      <p className="forecast">{potentialForecast(c.potentialRange,scoutExperience)}</p>
      <p className="candidate-outlook">{outlook.label}</p>
      <details className="candidate-detail"><summary>코치의 관찰과 능력치</summary><p>{outlook.note}</p>
        <table className="student-attrs"><tbody>{ATTRS.map(k=><tr key={k}><td>{LABELS[k]}</td><td>{c.a[k].toFixed(1)}</td></tr>)}</tbody></table></details>
      <button type="button" className="primary full" onClick={()=>onPick(c)} aria-label={`${c.name} 선수로 커리어 시작`}>이 학생과 함께 시작</button>
    </article>
    <div className="scout-actions"><button type="button" className="secondary" onClick={onReroll}>다른 학생 만나 보기</button><small className="muted">이전에 만난 학생은 같은 학교·포지션에서 언제든 같은 모습으로 다시 만들 수 있고, 만남 기록은 기기에 저장됩니다.</small></div>
    <details className="scout-source"><summary>학교 정보 출처</summary><p className="muted">축구부 확인: {school.sources.map((k,i)=><span key={k}>{i?' · ':''}<a href={SCHOOL_SOURCES[k].url} target="_blank" rel="noreferrer">{SCHOOL_SOURCES[k].title}</a> ({SCHOOL_SOURCES[k].published})</span>)} · 확인일 {school.verifiedAt}</p></details>
  </section>;
}

