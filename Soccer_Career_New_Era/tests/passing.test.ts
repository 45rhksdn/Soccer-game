import {it,expect} from 'vitest';
import {createMatch,attributes} from '../src/engine';
import {attackChance,PASS} from '../src/tactical';

/** User CM on the ball at midfield, a teammate `gap` metres away (ahead if `ahead`), opponents far away unless `marker`. */
function scene(skill:number,gap:number,opts:{ahead?:boolean,marker?:number}={}){
  const a=attributes(60);a.passing=a.longPassing=a.anticipation=skill;
  const m=createMatch(3,{name:'패서',pos:'CM',a,energy:100},60);
  for(const p of m.players){p.x=p.team?100:5;p.y=5+p.id*2.5;}
  const u=m.players[m.userId];u.x=40;u.y=34;m.ball={x:40,y:34,owner:u.id,flight:null};
  const mate=m.players.find(p=>p.team===0&&p.id!==u.id&&p.pos!=='GK')!;
  mate.x=40+(opts.ahead?gap:0);mate.y=opts.ahead?34:34+gap;
  if(opts.marker!==undefined){const o=m.players.find(p=>p.team===1&&p.pos!=='GK')!;o.x=40-opts.marker;o.y=34;}
  return {m,target:mate.id};
}
const pass=(skill:number,gap:number,opts:{ahead?:boolean,marker?:number}={},kind:'pass'|'safe'|'forward'|'through'='pass')=>{const {m,target}=scene(skill,gap,opts);return attackChance(m,kind,{targetId:target});};

it('an unpressured short pass is safe: about 87–90 % at skill 60, about 95 %+ at skill 95',()=>{
  expect(pass(60,10)).toBeGreaterThanOrEqual(.85);expect(pass(60,10)).toBeLessThanOrEqual(.9);
  expect(pass(95,10)).toBeGreaterThanOrEqual(.95);
  expect(pass(40,10)).toBeLessThan(pass(60,10));expect(pass(60,10)).toBeLessThan(pass(95,10));
});

it('length, a forward or through ball and pressure lower the chance',()=>{
  expect(pass(60,25)).toBeLessThan(pass(60,10));
  expect(pass(60,10,{ahead:true})).toBeCloseTo(pass(60,10)-PASS.forward,8); // a pass more than 8 m ahead is a forward pass
  expect(pass(60,10,{},'through')).toBeLessThan(pass(60,10,{},'forward'));
  expect(pass(60,10,{marker:1.5})).toBeLessThan(pass(60,10,{marker:5}));
  expect(pass(60,10,{marker:5})).toBeLessThan(pass(60,10));
  // One close marker costs a pass less than it costs a dribble (4 + up to 8 points, not 5 + 12).
  expect(pass(60,10)-pass(60,10,{marker:1})).toBeLessThan(.12);
});

it('깨달음 from a pass grows the skill that decided it: short → 짧은 패스, long → 긴 패스 (+ 예측력)',async()=>{
  const {passInsightKeys,attackKeys,longPassWeight}=await import('../src/tactical');
  expect(new Set(passInsightKeys(6))).toEqual(new Set(['passing','anticipation']));
  expect(new Set(passInsightKeys(45))).toEqual(new Set(['longPassing','anticipation']));
  const mid=passInsightKeys(24);expect(mid.filter(k=>k==='longPassing').length).toBe(Math.round(4*longPassWeight(24)));
  for(const d of [5,15,24,33,50]){const k=passInsightKeys(d);expect(k).toHaveLength(6);expect(k.filter(x=>x==='anticipation')).toHaveLength(2);}
  expect(attackKeys('hold')).toEqual(['strength']);
  // In a match: a short pass with a guaranteed insight only ever grows 짧은 패스 or 예측력.
  const {act}=await import('../src/engine');
  const grown=new Set<string>();
  for(let seed=1;seed<=40;seed++){const {m,target}=scene(60,6);m.seed=seed;m.decision=true;m.insight={chance:1,gains:{},events:[]};act(m,'pass',{targetId:target});for(const k of Object.keys(m.insight.gains))grown.add(k);}
  expect([...grown].sort()).toEqual(['anticipation','passing']);
  const long=new Set<string>();
  for(let seed=1;seed<=40;seed++){const {m,target}=scene(60,45,{ahead:true});m.seed=seed;m.decision=true;m.insight={chance:1,gains:{},events:[]};act(m,'pass',{targetId:target});for(const k of Object.keys(m.insight.gains))long.add(k);}
  expect([...long].sort()).toEqual(['anticipation','longPassing']);
});
