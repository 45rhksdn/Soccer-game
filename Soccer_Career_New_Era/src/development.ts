import {ATTRS,LABELS,attributes,clamp,random,overall,createMatch,finishMatch,rating,type Attributes,type Attr,type Match} from './engine';
import {grow,startCareerMatch,type Career,type Player} from './career';
import {clubOf,chooseLineup,generateOffers,expireOffers,roleSalary,nextOpponent,type Offer} from './world';
export const TRAITS=['천재','실전파','행운아'] as const;
export type Trait=typeof TRAITS[number];
export const TRAIT_TEXT:Record<Trait,string>={천재:'모든 훈련 성장 ×1.7',실전파:'경기 진입 시 30% 확률 · 해당 경기 능력치 ×1.3',행운아:'럭키·깨달음 확률 3% → 9%'};
export const DAILY={shooting:{label:'슈팅훈련',keys:['shooting','composure','positioning']},running:{label:'달리기',keys:['speed','acceleration','stamina']},passing:{label:'패스훈련',keys:['passing','vision','decisions']},dribbling:{label:'드리블훈련',keys:['dribbling','control','acceleration']},defending:{label:'수비훈련',keys:['defending','positioning','strength']},rest:{label:'휴식하기',keys:[]},vacation:{label:'휴양하기 · 5만원',keys:[]}} as const;
export type Daily=keyof typeof DAILY;
export type News={day:number,text:string,kind:'rating'|'lucky'|'insight'|'interest'|'offer'|'career'};
export type WeekNote={week:number,startDay:number,before:Attributes,after:Attributes,rivalBefore:Attributes,rivalAfter:Attributes,entries:string[]};
export type Development={trait:Trait,wallet:number,plan:Daily[],active?:{startDay:number,cursor:number,before:Attributes,rivalBefore:Attributes,entries:string[],matchDone:boolean},notes:WeekNote[],news:News[],rival:{id:string,player:Player,school:number,clubId:string,trait:Trait,retired:boolean,trainedWeek:number,lastPlayedWeek:number,history:{week:number,rating:number,goals:number,club:string}[],interests:string[],offers:Offer[]},interestIds:string[]};
export function news(c:Career,text:string,kind:News['kind']='career'){c.development.news.unshift({day:c.day,text,kind});c.development.news=c.development.news.slice(0,150);c.feed.unshift(text);c.feed=c.feed.slice(0,40);}
export function ensureDevelopment(c:Career){
 if(c.development)return;
 c.world.currentDay=c.day;for(const o of c.world.offers){o.issuedDay??=c.day;o.expiresDay??=c.day+14;}
 const rng={seed:(c.seed^0x532af)>>>0},school=(c.school+1+Math.floor(random(rng)*2))%3;
 const rp:Player={...structuredClone(c.player),name:['강시우','이태준','서도윤','정민재'][Math.floor(random(rng)*4)],energy:100,fatigue:0,injuryWeeks:0};
 for(const k of ATTRS)rp.a[k]=clamp(rp.a[k]+(random(rng)-.5)*6,20,99);
 c.development={trait:TRAITS[Math.floor(random(rng)*3)],wallet:100,plan:['shooting','running','passing','rest','passing','rest','rest'],notes:[],news:[],interestIds:[],rival:{id:'career-rival',player:rp,school,clubId:'c'+school,trait:TRAITS[Math.floor(random(rng)*3)],retired:false,trainedWeek:-1,lastPlayedWeek:-1,history:[],interests:[],offers:[]}};
 if(rp.age>=19)c.development.rival.clubId=c.world.clubs.filter(x=>x.league>0&&x.id!==c.world.clubId).sort((a,b)=>Math.abs(overall(a.roster[0].a)-overall(rp.a))-Math.abs(overall(b.roster[0].a)-overall(rp.a)))[0].id;
 syncRival(c);news(c,`${rp.name} · 같은 나이, 같은 ${rp.pos} 포지션의 라이벌이 등장했습니다.`);news(c,`주요 특성 「${c.development.trait}」 · ${TRAIT_TEXT[c.development.trait]}`);
}
export function syncRival(c:Career){
 const r=c.development.rival,club=c.world.clubs.find(x=>x.id===r.clubId)!;
 const oldClub=c.world.clubs.find(x=>x.id!==club.id&&x.roster.some(p=>p.id===r.id));
 if(oldClub)oldClub.roster=oldClub.roster.filter(p=>p.id!==r.id);
 const prior=club.roster.find(p=>p.id===r.id);
 const data={id:r.id,name:r.player.name,pos:r.player.pos,age:r.player.age,a:{...r.player.a},potential:r.player.potential,energy:r.player.energy,form:r.history[0]?.rating??6.5,goals:prior?.goals??0,appearances:prior?.appearances??0,years:2};
 if(prior)Object.assign(prior,data);else{const index=club.roster.findIndex(p=>p.pos===r.player.pos);if(index>=0){const removed=club.roster.splice(index,1,data)[0];if(oldClub)oldClub.roster.push(removed);}else club.roster.push(data);}
}
export function applyDaily(c:Career,p:Player,type:Daily,trait:Trait,rival=false){
 const d=c.development,name=rival?p.name:c.player.name,rest=type==='rest'||type==='vacation';
 if(type==='vacation'&&!rival){if(d.wallet<5)throw Error('휴양 비용 5만원이 부족합니다. 휴식을 선택해 주세요.');d.wallet-=5;}
 if(rest){p.energy=clamp(p.energy+(type==='vacation'?65:30),0,100);p.fatigue=clamp(p.fatigue-(type==='vacation'?60:25),0,100);return `${name} · ${DAILY[type].label}`;}
 if(p.injuryWeeks||p.energy<20){p.energy=clamp(p.energy+30,0,100);p.fatigue=Math.max(0,p.fatigue-25);return `${name} · 컨디션 부족으로 휴식 전환`;}
 const lucky=random(c)<(trait==='행운아'?.09:.03),efficiency=clamp(1-p.fatigue*.008,.2,1),environment=rival?(c.world.clubs.find(x=>x.id===d.rival.clubId)?.development??1):clubOf(c.world).development;
 const before=overall(p.a);grow(p,DAILY[type].keys,.24*environment*efficiency*(trait==='천재'?1.7:1)*(lucky?10:1));
 p.energy=clamp(p.energy-12,0,100);p.fatigue=clamp(p.fatigue+12,0,100);p.trust=clamp(p.trust+.2,0,100);
 const text=`${name} · ${lucky?'럭키! ×10 · ':''}${DAILY[type].label} · OVR +${(overall(p.a)-before).toFixed(2)}`;
 if(lucky)news(c,text,'lucky');return text;
}
export function prepareWeek(c:Career,plan:Daily[]){
 ensureDevelopment(c);if(c.match||c.development.active)throw Error('진행 중인 주간 일정이 있습니다.');if(c.world.phase==='retired')throw Error('은퇴한 커리어입니다.');
 if(plan.length!==7||plan.some(x=>!DAILY[x]))throw Error('7일 일정을 모두 선택해 주세요.');
 const matchDay=!['offseason','retired'].includes(c.world.phase);
 if(plan.filter((x,i)=>x==='vacation'&&(!matchDay||i!==5)).length*5>c.development.wallet)throw Error('예정된 휴양 비용이 잔액보다 많습니다.');
 c.development.plan=[...plan];c.development.active={startDay:c.day,cursor:0,before:{...c.player.a},rivalBefore:{...c.development.rival.player.a},entries:[],matchDone:false};
 advanceSchedule(c);
}
export function advanceSchedule(c:Career){
 const d=c.development,a=d.active;if(!a)return;
 while(a.cursor<7){
  c.day=a.startDay+a.cursor;c.world.currentDay=c.day;expireOffers(c.world);
  if(a.cursor===5&&!a.matchDone&&!['offseason','retired'].includes(c.world.phase)){startCareerMatch(c);return;}
  a.entries.push(applyDaily(c,c.player,d.plan[a.cursor],d.trait));
  if(!d.rival.retired)applyDaily(c,d.rival.player,d.plan[a.cursor],d.rival.trait,true);
  a.cursor++;
 }
 d.rival.trainedWeek=c.week;finishWeek(c);
}
export function finishWeek(c:Career){
 const d=c.development,a=d.active;
 if(a){d.notes.unshift({week:c.week,startDay:a.startDay,before:a.before,after:{...c.player.a},rivalBefore:a.rivalBefore,rivalAfter:{...d.rival.player.a},entries:a.entries});d.notes=d.notes.slice(0,60);c.day=a.startDay+7;d.active=undefined;}
 else c.day=Math.max(c.day+1,(c.week+1)*7);
 c.week++;c.trainingCount=0;d.wallet+=clubOf(c.world).league===0?2:0;c.world.currentDay=c.day;expireOffers(c.world);scoutInterest(c);syncRival(c);
 c.growth.push({week:c.week,overall:overall(c.player.a)});
}
export function afterScheduledMatch(c:Career){const a=c.development.active;if(a){a.entries.push(`경기 · 평점 ${c.history[0].rating.toFixed(2)}`);a.matchDone=true;a.cursor=6;advanceSchedule(c);}else finishWeek(c);}
export function configureTrait(c:Career,m:Match){
 const d=c.development;m.insight={chance:d.trait==='행운아'?.09:.03,gains:{},events:[]};
 const rivalSlot=m.rosterIds?.indexOf(d.rival.id)??-1;if(rivalSlot>=0){m.rivalInsight={playerId:rivalSlot,chance:d.rival.trait==='행운아'?.09:.03,gains:{},events:[]};if(d.rival.trait==='실전파'&&random(c)<.3)for(const k of ATTRS)m.players[rivalSlot].a[k]=Math.min(100,m.players[rivalSlot].a[k]*1.3);}
 const activated=d.trait==='실전파'&&random(c)<.3;m.traitBoost=activated;
 if(activated){const boost=(a:Attributes)=>Object.fromEntries(ATTRS.map(k=>[k,Math.min(100,a[k]*1.3)])) as Attributes;
  if(m.userOnPitch!==false)m.players[m.userId].a=boost(c.player.a);
  if(m.benchEntry)m.benchEntry.a=boost(c.player.a);
  news(c,'실전파 발동! 이번 경기 동안 모든 능력치 ×1.3 (최대 100)');
 }
}
export function applyInsights(c:Career,m:Match){if(!m.insight)return;for(const k of ATTRS){const gain=m.insight.gains[k]??0;if(!gain)continue;c.player.a[k]=Math.min(100,c.player.a[k]+gain);c.player.potential=Math.max(c.player.potential,c.player.a[k]);news(c,`깨달음! ${LABELS[k]} +${gain}`,'insight');}}
export function playRival(c:Career,main:Match){
 const r=c.development.rival;if(r.retired||r.lastPlayedWeek===c.week)return undefined;
 if(!c.development.active&&r.trainedWeek!==c.week){for(let i=0;i<7;i++)applyDaily(c,r.player,c.development.plan[i],r.trait,true);r.trainedWeek=c.week;syncRival(c);}
 const actual=main.rosterIds?.indexOf(r.id)??-1;const prior=main.replacedPlayers?.find(x=>x.rosterId===r.id)?.player;if(actual<0&&!prior&&(r.clubId===c.world.clubId||nextOpponent(c.world).club?.id===r.clubId)){r.lastPlayedWeek=c.week;return;}let rp,score:[number,number]|undefined;
 if(actual>=0||prior){rp=prior??main.players[actual];for(const k of ATTRS){const n=main.rivalInsight?.gains[k]??0;if(n){r.player.a[k]=Math.min(100,r.player.a[k]+n);r.player.potential=Math.max(r.player.potential,r.player.a[k]);news(c,`${r.player.name} · 깨달음! ${LABELS[k]} +${n}`,'insight');}}}
 else if(c.world.phase==='league'){
  const fixture=c.world.fixtures[c.world.round]?.find(f=>f.home===r.clubId||f.away===r.clubId);if(!fixture)return;
  const other=c.world.clubs.find(x=>x.id===(fixture.home===r.clubId?fixture.away:fixture.home))!;
  const rm=createMatch((c.seed^c.week*9239)>>>0,{name:r.player.name,pos:r.player.pos,a:r.player.a,energy:r.player.energy},overall(other.roster[0].a));
  const ownClub=c.world.clubs.find(x=>x.id===r.clubId)!;
  const teams=[chooseLineup(ownClub),chooseLineup(other)];
  rm.tactics=[ownClub.coach.style,other.coach.style];
  const rivalIndex=teams[0].findIndex(p=>p.id===r.id);
  for(let t=0;t<2;t++)for(let i=0;i<11;i++){const source=teams[t][i],slot=rm.players[t*11+i];slot.name=source.name;slot.a={...source.a};slot.pos=source.slotPos;slot.energy=source.energy;
   if((t?other:ownClub).coach.formation==='4-4-2'){const anchors=[[5,34],[25,10],[21,26],[21,42],[25,58],[46,9],[40,25],[40,43],[46,59],[67,25],[67,43]];slot.homeX=anchors[i][0];slot.homeY=anchors[i][1];slot.x=t?105-slot.homeX:slot.homeX;slot.y=slot.homeY;}}
  rm.userOnPitch=rivalIndex>=0;if(rivalIndex>=0)rm.userId=rivalIndex;
  rm.decision=rm.userOnPitch&&rm.ball.owner===rm.userId;
  rm.insight={chance:r.trait==='행운아'?.09:.03,gains:{},events:[]};
  if(rm.userOnPitch&&r.trait==='실전파'&&random(c)<.3)for(const k of ATTRS)rm.players[rm.userId].a[k]=Math.min(100,rm.players[rm.userId].a[k]*1.3);
  finishMatch(rm);rp=rm.userOnPitch?rm.players[rm.userId]:undefined;score=rm.score;r.lastPlayedWeek=c.week;
  for(const k of ATTRS){const n=rm.insight.gains[k]??0;if(n){r.player.a[k]=Math.min(100,r.player.a[k]+n);r.player.potential=Math.max(r.player.potential,r.player.a[k]);news(c,`${r.player.name} · 깨달음! ${LABELS[k]} +${n}`,'insight');}}
 }
 if(rp){const v=rating(rp);r.history.unshift({week:c.week,rating:v,goals:rp.stats.goals,club:r.clubId});r.history=r.history.slice(0,200);r.lastPlayedWeek=c.week;r.player.energy=Math.min(100,rp.energy+30);grow(r.player,['passing','shooting','positioning'],.18);if(v>=7.5)news(c,`라이벌 ${r.player.name} · 평점 ${v.toFixed(2)}의 활약!`,'rating');}
 syncRival(c);return score?{clubId:r.clubId,score}:undefined;
}
export function scoutInterest(c:Career){
 if(c.world.phase==='retired'||c.world.phase==='offseason')return;
 for(const rival of [false,true]){
  const p=rival?c.development.rival.player:c.player,ids=rival?c.development.rival.interests:c.development.interestIds;
  if(p.age<17||random(c)>.35)continue;
  const candidates=c.world.clubs.filter(x=>x.league>0&&!ids.includes(x.id)&&x.id!==(rival?c.development.rival.clubId:c.world.clubId)&&Math.abs(overall(x.roster[0].a)-overall(p.a))<18&&x.budget>=roleSalary(overall(p.a),x.league)*2);
  if(!candidates.length)return;const club=candidates[Math.floor(random(c)*candidates.length)];ids.push(club.id);news(c,`${club.name} · ${rival?'라이벌 ':''}${p.name}에게 관심! 졸업 가능한 시즌 종료 후 정식 제안 예정`,'interest');
 }
 c.world.interestedClubIds=[...c.development.interestIds];
}
export function announceOffers(c:Career){const d=c.development;c.world.currentDay=c.day;c.world.interestedClubIds=[...d.interestIds];generateOffers(c.world,{...c.player,age:c.player.age+1},c.history[0]?.rating||6.5);for(const o of c.world.offers)news(c,`${c.world.clubs.find(x=>x.id===o.clubId)!.name} · 14일 유효한 계약 제안 도착`,'offer');
 if(d.rival.player.age>=18){const rw=structuredClone(c.world);rw.clubId=d.rival.clubId;rw.contract={salary:0,years:0};rw.interestedClubIds=d.rival.interests;generateOffers(rw,{...d.rival.player,age:d.rival.player.age+1},d.rival.history[0]?.rating??6.5);d.rival.offers=rw.offers;for(const o of rw.offers.filter(o=>d.rival.interests.includes(o.clubId)))news(c,`${c.world.clubs.find(x=>x.id===o.clubId)!.name} · 라이벌 ${d.rival.player.name}에게 정식 제안`,'offer');}
}
export function renewSearch(c:Career){if(c.world.phase!=='offseason'||c.match)throw Error('시즌 종료 후 구직할 수 있습니다.');expireOffers(c.world);if(c.world.offers.length)throw Error('아직 유효한 제안이 있습니다.');announceOffers(c);}
export function ageRival(c:Career){const r=c.development.rival;r.player.age=c.player.age;r.player.energy=100;r.player.fatigue=0;r.retired=c.player.age>=36;if(r.player.age>29)for(const k of ['speed','acceleration','stamina'] as Attr[])r.player.a[k]=Math.max(20,r.player.a[k]-.8);
 const choices=r.offers.filter(o=>o.clubId!==c.world.clubId&&(o.expiresDay??Infinity)>c.day);
 if(r.player.age>=19&&(c.world.clubs.find(x=>x.id===r.clubId)!.league===0||choices.length)){const best=choices.sort((a,b)=>b.salary-a.salary)[0];const club=best?c.world.clubs.find(x=>x.id===best.clubId)!:c.world.clubs.filter(x=>x.league>0&&x.id!==c.world.clubId).sort((a,b)=>Math.abs(overall(a.roster[0].a)-overall(r.player.a))-Math.abs(overall(b.roster[0].a)-overall(r.player.a)))[0];r.clubId=club.id;news(c,`${r.player.name} · ${club.name} 입단!`);}
 r.offers=[];if(c.player.age>=19){r.interests=[];c.development.interestIds=[];}c.world.interestedClubIds=[...c.development.interestIds];syncRival(c);
}
