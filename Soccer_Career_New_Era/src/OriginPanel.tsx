import type {Career} from './career';
import {growthOutlook,playerIntroduction,rivalIntroduction} from './origins';
import {roleAbility} from './roles';
import {legacyCount,type Legacy} from './legacy';
export function OriginPanel({c,legacy}:{c:Career,legacy:Legacy|null}){
 const outlook=growthOutlook(c.player,c.id??c.player.name,c.development.notes.length+c.history.length);
 const mentor=legacy?.retired.filter(x=>x.qualified!==false).at(-1);
 const previous=legacy?.retired.filter(x=>x.id!==c.id&&x.pos===c.player.pos).flatMap(x=>(x.ageRecords??[]).filter(r=>r.age===c.player.age).map(r=>({name:x.name,overall:r.overall}))).slice(-3)??[];
 return <details className="card origin-detail"><summary>선수 이야기 · {outlook.label}</summary><p>{c.story?.intro??playerIntroduction(c.player)}</p><p className="muted">{outlook.note}</p><p>{rivalIntroduction(c)}</p>{mentor&&<p className="mentor-note">선배 {mentor.name}: “한 번의 결과보다, 네가 쌓아 가는 시간을 믿어.”</p>}{previous.length>0&&<p className="muted">같은 나이 · 같은 포지션의 시즌 말 기록: {previous.map(x=>`${x.name} OVR ${x.overall.toFixed(1)}`).join(' / ')} · 나의 현재 OVR {roleAbility(c.player.a,c.player.pos).toFixed(1)}</p>}</details>;
}
export function LegacyArchive({legacy}:{legacy?:Legacy|null}){
 if(!legacy?.retired.length)return null;
 return <details className="legacy-archive"><summary>학교 명예의 전당 · {legacy.retired.length}명의 여정</summary><ul>{legacy.retired.slice().reverse().map(e=><li key={e.id}><strong>{e.name}</strong> · {e.school??'출신 학교 기록 없음'} · {e.pos}<small>{e.year}년 은퇴 · {e.age}세{e.seasons!==undefined?` · ${e.seasons}시즌`:''}{e.qualified===false?' · 기록 보존 (성장 보상 미충족)':''}</small></li>)}</ul><p className="muted">발굴 경험 {legacyCount(legacy)}회 · 3시즌 이상 완료 후 은퇴하면 다음 세대의 관찰 정보가 풍부해집니다. 기존 보상은 유지됩니다.</p></details>;
}
