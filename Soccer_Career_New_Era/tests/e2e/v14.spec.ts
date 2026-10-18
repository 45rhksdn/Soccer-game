import {test,expect,type Page} from '@playwright/test';
// v0.14 back-stories: region + school + numbers on the scouting card; the signed player keeps the same story.
async function nav(page:Page,name:string){if((page.viewportSize()?.width??1440)<900)await page.getByRole('button',{name:'메뉴',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();}
test('school → wished position → one student with story, traits and a league-level forecast, kept after signing',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'새로운 커리어 시작'}).click();
  await page.getByLabel('학교 검색').fill('매탄');await page.locator('.school-row').first().click();
  await expect(page.locator('.candidate')).toHaveCount(0);await expect(page.locator('.wish-position')).toContainText('포지션을 고르면');
  await page.getByRole('radiogroup',{name:'희망 포지션'}).getByRole('radio',{name:/스트라이커/}).click();
  const card=page.locator('.candidate').first();
  const headline=(await card.locator('.story-headline').innerText()).trim();
  expect(headline.length).toBeGreaterThan(8);
  await expect(card.locator('.candidate-story').first()).toContainText('공을 차며 자란');
  await expect(card.locator('.story-rest blockquote')).toContainText('축구부 코치');
  await expect(card.locator('.story-rest')).toContainText('수원삼성 U18');
  await expect(card.locator('.tag').first()).toContainText('ST /');
  await expect(page.locator('.forecast')).toContainText(/스카우트 평가: 꾸준히 성장한다면 전성기에 .+(주전급|핵심|로테이션 선수)까지/);
  await expect(card.locator('.student-traits')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await card.getByRole('button',{name:/선수로 커리어 시작/}).click();await expect(page.locator('.save-state')).toHaveText('저장 완료');
  await nav(page,'내 선수');await page.locator('.origin-detail summary').click();
  await expect(page.locator('.origin-detail .story-headline')).toHaveText(headline);
  await expect(page.locator('.origin-detail blockquote')).toContainText('매탄고 축구부 코치');
  expect(errors).toEqual([]);
});
