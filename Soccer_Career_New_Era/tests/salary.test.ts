import {it,expect} from 'vitest';
import {newWorld,contractSalary,roleSalary,migrateEconomy,money,generateOffers,clubLevel,marketValue,FEE_SCALE,SALARY} from '../src/world';
import {LEAGUE_DATA,AVG_SALARY,OLD_INCOME,leagueLevel} from '../src/leagues';
import {attributes} from '../src/engine';
import {roleAbility} from '../src/roles';
import {newCareer} from '../src/career';
import {encode,decode} from '../src/storage';

// v0.14 realistic money: league × club standing × treatment in the squad × youth, in 만원.
const w=newWorld(5,0);
const clubs=(l:number)=>w.clubs.filter(c=>c.league===l).sort((a,b)=>b.baseLevel!-a.baseLevel!);

it('salaries follow the league, the club, the role and age, in realistic ranges',()=>{
  for(let l=1;l<LEAGUE_DATA.length;l++){
    const [top]=clubs(l),bottom=clubs(l).at(-1)!;
    expect(contractSalary(top,26,0)).toBeGreaterThan(contractSalary(bottom,26,0));                 // a bigger club pays more
    expect(contractSalary(top,26,6)).toBeGreaterThan(contractSalary(top,26,0));                    // a core player more than a squad player
    expect(contractSalary(top,26,0)).toBeGreaterThan(contractSalary(top,26,-6));                   // …who earns more than a bench prospect
    expect(contractSalary(top,19,0)).toBeLessThan(contractSalary(top,24,0));                       // first pro deals are smaller
    let last=0;for(let fit=-15;fit<=15;fit++){const s=contractSalary(bottom,25,fit);expect(s).toBeGreaterThanOrEqual(last);last=s;}
    expect(contractSalary(bottom,18,-20)).toBeGreaterThanOrEqual(SALARY.floor);
  }
  // League order: the English top flight pays far more than the K-League; a K-League regular earns about 1–3억.
  const k=clubs(1)[2],epl=clubs(3)[0];
  expect(contractSalary(k,25,0)).toBeGreaterThanOrEqual(10000);expect(contractSalary(k,25,0)).toBeLessThanOrEqual(30000);
  expect(contractSalary(epl,27,6)).toBeGreaterThanOrEqual(1000000); // a title contender's core player: 100억+
  expect(AVG_SALARY[3]).toBeGreaterThan(AVG_SALARY[8]);expect(AVG_SALARY[8]).toBeGreaterThan(AVG_SALARY[2]);expect(AVG_SALARY[2]).toBeGreaterThan(AVG_SALARY[1]);
  expect(roleSalary(60,0)).toBe(0);expect(roleSalary(leagueLevel(1),1)).toBeCloseTo(AVG_SALARY[1],-3);
  // Transfer fees are on the same scale.
  expect(marketValue(70,22,7,3)).toBeGreaterThanOrEqual(FEE_SCALE*1000);
});

it('offers use the club and the role; budgets can afford them',()=>{
  const c=newCareer({name:'연봉',age:22,pos:'CM',secondary:'ST',foot:'오른',height:180,weight:72,style:'플레이메이커',curve:'꾸준한 성장형'},0,7,{traits:[]});
  c.world.phase='offseason';c.player.a=attributes(70);generateOffers(c.world,c.player,7);
  const ability=roleAbility(c.player.a,c.player.pos);expect(c.world.offers.length).toBeGreaterThan(0);
  for(const o of c.world.offers){const club=c.world.clubs.find(x=>x.id===o.clubId)!;if(!o.pitch||o.pitch==='성장 환경'||o.pitch==='유망주 육성')expect(o.salary).toBe(contractSalary(club,c.player.age,ability-clubLevel(club,c.player.pos)));expect(club.budget).toBeGreaterThanOrEqual(o.fee+o.salary*o.years);}
});

it('older saves are re-priced once (budgets, running contract, open offers); new worlds start on the new scale',()=>{
  expect(newWorld(1,0).economy).toBe(2);
  const c=newCareer({name:'이전',age:23,pos:'ST',secondary:'LW',foot:'오른',height:180,weight:72,style:'테크니션',curve:'꾸준한 성장형'},0,9,{traits:[]});
  const kClub=c.world.clubs.find(x=>x.league===1)!;c.world.clubId=kClub.id;c.player.a=attributes(62);
  // Make it look like a pre-0.14 save.
  delete (c.world as {economy?:number}).economy;for(const cl of c.world.clubs)if(cl.league>0)cl.budget=OLD_INCOME[cl.league]*4;
  c.world.contract={salary:60,years:2};c.world.offers=[{clubId:kClub.id,salary:60,years:2,fee:500,role:'주전 경쟁',negotiated:false,status:'open'}];
  const back=decode(encode(c));
  expect(back.world.economy).toBe(2);
  for(const cl of back.world.clubs)if(cl.league>0)expect(cl.budget).toBe(LEAGUE_DATA[cl.league].income*4);
  const ability=roleAbility(back.player.a,back.player.pos),club=back.world.clubs.find(x=>x.id===kClub.id)!;
  expect(back.world.contract.salary).toBe(contractSalary(club,back.player.age,ability-clubLevel(club,back.player.pos)));expect(back.world.contract.salary).toBeGreaterThan(5000);
  expect(back.world.offers[0].fee).toBe(500*FEE_SCALE);
  const again=structuredClone(back.world);migrateEconomy(again,back.player);expect(again).toEqual(back.world); // only once
});

it('money is written in Korean units',()=>{
  expect(money(0)).toBe('0원');expect(money(7500)).toBe('7,500만원');expect(money(23400)).toBe('2억 3,400만원');expect(money(1598000)).toBe('159억 8,000만원');expect(money(30000)).toBe('3억원');
});
