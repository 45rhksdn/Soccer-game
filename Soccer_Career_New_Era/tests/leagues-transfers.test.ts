import {it,expect} from 'vitest';
import {newCareer,selection} from '../src/career';
import {attributes} from '../src/engine';
import {legacyFixtures,newWorld,generateOffers,offerDetails,negotiate,acceptOffer,requestLoan,returnFromLoan,expandWorld,advanceLeague,lightweight,clubOf,advanceWorldYear,clubLevel} from '../src/world';
import {LEAGUE_DATA,WORLD_CLUB_COUNT} from '../src/leagues';
import {scoutInterest} from '../src/development';
import {encode,decode,validate} from '../src/storage';
import {roleAbility} from '../src/roles';
const career=()=>newCareer({name:'이적검증',age:20,pos:'CM',secondary:'ST',foot:'오른',height:180,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'},0,2026,{traits:[]});
it('11 distinct pro leagues, 88 clubs (+6 school), team means follow authored strengths and finances stay finite',()=>{
 const w=newWorld(2026,0);expect(LEAGUE_DATA.filter(l=>l.id>0)).toHaveLength(11);expect(w.clubs).toHaveLength(WORLD_CLUB_COUNT);expect(new Set(w.clubs.flatMap(c=>c.roster.map(p=>p.id))).size).toBe(WORLD_CLUB_COUNT*20);
 for(const club of w.clubs){const average=club.roster.reduce((n,p)=>n+roleAbility(p.a,p.pos),0)/20;expect(Math.abs(average-club.baseLevel!)).toBeLessThan(2);expect(Number.isFinite(club.budget)).toBe(true);}
 expect(w.clubs.find(c=>c.id==='c18')!.baseLevel).toBeGreaterThan(w.clubs.find(c=>c.id==='c6')!.baseLevel!);
 const sa=w.clubs.filter(c=>c.league===5).map(c=>c.baseLevel!);expect(Math.max(...sa)-Math.min(...sa)).toBeGreaterThan(20);
});
it('old v7 world expands once, preserving active history, fixtures, contracts and all old players',()=>{
 const c=career(),w=c.world;w.clubs=w.clubs.slice(0,24);w.tables=w.tables.filter(t=>Number(t.id.slice(1))<24);
 // a pre-0.15 world: no calendar, 10-round fixtures of the four 6-club leagues
 delete w.calendar;delete w.season;w.fixtures=Array.from({length:10},()=>[]);for(let l=0;l<4;l++)legacyFixtures(w.clubs.filter(x=>x.league===l).map(x=>x.id)).forEach((r,i)=>w.fixtures[i].push(...r));
 for(let i=0;i<3;i++)advanceLeague(w,[1,0]);
 const oldPlayers=w.clubs.map(c=>structuredClone(c.roster)),oldFixtures=structuredClone(w.fixtures);(c as any).version=7;
 const a=validate(c),b=validate(c);expect(a).toEqual(b);expect(a.version).toBe(10);expect(a.world.round).toBe(3);expect(a.world.clubs).toHaveLength(94);expect(a.world.calendar).toBeUndefined();
 expect(a.world.clubs.slice(0,24).map(c=>c.roster)).toEqual(oldPlayers);for(let i=0;i<10;i++)expect(a.world.fixtures[i].slice(0,oldFixtures[i].length)).toEqual(oldFixtures[i]);
 expect(a.world.tables.every(t=>t.played===3)).toBe(true);expect(decode(encode(a))).toEqual(a);expect(a.world.contract).toEqual(c.world.contract);
});
it('interest advances by weekly observations, official interest guarantees offer and role competitors are real',()=>{
 const c=career();c.player.a=attributes(64);const club=c.world.clubs.find(x=>x.league===1&&Math.abs(clubLevel(x,'CM')-64)<8)!;c.world.targetClubId=club.id;
 for(let week=1;week<=3;week++){c.week=week;scoutInterest(c);scoutInterest(c);}
 expect(c.world.scouting?.find(r=>r.clubId===club.id)?.stage).toBe('공식 관심');expect(c.development.interestIds).toContain(club.id);
 c.player.a=attributes(90);generateOffers(c.world,c.player,7);const o=c.world.offers.find(o=>o.clubId===club.id)!;expect(o).toBeDefined();expect(o.competition?.every(p=>club.roster.some(r=>r.name===p.name))).toBe(true);
});
it('negotiations can shorten terms, preserve fallback and retain money in a paid transfer',()=>{
 const c=career(),w=c.world;w.clubId='c6';w.phase='offseason';w.contract={salary:50,years:2};c.player.a=attributes(66);generateOffers(w,c.player,7);
 const o=w.offers.find(o=>o.clubId!==w.clubId)!;const salary=o.salary;negotiate(w,o.clubId,'short');expect(o.years).toBe(1);expect(o.salary).toBe(Math.round(salary*.9));expect(()=>negotiate(w,o.clubId)).toThrow();
 const total=w.clubs.reduce((n,c)=>n+c.budget,0);acceptOffer(w,o.clubId,c.player.name);expect(w.clubs.reduce((n,c)=>n+c.budget,0)).toBe(total);expect(w.contract.years).toBe(1);expect(w.ledger.at(-1)?.fee).toBe(o.fee);
});
it('loan preserves parent contract, expires normally, and returns once after a season',()=>{
 const c=career(),w=c.world;w.clubId='c18';w.phase='offseason';w.contract={salary:500,years:3,loanAllowed:true};c.player.a=attributes(65);requestLoan(w,c.player);const o=w.offers[0];expect(o.kind).toBe('loan');acceptOffer(w,o.clubId,c.player.name);expect(w.loan?.parentId).toBe('c18');const copy=decode(encode(c));expect(copy.world.loan).toEqual(w.loan);
 returnFromLoan(w);expect(w.clubId).toBe(o.clubId);w.year++;returnFromLoan(w);expect(w.clubId).toBe('c18');expect(w.contract.years).toBe(2);expect(w.contract.salary).toBe(500);expect(w.loan).toBeUndefined();returnFromLoan(w);expect(w.contract.years).toBe(2);
});
it('new leagues complete multiple deterministic seasons with balanced transfer books',async()=>{
 const a=newWorld(93,0),b=structuredClone(a);for(let y=0;y<3;y++){for(const w of [a,b]){w.clubId='c6';for(let round=0;round<28;round++)advanceLeague(w,[1,1]);expect(w.tables.filter(t=>w.clubs.find(c=>c.id===t.id)!.league>0).every(t=>t.played===28)).toBe(true);const before=w.clubs.reduce((n,c)=>n+c.budget,0);advanceWorldYear(w);expect(w.clubs.reduce((n,c)=>n+c.budget,0)-before).toBe(w.clubs.reduce((n,c)=>n+LEAGUE_DATA[c.league].income,0));}expect(a).toEqual(b);await new Promise(r=>setTimeout(r,0));}
});

it('playing-time negotiation gives a bounded real opportunity without boosting match skills',()=>{const c=career();c.world.clubId='c6';const club=clubOf(c.world);club.coach.preference='현재 실력';for(const p of club.roster){p.a=attributes(70);p.energy=100;p.form=6.5;}c.player.a=attributes(69);c.player.trust=45;c.player.status='로테이션';expect(selection(c).index).toBe(-1);c.world.contract.trialMatches=3;expect(selection(c).index).toBeGreaterThanOrEqual(0);expect(c.player.a.passing).toBe(69);c.world.contract.trialMatches=0;expect(selection(c).index).toBe(-1);c.world.contract.trialMatches=3;c.player.energy=40;expect(selection(c).index).toBe(-1);c.player.energy=100;c.player.injuryWeeks=1;expect(selection(c).index).toBe(-1);});
