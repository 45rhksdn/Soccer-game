import {LEAGUE_DATA,leagueDef,LEAGUES,leagueNames,WORLD_CLUB_COUNT} from './leagues';
export {LEAGUES,leagueNames} from './leagues';
import {attributes,clamp,random,type Attributes,type Position} from './engine';
import {roleAbility} from './roles';
import {npcTraits,trainingGrowthMultiplier,lateBloom,abroadGrowthMultiplier,injuryChanceMultiplier,injuryWeeks,seedFrom,restRecoveryMultiplier,trainingFatigueMultiplier} from './traits';
import {agingLoss,npcGrowthRate} from './aging';
export type RosterPlayer={id:string,traits?:string[],
 /** Weeks out injured (0.5). Injured players are left out of lineups until recovered. */
 injuryWeeks?:number,name:string,pos:Position,age:number,a:Attributes,potential:number,energy:number,form:number,goals:number,appearances:number,years:number};
export type Coach={name:string,style:'점유'|'역습'|'수비',preference:'유망주'|'현재 실력'|'베테랑',formation:'4-3-3'|'4-4-2'};
export type Club={id:string,name:string,league:number,budget:number,reputation:number,development:number,coach:Coach,roster:RosterPlayer[],baseLevel?:number};
export type Fixture={home:string,away:string,score?:[number,number]};
export type Standing={id:string,played:number,won:number,draw:number,lost:number,gf:number,ga:number,points:number};
export type Offer={clubId:string,salary:number,years:number,fee:number,role:string,negotiated:boolean,status:'open'|'rejected',reason?:string,competition?:{name:string,ability:number}[],expectedStarts?:string,kind?:'transfer'|'loan',loanAllowed?:boolean,issuedDay?:number,expiresDay?:number};
export type SeasonRecord={year:number,club:string,league:string,rank:number,appearances:number,minutes:number,goals:number,assists:number,rating:number,champion:string};
export type ScoutReport={clubId:string,stage:'관찰'|'면담'|'공식 관심',observations:number,lastWeek:number,reason:string,reserved?:number};
export type Contract={salary:number,years:number,role?:string,loanAllowed?:boolean,trialMatches?:number};
export type World={targetClubId?:string,priority?:'출전'|'성장'|'연봉'|'우승',scouting?:ScoutReport[],loan?:{parentId:string,parentContract:Contract,returnYear:number},loyalty?:{clubId:string,seasons:number},currentDay?:number,interestedClubIds?:string[],seed:number,year:number,clubId:string,clubs:Club[],round:number,fixtures:Fixture[][],tables:Standing[],phase:'league'|'cup'|'international'|'national'|'offseason'|'retired',knockoutRound:number,opponentId:string|null,nationalCaps:number,nationalGoals:number,offers:Offer[],contract:Contract,wealth:number,records:SeasonRecord[],achievements:string[],news:string[],ledger:{year:number,from:string,to:string,fee:number,player:string}[],currentSeasonStart:number,nextId:number};
const POS:Position[]=['GK','LB','CB','CB','RB','CM','CM','CM','LW','ST','RW','GK','LB','CB','RB','CM','CM','LW','ST','RW'];
export const lineupSlots=(coach:Coach):Position[]=>coach.formation==='4-4-2'?['GK','LB','CB','CB','RB','LW','CM','CM','RW','ST','ST']:POS.slice(0,11);
const NAME_POOLS:Record<string,[string[],string[]]>={
 '일본':[['사토','스즈키','다나카','이토','야마다','모리'],['렌','유토','하루','켄타','소타','타쿠미','료','카이']],
 '사우디':[['알하산','알살림','알카림','알사이드','알누르','알라시드'],['오마르','살렘','파하드','알리','하산','칼리드','나세르','사미']],
 '튀르키예':[['데미르','카야','일마즈','아르슬란','첼리크','아이딘'],['에미르','케렘','알프','데니즈','칸','메르트','에렌','부라크']],
 '유럽':[['마르틴','실바','베커','로시','뒤랑','얀센'],['루카','레오','노아','테오','에릭','마르코','다니엘','올리버']],
 '브라질':[['실바','산투스','올리베이라','코스타','리마','페레이라'],['루카스','가브리엘','마테우스','페드루','하파엘','브루누','비토르','카이우']],
};
function npcName(w:{seed:number},league:number){const country=leagueDef(league).country,pool=NAME_POOLS[country]??(league>=2?NAME_POOLS['유럽']:undefined);const a=Math.floor(random(w)*6),b=Math.floor(random(w)*8);return pool?pool[1][b]+' '+pool[0][a]:['김','이','박','정','강','최'][a]+['준서','도윤','태성','민호','현준','재민','우진','지훈'][b];}
function rookie(w:{seed:number,nextId:number},league:number,pos:Position,age?:number,level?:number):RosterPlayer{const base=level??leagueDef(league).clubs.reduce((n,c)=>n+c[1],0)/6,a=attributes(base);for(const key of Object.keys(a) as (keyof Attributes)[])a[key]=clamp(base+(random(w)-.5)*15,25,92);const id='p'+w.nextId++;return {id,traits:npcTraits(w.seed,id),name:npcName(w,league),pos,age:age??(league===0?16+Math.floor(random(w)*3):19+Math.floor(random(w)*15)),a,potential:clamp(base+8+random(w)*15,45,95),energy:100,form:6.5,goals:0,appearances:0,years:1+Math.floor(random(w)*3)};}
export function newWorld(seed:number,school:number,startWeek=0):World{const w:World={seed:seed^0x4f1a,year:2026,clubId:'c'+school,clubs:[],round:0,fixtures:[],tables:[],phase:'league',knockoutRound:0,opponentId:null,nationalCaps:0,nationalGoals:0,offers:[],contract:{salary:0,years:0},wealth:0,records:[],achievements:[],news:[],ledger:[],currentSeasonStart:startWeek,nextId:1};for(let l=0;l<LEAGUE_DATA.length;l++)for(let i=0;i<6;i++){const def=leagueDef(l),level=def.clubs[i][1];const club:Club={id:'c'+(l*6+i),name:leagueNames[l][i],league:l,baseLevel:level,budget:def.income*4,reputation:level,development:def.development+(random(w)-.5)*.1,coach:{name:['박정호','이성민','김도현','정태훈','최준혁','서민우'][i],style:(['점유','역습','수비'] as const)[i%3],preference:(['유망주','현재 실력','베테랑'] as const)[i%3],formation:i%2?'4-4-2':'4-3-3'},roster:[]};club.roster=POS.map(pos=>rookie(w,l,pos,undefined,level));w.clubs.push(club);}resetSeason(w);return w;}
export const clubOf=(w:World)=>w.clubs.find(c=>c.id===w.clubId)!;
export const sortedTable=(w:World,league=clubOf(w).league)=>w.tables.filter(t=>w.clubs.find(c=>c.id===t.id)!.league===league).sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.id.localeCompare(b.id));
export function resetSeason(w:World){w.round=0;w.phase='league';w.opponentId=null;w.knockoutRound=0;w.offers=[];w.tables=w.clubs.map(c=>({id:c.id,played:0,won:0,draw:0,lost:0,gf:0,ga:0,points:0}));w.fixtures=Array.from({length:10},()=>[]);for(let l=0;l<LEAGUE_DATA.length;l++){const ids=w.clubs.filter(c=>c.league===l).map(c=>c.id);for(let r=0;r<5;r++){for(let i=0;i<3;i++){const a=ids[i],b=ids[5-i];w.fixtures[r].push({home:r%2?a:b,away:r%2?b:a});w.fixtures[r+5].push({home:r%2?b:a,away:r%2?a:b});}ids.splice(1,0,ids.pop()!);}}}
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
export function startInternational(w:World,ability:number,age:number){if(clubOf(w).league>0&&sortedTable(w).findIndex(t=>t.id===w.clubId)<2){w.phase='international';w.knockoutRound=0;w.opponentId=w.clubs.filter(c=>c.id!==w.clubId&&c.league>0&&leagueDef(c.league).confederation===leagueDef(clubOf(w).league).confederation).sort((a,b)=>teamStrength(b)-teamStrength(a))[0].id;}else startNational(w,ability,age);}
export function startNational(w:World,ability:number,age:number){if(age>=19&&ability>=66){w.phase='national';w.knockoutRound=0;w.opponentId=null;w.news.unshift('국가대표 발탁 · 국제 초청대회 출전');}else w.phase='offseason';}
export function advanceCup(w:World,won:boolean,ability:number,age:number){if(won&&w.knockoutRound===0){w.knockoutRound=1;if(w.phase!=='national'){const candidates=w.clubs.filter(c=>c.id!==w.clubId&&c.id!==w.opponentId&&(w.phase==='cup'?c.league===clubOf(w).league:c.league>0&&leagueDef(c.league).confederation===leagueDef(clubOf(w).league).confederation));w.opponentId=candidates[Math.floor(random(w)*candidates.length)].id;}return;}if(won)w.achievements.unshift(`${w.year} ${w.phase==='cup'?'국내 컵':w.phase==='national'?'국제 초청대회':'대륙 클럽 컵'} 우승`);if(w.phase==='cup')startInternational(w,ability,age);else if(w.phase==='international')startNational(w,ability,age);else w.phase='offseason';}
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
export function offerDetails(club:Club,p:{a:Attributes,pos:Position,age:number},form=6.5){
 const ability=roleAbility(p.a,p.pos),fit=ability-clubLevel(club,p.pos);
 const competition=club.roster.filter(r=>r.pos===p.pos).sort((a,b)=>roleAbility(b.a,p.pos)-roleAbility(a.a,p.pos)).slice(0,3).map(r=>({name:r.name,ability:roleAbility(r.a,p.pos)}));
 const role=fit>=4?'핵심 선수':fit>=0?'주전 경쟁':fit>=-4?'로테이션':'유망주 / 벤치';
 const expectedStarts=fit>=4?'높음':fit>=0?'보통 이상':fit>=-4?'보통':'낮음';
 const reason=fit>=4?'부족한 포지션을 이끌 중심 선수':p.age<23&&fit<0?'미래 주전으로 육성':club.coach.style==='점유'?'패스와 볼 소유를 담당할 선수':club.coach.style==='역습'?'빠른 전환과 침투를 담당할 선수':'수비 조직과 안정성을 보강할 선수';
 return {fit,role,expectedStarts,competition,reason:reason+(form>=7.3?' · 최근 활약 주목':'')};
}
export function generateOffers(w:World,p:{a:Attributes,pos:Position,age:number,energy:number},form:number){
 const ability=roleAbility(p.a,p.pos),current=clubOf(w),fee=current.league===0||w.contract.years<=0?0:marketValue(ability,p.age,form,w.contract.years);
 w.offers=[];if(p.age<19&&current.league===0)return;
 const pro=w.clubs.filter(c=>c.league>0).map(club=>({club,fit:ability-clubLevel(club,p.pos)}));
 const make=(club:Club):Offer=>{const details=offerDetails(club,p,form);return {clubId:club.id,salary:roleSalary(ability,club.league),years:2,fee:club.id===w.clubId?0:fee,issuedDay:w.currentDay??0,expiresDay:(w.currentDay??0)+14,...details,kind:'transfer',loanAllowed:details.fit<0,negotiated:false,status:'open'};};
 for(const {club,fit} of pro){
  const current=club.id===w.clubId,guaranteed=!!w.interestedClubIds?.includes(club.id);
  const inWindow=fit>=(p.age<22?OFFER_FIT.youthMin:OFFER_FIT.min)&&fit<=OFFER_FIT.max;
  if(!current&&!guaranteed&&!inWindow)continue;
  const o=make(club);
  if(!guaranteed&&club.budget<o.fee+o.salary*o.years)continue;
  // Formal interest always produces the promised written offer. Acceptance still checks funds.
  w.offers.push(o);
 }
 if(!w.offers.some(o=>o.clubId!==w.clubId))for(const {club} of pro.filter(x=>x.club.id!==w.clubId).sort((a,b)=>Math.abs(a.fit-2)-Math.abs(b.fit-2))){const o=make(club);if(club.budget>=o.fee+o.salary*o.years)w.offers.push(o);if(w.offers.filter(x=>x.clubId!==w.clubId).length>=2)break;}
 const priority=w.priority??'출전';
 w.offers.sort((a,b)=>{const score=(o:Offer)=>{const cl=w.clubs.find(c=>c.id===o.clubId)!;return (o.clubId===w.targetClubId?1000:0)+(priority==='연봉'?o.salary:priority==='성장'?cl.development*100:priority==='우승'?cl.reputation:-(Math.abs(ability-clubLevel(cl,p.pos)-3)));};return score(b)-score(a);});
}
export type Negotiation='salary'|'short'|'role'|'loan';
export function negotiate(w:World,clubId:string,choice:Negotiation='salary'){
 expireOffers(w);const o=w.offers.find(o=>o.clubId===clubId);if(!o||o.status!=='open'||o.negotiated)throw Error('협상 가능한 제안이 없습니다.');
 if(w.phase!=='offseason')throw Error('협상은 시즌 종료 후 가능합니다.');
 o.negotiated=true;const club=w.clubs.find(c=>c.id===clubId)!;
 if(choice==='short'){o.years=1;o.salary=Math.round(o.salary*.9);w.news.unshift(`${club.name} · 연봉을 조정하고 1년 계약 수락`);}
 else if(choice==='loan'){o.loanAllowed=true;o.salary=Math.round(o.salary*.95);w.news.unshift(`${club.name} · 향후 임대 요청 허용 합의`);}
 else if(choice==='role'){if(o.expectedStarts==='낮음'){w.news.unshift(`${club.name} · 주전 약속은 어려워 기존 역할 유지`);}else{o.role='주전 도전 계획';o.salary=Math.round(o.salary*.95);w.news.unshift(`${club.name} · 첫 3경기 주전 경쟁 계획 합의 (컨디션과 실력 격차 조건)`);}}
 else if(random(w)<.68&&club.budget>=o.fee+o.salary*1.15*o.years){o.salary=Math.round(o.salary*1.15);w.news.unshift(`${club.name} · 연봉 인상 수락`);}else w.news.unshift(`${club.name} · 인상 거절, 기존 조건 유지`);
}
export function acceptOffer(w:World,clubId:string,name:string){
 expireOffers(w);if(w.phase!=='offseason')throw Error('이적은 시즌 종료 후 가능합니다.');
 const o=w.offers.find(o=>o.clubId===clubId&&o.status==='open');if(!o)throw Error('유효한 제안이 아닙니다.');
 const buyer=w.clubs.find(c=>c.id===clubId)!,seller=clubOf(w);if(buyer.budget<o.fee+o.salary*o.years)throw Error('구단 예산이 부족합니다.');
 if(o.kind==='loan'){
  if(w.loan||seller.league===0||w.contract.years<1)throw Error('임대 가능한 프로 계약이 없습니다.');
  w.loan={parentId:seller.id,parentContract:{...w.contract},returnYear:w.year+1};
 }else if(w.loan)throw Error('임대 복귀 후 완전 이적할 수 있습니다.');
 if(buyer.id!==seller.id&&o.fee>0){buyer.budget-=o.fee;seller.budget+=o.fee;w.ledger.push({year:w.year,from:buyer.id,to:seller.id,fee:o.fee,player:name});}
 if(buyer.id!==seller.id&&!w.loan)w.loyalty={clubId:buyer.id,seasons:0};
 w.clubId=buyer.id;w.contract={salary:o.salary,years:o.years,role:o.role,loanAllowed:o.loanAllowed,trialMatches:o.role==='주전 도전 계획'?3:0};w.offers=[];w.interestedClubIds=[];w.scouting=[];
 w.news.unshift(`${name} · ${buyer.name} ${o.kind==='loan'?'1시즌 임대':o.years+'년 계약'} · ${o.role}`);
}
export function requestLoan(w:World,p:{a:Attributes,pos:Position,age:number,energy:number}){
 if(w.phase!=='offseason'||clubOf(w).league===0||w.loan||w.contract.years<1)throw Error('유효한 프로 계약이 있는 비시즌에 임대를 요청할 수 있습니다.');
 const own=clubOf(w),ability=roleAbility(p.a,p.pos);
 if(!w.contract.loanAllowed&&ability>=clubLevel(own,p.pos))throw Error('현재 주전 경쟁이 가능한 선수입니다. 임대 허용 조건을 먼저 협상하세요.');
 const destinations=w.clubs.filter(c=>c.league>0&&c.id!==own.id).map(club=>({club,fit:ability-clubLevel(club,p.pos)})).filter(x=>x.fit>=0&&x.fit<=12).sort((a,b)=>Math.abs(a.fit-3)-Math.abs(b.fit-3)).slice(0,6);
 const offers=destinations.map(({club}):Offer=>({clubId:club.id,salary:Math.min(w.contract.salary,roleSalary(ability,club.league)),years:1,fee:0,kind:'loan',...offerDetails(club,p),reason:'출전 경험을 위한 1시즌 임대',negotiated:false,status:'open',issuedDay:w.currentDay??0,expiresDay:(w.currentDay??0)+14})).filter(o=>w.clubs.find(c=>c.id===o.clubId)!.budget>=o.salary);
 if(!offers.length)throw Error('현재 주전 기회를 제공할 임대 구단이 없습니다.');w.offers=offers;w.news.unshift('임대 요청 수락 · 원소속팀과 계약은 보존됩니다.');
}
export function returnFromLoan(w:World){if(!w.loan||w.year<w.loan.returnYear)return;const loan=w.loan;w.clubId=loan.parentId;w.contract={...loan.parentContract,years:Math.max(0,loan.parentContract.years-1)};delete w.loan;w.offers=[];w.news.unshift(`${clubOf(w).name} · 임대 종료 후 복귀, 새 시즌 경쟁을 시작합니다.`);}
export function advanceWorldYear(w:World){w.year++;for(const c of w.clubs){c.budget+=leagueDef(c.league).income;for(let i=0;i<c.roster.length;i++){const p=c.roster[i];if(p.id==='career-rival')continue;p.age++;p.years=Math.max(0,p.years-1);if(p.age>=(c.league===0?19:36)){c.roster[i]=rookie(w,c.league,p.pos,c.league===0?16:18,c.baseLevel);continue;}const bloom=lateBloom(p.traits),late=bloom&&p.age>=bloom.startAge&&p.age<bloom.startAge+6?.6:0,rate=npcGrowthRate(p.age)*trainingGrowthMultiplier(p.traits)*abroadGrowthMultiplier(p.traits,c.league);
// Same age model as the user and the rival (aging.ts): growth slows towards 32, decline from 33.
for(const k of Object.keys(p.a) as (keyof Attributes)[])p.a[k]=clamp(p.a[k]+Math.max(0,p.potential-p.a[k])*rate-agingLoss(p.traits,p.age,k)+late,20,96);p.energy=100;p.goals=0;p.appearances=0;}
if(random(w)<.22){c.coach.preference=(['유망주','현재 실력','베테랑'] as const)[Math.floor(random(w)*3)];c.coach.style=(['점유','역습','수비'] as const)[Math.floor(random(w)*3)];c.coach.name='신임 '+c.coach.name.replace('신임 ','');w.news.unshift(`${c.name} · 감독 교체`);}}
// AI clubs buy for a weak position with an explicit balanced transfer ledger.
for(const buyer of w.clubs.filter(c=>c.league>0)){const weakest=buyer.roster.filter(p=>p.id!=='career-rival').sort((a,b)=>roleAbility(a.a,a.pos)-roleAbility(b.a,b.pos))[0];const seller=w.clubs.filter(c=>c.league===buyer.league&&c.id!==buyer.id)[Math.floor(random(w)*5)];const candidate=seller.roster.filter(p=>p.id!=='career-rival'&&p.pos===weakest.pos&&roleAbility(p.a,p.pos)>roleAbility(weakest.a,weakest.pos)+2).sort((a,b)=>roleAbility(b.a,b.pos)-roleAbility(a.a,a.pos))[0];if(!candidate)continue;const fee=marketValue(roleAbility(candidate.a,candidate.pos),candidate.age,candidate.form,candidate.years);if(buyer.budget<fee+2000+(w.scouting?.find(r=>r.clubId===buyer.id)?.reserved??0))continue;buyer.budget-=fee;seller.budget+=fee;buyer.roster=buyer.roster.filter(p=>p.id!==weakest.id);seller.roster=seller.roster.filter(p=>p.id!==candidate.id);buyer.roster.push(candidate);seller.roster.push(weakest);candidate.years=3;w.ledger.push({year:w.year,from:buyer.id,to:seller.id,fee,player:candidate.name});}w.news=w.news.slice(0,60);w.ledger=w.ledger.slice(-200);resetSeason(w);}

export const roleSalary=(ability:number,league:number)=>Math.round(Math.max(30,ability-35)*leagueDef(league).salary);
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

/** Upgrade the old four-league world without discarding its players, results or live match. */
export function expandWorld(w:World){
 if(w.clubs.length===WORLD_CLUB_COUNT)return;
 if(w.clubs.length!==24)throw Error('이전 리그 데이터가 손상되었습니다.');
 const fresh=newWorld(w.seed^w.year,0,w.currentSeasonStart);
 for(const club of w.clubs){const spec=leagueDef(club.league).clubs[Number(club.id.slice(1))%6];club.name=spec[0];club.baseLevel=spec[1];}
 const added=fresh.clubs.slice(24);
 for(const c of added)for(const p of c.roster)p.id='p'+w.nextId++;
 w.clubs.push(...added);w.tables.push(...fresh.tables.filter(t=>added.some(c=>c.id===t.id)));
 for(let r=0;r<w.fixtures.length;r++){
  const fixtures=fresh.fixtures[r].filter(f=>added.some(c=>c.id===f.home));
  w.fixtures[r].push(...fixtures);
  if(r<w.round)for(const f of fixtures)tableResult(w,f,lightweight(fresh,w.clubs.find(c=>c.id===f.home)!,w.clubs.find(c=>c.id===f.away)!));
 }
 w.news.unshift('축구 세계 확장 · 기존 선수·계약·경기 기록을 보존했습니다. 이전 유럽 리그는 네덜란드/잉글랜드로 연결됩니다.');
}
