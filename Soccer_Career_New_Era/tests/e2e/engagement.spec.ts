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

