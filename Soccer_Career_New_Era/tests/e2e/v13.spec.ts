import {test,expect,type Page} from '@playwright/test';
async function nav(page:Page,name:string){if((page.viewportSize()?.width??1440)<900)await page.getByRole('button',{name:'메뉴',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();}
test('candidate story is compact, details accessible, selected story and rival survive reload',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'새로운 커리어 시작'}).click();
 await page.getByLabel('학교 검색').fill('보인');await page.locator('.school-row').first().click();await page.getByRole('radiogroup',{name:'희망 포지션'}).getByRole('radio',{name:/스트라이커/}).click();
 await expect(page.locator('.candidate')).toHaveCount(1);/* 0.14: one student for the wished position */await expect(page.locator('.candidate-story').first()).toBeVisible();
 await expect(page.locator('.candidate-detail')).not.toHaveAttribute('open','');/* 0.14: no comparison table for a single student; details start closed */await expect(page.getByText('학습 효율',{exact:true})).toHaveCount(0);
 const card=page.locator('.candidate').first(),story=await card.locator('.candidate-story').innerText();
 await card.getByText('코치의 관찰과 능력치',{exact:true}).click();await expect(card.locator('.candidate-detail')).toHaveAttribute('open','');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`reports/${info.project.name}-v13-candidates.png`,fullPage:false});
 await card.getByRole('button',{name:/선수로 커리어 시작/}).click();await expect(page.locator('.save-state')).toHaveText('저장 완료');
 await nav(page,'내 선수');await page.locator('.origin-detail summary').click();await expect(page.locator('.origin-detail')).toContainText(story);await expect(page.locator('.origin-detail')).toContainText('라이벌의 강점');
 await page.reload();await nav(page,'내 선수');await page.locator('.origin-detail summary').click();await expect(page.locator('.origin-detail')).toContainText(story);
 await nav(page,'라이벌');await expect(page.locator('.rival-intro')).toContainText('서로 다른 학교');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
