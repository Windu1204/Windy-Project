import {createContext, useContext, useState, type ReactNode} from 'react';
const DrillContext=createContext<{anchor:string;detail:ReactNode}|null>(null);
export function InlineDrill({children,detail}:{children:ReactNode;detail:ReactNode}){
 const [anchor,setAnchor]=useState('');
 return <DrillContext.Provider value={{anchor,detail}}><div className="inline-drill-layout" onClickCapture={e=>{
  if(!(e.target instanceof Element)||e.target.closest('.inline-drill-detail'))return;
  const source=e.target.closest('[data-drill-anchor]');
  if(source&&e.target.closest('button:not(:disabled)'))setAnchor(source.getAttribute('data-drill-anchor')||'');
 }}>{children}</div></DrillContext.Provider>;
}
export function DrillSlot({anchor}:{anchor:string}){
 const context=useContext(DrillContext);
 return context?.anchor===anchor&&context.detail?<DrillContext.Provider value={null}><div className="inline-drill-detail">{context.detail}</div></DrillContext.Provider>:null;
}
