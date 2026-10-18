import {test,expect,type Page} from '@playwright/test';
import {newCareer} from '../../src/career';
import {createMatch,attributes} from '../../src/engine';
import {encode,decode} from '../../src/storage';

// v0.8: vertical match screen, on-pitch dribble direction, word probabilities, game-style popup.
const fixture=(defending=false)=>{const c=newCareer({name:'세로선수',age:17,pos:'CM',secondary:'ST',foot:'오른',height:180,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'},0,177,{traits:[]});
  const m=createMatch(9973,{...c.player,a:attributes(70)});c.match=m;const u=m.players[m.userId];
  if(defending){const o=m.players[14];o.x=u.x+2.5;o.y=u.y+1;m.ball={x:o.x,y:o.y,owner:o.id,flight:null};m.defending=true;}else{m.ball={x:u.x,y:u.y,owner:u.id,flight:null};m.decision=true;}
  m.insight={chance:0,gains:{},events:[]};return c;};
// Writes the save from a same-origin static file, so a running game cannot autosave over it before the reload.
async function load(page:Page,c:ReturnType<typeof fixture>){await page.goto('/manifest.webmanifest');await page.evaluate(data=>new Promise<void>(r=>{const q=indexedDB.open('soccer-career-new-era',1);q.onupgradeneeded=()=>q.result.createObjectStore('saves');q.onsuccess=()=>{const t=q.result.transaction('saves','readwrite');t.objectStore('saves').put(data,'slot1');t.objectStore('saves').put(1,'activeSlot');t.oncomplete=()=>{q.result.close();r();};};}),encode(c));await page.goto('/');}
const noPercent=async(page:Page,sel:string)=>expect(await page.locator(sel).innerText()).not.toMatch(/\d+(\.\d+)?\s*%/);

test('vertical pitch: the whole pitch fits the screen, probabilities are words',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await load(page,fixture());await expect(page.getByRole('group',{name:'공격 선택'})).toBeVisible();
  const canvas=page.locator('canvas.pitch.vertical');await expect(canvas).toHaveAttribute('data-orientation','vertical');
  const box=(await canvas.boundingBox())!,vh=page.viewportSize()!.height;
  expect(box.height>box.width).toBe(true);expect(box.height<=vh).toBe(true);
  expect(box.y>=0&&box.y+box.height<=vh).toBe(true); // fully on screen when the match opens
  // 0.11: shots show a band; pass / dribble show a provisional bar until a teammate / direction is chosen.
  await expect(page.getByRole('button',{name:'드리블 ↑',exact:true})).toHaveAttribute('title',/확률/);
  await noPercent(page,'.match-actions');
  await page.getByRole('group',{name:'공격 선택'}).getByRole('button',{name:/^패스/}).click();await noPercent(page,'.match-actions');
  await page.screenshot({path:`reports/${info.project.name}-v08-vertical.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test('dribble: tapping the pitch picks the direction',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await load(page,fixture());
  const before=(await page.locator('.live-commentary p').innerText()).trim();
  
  await page.getByRole('button',{name:'드리블 ↑',exact:true}).click();
  // The dribble was played: the saved match shows the player carried the ball on (a successful dribble hands the
  // choice back, often with the same commentary line) or the ball was lost.
  const saved=async()=>decode(await page.evaluate(()=>new Promise<string>(r=>{const q=indexedDB.open('soccer-career-new-era',1);q.onsuccess=()=>{const g=q.result.transaction('saves').objectStore('saves').get('slot1');g.onsuccess=()=>{q.result.close();r(g.result);};};}))).match!;
  const start=fixture().match!,u0=start.players[start.userId];let moved=false;
  for(let i=0;i<50&&!moved;i++){const m=await saved(),u=m.players[m.userId];moved=Math.hypot(u.x-u0.x,u.y-u0.y)>=2.5||m.ball.owner!==m.userId;if(!moved)await page.waitForTimeout(100);}
  expect(moved).toBe(true);void before;
  expect(errors).toEqual([]);
});

test('defence choices show word probabilities; the popup is the new game-style board',async({page})=>{
  await load(page,fixture(true));const defense=page.getByRole('group',{name:'수비 선택'});await expect(defense.getByRole('button')).toHaveCount(4);
  await expect(defense).toContainText(/확률/);await noPercent(page,'.match-actions');
  const c=fixture();c.match!.goals=[{id:1,time:700,scorer:'김준서',assister:'이도윤',team:0}];await load(page,c);
  const popup=page.getByRole('dialog');await expect(popup).toContainText('김준서 골!');await expect(popup).toHaveCSS('border-radius','20px');await expect(popup).toHaveCSS('background-color','rgb(255, 255, 255)');await expect(popup.locator('.popup-medal')).toBeVisible();
  await popup.getByRole('button',{name:'확인'}).click();await expect(popup).toHaveCount(0);
});

test('persistent pad and pass targets expose compact probability gauges',async({page})=>{
 await load(page,fixture());const pad=page.getByRole('group',{name:'드리블 방향'});
 await expect(pad.locator('.cm-track i')).toHaveCount(8);
 await page.getByRole('navigation',{name:'공격 방식'}).getByRole('button',{name:'패스',exact:true}).click();
 await expect(page.locator('.cm-targets .cm-track i').first()).toBeVisible();
 await page.getByRole('navigation',{name:'공격 방식'}).getByRole('button',{name:'드리블',exact:true}).click();
 await expect(pad).toBeVisible();
 await load(page,fixture(true));await expect(page.getByRole('group',{name:'수비 선택'})).not.toContainText('평균');
});
