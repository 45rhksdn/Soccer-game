// Trait catalogue and effect layer shared by the user, the rival and every NPC.
// Tune rarity and effects here only; game logic reads traits exclusively through
// the helpers below, so new traits need no changes elsewhere unless they add a new
// kind of effect.
import {ATTRS,random,type Attr,type Attributes,type MatchFx} from './engine';

export type TraitPolarity='positive'|'negative';
/** common ≈ 6 %, rare ≈ 3 % (very strong or seriously harmful). */
export type TraitRarity='common'|'rare';
export type TraitEffects={
  /** Multiplier on daily training growth. */
  trainingGrowth?:number;
  /** Multiplier on fatigue gained from a training day. */
  trainingFatigue?:number;
  /** Multiplier on every injury roll (training and match). */
  injuryChance?:number;
  /** Weeks added to (negative: removed from) each injury, minimum 1 week. */
  injuryWeeks?:number;
  /** Chance per training day / match action of 럭키 and 깨달음 (default 3 %). */
  luckChance?:number;
  /** Chance on match entry of boosting every attribute for that match only. */
  matchBoost?:{chance:number,multiplier:number};
  /** Flat attribute changes applied to the match copy only (never permanent). */
  matchAttributes?:Partial<Record<Attr,number>>;
  /** Physical decline starts this many years earlier, at this multiple of the normal rate. */
  aging?:{yearsEarlier:number,rate:number};
  /** Multiplier on fatigue removed by rest / vacation days. */
  restRecovery?:number;
  /** Growth multiplier on the week's first training day when the rival out-rated you last week. */
  rivalryDrive?:number;
  /** Extra growth (in daily-training units) after the same training is completed this many times in a week; once per week. */
  focusBonus?:{times:number,extra:number};
  /** Banks part of training growth before `startAge`, then releases it weekly into role attributes. */
  lateBloom?:{bankRate:number,startAge:number,weeklyRate:number,minWeekly:number,cap:number};
  /** Effects resolved inside the match engine (see MatchFx in engine.ts). */
  match?:MatchFx;
};
export type TraitDef={
  id:string;
  polarity:TraitPolarity;
  rarity:TraitRarity;
  /** Independent chance of a newly generated player receiving this trait. */
  chance:number;
  summary:string;
  effects:TraitEffects;
  /** Traits that cannot be held together with this one. */
  excludes?:string[];
  /** Icon key for TraitBadges (each trait has its own glyph). */
  icon:string;
};

export const TRAIT_LIMIT=3;
export const RARITY_CHANCE:Record<TraitRarity,number>={common:.06,rare:.03};
export const BASE_LUCK=.03;

export const TRAIT_DEFS=[
  // ── positive ──────────────────────────────────────────────
  {id:'천재',polarity:'positive',rarity:'rare',chance:RARITY_CHANCE.rare,icon:'star',summary:'모든 훈련 성장 ×1.7',effects:{trainingGrowth:1.7}},
  {id:'실전파',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'flame',summary:'경기 진입 시 30% 확률 · 해당 경기 능력치 ×1.3',effects:{matchBoost:{chance:.3,multiplier:1.3}}},
  {id:'행운아',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'clover',summary:'럭키·깨달음 확률 3% → 9%',effects:{luckChance:.09}},
  {id:'노력파',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'dumbbell',summary:'모든 훈련 성장 ×1.2',effects:{trainingGrowth:1.2},excludes:['게으름']},
  {id:'강철 체력',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'battery',summary:'훈련 피로 증가량 ×0.7',effects:{trainingFatigue:.7},excludes:['유리몸']},
  {id:'회복력',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'cross',summary:'부상 확률 ×0.5 · 부상 기간 1주 단축(최소 1주)',effects:{injuryChance:.5,injuryWeeks:-1},excludes:['유리몸']},
  {id:'강심장',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'heart',summary:'경기 중 침착성 +6 · 판단력 +4',effects:{matchAttributes:{composure:6,decisions:4}},excludes:['새가슴']},
  {id:'강철몸',polarity:'positive',rarity:'rare',chance:RARITY_CHANCE.rare,icon:'shield',summary:'훈련 피로 누적 −40% · 부상 확률 −60% · 휴식 시 피로 회복 +50%',effects:{trainingFatigue:.6,injuryChance:.4,restRecovery:1.5},excludes:['유리몸','강철 체력','회복력']},
  {id:'플레이메이커',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'pass',summary:'내 패스를 받은 동료의 다음 슛·패스·돌파 성공 확률 +10% (중첩 불가)',effects:{match:{playmaker:.1}}},
  {id:'분위기 메이커',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'spark',summary:'내 골·도움 후 10분간 팀 전체 체력 소모 −50% · 실점하면 종료',effects:{match:{momentum:{seconds:600,drain:.5}}}},
  {id:'집념',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'fist',summary:'공을 잃고 60초 안에 직접 되찾으면 체력 +6 · 평점 가산(회당 +0.15, 최대 +0.45)',effects:{match:{grit:{energy:6,window:60}}}},
  {id:'라이벌 의식',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'versus',summary:'지난주 라이벌 평점이 더 높으면 이번 주 첫 훈련 성장 ×2',effects:{rivalryDrive:2}},
  {id:'독학파',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'book',summary:'같은 훈련을 주 3회 하면 그 분야 추가 성장(훈련 1회분, 주 1회)',effects:{focusBonus:{times:3,extra:1}}},
  {id:'대기만성',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'sprout',summary:'28세 전 훈련 성장의 30%를 경험으로 적립 → 28세부터 매주 포지션 핵심 능력으로 전환',effects:{lateBloom:{bankRate:.3,startAge:28,weeklyRate:.08,minWeekly:.3,cap:60}},excludes:['조기 노화']},
  // ── negative ──────────────────────────────────────────────
  {id:'유리몸',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'crack',summary:'훈련 피로 증가량 ×1.5 · 부상 확률 ×1.5',effects:{trainingFatigue:1.5,injuryChance:1.5},excludes:['강철 체력','회복력']},
  {id:'게으름',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'zzz',summary:'모든 훈련 성장 ×0.8',effects:{trainingGrowth:.8},excludes:['노력파']},
  {id:'새가슴',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'shake',summary:'경기 중 침착성 −6 · 판단력 −4',effects:{matchAttributes:{composure:-6,decisions:-4}},excludes:['강심장']},
  {id:'조기 노화',polarity:'negative',rarity:'rare',chance:RARITY_CHANCE.rare,icon:'hourglass',summary:'신체 능력 감퇴가 3년 빨리 시작 · 감퇴 속도 ×1.5',effects:{aging:{yearsEarlier:3,rate:1.5}},excludes:['대기만성']},
] as const satisfies readonly TraitDef[];

export type TraitId=typeof TRAIT_DEFS[number]['id'];
export const TRAIT_IDS=TRAIT_DEFS.map(t=>t.id) as TraitId[];
const BY_ID=new Map<string,TraitDef>(TRAIT_DEFS.map(t=>[t.id,t as TraitDef]));
export const traitDef=(id:string):TraitDef|undefined=>BY_ID.get(id);
export const isKnownTrait=(id:unknown):id is TraitId=>typeof id==='string'&&BY_ID.has(id);
/** Legacy single-trait text table kept for older UI/call sites. */
export const TRAIT_TEXT=Object.fromEntries(TRAIT_DEFS.map(t=>[t.id,t.summary])) as Record<TraitId,string>;

/** Accepts the legacy single trait or a list; unknown ids are ignored by effects (kept in saves for forward compatibility). */
export type TraitInput=string|readonly string[]|undefined;
const list=(t:TraitInput):string[]=>t===undefined?[]:typeof t==='string'?[t]:[...t];
const defs=(t:TraitInput)=>list(t).map(traitDef).filter((d):d is TraitDef=>!!d);
const product=(t:TraitInput,key:'trainingGrowth'|'trainingFatigue'|'injuryChance'|'restRecovery')=>defs(t).reduce((n,d)=>n*(d.effects[key]??1),1);

export const trainingGrowthMultiplier=(t:TraitInput)=>product(t,'trainingGrowth');
export const trainingFatigueMultiplier=(t:TraitInput)=>product(t,'trainingFatigue');
export const injuryChanceMultiplier=(t:TraitInput)=>product(t,'injuryChance');
export const luckChance=(t:TraitInput)=>Math.max(BASE_LUCK,...defs(t).map(d=>d.effects.luckChance??0));
export const injuryWeeks=(t:TraitInput,base:number)=>Math.max(1,base+defs(t).reduce((n,d)=>n+(d.effects.injuryWeeks??0),0));
export const hasTrait=(t:TraitInput,id:TraitId)=>list(t).includes(id);
export const restRecoveryMultiplier=(t:TraitInput)=>product(t,'restRecovery');
export const rivalryDrive=(t:TraitInput)=>Math.max(1,...defs(t).map(d=>d.effects.rivalryDrive??1));
export const focusBonus=(t:TraitInput)=>defs(t).find(d=>d.effects.focusBonus)?.effects.focusBonus;
export const lateBloom=(t:TraitInput)=>defs(t).find(d=>d.effects.lateBloom)?.effects.lateBloom;
/** Merged engine-side effects for a player's traits (undefined when there are none). */
export function matchFx(t:TraitInput):MatchFx|undefined{
  const fx:MatchFx={};let any=false;
  for(const d of defs(t))if(d.effects.match){Object.assign(fx,d.effects.match);any=true;}
  return any?fx:undefined;
}

/** Annual physical decline for a player of this age (0 when not yet declining). */
export function agingDecline(t:TraitInput,age:number,startAge:number,perYear:number){
  const a=defs(t).find(d=>d.effects.aging)?.effects.aging;
  const start=startAge-(a?.yearsEarlier??0);
  return age>start?perYear*(a?.rate??1):0;
}

/**
 * Applies match-only effects to a copy of a player's attributes.
 * `roll` decides 실전파-style boosts; returns whether a boost fired.
 */
export function matchAttributes(t:TraitInput,base:Attributes,roll:()=>number){
  const a={...base};let boosted=false;
  for(const d of defs(t)){
    if(d.effects.matchBoost&&roll()<d.effects.matchBoost.chance){boosted=true;for(const k of ATTRS)a[k]=Math.min(100,a[k]*d.effects.matchBoost.multiplier);}
  }
  for(const d of defs(t))for(const [k,v] of Object.entries(d.effects.matchAttributes??{}) as [Attr,number][])a[k]=Math.min(100,Math.max(1,a[k]+v));
  return {a,boosted};
}

/**
 * Rolls 0–TRAIT_LIMIT traits with independent per-trait chances.
 * Conflicting pairs keep one at random; above the limit, random traits are dropped.
 */
export function rollTraits(rng:{seed:number},table:readonly TraitDef[]=TRAIT_DEFS as readonly TraitDef[]):TraitId[]{
  const hit=table.filter(d=>random(rng)<d.chance);
  const kept:TraitDef[]=[];
  // Visit hits in random order so neither side of a conflict (nor catalogue order) is favoured.
  for(const d of hit.map(d=>({d,k:random(rng)})).sort((x,y)=>x.k-y.k).map(x=>x.d)){
    if(kept.some(k=>k.excludes?.includes(d.id)||d.excludes?.includes(k.id)))continue;
    if(kept.length>=TRAIT_LIMIT)break;
    kept.push(d);
  }
  return TRAIT_IDS.filter(id=>kept.some(k=>k.id===id));
}

/** Stable 32-bit seed from a base seed and a text id (FNV-1a), so NPC traits never consume world RNG. */
export function seedFrom(base:number,id:string){
  let h=(2166136261^(base>>>0))>>>0;
  for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619)>>>0;
  return h>>>0;
}
export const npcTraits=(worldSeed:number,playerId:string)=>rollTraits({seed:seedFrom(worldSeed,'npc:'+playerId)});

/** Removes duplicates and over-limit entries while keeping unknown (future) ids. */
export function normalizeTraits(t:unknown):string[]{
  if(!Array.isArray(t))return [];
  const out:string[]=[];
  for(const id of t)if(typeof id==='string'&&!out.includes(id)&&out.length<TRAIT_LIMIT)out.push(id);
  return out;
}
