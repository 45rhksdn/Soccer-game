import {traitDef} from './traits';

// One glyph per trait (24×24, stroke icons). Unknown/future traits fall back to "unknown".
const ICONS:Record<string,string>={
  star:'M12 3l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.7 1.1-5.9L3.4 9.3l6-.8z',
  flame:'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.3-3.8 2.5-5 .2 1.8 1 3 2.2 3.4C11 9 11.5 6 12 3z',
  clover:'M12 12c-3.5-1-5-3-3.7-5s3.7-.6 3.7 1.6C12 6.4 14.4 5 15.7 7s-.2 4-3.7 5zm0 0c1 3.5 3 5 5 3.7s.6-3.7-1.6-3.7M12 12c-1 3.5-3 5-5 3.7s-.6-3.7 1.6-3.7M12 12l1 9',
  dumbbell:'M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12',
  battery:'M4 7h14v10H4zM18 10h2v4h-2M7 10v4M10 10v4M13 10v4',
  cross:'M12 3v18M3 12h18M7 7l10 10',
  heart:'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM8 11h2l1-2 2 4 1-2h2',
  crack:'M5 4h14v16H5zM12 4l-2 5 4 3-3 4 1 4',
  zzz:'M4 6h6l-6 7h6M13 11h4l-4 5h4M18 4h3l-3 3h3',
  shake:'M12 3v3M12 18v3M5 7l2 2M17 15l2 2M3 12h3M18 12h3M5 17l2-2M17 9l2-2M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  hourglass:'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9',
  shield:'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4',
  pass:'M4 17c4-8 10-10 16-10M16 4l4 3-4 3M4 17h.01M7 20a3 3 0 1 0 0-6',
  spark:'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  fist:'M7 11V7a2 2 0 0 1 4 0v3M11 10V6a2 2 0 0 1 4 0v4M15 10V8a2 2 0 0 1 4 0v5a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-2a2 2 0 0 1 4 0',
  versus:'M4 5l4 14 4-14M14 17c1 1.5 2.5 2 4 2 2 0 3-1 3-2.5 0-3.5-7-2-7-5.5C14 9.5 15 8.5 17 8.5c1.5 0 2.5.5 3.5 1.5',
  book:'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7M8 11h5',
  sprout:'M12 21v-9M12 12C12 8 9 5 4 5c0 4 3 7 8 7zM12 14c0-3 2.5-6 7-6 0 3.5-2.5 6-7 6z',
  unknown:'M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .8-1 1.5V14M12 17.5v.5',
};

export function TraitIcon({id,size=16}:{id:string,size?:number}){
  const d=ICONS[traitDef(id)?.icon??'unknown'];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={d}/></svg>;
}

export function TraitBadge({id,detail=false}:{id:string,detail?:boolean}){
  const def=traitDef(id),kind=def?.polarity??'unknown';
  const label=`${kind==='positive'?'긍정':kind==='negative'?'부정':'알 수 없는'} 특성 ${id}${def?` · ${def.summary}`:''}${def?.rarity==='rare'?' · 희귀':''}`;
  return <span className={`trait-badge ${kind}${def?.rarity==='rare'?' rare':''}`} role="img" aria-label={label} title={label}>
    <TraitIcon id={id}/><span className="trait-name">{id}</span>{kind==='positive'?<span className="trait-sign" aria-hidden="true">+</span>:kind==='negative'?<span className="trait-sign" aria-hidden="true">−</span>:null}
    {detail&&def&&<small>{def.summary}</small>}
  </span>;
}

export function TraitList({traits,detail=false,empty='특성 없음'}:{traits:readonly string[]|undefined,detail?:boolean,empty?:string}){
  if(!traits?.length)return <span className="trait-empty">{empty}</span>;
  return <span className={`trait-list${detail?' detail':''}`}>{traits.map(t=><TraitBadge key={t} id={t} detail={detail}/>)}</span>;
}
