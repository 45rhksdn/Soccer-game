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

test('compact pad is ready immediately, warns about route defenders and preserves engine odds',async({page})=>{
 const c=setup(false,[{dx:3,dy:0}]);await load(page,c);
 const pad=page.getByRole('group',{name:'드리블 방향'});
 await expect(pad).toBeVisible();
 await expect(pad.getByRole('button',{name:'드리블 ↑',exact:true})).toContainText('!');
 expect(await pad.getByRole('button').count()).toBe(8);
 await expect(page.locator('.live-commentary')).toBeVisible();
 await expect(page.getByRole('button',{name:'볼 지키기',exact:true})).toHaveCount(0);
 const before=await saved(page);
 await page.getByRole('button',{name:'치고 달리기',exact:true}).click();
 await expect(pad.getByRole('button',{name:'치고 달리기 ↑',exact:true})).toBeVisible();
 expect((await saved(page)).seed).toBe(before.seed);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.match-board').screenshot({path:`reports/compact-${test.info().project.name}-dribble.png`});
});

test('pass selects a teammate without executing and confirms the selected recipient',async({page})=>{
 const c=setup();await load(page,c);const before=await saved(page);
 await page.getByRole('navigation',{name:'공격 방식'}).getByRole('button',{name:'패스',exact:true}).click();
 const targets=page.getByRole('group',{name:'패스 받을 동료'});
 const btn=targets.getByRole('button').filter({hasText:/마무리선수/});
 const first=targets.locator('button:not(:disabled)').first();await first.click();
 await expect(first).toHaveAttribute('aria-pressed','true');
 expect((await saved(page)).seed).toBe(before.seed);
 await page.locator('.match-board').screenshot({path:`reports/compact-${test.info().project.name}-pass.png`});
 await page.getByRole('button',{name:/에게 패스하기/}).click();
 await expect.poll(async()=> (await saved(page)).seed).not.toBe(before.seed);
});

test('shots expose allowed options and require confirmation',async({page})=>{
 const c=setup(false,[{dx:-25,dy:20}]);const m=c.match!,u=m.players[m.userId];u.x=direction(m,0)>0?97:8;m.ball.x=u.x;
 await load(page,c);const before=await saved(page);
 await page.getByRole('navigation',{name:'공격 방식'}).getByRole('button',{name:'슛',exact:true}).click();
 await page.getByRole('group',{name:'슛 종류'}).getByRole('button',{name:/근거리 슛/}).click();
 expect((await saved(page)).seed).toBe(before.seed);
 await page.locator('.match-board').screenshot({path:`reports/compact-${test.info().project.name}-shot.png`});
 await page.getByRole('button',{name:'근거리 슛 실행',exact:true}).click();
 await expect.poll(async()=> (await saved(page)).seed).not.toBe(before.seed);
});

test('defense still offers all four actions and dribbling executes without an extra mode click',async({page})=>{
 await load(page,setup(true));await expect(page.getByRole('group',{name:'수비 선택'}).getByRole('button')).toHaveCount(4);
 const c=setup(false,[{dx:-25,dy:20}]);c.match!.players[c.match!.userId].a=attributes(99);await load(page,c);const before=await saved(page);
 await page.getByRole('button',{name:'드리블 ↑',exact:true}).click();
 await expect.poll(async()=> (await saved(page)).clock).toBeGreaterThan(before.clock);
 const after=await saved(page);
 if(after.ball.owner===after.userId)await expect(page.getByRole('group',{name:'드리블 방향'})).toBeVisible();
});
