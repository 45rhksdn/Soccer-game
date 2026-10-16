import {LABELS} from './engine';
import {EQUIPMENT,EQUIP_SLOTS,equipmentDef,bonusText,type EquipSlot} from './equipment';
import type {Career} from './career';

/** Shop + equipped slots. Bonuses apply to matches only; the base attributes keep growing on their own. */
export function EquipmentPanel({c,onBuy,onEquip,onUnequip}:{c:Career,onBuy:(id:string)=>void,onEquip:(id:string)=>void,onUnequip:(slot:EquipSlot)=>void}){
  const d=c.development,s=d.equipment??{owned:[],equipped:{}},locked=!!c.match||c.world.phase==='retired';
  return <section className="card equipment" aria-labelledby="equipment-title">
    <div className="section-title"><h3 id="equipment-title">장비</h3><span className="muted">잔액 {d.wallet.toLocaleString()}만원</span></div>
    <p className="muted">장비 보너스는 경기에만 더해집니다. 기본 능력치는 따로 저장되어 훈련·깨달음으로 계속 성장하고, 장비를 해제해도 그대로 유지됩니다.</p>
    <div className="equip-slots">
      {EQUIP_SLOTS.map(slot=>{const item=equipmentDef(s.equipped[slot.id]);return <div key={slot.id} className="equip-slot">
        <small>{slot.label}</small><strong>{item?.name??'없음'}</strong>{item&&<span className="muted">{bonusText(item.bonus,LABELS)}</span>}
        {item&&<button type="button" className="text-button" disabled={locked} onClick={()=>onUnequip(slot.id)} aria-label={`${slot.label} 해제`}>해제</button>}
      </div>;})}
    </div>
    <ul className="equip-shop">
      {EQUIPMENT.map(e=>{const owned=s.owned.includes(e.id),on=s.equipped[e.slot]===e.id;return <li key={e.id}>
        <div><strong>{e.name}</strong> <small className="muted">{EQUIP_SLOTS.find(x=>x.id===e.slot)!.label}</small><br/><span className="muted">{bonusText(e.bonus,LABELS)}</span></div>
        {on?<span className="pill">장착 중</span>
        :owned?<button type="button" className="secondary" disabled={locked} onClick={()=>onEquip(e.id)} aria-label={`${e.name} 장착`}>장착</button>
        :<button type="button" className="secondary" disabled={locked||d.wallet<e.price} onClick={()=>onBuy(e.id)} aria-label={`${e.name} 구매`}>{e.price}만원 구매</button>}
      </li>;})}
    </ul>
    {c.match&&<p className="muted">경기 중에는 장비를 바꿀 수 없습니다.</p>}
  </section>;
}
