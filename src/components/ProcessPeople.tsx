import { useEffect, useMemo, useState } from 'react';
import { type MonitoringRecord, text } from '../types';
import { field, value } from '../piloting/model';
import { Records } from './Records';
import { PilotRecords } from '../piloting/ui';
import { Panel } from './Charts';
import { useLanguage } from '../lib/language';

export function ProcessPeople({ rows, title, piloting=false, onOpen }: { rows: MonitoringRecord[]; title: string; piloting?: boolean; onOpen: (row: MonitoringRecord) => void }) {
 const {t}=useLanguage(),[selected,setSelected]=useState(''),[query,setQuery]=useState('');
 const assignments=useMemo(()=>{
  const groups=new Map<string,MonitoringRecord[]>();
  for(const row of rows){const name=(piloting?value(row,field.person):text(row.payload.implementor))||'PIC belum tercantum';const list=groups.get(name)||[];list.push(row);groups.set(name,list);}
  return [...groups].map(([name,records])=>({name,records})).sort((a,b)=>b.records.length-a.records.length||a.name.localeCompare(b.name));
 },[rows,piloting]);
 useEffect(()=>{setSelected('');setQuery('');},[title]);
 const current=assignments.find(p=>p.name===selected);
 return <Panel title={title} hint={t('Klik nama untuk melihat pekerjaan, lalu klik pekerjaan untuk membuka detail.')} className="process-people">
  <div className="person-layout"><div className="person-list"><label>{t('Cari nama PIC')}<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="person-list-items">{assignments.filter(p=>p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(p=><button className={'person-row '+(selected===p.name?'active':'')} key={p.name} onClick={()=>setSelected(p.name)}><span><b>{t(p.name)}</b></span><strong>{p.records.length.toLocaleString()}</strong></button>)}</div></div><div className="person-detail">{current?(piloting?<PilotRecords rows={current.records} onOpen={onOpen} title={current.name}/>:<Records rows={current.records} kind="corporate" onOpen={onOpen} title={current.name}/>):<p className="empty">{t(rows.length?'Pilih nama PIC untuk melihat pekerjaan.':'Tidak ada pekerjaan sesuai pilihan.')}</p>}</div></div>
 </Panel>;
}
