import {test,expect,type Page} from '@playwright/test';
import {newCareer} from '../../src/career';
import {createMatch,attributes,direction} from '../../src/engine';
import {encode} from '../../src/storage';

// v0.12 dribble pad: 짧은 드리블 / 치고 달리기, the open-path and pace reasons, and a knock-on actually played.
const base=()=>newCareer({name:'질주선수',age:17,pos:'ST',secondary:'LW',foot:'오른',height:180,weight:72,style:'플레이메이커',curve:'꾸준한 성장형'},0,177,{traits:[]});
async function load(page:Page,c:ReturnType<typeof base>){await page.goto('/manifest.webmanifest');await page.evaluate(data=>new Promise<void>(r=>{const q=indexedDB.open('soccer-career-new-era',1);q.onupgradeneeded=()=>q.result.createObjectStore('saves');q.onsuccess=()=>{const t=q.result.transaction('saves','readwrite');t.objectStore('saves').put(data,'slot1');t.objectStore('saves').put(1,'activeSlot');t.oncomplete=()=>{q.result.close();r();};};}),encode(c));await page.goto('/');}
function setup(defending=false,opp:{dx:number,dy:number}[]=[{dx:3,dy:0}]){
  const c=base(),m=createMatch(9973,{...c.player,a:attributes(60)});c.match=m;m.insight={chance:0,gains:{},events:[]};const d=direction(m,0),X=(x:number)=>d>0?x:105-x;
  for(const p of m.players){p.x=X(p.team?96:10);p.y=p.team?6:62;}
  const u=m.players[m.userId];u.x=X(60);u.y=34;
  const field=m.players.filter(p=>p.team===1&&p.pos!=='GK');opp.forEach((o,i)=>{field[i].x=X(60+o.dx);field[i].y=34+o.dy;});
  const mates=m.players.filter(p=>p.team===0&&p.id!==u.id&&p.pos!=='GK');mates[0].x=X(66);mates[0].y=24;mates[1].x=X(58);mates[1].y=46;
  if(defending){m.ball={x:field[0].x,y:field[0].y,owner:field[0].id,flight:null};m.defending=true;m.decision=false;}else{m.ball={x:u.x,y:u.y,owner:u.id,flight:null};m.decision=true;}
  return c;
}
test('the pad switches to 치고 달리기, a quick player chased from behind reads 속도 우위, and the knock-on is played',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const c=setup(false,[{dx:-2,dy:0}]);const u=c.match!.players[c.match!.userId];u.a={...u.a,speed:90,acceleration:90};await load(page,c);
  await page.getByRole('group',{name:'공격 선택'}).getByRole('button',{name:/드리블/}).click();
  const pad=page.getByRole('group',{name:'드리블 방향'});await expect(pad).toBeVisible();
  const mode=pad.getByRole('radiogroup',{name:'드리블 방식'});await expect(mode.getByRole('radio',{name:'짧은 드리블'})).toHaveAttribute('aria-checked','true');
  await expect(pad.locator('.pad-why')).toContainText('속도 우위');await expect(pad).toContainText('3~7m');
  await mode.getByRole('radio',{name:'치고 달리기'}).click();
  await expect(mode.getByRole('radio',{name:'치고 달리기'})).toHaveAttribute('aria-checked','true');
  await expect(pad).toContainText('치고 달리기 방향');await expect(pad).toContainText('8~10m');await expect(page.locator('.pitch-hint')).toContainText('치고 달리기');
  await expect(pad.locator('.pad-why')).toContainText('매우 높은 확률');
  // A quick player chased from behind: the reason names the pace race.
  await expect(pad.locator('.pad-why')).toContainText('속도 우위');
  await expect(page.locator('.match-actions')).not.toContainText('%');
  await pad.getByRole('button',{name:'치고 달리기 ↑',exact:true}).click();
  await expect(pad).toHaveCount(0);
  await expect(page.locator('.live-commentary')).toContainText(/(질주선수|볼 탈취|상대)/);
  expect(errors).toEqual([]);
});

test('cancelling the pad resets to 짧은 드리블',async({page})=>{
  await load(page,setup(false,[{dx:3,dy:0}]));
  await page.getByRole('group',{name:'공격 선택'}).getByRole('button',{name:/드리블/}).click();
  const pad=page.getByRole('group',{name:'드리블 방향'});await pad.getByRole('radio',{name:'치고 달리기'}).click();
  await pad.getByRole('button',{name:'드리블 취소'}).click();await expect(pad).toHaveCount(0);
  await page.getByRole('group',{name:'공격 선택'}).getByRole('button',{name:/드리블/}).click();
  await expect(page.getByRole('group',{name:'드리블 방향'}).getByRole('radio',{name:'짧은 드리블'})).toHaveAttribute('aria-checked','true');
  // A defender right in the path: the knock-on straight at him is clearly worse than a short dribble.
  await expect(page.getByRole('group',{name:'드리블 방향'}).locator('.pad-why')).toContainText('정면 수비 견제');
});

test('an open path reads 진행 방향 공간 열림 at a very high chance',async({page})=>{
  await load(page,setup(false,[{dx:20,dy:10}]));
  await page.getByRole('group',{name:'공격 선택'}).getByRole('button',{name:/드리블/}).click();
  const why=page.getByRole('group',{name:'드리블 방향'}).locator('.pad-why');
  await expect(why).toContainText('매우 높은 확률');await expect(why).toContainText('진행 방향 공간 열림');
});
