import {test,expect,type Page} from '@playwright/test';
import {newCareer} from '../../src/career';
import {createMatch,attributes} from '../../src/engine';
import {encode} from '../../src/storage';

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
  await expect(page.locator('.match-actions')).toContainText(/(매우 낮은|낮은|중간|높은|매우 높은) 확률|동료 선택|방향 선택/);
  await noPercent(page,'.match-actions');
  await page.getByRole('group',{name:'공격 선택'}).getByRole('button',{name:/^패스/}).click();await noPercent(page,'.match-actions');
  await page.screenshot({path:`reports/${info.project.name}-v08-vertical.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test('dribble: tapping the pitch picks the direction',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await load(page,fixture());
  const before=(await page.locator('.live-commentary p').innerText()).trim();
  await page.getByRole('group',{name:'공격 선택'}).getByRole('button',{name:/드리블/}).click();
  await expect(page.locator('.pitch-hint')).toContainText('드리블 방향');await noPercent(page,'.match-actions');
  const canvas=page.locator('canvas.pitch.vertical'),box=(await canvas.boundingBox())!;
  await canvas.click({position:{x:box.width/2,y:8}}); // toward the goal we attack (top)
  await expect(page.locator('.pitch-hint')).toHaveCount(0);
  // The dribble was played: the commentary moved on (new attack choice after a successful dribble, or a turnover).
  await expect(page.locator('.live-commentary p')).not.toHaveText(before);
  expect(errors).toEqual([]);
});

test('defence choices show word probabilities; the popup is the new game-style board',async({page})=>{
  await load(page,fixture(true));const defense=page.getByRole('group',{name:'수비 선택'});await expect(defense.getByRole('button')).toHaveCount(4);
  await expect(defense).toContainText(/확률/);await noPercent(page,'.match-actions');
  const c=fixture();c.match!.goals=[{id:1,time:700,scorer:'김준서',assister:'이도윤',team:0}];await load(page,c);
  const popup=page.getByRole('dialog');await expect(popup).toContainText('김준서 골!');await expect(popup).toHaveCSS('border-radius','10px');
  await popup.getByRole('button',{name:'확인'}).click();await expect(popup).toHaveCount(0);
});
