import {it,expect} from 'vitest';
import {createMatch,attributes,direction,act,step,type Match} from '../src/engine';
import {generateCandidates,careerFromCandidate,candidateStory} from '../src/scouting';
import {SCHOOLS_KR,schoolById} from '../src/schools';
import {playerStory,josa} from '../src/stories';
import {newCareer} from '../src/career';
import {encode,decode,validate} from '../src/storage';

// v0.14: assists without a time limit (until the ball is lost), and richer back-stories.
const user={name:'도움',pos:'ST' as const,a:attributes(70),energy:100};
function shooter(){
  const m=createMatch(31,user);const d=direction(m,0),u=m.players[m.userId],mate=m.players.find(p=>p.team===0&&p.pos==='CM')!;
  u.x=d>0?96:9;u.y=34;m.ball={x:u.x,y:u.y,owner:u.id,flight:null};m.decision=true;m.insight={chance:0,gains:{},events:[]};
  for(const p of m.players)if(p.team===1&&p.pos!=='GK'){p.x=d>0?50:55;}
  return {m,u,mate};
}
const resolve=(m:Match)=>{for(let i=0;i<20&&m.ball.flight;i++)step(m,.5,true);};

it('a goal after any number of dribbles and a long time still credits the passer, as long as the ball was never lost',()=>{
  const {m,u,mate}=shooter();m.lastPass={from:mate.id,to:u.id,time:m.clock-400}; // well over the old 90 s window
  act(m,'closeShot');m.ball.flight!.success=true;m.ball.flight!.onTarget=true;resolve(m);
  expect(mate.stats.assists).toBe(1);expect(m.goals!.at(-1)!.assister).toBe(mate.name);expect(mate.stats.keyPasses).toBe(1);
});

it('losing the ball in between, or scoring from your own rebound, earns no assist',()=>{
  const a=shooter();a.m.lastPass={from:a.mate.id,to:a.u.id,time:a.m.clock};
  const opp=a.m.players.find(p=>p.team===1&&p.pos==='CB')!;
  // An opponent wins it (own() clears the pass), then the shooter wins it back.
  a.m.ball.owner=opp.id;(a.m as any).lastPass&&a.m.players[a.m.lastPass!.from].team!==opp.team&&(a.m.lastPass=null);
  expect(a.m.lastPass).toBeNull();
  a.m.ball.owner=a.u.id;act(a.m,'closeShot');a.m.ball.flight!.success=true;resolve(a.m);
  expect(a.mate.stats.assists).toBe(0);expect(a.m.goals!.at(-1)!.assister).toBeNull();
  // Rebound: the pass is used up by the first shot.
  const b=shooter();b.m.lastPass={from:b.mate.id,to:b.u.id,time:b.m.clock};
  act(b.m,'closeShot');expect(b.m.lastPass).toBeNull();expect(b.m.ball.flight!.assistFrom).toBe(b.mate.id);
  b.m.ball.flight!.success=false;b.m.ball.flight=null;b.m.ball.owner=b.u.id;b.m.decision=true;
  act(b.m,'closeShot');b.m.ball.flight!.success=true;resolve(b.m);
  expect(b.mate.stats.assists).toBe(0);expect(b.mate.stats.keyPasses).toBe(1);
});

it('a header from a cross credits the crosser',()=>{
  const {m,u,mate}=shooter();m.lastPass={from:mate.id,to:u.id,time:m.clock};m.aerial={to:u.id,until:m.clock+9};
  act(m,'header');m.ball.flight!.success=true;resolve(m);expect(mate.stats.assists).toBe(1);
});

it('back-stories: grounded in region, school, numbers and traits; deterministic; no RNG; shown story = signed story',()=>{
  const maetan=schoolById('gyeonggi-maetan')!,c=generateCandidates(7,maetan.id,0)[0];
  const t=candidateStory(c,maetan);
  expect(t).toEqual(candidateStory(c,maetan));
  expect(t.chapters).toHaveLength(4);expect(t.chapters[0]).toMatch(/수도권|신도시/);
  expect(t.chapters.join(' ')).toContain('매탄고');expect(t.chapters.join(' ')).toContain('수원삼성 U18');
  expect(t.chapters[2]).toContain(`${c.height}cm`);
  const all=[t.headline,...t.chapters,t.quote].join(' ');
  expect(all).not.toMatch(/undefined|NaN|은는|을를/);
  for(const tr of c.traits)expect(all).toContain(tr);
  // Every region reads differently, and a school without a pro affiliation does not claim one.
  const heads=new Set(['부산','강원','제주','서울'].map(r=>{const s=SCHOOLS_KR.find(x=>x.region===r&&!x.affiliation)!;const k=generateCandidates(3,s.id,0)[0];const st=candidateStory(k,s);expect(st.chapters.join(' ')).not.toContain('유스팀');return st.chapters[0].slice(0,12);}));
  expect(heads.size).toBe(4);
  // Headlines vary within one school's list.
  expect(new Set(generateCandidates(7,maetan.id,0).map(k=>candidateStory(k,maetan).headline.split(' ')[0])).size).toBeGreaterThan(1);
  // Signing keeps the exact story; it survives save/load; the RNG of the career is untouched by reading it.
  const career=careerFromCandidate(c,7);expect(career.story?.headline).toBe(t.headline);expect(career.story?.chapters).toEqual(t.chapters);expect(career.story?.quote).toBe(t.quote);
  expect(decode(encode(career)).story).toEqual(career.story);
  const before=JSON.stringify(career);playerStory({...career.player},null,'x');expect(JSON.stringify(career)).toBe(before);
});

it('custom players get a story too; old saves without one still load; damaged story data is rejected',()=>{
  const c=newCareer({name:'직접',age:16,pos:'CB',secondary:'CM',foot:'왼',height:186,weight:78,style:'피지컬',curve:'대기만성형'},0,5);
  expect(c.story?.chapters?.length).toBe(4);expect(c.story?.chapters?.[2]).toContain('186cm의 왼발 센터백');
  const old=structuredClone(c);delete old.story!.headline;delete old.story!.chapters;delete old.story!.quote;expect(()=>validate(old)).not.toThrow();
  const bad=structuredClone(c) as any;bad.story.chapters=[1,2];expect(()=>validate(bad)).toThrow();
  expect(josa('조준우','은는')).toBe('조준우는');expect(josa('홍도민','이가')).toBe('홍도민이');expect(josa('몸싸움','이다')).toBe('몸싸움이다');expect(josa('시야','이다')).toBe('시야다');
});
