import { useState } from 'react';
import { type DatasetKind, type MonitoringRecord } from '../types';
import { matchesRegionMode, type RegionMode } from '../domain/region-details';
import { useLanguage } from '../lib/language';
import { Records } from './Records';
export function RegionDetail({rows,kind,region,completed,onOpen,productName}:{rows:MonitoringRecord[];kind:DatasetKind;region:string;completed:boolean;onOpen:(row:MonitoringRecord)=>void;productName:(value:string)=>string}) {
 const {t}=useLanguage(),[mode,setMode]=useState<RegionMode>(completed?'done':'all');
 const choices:[RegionMode,string][]=[['all','Semua'],['done','Done'],['progress','On Progress'],['pending','Pending'],['returned','Reject/Retur'],['overdue','Overdue']];
 const other=rows.filter(row=>matchesRegionMode(row,kind,'other')).length;
 if(other)choices.push(['other','Status lainnya']);
 const shown=rows.filter(row=>matchesRegionMode(row,kind,mode));
 const toolbar=<><div className="region-detail-filters" aria-label={t('Filter detail wilayah')}>{choices.map(([key,label])=><button key={key} aria-pressed={mode===key} className={mode===key?'active':''} onClick={()=>setMode(key)}>{t(label)} <b>{rows.filter(row=>matchesRegionMode(row,kind,key)).length.toLocaleString()}</b></button>)}</div><p className="muted region-detail-note">{t('Overdue adalah subset pekerjaan; tidak ditambahkan ke total.')}</p></>;
 return <div className="region-detail"><Records rows={shown} kind={kind} productName={productName} onOpen={onOpen} title={region+' · '+t(choices.find(([key])=>key===mode)?.[1]||'Semua')} toolbar={toolbar}/></div>;
}
