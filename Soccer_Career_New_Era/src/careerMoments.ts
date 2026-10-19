import type {Career} from './career';
import {rating,userPerformance,type Match} from './engine';
import {clubOf,clubLevel,sortedTable,type Club} from './world';
import {roleAbility} from './roles';
import {news} from './development';
export type CareerMoment={key:string;year:number;day:number;text:string;kind:'rival'|'club'};
export type ClubJourney={clubId:string;matches:number;minutes:number;goals:number;assists:number;years:number[]};
export type CareerConnections={version:1;events:CareerMoment[];seen:string[]};
export function journey(c:Career,id=c.world.clubId):ClubJourney{
 const records=c.history.filter(r=>r.club===id&&r.stats.minutes>0&&!r.competition?.includes('초청')&&!r.competition?.includes('대표'));
 return {clubId:id,matches:records.length,minutes:records.reduce((n,r)=>n+r.stats.minutes,0),goals:records.reduce((n,r)=>n+r.stats.goals,0),assists:records.reduce((n,r)=>n+r.stats.assists,0),years:[...new Set(records.map(r=>r.year).filter((y):y is number=>y!==undefined))]};
}
export function moment(c:Career,key:string,text:string,kind:CareerMoment['kind']){
 const s=c.connections??={version:1,events:[],seen:[]};if(s.seen.includes(key))return;
 s.seen.push(key);s.events.unshift({key,year:c.world.year,day:c.day,text,kind});s.events=s.events.slice(0,120);
 news(c,text,'career');
}
/** Only real roster ids count; a school stand-in is never called the rival. */
export function matchOccasion(c:Career,m:Match,opponentId?:string,national=false){
 const rival=c.development.rival,slot=m.rosterIds?.indexOf(rival.id)??-1;
 if(slot>=0){const same=m.players[slot].team===m.players[m.userId].team;
  m.occasion=same?`라이벌 ${rival.player.name}과 같은 유니폼으로 출전합니다.`:`라이벌 ${rival.player.name}과 ${m.competition??'경기'}에서 만났습니다.`;
 }else if(opponentId&&journey(c,opponentId).matches>0&&!national){
  const former=c.world.clubs.find(x=>x.id===opponentId);m.occasion=`${former?.name??'친정팀'}과 재회합니다. 이 팀에서 ${journey(c,opponentId).matches}경기를 함께했습니다.`;
 }
 if(m.occasion)m.log.push({time:m.clock,text:m.occasion});
}
/** Called once at settlement, after the real match has been inserted into history. */
export function recordConnections(c:Career,m:Match,national=false){
 const mine=userPerformance(m),r=c.development.rival;
 const rp=m.players.find((p,i)=>m.rosterIds?.[i]===r.id)??m.replacedPlayers?.find(p=>p.rosterId===r.id)?.player;
 if(mine.stats.minutes>0&&rp&&rp.stats.minutes>0){
  const same=rp.team===mine.team,key=`rival-${same?'together':'duel'}-${c.week}`;
  const previous=c.connections?.events.some(e=>e.kind==='rival'&&e.key.startsWith(same?'rival-together':'rival-duel'));
  const important=!previous||m.competition?.includes('결승')||Math.max(rating(mine),rating(rp))>=7.5;
  if(important)moment(c,key,`${previous?'다시 만난':'첫'} ${same?'동료':'맞대결'} ${r.player.name} · ${m.competition??'경기'} ${m.score.join(' : ')} · 나 ${rating(mine).toFixed(1)} / 라이벌 ${rating(rp).toFixed(1)}`,'rival');
 }
 if(national||mine.stats.minutes<=0)return;
 const j=journey(c),club=clubOf(c.world);
 for(const n of [25,50,100,200,300])if(j.matches>=n)moment(c,`club-${club.id}-${n}`,`${club.name}에서 ${n}경기 출전 · 함께 쌓은 ${j.goals}골 ${j.assists}도움`,'club');
 if(j.matches>=50&&c.player.trust>=80)moment(c,`leader-${club.id}`,`${club.name}의 주장 후보로 이름을 올렸습니다. 꾸준한 출전과 감독의 신뢰가 쌓였습니다.`,'club');
 const rivalClub=r.clubId===c.world.clubId;
 if(rivalClub)moment(c,`rival-squad-${club.id}-${c.world.year}`,`${r.player.name}과 같은 ${c.player.pos} 자리를 두고 경쟁하는 시즌입니다. 선발은 활약과 감독 평가로 결정됩니다.`,'rival');
}
export function recordMove(c:Career,from:string,to:string){
 if(from===to){moment(c,`renew-${to}-${c.world.year}`,`${clubOf(c.world).name}과 재계약 · 함께한 도전을 이어갑니다.`,'club');return;}
 const old=c.world.clubs.find(x=>x.id===from),j=journey(c,from);
 moment(c,`move-${from}-${to}-${c.day}`,`${old?.name??'이전 구단'}에서 ${j.matches}경기를 남기고 ${clubOf(c.world).name}에서 새 도전을 시작합니다.`,'club');
 if(c.development.rival.clubId===to)moment(c,`rival-join-${to}-${c.world.year}`,`${c.development.rival.player.name}과 같은 유니폼! 함께 뛰면서 주전 자리를 경쟁합니다.`,'rival');
}
export function clubReasons(c:Career,destination?:Club){
 const club=clubOf(c.world),j=journey(c),table=sortedTable(c.world,club.league),ours=table.find(x=>x.id===club.id),rank=table.findIndex(x=>x.id===club.id)+1;
 const stay=[`${club.name}에서 ${j.matches}경기 · ${j.goals}골 ${j.assists}도움`];
 if(c.player.trust>=55)stay.push('쌓아 온 감독 신뢰와 현재 출전 입지');
 if(ours&&ours.played>=5&&rank<=3&&table[0].points-ours.points<=6)stay.push(`선두와 ${table[0].points-ours.points}점 차 · 우승 경쟁 중`);
 if(j.matches>=25)stay.push(`구단 ${[50,100,200,300,500].find(n=>n>j.matches)??1000}경기 출전에 도전`);
 const leave:string[]=[];
 if(c.player.trust<35)leave.push('출전 기회를 회복할 새 환경');
 if(destination&&destination.id!==club.id){
  if(clubLevel(destination,c.player.pos)>clubLevel(club,c.player.pos)+3)leave.push('더 높은 수준의 주전 경쟁');
  if(destination.development>club.development+.05)leave.push('더 좋은 육성 환경');
  if(roleAbility(c.player.a,c.player.pos)-clubLevel(destination,c.player.pos)>2)leave.push('현재 능력을 살릴 출전 경쟁');
  if(destination.id===c.development.rival.clubId)leave.push('라이벌과 같은 팀에서 경쟁');
 }
 return {stay,leave};
}
export function validConnections(x:CareerConnections|undefined){
 return x===undefined||!!x&&x.version===1&&Array.isArray(x.seen)&&x.seen.length<10000&&x.seen.every(k=>typeof k==='string'&&k.length<150)&&Array.isArray(x.events)&&x.events.length<=120&&x.events.every(e=>e&&typeof e.key==='string'&&typeof e.text==='string'&&e.text.length<1000&&Number.isFinite(e.year)&&Number.isFinite(e.day)&&['rival','club'].includes(e.kind));
}
