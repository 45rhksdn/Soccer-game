/** 0.15 real club names (no logos, crests or real players — every player is generated). Club levels are game
 * calibration targets, not official ratings. Pro leagues have 8 clubs; the first 6 keep their pre-0.15 ids (c0…c71),
 * the 7th and 8th get c72… (see world.clubId). The school league keeps its 6 fictional schools. */
/** 0.14 money in 만원 (KRW 10,000). `income`: a season's budget income ≈ 30 average salaries. */
export type LeagueDef={id:number,name:string,country:string,confederation:'학교'|'아시아'|'유럽'|'남미',salary:number,income:number,development:number,clubs:readonly [string,number][]};
export const LEAGUE_DATA:LeagueDef[]=[
 {id:0,name:'전국 고교 리그',country:'한국',confederation:'학교',salary:0,income:0,development:1,clubs:[['부산 해온고',44],['서울 한울고',45],['수원 청명고',46],['인천 새봄고',43],['대전 미래고',42],['광주 빛고을고',44]]},
 {id:1,name:'K리그1',country:'한국',confederation:'아시아',salary:2,income:450000,development:1,clubs:[['울산 HD',63],['전북 현대',62],['포항 스틸러스',60],['FC 서울',59],['대전 하나시티즌',57],['광주 FC',55],['강원 FC',59],['인천 유나이티드',58]]},
 {id:2,name:'네덜란드 에레디비시',country:'네덜란드',confederation:'유럽',salary:4,income:2400000,development:1.22,clubs:[['PSV 에인트호번',78],['아약스',75],['페예노르트',75],['AZ 알크마르',70],['FC 트벤테',68],['FC 위트레흐트',65],['SC 헤이렌베인',67],['FC 흐로닝언',63]]},
 {id:3,name:'잉글랜드 프리미어리그',country:'잉글랜드',confederation:'유럽',salary:10,income:16500000,development:1.12,clubs:[['맨체스터 시티',85],['리버풀',85],['아스널',84],['첼시',80],['맨체스터 유나이티드',77],['에버턴',73],['뉴캐슬 유나이티드',79],['토트넘',76]]},
 {id:4,name:'일본 J1리그',country:'일본',confederation:'아시아',salary:3,income:750000,development:1.12,clubs:[['비셀 고베',67],['가시마 앤틀러스',66],['산프레체 히로시마',65],['우라와 레즈',64],['가와사키 프론탈레',63],['감바 오사카',61],['마치다 젤비아',65],['세레소 오사카',63]]},
 {id:5,name:'사우디 프로리그',country:'사우디',confederation:'아시아',salary:12,income:7500000,development:.93,clubs:[['알힐랄',78],['알나스르',75],['알이티하드',75],['알아흘리',74],['알에티파크',62],['알타아운',56],['알카디시아',70],['알파테흐',61]]},
 {id:6,name:'튀르키예 쉬페르리그',country:'튀르키예',confederation:'유럽',salary:5,income:3000000,development:1,clubs:[['갈라타사라이',77],['페네르바흐체',76],['베식타시',71],['트라브존스포르',68],['삼순스포르',64],['코니아스포르',60],['이스탄불 바샥셰히르',66],['괴즈테페',62]]},
 {id:7,name:'이탈리아 세리에 A',country:'이탈리아',confederation:'유럽',salary:8,income:6600000,development:1.08,clubs:[['인터 밀란',84],['나폴리',81],['유벤투스',80],['AC 밀란',79],['아탈란타',78],['레체',69],['AS 로마',78],['볼로냐',76]]},
 {id:8,name:'스페인 라리가',country:'스페인',confederation:'유럽',salary:8,income:7500000,development:1.15,clubs:[['레알 마드리드',86],['바르셀로나',85],['아틀레티코 마드리드',81],['아틀레틱 클루브',77],['비야레알',76],['발렌시아',71],['레알 베티스',75],['레알 소시에다드',74]]},
 {id:9,name:'브라질 세리에 A',country:'브라질',confederation:'남미',salary:4,income:1200000,development:1.17,clubs:[['플라멩구',77],['파우메이라스',77],['보타포구',74],['상파울루',72],['산투스',67],['크루제이루',70],['코린치앙스',70],['플루미넨시',72]]},
 {id:10,name:'프랑스 리그 1',country:'프랑스',confederation:'유럽',salary:7,income:5400000,development:1.2,clubs:[['파리 생제르맹',85],['마르세유',77],['AS 모나코',77],['릴',75],['리옹',74],['낭트',65],['랑스',76],['스타드 렌',72]]},
 {id:11,name:'독일 분데스리가',country:'독일',confederation:'유럽',salary:8,income:7500000,development:1.16,clubs:[['바이에른 뮌헨',85],['레버쿠젠',81],['도르트문트',80],['RB 라이프치히',78],['프랑크푸르트',76],['마인츠',69],['슈투트가르트',77],['프라이부르크',74]]},
];
export const leagueDef=(id:number)=>LEAGUE_DATA[id]??LEAGUE_DATA[0];
export const WORLD_CLUB_COUNT=LEAGUE_DATA.reduce((n,l)=>n+l.clubs.length,0);
/** Club counts before 0.15 (6 per league) — for migrating older saves. */
export const OLD_WORLD_CLUB_COUNT=LEAGUE_DATA.length*6;
/** Stable club id of club i of league l: the first six keep l*6+i, extra pro clubs follow after the old 72. */
export const clubIdOf=(l:number,i:number)=>i<6?'c'+(l*6+i):'c'+(OLD_WORLD_CLUB_COUNT+(l-1)*2+(i-6));
export const LEAGUES=LEAGUE_DATA.map(l=>l.name);
export const leagueNames=LEAGUE_DATA.map(l=>l.clubs.map(c=>c[0]));
export const leagueLevel=(id:number)=>leagueDef(id).clubs.reduce((s,c)=>s+c[1],0)/leagueDef(id).clubs.length;

/** 0.14 average first-team salary per league (만원/year), roughly today's real leagues; 0 = school. */
export const AVG_SALARY=[0,15000,80000,550000,25000,250000,100000,220000,250000,40000,180000,250000] as const;
/** Season income before 0.14 (for migrating older saves). */
export const OLD_INCOME=[0,3500,9000,26000,5000,30000,11000,20000,20000,9000,16000,20000] as const;
