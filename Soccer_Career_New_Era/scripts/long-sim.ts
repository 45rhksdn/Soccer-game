// Long career simulation (balance check). Usage: npx tsx scripts/long-sim.ts [careers] [seasons]
// Plays whole careers week by week with a sensible bot (trains 4 days, rests otherwise,
// takes the best offer) and prints the user's / rival's role ability by age next to the
// best players of the top league, so growth speed can be compared before and after tuning.
import {newCareer,nextSeason,settle} from '../src/career';
import {finishMatch} from '../src/engine';
import {prepareWeek,type Daily} from '../src/development';
import {acceptOffer,clubOf} from '../src/world';
import {roleAbility} from '../src/roles';

const careers=Number(process.argv[2]??6),maxSeasons=Number(process.argv[3]??20);
const plan:Daily[]=['shooting','running','passing','rest','dribbling','rest','rest'];
type Row={age:number,user:number,rival:number,top5:number,topBest:number,league:number,lgAvg:number};
const rows:Row[][]=[];
for(let n=0;n<careers;n++){
  const curve=['꾸준한 성장형','조기 성장형','대기만성형'][n%3];
  const c=newCareer({name:'시뮬'+n,age:16,pos:(['ST','CM','CB'] as const)[n%3],secondary:'LW',foot:'오른',height:180,weight:72,style:'테크니션',curve},n%3,1000+n*77);
  c.development.traits=[];
  const out:Row[]=[];let seasons=0,guard=0;
  const record=()=>{const top=c.world.clubs.filter(x=>x.league===3).flatMap(x=>x.roster).filter(p=>p.pos!=='GK').map(p=>roleAbility(p.a,p.pos)).sort((a,b)=>b-a);
    const own=clubOf(c.world).roster.map(p=>roleAbility(p.a,p.pos));
    out.push({age:c.player.age,user:roleAbility(c.player.a,c.player.pos),rival:roleAbility(c.development.rival.player.a,c.development.rival.player.pos),top5:top.slice(0,5).reduce((a,b)=>a+b,0)/5,topBest:top[0],league:clubOf(c.world).league,lgAvg:own.reduce((a,b)=>a+b,0)/own.length});};
  while(seasons<maxSeasons&&guard++<2000&&c.world.phase!=='retired'){
    if(c.world.phase==='offseason'){
      if((c.player.age>=18&&clubOf(c.world).league===0)||(clubOf(c.world).league>0&&c.world.contract.years===0)){
        const offer=[...c.world.offers].filter(o=>o.status==='open').sort((a,b)=>c.world.clubs.find(x=>x.id===b.clubId)!.league-c.world.clubs.find(x=>x.id===a.clubId)!.league)[0];
        if(!offer){c.world.currentDay=c.day;prepareWeek(c,[...plan]);continue;}
        acceptOffer(c.world,offer.clubId,c.player.name);
      }
      record(); // end of the season at this age (before the birthday and the yearly aging)
      nextSeason(c);seasons++;continue;
    }
    prepareWeek(c,[...plan]);
    if(c.match){finishMatch(c.match);settle(c);}
  }
  rows.push(out);
}
const ages=[...new Set(rows.flat().map(r=>r.age))].sort((a,b)=>a-b);
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:NaN;
console.log('age (end of season) | user | rival | top-league best5 | top best | user league | club avg');
for(const age of ages){const rs=rows.flat().filter(r=>r.age===age);
  console.log(`${age} | ${avg(rs.map(r=>r.user)).toFixed(1)} | ${avg(rs.map(r=>r.rival)).toFixed(1)} | ${avg(rs.map(r=>r.top5)).toFixed(1)} | ${avg(rs.map(r=>r.topBest)).toFixed(1)} | ${avg(rs.map(r=>r.league)).toFixed(1)} | ${avg(rs.map(r=>r.lgAvg)).toFixed(1)}`);}
const peak=rows.map(r=>r.reduce((b,x)=>x.user>b.user?x:b));
console.log('peak age per career:',peak.map(p=>p.age).join(','),'· peak ability:',peak.map(p=>p.user.toFixed(1)).join(','));
