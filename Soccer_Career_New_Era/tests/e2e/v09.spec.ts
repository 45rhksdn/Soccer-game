import {test,expect,type Page} from '@playwright/test';
import {newCareer} from '../../src/career';
import {createMatch,attributes,finishMatch} from '../../src/engine';
import {encode} from '../../src/storage';

// v0.9: 감독 미션 on the match screen, 시그니처 도전 + 라이벌 비교 on home, signature popup after 결과 반영.
const base=()=>newCareer({name:'몰입선수',age:17,pos:'ST',secondary:'LW',foot:'오른',height:180,weight:70,style:'플레이메이커',curve:'꾸준한 성장형'},0,177,{traits:[]});
async function load(page:Page,c:ReturnType<typeof base>){await page.goto('/manifest.webmanifest');await page.evaluate(data=>new Promise<void>(r=>{const q=indexedDB.open('soccer-career-new-era',1);q.onupgradeneeded=()=>q.result.createObjectStore('saves');q.onsuccess=()=>{const t=q.result.transaction('saves','readwrite');t.objectStore('saves').put(data,'slot1');t.objectStore('saves').put(1,'activeSlot');t.oncomplete=()=>{q.result.close();r();};};}),encode(c));await page.goto('/');}

test('match screen shows the 감독 미션 with live progress',async({page})=>{
  const c=base(),m=createMatch(9973,{...c.player,a:attributes(70)});c.match=m;const u=m.players[m.userId];
  m.ball={x:u.x,y:u.y,owner:u.id,flight:null};m.decision=true;m.insight={chance:0,gains:{},events:[]};
  m.mission={id:'t',label:'슈팅 2회 이상',stat:'shots',target:2,cmp:'min'};u.stats.minutes=5;u.stats.shots=1;
  await load(page,c);
  const strip=page.getByRole('status',{name:'감독 미션'});await expect(strip).toBeVisible();
  await expect(strip).toContainText('슈팅 2회 이상');await expect(strip).toContainText('1 / 2');
  await expect(strip.locator('.eg-bar span')).toHaveCount(1);
});

test('home shows 시그니처 도전 progress bars and the 라이벌 비교 card',async({page})=>{
  const c=base();c.development.deeds={goals:7,dribbles:12};c.development.signatures=['감아차기 장인'];c.development.missions={done:3,total:5};
  await load(page,c);
  const sig=page.locator('.signature-card');await expect(sig).toBeVisible();
  await expect(sig).toContainText('시그니처 도전');await expect(sig).toContainText('골 7 / 30');await expect(sig).toContainText('◆ 감아차기 장인');
  await expect(sig).toContainText('다음 능력치 단계');await expect(sig).toContainText('감독 미션 3회 달성');
  const rival=page.locator('.rival-compare');await expect(rival).toBeVisible();
  await expect(rival).toContainText('라이벌 비교');await expect(rival).toContainText(c.development.rival.player.name);
  await expect(rival.locator('.rc-row')).toHaveCount(4);
});

test('result 반영 with a completed mission unlocks 미션 마스터 and shows the signature popup',async({page})=>{
  const c=base(),m=createMatch(9973,{...c.player,a:attributes(70)});c.match=m;m.insight={chance:0,gains:{},events:[]};
  finishMatch(m);m.mission={id:'t',label:'슈팅 0회 이상',stat:'shots',target:0,cmp:'min'};m.goalNoticeSeen=m.goals?.length??0;
  c.development.missions={done:29,total:40};
  await load(page,c);
  await expect(page.locator('.mission-result')).toContainText('달성');
  await page.getByRole('button',{name:/결과 반영/}).click();
  const popup=page.getByRole('dialog');await expect(popup).toContainText('시그니처!');await expect(popup).toContainText('미션 마스터');
  await expect(popup.locator('.popup-medal')).toHaveText('◆');
  await popup.getByRole('button',{name:'확인'}).click();await expect(popup).toHaveCount(0);
  await expect(page.locator('.signature-card')).toContainText('◆ 미션 마스터');
});

test('0.9.1: graduation — 다음 시즌 시작 opens the transfer market; home shows no greeting and two headlines',async({page})=>{
  const c=base();c.player.age=18;c.world.phase='offseason';
  c.development.news=[];for(const [t,k] of [['훈련 중 무언가를 느꼈다!','lucky'],['라이벌 강시우 · 경기 중 부상 · 2주 회복 필요','rival'],['몰입선수 · 평점 7.80의 맹활약!','rating'],['감독 미션 실패 · 「슈팅 2회 이상」 (1/2)','career'],['시그니처 획득! 「골 사냥꾼」 · 근거리 슛 성공률이 조금 오릅니다.','career']] as const)c.development.news.unshift({day:c.day,text:t,kind:k});
  await load(page,c);
  const hero=page.locator('.career-hero');await expect(hero.locator('.headline-news p')).toHaveCount(2);
  await expect(hero).toContainText('시그니처 획득');await expect(hero).toContainText('맹활약');await expect(hero).not.toContainText('느꼈다');await expect(hero).not.toContainText('부상');
  await expect(page.getByText('좋은 하루예요')).toHaveCount(0);await expect(page.getByText('오늘의 작은 노력이')).toHaveCount(0);
  await page.getByRole('button',{name:'시즌 결산 · 다음 시즌'}).click();
  await page.getByRole('button',{name:'다음 시즌 시작',exact:true}).click();
  await expect(page.getByRole('heading',{name:'다음 유니폼은 어디일까요?'})).toBeVisible();
  await expect(page.getByText('졸업 예정입니다').first()).toBeVisible();
});
