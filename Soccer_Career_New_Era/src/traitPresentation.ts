// Display-only formatting for legacy saved messages. Never rewrites saves or engine values.
export function traitNotice(text:string):string {
 if(text.startsWith('실전파'))return '실전파 발동! 오늘은 몸놀림이 남다릅니다.';
 if(text.startsWith('기복이 심함'))return '기복이 심함 · 오늘은 몸이 무겁습니다.';
 if(text.startsWith('슈퍼 조커'))return '슈퍼 조커 · 교체 투입에 강한 선수';
 return text.replace(/라이벌 의식! 이번 주 첫 훈련 성장 ×[\d.]+/g,'라이벌 의식! 훈련에 더욱 몰입합니다.');
}
