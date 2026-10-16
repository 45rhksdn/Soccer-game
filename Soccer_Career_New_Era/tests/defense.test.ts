import {it,expect} from 'vitest';
import {createMatch,attributes,step,act,chooseAction,finishMatch,defend,tackleChance,rating,emptyStats,DEFENSE_ACTIONS,DEFENSE_PROMPT_DISTANCE,DEFENSIVE_WIN_CAP,FAILED_TACKLE_CAP,type Match,type DefenseAction} from '../src/engine';
import {encode,decode} from '../src/storage';
import {newCareer,startCareerMatch,settle} from '../src/career';
import {playToday} from '../src/development';

const user=(pos:'CB'|'CM'|'ST'='CB')=>({name:'수비수',pos,a:attributes(62),energy:100});
/** Plays a live (interactive) match: on-ball moments use the AI choice, defensive moments use `choice`. */
function playLive(m:Match,choice:DefenseAction|'none'|((m:Match)=>DefenseAction|'none')){
  let prompts=0,guard=0;
  while(!m.ended&&guard++<40000){
    if(m.decision){act(m,chooseAction(m,m.players[m.userId]));continue;}
    if(m.defending){prompts++;
      const owner=m.players[m.ball.owner!];expect(owner.team).not.toBe(m.players[m.userId].team);
      expect(Math.hypot(owner.x-m.players[m.userId].x,owner.y-m.players[m.userId].y)).toBeLessThan(DEFENSE_PROMPT_DISTANCE);
      const clock=m.clock;step(m,.5);expect(m.clock).toBe(clock); // the live match waits for the choice
      defend(m,typeof choice==='function'?choice(m):choice);continue;}
    step(m,.5);
  }
  return prompts;
}

it('auto / quick simulation never asks for a defensive choice',()=>{
  for(let seed=1;seed<=20;seed++){const m=finishMatch(createMatch(seed,user()));expect(m.defending).toBeFalsy();expect(m.guard??null).toBeNull();expect(m.players[m.userId].stats.defensiveWins).toBeUndefined();}
});

it('live play pauses for a defensive choice when an opponent carries the ball near the user, spaced out',()=>{
  let total=0;for(let seed=1;seed<=10;seed++){const m=createMatch(seed,user());total+=playLive(m,'none');expect(m.ended).toBe(true);}
  expect(total).toBeGreaterThan(10);expect(total/10).toBeLessThan(19); // at most one prompt per 300 game seconds
  expect(Object.keys(DEFENSE_ACTIONS)).toEqual(['tackle','press','intercept','contain']);
});

it('tackle: wins the ball at about the shown chance (after the foul risk); a miss is recorded',()=>{
  let tries=0,won=0,expected=0,failed=0;
  for(let seed=1;seed<=40;seed++){const m=createMatch(seed,user());
    playLive(m,mm=>{tries++;expected+=tackleChance(mm)*.8;const before=mm.players[mm.userId].stats.tackles;defend(mm,'tackle');if(mm.players[mm.userId].stats.tackles>before)won++;return 'none';});
    failed+=m.players[m.userId].stats.failedTackles??0;}
  expect(tries).toBeGreaterThan(80);
  expect(won/tries).toBeGreaterThan(expected/tries-.1);expect(won/tries).toBeLessThan(expected/tries+.1);
  expect(failed).toBe(tries-won);
});

it('press / intercept / contain windows end with defensive wins; intercept cuts passes out',()=>{
  const stats=(c:DefenseAction|'none')=>{let wins=0,ints=0,prompts=0;for(let seed=1;seed<=30;seed++){const m=createMatch(seed,user());prompts+=playLive(m,c);const s=m.players[m.userId].stats;wins+=s.defensiveWins??0;ints+=s.interceptions;}return {wins,ints,prompts};};
  const none=stats('none'),press=stats('press'),cut=stats('intercept'),hold=stats('contain');
  expect(none.wins).toBe(0);
  for(const x of [press,cut,hold]){expect(x.wins).toBeGreaterThan(0);expect(x.wins).toBeLessThanOrEqual(x.prompts);}
  expect(cut.ints).toBeGreaterThan(none.ints);
  console.log('    wins per prompt  press',(press.wins/press.prompts).toFixed(2),'intercept',(cut.wins/cut.prompts).toFixed(2),'contain',(hold.wins/hold.prompts).toFixed(2),'· interceptions none/intercept',none.ints,cut.ints);
});

it('rating: defensive wins add a capped bonus, missed tackles a capped penalty; balance of choices stays moderate',()=>{
  const p=createMatch(2,user()).players[3];p.stats={...emptyStats(),minutes:90};const base=rating(p);
  expect(rating({...p,stats:{...p.stats,defensiveWins:2}})-base).toBeCloseTo(.08,8);
  expect(rating({...p,stats:{...p.stats,defensiveWins:30}})-base).toBeCloseTo(DEFENSIVE_WIN_CAP,8);
  expect(base-rating({...p,stats:{...p.stats,failedTackles:30}})).toBeCloseTo(FAILED_TACKLE_CAP,8);
  // Average rating of a live player choosing a defence vs leaving it to the AI: a reward, not a game breaker.
  const mean=(c:DefenseAction|'none')=>{let n=0;for(let seed=1;seed<=30;seed++){const m=createMatch(seed,user());playLive(m,c);n+=rating(m.players[m.userId]);}return n/30;};
  const none=mean('none');
  for(const c of ['press','intercept','contain','tackle'] as const){const d=mean(c)-none;console.log(`    ${c} rating Δ ${d.toFixed(3)}`);expect(Math.abs(d)).toBeLessThan(.35);}
});

it('a pending defensive choice and an active guard survive save/load in a career match',()=>{
  const c=newCareer({name:'저장수비',age:17,pos:'CB',secondary:'LB',foot:'오른',height:186,weight:80,style:'피지컬',curve:'꾸준한 성장형'},0,77);
  for(let i=0;i<5;i++)playToday(c,'rest');startCareerMatch(c);const m=c.match!;
  let guard=0;while(!m.defending&&!m.ended&&guard++<20000){if(m.decision)act(m,chooseAction(m,m.players[m.userId]));else step(m,.5);}
  if(m.userOnPitch===false||m.ended)return; // not selected: nothing to defend
  expect(m.defending).toBe(true);
  const back=decode(encode(c));expect(back.match).toEqual(c.match);
  for(const x of [c,back]){defend(x.match!,'contain');for(let i=0;i<20;i++)step(x.match!,.5);}
  expect(back.match).toEqual(c.match);
  for(const x of [c,back]){finishMatch(x.match!);settle(x);}
  expect(back).toEqual(c);
});
