import type {SlotInfo} from './storage';
import {TraitList} from './TraitBadges';

/**
 * 선수 변경하기: up to three independent careers. Switching saves the current
 * career first; starting a new player always targets an explicit slot.
 */
export function PlayerSlots({slots,current,hasCareer,onSwitch,onNew,onRestore,onRestoreArchive}:{slots:SlotInfo[],current:number,hasCareer:boolean,onSwitch:(n:number)=>void,onNew:(n:number)=>void,onRestore:(n:number)=>void,onRestoreArchive:(n:number)=>void}){
  return <>
    <div className="page-heading"><div><div className="eyebrow">CHANGE PLAYER</div><h1>선수 변경하기</h1><p>최대 3명의 선수 커리어를 슬롯별로 따로 보관하고 전환합니다. 전환 전에 현재 선수를 먼저 저장합니다.</p></div></div>
    <div className="player-slots">
      {[1,2,3].map(n=>{const s=slots.find(x=>x.slot===n),sum=s?.summary,isCurrent=hasCareer&&n===current;
        return <section key={n} className={`card player-slot${isCurrent?' current':''}`} aria-label={`슬롯 ${n}`}>
          <span className="eyebrow">SLOT 0{n}{isCurrent?' · 플레이 중':''}</span>
          {sum?<>
            <h3>{sum.name}</h3>
            <p className="muted">{sum.age}세 · {sum.pos} · {sum.team}{sum.school&&sum.school!==sum.team?` (${sum.school} 출신)`:''}<br/>{sum.year} 시즌 · {(sum.week??0)+1}주 차{sum.retired?' · 은퇴':''}</p>
            <TraitList traits={sum.traits} empty="특성 없음"/>
            <div className="slot-actions">
              <button type="button" className="primary full" disabled={isCurrent} onClick={()=>onSwitch(n)}>{isCurrent?'현재 선수':'이 선수로 전환'}</button>
              <button type="button" className="text-button" onClick={()=>onNew(n)}>이 슬롯에 새 선수 시작</button>
            </div>
          </>:s?.broken?<>
            <h3>읽을 수 없는 저장</h3>
            <p className="muted">이 슬롯의 데이터가 손상되었습니다. 직전 백업을 먼저 복원해 보세요.</p>
            <div className="slot-actions">
              <button type="button" className="primary full" onClick={()=>onRestore(n)}>직전 백업 복원</button>
              <button type="button" className="text-button" onClick={()=>onNew(n)}>이 슬롯에 새 선수 시작</button>
            </div>
          </>:<>
            <h3>빈 슬롯</h3>
            <p className="muted">새로운 선수를 이 슬롯에 시작할 수 있습니다. 다른 슬롯의 선수는 그대로 유지됩니다.</p>
            <div className="slot-actions"><button type="button" className="primary full" onClick={()=>onNew(n)}>새 선수 시작</button></div>
          </>}
          {s?.archived&&<button type="button" className="text-button archive" onClick={()=>onRestoreArchive(n)}>교체 전 선수 복원 · {s.archived}</button>}
        </section>;})}
    </div>
    <div className="note">각 슬롯의 능력치·특성·날짜·시즌·라이벌·이적 기록은 서로 독립적입니다. 이미 선수가 있는 슬롯에 새 선수를 시작하면 확인 후 교체하며, 기존 선수는 ‘교체 전 선수’로 따로 보관되어 언제든 복원할 수 있습니다(슬롯마다 가장 최근 1명). 다른 기기로 옮기려면 저장 관리에서 파일로 내보내세요.</div>
  </>;
}
