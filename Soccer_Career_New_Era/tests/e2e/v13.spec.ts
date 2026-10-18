import {test,expect,type Page} from '@playwright/test';
import {newCareer} from '../../src/career';
import {createMatch,attributes,direction} from '../../src/engine';
import {encode,decode} from '../../src/storage';

// v0.13 an unmarked chance reads as a real chance; a dribble plays out in time with everyone moving.
const base=()=>newCareer({name:'마무리선수',age:17,pos:'ST',secondary:'LW',foot:'오른',height:180,weight:72,style:'플레이메이커',curve:'꾸준한 성장형'},0,177,{traits:[]});
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
const saved=async(page:Page)=>decode(await page.evaluate(()=>new Promise<string>(r=>{const q=indexedDB.open('soccer-career-new-era',1);q.onsuccess=()=>{const g=q.result.transaction('saves').objectStore('saves').get('slot1');g.onsuccess=()=>{q.result.close();r(g.result);};};}))).match!;

test('an unmarked shot from 8 m reads as a real chance (중간 or better)',async({page})=>{
  const c=setup(false,[{dx:-25,dy:20}]);const m=c.match!,u=m.players[m.userId],d=direction(m,0);u.x=d>0?97:8;u.y=34;u.a={...u.a,shooting:70,finishing:70};
  m.ball={x:u.x,y:u.y,owner:u.id,flight:null};
  for(const p of m.players)if(p.team===1&&p.pos!=='GK'&&Math.hypot(p.x-u.x,p.y-u.y)<9){p.x=d>0?60:45;}
  await load(page,c);
  const tile=page.getByRole('group',{name:'공격 선택'}).getByRole('button',{name:/근거리 슛|슈팅/}).first();
  await expect(tile).toContainText(/(중간|높은|매우 높은) 확률/);
});

test('a successful dribble takes a few seconds: the clock runs and teammates and opponents move',async({page})=>{
  const c=setup(false,[{dx:8,dy:10}]);const m0=structuredClone(c.match!);await load(page,c);
  await page.getByRole('group',{name:'공격 선택'}).getByRole('button',{name:/드리블/}).click();
  await page.getByRole('group',{name:'드리블 방향'}).getByRole('button',{name:'드리블 ↑',exact:true}).click();
  let m=await saved(page);for(let i=0;i<50&&m.clock===m0.clock&&m.ball.owner===m0.ball.owner;i++){await page.waitForTimeout(100);m=await saved(page);}
  if(m.ball.owner===m.userId){
    expect(m.clock).toBeGreaterThan(m0.clock);
    const moved=(team:number)=>m.players.filter(p=>p.team===team&&p.id!==m.userId&&Math.hypot(p.x-m0.players[p.id].x,p.y-m0.players[p.id].y)>.3).length;
    expect(moved(0)).toBeGreaterThan(3);expect(moved(1)).toBeGreaterThan(3);
    await expect(page.getByRole('group',{name:'공격 선택'})).toBeVisible();
  }else expect(m.players[m.ball.owner!].team).toBe(1);
});
