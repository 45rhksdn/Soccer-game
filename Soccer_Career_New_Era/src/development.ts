import {ATTRS,LABELS,clamp,random,overall,createMatch,finishMatch,rating,type Attributes,type Attr,type Match} from './engine';
import {grow,startCareerMatch,type Career,type Player} from './career';
import {signatureFx,type DeedKey} from './engagement';
import {npcInjuryWeek,matchInjury,clubLevel,clubOf,chooseLineup,generateOffers,expireOffers,roleSalary,nextOpponent,type Offer} from './world';
import {TRAIT_IDS,TRAIT_TEXT,rollTraits,trainingGrowthMultiplier,trainingFatigueMultiplier,injuryChanceMultiplier,injuryWeeks,insightChance,trainingLuckChance,matchAttributes,traitDef,seedFrom,restRecoveryMultiplier,rivalryDrive,focusBonus,lateBloom,matchFx,hasMatchEffect,trustGainMultiplier,abroadGrowthMultiplier,superSubMultiplier,type TraitId,type TraitInput} from './traits';
import {ROLE_KEYS,roleAbility} from './roles';
import {applyAging} from './aging';
import {matchAttributesOf,type EquipmentState} from './equipment';
/** @deprecated use TRAIT_IDS / traits.ts. Kept so older imports keep compiling. */
export const TRAITS=TRAIT_IDS;
export type Trait=TraitId;
export {TRAIT_TEXT};
/** Base chance of a training injury on a day that ends with fatigue ≥ TRAINING_INJURY_FATIGUE. */
export const TRAINING_INJURY_CHANCE=.02,TRAINING_INJURY_FATIGUE=60;
export const DAILY={shooting:{label:'공격훈련',keys:['shooting','longShot','finishing','curve']},running:{label:'속력훈련',keys:['speed','acceleration','stamina']},passing:{label:'패스훈련',keys:['passing','longPassing','vision']},dribbling:{label:'드리블훈련',keys:['dribbling','control','acceleration']},defending:{label:'수비훈련',keys:['defending','sliding','marking']},reading:{label:'책 읽기',keys:['anticipation']},rest:{label:'휴식하기',keys:[]},vacation:{label:'휴양하기 · 5만원',keys:[]}} as const;
export type Daily=keyof typeof DAILY;
/** News texts for 럭키 (training) and 깨달음 (match). Exact values live in the growth history, not here. */
export const LUCKY_NEWS='훈련 중 무언가를 느꼈다!',INSIGHT_NEWS='경기 중에 깨달음을 얻었다!';
export type News={day:number,text:string,kind:'rating'|'lucky'|'insight'|'interest'|'offer'|'career'};
export type WeekNote={week:number,startDay:number,before:Attributes,after:Attributes,rivalBefore:Attributes,rivalAfter:Attributes,entries:string[]};
/** Per-week trait state (라이벌 의식 multiplier waiting for the first training, 독학파 counters). */
export type WeekBonus={drive?:number,focus?:Record<string,number>,focusDone?:boolean};
export type WeekState={startDay:number,cursor:number,before:Attributes,rivalBefore:Attributes,entries:string[],matchDone:boolean,user?:WeekBonus,rival?:WeekBonus,
 /** 'daily' = played one day at a time from the home screen (오늘의 일정); absent = whole-week plan. */
 mode?:'daily'};
export type Development={traits:string[],experienceBank?:number,wallet:number,
 /** Bought / equipped items (equipment.ts). Absent in saves older than 0.5. */
 equipment?:EquipmentState,
 /** 0.9 (engagement.ts): career deeds for 시그니처 도전, earned signatures, 감독 미션 record, OVR lead over the rival. Absent in older saves. */
 deeds?:Partial<Record<DeedKey,number>>,signatures?:string[],missions?:{done:number,total:number},rivalAhead?:boolean,plan:Daily[],active?:WeekState,notes:WeekNote[],news:News[],rival:{id:string,player:Player,school:number,clubId:string,traits:string[],experienceBank?:number,retired:boolean,trainedWeek:number,lastPlayedWeek:number,history:{week:number,rating:number,goals:number,club:string}[],interests:string[],offers:Offer[]},interestIds:string[]};
export function news(c:Career,text:string,kind:News['kind']='career'){c.development.news.unshift({day:c.day,text,kind});c.development.news=c.development.news.slice(0,150);c.feed.unshift(text);c.feed=c.feed.slice(0,40);}
export function ensureDevelopment(c:Career,opts:{traits?:string[]}={}){
 if(c.development)return;
 c.world.currentDay=c.day;for(const o of c.world.offers){o.issuedDay??=c.day;o.expiresDay??=c.day+14;}
 const rng={seed:(c.seed^0x532af)>>>0},school=(c.school+1+Math.floor(random(rng)*2))%3;
 const rp:Player={...structuredClone(c.player),name:['강시우','이태준','서도윤','정민재'][Math.floor(random(rng)*4)],energy:100,fatigue:0,injuryWeeks:0};
 for(const k of ATTRS)rp.a[k]=clamp(rp.a[k]+(random(rng)-.5)*6,20,99);
 const userTraits=rollTraits(rng),rivalTraits=rollTraits(rng);
 c.development={traits:opts.traits?[...opts.traits]:userTraits,wallet:100,plan:['shooting','running','passing','rest','passing','rest','rest'],notes:[],news:[],interestIds:[],rival:{id:'career-rival',player:rp,school,clubId:'c'+school,traits:rivalTraits,retired:false,trainedWeek:-1,lastPlayedWeek:-1,history:[],interests:[],offers:[]}};
 if(rp.age>=19)c.development.rival.clubId=closestClub(c,rp).id;
 syncRival(c);news(c,`${rp.name} · 같은 나이, 같은 ${rp.pos} 포지션의 라이벌이 등장했습니다.`);news(c,c.development.traits.length?`보유 특성 ${c.development.traits.map(t=>`「${t}」`).join(' ')} · ${c.development.traits.map(t=>traitDef(t)?.summary??t).join(' / ')}`:'보유 특성 없음 · 순수한 노력으로 성장하는 선수');
}
export function syncRival(c:Career){
 const r=c.development.rival,club=c.world.clubs.find(x=>x.id===r.clubId)!;
 const oldClub=c.world.clubs.find(x=>x.id!==club.id&&x.roster.some(p=>p.id===r.id));
 if(oldClub)oldClub.roster=oldClub.roster.filter(p=>p.id!==r.id);
 const prior=club.roster.find(p=>p.id===r.id);
 const data={id:r.id,traits:[...r.traits],injuryWeeks:r.player.injuryWeeks||undefined,name:r.player.name,pos:r.player.pos,age:r.player.age,a:{...r.player.a},potential:r.player.potential,energy:r.player.energy,form:r.history[0]?.rating??6.5,goals:prior?.goals??0,appearances:prior?.appearances??0,years:2};
 if(prior)Object.assign(prior,data);else{const index=club.roster.findIndex(p=>p.pos===r.player.pos);if(index>=0){const removed=club.roster.splice(index,1,data)[0];if(oldClub)oldClub.roster.push(removed);}else club.roster.push(data);}
}
export const isTrainingDay=(p:Player,type:Daily)=>type!=='rest'&&type!=='vacation'&&!p.injuryWeeks&&p.energy>=20;
export const trainingEnvironment=(c:Career,rival:boolean)=>rival?(c.world.clubs.find(x=>x.id===c.development.rival.clubId)?.development??1):clubOf(c.world).development;
export function applyDaily(c:Career,p:Player,type:Daily,trait:TraitInput,rival=false,bonus=1){
 const d=c.development,name=rival?p.name:c.player.name,rest=type==='rest'||type==='vacation';
 if(type==='vacation'&&!rival){if(d.wallet<5)throw Error('휴양 비용 5만원이 부족합니다. 휴식을 선택해 주세요.');d.wallet-=5;}
 if(rest){p.energy=clamp(p.energy+(type==='vacation'?65:30),0,100);p.fatigue=clamp(p.fatigue-(type==='vacation'?60:25)*restRecoveryMultiplier(trait),0,100);return `${name} · ${DAILY[type].label}`;}
 if(p.injuryWeeks||p.energy<20){p.energy=clamp(p.energy+30,0,100);p.fatigue=Math.max(0,p.fatigue-25);return `${name} · 컨디션 부족으로 휴식 전환`;}
 const lucky=random(c)<trainingLuckChance(trait,p.age),efficiency=clamp(1-p.fatigue*.008,.2,1),environment=rival?(c.world.clubs.find(x=>x.id===d.rival.clubId)?.development??1):clubOf(c.world).development;
 const league=(rival?c.world.clubs.find(x=>x.id===d.rival.clubId):clubOf(c.world))?.league??0;
 const pool=DAILY[type].keys;
 const chosen=(type==='defending'||type==='shooting')?pool.filter(()=>random(c)<.55):pool;
 const keys=chosen.length?chosen:[pool[Math.floor(random(c)*pool.length)]];
 const before=overall(p.a),gained=grow(p,keys,(type==='defending'?.07:type==='shooting'?.06:.24)*environment*efficiency*trainingGrowthMultiplier(trait)*abroadGrowthMultiplier(trait,league)*(lucky?10:1)*bonus);
 const bloom=lateBloom(trait);if(bloom&&p.age<bloom.startAge){const holder=rival?d.rival:d;holder.experienceBank=Math.min(bloom.cap,(holder.experienceBank??0)+gained*bloom.bankRate);}
 p.energy=clamp(p.energy-12,0,100);p.fatigue=clamp(p.fatigue+12*trainingFatigueMultiplier(trait),0,100);p.trust=clamp(p.trust+.2*trustGainMultiplier(trait),0,100);
 let hurt=false;if(p.fatigue>=TRAINING_INJURY_FATIGUE&&random(c)<TRAINING_INJURY_CHANCE*injuryChanceMultiplier(trait)){p.injuryWeeks=injuryWeeks(trait,1);hurt=true;}
 const text=`${name} · ${lucky?'럭키! ×10 · ':''}${DAILY[type].label} · OVR +${(overall(p.a)-before).toFixed(2)}${hurt?` · 훈련 중 부상 (${p.injuryWeeks}주)`:''}`;
 // News keeps 럭키 private (no stat names or amounts); the exact gain stays in the growth history entry.
 if(lucky)news(c,rival?`라이벌 ${name} · ${LUCKY_NEWS}`:LUCKY_NEWS,'lucky');if(hurt)news(c,`${name} · 훈련 중 부상 · ${p.injuryWeeks}주 회복 필요`);return text;
}
/** One schedule day for the user or the rival, including 라이벌 의식 and 독학파. */
function trainDay(c:Career,rival:boolean,type:Daily,state:WeekBonus){
 const d=c.development,p=rival?d.rival.player:c.player,traits=rival?d.rival.traits:d.traits,name=p.name;
 const trains=isTrainingDay(p,type);
 let bonus=1;if(trains&&state.drive&&state.drive>1){bonus=state.drive;state.drive=undefined;news(c,`${name} · 라이벌 의식! 훈련에 더욱 몰입합니다.`);}
 let text=applyDaily(c,p,type,traits,rival,bonus);if(bonus>1)text+=` · 라이벌 의식 ×${bonus}`;
 const f=focusBonus(traits);
 if(trains&&f&&!state.focusDone){const counts=state.focus??={};counts[type]=(counts[type]??0)+1;
  if(counts[type]>=f.times){state.focusDone=true;const before=overall(p.a);grow(p,DAILY[type].keys,.24*trainingEnvironment(c,rival)*trainingGrowthMultiplier(traits)*f.extra);text+=` · 독학파 집중 보너스 OVR +${(overall(p.a)-before).toFixed(2)}`;news(c,`${name} · 독학파! ${DAILY[type].label} 주 ${f.times}회 완료 · 추가 성장`);}}
 return text;
}
/** 라이벌 의식: multiplier for the week's first training when the other player out-rated this one last week. */
function rivalryBonus(c:Career,rival:boolean){
 const d=c.development,mult=rivalryDrive(rival?d.rival.traits:d.traits);if(mult<=1)return undefined;
 const prev=c.week-1,mine=c.history[0]?.id===prev?c.history[0].rating:0,theirs=d.rival.history[0]?.week===prev?d.rival.history[0].rating:0;
 const [self,other]=rival?[theirs,mine]:[mine,theirs];
 return other>0&&other>self?mult:undefined;
}
/**
 * Legacy whole-week runner (0.3). The game UI no longer uses it — every week is played with
 * playToday — but it stays for old saves paused mid-week and as the reference the daily
 * schedule is tested against.
 */
export function prepareWeek(c:Career,plan:Daily[]){
 ensureDevelopment(c);if(c.development.active?.mode==='daily')throw Error('이번 주는 오늘의 일정으로 진행 중입니다. 커리어 홈에서 하루씩 이어서 진행하세요.');if(c.match||c.development.active)throw Error('진행 중인 주간 일정이 있습니다.');if(c.world.phase==='retired')throw Error('은퇴한 커리어입니다.');
 if(plan.length!==7||plan.some(x=>!DAILY[x]))throw Error('7일 일정을 모두 선택해 주세요.');
 const matchDay=!['offseason','retired'].includes(c.world.phase);
 if(plan.filter((x,i)=>x==='vacation'&&(!matchDay||i!==5)).length*5>c.development.wallet)throw Error('예정된 휴양 비용이 잔액보다 많습니다.');
 c.development.plan=[...plan];c.development.active={startDay:c.day,cursor:0,before:{...c.player.a},rivalBefore:{...c.development.rival.player.a},entries:[],matchDone:false,user:{drive:rivalryBonus(c,false)},rival:{drive:rivalryBonus(c,true)}};
 advanceSchedule(c);
}
export function advanceSchedule(c:Career){
 const d=c.development,a=d.active;if(!a)return;
 while(a.cursor<7){
  c.day=a.startDay+a.cursor;c.world.currentDay=c.day;expireOffers(c.world);
  if(a.cursor===5&&!a.matchDone&&!['offseason','retired'].includes(c.world.phase)){startCareerMatch(c);return;}
  a.entries.push(trainDay(c,false,d.plan[a.cursor],a.user??={}));
  if(!d.rival.retired)trainDay(c,true,d.plan[a.cursor],a.rival??={});
  a.cursor++;
 }
 d.rival.trainedWeek=c.week;finishWeek(c);
}
export function finishWeek(c:Career){
 const d=c.development,a=d.active;
 if(a&&!a.matchDone&&c.player.injuryWeeks)c.player.injuryWeeks--;
 const released=releaseExperience(c,false);if(released&&a)a.entries.push(`대기만성 · 쌓아 둔 경험이 성장으로 전환 (+${released.toFixed(2)})`);
 if(!d.rival.retired)releaseExperience(c,true);
 if(d.rival.player.injuryWeeks)d.rival.player.injuryWeeks--;
 if(a){d.notes.unshift({week:c.week,startDay:a.startDay,before:a.before,after:{...c.player.a},rivalBefore:a.rivalBefore,rivalAfter:{...d.rival.player.a},entries:a.entries});d.notes=d.notes.slice(0,60);c.day=a.startDay+7;d.active=undefined;}
 else c.day=Math.max(c.day+1,(c.week+1)*7);
 if(!['offseason','retired'].includes(c.world.phase))npcInjuryWeek(c.world,c.week,[d.rival.id]);
 c.week++;c.trainingCount=0;d.wallet+=clubOf(c.world).league===0?2:0;c.world.currentDay=c.day;expireOffers(c.world);scoutInterest(c);syncRival(c);
 c.growth.push({week:c.week,overall:overall(c.player.a)});
}
/** 대기만성: from startAge, convert part of the banked experience into role-attribute growth each week. */
export function releaseExperience(c:Career,rival:boolean){
 const d=c.development,holder=rival?d.rival:d,p=rival?d.rival.player:c.player,bloom=lateBloom(rival?d.rival.traits:d.traits);
 if(!bloom||p.age<bloom.startAge||!(holder.experienceBank??0))return 0;
 const amount=Math.min(holder.experienceBank!,Math.max(bloom.minWeekly,holder.experienceBank!*bloom.weeklyRate)),keys=ROLE_KEYS[p.pos];
 for(const k of keys){p.a[k]=Math.min(100,p.a[k]+amount/keys.length);p.potential=Math.max(p.potential,p.a[k]);}
 holder.experienceBank=Math.max(0,holder.experienceBank!-amount);return amount;
}
export function afterScheduledMatch(c:Career,insight=''){const a=c.development.active;if(a){a.entries.push(`경기 · 평점 ${c.history[0].rating.toFixed(2)}${insight?` · 깨달음 ${insight}`:''}`);a.matchDone=true;a.cursor=6;if(a.mode==='daily'){c.day=a.startDay+a.cursor;c.world.currentDay=c.day;return;}advanceSchedule(c);}else finishWeek(c);}

// ── 오늘의 일정: the same week structure, advanced one day at a time ─────────
export const WEEKDAYS=['월','화','수','목','금','토','일'] as const;
/** Index of today within the current week (0 = 월 … 6 = 일). */
export const todayIndex=(c:Career)=>c.development.active?.cursor??0;
const hasMatchesThisWeek=(c:Career)=>!['offseason','retired'].includes(c.world.phase);
/** Saturday of a week with fixtures, before the match has been played. */
export function isMatchToday(c:Career){const a=c.development.active;return todayIndex(c)===5&&!a?.matchDone&&hasMatchesThisWeek(c);}
function beginDailyWeek(c:Career){
 const d=c.development;
 // Weeks are always played day by day; a week started by an older weekly plan simply continues daily.
 if(d.active&&d.active.mode!=='daily')d.active.mode='daily';
 d.active??={startDay:c.day,cursor:0,before:{...c.player.a},rivalBefore:{...d.rival.player.a},entries:[],matchDone:false,user:{drive:rivalryBonus(c,false)},rival:{drive:rivalryBonus(c,true)},mode:'daily'};
 return d.active;
}
export type TodayResult={day:number,type:Daily,text:string,lucky:boolean,gain:number,weekDone:boolean};
/** Plays today with one activity; the day ends and growth/luck/injury rules apply exactly as in the weekly plan. */
export function playToday(c:Career,type:Daily):TodayResult{
 ensureDevelopment(c);
 if(c.match)throw Error('진행 중인 경기가 있습니다.');
 if(c.world.phase==='retired')throw Error('은퇴한 커리어입니다.');
 if(!DAILY[type])throw Error('알 수 없는 일정입니다.');
 if(type==='vacation'&&c.development.wallet<5)throw Error('휴양 비용 5만원이 부족합니다. 휴식을 선택해 주세요.');
 if(isMatchToday(c))throw Error('오늘은 경기가 있는 날입니다.');
 const d=c.development,a=beginDailyWeek(c),day=a.cursor;
 c.day=a.startDay+day;c.world.currentDay=c.day;expireOffers(c.world);
 d.plan[day]=type;
 const before=overall(c.player.a),text=trainDay(c,false,type,a.user??={});
 if(!d.rival.retired)trainDay(c,true,type,a.rival??={});
 a.entries.push(text);a.cursor++;
 const gain=overall(c.player.a)-before;let weekDone=false;
 if(a.cursor>=7){d.rival.trainedWeek=c.week;finishWeek(c);weekDone=true;}
 else{c.day=a.startDay+a.cursor;c.world.currentDay=c.day;}
 return {day,type,text,lucky:text.includes('럭키!'),gain,weekDone};
}
/** Starts today's match (Saturday). After the result is applied the week continues on Sunday. */
export function startTodayMatch(c:Career){
 ensureDevelopment(c);
 if(c.match)throw Error('이미 진행 중인 경기입니다.');
 if(!isMatchToday(c))throw Error('오늘은 경기일이 아닙니다.');
 const a=beginDailyWeek(c);c.day=a.startDay+a.cursor;c.world.currentDay=c.day;expireOffers(c.world);
 startCareerMatch(c);
}
export function configureTrait(c:Career,m:Match){
 const d=c.development;m.insight={chance:insightChance(d.traits),gains:{},events:[],base:{...c.player.a}};
 // Engine-side trait effects (플레이메이커 · 분위기 메이커 · 집념) for every player in this match.
 m.rosterIds?.forEach((id,i)=>{if(id==='hero')return;const rp=id===d.rival.id?{traits:d.rival.traits}:c.world.clubs.flatMap(x=>x.roster).find(x=>x.id===id);const fx=matchFx(rp?.traits);if(fx)m.players[i].fx=fx;});
 // 0.9 시그니처: the user's earned signature bonuses ride on the same per-player effects.
 const sig=signatureFx(c),traitFx=matchFx(d.traits),userFx=sig?{...traitFx,signature:sig}:traitFx;if(userFx){if(m.userOnPitch!==false)m.players[m.userId].fx=userFx;if(m.benchEntry)m.benchEntry.fx=userFx;}
 const big=c.world.phase!=='league'; // cups, continental and national-team matches
 const rivalSlot=m.rosterIds?.indexOf(d.rival.id)??-1;if(rivalSlot>=0){m.rivalInsight={playerId:rivalSlot,chance:insightChance(d.rival.traits),gains:{},events:[],base:{...d.rival.player.a}};if(hasMatchEffect(d.rival.traits,big))m.players[rivalSlot].a=matchAttributes(d.rival.traits,m.players[rivalSlot].a,()=>random(c),{bigMatch:big}).a;}
 // NPC traits use a per-player hashed RNG so they never shift the career's own random stream.
 m.rosterIds?.forEach((id,i)=>{if(i===rivalSlot||id==='hero'||(i===m.userId&&m.userOnPitch!==false))return;const rp=c.world.clubs.flatMap(x=>x.roster).find(x=>x.id===id);if(!rp||!hasMatchEffect(rp.traits,big))return;const rng={seed:seedFrom((c.seed^c.week)>>>0,'match:'+id)};m.players[i].a=matchAttributes(rp.traits,m.players[i].a,()=>random(rng),{bigMatch:big}).a;});
 const sub=superSubMultiplier(d.traits),effect=hasMatchEffect(d.traits,big);
 if(!effect&&sub===1){m.traitBoost=false;return;}
 const gear=matchAttributesOf(c); // base + equipment; 깨달음 still checks the base (m.insight.base)
 const r=effect?matchAttributes(d.traits,gear,()=>random(c),{bigMatch:big}):{a:gear,boosted:false,news:[] as string[]};
 m.traitBoost=r.boosted;m.traitNotes=[...r.news];
 if(effect&&m.userOnPitch!==false)m.players[m.userId].a=r.a;
 if(m.benchEntry){m.benchEntry.a=sub===1?{...r.a}:Object.fromEntries(ATTRS.map(k=>[k,Math.min(100,r.a[k]*sub)])) as Attributes;if(sub>1)m.traitNotes.push(`슈퍼 조커 · 교체 투입에 강한 선수`);}
 for(const t of r.news)news(c,t);
}
/** Formats exact insight gains for the growth history (e.g. "슈팅 +1 · 패스 +1"). */
export const insightDetail=(gains:Partial<Record<Attr,number>>)=>ATTRS.filter(k=>gains[k]).map(k=>`${LABELS[k]} +${gains[k]}`).join(' · ');
/** Applies the user's 깨달음 gains to the permanent attributes; returns the exact gains for the growth history. */
export function applyInsights(c:Career,m:Match){
 if(!m.insight)return '';const applied:Partial<Record<Attr,number>>={};
 for(const k of ATTRS){const gain=m.insight.gains[k]??0;if(!gain)continue;const next=Math.min(100,c.player.a[k]+gain);if(next<=c.player.a[k])continue;applied[k]=Math.round((next-c.player.a[k])*100)/100;c.player.a[k]=next;c.player.potential=Math.max(c.player.potential,c.player.a[k]);}
 const detail=insightDetail(applied);if(detail)news(c,INSIGHT_NEWS,'insight');return detail;
}
/** Applies a rival's 깨달음 gains (same rules as the user). */
function applyRivalInsights(c:Career,gains:Partial<Record<Attr,number>>|undefined){
 const r=c.development.rival;let any=false;
 for(const k of ATTRS){const n=gains?.[k]??0;if(!n)continue;const next=Math.min(100,r.player.a[k]+n);if(next<=r.player.a[k])continue;r.player.a[k]=next;r.player.potential=Math.max(r.player.potential,next);any=true;}
 if(any)news(c,`라이벌 ${r.player.name} · ${INSIGHT_NEWS}`,'insight');
}
export function playRival(c:Career,main:Match){
 const r=c.development.rival;if(r.retired||r.lastPlayedWeek===c.week)return undefined;
 if(!c.development.active&&r.trainedWeek!==c.week){const state:WeekBonus={drive:rivalryBonus(c,true)};for(let i=0;i<7;i++)trainDay(c,true,c.development.plan[i],state);r.trainedWeek=c.week;syncRival(c);}
 const actual=main.rosterIds?.indexOf(r.id)??-1;const prior=main.replacedPlayers?.find(x=>x.rosterId===r.id)?.player;if(actual<0&&!prior&&(r.clubId===c.world.clubId||nextOpponent(c.world).club?.id===r.clubId)){r.lastPlayedWeek=c.week;return;}let rp,score:[number,number]|undefined;
 if(actual>=0||prior){rp=prior??main.players[actual];applyRivalInsights(c,main.rivalInsight?.gains);}
 else if(c.world.phase==='league'){
  const fixture=c.world.fixtures[c.world.round]?.find(f=>f.home===r.clubId||f.away===r.clubId);if(!fixture)return;
  const other=c.world.clubs.find(x=>x.id===(fixture.home===r.clubId?fixture.away:fixture.home))!;
  const rm=createMatch((c.seed^c.week*9239)>>>0,{name:r.player.name,pos:r.player.pos,a:r.player.a,energy:r.player.energy},overall(other.roster[0].a));
  const ownClub=c.world.clubs.find(x=>x.id===r.clubId)!;
  const teams=[chooseLineup(ownClub),chooseLineup(other)];
  rm.tactics=[ownClub.coach.style,other.coach.style];
  const rivalIndex=teams[0].findIndex(p=>p.id===r.id);
  for(let t=0;t<2;t++)for(let i=0;i<11;i++){const source=teams[t][i],slot=rm.players[t*11+i];slot.name=source.name;slot.a={...source.a};slot.pos=source.slotPos;slot.energy=source.energy;slot.fx=matchFx(source.traits);
   if((t?other:ownClub).coach.formation==='4-4-2'){const anchors=[[5,34],[25,10],[21,26],[21,42],[25,58],[46,9],[40,25],[40,43],[46,59],[67,25],[67,43]];slot.homeX=anchors[i][0];slot.homeY=anchors[i][1];slot.x=t?105-slot.homeX:slot.homeX;slot.y=slot.homeY;}}
  rm.userOnPitch=rivalIndex>=0;if(rivalIndex>=0)rm.userId=rivalIndex;
  rm.decision=rm.userOnPitch&&rm.ball.owner===rm.userId;
  rm.insight={chance:insightChance(r.traits),gains:{},events:[],base:{...r.player.a}};
  if(rm.userOnPitch&&hasMatchEffect(r.traits))rm.players[rm.userId].a=matchAttributes(r.traits,rm.players[rm.userId].a,()=>random(c)).a;
  finishMatch(rm);rp=rm.userOnPitch?rm.players[rm.userId]:undefined;score=rm.score;r.lastPlayedWeek=c.week;
  applyRivalInsights(c,rm.insight.gains);
 }
 if(rp){const v=rating(rp);r.history.unshift({week:c.week,rating:v,goals:rp.stats.goals,club:r.clubId});r.history=r.history.slice(0,200);r.lastPlayedWeek=c.week;r.player.energy=Math.min(100,rp.energy+30);grow(r.player,['passing','shooting','positioning'],.18);
  // Same match-injury rule as the user and NPCs; an injured rival is left out of lineups until recovered.
  if(rp.stats.minutes>0&&!r.player.injuryWeeks){const weeks=matchInjury(c.seed^c.week,r.id,rp.energy,r.traits);if(weeks){r.player.injuryWeeks=weeks;news(c,`라이벌 ${r.player.name} · 경기 중 부상 · ${weeks}주 회복 필요`);}}if(v>=7.5)news(c,`라이벌 ${r.player.name} · 평점 ${v.toFixed(2)}의 활약!`,'rating');}
 syncRival(c);return score?{clubId:r.clubId,score}:undefined;
}
/** Clubs show interest only when their level at the player's position is within this many points of the player's own (0.6). */
export const INTEREST_FIT=8;
/** Professional club whose level at the player's position is closest to the player's ability. */
function closestClub(c:Career,p:Player){const a=roleAbility(p.a,p.pos);return c.world.clubs.filter(x=>x.league>0&&x.id!==c.world.clubId).sort((x,y)=>Math.abs(clubLevel(x,p.pos)-a)-Math.abs(clubLevel(y,p.pos)-a))[0];}
export function scoutInterest(c:Career){
 if(c.world.phase==='retired'||c.world.phase==='offseason')return;
 for(const rival of [false,true]){
  const p=rival?c.development.rival.player:c.player,ids=rival?c.development.rival.interests:c.development.interestIds;
  if(p.age<17||random(c)>.35)continue;
  const candidates=c.world.clubs.filter(x=>x.league>0&&!ids.includes(x.id)&&x.id!==(rival?c.development.rival.clubId:c.world.clubId)&&Math.abs(clubLevel(x,p.pos)-roleAbility(p.a,p.pos))<=INTEREST_FIT&&x.budget>=roleSalary(roleAbility(p.a,p.pos),x.league)*2);
  if(!candidates.length)continue;const club=candidates[Math.floor(random(c)*candidates.length)];ids.push(club.id);news(c,`${club.name} · ${rival?'라이벌 ':''}${p.name}에게 관심! 졸업 가능한 시즌 종료 후 정식 제안 예정`,'interest');
 }
 c.world.interestedClubIds=[...c.development.interestIds];
}
export function announceOffers(c:Career){const d=c.development;c.world.currentDay=c.day;c.world.interestedClubIds=[...d.interestIds];generateOffers(c.world,{...c.player,age:c.player.age+1},c.history[0]?.rating||6.5);for(const o of c.world.offers)news(c,`${c.world.clubs.find(x=>x.id===o.clubId)!.name} · 14일 유효한 계약 제안 도착`,'offer');
 if(d.rival.player.age>=18){const rw=structuredClone(c.world);rw.clubId=d.rival.clubId;rw.contract={salary:0,years:0};rw.interestedClubIds=d.rival.interests;generateOffers(rw,{...d.rival.player,age:d.rival.player.age+1},d.rival.history[0]?.rating??6.5);d.rival.offers=rw.offers;for(const o of rw.offers.filter(o=>d.rival.interests.includes(o.clubId)))news(c,`${c.world.clubs.find(x=>x.id===o.clubId)!.name} · 라이벌 ${d.rival.player.name}에게 정식 제안`,'offer');}
}
export function renewSearch(c:Career){if(c.world.phase!=='offseason'||c.match)throw Error('시즌 종료 후 구직할 수 있습니다.');expireOffers(c.world);if(c.world.offers.length)throw Error('아직 유효한 제안이 있습니다.');announceOffers(c);}
export function ageRival(c:Career){const r=c.development.rival;r.player.age=c.player.age;r.player.energy=100;r.player.fatigue=0;r.retired=c.player.age>=36;if(!r.retired)applyAging(r.player.a,r.traits,r.player.age);
 const choices=r.offers.filter(o=>o.clubId!==c.world.clubId&&(o.expiresDay??Infinity)>c.day);
 if(r.player.age>=19&&(c.world.clubs.find(x=>x.id===r.clubId)!.league===0||choices.length)){const best=choices.sort((a,b)=>b.salary-a.salary)[0];const club=best?c.world.clubs.find(x=>x.id===best.clubId)!:closestClub(c,r.player);r.clubId=club.id;news(c,`${r.player.name} · ${club.name} 입단!`);}
 r.offers=[];if(c.player.age>=19){r.interests=[];c.development.interestIds=[];}c.world.interestedClubIds=[...c.development.interestIds];syncRival(c);
}
