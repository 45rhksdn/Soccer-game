import {it,expect} from 'vitest';
import {newCareer,startCareerMatch,trustChange} from '../src/career';
import {attributes,createMatch,finishMatch,random} from '../src/engine';
import {applyDaily,configureTrait} from '../src/development';
import {TRAIT_DEFS,matchAttributes,hasMatchEffect,luckChance,injuryChanceMultiplier,injuryWeeks,trainingFatigueMultiplier,abroadGrowthMultiplier,trustGainMultiplier,superSubMultiplier,matchFx} from '../src/traits';

const profile={name:'추가특성',age:16,pos:'CM' as const,secondary:'ST' as const,foot:'오른',height:178,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'};
const career=(seed=51)=>newCareer(profile,0,seed);
const never=()=>.99,always=()=>0;

it('catalogue: 34 traits, every polarity has rare and common entries, chances follow RARITY_CHANCE',()=>{
  expect(TRAIT_DEFS.length).toBe(34);
  expect(TRAIT_DEFS.filter(d=>d.polarity==='negative').length).toBe(13);
  for(const d of TRAIT_DEFS)expect(d.chance).toBe(d.rarity==='rare'?.015:.03);
  for(const d of TRAIT_DEFS)for(const ex of ((d as {excludes?:readonly string[]}).excludes??[]))expect(TRAIT_DEFS.some(x=>x.id===ex)).toBe(true);
});

it('match attributes: 철벽, 스피드스타, 골 냄새, 둔한 발',()=>{
  const a=attributes(60);
  expect(matchAttributes(['철벽'],a,never).a).toMatchObject({defending:66,positioning:64});
  expect(matchAttributes(['스피드스타'],a,never).a).toMatchObject({speed:65,acceleration:65});
  expect(matchAttributes(['골 냄새'],a,never).a).toMatchObject({shooting:65,composure:63});
  expect(matchAttributes(['둔한 발'],a,never).a).toMatchObject({speed:55,acceleration:56});
});

it('big matches only: 빅매치 체질 +5 everywhere, 큰 경기 울렁증 composure −8 / decisions −4',()=>{
  const a=attributes(60);
  expect(hasMatchEffect(['빅매치 체질'],false)).toBe(false);expect(hasMatchEffect(['빅매치 체질'],true)).toBe(true);
  expect(matchAttributes(['빅매치 체질'],a,never).a.passing).toBe(60);
  expect(Object.values(matchAttributes(['빅매치 체질'],a,never,{bigMatch:true}).a).every(v=>v===65)).toBe(true);
  expect(matchAttributes(['큰 경기 울렁증'],a,never,{bigMatch:true}).a).toMatchObject({composure:52,decisions:56,passing:60});
  // Through configureTrait in a cup match vs a league match.
  const cup=career(),league=career();cup.player.a=league.player.a=attributes(60);cup.development.traits=league.development.traits=['빅매치 체질'];
  startCareerMatch(league);expect(league.match!.players[league.match!.userId].a.passing).toBe(60);
  cup.world.phase='cup';cup.world.opponentId=cup.world.clubs.find(x=>x.league===0&&x.id!==cup.world.clubId)!.id;startCareerMatch(cup);
  expect(cup.match!.players[cup.match!.userId].a.passing).toBe(65);expect(cup.player.a.passing).toBe(60);
});

it('기복이 심함: 30 % of matches ×0.85 with its own notice; never labelled 실전파',()=>{
  const a=attributes(60),bad=matchAttributes(['기복이 심함'],a,always),ok=matchAttributes(['기복이 심함'],a,never);
  expect(bad.a.passing).toBeCloseTo(51,8);expect(bad.boosted).toBe(false);expect(bad.news[0]).toContain('기복이 심함');expect(ok.a.passing).toBe(60);
  let fired=0;const r={seed:3};for(let i=0;i<20000;i++)if(matchAttributes(['기복이 심함'],a,()=>random(r)).fired.length)fired++;
  expect(fired/20000).toBeGreaterThan(.29);expect(fired/20000).toBeLessThan(.31);
  const c=career();c.development.traits=['기복이 심함'];let seen=false;for(let s=0;s<40&&!seen;s++){const x=structuredClone(c);x.seed=s;startCareerMatch(x);if(x.match!.traitNotes?.length){seen=true;expect(x.match!.traitBoost).toBe(false);expect(x.match!.traitNotes![0]).toContain('기복');}}
  expect(seen).toBe(true);
});

it('luck, injuries and fatigue: 불운, 잔부상, 저질 체력',()=>{
  expect(luckChance([])).toBe(.03);expect(luckChance(['불운'])).toBe(.01);expect(luckChance(['행운아'])).toBe(.09);expect(luckChance(['불운','행운아'])).toBe(.09);
  expect(injuryChanceMultiplier(['잔부상'])).toBe(1.3);expect(injuryWeeks(['잔부상'],2)).toBe(3);expect(injuryWeeks(['잔부상'],1)).toBe(2);
  expect(trainingFatigueMultiplier(['저질 체력'])).toBe(1.3);
  const c=career();c.player.fatigue=0;applyDaily(c,c.player,'passing',['저질 체력']);expect(c.player.fatigue).toBeCloseTo(15.6,8);
});

it('abroad: 향수병 ×0.85 and 해외 체질 ×1.15 only when the club is in league 2 or 3',()=>{
  expect(abroadGrowthMultiplier(['향수병'],1)).toBe(1);expect(abroadGrowthMultiplier(['향수병'],2)).toBe(.85);expect(abroadGrowthMultiplier(['해외 체질'],3)).toBe(1.15);
  const base=career();base.player.a=attributes(40);base.player.potential=95;base.seed=11;
  base.world.clubId=base.world.clubs.find(x=>x.league===2)!.id;
  const gain=(t:string[])=>{const c=structuredClone(base);applyDaily(c,c.player,'passing',t);return c.player.a.passing-40;};
  expect(gain(['향수병'])/gain([])).toBeCloseTo(.85,8);expect(gain(['해외 체질'])/gain([])).toBeCloseTo(1.15,8);
  const home=structuredClone(base);home.world.clubId=home.world.clubs.find(x=>x.league===1)!.id;
  const g=(t:string[])=>{const c=structuredClone(home);applyDaily(c,c.player,'passing',t);return c.player.a.passing-40;};
  expect(g(['향수병'])/g([])).toBeCloseTo(1,8);
});

it('coach trust: 성실함 ×1.5 and 감독과 불화 ×0.5 on gains only',()=>{
  expect(trustGainMultiplier(['성실함'])).toBe(1.5);expect(trustGainMultiplier(['감독과 불화'])).toBe(.5);
  const t=(traits:string[])=>{const c=career();c.player.trust=50;applyDaily(c,c.player,'passing',traits);return c.player.trust-50;};
  expect(t(['성실함'])).toBeCloseTo(.3,8);expect(t(['감독과 불화'])).toBeCloseTo(.1,8);expect(t([])).toBeCloseTo(.2,8);
  // After a match only gains are scaled; a poor match lowers trust equally for everyone.
  expect(trustChange(['성실함'],2)).toBeCloseTo(3,8);expect(trustChange(['감독과 불화'],2)).toBeCloseTo(1,8);
  expect(trustChange(['성실함'],-2)).toBe(-2);expect(trustChange(['감독과 불화'],-2)).toBe(-2);
});

it('슈퍼 조커: bench entry attributes ×1.15 (capped at 100), with a notice',()=>{
  expect(superSubMultiplier(['슈퍼 조커'])).toBe(1.15);
  const c=career();c.player.a=attributes(60);c.development.traits=['슈퍼 조커'];
  const m=createMatch(4,{name:'조커',pos:'CM',a:attributes(60),energy:100});m.userOnPitch=false;m.benchEntry={minute:60,name:'조커',a:{...c.player.a},energy:100,number:10};
  configureTrait(c,m);expect(m.benchEntry!.a.passing).toBeCloseTo(69,8);expect(m.traitNotes).toContain('슈퍼 조커 · 교체 투입 시 능력치 ×1.15');
  c.player.a=attributes(95);const n=createMatch(4,{name:'조커',pos:'CM',a:attributes(95),energy:100});n.userOnPitch=false;n.benchEntry={minute:60,name:'조커',a:{...c.player.a},energy:100,number:10};
  configureTrait(c,n);expect(n.benchEntry!.a.passing).toBe(100);
});

it('다혈질: about 1.5× the fouls in real matches; players without it are unaffected',()=>{
  const fouls=(temper:boolean)=>{let n=0;for(let s=1;s<=40;s++){const m=createMatch(s,{name:'u',pos:'CM',a:attributes(60),energy:100});
    m.players.forEach((p,i)=>{p.name=`P${i}`;if(temper&&p.team===0)p.fx=matchFx(['다혈질']);});finishMatch(m);
    n+=m.log.filter(e=>/^P(\d+) · 파울/.test(e.text)&&Number(/^P(\d+)/.exec(e.text)![1])<11).length;}return n;};
  const calm=fouls(false),hot=fouls(true);
  expect(hot/calm).toBeGreaterThan(1.25);expect(hot/calm).toBeLessThan(1.8);
  console.log(`    team-0 fouls in 40 matches: ${calm} → ${hot} with 다혈질`);
});
