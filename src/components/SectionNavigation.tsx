import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useLanguage } from '../lib/language';
export function SectionNavigation({individual=false,items,value,onChange}:{individual?:boolean;items:string[][];value:string;onChange:(value:string)=>void}) {
 const {t}=useLanguage(),[target,setTarget]=useState<HTMLElement|null>(null);
 useEffect(()=>setTarget(document.getElementById('sidebar-sections')),[]);
 const nav=<nav className={individual?'individual-navigation':'tabs'} aria-label={t('Dashboard sections')}>{items.map(([id,label])=><button key={id} className={value===id?'active':''} aria-current={value===id?'page':undefined} onClick={()=>onChange(id)}>{t(individual&&id==='people'?'Kinerja Saya':label)}</button>)}</nav>;
 return individual&&target?createPortal(nav,target):nav;
}
