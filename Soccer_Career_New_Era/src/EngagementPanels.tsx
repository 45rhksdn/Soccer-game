import {missionState,deedsOf,hasSignature,signatureOrder,seasonCompare,SIGNATURES} from './engagement';
import {roleAbility} from './roles';
import type {Match} from './engine';
import type {Career} from './career';

const pct=(v:number,t:number)=>`${Math.round(Math.max(0,Math.min(1,t?v/t:0))*100)}%`;
function Bar({value,target,muted=false}:{value:number,target:number,muted?:boolean}){
 return <span className={`eg-bar${muted?' muted':''}`} aria-hidden="true"><span style={{width:pct(value,target)}}/></span>;
}

/** 0.9 감독 미션: shown on the match screen with live progress. */
export function MissionStrip({m}:{m:Match}){
 const st=missionState(m);if(!st)return null;
 const {mission,value,done,failed}=st,max=mission.cmp==='max';
 const status=done?'달성!':failed?(max?'실패':'미달성'):max?'유지 중':`${Math.min(value,mission.target)} / ${mission.target}`;
 return <div className={`mission-strip${done?' done':failed?' failed':''}`} role="status" aria-label="감독 미션">
  <span className="mission-tag">감독 미션</span>
  <strong>{mission.label}</strong>
  <span className="mission-status">{status}</span>
  {!max&&<Bar value={value} target={mission.target}/>}
 </div>;
}
/** Result line under the full-time report (before 결과 반영). */
export function MissionResult({m}:{m:Match}){
 const st=missionState(m);if(!st)return null;
 return <p className={`mission-result${st.done?' done':''}`}>감독 미션 · {st.mission.label} · {!st.played?'출전 없음':st.done?'달성! 결과 반영 시 감독 신뢰와 보너스를 받습니다.':`미달성 (${st.value}/${st.mission.target})`}</p>;
}

/** 0.9 시그니처 도전 + next ability step, as progress bars. */
export function SignaturePanel({c}:{c:Career}){
 const deeds=deedsOf(c),ability=roleAbility(c.player.a,c.player.pos),next=Math.floor(ability)+1,rec=c.development.missions;
 // Owned signatures and the ones this position earns most naturally come first.
 const list=signatureOrder(c.player.pos).sort((a,b)=>+hasSignature(c,b.id)-+hasSignature(c,a.id));
 const row=(sig:typeof list[number])=>{const own=hasSignature(c,sig.id),v=deeds[sig.deed];
  return <div className={`eg-row${own?' owned':''}`} key={sig.id}>
   <div className="eg-head"><b>{own?'◆ ':''}{sig.id}</b><span>{own?'획득':`${sig.unit} ${Math.min(v,sig.target)} / ${sig.target}`}</span></div>
   {!own&&<Bar value={v} target={sig.target}/>}
   <small>{sig.effect}</small>
  </div>;};
 return <section className="card eg-card signature-card">
  <div className="section-title"><h3>시그니처 도전</h3><span className="pill">{(c.development.signatures??[]).length} / {SIGNATURES.length} 획득</span></div>
  <div className="eg-row next-step"><div className="eg-head"><b>다음 능력치 단계</b><span>{ability.toFixed(1)} → {next}</span></div><Bar value={ability-Math.floor(ability)} target={1}/></div>
  {list.slice(0,4).map(row)}
  <details className="eg-more"><summary>다른 시그니처 {list.length-4}개 보기</summary>{list.slice(4).map(row)}</details>
  <p className="muted eg-foot">감독 미션 {rec?.done??0}회 달성 / {rec?.total??0}회 도전 · 직접 고른 중거리 슛·감아차기 골만 해당 시그니처에 쌓입니다.</p>
 </section>;
}

/** 0.9 라이벌 비교: this season, side by side. */
export function RivalCompare({c}:{c:Career}){
 const r=c.development.rival,{me,rival}=seasonCompare(c);
 const rows:[string,number,number,(n:number)=>string][]=[
  ['시즌 출전',me.apps,rival.apps,n=>`${n}경기`],['시즌 골',me.goals,rival.goals,n=>`${n}골`],
  ['평균 평점',me.avg,rival.avg,n=>n?n.toFixed(2):'—'],['OVR',me.ovr,rival.ovr,n=>n.toFixed(1)],
 ];
 return <section className="card eg-card rival-compare">
  <div className="section-title"><h3>라이벌 비교</h3><span className="pill">{r.retired?'은퇴':`${r.player.name}`}</span></div>
  <div className="rc-legend"><span><i className="me"/>{c.player.name}</span><span><i className="them"/>{r.player.name}</span></div>
  {rows.map(([label,a,b,f])=>{const top=Math.max(a,b,label==='평균 평점'?10:1),lead=a>b?'me':b>a?'them':'';
   return <div className="rc-row" key={label}>
    <div className="eg-head"><b>{label}</b><span className={lead}>{f(a)} <em>vs</em> {f(b)}</span></div>
    <Bar value={a} target={top}/><Bar value={b} target={top} muted/>
   </div>;})}
  <p className="muted eg-foot">{me.ovr>=rival.ovr?'지금은 당신이 앞서 있습니다. 격차를 지켜내세요.':'라이벌이 앞서 있습니다. 이번 주 훈련으로 따라잡으세요.'}</p>
 </section>;
}
