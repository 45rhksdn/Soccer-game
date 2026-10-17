import {useEffect,useRef} from 'react';

/** 럭키 (training) / 깨달음 (match) notice. Like the news, it never names the stat or the amount. */
export type PopupInfo={kind:'lucky'|'insight'|'goal'|'signature',text:string,/** resume the live match when closed */resume?:boolean};
export function GrowthPopup({info,onClose}:{info:PopupInfo,onClose:()=>void}){
  const button=useRef<HTMLButtonElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(()=>{button.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close.current();};addEventListener('keydown',key);return ()=>removeEventListener('keydown',key);},[]);
  return <div className="popup-backdrop" onClick={onClose}>
    <div className={`growth-popup ${info.kind}`} role="dialog" aria-modal="true" aria-labelledby="growth-popup-title" onClick={e=>e.stopPropagation()}>
      <span className="popup-medal" aria-hidden="true">{info.kind==='goal'?<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.6 2.6-1.4 4.2H9.8L8.4 10.1z"/><path d="M12 3v4.5M15.6 10.1l4.8-1.5M14.2 14.3l2.8 4.1M9.8 14.3L7 18.4M8.4 10.1L3.6 8.6"/></svg>:info.kind==='lucky'?'★':info.kind==='signature'?'◆':'✦'}</span>
      <span className="eyebrow">{info.kind==='lucky'?'성장 알림':info.kind==='goal'?'경기 알림':info.kind==='signature'?'시그니처 획득':'깨달음 알림'}</span>
      <h3 id="growth-popup-title">{info.kind==='lucky'?'놀라운 성장!':info.kind==='goal'?'GOAL!':info.kind==='signature'?'시그니처!':'깨달음!'}</h3>
      <p>{info.text}</p>
      {(info.kind==="lucky"||info.kind==="insight")&&<small className="muted">정확한 성장 수치는 성장노트와 능력치에서 확인할 수 있습니다.</small>}
      <button ref={button} type="button" className="primary" onClick={onClose}>확인</button>
    </div>
  </div>;
}
