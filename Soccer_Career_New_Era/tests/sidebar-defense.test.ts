import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {createMatch,attributes,direction,emptyStats,recordTackle,defensiveRating,act,defend,carryPace} from '../src/engine';
import {newCareer} from '../src/career';
import {TodayPanel} from '../src/TodayPanel';
import {encode,decode} from '../src/storage';
const career=()=>newCareer({name:'수비테스트',age:17,pos:'CB',secondary:'LB',foot:'오른',height:180,weight:75,style:'플레이메이커',curve:'꾸준한 성장형'},0,177,{traits:[]});
it('critical defense is exactly three interceptions before caps; ordinary defensive reward slightly higher',()=>{
 const m=createMatch(1,{name:'수비',pos:'CB',a:attributes(70),energy:100}),p=m.players[m.userId];p.stats=emptyStats();p.stats.interceptions=1;const ordinary=defensiveRating(p);expect(ordinary).toBe(.085);
 p.stats.interceptions=0;p.stats.tackles=1;p.stats.decisiveDefenses=1;expect(defensiveRating(p)).toBeCloseTo(3*ordinary);
});
it('only a won tackle in own box is critical, including reversed ends',()=>{
 for(const half of [1,2] as const){const m=createMatch(9,{name:'수비',pos:'CB',a:attributes(99),energy:100});m.half=half;const p=m.players[m.userId],o=m.players.find(q=>q.team!==p.team)!;const goal=direction(m,p.team)>0?0:105;o.x=goal===0?10:95;o.y=34;recordTackle(m,p,o);expect(p.stats.decisiveDefenses).toBe(1);o.y=5;recordTackle(m,p,o);o.x=goal===0?95:10;o.y=34;recordTackle(m,p,o);expect(p.stats.decisiveDefenses).toBe(1);expect(p.stats.tackles).toBe(3);}
});
it('standing and sliding successes record critical defenses and survive saves',()=>{
 for(const action of ['tackle','slide'] as const){let found=false;for(let seed=1;seed<30&&!found;seed++){const c=career(),m=createMatch(seed,{...c.player,a:attributes(99)});c.match=m;const p=m.players[m.userId],o=m.players.find(q=>q.team!==p.team&&q.pos!=='GK')!;p.x=direction(m,p.team)>0?8:97;p.y=34;o.x=p.x+.1;o.y=34;o.a=attributes(20);m.ball={x:o.x,y:o.y,owner:o.id,flight:null};m.defending=true;m.decision=false;defend(m,action);if(m.ball.owner===p.id){found=true;expect(p.stats.decisiveDefenses).toBe(1);expect(p.stats.duelAttempts).toBe(1);expect(decode(encode(c)).match!.players[m.userId].stats.decisiveDefenses).toBe(1);}}expect(found).toBe(true);}
});
it('long dribbles no longer compress distance into eight slices or teleport at half time',()=>{
 const m=createMatch(1,{name:'달리기',pos:'ST',a:attributes(99),energy:100}),p=m.players[m.userId],d=direction(m,p.team);p.x=52;p.y=34;for(const q of m.players)if(q.id!==p.id){q.x=10;q.y=2;}m.ball={x:p.x,y:p.y,owner:p.id,flight:null};m.decision=true;const before=structuredClone(m);act(m,'dribble',{vector:{x:d,y:0}});if(m.ball.owner===p.id){const metres=Math.abs(p.x-52),seconds=(m.clock-before.clock)/6;/* 0.15.2: carriers move 3× faster (CARRY.speed), still bounded by pace × time */const pace=carryPace(before.players[before.userId]);expect(metres/seconds).toBeLessThanOrEqual(pace+1e-9);expect(metres/seconds).toBeGreaterThan(pace/3);}
 const edge=structuredClone(before);edge.clock=2699;act(edge,'dribble',{vector:{x:d,y:0}});expect(edge.players[edge.userId].x).toBe(52);
});
it('today hides the lucky result while showing real league and tournament panels',()=>{
 const c=career();const html=renderToStaticMarkup(createElement(TodayPanel,{c,last:{day:0,type:'shooting',text:'럭키! ×10',lucky:true,gain:2,weekDone:false},onTrain:()=>{},onMatch:()=>{}}));expect(html).not.toContain('럭키');expect(html).not.toContain('today-result');expect(html).toContain('리그 순위표');expect(html).toContain('토너먼트 현황판');
});
