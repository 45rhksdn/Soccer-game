import {test,expect,type Page} from '@playwright/test';
import {newCareer} from '../../src/career';
import {createMatch,attributes,direction} from '../../src/engine';
import {encode} from '../../src/storage';

// v0.11 matchup odds on the live screen: 상대와의 거리, reasons, provisional bars before a target/direction.
const base=()=>newCareer({name:'대결선수',age:17,pos:'ST',secondary:'LW',foot:'오른',height:180,weight:72,style:'플레이메이커',curve:'꾸준한 성장형'},0,177,{traits:[]});
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
test('relative distance and per-direction odds survive the compact UI',async({page})=>{
 await load(page,setup(false,[{dx:3,dy:0},{dx:2,dy:4}]));
 await expect(page.locator('.cm-distance')).toContainText('상대와의 거리 3.0m');
 await expect(page.locator('.cm-distance')).toContainText('주변 상대 2명');
 await page.getByLabel('성공률 안내').click();await expect(page.locator('.cm-distance')).toContainText('능력 차이가 성공률');
 const up=await page.getByRole('button',{name:'드리블 ↑',exact:true}).getAttribute('title'),down=await page.getByRole('button',{name:'드리블 ↓',exact:true}).getAttribute('title');expect(up).not.toBe(down);
 await load(page,setup(true,[{dx:2.5,dy:0}]));await expect(page.locator('.cm-distance')).toContainText('상대와의 거리 2.5m');
 await expect(page.getByRole('group',{name:'수비 선택'}).getByRole('button').first()).toHaveAttribute('title',/.+/);
});
