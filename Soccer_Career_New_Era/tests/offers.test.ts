import {it,expect} from 'vitest';
import {newCareer} from '../src/career';
import {attributes} from '../src/engine';
import {generateOffers,clubLevel,offerDetails,OFFER_FIT,type World} from '../src/world';
import {scoutInterest,INTEREST_FIT} from '../src/development';
import {roleAbility,ROLE_KEYS} from '../src/roles';

const make=(pos:'ST'|'CB'|'CM',seed=1)=>newCareer({name:'이적',age:20,pos,secondary:'LW',foot:'오른',height:180,weight:72,style:'테크니션',curve:'꾸준한 성장형'},0,seed);
const player=(pos:'ST'|'CB'|'CM',level:number,age=23)=>{const a=attributes(level-10);for(const k of ROLE_KEYS[pos])a[k]=level;return {a,pos,age,energy:100};};
const offered=(w:World)=>w.offers.filter(o=>o.clubId!==w.clubId).map(o=>w.clubs.find(c=>c.id===o.clubId)!);

it('offers follow the current position ability: every bidding club is within the fit window',()=>{
  for(const pos of ['ST','CB','CM'] as const)for(const level of [50,58,64,70,76,82,88])for(const seed of [1,2]){
    const c=make(pos,seed),p=player(pos,level);c.world.interestedClubIds=[];generateOffers(c.world,p,6.8);
    const ability=roleAbility(p.a,pos),clubs=offered(c.world);expect(clubs.length).toBeGreaterThan(0);
    const fits=clubs.map(x=>ability-clubLevel(x,pos));
    const inWindow=fits.filter(f=>f>=OFFER_FIT.min&&f<=OFFER_FIT.max).length;
    // Either all bidders fit, or (no club fits) only the two closest-level fallback clubs bid.
    if(inWindow)expect(inWindow).toBe(clubs.length);else expect(clubs.length).toBeLessThanOrEqual(2);
    for(const o of c.world.offers.filter(o=>o.clubId!==c.world.clubId)){const f=ability-clubLevel(c.world.clubs.find(x=>x.id===o.clubId)!,pos);expect(o.role).toBe(offerDetails(c.world.clubs.find(x=>x.id===o.clubId)!,p).role);}
  }
});

it('a stronger player gets offers from stronger leagues, a weaker one from weaker leagues',()=>{
  const mean=(level:number)=>{const c=make('ST',3);c.world.interestedClubIds=[];generateOffers(c.world,player('ST',level),6.8);const cl=offered(c.world);return cl.reduce((n,x)=>n+clubLevel(x,'ST'),0)/cl.length;};
  const ls=[52,62,72,82].map(mean);for(let i=1;i<ls.length;i++)expect(ls[i]).toBeGreaterThan(ls[i-1]);
  expect(ls[0]).toBeLessThan(65);expect(ls[3]).toBeGreaterThan(75);
  // A star is no longer courted by every club of the lowest professional league.
  const c=make('ST',3);generateOffers(c.world,player('ST',85),6.8);expect(offered(c.world).every(x=>x.league>=2)).toBe(true);
});

it('under-22s may be signed as prospects a little below the starters, older players not',()=>{
  const c=make('CM',4);const young=player('CM',66,20),old=player('CM',66,27);
  generateOffers(c.world,young,6.8);const y=offered(c.world).length;generateOffers(c.world,old,6.8);const o=offered(c.world).length;
  expect(y).toBeGreaterThanOrEqual(o);
  const ability=roleAbility(old.a,'CM');for(const x of offered(c.world))expect(ability-clubLevel(x,'CM')).toBeGreaterThanOrEqual(OFFER_FIT.min);
});

it('club interest comes only from clubs near the player\'s level',()=>{
  for(let seed=1;seed<=60;seed++){
    const c=make('ST',seed);c.player.age=18;c.player.a=player('ST',58+seed%25).a;c.development.interestIds=[];c.seed=seed*7919;
    scoutInterest(c);
    for(const id of c.development.interestIds){const club=c.world.clubs.find(x=>x.id===id)!;expect(Math.abs(clubLevel(club,'ST')-roleAbility(c.player.a,'ST'))).toBeLessThanOrEqual(INTEREST_FIT);}
  }
});
