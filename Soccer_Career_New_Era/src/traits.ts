// Trait catalogue and effect layer shared by the user, the rival and every NPC.
// Tune rarity and effects here only; game logic reads traits exclusively through
// the helpers below, so new traits need no changes elsewhere unless they add a new
// kind of effect.
import {ATTRS,random,type Attr,type Attributes,type MatchFx} from './engine';

export type TraitPolarity='positive'|'negative';
/** common / rare chance per trait (see RARITY_CHANCE). With 34 traits, 3 % / 1.5 % keeps about a third of players trait-free. */
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
  /**
   * Luck multiplier shared by training 럭키 and match 깨달음 (행운아 ×3, 불운 ×⅓).
   * The base chances live in TRAINING_LUCK_BY_AGE and INSIGHT_CHANCE.
   */
  luck?:number;
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
  /** Multiplier on positive coach-trust gains (training and match ratings). */
  trustGain?:number;
  /** Multiplier on training growth while playing abroad (club league ≥ 2). */
  abroadGrowth?:number;
  /** Flat match-copy attribute changes in non-league matches (cups, continental, national team). */
  bigMatchAttributes?:Partial<Record<Attr,number>>;
  /** Attribute multiplier when entering a match from the bench. */
  superSub?:number;
  /** Name used in news when a matchBoost fires (e.g. 실전파 발동!). */
  boostNews?:string;
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
// v0.13 preserves rare/common appearance rates while reducing extreme effects.
// 0.4.0 started at 6 % / 3 % with 11 traits. With 34 traits that would leave only ~13 % of players
// trait-free, so the per-trait chance was halved (ratio kept). Change these two numbers to retune.
export const RARITY_CHANCE:Record<TraitRarity,number>={common:.03,rare:.015};
/** @deprecated 0.4 combined 럭키·깨달음 chance; kept only for older imports. */
export const BASE_LUCK=.03;
/** 깨달음: chance per match action attempt (행운아 ×1.5 = 0.75 %, 불운 ×0.75 = 0.375 %). */
export const INSIGHT_CHANCE=.005;
/** 훈련 럭키: chance per training day by age (≤20 · 21–24 · 25–32 · 33+). */
export const TRAINING_LUCK_BY_AGE:readonly {maxAge:number,chance:number}[]=[{maxAge:20,chance:.045},{maxAge:24,chance:.035},{maxAge:32,chance:.025},{maxAge:Infinity,chance:.005}];
export const LUCKY_MULTIPLIER=1.5,UNLUCKY_MULTIPLIER=.75;

export const TRAIT_DEFS=[
  // ── positive ──────────────────────────────────────────────
  {id:'천재',polarity:'positive',rarity:'rare',chance:RARITY_CHANCE.rare,icon:'star',summary:'훈련에서 남다른 배움의 속도를 보입니다.',effects:{trainingGrowth:1.25}},
  {id:'실전파',polarity:'positive',rarity:'rare',chance:RARITY_CHANCE.rare,icon:'flame',summary:'실전에서 뜻밖의 힘을 발휘하기도 합니다.',effects:{matchBoost:{chance:.3,multiplier:1.10},boostNews:'실전파 발동! 오늘은 몸놀림이 남다릅니다.'}},
  {id:'행운아',polarity:'positive',rarity:'rare',chance:RARITY_CHANCE.rare,icon:'clover',summary:'훈련과 경기에서 특별한 성장의 순간을 더 자주 만납니다.',effects:{luck:LUCKY_MULTIPLIER},excludes:['불운']},
  {id:'노력파',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'dumbbell',summary:'꾸준한 훈련에서 더 많은 것을 얻습니다.',effects:{trainingGrowth:1.12},excludes:['게으름']},
  {id:'강철 체력',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'battery',summary:'고된 훈련에도 쉽게 지치지 않습니다.',effects:{trainingFatigue:.85},excludes:['유리몸']},
  {id:'회복력',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'cross',summary:'부상에 강하고 회복이 빠릅니다.',effects:{injuryChance:.8,injuryWeeks:-1},excludes:['유리몸']},
  {id:'강심장',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'heart',summary:'경기에서 침착하게 상황을 읽습니다.',effects:{matchAttributes:{composure:6,decisions:4}},excludes:['새가슴']},
  {id:'강철몸',polarity:'positive',rarity:'rare',chance:RARITY_CHANCE.rare,icon:'shield',summary:'피로를 잘 견디고 부상에 강하며 휴식도 잘 활용합니다.',effects:{trainingFatigue:.8,injuryChance:.7,restRecovery:1.15},excludes:['유리몸','강철 체력','회복력']},
  {id:'플레이메이커',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'pass',summary:'내 패스를 받은 동료가 다음 플레이를 더 잘 해냅니다.',effects:{match:{playmaker:.1}}},
  {id:'분위기 메이커',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'spark',summary:'득점에 기여하면 팀에 활기를 불어넣습니다.',effects:{match:{momentum:{seconds:300,drain:.8}}}},
  {id:'집념',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'fist',summary:'빼앗긴 공을 곧바로 되찾으면 다시 힘을 냅니다.',effects:{match:{grit:{energy:6,window:60}}}},
  {id:'라이벌 의식',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'versus',summary:'라이벌의 활약을 보면 훈련에 더 몰입합니다.',effects:{rivalryDrive:1.35}},
  {id:'독학파',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'book',summary:'같은 훈련을 꾸준히 반복하면 추가 성장을 얻습니다.',effects:{focusBonus:{times:3,extra:.5}}},
  {id:'대기만성',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'sprout',summary:'젊은 날 쌓은 경험이 늦게 꽃을 피웁니다.',effects:{lateBloom:{bankRate:.3,startAge:28,weeklyRate:.08,minWeekly:.3,cap:60}},excludes:['조기 노화']},
  {id:'철벽',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'wall',summary:'위험한 공간을 읽고 수비를 단단하게 만듭니다.',effects:{matchAttributes:{defending:6,positioning:4}}},
  {id:'스피드스타',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'bolt',summary:'경기에서 폭발적인 속도를 보여 줍니다.',effects:{matchAttributes:{speed:5,acceleration:5}},excludes:['둔한 발']},
  {id:'골 냄새',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'goal',summary:'득점 기회를 본능적으로 알아봅니다.',effects:{matchAttributes:{shooting:5,composure:3}}},
  {id:'슈퍼 조커',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'swap',summary:'교체 투입될 때 특별한 힘을 발휘합니다.',effects:{superSub:1.08}},
  {id:'빅매치 체질',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'trophy',summary:'중요한 경기에서 더욱 빛납니다.',effects:{bigMatchAttributes:Object.fromEntries(ATTRS.map(k=>[k,3])) as Partial<Record<Attr,number>>},excludes:['큰 경기 울렁증']},
  {id:'성실함',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'clipCheck',summary:'감독의 신뢰를 더 빠르게 얻습니다.',effects:{trustGain:1.2},excludes:['감독과 불화']},
  {id:'해외 체질',polarity:'positive',rarity:'common',chance:RARITY_CHANCE.common,icon:'globe',summary:'해외 환경에 잘 적응하고 더 잘 배웁니다.',effects:{abroadGrowth:1.15},excludes:['향수병']},
  // ── negative ──────────────────────────────────────────────
  {id:'유리몸',polarity:'negative',rarity:'rare',chance:RARITY_CHANCE.rare,icon:'crack',summary:'훈련에서 쉽게 지치고 부상에도 취약합니다.',effects:{trainingFatigue:1.2,injuryChance:1.25},excludes:['강철 체력','회복력','잔부상']},
  {id:'게으름',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'zzz',summary:'훈련에서 배움을 얻는 속도가 느립니다.',effects:{trainingGrowth:.9},excludes:['노력파']},
  {id:'새가슴',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'shake',summary:'경기 중 긴장하면 판단이 흐려집니다.',effects:{matchAttributes:{composure:-6,decisions:-4}},excludes:['강심장']},
  {id:'잔부상',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'bandage',summary:'작은 부상이 잦아 컨디션 관리가 필요합니다.',effects:{injuryChance:1.2},excludes:['회복력','강철몸','유리몸']},
  {id:'저질 체력',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'batteryLow',summary:'훈련하면 쉽게 피로해집니다.',effects:{trainingFatigue:1.15},excludes:['강철 체력','강철몸']},
  {id:'기복이 심함',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'wave',summary:'때때로 실전에서 제 기량을 발휘하지 못합니다.',effects:{matchBoost:{chance:.3,multiplier:.93},boostNews:'기복이 심함 · 오늘은 몸이 무겁습니다.'}},
  {id:'불운',polarity:'negative',rarity:'rare',chance:RARITY_CHANCE.rare,icon:'rain',summary:'특별한 성장의 순간을 만나기 어렵습니다.',effects:{luck:UNLUCKY_MULTIPLIER},excludes:['행운아']},
  {id:'향수병',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'home',summary:'해외에서는 적응과 성장이 더딥니다.',effects:{abroadGrowth:.85},excludes:['해외 체질']},
  {id:'큰 경기 울렁증',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'nervous',summary:'중요한 경기에서 부담을 크게 느낍니다.',effects:{bigMatchAttributes:{composure:-5,decisions:-3}},excludes:['빅매치 체질']},
  {id:'다혈질',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'cards',summary:'흥분하면 거친 플레이가 나옵니다.',effects:{match:{temper:1.5}}},
  {id:'감독과 불화',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'clipX',summary:'감독의 신뢰를 얻기 어렵습니다.',effects:{trustGain:.8},excludes:['성실함']},
  {id:'둔한 발',polarity:'negative',rarity:'common',chance:RARITY_CHANCE.common,icon:'boot',summary:'경기에서 발걸음이 무겁습니다.',effects:{matchAttributes:{speed:-5,acceleration:-4}},excludes:['스피드스타']},
  {id:'조기 노화',polarity:'negative',rarity:'rare',chance:RARITY_CHANCE.rare,icon:'hourglass',summary:'다른 선수보다 이르게 몸의 변화를 느낍니다.',effects:{aging:{yearsEarlier:1,rate:1.15}},excludes:['대기만성']},
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
const defs=(t:TraitInput)=>[...new Set(list(t))].map(traitDef).filter((d):d is TraitDef=>!!d);
const product=(t:TraitInput,key:'trainingGrowth'|'trainingFatigue'|'injuryChance'|'restRecovery'|'trustGain'|'abroadGrowth'|'superSub')=>defs(t).reduce((n,d)=>n*(d.effects[key]??1),1);

export const trainingGrowthMultiplier=(t:TraitInput)=>Math.min(1.35,Math.max(.8,product(t,'trainingGrowth')));
export const trainingFatigueMultiplier=(t:TraitInput)=>Math.min(1.3,Math.max(.75,product(t,'trainingFatigue')));
export const injuryChanceMultiplier=(t:TraitInput)=>Math.min(1.4,Math.max(.65,product(t,'injuryChance')));
/**
 * Luck multiplier: the best positive multiplier wins; otherwise the worst negative one applies; otherwise 1.
 * (행운아 and 불운 exclude each other, so in practice only one of them is ever present.)
 */
export const luckMultiplier=(t:TraitInput)=>{const v=defs(t).map(d=>d.effects.luck).filter((x):x is number=>x!==undefined);const up=v.filter(x=>x>1),down=v.filter(x=>x<1);return up.length?Math.max(...up):down.length?Math.min(...down):1;};
/** 깨달음 chance per match action attempt. */
export const insightChance=(t:TraitInput)=>INSIGHT_CHANCE*luckMultiplier(t);
/** Base 훈련 럭키 chance for an age (before traits). */
export const trainingLuckBase=(age:number)=>TRAINING_LUCK_BY_AGE.find(x=>age<=x.maxAge)!.chance;
/** 훈련 럭키 chance per training day for this age and traits. */
export const trainingLuckChance=(t:TraitInput,age:number)=>trainingLuckBase(age)*luckMultiplier(t);
/** @deprecated 0.4 combined chance (3 % base; legacy helper only). Use insightChance / trainingLuckChance. */
export const luckChance=(t:TraitInput)=>BASE_LUCK*luckMultiplier(t);
export const injuryWeeks=(t:TraitInput,base:number)=>Math.max(1,base+defs(t).reduce((n,d)=>n+(d.effects.injuryWeeks??0),0));
export const hasTrait=(t:TraitInput,id:TraitId)=>list(t).includes(id);
export const restRecoveryMultiplier=(t:TraitInput)=>product(t,'restRecovery');
export const trustGainMultiplier=(t:TraitInput)=>product(t,'trustGain');
/** Training-growth factor for the club's league (abroad = league ≥ 2). */
export const abroadGrowthMultiplier=(t:TraitInput,league:number)=>league>=2?product(t,'abroadGrowth'):1;
export const superSubMultiplier=(t:TraitInput)=>product(t,'superSub');
export const rivalryDrive=(t:TraitInput)=>Math.max(1,...defs(t).map(d=>d.effects.rivalryDrive??1));
export const focusBonus=(t:TraitInput)=>defs(t).find(d=>d.effects.focusBonus)?.effects.focusBonus;
export const lateBloom=(t:TraitInput)=>defs(t).find(d=>d.effects.lateBloom)?.effects.lateBloom;
/** Merged engine-side effects for a player's traits (undefined when there are none). */
export function matchFx(t:TraitInput):MatchFx|undefined{
  const fx:MatchFx={};let any=false;
  for(const d of defs(t))if(d.effects.match){Object.assign(fx,d.effects.match);any=true;}
  return any?fx:undefined;
}

/** 조기 노화-style shift of the age model (see aging.ts). */
export function agingShift(t:TraitInput){const a=defs(t).find(d=>d.effects.aging)?.effects.aging;return {yearsEarlier:a?.yearsEarlier??0,rate:a?.rate??1};}
/** @deprecated 0.4 flat decline (from 29/30). The game uses aging.ts since 0.5; kept for older imports. */
export function agingDecline(t:TraitInput,age:number,startAge:number,perYear:number){
  const a=defs(t).find(d=>d.effects.aging)?.effects.aging;
  const start=startAge-(a?.yearsEarlier??0);
  return age>start?perYear*(a?.rate??1):0;
}

/**
 * Applies match-only effects to a copy of a player's attributes.
 * `roll` decides 실전파-style boosts; returns whether a boost fired.
 */
export function matchAttributes(t:TraitInput,base:Attributes,roll:()=>number,opts:{bigMatch?:boolean}={}){
  const a={...base},fired:TraitDef[]=[];
  for(const d of defs(t)){
    if(d.effects.matchBoost&&roll()<d.effects.matchBoost.chance){fired.push(d);for(const k of ATTRS)a[k]=Math.min(100,a[k]*d.effects.matchBoost.multiplier);}
  }
  const flat=(m?:Partial<Record<Attr,number>>)=>{for(const [k,v] of Object.entries(m??{}) as [Attr,number][])a[k]=Math.min(100,Math.max(1,a[k]+v));};
  for(const d of defs(t)){flat(d.effects.matchAttributes);if(opts.bigMatch)flat(d.effects.bigMatchAttributes);}
  // `boosted` keeps its 0.3 meaning (an upward boost such as 실전파 fired).
  return {a,boosted:fired.some(d=>(d.effects.matchBoost?.multiplier??1)>1),fired:fired.map(d=>d.id),news:fired.map(d=>d.effects.boostNews).filter((x):x is string=>!!x)};
}
/** Whether a trait list changes match-day attributes at all (so trait-free players skip the work and RNG). */
export const hasMatchEffect=(t:TraitInput,bigMatch=false)=>defs(t).some(d=>!!(d.effects.matchBoost||d.effects.matchAttributes||(bigMatch&&d.effects.bigMatchAttributes)));

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
