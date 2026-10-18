// 0.14 the scout's words for how far a student might go: which league, at what level.
// Built from the scout's estimate range (scouting.ts potentialRange, which always contains the true
// potential) and the leagues' actual club levels (leagues.ts), so it is approximate by design and never
// prints the hidden number.
import {LEAGUE_DATA,leagueLevel} from './leagues';

type Tier={min:number,text:string};
const pro=LEAGUE_DATA.filter(l=>l.id>0).map(l=>({name:l.name,avg:leagueLevel(l.id),top:Math.max(...l.clubs.map(c=>c[1]))})).sort((a,b)=>b.avg-a.avg);

/** The level a player of overall `v` would hold, in words (e.g. "네덜란드 에레리그·브라질 삼바 A 주전급"). */
export function levelPhrase(v:number){
  const best=pro.find(l=>v>=l.avg+2);
  if(!best){const k=pro[pro.length-1];return `${k.name} 로테이션 선수`;}
  if(best===pro[0]&&v>=best.top)return `${best.name} 같은 최정상 리그 우승 경쟁 팀의 핵심`;
  const peers=pro.filter(l=>l.avg<=best.avg&&l.avg>=best.avg-3).slice(0,2).map(l=>l.name);
  return v>=best.top-1?`${peers.join('·')} 상위권 팀의 핵심`:`${peers.join('·')} 주전급`;
}
const CERTAINTY:Tier[]=[{min:2,text:'선배들이 남긴 기록 덕분에 스카우트의 판단에 꽤 자신이 있습니다.'},{min:1,text:'선배들의 성장 기록과 비교해 보니 윤곽이 조금 보입니다.'},{min:0,text:'아직 어린 선수라 예측은 언제든 뒤집힐 수 있습니다.'}];

/**
 * One or two sentences: the likely ceiling (middle of the estimate), what it could be if everything goes
 * right (top of the estimate), and how sure the scout is. Pure and deterministic.
 */
export function potentialForecast(range:[number,number],scoutLevel=0){
  const [lo,hi]=range,mid=(lo+hi)/2,likely=levelPhrase(mid),best=levelPhrase(hi),floor=levelPhrase(lo);
  const head=`스카우트 평가: 꾸준히 성장한다면 전성기에 ${likely}까지 바라볼 수 있는 재목입니다.`;
  const up=best!==likely?` 모든 것이 맞아떨어지면 ${best}도 꿈이 아닙니다.`:'';
  const down=floor!==likely&&scoutLevel<2?` 다만 성장이 더디면 ${floor}에 머물 수도 있습니다.`:'';
  return head+up+down+' '+CERTAINTY.find(t=>scoutLevel>=t.min)!.text;
}
