import {it,expect} from 'vitest';
import {newCareer,settle,nextSeason} from '../src/career';
import {finishMatch,random} from '../src/engine';
import {prepareWeek,playToday,startTodayMatch,isMatchToday,todayIndex,type Daily} from '../src/development';
import {encode,decode} from '../src/storage';
import {saturdays} from './saturdays';

const profile={name:'오늘선수',age:16,pos:'ST' as const,secondary:'LW' as const,foot:'오른',height:180,weight:72,style:'테크니션',curve:'꾸준한 성장형'};
const career=(seed=21)=>saturdays(newCareer(profile,0,seed));
const plan:Daily[]=['shooting','running','passing','rest','dribbling','rest','vacation'];

/** Plays one week day by day: Mon–Fri training, Saturday match, Sunday activity. */
function playDailyWeek(c:ReturnType<typeof career>,p:Daily[]=plan){
  for(let i=0;i<5;i++)playToday(c,p[i]);
  expect(isMatchToday(c)).toBe(true);
  startTodayMatch(c);finishMatch(c.match!);settle(c);
  expect(todayIndex(c)).toBe(6);expect(c.match).toBeNull();
  return playToday(c,p[6]);
}

it('a week played one day at a time equals the same week played with the weekly plan',()=>{
  const weekly=career(),daily=career();
  prepareWeek(weekly,[...plan]);finishMatch(weekly.match!);settle(weekly);
  const last=playDailyWeek(daily);
  expect(last.weekDone).toBe(true);
  expect(daily.player).toEqual(weekly.player);expect(daily.development.rival.player).toEqual(weekly.development.rival.player);
  expect(daily.week).toBe(1);expect(daily.day).toBe(weekly.day);expect(daily.history).toEqual(weekly.history);
  expect(daily.development.notes[0].entries).toEqual(weekly.development.notes[0].entries);
  expect(daily.development.active).toBeUndefined();expect(daily.development.plan).toEqual(plan);
  expect(daily.world.tables).toEqual(weekly.world.tables);
});

it('each tap ends the day: the date advances and the chosen training grows its attributes',()=>{
  const c=career(4);const start=c.day,before=c.player.a.passing;
  const r=playToday(c,'passing');
  expect(r.day).toBe(0);expect(c.day).toBe(start+1);expect(todayIndex(c)).toBe(1);expect(c.player.a.passing).toBeGreaterThan(before);
  expect(c.development.active?.mode).toBe('daily');expect(r.text).toContain('패스훈련');
  const shooting=c.player.a.shooting;playToday(c,'rest');expect(c.player.a.shooting).toBe(shooting);expect(c.day).toBe(start+2);
});

it('lucky fires with the trait-adjusted chance and is reported',()=>{
  const c=career(5);c.development.traits=[];
  let seed=0;for(;;seed++)if(random({seed})<.03)break;c.seed=seed;
  const r=playToday(c,'shooting');expect(r.lucky).toBe(true);expect(r.text).toContain('럭키! ×10');
  expect(c.development.news[0].kind).toBe('lucky');
});

it('match day blocks training, the match must be played, and Sunday follows the result',()=>{
  const c=career(6);for(let i=0;i<5;i++)playToday(c,'rest');
  expect(()=>playToday(c,'passing')).toThrow('경기가 있는 날');
  startTodayMatch(c);expect(c.match).not.toBeNull();expect(()=>playToday(c,'rest')).toThrow('진행 중인 경기');
  finishMatch(c.match!);settle(c);expect(c.week).toBe(0);expect(todayIndex(c)).toBe(6);
  expect(()=>startTodayMatch(c)).toThrow('경기일이 아닙니다');
  playToday(c,'rest');expect(c.week).toBe(1);expect(c.development.notes).toHaveLength(1);
});

it('daily weeks and weekly plans do not mix; a daily week survives save/load mid-week',()=>{
  const c=career(7);playToday(c,'passing');playToday(c,'running');
  expect(()=>prepareWeek(c,[...plan])).toThrow('오늘의 일정');
  const restored=decode(encode(c));for(const x of [c,restored]){playToday(x,'shooting');playToday(x,'rest');playToday(x,'dribbling');startTodayMatch(x);finishMatch(x.match!);settle(x);playToday(x,'rest');}
  expect(restored).toEqual(c);
  const w=career(8);prepareWeek(w,[...plan]);expect(()=>playToday(w,'rest')).toThrow('진행 중인 경기');
});

it('offseason: daily training with no match; next season starts even mid-week and closes that week',()=>{
  const c=career(9);c.world.phase='offseason';
  for(let i=0;i<4;i++){expect(isMatchToday(c)).toBe(false);playToday(c,'passing');}
  const week=c.week,notes=c.development.notes.length;
  nextSeason(c);saturdays(c);
  expect(c.development.active).toBeUndefined();expect(c.development.notes.length).toBe(notes+1);expect(c.development.notes[0].entries).toHaveLength(4);
  expect(c.week).toBeGreaterThan(week);expect(c.world.phase).toBe('league');expect(c.player.age).toBe(17);
  playToday(c,'rest');expect(todayIndex(c)).toBe(1);
});

it('a week left by the old weekly planner simply continues day by day',()=>{
  const c=career(12);playToday(c,'passing');delete c.development.active!.mode;
  const restored=decode(encode(c));playToday(restored,'running');
  expect(restored.development.active!.mode).toBe('daily');expect(todayIndex(restored)).toBe(2);
});

it('vacation without money is refused before the day passes',()=>{
  const c=career(10);c.development.wallet=0;const day=c.day;
  expect(()=>playToday(c,'vacation')).toThrow('5만원');expect(c.day).toBe(day);expect(c.development.active).toBeUndefined();
});
