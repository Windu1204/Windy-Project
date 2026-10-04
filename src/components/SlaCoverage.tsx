import {useState} from 'react';
import {type MonitoringRecord,type DatasetKind} from '../types';
import {useLanguage} from '../lib/language';
import {Records} from './Records';
import {PilotRecords} from '../piloting/ui';
import {isMeasured} from '../piloting/sla';
export function SlaCoverage({rows,kind,onOpen}:{rows:MonitoringRecord[];kind:DatasetKind|'piloting';onOpen:(r:MonitoringRecord)=>void}){
 const {t}=useLanguage(),[selection,setSelection]=useState<string|null>(null),measured=rows.filter(r=>kind==='piloting'?isMeasured(r):['Within SLA','Overdue'].includes(r.sla.status)),ids=new Set(measured.map(r=>r.id)),excluded=rows.filter(r=>!ids.has(r.id)),groups:[string,MonitoringRecord[]][]=[['Total Data',rows],['Dapat Dihitung SLA',measured],['Belum Dapat Dihitung SLA',excluded]],detail=groups.find(([label])=>label===selection)?.[1]||[];
 return <section className="panel sla-coverage"><h3>{t('Cakupan Perhitungan SLA')}</h3><div className="coverage-counts">{groups.map(([label,data])=><button className={selection===label?'active':''} key={label} onClick={()=>setSelection(selection===label?null:label)}><small>{t(label)}</small><strong>{data.length.toLocaleString()}</strong></button>)}</div><p>{rows.length.toLocaleString()} = {measured.length.toLocaleString()} + {excluded.length.toLocaleString()} · {t('Dapat Dihitung SLA')}: {measured.filter(r=>r.sla.status==='Within SLA').length.toLocaleString()} Within SLA + {measured.filter(r=>r.sla.status==='Overdue').length.toLocaleString()} Overdue</p>{selection&&(kind==='piloting'?<PilotRecords rows={detail} onOpen={onOpen} title={selection}/>:<Records variant="sla" rows={detail} kind={kind} onOpen={onOpen} title={t(selection)}/>)}</section>;
}
