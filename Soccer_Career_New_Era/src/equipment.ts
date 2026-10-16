// Equipment (0.5). The player's permanent attributes stay in `player.a` (the *base*);
// equipment only adds a separate bonus that is applied to match copies of the player.
// So training, 깨달음 and the potential cap always look at the base value: a player
// shown at 100 thanks to equipment keeps growing while the base is below 100, and
// unequipping removes only the bonus.
import {ATTRS,type Attr,type Attributes} from './engine';
import type {Career} from './career';

export type EquipSlot='boots'|'wear'|'gear';
export const EQUIP_SLOTS:{id:EquipSlot,label:string}[]=[{id:'boots',label:'축구화'},{id:'wear',label:'트레이닝 웨어'},{id:'gear',label:'보조 장비'}];
export type EquipmentDef={id:string,slot:EquipSlot,name:string,price:number,bonus:Partial<Record<Attr,number>>};
/** Prices are in 만원 (the development wallet). */
export const EQUIPMENT:readonly EquipmentDef[]=[
  {id:'boots-speed',slot:'boots',name:'스피드 축구화',price:40,bonus:{speed:2,acceleration:2}},
  {id:'boots-touch',slot:'boots',name:'터치 축구화',price:40,bonus:{control:2,dribbling:2}},
  {id:'boots-strike',slot:'boots',name:'스트라이커 축구화',price:90,bonus:{shooting:3,composure:1}},
  {id:'boots-elite',slot:'boots',name:'엘리트 축구화',price:220,bonus:{speed:2,control:2,shooting:2,passing:2}},
  {id:'wear-compression',slot:'wear',name:'컴프레션 웨어',price:30,bonus:{stamina:3}},
  {id:'wear-power',slot:'wear',name:'파워 트레이닝 슈트',price:70,bonus:{strength:3,stamina:1}},
  {id:'wear-pro',slot:'wear',name:'프로 경기복',price:160,bonus:{stamina:2,strength:2,acceleration:1}},
  {id:'gear-shin',slot:'gear',name:'경량 정강이 보호대',price:25,bonus:{defending:2,strength:1}},
  {id:'gear-focus',slot:'gear',name:'집중 헤어밴드',price:60,bonus:{composure:3}},
  {id:'gear-band',slot:'gear',name:'경기 분석 스마트 밴드',price:80,bonus:{vision:2,decisions:2}},
];
const BY_ID=new Map(EQUIPMENT.map(e=>[e.id,e]));
export const equipmentDef=(id:string|undefined)=>id?BY_ID.get(id):undefined;
export type EquipmentState={owned:string[],equipped:Partial<Record<EquipSlot,string>>};
export const emptyEquipment=():EquipmentState=>({owned:[],equipped:{}});
export const bonusText=(b:Partial<Record<Attr,number>>,labels:Record<Attr,string>)=>ATTRS.filter(k=>b[k]).map(k=>`${labels[k]} +${b[k]}`).join(' · ');

/** Total bonus of the equipped items (unknown ids are ignored). */
export function equipmentBonus(s:EquipmentState|undefined):Partial<Record<Attr,number>>{
  const out:Partial<Record<Attr,number>>={};
  for(const id of Object.values(s?.equipped??{})){const d=equipmentDef(id);if(!d)continue;for(const [k,v] of Object.entries(d.bonus) as [Attr,number][])out[k]=(out[k]??0)+v;}
  return out;
}
/** Match-day attributes: base + equipment, capped at 100. The base object is never modified. */
export function effectiveAttributes(base:Attributes,s:EquipmentState|undefined):Attributes{
  const b=equipmentBonus(s),a={...base};
  for(const k of ATTRS)if(b[k])a[k]=Math.min(100,a[k]+b[k]!);
  return a;
}
/** The user's match-day attributes. */
export const matchAttributesOf=(c:Career)=>effectiveAttributes(c.player.a,c.development.equipment);

function state(c:Career){
  if(c.match)throw Error('경기 중에는 장비를 바꿀 수 없습니다.');
  if(c.world.phase==='retired')throw Error('은퇴한 커리어입니다.');
  return c.development.equipment??=emptyEquipment();
}
export function buyEquipment(c:Career,id:string){
  const d=equipmentDef(id);if(!d)throw Error('알 수 없는 장비입니다.');
  const s=state(c);if(s.owned.includes(id))throw Error('이미 보유한 장비입니다.');
  if(c.development.wallet<d.price)throw Error(`잔액이 부족합니다. (${d.price}만원 필요)`);
  c.development.wallet-=d.price;s.owned.push(id);
}
/** Equips an owned item; an item already in that slot is swapped out (kept in the inventory). */
export function equip(c:Career,id:string){
  const d=equipmentDef(id);if(!d)throw Error('알 수 없는 장비입니다.');
  const s=state(c);if(!s.owned.includes(id))throw Error('보유하지 않은 장비입니다.');
  s.equipped[d.slot]=id;
}
export function unequip(c:Career,slot:EquipSlot){const s=state(c);delete s.equipped[slot];}
/** Save validation: owned ids are strings without duplicates, equipped items are owned and in their own slot. */
export function validEquipment(v:unknown):boolean{
  if(v===undefined)return true;
  const s=v as EquipmentState;
  if(!s||typeof s!=='object'||!Array.isArray(s.owned)||!s.equipped||typeof s.equipped!=='object')return false;
  if(s.owned.some(x=>typeof x!=='string')||new Set(s.owned).size!==s.owned.length)return false;
  return Object.entries(s.equipped).every(([slot,id])=>typeof id==='string'&&s.owned.includes(id)&&(!equipmentDef(id)||equipmentDef(id)!.slot===slot));
}
