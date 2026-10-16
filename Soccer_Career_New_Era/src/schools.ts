// Real high schools that field a football team, verified against public 2026
// competition records. Only the school name and region are real. Every player
// generated for a school is fictional; no student data, photos or logos are used.
//
// To add a school: give it a stable id (never reuse or rename ids — saves keep
// them), its 시·도, and at least one source key that shows the team playing in a
// recent official competition. Keep `verifiedAt` as the date the source was checked.

export const REGIONS=['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'] as const;
export type Region=typeof REGIONS[number];

export type SchoolSource={title:string,url:string,published:string,kind:'news'|'official'|'secondary'};
export const SCHOOL_SOURCES={
  wangjungwang:{title:'2026 고등 축구 왕중왕전 조편성 확정 (64개 팀)',url:'https://www.mediapen.com/news/view/1110188',published:'2026-07-14',kind:'news'},
  presidentCup:{title:'제59회 대통령금배 전국고등학교축구대회 조편성',url:'https://business.khan.co.kr/soccer/match?tab=group',published:'2026-07',kind:'official'},
  baengnok:{title:'2026 제34회 백록기 전국고등학교 축구대회 대진표',url:'https://soccer.all-lab.kr/entry/2026-34th-Baekrokgi-National-High-School-Soccer-Tournament-Match-Schedule',published:'2026-07-03',kind:'secondary'},
  daesung:{title:'세종대성고–대전대성고 축구부 스포츠 교류전',url:'https://www.newspim.com/news/view/20260710001433',published:'2026-07-10',kind:'news'},
  jinju:{title:'경남FC U18 진주고, K리그 아시안 유스 챔피언십 출격',url:'https://www.fourfourtwo.co.kr/news/articleView.html?idxno=96966',published:'2026-08-26',kind:'news'},
} as const satisfies Record<string,SchoolSource>;
export type SourceKey=keyof typeof SCHOOL_SOURCES;

export type School={id:string,name:string,region:Region,sources:SourceKey[],affiliation?:string,verifiedAt:string,status:'verified'};
const V='2026-10-16';
const s=(id:string,name:string,region:Region,sources:SourceKey[],affiliation?:string):School=>({id,name,region,sources,affiliation,verifiedAt:V,status:'verified'});

export const SCHOOLS_KR:School[]=[
  // 서울
  s('seoul-yeongdeungpo-tech','영등포공고','서울',['wangjungwang','presidentCup']),
  s('seoul-jungdong','중동고','서울',['wangjungwang','baengnok']),
  s('seoul-junggyeong','중경고','서울',['wangjungwang','presidentCup']),
  s('seoul-kyunghee','경희고','서울',['wangjungwang']),
  s('seoul-daedong-tax','대동세무고','서울',['wangjungwang']),
  s('seoul-kyungshin','경신고','서울',['wangjungwang','baengnok']),
  s('seoul-osan','오산고','서울',['wangjungwang'],'FC서울 U18'),
  s('seoul-janghun','장훈고','서울',['wangjungwang','baengnok']),
  s('seoul-boin','보인고','서울',['wangjungwang','presidentCup']),
  s('seoul-hanyang-scitech','한양과학기술고','서울',['wangjungwang','baengnok']),
  s('seoul-yongmun','용문고','서울',['presidentCup']),
  s('seoul-kwangwoon-ai','광운인공지능고','서울',['presidentCup']),
  s('seoul-paichai','배재고','서울',['presidentCup']),
  s('seoul-sangmoon','상문고','서울',['presidentCup']),
  s('seoul-soongsil','숭실고','서울',['presidentCup']),
  s('seoul-yeouido','여의도고','서울',['baengnok']),
  s('seoul-dongdaebu','동대부고','서울',['baengnok']),
  s('seoul-joongang','중앙고','서울',['baengnok']),
  // 경기
  s('gyeonggi-maetan','매탄고','경기',['wangjungwang'],'수원삼성 U18'),
  s('gyeonggi-anyang-tech','안양공고','경기',['wangjungwang','presidentCup']),
  s('gyeonggi-suwon','수원고','경기',['wangjungwang']),
  s('gyeonggi-suwon-tech','수원공고','경기',['wangjungwang','baengnok']),
  s('gyeonggi-gwangmun','광문고','경기',['wangjungwang']),
  s('gyeonggi-samil-tech','삼일공고','경기',['wangjungwang']),
  s('gyeonggi-goyang','고양고','경기',['wangjungwang','baengnok']),
  s('gyeonggi-yongho','용호고','경기',['wangjungwang']),
  s('gyeonggi-pungsaeng','풍생고','경기',['wangjungwang'],'성남FC U18'),
  s('gyeonggi-guri','구리고','경기',['presidentCup']),
  s('gyeonggi-choji','초지고','경기',['presidentCup']),
  s('gyeonggi-icheon-jeil','이천제일고','경기',['presidentCup']),
  s('gyeonggi-keimyung','계명고','경기',['presidentCup']),
  s('gyeonggi-neunggok','능곡고','경기',['baengnok']),
  s('gyeonggi-cheongun','청운고','경기',['baengnok']),
  // 인천
  s('incheon-bupyeong','부평고','인천',['wangjungwang','baengnok']),
  s('incheon-daegeon','대건고','인천',['wangjungwang'],'인천유나이티드 U18'),
  s('incheon-incheonnam','인천남고','인천',['presidentCup']),
  // 부산
  s('busan-bukyung','부경고','부산',['wangjungwang']),
  s('busan-dongrae','동래고','부산',['wangjungwang']),
  // 대구
  s('daegu-tech','대구공고','대구',['wangjungwang','baengnok']),
  s('daegu-daeryun','대륜고','대구',['wangjungwang']),
  s('daegu-hyeonpung','현풍고','대구',['wangjungwang'],'대구FC U18'),
  // 울산
  s('ulsan-haksung','학성고','울산',['wangjungwang','presidentCup']),
  s('ulsan-hyundai','현대고','울산',['wangjungwang'],'울산HD U18'),
  // 광주
  s('gwangju-kumho','금호고','광주',['wangjungwang'],'광주FC U18'),
  // 대전
  s('daejeon-daesung','대전대성고','대전',['daesung']),
  s('daejeon-yuseong-bioscience','유성생명과학고','대전',['baengnok']),
  // 세종
  s('sejong-daesung','세종대성고','세종',['daesung']),
  // 강원
  s('gangwon-gangneung-munsung','강릉문성고','강원',['wangjungwang']),
  s('gangwon-gangneung-joongang','강릉중앙고','강원',['wangjungwang','presidentCup']),
  s('gangwon-sangji-daegwallyeong','상지대관령고','강원',['presidentCup']),
  s('gangwon-mirae','강원미래고','강원',['presidentCup']),
  // 충북
  s('chungbuk-chungju-commercial','충주상고','충북',['wangjungwang']),
  s('chungbuk-unho','운호고','충북',['wangjungwang'],'청주FC U18'),
  s('chungbuk-jecheon-jeil','제천제일고','충북',['presidentCup']),
  s('chungbuk-chungju-chungwon','충주충원고','충북',['presidentCup']),
  // 충남
  s('chungnam-cheonan-jeil','천안제일고','충남',['wangjungwang']),
  s('chungnam-sinpyeong','신평고','충남',['wangjungwang','presidentCup']),
  // 전북
  s('jeonbuk-jeonju-youngsaeng','전주영생고','전북',['wangjungwang'],'전북현대 U18'),
  s('jeonbuk-gunsan-jeil','군산제일고','전북',['wangjungwang']),
  s('jeonbuk-jeonju-tech','전주공고','전북',['wangjungwang']),
  s('jeonbuk-gochang-buk','고창북고','전북',['baengnok']),
  // 전남
  s('jeonnam-mokpo-tech','목포공고','전남',['wangjungwang','baengnok']),
  // 경북
  s('gyeongbuk-yeil-meditech','예일메디텍고','경북',['wangjungwang','presidentCup']),
  s('gyeongbuk-natural-science','경북자연과학고','경북',['wangjungwang']),
  s('gyeongbuk-gyeongju-info','경주정보고','경북',['presidentCup']),
  s('gyeongbuk-global-sunjin','글로벌선진고','경북',['baengnok']),
  // 경남
  s('gyeongnam-jinju','진주고','경남',['jinju'],'경남FC U18'),
  s('gyeongnam-changwon-mech','창원기계공고','경남',['baengnok']),
  // 제주
  s('jeju-daegi','대기고','제주',['wangjungwang','baengnok']),
  s('jeju-seogwipo','서귀포고','제주',['baengnok']),
  s('jeju-ohyun','오현고','제주',['baengnok']),
  s('jeju-jeil','제주제일고','제주',['baengnok']),
  s('jeju-joongang','제주중앙고','제주',['baengnok']),
];

const BY_ID=new Map(SCHOOLS_KR.map(x=>[x.id,x]));
export const schoolById=(id:string)=>BY_ID.get(id);
export const schoolsIn=(region:Region)=>SCHOOLS_KR.filter(x=>x.region===region);
export const searchSchools=(q:string,region?:Region)=>{const t=q.trim().replace(/\s/g,'');return SCHOOLS_KR.filter(x=>(!region||x.region===region)&&(!t||(x.name+x.region+(x.affiliation??'')).replace(/\s/g,'').includes(t)));};
export const DISCLAIMER='학교명과 지역만 2026년 공개 대회 자료로 축구부 운영을 확인했습니다. 선수 이름·능력치·특성은 모두 무작위로 만든 가상 인물이며 실제 학생, 사진, 학교 로고와 관계가 없습니다.';
