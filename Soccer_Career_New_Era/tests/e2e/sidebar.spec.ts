import {test,expect,type Page} from '@playwright/test';
import {newCareer} from '../../src/career';
import {createMatch,attributes,direction} from '../../src/engine';
import {encode,decode} from '../../src/storage';

// v0.14 an unmarked chance reads as a real chance; a dribble plays out in time with everyone moving.
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

test('pitch-side controls and direct teammate touch show actual pass distance and band',async({page})=>{
 const c=setup();await load(page,c);const m=c.match!,q=m.players.filter(p=>p.team===0&&p.id!==m.userId&&p.pos!=='GK')[0],d=direction(m,0);
 const canvas=page.locator('canvas.pitch.vertical'),box=(await canvas.boundingBox())!,s=590/68;
 await canvas.click({position:{x:(30+(d>0?q.y:68-q.y)*s)/650*box.width,y:((1000-105*s)/2+(d>0?105-q.x:q.x)*s)/1000*box.height}});
 const card=page.locator('.cm-pass-card');await expect(card).toContainText(q.name);await expect(card).toContainText(/거리 \d+\.\d+m · 성공 (높음|보통|낮음)/);
 const side=(await page.locator('.match-side').boundingBox())!;expect(side.x).toBeGreaterThanOrEqual(box.x+box.width-2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.match-board').screenshot({path:`reports/sidebar-${test.info().project.name}.png`});
 const before=await saved(page);await card.getByRole('button',{name:'패스하기',exact:true}).click();await expect.poll(async()=>(await saved(page)).seed).not.toBe(before.seed);
});
test('location actions remain visible but unavailable shots are grey and disabled; valid shot executes immediately',async({page})=>{
 const c=setup();await load(page,c);await expect(page.getByRole('button',{name:'근거리 슛',exact:true})).toBeDisabled();
 const m=c.match!,u=m.players[m.userId];u.x=direction(m,0)>0?97:8;m.ball.x=u.x;await load(page,c);const before=await saved(page);
 await page.getByRole('button',{name:'근거리 슛',exact:true}).click();await expect.poll(async()=>(await saved(page)).seed).not.toBe(before.seed);
});
test('dribble animates for distance-based time and blocks repeated input',async({page})=>{
 const c=setup(false,[{dx:-25,dy:20}]);c.match!.players[c.match!.userId].a=attributes(99);await load(page,c);
 await page.getByRole('button',{name:'드리블 ↑',exact:true}).click();await expect(page.locator('.match-side')).toHaveAttribute('inert','');
 const first=await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL());await page.waitForTimeout(400);const next=await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL());expect(next).not.toBe(first);
 await expect(page.locator('.match-side')).not.toHaveAttribute('inert','',{timeout:30000});
});
test('today includes league table and tournament board',async({page})=>{
 const c=base();await load(page,c);await expect(page.getByRole('heading',{name:'리그 순위표',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'토너먼트 현황판',exact:true})).toBeVisible();expect(await page.locator('.today-competitions tbody tr').count()).toBeGreaterThan(0);
});
