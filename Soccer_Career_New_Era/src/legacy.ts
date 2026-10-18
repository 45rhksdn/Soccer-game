import type {Career} from './career';
import type {PlayerStory} from './origins';
export const RETIREMENT_POTENTIAL_STEP=1;
export const RETIREMENT_POTENTIAL_MAX_BONUS=6;
export const LEGACY_MIN_SEASONS=3;
export type RetiredEntry={id:string,name:string,year:number,age:number,pos:string,qualified?:boolean,school?:string,seasons?:number,ageRecords?:PlayerStory['ageRecords']};
export type Legacy={version:1,retired:RetiredEntry[]};
export const emptyLegacy=():Legacy=>({version:1,retired:[]});
// Old awarded entries remain credited. New early retirements are archived but grant no perk.
export const legacyCount=(l:Legacy|null|undefined)=>l?.retired.filter(e=>e.qualified!==false).length??0;
export const potentialBonus=(l:Legacy|null|undefined)=>Math.min(RETIREMENT_POTENTIAL_MAX_BONUS,legacyCount(l)*RETIREMENT_POTENTIAL_STEP);
export const scoutLevel=(l:Legacy|null|undefined)=>Math.min(3,legacyCount(l));
export function validLegacy(v:unknown):v is Legacy{
 const l=v as Legacy;
 return !!l&&typeof l==='object'&&l.version===1&&Array.isArray(l.retired)&&l.retired.every(e=>!!e&&typeof e.id==='string'&&typeof e.name==='string'&&Number.isFinite(e.year)&&(e.qualified===undefined||typeof e.qualified==='boolean')&&(e.school===undefined||typeof e.school==='string')&&(e.ageRecords===undefined||Array.isArray(e.ageRecords)&&e.ageRecords.every(r=>!!r&&Number.isFinite(r.age)&&Number.isFinite(r.overall))))&&new Set(l.retired.map(e=>e.id)).size===l.retired.length;
}
export function recordRetirement(l:Legacy,c:Career):{legacy:Legacy,rewarded:boolean}{
 if(c.world.phase!=='retired'||!c.id||l.retired.some(e=>e.id===c.id))return {legacy:l,rewarded:false};
 const seasons=new Set(c.world.records.map(r=>r.year)).size,qualified=seasons>=LEGACY_MIN_SEASONS;
 return {legacy:{...l,retired:[...l.retired,{id:c.id,name:c.player.name,year:c.world.year,age:c.player.age,pos:c.player.pos,school:c.schoolRef?.name??c.world.clubs[c.school]?.name,seasons,qualified,ageRecords:c.story?structuredClone(c.story.ageRecords):[]}]},rewarded:qualified};
}
