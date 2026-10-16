import {test,expect,type Page} from '@playwright/test';
async function nav(page:Page,name:string){if((page.viewportSize()?.width??1440)<900)await page.getByRole('button',{name:'메뉴',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();}
async function create(page:Page,age='16'){await page.goto('/');await page.getByRole('button',{name:'새로운 커리어 시작'}).click();await page.getByLabel('선수 이름').fill('테스트선수');await page.getByLabel('입학 나이').selectOption(age);await page.getByLabel('주 포지션',{exact:true}).selectOption('ST');await page.getByRole('button',{name:'입단하고 커리어 시작'}).click();}
async function playWeek(page:Page){await page.getByRole('button',{name:'이번주 일정 진행',exact:true}).click();await page.getByRole('button',{name:'7일 일정 확정 · 진행'}).click();await page.getByRole('button',{name:'빠른 시뮬레이션'}).click();await page.getByRole('button',{name:'결과 반영 · 남은 일정 진행'}).click();}
test('weekly plan → live action → growth/rival → reload → remembered plan → slots and file restore',async({page},info)=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await create(page);
 await expect(page.getByRole('heading',{name:'지난주 주요 뉴스'})).toBeVisible();await expect(page.getByText(/주요 특성/).first()).toBeVisible();
 await page.getByRole('button',{name:'이번주 일정 진행',exact:true}).click();await page.getByLabel('월요일 일정').selectOption('passing');await page.getByLabel('일요일 일정').selectOption('vacation');
 await page.screenshot({path:`reports/${info.project.name}-weekly.png`,fullPage:true});
 await page.getByRole('button',{name:'7일 일정 확정 · 진행'}).click();await page.getByRole('button',{name:'12×',exact:true}).click();
 await expect(page.getByRole('heading',{name:'당신의 차례입니다.'})).toBeVisible({timeout:20000});
 await page.getByRole('button',{name:'1×',exact:true}).click();
 const before=await page.locator('canvas').evaluate((n:HTMLCanvasElement)=>n.toDataURL());await page.getByRole('button',{name:'일시정지',exact:true}).click();await page.getByRole('button',{name:/안전한 패스/}).click();await expect(page.getByRole('heading',{name:'다음 기회를 준비하세요.'})).toBeVisible();await page.getByRole('button',{name:'계속',exact:true}).click();await expect.poll(()=>page.locator('canvas').evaluate((n:HTMLCanvasElement)=>n.toDataURL())).not.toBe(before);
 await page.getByRole('button',{name:'빠른 시뮬레이션'}).click();await page.getByRole('button',{name:'결과 반영 · 남은 일정 진행'}).click();await expect(page.locator('.page-heading')).toContainText('WEEK 02');await expect(page.getByRole('heading',{name:'이번주 성장노트'})).toBeVisible();await expect(page.locator('.save-state')).toHaveText('저장 완료');
 await nav(page,'라이벌');await expect(page.getByRole('heading',{name:/평생의 라이벌/})).toBeVisible();await expect(page.getByRole('heading',{name:'라이벌 최근 경기'})).toBeVisible();await page.screenshot({path:`reports/${info.project.name}-rival.png`,fullPage:true});
 await page.reload();await page.getByRole('button',{name:'이번주 일정 진행',exact:true}).click();await expect(page.getByLabel('월요일 일정')).toHaveValue('passing');await expect(page.getByLabel('일요일 일정')).toHaveValue('vacation');
 await page.getByRole('button',{name:'7일 일정 확정 · 진행'}).click();await expect(page.locator('.save-state')).toHaveText('저장 완료');await page.reload();await expect(page.locator('canvas')).toBeVisible();await page.getByRole('button',{name:'빠른 시뮬레이션'}).click();await page.getByRole('button',{name:'결과 반영 · 남은 일정 진행'}).click();await expect(page.locator('.page-heading')).toContainText('WEEK 03');
 await nav(page,'저장 관리');await page.locator('.save-card').nth(1).getByRole('button',{name:'여기에 저장'}).click();await expect(page.locator('.save-card').nth(1)).toContainText('현재 슬롯');const download=page.waitForEvent('download');await page.getByRole('button',{name:'내보내기',exact:true}).click();await(await download).saveAs(`reports/${info.project.name}-save.json`);await page.reload();await nav(page,'저장 관리');await expect(page.locator('.save-card').nth(1)).toContainText('현재 슬롯');page.on('dialog',d=>d.accept());await page.locator('input[type=file]').setInputFiles(`reports/${info.project.name}-save.json`);await expect(page.getByRole('status')).toContainText('저장 파일을 가져왔습니다.');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('production PWA runs weekly training and match offline',async({page,context})=>{test.skip(!process.env.PWA_TEST);await create(page);await expect(page.locator('.save-state')).toHaveText('저장 완료');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);await context.setOffline(true);await page.reload();await playWeek(page);await expect(page.locator('.page-heading')).toContainText('WEEK 02');await expect(page.locator('.save-state')).toHaveText('저장 완료');await page.reload();await expect(page.locator('.page-heading')).toContainText('WEEK 02');await context.setOffline(false);});
test('corrupted primary slot recovers backup',async({page})=>{await create(page);await playWeek(page);await expect(page.locator('.save-state')).toHaveText('저장 완료');await page.evaluate(()=>new Promise<void>(resolve=>{const q=indexedDB.open('soccer-career-new-era');q.onsuccess=()=>{const t=q.result.transaction('saves','readwrite');t.objectStore('saves').put('{broken','slot1');t.oncomplete=()=>{q.result.close();resolve();};};}));await page.reload();await expect(page.getByRole('status')).toContainText('자동 저장을 읽을 수 없습니다.');await nav(page,'저장 관리');await page.locator('.save-card').first().getByRole('button',{name:'직전 백업 복원'}).click();await expect(page.getByRole('status')).toContainText('직전 백업을 복원했습니다.');});
test('two school seasons, rival aging, offer expiry and renewed professional contract',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await create(page,'17');
 for(let season=0;season<2;season++){
  for(let match=0;match<18;match++){if(await page.getByRole('button',{name:'시즌 결산 · 다음 시즌'}).count())break;await playWeek(page);}
  await page.getByRole('button',{name:'시즌 결산 · 다음 시즌'}).click();await expect(page.getByRole('heading',{name:'시즌을 마쳤습니다.'})).toBeVisible();
  if(season===1){await nav(page,'이적 · 계약');await expect(page.getByRole('button',{name:'계약 수락',exact:true}).first()).toBeVisible();
   // Advance two real weeks without a match: old offers must disappear.
   for(let week=0;week<2;week++){await nav(page,'커리어 홈');await page.getByRole('button',{name:'이번주 일정 진행',exact:true}).click();await page.getByRole('button',{name:'7일 일정 확정 · 진행'}).click();}
   await nav(page,'이적 · 계약');await expect(page.getByRole('button',{name:'계약 수락',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'새 계약 구직'}).click();await page.getByRole('button',{name:'연봉 15% 인상 협상'}).first().click();await page.getByRole('button',{name:'계약 수락',exact:true}).first().click();await nav(page,'시즌 · 리그');}
  await page.getByRole('button',{name:'다음 시즌 시작',exact:true}).click();await nav(page,'커리어 홈');
 }
 await playWeek(page);await nav(page,'라이벌');await expect(page.getByText(/19세/).first()).toBeVisible();await expect(page.locator('.save-state')).toHaveText('저장 완료');await page.reload();expect(errors).toEqual([]);
});
test('backup stays readable and distinct after restoring from a corrupted slot',async({page})=>{
 const read=()=>page.evaluate(()=>new Promise<{slot:string,backup:string}>(resolve=>{const q=indexedDB.open('soccer-career-new-era');q.onsuccess=()=>{const s=q.result.transaction('saves').objectStore('saves');const a=s.get('slot1'),b=s.get('backup1');a.transaction.oncomplete=()=>{q.result.close();resolve({slot:String(a.result),backup:String(b.result)});};};}));
 await create(page);await playWeek(page);await expect(page.locator('.save-state')).toHaveText('저장 완료');
 await page.evaluate(()=>new Promise<void>(resolve=>{const q=indexedDB.open('soccer-career-new-era');q.onsuccess=()=>{const t=q.result.transaction('saves','readwrite');t.objectStore('saves').put('{broken','slot1');t.oncomplete=()=>{q.result.close();resolve();};};}));
 await page.reload();await nav(page,'저장 관리');await page.locator('.save-card').first().getByRole('button',{name:'직전 백업 복원'}).click();await expect(page.getByRole('status')).toContainText('직전 백업을 복원했습니다.');await expect(page.locator('.save-state')).toHaveText('저장 완료');
 // The corrupted slot must not have been rotated into the backup.
 const first=await read();expect(first.backup.startsWith('{"format":"SCNE"')).toBe(true);
 // After real progress, an idle autosave tick (5 s) must not replace the backup with an identical copy of the slot.
 // The restored backup is the previous distinct save (here: full time, before results were applied).
 const finish=page.getByRole('button',{name:'결과 반영 · 남은 일정 진행'});if(await finish.count())await finish.click();
 await nav(page,'커리어 홈');await playWeek(page);await expect(page.locator('.save-state')).toHaveText('저장 완료');
 const progressed=await read();expect(progressed.backup===progressed.slot).toBe(false);
 await page.waitForTimeout(6000);const idle=await read();expect(idle.slot).toBe(progressed.slot);expect(idle.backup).toBe(progressed.backup);
});
