import { slaIssue } from '../domain/sla-diagnostics';
import { counts } from '../domain/analytics';
import { Bars } from './Charts';
import {useState} from 'react';
import {type MonitoringRecord,type DatasetKind} from '../types';
import {useLanguage} from '../lib/language';
import {Records} from './Records';
import {PilotRecords} from '../piloting/ui';
import {isMeasured} from '../piloting/sla';
export function SlaCoverage({rows,kind,onOpen}:{rows:MonitoringRecord[];kind:DatasetKind|'piloting';onOpen:(r:MonitoringRecord)=>void}){
 const {t}=useLanguage(),[selection,setSelection]=useState<string|null>(null),[reason,setReason]=useState(''),measured=rows.filter(r=>kind==='piloting'?isMeasured(r):['Within SLA','Overdue'].includes(r.sla.status)),ids=new Set(measured.map(r=>r.id)),excluded=rows.filter(r=>!ids.has(r.id)),groups:[string,MonitoringRecord[]][]=[['Total Data',rows],['Dapat Dihitung SLA',measured],['Belum Dapat Dihitung SLA',excluded]],detail=(groups.find(([label])=>label===selection)?.[1]||[]).filter(r=>!reason||slaIssue(r,kind)?.reason===reason);
 return <section className="panel sla-coverage"><h3>{t('Cakupan Perhitungan SLA')}</h3><div className="coverage-counts">{groups.map(([label,data])=><button className={selection===label?'active':''} key={label} onClick={()=>{setSelection(selection===label?null:label);setReason('');}}><small>{t(label)}</small><strong>{data.length.toLocaleString()}</strong></button>)}</div><p>{rows.length.toLocaleString()} = {measured.length.toLocaleString()} + {excluded.length.toLocaleString()} · {t('Dapat Dihitung SLA')}: {measured.filter(r=>r.sla.status==='Within SLA').length.toLocaleString()} Within SLA + {measured.filter(r=>r.sla.status==='Overdue').length.toLocaleString()} Overdue</p>{selection==='Belum Dapat Dihitung SLA'&&<div className="sla-reasons"><h4>{t('Penyebab SLA')}</h4><Bars limit={20} displayName={t} items={counts(excluded,r=>slaIssue(r,kind)?.reason||'Perlu diperiksa')} onSelect={name=>setReason(reason===name?'':name)}/>{reason&&<button className="secondary" onClick={()=>setReason('')}>{t('Semua penyebab')}</button>}</div>}{selection&&(kind==='piloting'?<PilotRecords diagnostics={selection==='Belum Dapat Dihitung SLA'} rows={detail} onOpen={onOpen} title={selection}/>:<Records diagnostics={selection==='Belum Dapat Dihitung SLA'} variant="sla" rows={detail} kind={kind} onOpen={onOpen} title={t(selection)}/>)}</section>;
}
