// 0.14 player back-stories. Every player is fictional: only the school name, its region and its pro-club
// affiliation (schools.ts) are real, and the story never claims anything about the real school beyond that.
// Grounded in the player's actual numbers (strengths, weakness, growth curve, foot, height, traits) and
// deterministic per player id — the same candidate always tells the same story, and reading it uses no game RNG.
import {random,type Attr,type Attributes,type Position} from './engine';
import {seedFrom,TRAIT_DEFS} from './traits';

export type StoryText={headline:string,chapters:string[],quote:string};
export type StorySchool={name:string,region?:string,affiliation?:string};
export type StorySubject={name:string,age:number,pos:Position,foot:string,height:number,style:string,curve:string,a:Attributes,traits?:string[]};

/** Final-consonant aware particles (은/는, 이/가, 을/를, 과/와, 으로/로). */
function batchim(word:string){const c=word.trim().charCodeAt(word.trim().length-1);return c>=0xac00&&c<=0xd7a3?(c-0xac00)%28:0;}
export const josa=(word:string,pair:'은는'|'이가'|'을를'|'과와'|'으로'|'이다'|'이라는')=>{
 const b=batchim(word);
 if(pair==='으로')return word+(b===0||b===8?'로':'으로');
 if(pair==='이다')return word+(b?'이다':'다');
 if(pair==='이라는')return word+(b?'이라는':'라는');
 return word+(b?pair[0]:pair[1]);
};

const POS:Record<Position,{label:string,noun:string,goal:string}>={
 ST:{label:'스트라이커',noun:'골잡이',goal:'전국대회 무대에서 터뜨리는 첫 골'},
 CM:{label:'중앙 미드필더',noun:'사령관',goal:'경기의 흐름을 바꾸는 결정적인 패스'},
 CB:{label:'센터백',noun:'수비 리더',goal:'전국대회에서의 무실점 경기'},
 LW:{label:'왼쪽 윙어',noun:'측면 돌격대장',goal:'측면을 무너뜨리고 올리는 결승골 도움'},
 RW:{label:'오른쪽 윙어',noun:'측면 돌격대장',goal:'측면을 무너뜨리고 올리는 결승골 도움'},
 LB:{label:'왼쪽 풀백',noun:'측면 지킴이',goal:'측면을 오르내리며 만드는 공격 포인트'},
 RB:{label:'오른쪽 풀백',noun:'측면 지킴이',goal:'측면을 오르내리며 만드는 공격 포인트'},
 GK:{label:'골키퍼',noun:'수문장',goal:'승부차기에서 막아 내는 마지막 킥'},
};

/** Region scenery: general geography only (no real people, clubs' history or school facts). */
const REGION:Record<string,{tag:string,scenes:string[],moments:string[]}>={
 서울:{tag:'빌딩 숲 골목이 키운',scenes:['빌딩 사이로 해가 지는 좁은 인조잔디 구장','한강 둔치를 따라 저녁마다 달리던 길'],moments:['야간 조명이 꺼질 때까지 마지막으로 남는 건 늘 그였다','막차 지하철에서 그날 경기를 머릿속으로 다시 돌려 보는 게 습관이다']},
 부산:{tag:'바닷바람이 키운',scenes:['짠 바닷바람이 불어오는 해안가 공터','파도 소리가 들리는 모래사장'],moments:['훈련이 끝나면 방파제를 따라 달리는 게 하루의 마무리다','관중석의 사투리 섞인 응원이 들리면 다리에 힘이 붙는다고 말한다']},
 대구:{tag:'분지의 열기를 견딘',scenes:['한여름 분지의 열기가 고스란히 내려앉는 운동장','더위가 늦게까지 가시지 않는 저녁 구장'],moments:['35도가 넘는 날에도 운동장을 떠나지 않아 \'더위 안 타는 애\'로 불렸다','여름 방학 내내 해가 진 뒤에야 공을 놓았다']},
 인천:{tag:'항구의 바람을 맞은',scenes:['비행기가 낮게 지나가는 바닷가 동네 구장','항구 크레인이 멀리 보이는 운동장'],moments:['바닷가 갯바람 속에서 롱패스를 수백 번씩 연습했다','비행기가 머리 위로 지날 때마다 언젠가 저걸 타고 원정을 가겠다고 생각했다']},
 광주:{tag:'무등산 자락에서 자란',scenes:['무등산이 내려다보는 동네 운동장','산자락 아래 흙먼지 날리는 공터'],moments:['주말마다 산길을 뛰어오르며 심장을 단련했다','동네 어르신들이 가장 먼저 알아보는 \'운동장 그 학생\'이다']},
 대전:{tag:'갑천변을 달리던',scenes:['갑천변 산책로를 따라 이어진 달리기 코스','도시 한가운데 작은 체육공원'],moments:['강변 달리기 기록표를 방 벽에 붙여 두고 매주 줄여 간다','도시 한가운데서도 공 찰 곳을 찾아내는 데는 선수다']},
 울산:{tag:'공업도시의 근성을 품은',scenes:['공장 굴뚝과 바다가 함께 보이는 구장','태화강 둔치의 넓은 잔디밭'],moments:['교대 근무를 마친 아버지가 새벽 훈련장까지 차로 데려다 주곤 했다','강바람이 부는 둔치에서 혼자 슈팅 연습을 하는 게 일상이다']},
 세종:{tag:'새 도시의 첫 세대인',scenes:['막 지어진 신도시의 새 운동장','호수공원 둘레를 따라 뛰던 길'],moments:['새 도시에서 처음 생긴 축구부 친구들과 함께 자랐다','공터가 운동장으로 바뀌는 걸 지켜보며 함께 컸다']},
 경기:{tag:'주말 원정이 단련한',scenes:['주말마다 수도권 곳곳으로 원정을 다니던 리그 경기장','신도시 아파트 단지 사이 풋살장'],moments:['주말 리그 원정 버스 안에서 상대 팀 영상을 돌려 보는 게 버릇이다','수많은 또래 경쟁자 사이에서 살아남는 법을 일찍 배웠다']},
 강원:{tag:'눈밭에서 단련된',scenes:['겨울이면 눈을 직접 치우고 훈련하던 운동장','산을 오르내리며 다리를 단련하던 언덕길'],moments:['겨울이면 눈 덮인 운동장을 친구들과 직접 치우고 훈련을 시작했다','언덕길 전력 질주가 그의 하루 첫 훈련이다']},
 충북:{tag:'내륙의 뚝심을 지닌',scenes:['바다 없는 내륙, 들판 사이에 자리한 운동장','논밭 너머로 노을이 지는 학교 구장'],moments:['바다를 처음 본 것도 축구 대회 원정길에서였다','들판 사이 학교 운동장을 수천 바퀴 돌며 체력을 쌓았다']},
 충남:{tag:'들녘 바람을 맞은',scenes:['논두렁 사이 시골 학교 운동장','서해로 이어지는 들녘의 바람'],moments:['논두렁 길을 달려 학교에 오가며 다리를 단련했다','작은 학교 운동장이 그에게는 가장 큰 무대였다']},
 전북:{tag:'평야를 가로지른',scenes:['끝없이 펼쳐진 평야 사이 학교 운동장','바람이 막힘없이 지나가는 들판 구장'],moments:['평야를 가로지르는 바람을 맞으며 긴 패스의 감각을 익혔다','들판 너머로 해가 질 때까지 혼자 공을 찼다']},
 전남:{tag:'남도의 바다를 닮은',scenes:['섬과 바다가 가까운 남도의 작은 운동장','갯벌 냄새가 실려 오는 바닷가 공터'],moments:['섬마을 친구들과 배를 타고 건너가 연습 경기를 한 적도 있다','바닷가 모래밭에서 뛰며 균형 감각을 길렀다']},
 경북:{tag:'산과 바다를 모두 품은',scenes:['산자락과 동해 바다 사이 운동장','오래된 돌담길 옆 흙 구장'],moments:['동해 바닷바람 속에서 공을 다루는 법을 익혔다','오래된 돌담길을 따라 매일 새벽 달리기를 한다']},
 경남:{tag:'남해의 햇살을 받은',scenes:['남해 바다가 반짝이는 언덕 위 운동장','지리산 줄기가 멀리 보이는 학교 구장'],moments:['남해의 햇볕에 그을린 얼굴이 그의 트레이드마크다','산자락 계단 수백 개를 오르내리는 것이 그만의 훈련이다']},
 제주:{tag:'돌담 바람을 가르는',scenes:['돌담 사이로 바람이 몰아치는 운동장','겨울에도 푸른 잔디 위에서 전국 팀들의 전지훈련을 지켜보던 구장'],moments:['겨울마다 섬을 찾는 전국 팀들의 전지훈련을 보며 꿈을 키웠다','거센 섬 바람 속에서 공을 띄우지 않고 낮게 차는 법을 익혔다']},
};
const GENERIC={tag:'동네 운동장에서 자란',scenes:['해 질 녘까지 아이들 소리가 끊이지 않던 동네 운동장','아파트 단지 뒤편의 작은 풋살장'],moments:['해가 져도 운동장 조명 아래 마지막까지 남는 아이였다','학교 담벼락에 공을 차며 혼자 패스 연습을 했다']};

type Group={keys:Attr[],title:string,strong:string,weak:string,praise:string,advice:string};
const GROUPS:Group[]=[
 {keys:['speed','acceleration'],title:'바람처럼 빠른',strong:'한 번 속도가 붙으면 따라잡기 힘든 스피드',weak:'순간 스피드',praise:'저 속도는 가르쳐서 되는 게 아니야.',advice:'발이 느리면 머리가 빨라야 해. 한 박자 먼저 움직여.'},
 {keys:['passing','vision','longPassing'],title:'시야가 넓은',strong:'동료의 움직임을 먼저 읽고 공을 내주는 시야',weak:'패스의 정확도',praise:'공을 받기 전에 이미 다음 그림을 그리고 있어.',advice:'공을 받기 전에 주변을 한 번 더 둘러봐라.'},
 {keys:['dribbling','control'],title:'공을 발끝에 붙이고 다니는',strong:'좁은 공간에서도 공을 발끝에 붙여 두는 볼 터치',weak:'볼 컨트롤',praise:'발밑은 이미 고등학생 수준을 넘었어.',advice:'첫 터치만 안정되면 모든 게 쉬워질 거다.'},
 {keys:['defending','marking','sliding'],title:'한 발도 물러서지 않는',strong:'상대의 첫 터치를 노리는 끈질긴 수비',weak:'수비 집중력',praise:'저 녀석 앞에서는 공격수들이 고개를 숙이고 다녀.',advice:'공을 잃은 뒤의 3초, 그때 먼저 달려드는 선수가 돼라.'},
 {keys:['shooting','finishing','positioning'],title:'골 냄새를 맡는',strong:'골문 앞에서 차갑게 가라앉는 마무리',weak:'마무리 능력',praise:'박스 안에서 저렇게 침착한 애는 오랜만이야.',advice:'골문 앞에서는 한 번 더 침착해져야 해.'},
 {keys:['strength','stamina'],title:'지칠 줄 모르는',strong:'90분 내내 지치지 않는 체력과 몸싸움',weak:'체력과 몸싸움',praise:'경기 막판에도 첫 1분처럼 뛰는 선수다.',advice:'후반에도 버틸 몸을 만들자. 그게 다음 단계다.'},
];
const avg=(a:Attributes,keys:Attr[])=>keys.reduce((n,k)=>n+a[k],0)/keys.length;

const HOOKS:Record<string,string[]>={
 '대기만성형':['중학교 2학년이 되어서야 처음 축구화를 신은 늦깎이다','육상부에서 달리기를 하다 뒤늦게 축구로 전향했다','태권도장에 다니다 친구 손에 이끌려 처음 축구부 테스트를 봤다'],
 '조기 성장형':['초등학교 때부터 동네 대회 득점왕으로 이름이 알려졌다','또래보다 한 뼘 먼저 자라 늘 한 학년 위 형들과 공을 찼다','중학교 시절 이미 지역 선발에 뽑혀 기대를 한 몸에 받았다'],
 '꾸준한 성장형':['하루도 빠짐없이 새벽 개인 훈련을 이어 온 연습벌레다','훈련 일지를 초등학교 때부터 한 권도 빠짐없이 써 왔다','비가 와도 혼자 운동장에 나가 벽에 공을 차던 아이였다'],
};
const MOTIVES=[
 '부모님은 늦게까지 가게 문을 닫지 못하지만, 경기가 있는 날이면 꼭 녹화한 영상을 함께 돌려 본다.',
 '할머니가 처음 사 준 낡은 축구공을 아직도 방 한쪽에 간직하고 있다.',
 '부상으로 축구를 그만둔 형의 꿈을 대신 이어 가겠다고 마음먹었다.',
 '전학 첫날, 말 한마디 없이 운동장에서 공 하나로 친구들을 사귀었다.',
 '중학교 3학년 때 큰 부상으로 1년을 쉬었고, 그 시간 동안 경기 영상을 보며 축구를 다시 배웠다.',
 '동네 풋살장에서 일을 도우며 첫 축구화 값을 직접 모았다.',
 '한 번 진 상대에게는 다음 경기에서 반드시 갚아 주는 지독한 승부욕으로 유명하다.',
 '경기장에 처음 데려가 준 삼촌의 응원 문자를 경기 전마다 다시 읽는다.',
];
const FOOT:Record<string,string>={'오른':'오른발','왼':'왼발','양':'양발'};

/** Headline, four short chapters and a coach's line for one player. Pure (no game RNG), deterministic per `id`. */
export function playerStory(p:StorySubject,school:StorySchool|null,id:string):StoryText{
 const r={seed:seedFrom(0,'story:'+id)};
 const pick=<T,>(xs:readonly T[])=>xs[Math.floor(random(r)*xs.length)];
 const region=(school?.region&&REGION[school.region])||GENERIC;
 const ranked=[...GROUPS].sort((x,y)=>avg(p.a,y.keys)-avg(p.a,x.keys));
 // The weakness that matters for the position (a centre-back is not judged on finishing, a winger not on tackling).
 const irrelevant:Partial<Record<Position,Attr>>={CB:'shooting',LB:'shooting',RB:'shooting',GK:'shooting',ST:'defending',LW:'defending',RW:'defending'};
 const relevant=ranked.filter(g=>!g.keys.includes(irrelevant[p.pos] as Attr));
 const top=ranked[0],weak=relevant[relevant.length-1],pos=POS[p.pos]??POS.CM,foot=FOOT[p.foot]??'오른발';
 const schoolName=school?.name??'고등학교';
 const place=school?.region==='경기'?'경기도':school?.region??'우리 동네';
 const headline=pick([`${region.tag} ${foot} ${pos.label}`,`${top.title} ${place}의 ${pos.noun}`,`${schoolName}에 나타난 ${top.title} ${pos.label}`]);
 const scene=pick(region.scenes),moment=pick(region.moments),hook=pick(HOOKS[p.curve]??HOOKS['꾸준한 성장형']),motive=pick(MOTIVES);
 const background=`${scene}에서 공을 차며 자란 ${p.name}. ${hook}. ${moment}.`;
 const why=school?.affiliation
  ? `${motive} ${josa(schoolName,'은는')} ${school.affiliation} 유스팀이다. 프로 형들이 뛰는 경기를 보며 언젠가 그 자리에 서겠다고 다짐한다.`
  : `${motive} ${schoolName} 축구부에 들어온 것도 그 마음 하나였다.`;
 const traits=(p.traits??[]).map(t=>TRAIT_DEFS.find(d=>d.id===t)).filter((d):d is typeof TRAIT_DEFS[number]=>!!d);
 const good=traits.find(t=>t.polarity==='positive'),bad=traits.find(t=>t.polarity!=='positive');
 const play=`${p.height}cm의 ${foot} ${pos.label}. 무기는 ${josa(top.strong,'이다')}. 반면 ${josa(weak.weak,'은는')} 아직 숙제로 남아 있다.`
  +(good?` 코치진은 그에게서 '${good.id}'의 기질을 엿봤다.`:'')+(bad?` ${josa(`'${bad.id}`,'이라는').replace(/(이라는|라는)$/,"'$1")} 꼬리표를 떼어 내는 것도 올해의 과제다.`:'');
 const goal=`목표는 ${schoolName}의 주전 자리, 그리고 ${pos.goal}. ${p.age}살의 ${josa(pos.noun,'이가')} 지금 첫 페이지를 넘긴다.`;
 const quote=`“${top.praise} ${weak===top?'':weak.advice}”`.replace(' ”','”');
 return {headline,chapters:[background,why,play,goal],quote};
}
