import {test,expect,type Page} from '@playwright/test';
import {newCareer} from '../../src/career';
import {createMatch,attributes,direction} from '../../src/engine';
import {encode} from '../../src/storage';

// v0.10: crosses met in the air (헤더 / 발리), crosses from wide areas and corners on the live match screen.
const base=(pos:'ST'|'LW'='ST')=>newCareer({name:'박스선수',age:17,pos,secondary:pos==='ST'?'LW':'ST',foot:'오른',height:182,weight:74,style:'플레이메이커',curve:'꾸준한 성장형'},0,177,{traits:[]});
async function load(page:Page,c:ReturnType<typeof base>){await page.goto('/manifest.webmanifest');await page.evaluate(data=>new Promise<void>(r=>{const q=indexedDB.open('soccer-career-new-era',1);q.onupgradeneeded=()=>q.result.createObjectStore('saves');q.onsuccess=()=>{const t=q.result.transaction('saves','readwrite');t.objectStore('saves').put(data,'slot1');t.objectStore('saves').put(1,'activeSlot');t.oncomplete=()=>{q.result.close();r();};};}),encode(c));await page.goto('/');}
function setup(pos:'ST'|'LW',place:(m:ReturnType<typeof createMatch>,goal:number,d:number)=>void){
  const c=base(pos),m=createMatch(9973,{...c.player,a:attributes(70)});c.match=m;m.insight={chance:0,gains:{},events:[]};
  const d=direction(m,0),goal=d>0?105:0;
  // Clear the box of everyone, then place the scene.
  for(const p of m.players){p.x=52.5+(p.team?8:-8)*d;p.y=4+p.id*2.8;}
  place(m,goal,d);const u=m.players[m.userId];m.ball={x:u.x,y:u.y,owner:u.id,flight:null};m.decision=true;return c;
}
test('a cross reaching me in the box offers 헤더 and 발리, not a dribble',async({page})=>{
  const c=setup('ST',(m,goal,d)=>{const u=m.players[m.userId];u.x=goal-d*8;u.y=33;m.aerial={to:u.id,until:m.clock+9};});
  await load(page,c);
  const attack=page.getByRole('group',{name:'공격 선택'});await expect(attack).toBeVisible();
  await expect(attack.getByRole('button',{name:/헤더/})).toBeVisible();await expect(attack.getByRole('button',{name:/발리/})).toBeVisible();
  await expect(page.getByRole('group',{name:'드리블 방향'})).toHaveCount(0);
  await expect(page.locator('.live-commentary')).toContainText('크로스가 날아옵니다');
  await attack.getByRole('button',{name:/헤더/}).click();await page.getByRole('button',{name:/헤더.*실행/}).click();
  await expect(page.locator('.live-commentary')).toContainText(/헤더|골|GOAL|선방|코너킥|세컨드 볼|처리/);
});
test('wide in the final third with a teammate in the box: 크로스 is offered and delivered',async({page})=>{
  const c=setup('LW',(m,goal,d)=>{const u=m.players[m.userId];u.x=goal-d*20;u.y=6;const st=m.players.find(p=>p.team===0&&p.pos==='ST')!;st.x=goal-d*9;st.y=35;
    // Two defenders deeper than the striker keep him onside.
    m.players.filter(p=>p.team===1&&p.pos==='CB').forEach((p,i)=>{p.x=goal-d*(5+i);p.y=28+i*14;});});
  await load(page,c);
  await page.getByRole('navigation',{name:'공격 방식'}).getByRole('button',{name:'패스',exact:true}).click();
  const attack=page.getByRole('group',{name:'공격 선택'});await expect(attack.getByRole('button',{name:/크로스/})).toBeVisible();
  await expect(attack.getByRole('button',{name:/크로스/}).locator('.cm-track i')).toHaveCount(1);
  await attack.getByRole('button',{name:/크로스/}).click();
  await expect(page.locator('.commentary')).toContainText(/크로스/);
});
test('as the corner taker I am asked to cross into the box',async({page})=>{
  const c=setup('LW',(m,goal,d)=>{const u=m.players[m.userId];u.x=goal-d*1;u.y=1;m.setPiece='corner';const st=m.players.find(p=>p.team===0&&p.pos==='ST')!;st.x=goal-d*8;st.y=34;});
  await load(page,c);
  await expect(page.locator('.live-commentary')).toContainText('코너킥 키커');
  await expect(page.getByRole('group',{name:'공격 선택'}).getByRole('button',{name:/크로스/})).toBeVisible();
});
