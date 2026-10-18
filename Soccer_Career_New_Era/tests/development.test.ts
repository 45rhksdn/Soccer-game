import {it,expect} from 'vitest';
import {newCareer,startCareerMatch,settle,nextSeason} from '../src/career';
import {ATTRS,attributes,createMatch,finishMatch,insightAttempt,random,overall} from '../src/engine';
import {applyDaily,prepareWeek,ageRival,configureTrait,syncRival,announceOffers,renewSearch} from '../src/development';
import {generateOffers,expireOffers,acceptOffer,advanceWorldYear,clubLevel} from '../src/world';
import {roleAbility} from '../src/roles';
import {encode,decode,validate} from '../src/storage';
const profile={name:'주간선수',age:16,pos:'CM' as const,secondary:'ST' as const,foot:'오른',height:178,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'};
function career(seed=12){return newCareer(profile,0,seed);}
function seedFor(lo:number,hi:number){for(let i=0;i<100000;i++){const r={seed:i},v=random(r);if(v>=lo&&v<hi)return i;}throw Error('seed');}
it('rival identity, school, age and position persist through world aging and transfers',()=>{
 const c=career(),r=c.development.rival;expect(r.school).not.toBe(c.school);expect(r.player.age).toBe(c.player.age);expect(r.player.pos).toBe(c.player.pos);const name=r.player.name,id=r.id;
 for(let year=0;year<20;year++){c.player.age++;ageRival(c);advanceWorldYear(c.world);syncRival(c);expect(r.id).toBe(id);expect(r.player.name).toBe(name);expect(r.player.age).toBe(c.player.age);expect(c.world.clubs.flatMap(x=>x.roster).filter(x=>x.id===id)).toHaveLength(1);expect(c.world.clubs.every(x=>x.roster.length===20)).toBe(true);}
 expect(r.retired).toBe(true);
});
it('genius multiplies training 1.25, lucky multiplies growth 10 and fatigue lowers efficiency',()=>{
 const base=career();base.player.a=attributes(40);base.player.potential=95;base.seed=seedFor(.1,.2);
 const normal=structuredClone(base),genius=structuredClone(base),tired=structuredClone(base);tired.player.fatigue=80;
 applyDaily(normal,normal.player,'passing','실전파');applyDaily(genius,genius.player,'passing','천재');applyDaily(tired,tired.player,'passing','실전파');
 const delta=normal.player.a.passing-40;expect((genius.player.a.passing-40)/delta).toBeCloseTo(1.25,8);expect((tired.player.a.passing-40)/delta).toBeCloseTo(.36,8);
 const lucky=structuredClone(base),plain=structuredClone(base);lucky.seed=plain.seed=seedFor(.05,.06); // age 16: base 4.5 %, 행운아 6.75 %
 applyDaily(lucky,lucky.player,'passing','행운아');applyDaily(plain,plain.player,'passing','실전파');expect((lucky.player.a.passing-40)/(plain.player.a.passing-40)).toBeCloseTo(10,8);expect(lucky.development.news[0].text).toBe('훈련 중 무언가를 느꼈다!');expect(lucky.development.news[0].kind).toBe('lucky');
});
it('vacation charges money and provides stronger recovery; insufficient funds are rejected',()=>{const c=career();c.player.energy=20;c.player.fatigue=80;const money=c.development.wallet;applyDaily(c,c.player,'vacation','천재');expect(c.player.energy).toBe(85);expect(c.player.fatigue).toBe(20);expect(c.development.wallet).toBe(money-5);c.development.wallet=0;expect(()=>prepareWeek(c,Array(7).fill('vacation'))).toThrow('비용');expect(c.development.active).toBeUndefined();});
it('a seven-day plan pauses at the match, resumes after reload and records exactly one weekly note',()=>{
 const c=career(),before=overall(c.development.rival.player.a),plan=['passing','rest','running','rest','shooting','rest','vacation'] as const;
 prepareWeek(c,[...plan]);expect(c.day).toBe(5);expect(c.development.active?.cursor).toBe(5);expect(c.match).not.toBeNull();
 const restored=decode(encode(c));finishMatch(c.match!);finishMatch(restored.match!);settle(c);settle(restored);expect(c).toEqual(restored);expect(c.week).toBe(1);expect(c.day).toBe(7);expect(c.development.notes).toHaveLength(1);expect(c.development.active).toBeUndefined();expect(c.development.plan).toEqual(plan);expect(overall(c.development.rival.player.a)).toBeGreaterThan(before);expect(()=>settle(c)).toThrow();
});
it('practical boosts only the match, not permanent attributes; insight settles once',()=>{const c=career();c.player.a=attributes(65);c.development.traits=['실전파'];c.seed=seedFor(.1,.2);startCareerMatch(c);expect(c.match!.traitBoost).toBe(true);expect(c.player.a.passing).toBe(65);expect(c.match!.players[c.match!.userId].a.passing).toBeCloseTo(71.5);c.match!.insight!.chance=0;c.match!.insight!.gains={passing:1};finishMatch(c.match!);settle(c);expect(c.player.a.passing).toBeGreaterThanOrEqual(66);expect(c.player.a.passing).toBeLessThan(67);expect(c.player.a.shooting).toBeLessThan(66);});
it('configured insight attempts use the supplied chance and saves deterministically',()=>{for(const chance of [.03,.09]){const m=createMatch(99,{name:'검증',pos:'CM',a:attributes(40),energy:100});m.insight={chance,gains:{},events:[]};const p=m.players[m.userId];for(let i=0;i<10000;i++){p.a.passing=40;insightAttempt(m,p,['passing']);}const rate=(m.insight.gains.passing??0)/10000;expect(rate).toBeGreaterThan(chance-.012);expect(rate).toBeLessThan(chance+.012);const clone=structuredClone(m);p.a.passing=40;clone.players[clone.userId].a.passing=40;insightAttempt(m,p,['passing']);insightAttempt(clone,clone.players[clone.userId],['passing']);expect(m).toEqual(clone);}});
it('interested clubs guarantee offers, expiry is day 14 and offseason weeks keep advancing',()=>{
 const c=career();c.player.age=18;c.world.phase='offseason';
 // v0.9: formal interest must become an offer even if ability fit changes later.
 const ability=roleAbility(c.player.a,c.player.pos),near=c.world.clubs.filter(x=>x.league>0).sort((a,b)=>Math.abs(clubLevel(a,c.player.pos)-ability)-Math.abs(clubLevel(b,c.player.pos)-ability))[0].id;
 c.development.interestIds=[near,'c23'];announceOffers(c);expect(c.world.offers.some(o=>o.clubId===near)).toBe(true);expect(c.world.offers.some(o=>o.clubId==='c23')).toBe(true);const issue=c.world.offers[0].issuedDay!;c.world.currentDay=issue+13;expireOffers(c.world);expect(c.world.offers.length).toBeGreaterThan(0);c.world.currentDay=issue+14;expireOffers(c.world);expect(c.world.offers).toHaveLength(0);expect(()=>acceptOffer(c.world,near,c.player.name)).toThrow('유효');c.day=14;renewSearch(c);expect(c.world.offers.find(o=>o.clubId===near)!.expiresDay).toBe(28);prepareWeek(c,Array(7).fill('rest'));expect(c.day).toBe(21);prepareWeek(c,Array(7).fill('rest'));expect(c.day).toBe(28);expect(c.world.offers).toHaveLength(0);
});
it('v3 migration adds rival and traits without changing existing player or active match',()=>{const c=career();startCareerMatch(c);const old=structuredClone(c) as any;delete old.development;old.version=3;const n=validate(old);expect(n.version).toBe(8);expect(n.player).toEqual(c.player);expect(n.match).toEqual(c.match);expect(n.history).toEqual(c.history);expect(n.development.rival.school).not.toBe(n.school);expect(decode(encode(n))).toEqual(n);});
