import type {Career} from './career';
import {clubReasons} from './careerMoments';
export function ConnectionsPanel({c}:{c:Career}){
 const reasons=clubReasons(c);
 return <details className="card career-context"><summary>구단과 나의 이야기</summary><p>{reasons.stay.join(' · ')}</p>{reasons.leave.length>0&&<p>{reasons.leave.join(' · ')}</p>}{c.connections?.events.slice(0,8).map(e=><p key={e.key}><small>{e.year}</small> · {e.text}</p>)}<small>실제 출전과 사건만 기록합니다. 이적해도 기존 기록과 능력은 유지됩니다.</small></details>;
}
