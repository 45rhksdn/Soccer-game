import {attributes,clamp,random,type Attributes,type Position} from './engine';
import {roleAbility} from './roles';
import {npcTraits,trainingGrowthMultiplier,lateBloom,abroadGrowthMultiplier,injuryChanceMultiplier,injuryWeeks,seedFrom,restRecoveryMultiplier,trainingFatigueMultiplier} from './traits';
import {agingLoss,npcGrowthRate} from './aging';
export type RosterPlayer={id:string,traits?:string[],
 /** Weeks out injured (0.5). Injured players are left out of lineups until recovered. */
 injuryWeeks?:number,name:string,pos:Position,age:number,a:Attributes,potential:number,energy:number,form:number,goals:number,appearances:number,years:number};
export type Coach={name:string,style:'점유'|'역습'|'수비',preference:'유망주'|'현재 실력'|'베테랑',formation:'4-3-3'|'4-4-2'};
export type Club={id:string,name:string,league:number,budget:number,reputation:number,development:number,coach:Coach,roster:RosterPlayer[]};
export type Fixture={home:string,away:string,score?:[number,number]};
export type Standing={id:string,played:number,won:number,draw:number,lost:number,gf:number,ga:number,points:number};
export type Offer={clubId:string,salary:number,years:number,fee:number,role:string,negotiated:boolean,status:'open'|'rejected',issuedDay?:number,expiresDay?:number};
export type SeasonRecord={year:number,club:string,league:string,rank:number,appearances:number,minutes:number,goals:number,assists:number,rating:number,champion:string};
export type World={currentDay?:number,interestedClubIds?:string[],seed:number,year:number,clubId:string,clubs:Club[],round:number,fixtures:Fixture[][],tables:Standing[],phase:'league'|'cup'|'international'|'national'|'offseason'|'retired',knockoutRound:number,opponentId:string|null,nationalCaps:number,nationalGoals:number,offers:Offer[],contract:{salary:number,years:number},wealth:number,records:SeasonRecord[],achievements:string[],news:string[],ledger:{year:number,from:string,to:string,fee:number,player:string}[],currentSeasonStart:number,nextId:number};
export const LEAGUES=['전국 고교 리그','대한 프로 리그','유럽 챌린저 리그','유럽 프리미어 리그'];
export const leagueNames=[['부산 해온고','서울 한울고','수원 청명고','인천 새봄고','대전 미래고','광주 빛고을고'],['부산 오션FC','서울 유나이티드','수원 블루윙','인천 하버','대전 시티','울산 스틸'],['로테르담 노르트','브뤼헤 아틀라스','프라하 스타','리스본 마리나','리옹 에투알','빈 아들러'],['런던 크라운','마드리드 솔','밀라노 로쏘','뮌헨 팔케','파리 루미에르','바르셀로나 아술']];
const POS:Position[]=['GK','LB','CB','CB','RB','CM','CM','CM','LW','ST','RW','GK','LB','CB','RB','CM','CM','LW','ST','RW'];
export const lineupSlots=(coach:Coach):Position[]=>coach.formation==='4-4-2'?['GK','LB','CB','CB','RB','LW','CM','CM','RW','ST','ST']:POS.slice(0,11);
function rookie(w:{seed:number,nextId:number},league:number,pos:Position,age?:number):RosterPlayer{const base=[44,58,67,77][league],a=attributes(base);for(const key of Object.keys(a) as (keyof Attributes)[])a[key]=clamp(base+(random(w)-.5)*15,25,92);const id='p'+w.nextId++;return {id,traits:npcTraits(w.seed,id),name:['김','이','박','정','강','최'][Math.floor(random(w)*6)]+['준서','도윤','태성','민호','현준','재민','우진','지훈'][Math.floor(random(w)*8)],pos,age:age??(league===0?16+Math.floor(random(w)*3):19+Math.floor(random(w)*15)),a,potential:clamp(base+8+random(w)*15,45,95),energy:100,form:6.5,goals:0,appearances:0,years:1+Math.floor(random(w)*3)};}
export function newWorld(seed:number,school:number,startWeek=0):World{const w:World={seed:seed^0x4f1a,year:2026,clubId:'c'+school,clubs:[],round:0,fixtures:[],tables:[],phase:'league',knockoutRound:0,opponentId:null,nationalCaps:0,nationalGoals:0,offers:[],contract:{salary:0,years:0},wealth:0,records:[],achievements:[],news:[],ledger:[],currentSeasonStart:startWeek,nextId:1};for(let l=0;l<4;l++)for(let i=0;i<6;i++){const club:Club={id:'c'+(l*6+i),name:leagueNames[l][i],league:l,budget:[0,8000,20000,70000][l],reputation:[20,45,65,85][l]+i,development:.9+random(w)*.3,coach:{name:['박정호','이성민','김도현','정태훈','최준혁','서민우'][i],style:(['점유','역습','수비'] as const)[i%3],preference:(['유망주','현재 실력','베테랑'] as const)[i%3],formation:i%2?'4-4-2':'4-3-3'},roster:[]};club.roster=POS.map(pos=>rookie(w,l,pos));w.clubs.push(club);}resetSeason(w);return w;}
export const clubOf=(w:World)=>w.clubs.find(c=>c.id===w.clubId)!;
export const sortedTable=(w:World,league=clubOf(w).league)=>w.tables.filter(t=>w.clubs.find(c=>c.id===t.id)!.league===league).sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.id.localeCompare(b.id));
export function resetSeason(w:World){w.round=0;w.phase='league';w.opponentId=null;w.knockoutRound=0;w.offers=[];w.tables=w.clubs.map(c=>({id:c.id,played:0,won:0,draw:0,lost:0,gf:0,ga:0,points:0}));w.fixtures=Array.from({length:10},()=>[]);for(let l=0;l<4;l++){const ids=w.clubs.filter(c=>c.league===l).map(c=>c.id);for(let r=0;r<5;r++){for(let i=0;i<3;i++){const a=ids[i],b=ids[5-i];w.fixtures[r].push({home:r%2?a:b,away:r%2?b:a});w.fixtures[r+5].push({home:r%2?b:a,away:r%2?a:b});}ids.splice(1,0,ids.pop()!);}}}
export function nextFixture(w:World){return w.phase==='league'?w.fixtures[w.round]?.find(f=>f.home===w.clubId||f.away===w.clubId):undefined;}
export function nextOpponent(w:World){if(w.phase==='national')return {name:w.knockoutRound===0?'일본 대표팀':'브라질 대표팀',strength:w.knockoutRound===0?68:76};const f=nextFixture(w);const id=f?(f.home===w.clubId?f.away:f.home):w.opponentId;const club=w.clubs.find(c=>c.id===id);return {name:club?.name??'시즌 종료',strength:club?teamStrength(club):45,club};}
export function selectionScore(a:Attributes,pos:Position,target:Position,age:number,energy:number,form:number,coach:Coach,secondary?:Position){const fit=pos===target?0:secondary===target?-3:(['LB','RB'].includes(pos)&&['LB','RB'].includes(target)||['LW','RW'].includes(pos)&&['LW','RW'].includes(target))?-5:-18;const tactical=coach.style==='점유'?a.passing:coach.style==='역습'?a.speed:a.defending;const preference=coach.preference==='유망주'?clamp(23-age,-5,5)*.45:coach.preference==='베테랑'?clamp(age-24,-5,5)*.4:0;return roleAbility(a,target)+fit+(form-6.5)*3-(100-energy)*.12+(tactical-50)*.035+preference;}
/** Injured players sit out; if a club ever had fewer than 11 fit players, the least injured would fill in. */
function available(roster:RosterPlayer[]){const fit=roster.filter(p=>!p.injuryWeeks);return fit.length>=11?fit:[...fit,...roster.filter(p=>p.injuryWeeks).sort((a,b)=>a.injuryWeeks!-b.injuryWeeks!).slice(0,11-fit.length)];}
export function chooseLineup(club:Club,hero?:RosterPlayer&{secondary?:Position}){const pool=[...available(club.roster),...(hero?[hero]:[])],used=new Set<string>();return lineupSlots(club.coach).map(target=>{const sorted=pool.filter(p=>!used.has(p.id)).sort((a,b)=>selectionScore(b.a,b.pos,target,b.age,b.energy,b.form,club.coach,b.id==='hero'?hero?.secondary:undefined)-selectionScore(a.a,a.pos,target,a.age,a.energy,a.form,club.coach,a.id==='hero'?hero?.secondary:undefined));const p=sorted[0];used.add(p.id);return {...p,slotPos:target};});}
export function teamStrength(c:Club){return chooseLineup(c).reduce((n,p)=>n+roleAbility(p.a,p.slotPos)*(0.75+p.energy/400),0)/11;}
function poisson(w:World,mean:number){let product=1,n=0;do{n++;product*=random(w);}while(product>Math.exp(-mean)&&n<12);return n-1;}
export function lightweight(w:World,home:Club,away:Club):[number,number]{const diff=teamStrength(home)-teamStrength(away);return [poisson(w,clamp(1.35+diff*.045,.25,3.5)),poisson(w,clamp(1.2-diff*.045,.25,3.5))];}
function tableResult(w:World,f:Fixture,score:[number,number]){if(f.score)throw Error('이미 처리한 경기입니다.');f.score=score;const h=w.tables.find(t=>t.id===f.home)!,a=w.tables.find(t=>t.id===f.away)!;for(const [t,gf,ga]of [[h,score[0],score[1]],[a,score[1],score[0]]] as [Standing,number,number][]){t.played++;t.gf+=gf;t.ga+=ga;if(gf>ga){t.won++;t.points+=3;}else if(gf===ga){t.draw++;t.points++;}else t.lost++;}}
export function advanceLeague(w:World,score:[number,number],extra?:{clubId:string,score:[number,number]}){for(const f of w.fixtures[w.round]){const home=w.clubs.find(c=>c.id===f.home)!,away=w.clubs.find(c=>c.id===f.away)!;const own=f.home===w.clubId||f.away===w.clubId;const result=own?(f.home===w.clubId?score:[score[1],score[0]] as [number,number]):extra&&(f.home===extra.clubId||f.away===extra.clubId)?(f.home===extra.clubId?extra.score:[extra.score[1],extra.score[0]] as [number,number]):lightweight(w,home,away);tableResult(w,f,result);if(!own)for(const [club,goals] of [[home,result[0]],[away,result[1]]] as [Club,number][]){const lineup=chooseLineup(club);for(const p of lineup){const original=club.roster.find(x=>x.id===p.id)!;original.appearances++;original.form=clamp(6.3+random(w)*1.2+(goals>1?.2:0),5,9);original.energy=clamp(original.energy-5+random(w)*10,65,100);}const attackers=club.roster.filter(p=>['ST','LW','RW'].includes(p.pos));for(let i=0;i<goals;i++)attackers[Math.floor(random(w)*attackers.length)].goals++;}}w.round++;}
export function startPostseason(w:World,ability:number,age:number){const ranked=sortedTable(w);if(ranked.findIndex(t=>t.id===w.clubId)<4){w.phase='cup';w.knockoutRound=0;w.opponentId=ranked.filter(t=>t.id!==w.clubId)[0].id;}else startInternational(w,ability,age);}
export function startInternational(w:World,ability:number,age:number){if(clubOf(w).league>=2&&sortedTable(w).findIndex(t=>t.id===w.clubId)<2){w.phase='international';w.knockoutRound=0;w.opponentId=sortedTable(w,clubOf(w).league===3?2:3)[0].id;}else startNational(w,ability,age);}
export function startNational(w:World,ability:number,age:number){if(age>=19&&ability>=66){w.phase='national';w.knockoutRound=0;w.opponentId=null;w.news.unshift('국가대표 발탁 · 국제 초청대회 출전');}else w.phase='offseason';}
export function advanceCup(w:World,won:boolean,ability:number,age:number){if(won&&w.knockoutRound===0){w.knockoutRound=1;if(w.phase!=='national'){const candidates=w.clubs.filter(c=>c.id!==w.clubId&&c.id!==w.opponentId&&c.league===(w.phase==='cup'?clubOf(w).league:3));w.opponentId=candidates[Math.floor(random(w)*candidates.length)].id;}return;}if(won)w.achievements.unshift(`${w.year} ${w.phase==='cup'?'국내 컵':w.phase==='national'?'국제 초청대회':'대륙 클럽 컵'} 우승`);if(w.phase==='cup')startInternational(w,ability,age);else if(w.phase==='international')startNational(w,ability,age);else w.phase='offseason';}
export function marketValue(ability:number,age:number,form:number,years:number){return Math.round(Math.max(50,(ability-35)**2*2*(age<24?1.35:age>31?.55:1)*(1+(form-6.5)*.12)*(.65+Math.min(3,years)*.12)));}
/** A club's level for one position: mean role ability of its two best players there (the likely starters). */
export function clubLevel(club:Club,pos:Position){const xs=club.roster.filter(r=>r.pos===pos).map(r=>roleAbility(r.a,pos)).sort((a,b)=>b-a).slice(0,2);if(!xs.length){const all=club.roster.filter(r=>r.pos!=='GK').map(r=>roleAbility(r.a,pos)).sort((a,b)=>b-a).slice(0,2);return all.reduce((n,x)=>n+x,0)/Math.max(1,all.length);}return xs.reduce((n,x)=>n+x,0)/xs.length;}
/**
 * Offer window by fit (= player's role ability − club level at that position).
 * Clubs only bid for players who would roughly start or rotate there (min…max); under-22s may be
 * signed as prospects a little below; clubs far weaker than the player do not bid.
 */
export const OFFER_FIT={min:-6,youthMin:-10,max:10,interestedMin:-12} as const;
/** Offers follow the player's current position ability (0.6). */
export function generateOffers(w:World,p:{a:Attributes,pos:Position,age:number,energy:number},form:number){
  const ability=roleAbility(p.a,p.pos),current=clubOf(w),fee=current.league===0||w.contract.years<=0?0:marketValue(ability,p.age,form,w.contract.years);
  w.offers=[];if(p.age<19&&current.league===0)return;
  const make=(club:Club,fit:number,isCurrent:boolean,guaranteed:boolean):Offer=>{const salary=roleSalary(ability,club.league);return {clubId:club.id,salary,years:2,fee:isCurrent?0:guaranteed?Math.max(0,Math.min(fee,club.budget-salary*2)):fee,issuedDay:w.currentDay??0,expiresDay:(w.currentDay??0)+14,role:fit>=0?'주전 경쟁':fit>=-4?'로테이션':'유망주 / 벤치',negotiated:false,status:'open'};};
  const pro=w.clubs.filter(c=>c.league>0).map(club=>({club,fit:ability-clubLevel(club,p.pos)}));
  for(const {club,fit} of pro){
    const isCurrent=club.id===w.clubId,guaranteed=!!w.interestedClubIds?.includes(club.id);
    const inWindow=fit>=(p.age<22?OFFER_FIT.youthMin:OFFER_FIT.min)&&fit<=OFFER_FIT.max;
    const interested=guaranteed&&fit>=OFFER_FIT.interestedMin&&fit<=OFFER_FIT.max+6;
    if(!isCurrent&&!inWindow&&!interested)continue;
    const salary=roleSalary(ability,club.league);if(club.budget<fee+salary*2&&!isCurrent&&!guaranteed)continue;
    w.offers.push(make(club,fit,isCurrent,guaranteed));
  }
  // Never leave a professional player without a market: the two closest-level clubs that can afford it bid.
  if(!w.offers.some(o=>o.clubId!==w.clubId))for(const {club,fit} of pro.filter(x=>x.club.id!==w.clubId&&x.club.budget>=roleSalary(ability,x.club.league)*2).sort((a,b)=>Math.abs(a.fit-2)-Math.abs(b.fit-2)).slice(0,2))w.offers.push(make(club,fit,false,false));
  w.offers=pickOffers(w,w.offers,new Map(pro.map(x=>[x.club.id,x.fit])));
  w.offers.sort((a,b)=>w.clubs.find(c=>c.id===a.clubId)!.league-w.clubs.find(c=>c.id===b.clubId)!.league);
}
/** At most this many clubs bid in one window (the current club's renewal included). */
export const MAX_OFFERS=6;
/**
 * 0.9.1: keep the renewal and the clubs that showed interest, then fill the remaining places league by
 * league in turn (best-fitting club of each league first), so the offers span as many leagues as possible.
 */
function pickOffers(w:World,offers:Offer[],fit:Map<string,number>){
  if(offers.length<=MAX_OFFERS)return offers;
  const league=(o:Offer)=>w.clubs.find(c=>c.id===o.clubId)!.league,score=(o:Offer)=>Math.abs((fit.get(o.clubId)??0)-2);
  const picked=offers.filter(o=>o.clubId===w.clubId);
  for(const o of offers.filter(o=>o.clubId!==w.clubId&&w.interestedClubIds?.includes(o.clubId)).sort((a,b)=>score(a)-score(b)))if(picked.length<MAX_OFFERS)picked.push(o);
  const byLeague=new Map<number,Offer[]>();
  for(const o of offers.filter(o=>!picked.includes(o)).sort((a,b)=>score(a)-score(b)))byLeague.set(league(o),[...(byLeague.get(league(o))??[]),o]);
  // Leagues not represented yet go first in each round.
  while(picked.length<MAX_OFFERS&&[...byLeague.values()].some(q=>q.length)){
    const order=[...byLeague.keys()].filter(l=>byLeague.get(l)!.length).sort((a,b)=>picked.filter(o=>league(o)===a).length-picked.filter(o=>league(o)===b).length||score(byLeague.get(a)![0])-score(byLeague.get(b)![0]));
    for(const l of order){if(picked.length>=MAX_OFFERS)break;picked.push(byLeague.get(l)!.shift()!);}
  }
  return picked;
}
export function negotiate(w:World,clubId:string){expireOffers(w);const o=w.offers.find(o=>o.clubId===clubId);if(!o||o.status!=='open'||o.negotiated)throw Error('협상 가능한 제안이 없습니다.');o.negotiated=true;const club=w.clubs.find(c=>c.id===clubId)!;if(random(w)<.68&&club.budget>=o.fee+o.salary*2.3){o.salary=Math.round(o.salary*1.15);w.news.unshift(`${club.name} · 연봉 15% 인상 수락`);}else{w.news.unshift(`${club.name} · 인상 거절, 기존 조건 유지`);}}
export function acceptOffer(w:World,clubId:string,name:string){expireOffers(w);if(w.phase!=='offseason')throw Error('이적은 시즌 종료 후 가능합니다.');const o=w.offers.find(o=>o.clubId===clubId&&o.status==='open');if(!o)throw Error('유효한 제안이 아닙니다.');const buyer=w.clubs.find(c=>c.id===clubId)!,seller=clubOf(w);if(buyer.budget<o.fee+o.salary*o.years)throw Error('구단 예산이 부족합니다.');if(buyer.id!==seller.id){buyer.budget-=o.fee;seller.budget+=o.fee;w.ledger.push({year:w.year,from:buyer.id,to:seller.id,fee:o.fee,player:name});}w.clubId=buyer.id;w.contract={salary:o.salary,years:o.years};w.offers=[];w.news.unshift(`${name} · ${buyer.name}와 ${o.years}년 계약`);}
export function advanceWorldYear(w:World){w.year++;for(const c of w.clubs){c.budget+= [0,2500,6000,16000][c.league];for(let i=0;i<c.roster.length;i++){const p=c.roster[i];if(p.id==='career-rival')continue;p.age++;p.years=Math.max(0,p.years-1);if(p.age>=(c.league===0?19:36)){c.roster[i]=rookie(w,c.league,p.pos,c.league===0?16:18);continue;}const bloom=lateBloom(p.traits),late=bloom&&p.age>=bloom.startAge&&p.age<bloom.startAge+6?.6:0,rate=npcGrowthRate(p.age)*trainingGrowthMultiplier(p.traits)*abroadGrowthMultiplier(p.traits,c.league);
// Same age model as the user and the rival (aging.ts): growth slows towards 32, decline from 33.
for(const k of Object.keys(p.a) as (keyof Attributes)[])p.a[k]=clamp(p.a[k]+Math.max(0,p.potential-p.a[k])*rate-agingLoss(p.traits,p.age,k)+late,20,96);p.energy=100;p.goals=0;p.appearances=0;}
if(random(w)<.22){c.coach.preference=(['유망주','현재 실력','베테랑'] as const)[Math.floor(random(w)*3)];c.coach.style=(['점유','역습','수비'] as const)[Math.floor(random(w)*3)];c.coach.name='신임 '+c.coach.name.replace('신임 ','');w.news.unshift(`${c.name} · 감독 교체`);}}
// AI clubs buy for a weak position with an explicit balanced transfer ledger.
for(const buyer of w.clubs.filter(c=>c.league>0)){const weakest=buyer.roster.filter(p=>p.id!=='career-rival').sort((a,b)=>roleAbility(a.a,a.pos)-roleAbility(b.a,b.pos))[0];const seller=w.clubs.filter(c=>c.league===buyer.league&&c.id!==buyer.id)[Math.floor(random(w)*5)];const candidate=seller.roster.filter(p=>p.id!=='career-rival'&&p.pos===weakest.pos&&roleAbility(p.a,p.pos)>roleAbility(weakest.a,weakest.pos)+2).sort((a,b)=>roleAbility(b.a,b.pos)-roleAbility(a.a,a.pos))[0];if(!candidate)continue;const fee=marketValue(roleAbility(candidate.a,candidate.pos),candidate.age,candidate.form,candidate.years);if(buyer.budget<fee+2000)continue;buyer.budget-=fee;seller.budget+=fee;buyer.roster=buyer.roster.filter(p=>p.id!==weakest.id);seller.roster=seller.roster.filter(p=>p.id!==candidate.id);buyer.roster.push(candidate);seller.roster.push(weakest);candidate.years=3;w.ledger.push({year:w.year,from:buyer.id,to:seller.id,fee,player:candidate.name});}w.news=w.news.slice(0,60);w.ledger=w.ledger.slice(-200);resetSeason(w);}

export const roleSalary=(ability:number,league:number)=>Math.round(Math.max(30,ability-35)*[0,2,4,8][league]);
export function expireOffers(w:World){w.offers=w.offers.filter(o=>(o.expiresDay??Infinity)>(w.currentDay??0));}

// ── NPC injuries (0.5) ─────────────────────────────────────────────
// NPCs use the same trait effects as the user (유리몸/잔부상 raise the chance, 회복력/강철몸 lower it,
// injuryWeeks adds/removes weeks). Rolls use a hashed RNG per player and week, so they never shift
// the world's or the career's random streams.
/** Weekly chance of an NPC picking up a knock in training or a match not simulated in detail. */
export const NPC_WEEKLY_INJURY=.008;
/** Match injury rule shared by the user, the rival and NPCs: tired (< 35 energy) players risk 4 %. */
export const MATCH_INJURY_ENERGY=35,MATCH_INJURY_CHANCE=.04;
const roll=(seed:number,key:string)=>random({seed:seedFrom(seed>>>0,key)});
/** One week for every NPC: injured players recover a week, fit players may get injured. The rival is handled by the career. */
export function npcInjuryWeek(w:World,week:number,skip:string[]=[]){
  for(const c of w.clubs)for(const p of c.roster){
    if(skip.includes(p.id))continue;
    if(p.injuryWeeks){p.injuryWeeks--;if(!p.injuryWeeks)delete p.injuryWeeks;continue;}
    const r=roll(w.seed^week,'inj:'+p.id);
    if(r<NPC_WEEKLY_INJURY*injuryChanceMultiplier(p.traits))p.injuryWeeks=injuryWeeks(p.traits,1+Math.floor(roll(w.seed^week,'len:'+p.id)*3));
  }
}
/** Injury after a detailed match, from end-of-match energy (same rule for everyone). Returns weeks or 0. */
export function matchInjury(seed:number,key:string,energy:number,traits:readonly string[]|undefined,baseWeeks=2){
  if(energy>=MATCH_INJURY_ENERGY)return 0;
  return roll(seed,'match-inj:'+key)<MATCH_INJURY_CHANCE*injuryChanceMultiplier(traits)?injuryWeeks(traits,baseWeeks):0;
}
/** Between-match energy recovery for NPCs, scaled by fatigue/recovery traits (강철 체력, 유리몸, 강철몸 …). */
export const npcRecovery=(p:RosterPlayer,base=8)=>base*restRecoveryMultiplier(p.traits)/trainingFatigueMultiplier(p.traits);
export function clearInjuries(w:World,skip:string[]=[]){for(const c of w.clubs)for(const p of c.roster)if(!skip.includes(p.id))delete p.injuryWeeks;}
