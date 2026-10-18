import {test,expect,type Page} from '@playwright/test';
// v0.15: 35-week calendar (saved match weekday), coach trust status on home/player, paid focused training
// (expandable, two steps, exact fee), season calendar + brackets + school table, transfer windows.
async function nav(page:Page,name:string){if((page.viewportSize()?.width??1440)<900)await page.getByRole('button',{name:'메뉴',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();}
const noOverflow=(page:Page)=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
test('35-week season UI: status & trust, focused training fee, calendar/brackets/table, transfer windows',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'새로운 커리어 시작'}).click();
  await page.getByLabel('학교 검색').fill('매탄');await page.locator('.school-row').first().click();
  await page.getByRole('radiogroup',{name:'희망 포지션'}).getByRole('radio',{name:/스트라이커/}).click();
  await page.locator('.candidate').first().getByRole('button',{name:/선수로 커리어 시작/}).click();await expect(page.locator('.save-state')).toHaveText('저장 완료');
  // home: squad status from coach trust (a new school player: 60 → 주전) and the season week
  await expect(page.locator('.metric',{hasText:'감독 신뢰'})).toContainText('주전');
  await expect(page.locator('.today .pill')).toContainText('1/35주차');
  await expect(page.locator('.week-strip li',{hasText:'경기'})).toHaveCount(1);
  expect(await noOverflow(page)).toBe(true);
  // focused training: open, pick, see the plan, then pay exactly 1.4만원
  await nav(page,'오늘의 일정');
  const cell=page.locator('.today-cell.shooting');
  if(await page.locator('.match-today').count()===0){
    await cell.locator('summary').click();
    await expect(cell.getByRole('button',{name:'능력치를 고르세요'})).toBeDisabled();
    await cell.getByRole('radio',{name:'골 결정력'}).click();
    await expect(cell.locator('.focus-plan')).toContainText('골 결정력 55%');
    await expect(cell.locator('.focus-expander')).toContainText('소지금 100만원');
    await cell.getByRole('button',{name:/골 결정력 세부훈련 · 1.4만원/}).click();
    await expect(page.locator('section.today')).toContainText('98.6만원');
    await expect(page.locator('.today-result')).toContainText('공격훈련');
  }
  // play rest days until the match day; the match card names the competition
  for(let i=0;i<7&&await page.locator('.match-today').count()===0;i++)await page.getByRole('button',{name:'오늘 휴식하기'}).click();
  await expect(page.locator('.match-today')).toContainText(/지역 리그|교류전|친선/);
  await expect(page.locator('.match-today')).toContainText('감독 신뢰 60 (주전)');
  // season: 35-week calendar, brackets tab, school table
  await nav(page,'시즌 · 리그');
  await expect(page.locator('.season-calendar li')).toHaveCount(35);
  await expect(page.locator('.season-calendar li[aria-current="step"]')).toContainText('1주');
  await page.getByRole('tab',{name:'토너먼트'}).click();await expect(page.locator('.bracket').first()).toContainText('지역 토너먼트');
  await expect(page.locator('.bracket',{hasText:'스카우트 평가'})).toContainText('최대 +8');
  await page.getByRole('tab',{name:'지역 리그 순위'}).click();await expect(page.locator('tr.mine')).toContainText('매탄고');
  expect(await noOverflow(page)).toBe(true);
  // transfer: the window rule is explained; player screen shows status and the 63 return threshold
  await nav(page,'이적 · 계약');await expect(page.locator('.page-heading')).toContainText('17–18주차');
  await nav(page,'내 선수');await expect(page.locator('.profile-facts')).toContainText('팀 내 위치 주전');
  await expect(page.locator('.profile-facts')).toContainText(/감독 신뢰 6\d\.\d \/ 100/);
  expect(await noOverflow(page)).toBe(true);
  expect(errors).toEqual([]);
});
