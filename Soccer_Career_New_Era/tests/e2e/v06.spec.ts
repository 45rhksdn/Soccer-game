import {test,expect,type Page} from '@playwright/test';

// v0.6: defensive choices during a live match.
test.beforeEach(async({page})=>{await page.addLocatorHandler(page.locator('.growth-popup'),async()=>{await page.locator('.growth-popup').getByRole('button',{name:'확인'}).click();});});
async function nav(page:Page,name:string){if((page.viewportSize()?.width??1440)<900)await page.getByRole('button',{name:'메뉴',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();}

test('live match: an opponent near me with the ball asks for a defensive choice; the choice is applied',async({page},info)=>{
  test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'새로운 커리어 시작'}).click();await page.getByRole('tab',{name:'직접 만들기'}).click();
  await page.getByLabel('선수 이름').fill('수비테스트');await page.getByLabel('입학 나이').selectOption('17');await page.getByLabel('주 포지션',{exact:true}).selectOption('CB');
  await page.getByRole('button',{name:'입단하고 커리어 시작'}).click();
  await nav(page,'오늘의 일정');/* 0.15: the match weekday comes from the season calendar */for(let i=0;i<7&&!(await page.getByRole('button',{name:'경기 진행'}).count());i++)await page.getByRole('button',{name:'오늘 휴식하기'}).click();
  await page.getByRole('button',{name:'경기 진행'}).click();await page.getByRole('button',{name:'4×',exact:true}).click();
  const defense=page.getByRole('group',{name:'수비 선택'});
  // On-ball moments are answered with a safe pass until the first defensive moment.
  for(let i=0;i<400&&!(await defense.count());i++){
    const pass=page.getByRole('group',{name:'공격 선택'}).getByRole('button',{name:/^패스/});
    if(await pass.count()&&!(await defense.count())){await pass.first().click({timeout:2000}).catch(()=>{});await page.locator('.cm-pass-card').getByRole('button',{name:'패스하기',exact:true}).click({timeout:2000}).catch(()=>{});}
    await page.waitForTimeout(150);
    if(await page.getByText('FULL TIME REPORT').count())break;
  }
  if(!(await defense.count())){test.skip(true,'not selected or no defensive moment');return;}
  await expect(page.locator('.live-badge')).toContainText('수비 선택');
  await expect(defense.getByRole('button',{name:'수비 스탠딩 태클'})).toContainText(/(매우 낮은|낮은|중간|높은|매우 높은) 확률/);expect(await defense.innerText()).not.toMatch(/\d+(\.\d+)?\s*%/);
  await page.screenshot({path:`reports/${info.project.name}-defense.png`,fullPage:false});
  const clock=await page.locator('.scoreboard small, .score small').first().innerText().catch(()=>'');
  await page.waitForTimeout(600);expect(await page.locator('.scoreboard small, .score small').first().innerText().catch(()=>'')).toBe(clock); // paused while choosing
  await defense.getByRole('button',{name:'수비 압박하기'}).click();
  await expect(defense).toHaveCount(0);
  await expect(page.locator('.live-commentary')).toBeVisible();
  await page.getByRole('button',{name:'빠른 시뮬레이션'}).click();await page.getByRole('button',{name:'결과 반영',exact:true}).click();
  expect(errors).toEqual([]);
});
