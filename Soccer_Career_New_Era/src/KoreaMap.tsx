import {REGIONS,searchSchools,type Region} from './schools';
// Independently drawn geographic overview. Pins represent regions, not campus coordinates.
const PINS:Record<Region,[number,number,number,number]>={
 서울:[155,114,18,-10],인천:[129,120,-62,0],경기:[172,148,12,10],강원:[249,109,15,-9],
 충북:[222,207,9,-12],충남:[146,225,-58,-8],세종:[177,222,-4,-35],대전:[183,254,8,15],
 전북:[160,294,-60,0],광주:[128,347,-62,0],전남:[153,377,12,16],경북:[292,235,14,-12],
 대구:[278,295,10,-12],경남:[231,347,-8,22],울산:[333,318,13,-10],부산:[307,357,14,16],제주:[104,467,24,5]
};
export function KoreaMap({value,onChange}:{value:Region|null;onChange:(r:Region|null)=>void}){
 return <div className="korea-map"><svg viewBox="0 0 420 510" role="group" aria-label="대한민국 지역별 고등학교 선택 지도">
 <defs><linearGradient id="map-water" x2="0" y2="1"><stop stopColor="#e9f5f7"/><stop offset="1" stopColor="#c9e5eb"/></linearGradient></defs>
 <rect width="420" height="510" rx="18" fill="url(#map-water)"/>
 <path d="M119 77L145 68 161 82 183 77 204 66 231 63 252 48 264 62 271 87 286 106 300 133 315 160 328 187 339 214 345 244 354 274 349 300 357 317 343 338 328 354 315 367 294 372 282 365 268 377 254 370 245 383 230 375 216 389 203 379 190 391 178 380 163 399 149 392 140 408 126 394 112 401 105 382 91 377 103 362 95 349 111 338 102 325 117 310 113 293 129 278 119 262 106 250 111 228 102 212 113 196 130 199 137 181 128 164 140 150 129 139 138 127 123 115 133 102 119 92Z" fill="#f7f4dd" stroke="#6c9582" strokeWidth="2"/>
 <path d="M76 460Q101 448 130 456Q142 465 119 475Q94 484 72 475Q65 468 76 460" fill="#f7f4dd" stroke="#6c9582" strokeWidth="2"/>
 <g fill="#e5efd7" stroke="#7b9c92"><ellipse cx="88" cy="388" rx="5" ry="8"/><ellipse cx="106" cy="417" rx="9" ry="4"/><ellipse cx="196" cy="400" rx="7" ry="4"/><circle cx="382" cy="175" r="4"/></g>
 <g fill="#71929e" fontSize="12"><text x="44" y="275">서해</text><text x="362" y="220">동해</text><text x="270" y="423">남해</text><text x="18" y="31" fontWeight="bold" fill="#254d42">대한민국 · 고교 스카우트</text></g>
 {REGIONS.map(r=>{const [x,y,dx,dy]=PINS[r],count=searchSchools('',r).length;return <g key={r} role="button" tabIndex={0} aria-pressed={value===r} aria-label={`${r} · 축구부 ${count}개 학교`} onClick={()=>onChange(value===r?null:r)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onChange(value===r?null:r);}}} className={value===r?'map-pin selected':'map-pin'}>
 <circle cx={x} cy={y} r="14" fill="transparent"/><circle cx={x} cy={y} r="5"/><path d={`M${x} ${y}L${x+dx} ${y+dy}`} fill="none"/><rect x={x+dx-4} y={y+dy-12} width="51" height="23" rx="4"/><text x={x+dx+21} y={y+dy+3} textAnchor="middle">{r} {count}</text></g>})}
 </svg><p className="muted">지역 표식을 누르면 해당 지역의 학교를 고를 수 있습니다. 표식은 지역 대표 위치이며 학교 건물의 정확한 좌표는 아닙니다.</p></div>;
}
