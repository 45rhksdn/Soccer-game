/** Independent fictional clubs; ratings are game calibration, not official player ratings. */
/** 0.14 money in 만원 (KRW 10,000). `income`: a season's budget income ≈ 30 average salaries. */
export type LeagueDef={id:number,name:string,country:string,confederation:'학교'|'아시아'|'유럽'|'남미',salary:number,income:number,development:number,clubs:readonly [string,number][]};
export const LEAGUE_DATA:LeagueDef[]=[
 {id:0,name:'전국 고교 리그',country:'한국',confederation:'학교',salary:0,income:0,development:1,clubs:[['부산 해온고',44],['서울 한울고',45],['수원 청명고',46],['인천 새봄고',43],['대전 미래고',42],['광주 빛고을고',44]]},
 {id:1,name:'K-프리미어',country:'한국',confederation:'아시아',salary:2,income:450000,development:1,clubs:[['울산 타이거스',63],['전주 그린모터스',62],['포항 아이언스',60],['서울 캐피털',59],['대전 퍼플시티',57],['광주 라이트',55]]},
 {id:2,name:'네덜란드 에레리그',country:'네덜란드',confederation:'유럽',salary:4,income:2400000,development:1.22,clubs:[['아인트호벤 일렉트릭',78],['암스테르담 아카데미',75],['로테르담 레드포트',75],['알크마르 노스',70],['엔스헤데 레즈',68],['위트레흐트 센트럴',65]]},
 {id:3,name:'잉글랜드 크라운리그',country:'잉글랜드',confederation:'유럽',salary:10,income:16500000,development:1.12,clubs:[['맨체스터 스카이블루',85],['리버포트 레즈',85],['북런던 캐논즈',84],['런던 블루브리지',80],['맨체스터 레드유나이티드',77],['머지사이드 블루스',73]]},
 {id:4,name:'J-프라임',country:'일본',confederation:'아시아',salary:3,income:750000,development:1.12,clubs:[['고베 크림슨',67],['가시마 앤틀러스톤',66],['히로시마 퍼플애로',65],['우라와 레드리버',64],['가와사키 블루웨이브',63],['쇼난 씨그린',57]]},
 {id:5,name:'사우디 로열리그',country:'사우디',confederation:'아시아',salary:12,income:7500000,development:.93,clubs:[['리야드 블루크레센트',78],['리야드 골든스타',75],['제다 블랙골드',75],['제다 그린캐슬',74],['담맘 이스턴',62],['부라이다 데저트',56]]},
 {id:6,name:'튀르키예 스타리그',country:'튀르키예',confederation:'유럽',salary:5,income:3000000,development:1,clubs:[['이스탄불 골든라이온',77],['이스탄불 옐로카나리',76],['이스탄불 블랙이글',71],['트라브존 블루버건디',68],['삼순 레드코스트',64],['콘야 그린이글',60]]},
 {id:7,name:'이탈리아 칼초 A',country:'이탈리아',confederation:'유럽',salary:8,income:6600000,development:1.08,clubs:[['밀라노 네라주라',84],['나폴리 아줄레',81],['토리노 비안코네리',80],['밀라노 로쏘네라',79],['베르가모 블루블랙',78],['레체 살렌토',69]]},
 {id:8,name:'스페인 솔리가',country:'스페인',confederation:'유럽',salary:8,income:7500000,development:1.15,clubs:[['마드리드 로열화이트',86],['바르셀로나 블라우',85],['마드리드 레드스트라이프',81],['빌바오 바스크라이온',77],['비야레알 옐로서브',76],['발렌시아 오렌지',71]]},
 {id:9,name:'브라질 삼바 A',country:'브라질',confederation:'남미',salary:4,income:1200000,development:1.17,clubs:[['리우 루브로',77],['상파울루 베르데',77],['리우 블랙스타',74],['상파울루 트리컬러',72],['산투스 코스트',67],['헤시피 루브로',62]]},
 {id:10,name:'프랑스 리그 엘리트',country:'프랑스',confederation:'유럽',salary:7,income:5400000,development:1.2,clubs:[['파리 루미에르',85],['마르세유 블루하버',77],['모나코 프린스',77],['릴 레드도그',75],['리옹 에투알',74],['낭트 카나리',65]]},
 {id:11,name:'독일 분데스엘프',country:'독일',confederation:'유럽',salary:8,income:7500000,development:1.16,clubs:[['뮌헨 바바리아',85],['레버쿠젠 팩토리',81],['도르트문트 옐로월',80],['라이프치히 레드차지',78],['프랑크푸르트 이글',76],['마인츠 카니발',69]]},
];
export const leagueDef=(id:number)=>LEAGUE_DATA[id]??LEAGUE_DATA[0];
export const WORLD_CLUB_COUNT=LEAGUE_DATA.reduce((n,l)=>n+l.clubs.length,0);
export const LEAGUES=LEAGUE_DATA.map(l=>l.name);
export const leagueNames=LEAGUE_DATA.map(l=>l.clubs.map(c=>c[0]));
export const leagueLevel=(id:number)=>leagueDef(id).clubs.reduce((s,c)=>s+c[1],0)/leagueDef(id).clubs.length;

/** 0.14 average first-team salary per league (만원/year), roughly today's real leagues; 0 = school. */
export const AVG_SALARY=[0,15000,80000,550000,25000,250000,100000,220000,250000,40000,180000,250000] as const;
/** Season income before 0.14 (for migrating older saves). */
export const OLD_INCOME=[0,3500,9000,26000,5000,30000,11000,20000,20000,9000,16000,20000] as const;
