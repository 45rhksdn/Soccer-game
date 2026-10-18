import {test,expect,type Page} from '@playwright/test';
import {newCareer} from '../../src/career';
import {attributes} from '../../src/engine';
import {generateOffers} from '../../src/world';
import {encode} from '../../src/storage';
const fixture=()=>{const c=newCareer({name:'계약선수',age:22,pos:'CM',secondary:'ST',foot:'오른',height:180,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'},0,2026,{traits:[]});c.player.a=attributes(65);c.world.phase='offseason';c.world.clubId='c18';c.world.contract={salary:500,years:3,loanAllowed:true};generateOffers(c.world,c.player,7);return c;};
async function load(page:Page){await page.goto('/manifest.webmanifest');await page.evaluate(data=>new Promise<void>(resolve=>{const q=indexedDB.open('soccer-career-new-era',1);q.onupgradeneeded=()=>q.result.createObjectStore('saves');q.onsuccess=()=>{const t=q.result.transaction('saves','readwrite');t.objectStore('saves').put(data,'slot1');t.objectStore('saves').put(1,'activeSlot');t.oncomplete=()=>{q.result.close();resolve();};};}),encode(fixture()));await page.goto('/');}
async function nav(page:Page,name:string){const b=page.getByRole('button',{name,exact:true});await b.waitFor({state:'attached'});if((page.viewportSize()?.width??1440)<=600)await page.getByRole('button',{name:'메뉴',exact:true}).click();await b.click();}
test('11 league standings; at most 6 offers with competition details; no agent planning panel',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await test.step('load and browse league',async()=>{await load(page);await nav(page,'시즌 · 리그');await expect(page.getByRole('button',{name:'독일 분데스엘프',exact:true})).toBeVisible();await page.getByRole('button',{name:'J-프라임',exact:true}).click();await expect(page.locator('table tbody tr')).toHaveCount(6);});
 console.log('league browse complete');
 await test.step('transfer desk',async()=>{await nav(page,'이적 · 계약');await expect(page.locator('.save-card').first()).toContainText('같은 포지션 경쟁자');
  // 0.9.1: the agent planning panel is gone and no more than 6 clubs bid.
  await expect(page.getByText('에이전트와 커리어 계획')).toHaveCount(0);await expect(page.getByLabel('목표 구단')).toHaveCount(0);
  const cards=await page.locator('.save-card').count();expect(cards).toBeGreaterThan(0);expect(cards).toBeLessThanOrEqual(6);});
 console.log('transfer desk checked');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({animations:'disabled',path:`reports/${info.project.name}-v09-transfer.png`,fullPage:false,timeout:10000});expect(errors).toEqual([]);
});
test('loan offers can be accepted, saved and restored without losing the parent club',async({page})=>{await load(page);await nav(page,'이적 · 계약');await page.getByRole('button',{name:'출전 기회 위한 임대 요청'}).click();await expect(page.locator('.save-card').first()).toContainText('임대 제안');page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'계약 수락',exact:true}).first().click();await expect(page.getByRole('heading',{name:'임대 중',exact:true})).toBeVisible();await expect(page.getByText('맨체스터 스카이블루에서 임대',{exact:false})).toBeVisible();await expect(page.locator('.save-state')).toContainText('저장 완료');await page.reload();await nav(page,'이적 · 계약');await expect(page.getByRole('heading',{name:'임대 중',exact:true})).toBeVisible();});
