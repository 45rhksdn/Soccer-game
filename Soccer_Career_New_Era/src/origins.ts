// Narrative is grounded in actual skills, never a hidden bonus or a second talent roll.
import {ATTRS,LABELS,type Attributes,type Attr,type Position} from './engine';
import type {Career,Player} from './career';
import {roleAbility} from './roles';
import {seedFrom} from './traits';
import {playerStory,type StorySchool} from './stories';
import {schoolById} from './schools';
/** 0.14 `headline` / `chapters` / `quote`: the back-story written at signing (stories.ts); older saves have none. */
export type PlayerStory={intro:string,startAge:number,startOverall:number,ageRecords:{age:number,overall:number}[],headline?:string,chapters?:string[],quote?:string};
type Profile=Pick<Player,'a'|'pos'|'learning'|'curve'>;
export function playerIntroduction(p:Profile){
 const groups:{keys:Attr[],text:string}[]=[
  {keys:['speed','acceleration'],text:'달리기에서 두각을 보이며 축구부의 눈길을 끈 학생'},
  {keys:['passing','vision','longPassing'],text:'운동장에서 친구들의 움직임을 읽고 공을 연결하던 학생'},
  {keys:['dribbling','control'],text:'좁은 공간에서도 공을 발끝에 붙여 두는 학생'},
  {keys:['defending','marking','sliding'],text:'친구들이 공격할 때 묵묵히 뒤를 지키던 학생'},
  {keys:['shooting','finishing','positioning'],text:'골문 앞 기회를 기다리며 마무리를 연습하던 학생'},
  {keys:['strength','stamina'],text:'몸을 쓰는 훈련에서 먼저 존재감을 드러낸 학생'},
 ];
 return groups.sort((x,y)=>y.keys.reduce((n,k)=>n+p.a[k],0)/y.keys.length-x.keys.reduce((n,k)=>n+p.a[k],0)/x.keys.length)[0].text;
}
export function strengths(a:Attributes){return [...ATTRS].sort((x,y)=>a[y]-a[x]).slice(0,2).map(k=>LABELS[k]).join(' · ');}
export function growthOutlook(p:Profile,id:string,observations=0,scoutLevel=0){
 const known=observations>=12||scoutLevel>=3,partial=observations>=4||scoutLevel>=1||seedFrom(0,id)%3===0;
 return {label:known?'성장 성향 파악':partial?'성장 단서 발견':'아직 판단하기 어려움',
  note:known?`${p.curve} · ${p.learning>=1.05?'새로운 훈련을 비교적 빠르게 익힙니다.':p.learning<.95?'충분한 반복과 출전 경험이 중요합니다.':'꾸준한 훈련과 경기 경험이 어울립니다.'}`:partial?(p.learning>=1?'배움을 받아들이는 속도가 눈에 띕니다. 경기 경험도 지켜봅시다.':'반복 훈련을 통해 자신만의 강점을 다듬고 있습니다.'):'관찰이 더 필요합니다. 정보가 적다는 뜻이며, 성장 한계가 낮다는 뜻은 아닙니다.'};
}
/** The school as the story tells it: a real school adds its region and pro-club affiliation (schools.ts). */
export function storySchool(ref:{id?:string,name:string,region?:string}|undefined):StorySchool|null{
 if(!ref)return null;const real=ref.id?schoolById(ref.id):undefined;
 return {name:ref.name,region:real?.region??ref.region,affiliation:real?.affiliation};
}
export function makeStory(p:Player,school?:StorySchool|null,id?:string,traits?:string[]):PlayerStory{
 const base:PlayerStory={intro:playerIntroduction(p),startAge:p.age,startOverall:roleAbility(p.a,p.pos),ageRecords:[]};
 if(!id)return base;
 const t=playerStory({...p,traits},school??null,id);
 return {...base,headline:t.headline,chapters:t.chapters,quote:t.quote};
}
export function recordAge(c:Career){if(!c.story)return;const rows=c.story.ageRecords;const row={age:c.player.age,overall:roleAbility(c.player.a,c.player.pos)};const at=rows.findIndex(x=>x.age===row.age);if(at<0)rows.push(row);else rows[at]=row;}
// The rival takes a different specialty within the same position. Preserve total raw ability.
export function contrastRival(hero:Player,rival:Player){
 const pairs:Partial<Record<Position,[Attr[],Attr[]]>>={CM:[['passing','vision'],['dribbling','shooting']],ST:[['shooting','finishing'],['speed','dribbling']],CB:[['defending','marking'],['anticipation','strength']],GK:[['positioning','decisions'],['defending','composure']]};
 const [a,b]=pairs[hero.pos]??[['speed','dribbling'],['passing','defending']];
 const score=(ks:Attr[])=>ks.reduce((n,k)=>n+hero.a[k],0)/ks.length;
 const [lower,raise]=score(a)>=score(b)?[a,b]:[b,a];
 const delta=Math.min(4,...lower.map(k=>rival.a[k]-20),...raise.map(k=>99-rival.a[k]));
 for(const k of lower)rival.a[k]-=delta;for(const k of raise)rival.a[k]+=delta;
}
export function rivalIntroduction(c:Career){const r=c.development.rival;return `유소년 시절부터 마주쳤던 ${r.player.name}. 서로 다른 학교에서 시작한 두 선수는 같은 ${c.player.pos} 자리에서 각자의 길을 찾습니다. 내 강점은 ${strengths(c.player.a)}, 라이벌의 강점은 ${strengths(r.player.a)}입니다.`;}
