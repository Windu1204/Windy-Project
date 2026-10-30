import { useState } from 'react';
import { type DatasetKind, type MonitoringRecord } from '../types';
import { matchesRegionMode, type RegionMode } from '../domain/region-details';
import { status } from '../domain/analytics';
import { categoryLabel, categoryName } from '../domain/region-details';
import { useLanguage } from '../lib/language';
import { Records } from './Records';
export function RegionDetail({rows,kind,region,completed,onOpen,productName}:{rows:MonitoringRecord[];kind:DatasetKind;region:string;completed:boolean;onOpen:(row:MonitoringRecord)=>void;productName:(value:string)=>string}) {
 const {t}=useLanguage(),[mode,setMode]=useState<string>(completed?'done':'all');
 const choices:[string,string][]=[['all','Semua'],['done','Done'],['progress','On Progress'],['pending','Pending'],['returned','Reject/Retur'],['overdue','Overdue']];
 if(kind==='regional')choices.splice(2,0,['status:Handover','Handover']);
 const remainingStatuses=[...new Set(rows.filter(row=>matchesRegionMode(row,kind,'other')).map(row=>categoryName(status(row,kind))))].sort((a,b)=>a.localeCompare(b));
 for(const name of remainingStatuses.filter(name=>!choices.some(([key])=>key==='status:'+name)))choices.push(['status:'+name,categoryLabel(name)]);
 const matches=(row:MonitoringRecord,key:string)=>key.startsWith('status:')?categoryName(status(row,kind))===key.slice(7):matchesRegionMode(row,kind,key as RegionMode);
 const shown=rows.filter(row=>matches(row,mode));
 const toolbar=<><div className="person-status-filters region-detail-filters" aria-label={t('Filter detail wilayah')}>{choices.map(([key,label])=><button key={key} aria-pressed={mode===key} className={mode===key?'active':''} onClick={()=>setMode(key)}>{t(label)} <b>{rows.filter(row=>matches(row,key)).length.toLocaleString()}</b></button>)}</div><p className="muted region-detail-note">{t('Overdue adalah subset pekerjaan; tidak ditambahkan ke total.')}</p></>;
 return <div className="region-detail"><Records rows={shown} kind={kind} productName={productName} onOpen={onOpen} title={region+' · '+t(choices.find(([key])=>key===mode)?.[1]||'Semua')} toolbar={toolbar}/></div>;
}
