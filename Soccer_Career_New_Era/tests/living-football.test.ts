import {it,expect} from 'vitest';
import {attributes,createMatch,act,step,direction,finishMatch} from '../src/engine';
import {throughPlan,attackOdds,attackAllowed} from '../src/tactical';
import {rememberPlay,tendency,adaptiveTarget,gamePlan} from '../src/matchDynamics';
import {newCareer} from '../src/career';
import {recordConnections,recordMove,matchOccasion,clubReasons} from '../src/careerMoments';
import {encode,decode} from '../src/storage';
const career=()=>newCareer({name:'연결',age:17,pos:'CM',secondary:'ST',foot:'오른',height:180,weight:72,style:'플레이메이커',curve:'꾸준한 성장형'},0,17,{traits:[]});
function scene(){
 const m=createMatch(217,{name:'패서',pos:'CM',a:attributes(80),energy:100});m.insight={chance:0,gains:{},events:[]};
 const u=m.players[m.userId],d=direction(m,0),X=(x:number)=>d>0?x:105-x;
 for(const p of m.players){p.x=X(p.team?94:20);p.y=p.team?4:60;}
 u.x=X(55);u.y=34;const q=m.players.find(p=>p.team===0&&p.pos==='ST')!;q.x=X(68);q.y=34;q.a=attributes(80);
 m.ball={x:u.x,y:u.y,owner:u.id,flight:null};m.decision=true;return {m,u,q,d,X};
}
it('through preview is pure, ahead of target, and distinct from a foot pass',()=>{
 const {m,u,q,d}=scene(),before=JSON.stringify(m),plan=throughPlan(m,u,q);
 expect(plan.allowed).toBe(true);expect((plan.aim.x-q.x)*d).toBeGreaterThan(0);
 const low=attackOdds(m,'through',{targetId:q.id}).p;u.a.vision=100;u.a.decisions=100;u.a.anticipation=100;
 expect(attackOdds(m,'through',{targetId:q.id}).p).toBeGreaterThan(low);
 Object.assign(u.a,attributes(80));expect(JSON.stringify(m)).toBe(before);
 const foot=structuredClone(m);act(foot,'pass',{targetId:q.id});act(m,'through',{targetId:q.id});
 expect(foot.ball.flight!.x).toBe(q.x);expect(m.ball.flight!.x).toBe(plan.aim.x);expect(m.ball.flight!.through).toBe(true);
});
it('through disallows offside, wrong team and goal-line targets',()=>{
 const {m,u,q,X}=scene();q.x=X(99);expect(attackAllowed(m,'through',{targetId:q.id})).toBe(false);
 expect(attackAllowed(m,'through',{targetId:11})).toBe(false);
 q.x=X(101);expect(throughPlan(m,u,q).allowed).toBe(false);
});
it('a through receiver moves to the ball instead of teleporting; successful delivery credits the passer',()=>{
 const {m,u,q}=scene();act(m,'through',{targetId:q.id});m.ball.flight!.success=true;
 let previous={x:q.x,y:q.y},ticks=0;
 while(m.ball.flight&&ticks++<30){step(m,.25,false);expect(Math.hypot(q.x-previous.x,q.y-previous.y)).toBeLessThan(3);previous={x:q.x,y:q.y};}
 expect(ticks).toBeLessThan(30);expect(u.stats.completed).toBe(1);expect(m.ball.owner).toBe(q.id);expect(m.lastPass?.from).toBe(u.id);
});
it('an opponent who actually arrives first intercepts the through ball',()=>{
 const {m,u,q}=scene();act(m,'through',{targetId:q.id});const f=m.ball.flight!;f.success=true;
 const defender=m.players[12];defender.x=f.x;defender.y=f.y;q.x=u.x;q.y=65;
 for(let i=0;i<30&&m.ball.flight;i++)step(m,.25,false);
 expect(u.stats.completed).toBe(0);expect(defender.stats.interceptions).toBe(1);
});
it('repeated actions change defensive destinations, not the odds formula; memory decays',()=>{
 const {m,u,q,d}=scene(),def=m.players[12];def.x=u.x+d*5;def.y=u.y;
 const before=attackOdds(m,'dribble',{vector:{x:d,y:0}}).p;
 for(let i=0;i<3;i++)rememberPlay(m,u,'dribble',{x:d,y:0});
 expect(tendency(m,u)?.kind).toBe('dribble');expect(adaptiveTarget(m,def,u,u.x,u.y).x).not.toBe(u.x);
 expect(attackOdds(m,'dribble',{vector:{x:d,y:0}}).p).toBe(before);
 m.clock+=1201;expect(tendency(m,u)).toBeUndefined();
 for(let i=0;i<3;i++)rememberPlay(m,u,'pass',undefined,q.id);expect(tendency(m,u)?.kind).toBe('pass');
});
it('late score state opens or closes space symmetrically; booked defenders stand off',()=>{
 const {m,u}=scene();m.clock=80*60;m.score=[0,1];expect(gamePlan(m,0).line).toBeGreaterThan(0);expect(gamePlan(m,1).line).toBeLessThan(0);
 m.score=[1,0];expect(gamePlan(m,0).line).toBeLessThan(0);expect(gamePlan(m,1).line).toBeGreaterThan(0);
 const def=m.players[12];def.x=u.x+3;def.y=u.y;const old=adaptiveTarget(m,def,u,u.x,u.y);def.yellow=1;expect(adaptiveTarget(m,def,u,u.x,u.y)).not.toEqual(old);
});
it('actual rival appearances create a single durable event; stand-in squads do not',()=>{
 const c=career(),{m}=scene();m.rosterIds=m.players.map(p=>'p'+p.id);m.players[m.userId].stats.minutes=90;
 m.players[12].stats.minutes=90;m.rosterIds[12]='x'+c.development.rival.id;
 recordConnections(c,m);expect(c.connections?.events??[]).toHaveLength(0);
 m.rosterIds[12]=c.development.rival.id;matchOccasion(c,m);expect(m.occasion).toContain('라이벌');
 recordConnections(c,m);recordConnections(c,m);expect(c.connections!.events).toHaveLength(1);
 c.match=m;expect(decode(encode(c)).connections).toEqual(c.connections);
});
it('club reasons use actual records; moving preserves abilities and history',()=>{
 const c=career(),a={...c.player.a},history=structuredClone(c.history),from=c.world.clubId;
 c.world.clubId=c.development.rival.clubId;recordMove(c,from,c.world.clubId);
 expect(c.connections!.events.some(e=>e.key.startsWith('rival-join'))).toBe(true);
 expect(c.player.a).toEqual(a);expect(c.history).toEqual(history);expect(clubReasons(c).stay[0]).toContain('0경기');
});
it('v9 migrates without fabricating career events, in-flight save resumes deterministically',()=>{
 const c=career(),{m,q}=scene();act(m,'through',{targetId:q.id});c.match=m;
 const old=structuredClone(c) as unknown as {version:number};old.version=9;
 const restored=decode(encode(old as ReturnType<typeof career>));expect(restored.version).toBe(10);expect(restored.connections).toBeUndefined();
 for(let i=0;i<25;i++){step(c.match!,.5,true);step(restored.match!,.5,true);}expect(restored.match).toEqual(c.match);
});
it('seeded full matches remain deterministic and terminate',()=>{
 for(const seed of [1,77,301]){const a=createMatch(seed,{name:'동일',pos:'CM',a:attributes(65),energy:100}),b=structuredClone(a);finishMatch(a);finishMatch(b);expect(a).toEqual(b);expect(a.ended).toBe(true);}
});
it('real v0.15 fixture upgrades without losing its player, match or history',async()=>{
 const {readFileSync}=await import('node:fs');const {gunzipSync}=await import('node:zlib');const raw=JSON.parse(gunzipSync(Buffer.from(readFileSync(new URL('./fixtures/v9-before-v016.json.gz.b64',import.meta.url),'utf8'),'base64')).toString());
 const old=JSON.parse(raw.payload),c=decode(JSON.stringify(raw));expect(c.version).toBe(10);expect(c.player).toEqual(old.player);expect(c.match).toEqual(old.match);expect(c.history).toEqual(old.history);
});
