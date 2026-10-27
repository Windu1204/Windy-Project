import { LayoutDashboard, ClipboardCheck, ChartNoAxesCombined, GitBranch, FileChartColumn, Table2, Gauge, FolderClock, Target } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useLanguage } from '../lib/language';
export function SectionNavigation({individual=false,sidebarNavigation=false,items,value,onChange,onKpi}:{individual?:boolean;sidebarNavigation?:boolean;items:string[][];value:string;onChange:(value:string)=>void;onKpi?:()=>void}) {
 const {t}=useLanguage(),[target,setTarget]=useState<HTMLElement|null>(null);
 useEffect(()=>setTarget(document.getElementById('sidebar-sections')),[]);
 const icons: Record<string, typeof LayoutDashboard>={kpi:Target,projects:FolderClock,overview:LayoutDashboard,tasks:ClipboardCheck,people:ChartNoAxesCombined,process:GitBranch,report:FileChartColumn,data:Table2,sla:Gauge};
 const entries=items.map(item=>[...item]);
 if(individual&&onKpi&&!entries.some(([id])=>id==='kpi'))entries.splice(Math.max(0,entries.findIndex(([id])=>id==='people')+1),0,['kpi','KPI']);
 const nav=<nav className={(individual||sidebarNavigation)?'individual-navigation':'tabs'} aria-label={t('Dashboard sections')}>{entries.map(([id,label])=><button key={id} className={value===id?'active':''} aria-current={value===id?'page':undefined} onClick={()=>id==='kpi'&&onKpi?onKpi():onChange(id)}>{(individual||sidebarNavigation)&&(()=>{const Icon=icons[id]||LayoutDashboard;return <Icon size={19} strokeWidth={1.8} aria-hidden="true"/>;})()}{t(individual&&id==='people'?'Kinerja Saya':label)}</button>)}</nav>;
 return (individual||sidebarNavigation)&&target?createPortal(nav,target):nav;
}
