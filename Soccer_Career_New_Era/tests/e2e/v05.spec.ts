import {test,expect,type Page} from '@playwright/test';
import {random} from '../../src/engine';
import {newCareer,nextSeason} from '../../src/career';
import {encode} from '../../src/storage';

// v0.5: 럭키 popup and private news, equipment, slot delete, account-wide retirement reward.
test.beforeEach(async({page})=>{await page.addLocatorHandler(page.locator('.growth-popup.insight, .growth-popup.goal'),async()=>{await page.locator('.growth-popup').getByRole('button',{name:'확인'}).click();});});
async function nav(page:Page,name:string){if((page.viewportSize()?.width??1440)<900)await page.getByRole('button',{name:'메뉴',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();}
async function create(page:Page,name='테스트선수'){await page.goto('/');await page.getByRole('button',{name:'새로운 커리어 시작'}).click();await page.getByRole('tab',{name:'직접 만들기'}).click();await page.getByLabel('선수 이름').fill(name);await page.getByLabel('입학 나이').selectOption('16');await page.getByLabel('주 포지션',{exact:true}).selectOption('ST');await page.getByRole('button',{name:'입단하고 커리어 시작'}).click();await expect(page.locator('.save-state')).toHaveText('저장 완료');}
/** Runs `fn(store)` against the game's IndexedDB from a same-origin static file, so the app cannot autosave over it. */
async function editDb(page:Page,script:string,arg:unknown){
  await page.goto('/manifest.webmanifest');
  const out=await page.evaluate(([script,arg])=>new Promise<unknown>((resolve,reject)=>{const q=indexedDB.open('soccer-career-new-era',1);q.onupgradeneeded=()=>q.result.createObjectStore('saves');q.onsuccess=()=>{const t=q.result.transaction('saves','readwrite');const store=t.objectStore('saves');const result:{v?:unknown}={};
    // eslint-disable-next-line no-new-func
    new Function('store','arg','result',script)(store,arg,result);t.oncomplete=()=>{q.result.close();resolve(result.v);};t.onerror=()=>reject(t.error);};}),[script,arg] as const);
  return out;
}
const fnv=`const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16);};`;
const dbKeys=(page:Page)=>page.evaluate(()=>new Promise<string[]>(resolve=>{const q=indexedDB.open('soccer-career-new-era');q.onsuccess=()=>{const r=q.result.transaction('saves').objectStore('saves').getAllKeys();r.onsuccess=()=>{q.result.close();resolve((r.result as string[]).map(String).sort());};};}));

test('럭키 opens a popup; the news hides the stat and amount while the growth note keeps it',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await create(page);
  // Pick an RNG state whose next draw is a 럭키 for a 16-year-old (4.5 %), then put it into the saved career.
  let seed=0;for(;;seed++)if(random({seed})<.04)break;
  await editDb(page,`${fnv}const r=store.get('slot1');r.onsuccess=()=>{const env=JSON.parse(r.result);const c=JSON.parse(env.payload);c.seed=arg;c.development.traits=[];const payload=JSON.stringify(c);store.put(JSON.stringify({format:'SCNE',checksum:fnv(payload),payload}),'slot1');};`,seed);
  await page.goto('/');await nav(page,'오늘의 일정');
  await page.getByRole('button',{name:'오늘 패스훈련'}).click();
  const popup=page.getByRole('dialog');await expect(popup).toBeVisible();await expect(popup).toContainText('놀라운 성장!');await expect(popup).toContainText('훈련 중 무언가를 느꼈다!');
  await page.screenshot({path:`reports/${info.project.name}-lucky-popup.png`});
  await popup.getByRole('button',{name:'확인'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.today-result')).toContainText('럭키! ×10 · 패스훈련 · OVR +');
  await nav(page,'커리어 홈');const headlines=page.locator('.headline-news');await expect(headlines).toContainText('훈련 중 무언가를 느꼈다!');
  // The news line is exactly the private text: no stat name, no amount.
  expect((await headlines.locator('p',{hasText:'무언가를'}).first().innerText()).trim()).toBe('훈련 중 무언가를 느꼈다!');
  expect(errors).toEqual([]);
});

test('equipment: buy, equip, swap, unequip; base attributes unchanged and saved across reload',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await create(page);await nav(page,'내 선수');
  const speed=async()=>(await page.locator('.attribute',{hasText:'스피드'}).locator('b').innerText()).trim();
  const base=await speed();
  await page.getByRole('button',{name:'스피드 축구화 구매'}).click();await page.getByRole('button',{name:'스피드 축구화 장착'}).click();
  await expect(page.locator('.equip-slot').first()).toContainText('스피드 축구화');expect(await speed()).toBe(`${base} +2`);
  await page.getByRole('button',{name:'터치 축구화 구매'}).click();await page.getByRole('button',{name:'터치 축구화 장착'}).click();
  await expect(page.locator('.equip-slot').first()).toContainText('터치 축구화');expect(await speed()).toBe(base);
  await expect(page.locator('.equipment .section-title')).toContainText('잔액 20만원');
  await page.screenshot({path:`reports/${info.project.name}-equipment.png`,fullPage:true});
  await expect(page.locator('.save-state')).toHaveText('저장 완료');await page.waitForTimeout(5500);await page.reload();await nav(page,'내 선수');
  await expect(page.locator('.equip-slot').first()).toContainText('터치 축구화');
  await page.getByRole('button',{name:'축구화 해제'}).click();await expect(page.locator('.equip-slot').first()).toContainText('없음');expect(await speed()).toBe(base);
  await expect(page.getByRole('button',{name:'스피드 축구화 장착'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test('slot delete: removes only that player and its backup; the archive and other slots stay',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await create(page,'첫선수');
  await nav(page,'선수 변경하기');await page.locator('.player-slot').nth(1).getByRole('button',{name:'새 선수 시작'}).click();
  await page.getByRole('tab',{name:'직접 만들기'}).click();await page.getByLabel('선수 이름').fill('둘째선수');await page.getByRole('button',{name:'입단하고 커리어 시작'}).click();
  await expect(page.locator('.save-state')).toHaveText('저장 완료');
  await nav(page,'선수 변경하기');await page.locator('.player-slot').nth(1).getByRole('button',{name:'이 슬롯에 새 선수 시작'}).click();
  await page.getByRole('tab',{name:'직접 만들기'}).click();await page.getByLabel('선수 이름').fill('셋째선수');await page.getByRole('button',{name:'입단하고 커리어 시작'}).click();
  await expect.poll(async()=>(await dbKeys(page)).includes('archive2')).toBe(true);
  // Delete the slot-1 player (not active).
  await nav(page,'선수 변경하기');await page.getByRole('button',{name:'슬롯 1 첫선수 선수 삭제'}).click();
  await expect(page.getByRole('status')).toContainText('삭제했습니다');await expect(page.locator('.player-slot').nth(0)).toContainText('빈 슬롯');
  await expect(page.locator('.player-slot').nth(1)).toContainText('셋째선수');
  let keys=await dbKeys(page);expect(keys.includes('slot1')).toBe(false);expect(keys.includes('backup1')).toBe(false);expect(keys.includes('slot2')).toBe(true);expect(keys.includes('archive2')).toBe(true);
  // Delete the active player: the archived player can still be restored afterwards.
  await page.getByRole('button',{name:'슬롯 2 셋째선수 선수 삭제'}).click();
  await expect(page.getByRole('status')).toContainText('삭제했습니다');
  await page.waitForTimeout(6000);keys=await dbKeys(page);expect(keys.includes('slot2')).toBe(false);expect(keys.includes('archive2')).toBe(true);
  await page.goto('/');await expect(page.getByRole('button',{name:'새로운 커리어 시작'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('retirement reward: shared by all slots, granted once even after reloads, restores and switching',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await create(page,'현역선수');
  // A retired career built with the game's own code, written into slot 2.
  const c=newCareer({name:'은퇴선수',age:16,pos:'ST',secondary:'LW',foot:'오른',height:180,weight:72,style:'테크니션',curve:'꾸준한 성장형'},1,99,{id:'e2e-retired'});
  c.player.age=35;c.world.phase='offseason';c.world.contract.years=1;c.world.clubId=c.world.clubs.find(x=>x.league>0)!.id;nextSeason(c);
  const save=encode(c);
  await editDb(page,`store.put(arg,'slot2');store.put(arg,'archive3');`,save);
  await page.goto('/');await nav(page,'선수 변경하기');
  await expect(page.locator('.legacy')).toContainText('은퇴한 선수 0명');
  await page.locator('.player-slot').nth(1).getByRole('button',{name:'이 선수로 전환'}).click();
  await expect(page.getByRole('status')).toContainText('은퇴 누적 보상');
  await nav(page,'선수 변경하기');await expect(page.locator('.legacy')).toContainText('은퇴한 선수 1명 · 새 선수 후보의 잠재력 최대 상한 +1');
  // Switch away and back, reload, and restore the same player from the slot-3 archive: still one reward.
  await page.locator('.player-slot').nth(0).getByRole('button',{name:'이 선수로 전환'}).click();
  await nav(page,'선수 변경하기');await page.locator('.player-slot').nth(1).getByRole('button',{name:'이 선수로 전환'}).click();
  await page.reload();await nav(page,'선수 변경하기');
  page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'교체 전 선수 복원 · 은퇴선수'}).click();
  await expect(page.getByRole('status')).toContainText('교체 전 선수를 복원했습니다');
  await page.waitForTimeout(1500);await nav(page,'선수 변경하기');await expect(page.locator('.legacy')).toContainText('은퇴한 선수 1명');
  const legacy=await page.evaluate(()=>new Promise<unknown>(resolve=>{const q=indexedDB.open('soccer-career-new-era');q.onsuccess=()=>{const r=q.result.transaction('saves').objectStore('saves').get('legacy');r.onsuccess=()=>{q.result.close();resolve(r.result);};};})) as {retired:{id:string}[]};
  expect(legacy.retired.map(x=>x.id).join(',')).toBe('e2e-retired');
  expect(errors).toEqual([]);
});
