import { LayoutDashboard, ClipboardCheck, ChartNoAxesCombined, GitBranch, FileChartColumn, Table2, Gauge } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useLanguage } from '../lib/language';
export function SectionNavigation({individual=false,sidebarNavigation=false,items,value,onChange}:{individual?:boolean;sidebarNavigation?:boolean;items:string[][];value:string;onChange:(value:string)=>void}) {
 const {t}=useLanguage(),[target,setTarget]=useState<HTMLElement|null>(null);
 useEffect(()=>setTarget(document.getElementById('sidebar-sections')),[]);
 const icons: Record<string, typeof LayoutDashboard>={overview:LayoutDashboard,tasks:ClipboardCheck,people:ChartNoAxesCombined,process:GitBranch,report:FileChartColumn,data:Table2,sla:Gauge};
 const nav=<nav className={(individual||sidebarNavigation)?'individual-navigation':'tabs'} aria-label={t('Dashboard sections')}>{items.map(([id,label])=><button key={id} className={value===id?'active':''} aria-current={value===id?'page':undefined} onClick={()=>onChange(id)}>{(individual||sidebarNavigation)&&(()=>{const Icon=icons[id]||LayoutDashboard;return <Icon size={19} strokeWidth={1.8} aria-hidden="true"/>;})()}{t(individual&&id==='people'?'Kinerja Saya':label)}</button>)}</nav>;
 return (individual||sidebarNavigation)&&target?createPortal(nav,target):nav;
}
