import {test,expect,type Page} from '@playwright/test';
import {newCareer} from '../../src/career';
import {attributes,createMatch,direction} from '../../src/engine';
import {encode,decode} from '../../src/storage';
import {moment} from '../../src/careerMoments';
const base=()=>newCareer({name:'연결선수',age:17,pos:'CM',secondary:'ST',foot:'오른',height:180,weight:72,style:'플레이메이커',curve:'꾸준한 성장형'},0,701,{traits:[]});
async function load(page:Page,c:ReturnType<typeof base>){await page.goto('/manifest.webmanifest');await page.evaluate(data=>new Promise<void>(r=>{const q=indexedDB.open('soccer-career-new-era',1);q.onupgradeneeded=()=>q.result.createObjectStore('saves');q.onsuccess=()=>{const t=q.result.transaction('saves','readwrite');t.objectStore('saves').put(data,'slot1');t.objectStore('saves').put(1,'activeSlot');t.oncomplete=()=>{q.result.close();r();};};}),encode(c));await page.goto('/');}
const saved=async(page:Page)=>decode(await page.evaluate(()=>new Promise<string>(r=>{const q=indexedDB.open('soccer-career-new-era',1);q.onsuccess=()=>{const g=q.result.transaction('saves').objectStore('saves').get('slot1');g.onsuccess=()=>{q.result.close();r(g.result);};};})));
test('teammate touch offers a direct through pass with a space preview and persists the action',async({page})=>{
 const c=base(),m=createMatch(701,{...c.player,a:attributes(80)});c.match=m;m.insight={chance:0,gains:{},events:[]};
 const d=direction(m,0),X=(x:number)=>d>0?x:105-x;for(const p of m.players){p.x=X(p.team?94:20);p.y=p.team?4:60;}
 const u=m.players[m.userId],q=m.players.find(p=>p.team===0&&p.pos==='ST')!;u.x=X(55);u.y=34;q.x=X(68);q.y=34;
 m.ball={owner:u.id,x:u.x,y:u.y,flight:null};m.decision=true;await load(page,c);
 await page.getByRole('button',{name:new RegExp(`패스 · #${q.number} ${q.name}`)}).click();
 const card=page.locator('.cm-pass-card');await expect(card.getByRole('button',{name:/스루패스/})).toBeEnabled();await expect(card).toContainText('침투');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.match-board').screenshot({path:`reports/living-${test.info().project.name}.png`});
 await card.getByRole('button',{name:/스루패스/}).click();
 await expect.poll(async()=>((await saved(page)).match?.players[u.id].stats.passes??0)).toBeGreaterThan(0);
 await page.reload();await expect(page.locator('.match-board')).toBeVisible();
});
test('career connections stay collapsed and survive reload without crowding the home page',async({page})=>{
 const c=base();moment(c,'test-reunion','라이벌과 전국대회에서 다시 만났습니다.','rival');await load(page,c);
 // Use the existing navigation, not an additional home widget.
 await page.getByRole('button',{name:/팀 · 주전 경쟁/}).first().click();
 const detail=page.locator('.career-context');await expect(detail).toBeVisible();await expect(detail).not.toHaveAttribute('open','');
 await detail.locator('summary').click();await expect(detail).toContainText('라이벌과 전국대회');
 await page.reload();expect((await saved(page)).connections?.events[0].key).toBe('test-reunion');
});
