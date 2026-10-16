// One age model for the user, the rival and every NPC (0.5).
// Players improve until about PEAK_AGE (32) — quickly when young, slowly in their late
// twenties — and decline afterwards: pace fastest, then technique; game reading (vision,
// decisions, composure, positioning) declines least and grows with match experience until the peak.
// Growth curves (조기 성장형 / 꾸준한 성장형 / 대기만성형) and traits (조기 노화, 대기만성) shift it.
import type {Attr,Attributes} from './engine';
import {agingShift,type TraitInput} from './traits';

export const PEAK_AGE=32;
/** Training/match growth multiplier by age for each growth curve: [max age, factor]. */
export const GROWTH_BY_CURVE:Record<string,readonly [number,number][]>={
  '꾸준한 성장형':[[24,1],[28,.8],[32,.6],[Infinity,.1]],
  '조기 성장형':[[19,1.2],[24,.85],[28,.6],[32,.45],[Infinity,.08]],
  '대기만성형':[[19,.85],[27,1.15],[32,.85],[Infinity,.15]],
};
export function growthAgeFactor(curve:string|undefined,age:number){
  const table=GROWTH_BY_CURVE[curve??'']??GROWTH_BY_CURVE['꾸준한 성장형'];
  return table.find(([max])=>age<=max)![1];
}
/** Match-experience growth (game-reading attributes) by age: it keeps working through the peak years. */
export const EXPERIENCE_KEYS:readonly Attr[]=['vision','decisions','composure','positioning'];
export const experienceAgeFactor=(age:number)=>age<20?.6:age<25?.8:age<=PEAK_AGE?1:.3;

/** Yearly decline after the peak: first-year loss and the extra loss added for each further year. */
export const DECLINE:{keys:readonly Attr[],first:number,step:number}[]=[
  {keys:['speed','acceleration','stamina'],first:1.2,step:.6},
  {keys:['strength','shooting','passing','dribbling','control','defending'],first:.45,step:.3},
  {keys:['vision','decisions','composure','positioning'],first:.15,step:.15},
];
/** First age at which the decline applies (33, or earlier with 조기 노화). */
export const declineStart=(t:TraitInput)=>PEAK_AGE+1-agingShift(t).yearsEarlier;
/** Loss of one attribute in the season a player turns `age`. */
export function agingLoss(t:TraitInput,age:number,key:Attr){
  const start=declineStart(t);if(age<start)return 0;
  const group=DECLINE.find(g=>g.keys.includes(key));if(!group)return 0;
  return (group.first+group.step*(age-start))*agingShift(t).rate;
}
/** Applies one year of decline to the attributes (never below `floor`); returns the total loss. */
export function applyAging(a:Attributes,t:TraitInput,age:number,floor=20){
  let total=0;
  for(const k of Object.keys(a) as Attr[]){const loss=Math.min(agingLoss(t,age,k),Math.max(0,a[k]-floor));a[k]-=loss;total+=loss;}
  return total;
}
/** NPC yearly growth towards potential (fraction of the remaining gap) by age. */
export const npcGrowthRate=(age:number)=>age<25?.025:age<=28?.008:age<=PEAK_AGE?.004:0;
