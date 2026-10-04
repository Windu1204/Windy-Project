import { useState, type ReactNode } from 'react';
import { SectionNavigation } from '../components/SectionNavigation';
import { useLanguage } from '../lib/language';
export function PmPlaceholder({individual,sidebarNavigation,canReport,dataControls}:{individual:boolean;sidebarNavigation?:boolean;canReport:boolean;dataControls:ReactNode}) {
 const {t}=useLanguage(),[view,setView]=useState('data');
 const items=[['overview','Ringkasan'],['process','Proses Implementasi'],['people','Kinerja & Beban Kerja'],['report','Report'],['data','Data']].filter(([id])=>id!=='report'||canReport);
 return <section className="dashboard-content"><SectionNavigation individual={individual} sidebarNavigation={sidebarNavigation} items={items} value={view} onChange={setView}/>{view==='data'&&dataControls}<section className="panel"><h3>{t(items.find(([id])=>id===view)?.[1]||'Data')} · PM</h3><p className="empty">{t('Data Tim Project Manager belum tersedia.')}</p></section></section>;
}
