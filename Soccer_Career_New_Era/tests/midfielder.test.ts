import {it,expect} from 'vitest';
import {act,attributes,createMatch,emptyStats,rating,step,shotQuality} from '../src/engine';
import {newCareer} from '../src/career';
import {encode,decode} from '../src/storage';
const user={name:'미드필더',pos:'CM' as const,a:attributes(60),energy:100};
it('a goalless midfielder can earn a good rating by creating chances',()=>{const p=createMatch(2,user).players[5];p.stats={...emptyStats(),minutes:90,passes:35,completed:29,progressivePasses:8,keyPasses:3,expectedAssists:.7,losses:6,tackles:2};expect(rating(p)).toBeGreaterThan(7.5);expect(rating(p)).toBeLessThan(9);});
it('safe passing cannot farm an elite rating and zero passes are neutral',()=>{const p=createMatch(2,user).players[5];expect(rating(p)).toBe(6);p.stats.passes=300;p.stats.completed=300;expect(rating(p)).toBeLessThan(7);});
it('creating a missed shot is credited and persisted',()=>{const m=createMatch(8,user);const receiver=m.players[9];receiver.x=90;receiver.y=34;m.ball.owner=9;m.lastPass={from:5,to:9,time:m.clock};act(m,'shoot');expect(m.players[5].stats.keyPasses).toBe(1);expect(m.players[5].stats.expectedAssists).toBeGreaterThan(0);m.ball.flight!.success=false;while(m.ball.flight)step(m,.5,true);expect(m.players[5].stats.assists).toBe(0);expect(m.players[5].stats.keyPasses).toBe(1);expect(m.lastPass).toBeNull();const c=newCareer({name:'미드필더',age:16,pos:'CM',secondary:'ST',foot:'오른',height:178,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'},0);c.match=m;expect(decode(encode(c)).match!.players[5].stats.keyPasses).toBe(1);});
it('only completed forward passes count, and direction works in both halves',()=>{for(const half of [1,2] as const){const m=createMatch(3,user);m.half=half;const from=m.players[5],to=m.players[9];m.ball.owner=null;m.ball.flight={from:5,to:9,kind:'pass',startX:half===1?40:65,startY:34,x:half===1?60:45,y:34,progress:0,duration:.5,success:true,xg:0};step(m,.5,true);expect(from.stats.progressivePasses).toBe(1);expect(to.id).toBe(m.ball.owner);}});
it('old saves without new stats have finite ratings',()=>{const p=createMatch(8,user).players[5];delete p.stats.progressivePasses;delete p.stats.keyPasses;delete p.stats.expectedAssists;expect(Number.isFinite(rating(p))).toBe(true);});
it('midfield support follows the attack while a pass travels in either direction',()=>{
 for(const half of [1,2] as const){const m=createMatch(3,user);m.half=half;m.decision=false;const d=half===1?1:-1;const p=m.players[7];p.x=half===1?60:45;p.y=34;
 m.ball.owner=null;m.ball.flight={from:5,to:9,kind:'pass',startX:half===1?75:30,startY:34,x:half===1?90:15,y:34,progress:0,duration:3,success:true,xg:0};
 const before=p.x;step(m,.5,false);expect((p.x-before)*d).toBeGreaterThan(0);expect(p.mode).toBe('support');}
});
it('a clear shooting opportunity is evaluated on the next tick after reception',()=>{
 const m=createMatch(7,user);m.decision=false;m.cooldown=0;for(const p of m.players)if(p.team===1&&p.pos!=='GK'){p.x=30;p.y=5;}
 m.ball.owner=null;m.ball.flight={from:5,to:9,kind:'pass',startX:80,startY:34,x:94,y:34,progress:0,duration:.5,success:true,xg:0};
 step(m,.5,false);expect(m.ball.owner).toBe(9);expect(m.nextAI).toBe(.5);
 // 0.14 the shot takes the pass with it (assist credited from the flight; a rebound earns none).
 step(m,.5,false);expect(m.ball.flight?.kind).toBe('shot');expect(m.ball.flight?.assistFrom).toBe(5);expect(m.lastPass).toBeNull();
});

it('a defender in the shooting lane matters beyond close-pressure distance',()=>{
 const m=createMatch(2,user),p=m.players[9];p.x=75;p.y=34;for(const q of m.players)if(q.team!==p.team){q.x=20;q.y=5;}
 const clear=shotQuality(m,p);m.players[13].x=88;m.players[13].y=34;expect(shotQuality(m,p)).toBeLessThan(clear*.75);
 m.players[13].y=40;expect(shotQuality(m,p)).toBeCloseTo(clear,8);
});
