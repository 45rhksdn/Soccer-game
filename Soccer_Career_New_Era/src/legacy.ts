// Account-wide progress shared by the three career slots (0.5).
// Every retired player is recorded once (by career id). Each recorded retirement raises only the
// *highest possible* potential of newly generated players (scouting candidates and custom players):
// the minimum is unchanged and existing careers are never modified retroactively.
import type {Career} from './career';

/** Max-potential increase per recorded retirement. */
export const RETIREMENT_POTENTIAL_STEP=1;
/** Upper limit of the total increase (so new players stay ≤ 92 + 6 = 98). */
export const RETIREMENT_POTENTIAL_MAX_BONUS=6;
export type RetiredEntry={id:string,name:string,year:number,age:number,pos:string};
export type Legacy={version:1,retired:RetiredEntry[]};
export const emptyLegacy=():Legacy=>({version:1,retired:[]});
/** Current increase of the highest possible potential for new players. */
export const potentialBonus=(l:Legacy|null|undefined)=>Math.min(RETIREMENT_POTENTIAL_MAX_BONUS,(l?.retired.length??0)*RETIREMENT_POTENTIAL_STEP);
export function validLegacy(v:unknown):v is Legacy{
  const l=v as Legacy;
  return !!l&&typeof l==='object'&&l.version===1&&Array.isArray(l.retired)&&l.retired.every(e=>!!e&&typeof e.id==='string'&&typeof e.name==='string'&&Number.isFinite(e.year))&&new Set(l.retired.map(e=>e.id)).size===l.retired.length;
}
/**
 * Records a retired career once. Returns a new Legacy (the input is not modified) and whether
 * this call granted the reward. Careers that are not retired, or already recorded, change nothing.
 */
export function recordRetirement(l:Legacy,c:Career):{legacy:Legacy,rewarded:boolean}{
  if(c.world.phase!=='retired'||!c.id||l.retired.some(e=>e.id===c.id))return {legacy:l,rewarded:false};
  return {legacy:{...l,retired:[...l.retired,{id:c.id,name:c.player.name,year:c.world.year,age:c.player.age,pos:c.player.pos}]},rewarded:true};
}
