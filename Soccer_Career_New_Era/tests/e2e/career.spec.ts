import {test,expect,type Page} from '@playwright/test';
async function nav(page:Page,name:string){if((page.viewportSize()?.width??1440)<900)await page.getByRole('button',{name:'메뉴',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();}
async function create(page:Page,age='16'){await page.goto('/');await page.getByRole('button',{name:'새로운 커리어 시작'}).click();await page.getByRole('tab',{name:'직접 만들기'}).click();await page.getByLabel('선수 이름').fill('테스트선수');await page.getByLabel('입학 나이').selectOption(age);await page.getByLabel('주 포지션',{exact:true}).selectOption('ST');await page.getByRole('button',{name:'입단하고 커리어 시작'}).click();}
/** Plays one day per tap until match day, plays the match, then Sunday (skipped when the season just ended). */
async function playWeek(page:Page){await nav(page,'오늘의 일정');
 for(let i=0;i<7&&!(await page.getByRole('button',{name:'경기 진행'}).count());i++)await page.getByRole('button',{name:'오늘 휴식하기'}).click();
 await page.getByRole('button',{name:'경기 진행'}).click();await page.getByRole('button',{name:'빠른 시뮬레이션'}).click();await page.getByRole('button',{name:'결과 반영',exact:true}).click();
 if(await page.getByRole('heading',{name:'시즌을 마쳤습니다.'}).count())return;
 await nav(page,'오늘의 일정');await page.getByRole('button',{name:'오늘 휴식하기'}).click();await nav(page,'커리어 홈');}
// 럭키 / 깨달음 popups can appear at random (training lucky, insight during a match); close them whenever they block a step.
test.beforeEach(async({page})=>{await page.addLocatorHandler(page.locator('.growth-popup'),async()=>{await page.locator('.growth-popup').getByRole('button',{name:'확인'}).click();});});
async function tapDays(page:Page,acts:string[]){for(const a of acts)await page.getByRole('button',{name:`오늘 ${a}`}).click();}
/** Day index (0 = 월) of the week stored in the active slot, to wait for the autosave before reloading. */
const savedDay=(page:Page)=>page.evaluate(()=>new Promise<number>(resolve=>{const q=indexedDB.open('soccer-career-new-era');q.onsuccess=()=>{const s=q.result.transaction('saves').objectStore('saves');const a=s.get('activeSlot');a.onsuccess=()=>{const r=s.get('slot'+(a.result??1));r.onsuccess=()=>{q.result.close();try{resolve(JSON.parse(JSON.parse(String(r.result)).payload).development.active?.cursor??0);}catch{resolve(-1);}};};};}));
test('daily schedule → live action → growth/rival → reload mid-week and mid-match → slots and file restore',async({page},info)=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await create(page);
 await expect(page.getByRole('heading',{name:'지난주 주요 뉴스'})).toBeVisible();await expect(page.locator('.career-hero')).not.toContainText('보유 특성');await expect(page.locator('.today-help')).toContainText('낮은 확률');
 await nav(page,'오늘의 일정');await tapDays(page,['패스훈련','달리기','슈팅훈련','휴식하기','드리블훈련']);
 await page.screenshot({path:`reports/${info.project.name}-daily.png`,fullPage:true});
 await page.getByRole('button',{name:'경기 진행'}).click();await page.getByRole('button',{name:'12×',exact:true}).click();
 await expect(page.getByRole('heading',{name:'당신의 차례입니다.'})).toBeVisible({timeout:20000});
 await page.getByRole('button',{name:'1×',exact:true}).click();
 const before=await page.locator('canvas').evaluate((n:HTMLCanvasElement)=>n.toDataURL());await page.getByRole('button',{name:'일시정지',exact:true}).click();await page.getByRole('button',{name:/안전한 패스/}).click();await expect(page.getByRole('heading',{name:'다음 기회를 준비하세요.'})).toBeVisible();await page.getByRole('button',{name:'계속',exact:true}).click();await expect.poll(()=>page.locator('canvas').evaluate((n:HTMLCanvasElement)=>n.toDataURL())).not.toBe(before);
 await page.getByRole('button',{name:'빠른 시뮬레이션'}).click();await page.getByRole('button',{name:'결과 반영',exact:true}).click();await tapDays(page,['휴양하기']);await expect(page.locator('.page-heading')).toContainText('WEEK 02');await expect(page.getByRole('heading',{name:'이번주 성장노트'})).toBeVisible();await expect(page.locator('.save-state')).toHaveText('저장 완료');
 await nav(page,'라이벌');await expect(page.getByRole('heading',{name:/평생의 라이벌/})).toBeVisible();await expect(page.getByRole('heading',{name:'라이벌 최근 경기'})).toBeVisible();await page.screenshot({path:`reports/${info.project.name}-rival.png`,fullPage:true});
 // Daily progress survives reloads, including a match in progress.
 await page.reload();await nav(page,'오늘의 일정');await tapDays(page,['패스훈련','휴식하기']);await expect.poll(()=>savedDay(page)).toBe(2);await page.reload();await nav(page,'오늘의 일정');await expect(page.locator('.week-strip li.today')).toContainText('수');
 await tapDays(page,['달리기','휴식하기','패스훈련']);await page.getByRole('button',{name:'경기 진행'}).click();await expect(page.locator('.save-state')).toHaveText('저장 완료');await page.reload();await expect(page.locator('canvas')).toBeVisible();await page.getByRole('button',{name:'빠른 시뮬레이션'}).click();await page.getByRole('button',{name:'결과 반영',exact:true}).click();await tapDays(page,['휴식하기']);await expect(page.locator('.page-heading')).toContainText('WEEK 03');
 await nav(page,'저장 관리');await page.locator('.save-card').nth(1).getByRole('button',{name:'여기에 저장'}).click();await expect(page.locator('.save-card').nth(1)).toContainText('현재 슬롯');const download=page.waitForEvent('download');await page.getByRole('button',{name:'내보내기',exact:true}).click();await(await download).saveAs(`reports/${info.project.name}-save.json`);await page.reload();await nav(page,'저장 관리');await expect(page.locator('.save-card').nth(1)).toContainText('현재 슬롯');page.on('dialog',d=>d.accept());await page.locator('input[type=file]').setInputFiles(`reports/${info.project.name}-save.json`);await expect(page.getByRole('status')).toContainText('저장 파일을 가져왔습니다.');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('production PWA runs weekly training and match offline',async({page,context})=>{test.skip(!process.env.PWA_TEST);await create(page);await expect(page.locator('.save-state')).toHaveText('저장 완료');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);await context.setOffline(true);await page.reload();await playWeek(page);await expect(page.locator('.page-heading')).toContainText('WEEK 02');await expect(page.locator('.save-state')).toHaveText('저장 완료');await page.reload();await expect(page.locator('.page-heading')).toContainText('WEEK 02');await context.setOffline(false);});
test('corrupted primary slot recovers backup',async({page})=>{await create(page);await playWeek(page);await expect(page.locator('.save-state')).toHaveText('저장 완료');await page.evaluate(()=>new Promise<void>(resolve=>{const q=indexedDB.open('soccer-career-new-era');q.onsuccess=()=>{const t=q.result.transaction('saves','readwrite');t.objectStore('saves').put('{broken','slot1');t.oncomplete=()=>{q.result.close();resolve();};};}));await page.reload();await expect(page.getByRole('status')).toContainText('자동 저장을 읽을 수 없습니다.');await nav(page,'저장 관리');await page.locator('.save-card').first().getByRole('button',{name:'직전 백업 복원'}).click();await expect(page.getByRole('status')).toContainText('직전 백업을 복원했습니다.');});
test('two school seasons, rival aging, offer expiry and renewed professional contract',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await create(page,'17');
 for(let season=0;season<2;season++){
  for(let match=0;match<18;match++){if(await page.getByRole('heading',{name:'시즌을 마쳤습니다.'}).count())break;await playWeek(page);}
  // The last result of the season opens the season summary automatically.
  await expect(page.getByRole('heading',{name:'시즌을 마쳤습니다.'})).toBeVisible();await expect(page.locator('.season-review')).toContainText('시즌');
  if(season===1){await nav(page,'이적 · 계약');await expect(page.getByRole('button',{name:'계약 수락',exact:true}).first()).toBeVisible();
   // Let 15 offseason days pass one at a time: offers older than 14 days must disappear.
   await nav(page,'오늘의 일정');for(let day=0;day<15;day++)await page.getByRole('button',{name:'오늘 휴식하기'}).click();
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
 const finish=page.getByRole('button',{name:'결과 반영'});if(await finish.count())await finish.click();
 await nav(page,'커리어 홈');await playWeek(page);await expect(page.locator('.save-state')).toHaveText('저장 완료');
 const progressed=await read();expect(progressed.backup===progressed.slot).toBe(false);
 await page.waitForTimeout(6000);const idle=await read();expect(idle.slot).toBe(progressed.slot);expect(idle.backup).toBe(progressed.backup);
});
async function names(page:Page){return page.locator('.candidate h4').allInnerTexts();}
async function openSchool(page:Page,region:string,school:string){await page.getByRole('button',{name:new RegExp(`^${region} · 축구부`)}).click();await page.getByRole('button',{name:new RegExp(school)}).first().click();await expect(page.locator('.candidate')).toHaveCount(6);}
test('scouting: region map → real school → stable candidates → reroll persists → chosen player starts there',async({page},info)=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'새로운 커리어 시작'}).click();
 await expect(page.getByRole('tab',{name:'실제 고교에서 발굴'})).toHaveAttribute('aria-selected','true');
 await openSchool(page,'대구','현풍고');const first=await names(page);
 await expect(page.getByRole('heading',{name:'3. 능력치 비교'})).toBeVisible();await expect(page.locator('.scout-source a').first()).toBeVisible();
 await page.screenshot({path:`reports/${info.project.name}-scouting.png`,fullPage:true});
 await page.reload();await page.getByRole('button',{name:'새로운 커리어 시작'}).click();await openSchool(page,'대구','현풍고');expect(await names(page)).toEqual(first);
 await page.getByRole('button',{name:'새 후보 목록 생성'}).click();await expect(page.getByText('후보 목록 #2')).toBeVisible();const second=await names(page);expect(second).not.toEqual(first);
 await page.reload();await page.getByRole('button',{name:'새로운 커리어 시작'}).click();await openSchool(page,'대구','현풍고');expect(await names(page)).toEqual(second);
 const chosen=second[1];await page.getByRole('button',{name:`${chosen} 선수로 커리어 시작`}).click();
 await expect(page.getByRole('heading',{name:'지난주 주요 뉴스'})).toBeVisible();await expect(page.getByText('현풍고 축구부 입단').first()).toBeVisible();
 await nav(page,'내 선수');await expect(page.getByRole('heading',{name:new RegExp(chosen)}).first()).toBeVisible();await expect(page.getByText(/현풍고 ·/).first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('player switching keeps up to three careers independent; replaced players can be restored',async({page},info)=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const db=()=>page.evaluate(()=>new Promise<Record<string,string>>(resolve=>{const q=indexedDB.open('soccer-career-new-era');q.onsuccess=()=>{const s=q.result.transaction('saves').objectStore('saves');const out:Record<string,string>={};const keys=['slot1','slot2','slot3','archive2','activeSlot'];let left=keys.length;for(const k of keys){const r=s.get(k);r.onsuccess=()=>{const v=r.result;out[k]=typeof v==='string'?JSON.parse(JSON.parse(v).payload).player.name+'@'+JSON.parse(JSON.parse(v).payload).week:String(v);if(--left===0){q.result.close();resolve(out);}};}};}));
 await create(page);await playWeek(page);await expect(page.locator('.page-heading')).toContainText('WEEK 02');await expect(page.locator('.save-state')).toHaveText('저장 완료');
 await nav(page,'선수 변경하기');await expect(page.getByRole('heading',{name:'선수 변경하기'})).toBeVisible();
 await page.locator('.player-slot').nth(1).getByRole('button',{name:'새 선수 시작'}).click();
 await expect(page.getByText('저장 위치 · 슬롯 2')).toBeVisible();await page.getByLabel('학교 검색').fill('보인');await page.getByRole('button',{name:/보인고/}).click();
 const scouted=(await names(page))[0];await page.getByRole('button',{name:`${scouted} 선수로 커리어 시작`}).click();
 await expect(page.getByRole('heading',{name:'지난주 주요 뉴스'})).toBeVisible();await expect.poll(async()=>(await db()).slot2).toBe(`${scouted}@0`);
 let state=await db();expect(state.slot1).toBe('테스트선수@1');expect(state.slot2).toBe(`${scouted}@0`);expect(state.activeSlot).toBe('2');
 await nav(page,'선수 변경하기');await page.screenshot({path:`reports/${info.project.name}-players.png`,fullPage:true});
 await expect(page.locator('.player-slot').nth(0)).toContainText('테스트선수');await expect(page.locator('.player-slot').nth(1)).toContainText('플레이 중');
 await page.locator('.player-slot').nth(0).getByRole('button',{name:'이 선수로 전환'}).click();
 await expect(page.locator('.page-heading')).toContainText('WEEK 02');await expect(page.locator('.page-heading')).toContainText('테스트선수');
 await page.waitForTimeout(6000);state=await db();expect(state.slot1).toBe('테스트선수@1');expect(state.slot2).toBe(`${scouted}@0`);expect(state.activeSlot).toBe('1');
 // Replace slot 2 with a hand-made player; the scouted player is archived, then restored.
 await nav(page,'선수 변경하기');await page.locator('.player-slot').nth(1).getByRole('button',{name:'이 슬롯에 새 선수 시작'}).click();
 await page.getByRole('tab',{name:'직접 만들기'}).click();await page.getByLabel('선수 이름').fill('교체선수');await page.getByRole('button',{name:'입단하고 커리어 시작'}).click();
 await expect.poll(async()=>(await db()).slot2).toBe('교체선수@0');state=await db();expect(state.slot2).toBe('교체선수@0');expect(state.archive2).toBe(`${scouted}@0`);expect(state.slot1).toBe('테스트선수@1');
 await nav(page,'선수 변경하기');await page.getByRole('button',{name:`교체 전 선수 복원 · ${scouted}`}).click();
 await expect(page.getByRole('status')).toContainText('교체 전 선수를 복원했습니다');await expect.poll(async()=>(await db()).slot2).toBe(`${scouted}@0`);state=await db();expect(state.slot2).toBe(`${scouted}@0`);expect(state.archive2).toBe('교체선수@0');expect(state.slot1).toBe('테스트선수@1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('오늘의 일정: one tap per day, match-day screen, then Sunday ends the week',async({page},info)=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await create(page);
 await expect(page.getByRole('heading',{name:'오늘의 일정 진행'})).toBeVisible();await expect(page.getByRole('button',{name:'이번주 일정 진행',exact:true})).toHaveCount(0);
 const days=['월','화','수','목','금'],acts=['패스훈련','달리기','슈팅훈련','휴식하기','드리블훈련'];
 for(let i=0;i<5;i++){await page.getByRole('button',{name:`오늘 ${acts[i]}`}).click();await expect(page.locator('.today-result')).toContainText(`${days[i]}요일 · `);}
 await page.screenshot({path:`reports/${info.project.name}-today-match.png`,fullPage:true});
 await expect(page.getByText('오늘은 경기가 있는 날입니다')).toBeVisible();await expect(page.getByRole('button',{name:'오늘 패스훈련'})).toHaveCount(0);
 await page.getByRole('button',{name:'경기 진행'}).click();await page.getByRole('button',{name:'빠른 시뮬레이션'}).click();await page.getByRole('button',{name:'결과 반영',exact:true}).click();
 await expect(page.getByRole('heading',{name:'오늘의 일정 진행'})).toBeVisible();await expect(page.locator('.week-strip li.today')).toContainText('일');
 await page.getByRole('button',{name:'오늘 휴식하기'}).click();await expect(page.locator('.page-heading')).toContainText('WEEK 02');await expect(page.locator('.today-result')).toContainText('한 주가 끝났습니다');
 await page.screenshot({path:`reports/${info.project.name}-today.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
