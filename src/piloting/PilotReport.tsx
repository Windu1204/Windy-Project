import { useMemo, useState } from 'react';
import { type MonitoringRecord } from '../types';
import { saveBlob } from '../lib/exports';
import { field, initialFilters, filterPiloting, breakdown, value, type PilotFilters } from './model';
import { usePilotText } from './ui';
import { PilotFilterBar } from './PilotFilters';
import { generatePilotReport, reportSections } from './reports';
export function PilotReport({rows,dashboardFilters}:{rows:MonitoringRecord[];dashboardFilters:PilotFilters}) {
  const t=usePilotText(),[mode,setMode]=useState<'custom'|'current'>('custom'),[filters,setFilters]=useState({...initialFilters}),[person,setPerson]=useState(''),[format,setFormat]=useState<'pptx'|'docx'>('pptx'),[selected,setSelected]=useState(Object.keys(reportSections)),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const effective=mode==='custom'?filters:dashboardFilters, scoped=useMemo(()=>filterPiloting(rows,effective),[rows,effective]), count=(person?scoped.filter(r=>value(r,field.person)===person):scoped).length;
  async function generate(){setBusy(true);setError('');try{const file=await generatePilotReport(scoped,person,format,selected,effective,false);saveBlob(file.blob,file.name);}catch(e){setError(String(e));}finally{setBusy(false);}}
  return <section className="panel pilot-report report-shell"><div className="panel-head"><h3>{t('Laporan Monitoring')}</h3></div><div className="report-mode"><button className={mode==='current'?'active':''} onClick={()=>setMode('current')}>{t('Sesuai Filter Dashboard')}</button><button className={mode==='custom'?'active':''} onClick={()=>setMode('custom')}>Custom Report</button></div><p className="report-sub">{t(mode==='custom'?'Filter laporan terpisah dari filter dashboard.':'Mengikuti filter dashboard yang sedang aktif.')}</p>
    {mode==='custom'&&<PilotFilterBar rows={rows} filters={filters} custom hidePerson onChange={setFilters}/>}
    <h4>{t("Pengaturan Laporan")}</h4><div className="report-settings"><label>{t('PIC AT')}<select aria-label={t('PIC report')} value={person} onChange={e=>setPerson(e.target.value)}><option value="">{t('Seluruh PIC AT')}</option>{breakdown(rows,field.person).map(([name])=><option key={name}>{name}</option>)}</select></label><label>Format<select aria-label={t('Format Report')} value={format} onChange={e=>setFormat(e.target.value as 'pptx'|'docx')}><option value="pptx">PowerPoint (.pptx)</option><option value="docx">Word (.docx)</option></select></label></div>
    <h4>{t('Pilih Bagian Laporan')}</h4><div className="pilot-sections report-contents">{Object.entries(reportSections).map(([key,label])=><label className="checkbox" key={key}><input type="checkbox" checked={selected.includes(key)} onChange={()=>setSelected(a=>a.includes(key)?a.filter(x=>x!==key):[...a,key])}/>{t(label)}</label>)}</div>
    <div className="pilot-report-actions"><p className="report-sub">{count.toLocaleString()} {t('data sesuai filter laporan')}</p><div className="button-row"><button className="primary" disabled={busy||!selected.length||!count} onClick={()=>generate()}>{t(busy?'Memproses…':'Buat Report')}</button></div></div>{error&&<p className="error" role="alert">{error}</p>}
  </section>;
}
