import {it,expect} from 'vitest';
import {newCareer,startCareerMatch,settle,selection} from '../src/career';
import {attributes,createMatch,finishMatch,insightAttempt,ATTRS} from '../src/engine';
import {playToday,applyDaily} from '../src/development';
import {buyEquipment,equip,unequip,effectiveAttributes,equipmentBonus,matchAttributesOf,EQUIPMENT} from '../src/equipment';
import {encode,decode,validate} from '../src/storage';
import {saturdays} from './saturdays';

const profile={name:'장비선수',age:17,pos:'ST' as const,secondary:'LW' as const,foot:'오른',height:180,weight:72,style:'테크니션',curve:'꾸준한 성장형'};
function career(seed=51){const c=saturdays(newCareer(profile,0,seed));c.development.traits=[];c.development.wallet=1000;return c;}
const toMatchDay=(c:ReturnType<typeof career>)=>{for(let i=0;i<5;i++)playToday(c,'rest');};

it('buy, equip, swap and unequip: wallet, inventory and bonus; base attributes never change',()=>{
  const c=career(),base={...c.player.a},potential=c.player.potential;
  buyEquipment(c,'boots-speed');expect(c.development.wallet).toBe(960);expect(()=>buyEquipment(c,'boots-speed')).toThrow('이미 보유');
  expect(()=>equip(c,'boots-touch')).toThrow('보유하지 않은');
  equip(c,'boots-speed');expect(equipmentBonus(c.development.equipment)).toEqual({speed:2,acceleration:2});
  expect(matchAttributesOf(c).speed).toBeCloseTo(base.speed+2,10);expect(c.player.a).toEqual(base);
  buyEquipment(c,'boots-touch');equip(c,'boots-touch'); // same slot: swap
  expect(c.development.equipment!.equipped.boots).toBe('boots-touch');expect(c.development.equipment!.owned).toEqual(['boots-speed','boots-touch']);
  expect(matchAttributesOf(c).speed).toBe(base.speed);expect(matchAttributesOf(c).control).toBeCloseTo(Math.min(100,base.control+2),10);
  buyEquipment(c,'wear-compression');equip(c,'wear-compression');unequip(c,'boots');
  expect(equipmentBonus(c.development.equipment)).toEqual({stamina:3});
  expect(c.player.a).toEqual(base);expect(c.player.potential).toBe(potential);
  const poor=career();poor.development.wallet=10;expect(()=>buyEquipment(poor,'boots-elite')).toThrow('잔액');expect(poor.development.wallet).toBe(10);
});

it('effective attributes are capped at 100 and leave the base object untouched',()=>{
  const a=attributes(99);const e=effectiveAttributes(a,{owned:['boots-elite'],equipped:{boots:'boots-elite'}});
  expect(e.speed).toBe(100);expect(a.speed).toBe(99);for(const k of ATTRS)expect(e[k]).toBeLessThanOrEqual(100);
});

it('selection and the match use base + equipment; the permanent attributes do not',()=>{
  const c=career(52);buyEquipment(c,'boots-strike');equip(c,'boots-strike');
  expect(selection(c).hero.a.shooting).toBeCloseTo(Math.min(100,c.player.a.shooting+3),10);
  toMatchDay(c);const base={...c.player.a};startCareerMatch(c);const m=c.match!;
  if(m.userOnPitch!==false)expect(m.players[m.userId].a.shooting).toBeCloseTo(Math.min(100,base.shooting+3),10);
  expect(m.insight!.base).toEqual(base);
  expect(()=>equip(c,'boots-strike')).toThrow('경기 중');expect(()=>unequip(c,'boots')).toThrow('경기 중');expect(()=>buyEquipment(c,'gear-band')).toThrow('경기 중');
});

it('insight at final 100: base below 100 still improves to exactly 100, never beyond',()=>{
  const c=career(53);c.player.a.shooting=98;c.player.a.composure=98;buyEquipment(c,'boots-strike');equip(c,'boots-strike');
  toMatchDay(c);startCareerMatch(c);const m=c.match!;
  expect(m.userOnPitch).not.toBe(false);
  const p=m.players[m.userId];expect(p.a.shooting).toBe(100);
  m.insight!.chance=1;for(let i=0;i<40;i++)insightAttempt(m,p,['shooting']);
  expect(m.insight!.gains.shooting).toBe(2); // 98 + 2 = 100 (base), even though the match copy was already 100
  finishMatch(m);settle(c);expect(c.player.a.shooting).toBe(100);
  unequip(c,'boots');expect(c.player.a.shooting).toBe(100);
});

it('insight cap uses the base: deterministic engine check without selection',()=>{
  const c=career(54);c.player.a.passing=97;buyEquipment(c,'boots-elite');equip(c,'boots-elite');
  const m=createMatch(3,{name:'x',pos:'CM',a:matchAttributesOf(c),energy:100});m.insight={chance:1,gains:{},events:[],base:{...c.player.a}};
  const p=m.players[m.userId];expect(p.a.passing).toBe(99);
  for(let i=0;i<10;i++)insightAttempt(m,p,['passing']);expect(m.insight!.gains.passing).toBe(3);
});

it('training at final 100 with equipment keeps growing the base; unequipping keeps that growth',()=>{
  const c=career(55);c.player.a.speed=98.5;c.player.potential=99.5;buyEquipment(c,'boots-speed');equip(c,'boots-speed');
  expect(matchAttributesOf(c).speed).toBe(100);
  for(let i=0;i<20;i++){c.player.energy=100;c.player.fatigue=0;applyDaily(c,c.player,'running',[]);}
  expect(c.player.a.speed).toBeGreaterThan(98.5);expect(c.player.a.speed).toBeLessThanOrEqual(99.5);
  const grown=c.player.a.speed;unequip(c,'boots');expect(c.player.a.speed).toBe(grown);expect(matchAttributesOf(c).speed).toBe(grown);
  expect(c.player.potential).toBe(99.5);
});

it('mid-match save/restore keeps equipment and gives the same result',()=>{
  const c=career(56);buyEquipment(c,'boots-touch');equip(c,'boots-touch');buyEquipment(c,'gear-band');equip(c,'gear-band');
  toMatchDay(c);startCareerMatch(c);
  const restored=decode(encode(c));expect(restored.development.equipment).toEqual(c.development.equipment);expect(restored.match).toEqual(c.match);
  for(const x of [c,restored]){finishMatch(x.match!);settle(x);}
  expect(restored).toEqual(c);
});

it('save validation: equipped items must be owned and in their own slot; older saves have no equipment',()=>{
  const c=career(57);delete c.development.equipment;expect(()=>validate(c)).not.toThrow();
  const bad=structuredClone(c);bad.development.equipment={owned:[],equipped:{boots:'boots-speed'}};expect(()=>validate(bad)).toThrow('손상');
  const wrongSlot=structuredClone(c);wrongSlot.development.equipment={owned:['gear-band'],equipped:{boots:'gear-band'}};expect(()=>validate(wrongSlot)).toThrow('손상');
  expect(new Set(EQUIPMENT.map(e=>e.id)).size).toBe(EQUIPMENT.length);
});
