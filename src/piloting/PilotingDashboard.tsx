import { ProcessPeople } from '../components/ProcessPeople';
import { CorporateOverview, CorporateProcess } from '../components/CorporateViews';
import { SectionNavigation } from '../components/SectionNavigation';
import { SlaCoverage } from '../components/SlaCoverage';
import { useMemo, useState, type ReactNode } from 'react';
import { type MonitoringRecord, type Payload, type SlaRule } from '../types';
import { Panel, Bars, Donut } from '../components/Charts';
import { initialFilters, field, value, filterPiloting, breakdown, pilotMetrics, type PilotFilters } from './model';
import { PilotRecords, PilotDetail, usePilotText } from './ui';
import { readPiloting, exportPiloting } from './imports';
import { PilotFilterBar } from './PilotFilters';
import { PilotTrend } from './PilotTrend';
import { PilotPersonWork } from './PilotPersonWork';
import { PilotSla } from './PilotSla';
import { PilotReport } from './PilotReport';
import './piloting.css';
interface Props { individual?:boolean;sidebarNavigation?:boolean;canReport?:boolean; dataControls?:ReactNode;personNames?:string[]; rows:MonitoringRecord[];canEdit:boolean;onApply:(rows:Payload[],name:string)=>Promise<void>;onRestore:()=>Promise<void>;rules:SlaRule[];onSaveRule:(r:SlaRule)=>Promise<void>;onDeleteRule:(s:string)=>Promise<void> }
export default function PilotingDashboard({individual=false,sidebarNavigation=false,canReport=false,personNames,dataControls,rows,canEdit,onApply,onRestore,rules,onSaveRule,onDeleteRule}:Props) {
 const t=usePilotText(),[view,setView]=useState('overview'),[filters,setFilters]=useState<PilotFilters>({...initialFilters}),[detail,setDetail]=useState<MonitoringRecord|null>(null),[drill,setDrill]=useState<{title:string;rows:MonitoringRecord[]}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[imported,setImported]=useState<Awaited<ReturnType<typeof readPiloting>>|null>(null),[fileName,setFileName]=useState('');
 const filtered=useMemo(()=>filterPiloting(rows,filters),[rows,filters]),m=pilotMetrics(filtered);
 const update=(key:keyof PilotFilters,v:string)=>{setFilters(f=>({...f,[key]:v}));setDrill(null);};
 const toggle=(key:keyof PilotFilters,v:string)=>update(key,filters[key]===v?'':v);
 const tabs=(individual ? [['overview','Ringkasan'],['people','Kinerja Saya'],['data','Data']] : [['overview','Ringkasan'],['process','Proses Implementasi'],['people','Kinerja & Beban Kerja'],['report','Report'],['data','Data']]).filter(([id])=>id!=='report'||canReport);
 async function perform(action:()=>Promise<void>){setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 const cards:[string,number,keyof PilotFilters|null,string][]=[['Total Permohonan',m.total,null,''],['Selesai',m.done,'status','Done'],['Reject/Retur',m.returned,'status','Reject/Retur'],['Pending',m.pending,'status','Masih Pending'],['Discrepancy',m.discrepancy,'discrepancy','Discrepancy']];
 const chart=(title:string,key:'group'|'product'|'form'|'status'|'discrepancy')=><Panel title={t(title)} hint={t('Klik untuk melihat permohonan')}><Bars displayName={t} items={breakdown(filtered,field[key])} color="#087f8c" onSelect={v=>toggle(key,v)}/></Panel>;
 return <div className="dashboard-content dash-piloting"><SectionNavigation individual={individual} sidebarNavigation={sidebarNavigation} items={tabs} value={view} onChange={id=>{setView(id);setDrill(null);setError('');}}/>
 {view!=='report'&&<PilotFilterBar hidePerson={individual} rows={rows} filters={filters} onChange={f=>{setFilters(f);setDrill(null);}}/>}
 {error&&<p className="error" role="alert">{error}</p>}
 {view==='overview'&&<><div className="kpis pilot-cards">{cards.map(([label,n,key,v],i)=><button key={label} className={'kpi source-'+['blue','green','red','amber','purple'][i]} disabled={!key} onClick={()=>key&&toggle(key,v)}><small>{t(label)}</small><strong>{n.toLocaleString()}</strong><span>{t(key==='discrepancy'?'Bagian dari total permohonan':'Data sesuai filter aktif')}</span></button>)}</div><p className="pilot-note">{t('Status dan discrepancy ditampilkan terpisah.')}</p></>}
 {view==='overview'&&<CorporateOverview piloting rows={filtered} onSelect={(key,v)=>toggle(key==='region'?'group':key,v)} onDrill={(title,rows)=>setDrill({title,rows})}/>}
 {view==='people'&&<PilotPersonWork individual={individual} personNames={personNames} rows={filtered} onOpen={setDetail}/>}
 {(view==='overview')&&<SlaCoverage rows={filtered} kind="piloting" onOpen={setDetail}/>}
 {view==='people'&&!individual&&<PilotSla rows={filtered} rules={rules} canEdit={canEdit} onSave={onSaveRule} onDelete={onDeleteRule} onOpen={setDetail} onDrill={(title,rows)=>setDrill({title,rows})}/>}
 {view==='process'&&<CorporateProcess piloting rows={filtered} onSelect={(key,v)=>toggle(key==='region'?'group':key,v)} onDrill={(title,rows)=>setDrill({title,rows})}/>}

 {view==='data'&&<>{dataControls}<section className="panel"><div className="panel-head"><h3>{t('Data Corporate - Piloting')}</h3><p>{t('Upload dan riwayat data tersedia pada menu Admin.')}</p></div><div className="button-row"><button className="secondary" onClick={()=>exportPiloting(filtered.map(r=>r.payload),'xlsx')}>{t('Unduh Excel')}</button><button className="secondary" onClick={()=>exportPiloting(filtered.map(r=>r.payload),'csv')}>{t('Unduh CSV')}</button></div></section><PilotRecords rows={filtered} onOpen={setDetail}/></>}
 {view==='report'&&<PilotReport rows={rows} dashboardFilters={filters}/>}
 {drill&&<><div className="pilot-toolbar"><h3>{t(drill.title)}</h3><button className="secondary" onClick={()=>setDrill(null)}>{t('Tutup rincian')}</button></div>{view==='process'?<ProcessPeople piloting rows={filtered.filter(row=>drill.rows.some(previous=>previous.id===row.id))} onOpen={setDetail} title={drill.title}/>:<PilotRecords rows={filtered.filter(row=>drill.rows.some(previous=>previous.id===row.id))} onOpen={setDetail}/>}</>}{detail&&<PilotDetail row={detail} onClose={()=>setDetail(null)}/>}</div>;
}
