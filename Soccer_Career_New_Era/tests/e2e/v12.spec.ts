import {test,expect,type Page} from '@playwright/test';
import {newCareer} from '../../src/career';
import {createMatch,attributes,direction} from '../../src/engine';
import {encode} from '../../src/storage';

// v0.12 dribble pad: 짧은 드리블 / 치고 달리기, the open-path and pace reasons, and a knock-on actually played.
const base=()=>newCareer({name:'질주선수',age:17,pos:'ST',secondary:'LW',foot:'오른',height:180,weight:72,style:'플레이메이커',curve:'꾸준한 성장형'},0,177,{traits:[]});
async function load(page:Page,c:ReturnType<typeof base>){await page.goto('/manifest.webmanifest');await page.evaluate(data=>new Promise<void>(r=>{const q=indexedDB.open('soccer-career-new-era',1);q.onupgradeneeded=()=>q.result.createObjectStore('saves');q.onsuccess=()=>{const t=q.result.transaction('saves','readwrite');t.objectStore('saves').put(data,'slot1');t.objectStore('saves').put(1,'activeSlot');t.oncomplete=()=>{q.result.close();r();};};}),encode(c));await page.goto('/');}
function setup(defending=false,opp:{dx:number,dy:number}[]=[{dx:3,dy:0}]){
  const c=base(),m=createMatch(9973,{...c.player,a:attributes(60)});c.match=m;m.insight={chance:0,gains:{},events:[]};const d=direction(m,0),X=(x:number)=>d>0?x:105-x;
  for(const p of m.players){p.x=X(p.team?96:10);p.y=p.team?6:62;}
  const u=m.players[m.userId];u.x=X(60);u.y=34;
  const field=m.players.filter(p=>p.team===1&&p.pos!=='GK');opp.forEach((o,i)=>{field[i].x=X(60+o.dx);field[i].y=34+o.dy;});
  const mates=m.players.filter(p=>p.team===0&&p.id!==u.id&&p.pos!=='GK');mates[0].x=X(66);mates[0].y=24;mates[1].x=X(58);mates[1].y=46;
  if(defending){m.ball={x:field[0].x,y:field[0].y,owner:field[0].id,flight:null};m.defending=true;m.decision=false;}else{m.ball={x:u.x,y:u.y,owner:u.id,flight:null};m.decision=true;}
  return c;
}
test('run mode retains pace reasons and stays selected across tab changes',async({page})=>{
 const c=setup(false,[{dx:-2,dy:0}]);const u=c.match!.players[c.match!.userId];u.a={...u.a,speed:90,acceleration:90};await load(page,c);
 const mode=page.getByRole('group',{name:'드리블 방식'});await mode.getByRole('button',{name:'치고 달리기',exact:true}).click();
 await expect(page.getByRole('button',{name:'치고 달리기 ↑',exact:true})).toHaveAttribute('title',/속도 우위/);
 await expect(mode.getByRole('button',{name:'치고 달리기',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('an open route retains the engine reason',async({page})=>{
 await load(page,setup(false,[{dx:20,dy:10}]));await expect(page.getByRole('button',{name:'드리블 ↑',exact:true})).toHaveAttribute('title',/진행 방향 공간 열림/);
});
