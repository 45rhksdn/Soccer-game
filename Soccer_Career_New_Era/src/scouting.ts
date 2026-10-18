// Fictional candidate generation for real schools. Deterministic: the same
// (scout seed, school id, list number) always yields the same candidates, so a
// list never changes on reload or save/load. Names are random syllables.
import {ATTRS,attributes,clamp,random,type Attributes,type Position} from './engine';
import {roleAbility} from './roles';
import {rollTraits,seedFrom} from './traits';
import {newCareer,type Career} from './career';
import {schoolById,type School} from './schools';
import {playerStory} from './stories';

export const CANDIDATES_PER_LIST=6;
export const FIELD_POSITIONS:Position[]=['ST','CM','CB','LW','RW','LB','RB'];
const SECONDARY:Record<string,Position[]>={ST:['LW','RW','CM'],CM:['ST','CB','LW','RW'],CB:['CM','LB','RB'],LW:['RW','ST','LB'],RW:['LW','ST','RB'],LB:['RB','CB','LW'],RB:['LB','CB','RW']};
const SURNAMES=['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','홍'];
const FIRST=['민','서','도','하','지','준','현','우','시','유','태','건','승','재','은','주','예','동','성','진'];
const SECOND=['준','우','현','호','민','훈','윤','혁','빈','찬','결','원','후','율','진','석','영','규','환','겸'];
export const STYLES=['플레이메이커','테크니션','피지컬'] as const;
export const CURVES=['꾸준한 성장형','조기 성장형','대기만성형'] as const;

export type Candidate={
  id:string; schoolId:string; list:number;
  name:string; age:number; pos:Position; secondary:Position; foot:string; height:number; weight:number;
  style:string; curve:string;
  a:Attributes; potential:number; learning:number; traits:string[];
  /** Scout's estimate shown before signing; always contains the true potential. */
  potentialRange:[number,number];
};
/** Persisted scouting progress: one seed per browser plus the current list number per school. */
export type ScoutState={seed:number,lists:Record<string,number>};
export const newScoutState=(seed:number):ScoutState=>({seed:seed>>>0,lists:{}});
export const listNumber=(s:ScoutState,schoolId:string)=>s.lists[schoolId]??0;
/** Next list for a school. Unlimited by default; earlier lists can be regenerated exactly. */
export const nextList=(s:ScoutState,schoolId:string):ScoutState=>({...s,lists:{...s.lists,[schoolId]:listNumber(s,schoolId)+1}});
export function validScoutState(v:unknown):v is ScoutState{
  const s=v as ScoutState;
  return !!s&&typeof s==='object'&&Number.isInteger(s.seed)&&!!s.lists&&typeof s.lists==='object'&&Object.values(s.lists).every(n=>Number.isInteger(n)&&n>=0);
}

const pick=<T,>(r:{seed:number},xs:readonly T[])=>xs[Math.floor(random(r)*xs.length)];

/**
 * `potentialBonus` (retirement reward, legacy.ts) widens only the top of the potential range:
 * the same random draw maps to the same minimum, so no other candidate field changes.
 */
export function generateCandidates(scoutSeed:number,schoolId:string,list:number,count=CANDIDATES_PER_LIST,potentialBonus=0):Candidate[]{
  const bonus=Math.max(0,potentialBonus);
  const r={seed:seedFrom(scoutSeed,`school:${schoolId}#${list}`)};
  const out:Candidate[]=[];
  for(let i=0;i<count;i++){
    const pos=pick(r,FIELD_POSITIONS),secondary=pick(r,SECONDARY[pos]);
    const style=pick(r,STYLES),curve=pick(r,CURVES);
    const age=random(r)<.6?16:17;
    const footRoll=random(r),foot=footRoll<.7?'오른':footRoll<.92?'왼':'양';
    const height=Math.round((pos==='CB'?180:pos==='LW'||pos==='RW'?171:176)+random(r)*14-4);
    const weight=Math.round(height-110+random(r)*10-3);
    // Same shape as newCareer's starting profile, plus a per-candidate talent offset.
    const talent=random(r)*8-3,a=attributes(43);
    for(const k of ATTRS)a[k]+=random(r)*10+talent;
    if(pos==='ST')a.shooting+=9;
    if(pos==='CM'){a.passing+=7;a.vision+=7;}
    if(['CB','LB','RB'].includes(pos)){a.defending+=10;a.strength+=5;}
    if(['LW','RW'].includes(pos)){a.speed+=8;a.dribbling+=8;}
    if(style==='테크니션'){a.control+=6;a.dribbling+=4;}
    if(style==='피지컬'){a.strength+=6;a.stamina+=4;}
    if(style==='플레이메이커'){a.passing+=5;a.vision+=5;}
    for(const k of ATTRS)a[k]=Math.round(clamp(a[k],20,85)*10)/10;
    const potential=Math.round(clamp(74+random(r)*(14+bonus)+talent*.5,70,92+bonus)*10)/10;
    const learning=Math.round((.85+random(r)*.3)*100)/100;
    const spread=3+Math.floor(random(r)*3),shift=Math.floor(random(r)*(spread+1));
    const potentialRange:[number,number]=[Math.floor(potential)-shift,Math.floor(potential)-shift+spread+1];
    const name=pick(r,SURNAMES)+pick(r,FIRST)+pick(r,SECOND);
    out.push({id:`${schoolId}#${list}#${i}`,schoolId,list,name,age,pos,secondary,foot,height,weight,style,curve,a,potential,learning,traits:rollTraits(r),potentialRange});
  }
  return out;
}

export const candidateOverall=(c:Candidate)=>roleAbility(c.a,c.pos);
/** World slot (0–2) used for the fictional league structure; stable per school. */
export const worldSlotFor=(schoolId:string)=>seedFrom(0,'slot:'+schoolId)%3;

/** Starts a career with the chosen fictional candidate at the chosen real school. */
export function careerFromCandidate(c:Candidate,scoutSeed:number,school:School=schoolById(c.schoolId)!,id?:string):Career{
  if(!school)throw Error('학교 정보를 찾을 수 없습니다.');
  return newCareer(
    {name:c.name,age:c.age,pos:c.pos,secondary:c.secondary,foot:c.foot,height:c.height,weight:c.weight,style:c.style,curve:c.curve},
    worldSlotFor(school.id),
    seedFrom(scoutSeed,'career:'+c.id),
    {a:c.a,potential:c.potential,learning:c.learning,traits:c.traits,schoolRef:{id:school.id,name:school.name,region:school.region},id,storyId:c.id},
  );
}

/** 0.14 the candidate's back-story at this school (the same text the signed career keeps). */
export const candidateStory=(c:Candidate,school:School|undefined=schoolById(c.schoolId))=>playerStory(c,school?{name:school.name,region:school.region,affiliation:school.affiliation}:null,c.id);
