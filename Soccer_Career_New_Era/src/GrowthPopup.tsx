import {useEffect,useRef} from 'react';

/** 럭키 (training) / 깨달음 (match) notice. Like the news, it never names the stat or the amount. */
export type PopupInfo={kind:'lucky'|'insight',text:string,/** resume the live match when closed */resume?:boolean};
export function GrowthPopup({info,onClose}:{info:PopupInfo,onClose:()=>void}){
  const button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{button.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};addEventListener('keydown',key);return ()=>removeEventListener('keydown',key);},[onClose]);
  return <div className="popup-backdrop" onClick={onClose}>
    <div className={`growth-popup ${info.kind}`} role="dialog" aria-modal="true" aria-labelledby="growth-popup-title" onClick={e=>e.stopPropagation()}>
      <span className="eyebrow">{info.kind==='lucky'?'TRAINING · LUCKY':'MATCH · INSIGHT'}</span>
      <h3 id="growth-popup-title">{info.kind==='lucky'?'럭키!':'깨달음!'}</h3>
      <p>{info.text}</p>
      <small className="muted">정확한 성장 수치는 성장노트와 능력치에서 확인할 수 있습니다.</small>
      <button ref={button} type="button" className="primary" onClick={onClose}>확인</button>
    </div>
  </div>;
}
