import {useEffect,useMemo,useState} from 'react';

import {type MonitoringRecord} from '../types';

import {Panel} from '../components/Charts';

import {people,field,value} from './model';

import {isMeasured,slaMetrics} from './sla';

import {PilotRecords,usePilotText} from './ui';

export function PilotPersonWork({individual=false,personNames,rows,onOpen}:{individual?:boolean;personNames?:string[];rows:MonitoringRecord[];onOpen:(r:MonitoringRecord)=>void}){

 const t=usePilotText(),[selected,setSelected]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState('all');

 const list=useMemo(()=>people(rows).filter(p=>!personNames||personNames.some(n=>n.trim().toLocaleLowerCase()===p.name.toLocaleLowerCase())),[rows,personNames]),shown=list.filter(p=>p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())),current=list.find(p=>p.name===selected),m=current?{...current,...slaMetrics(current.rows)}:null;

 useEffect(()=>{if(selected&&!current){setSelected('');setStatus('all');}},[selected,current]);

 useEffect(()=>{if(!selected&&personNames&&list.length===1)setSelected(list[0].name);},[list,selected,personNames]);

 const detail=current?.rows.filter(r=>status==='done'?value(r,field.status)==='Done':status==='pending'?value(r,field.status)==='Masih Pending':status==='returned'?value(r,field.status)==='Reject/Retur':status==='overdue'?isMeasured(r)&&r.sla.status==='Overdue':status==='within'?isMeasured(r)&&r.sla.status==='Within SLA':status==='measured'?isMeasured(r):status==='discrepancy'?value(r,field.discrepancy)==='Discrepancy':true)||[];

 return <Panel title={t('KPI Per Person')} className={"person-work"+(individual?" individual-work":"")}><div className="person-layout"><div className="person-list"><label>{t('Cari nama PIC AT')}<input type="search" aria-label={t('Cari nama PIC AT')} value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="person-list-items">{shown.map(p=><button className={'person-row '+(selected===p.name?'active':'')} key={p.name} onClick={()=>{setSelected(p.name);setStatus('all');}}><span><b>{p.name}</b><small>{p.total.toLocaleString()} {t('Total Permohonan')}</small></span><strong>{p.total.toLocaleString()}</strong></button>)}</div></div><div className="person-detail">{m&&current?<><h3>{current.name}</h3><div className="person-kpis">{[['Total Permohonan',m.total,'all'],['Selesai',m.done,'done'],['Pending',m.pending,'pending'],['Reject/Retur',m.returned,'returned'],['Overdue',m.overdue,'overdue']].map(([label,n,key])=><button key={String(key)} onClick={()=>setStatus(String(key))}><small>{t(String(label))}</small><b>{Number(n).toLocaleString()}</b></button>)}</div><div className="person-metrics"><button className="secondary" onClick={()=>setStatus("within")}>{t("Within SLA")}: <b>{m.within}</b></button><button className="secondary" onClick={()=>setStatus("measured")}>{t("SLA Achievement")}: <b>{m.achievement===null?"—":m.achievement.toFixed(1)+"%"}</b></button><button className="secondary" onClick={()=>setStatus("discrepancy")}>{t("Discrepancy")}: <b>{m.discrepancy}</b></button><span>{t("Rata-rata Hari Kerja")}: <b>{m.average===null?"—":m.average.toFixed(1)}</b></span></div><div className="person-status-filters">{[['all','Semua'],['done','Selesai'],['pending','Pending'],['returned','Reject/Retur'],['overdue','Overdue']].map(([key,label])=><button key={key} className={status===key?'active':''} onClick={()=>setStatus(key)}>{t(label)}</button>)}</div><PilotRecords compact rows={detail} onOpen={onOpen}/></>:<p className="empty">{t('Pilih nama implementor untuk melihat KPI dan detail khusus orang tersebut.')}</p>}</div></div></Panel>;

}

