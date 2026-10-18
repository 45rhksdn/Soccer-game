import {it,expect} from 'vitest';
import {newCareer,nextSeason,settle} from '../src/career';
import {attributes,finishMatch,ATTRS} from '../src/engine';
import {prepareWeek,ageRival,type Daily} from '../src/development';
import {acceptOffer,advanceWorldYear,clubOf} from '../src/world';
import {roleAbility} from '../src/roles';
import {PEAK_AGE,GROWTH_BY_CURVE,growthAgeFactor,agingLoss,applyAging,declineStart,npcGrowthRate,experienceAgeFactor} from '../src/aging';

const profile={name:'노화검증',age:16,pos:'ST' as const,secondary:'LW' as const,foot:'오른',height:180,weight:72,style:'테크니션',curve:'꾸준한 성장형'};

it('growth slows with age for every curve and nearly stops after the peak (32)',()=>{
  expect(PEAK_AGE).toBe(32);
  for(const curve of Object.keys(GROWTH_BY_CURVE)){
    const f=(a:number)=>growthAgeFactor(curve,a);
    expect(f(26)).toBeGreaterThan(f(31));expect(f(31)).toBeGreaterThan(f(33));expect(f(33)).toBeLessThanOrEqual(.15);
    expect(f(32)).toBeGreaterThan(.4);
  }
  expect(growthAgeFactor('조기 성장형',17)).toBeGreaterThan(growthAgeFactor('대기만성형',17));
  expect(growthAgeFactor('대기만성형',30)).toBeGreaterThan(growthAgeFactor('조기 성장형',30));
  expect(growthAgeFactor('unknown',20)).toBe(growthAgeFactor('꾸준한 성장형',20));
  expect(experienceAgeFactor(30)).toBe(1);expect(experienceAgeFactor(34)).toBeLessThan(.5);
  expect(npcGrowthRate(20)).toBeGreaterThan(npcGrowthRate(27));expect(npcGrowthRate(30)).toBeGreaterThan(0);expect(npcGrowthRate(33)).toBe(0);
});

it('no decline up to 32; from 33 pace drops first and faster each year; 조기 노화 starts at 32 at ×1.15',()=>{
  for(const k of ATTRS)for(let age=16;age<=32;age++)expect(agingLoss([],age,k)).toBe(0);
  expect(declineStart([])).toBe(33);expect(declineStart(['조기 노화'])).toBe(32);
  expect(agingLoss([],33,'speed')).toBeGreaterThan(agingLoss([],33,'shooting'));expect(agingLoss([],33,'shooting')).toBeGreaterThan(agingLoss([],33,'vision'));
  expect(agingLoss([],35,'speed')).toBeGreaterThan(agingLoss([],34,'speed'));
  expect(agingLoss(['조기 노화'],32,'speed')).toBeCloseTo(agingLoss([],33,'speed')*1.15,10);
  const a=attributes(21);applyAging(a,[],36);for(const k of ATTRS)expect(a[k]).toBeGreaterThanOrEqual(20);
});

it('user, rival and NPCs age with the same model',()=>{
  const c=newCareer(profile,0,91);c.player.age=32;c.player.a=attributes(80);
  const r=c.development.rival;r.traits=[];r.player.a=attributes(80);
  c.world.phase='offseason';c.world.clubId=c.world.clubs.find(x=>x.league===2)!.id;c.world.contract={salary:100,years:2};c.development.traits=[];
  const npc=c.world.clubs[20].roster[3];npc.traits=[];npc.age=32;npc.a=attributes(80);npc.potential=80;
  nextSeason(c);
  const expected=attributes(80);applyAging(expected,[],33);
  expect(c.player.age).toBe(33);expect(c.player.a).toEqual(expected);expect(r.player.a).toEqual(expected);
  for(const k of ATTRS)expect(npc.a[k]).toBeCloseTo(expected[k],10);
  // Growth types still differ: a 조기 노화 NPC declines earlier.
  const w=newCareer(profile,0,92).world,p=w.clubs[19].roster[4];p.traits=['조기 노화'];p.age=29;p.a=attributes(80);p.potential=80;advanceWorldYear(w);
  expect(p.a.speed).toBeCloseTo(80-agingLoss(['조기 노화'],32,'speed'),10);
  void ageRival;
});

it('long career (16 → 35): the peak is reached around 32 and is not far above the top league',async()=>{
  const c=newCareer(profile,1,4321);c.development.traits=[];
  const plan:Daily[]=['shooting','running','passing','rest','dribbling','rest','rest'];
  const byAge:Record<number,number>={};const top:number[]=[],top5:number[]=[];let guard=0;
  while(c.world.phase!=='retired'&&guard++<3000){
    if(guard%10===0)await new Promise(r=>setTimeout(r,0));
    if(c.world.phase==='offseason'){
      byAge[c.player.age]=roleAbility(c.player.a,c.player.pos);
      const best=c.world.clubs.filter(x=>x.league===3).flatMap(x=>x.roster).filter(p=>p.pos!=='GK').map(p=>roleAbility(p.a,p.pos)).sort((a,b)=>b-a);top.push(best[0]);top5.push(best.slice(0,5).reduce((a,b)=>a+b,0)/5);
      if((c.player.age>=18&&clubOf(c.world).league===0)||(clubOf(c.world).league>0&&c.world.contract.years===0)){
        const offer=[...c.world.offers].filter(o=>o.status==='open').sort((a,b)=>c.world.clubs.find(x=>x.id===b.clubId)!.reputation-c.world.clubs.find(x=>x.id===a.clubId)!.reputation)[0];
        if(!offer){c.world.currentDay=c.day;prepareWeek(c,[...plan]);continue;}
        acceptOffer(c.world,offer.clubId,c.player.name);
      }
      nextSeason(c);continue;
    }
    prepareWeek(c,[...plan]);if(c.match){finishMatch(c.match);settle(c);}
  }
  const ages=Object.keys(byAge).map(Number),peak=ages.reduce((b,a)=>byAge[a]>byAge[b]?a:b);
  console.log('    end-of-season ability',ages.map(a=>`${a}:${byAge[a].toFixed(1)}`).join(' '),'· top-league best',Math.max(...top).toFixed(1));
  expect(peak).toBeGreaterThanOrEqual(30);expect(peak).toBeLessThanOrEqual(33);
  expect(byAge[35]).toBeLessThan(byAge[peak]);expect(byAge[30]).toBeGreaterThan(byAge[24]);
  expect(byAge[peak]).toBeLessThan(Math.max(...top)+3);
  // the world itself does not inflate over 20 years (mean of the top league's best five)
  expect(top5.at(-1)!-top5[0]).toBeLessThan(4);
},300000);
