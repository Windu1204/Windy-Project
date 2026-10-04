import {requestType} from './report-overview';
import {type MonitoringRecord} from '../types';
import {breakdown,field,value,duration,people} from './model';
import {slaMetrics} from './sla';
export interface ReportChart{title:string;items:[string,number][];color:string}
export function reportCharts(title:string,rows:MonitoringRecord[]):ReportChart[]{
 const chart=(title:string,items:[string,number][],color='087F8C')=>({title,items,color});
 const done=rows.filter(r=>value(r,field.status)==='Done');
 if(title==='Kinerja & Beban Kerja')return [chart('Beban Kerja per PIC',people(rows).map((p):[string,number]=>[p.name,p.total]).slice(0,6)),chart('Selesai per PIC',people(rows).map((p):[string,number]=>[p.name,p.done]).slice(0,6))];
 if(title==='Proses Implementasi'){
  const weekly=new Map<string,number>();for(const r of rows){const date=value(r,field.assigned);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const key=d.toISOString().slice(0,10);weekly.set(key,(weekly.get(key)||0)+1);}
  return [chart('Permohonan Assign ke AT',[...weekly].sort((a,b)=>a[0].localeCompare(b[0]))),chart('Durasi Pekerjaan Selesai',['Same Day','1 Hari','2 Hari','>2 Hari','Unavailable'].map(b=>[b==='Same Day'?'0 hari':b==='Unavailable'?'Belum tersedia':b,done.filter(r=>duration(r)===b).length]),'F97316')];
 }
 if(title==='Kinerja SLA'){const m=slaMetrics(rows);return [chart('Kinerja SLA',[['Within SLA',m.within],['Overdue',m.overdue]]),chart('Overdue per PIC',people(rows).map((p):[string,number]=>[p.name,slaMetrics(p.rows).overdue]).slice(0,6),'F97316')];}
 if(title==='Overview Produk'||title==='Overview per Segmen')return [chart(title==='Overview Produk'?'Produk Terbanyak':'Segmen Terbanyak',breakdown(rows,title==='Overview Produk'?field.product:field.group).slice(0,5)),chart('New / Maintenance',(['M','N','—'] as const).map(type=>[type,rows.filter(r=>requestType(r)===type).length]))];
 if(title==='Rincian Discrepancy'){const cases=rows.filter(r=>value(r,field.discrepancy)==='Discrepancy');return [chart('Discrepancy per PIC',breakdown(cases,field.person).slice(0,6),'F97316'),chart('Status Discrepancy',breakdown(cases,field.status),'F97316')];}
 return [];
}
export async function chartPng(chart:ReportChart):Promise<Uint8Array>{
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=430;const c=canvas.getContext('2d');if(!c)throw new Error('Grafik report tidak dapat dibuat.');c.fillStyle='#fff';c.fillRect(0,0,1000,430);c.fillStyle='#08275c';c.font='bold 28px Arial';c.fillText(chart.title,24,38);const max=Math.max(1,...chart.items.map(x=>x[1])),size=Math.min(42,315/Math.max(1,chart.items.length));
 chart.items.forEach(([label,n],i)=>{const y=72+i*size;c.fillStyle='#173a63';c.font='20px Arial';c.fillText(label.length>28?label.slice(0,27)+'…':label,24,y+22);c.fillStyle='#edf2f4';c.fillRect(370,y,520,Math.max(6,size-12));c.fillStyle='#'+chart.color;c.fillRect(370,y,520*n/max,Math.max(6,size-12));c.fillStyle='#08275c';c.fillText(String(n),910,y+22);});
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Grafik tidak tersedia.')),'image/png'));return new Uint8Array(await blob.arrayBuffer());
}

