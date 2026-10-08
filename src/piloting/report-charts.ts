import {requestType} from './report-overview';
import {type MonitoringRecord} from '../types';
import {breakdown,field,value,duration,people} from './model';
import {slaMetrics} from './sla';
export interface ReportChart{title:string;items:[string,number][];color:string;series?:{name:string;color:string;values:number[]}[]}
export function reportCharts(title:string,rows:MonitoringRecord[]):ReportChart[]{
 const chart=(title:string,items:[string,number][],color='087F8C')=>({title,items,color});
 const done=rows.filter(r=>value(r,field.status)==='Done');
 if(title==='Kinerja & Beban Kerja')return [chart('Beban Kerja per PIC',people(rows).map((p):[string,number]=>[p.name,p.total]).slice(0,6)),chart('Selesai per PIC',people(rows).map((p):[string,number]=>[p.name,p.done]).slice(0,6))];
 if(title==='Proses Implementasi'){
  const weekly=new Map<string,number>();for(const r of rows){const date=value(r,field.assigned);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const key=d.toISOString().slice(0,10);weekly.set(key,(weekly.get(key)||0)+1);}
  return [chart('Permohonan Assign ke AT',[...weekly].sort((a,b)=>a[0].localeCompare(b[0]))),chart('Durasi Pekerjaan Selesai',['Same Day','1 Hari','2 Hari','>2 Hari','Unavailable'].map(b=>[b==='Same Day'?'0 hari':b==='Unavailable'?'Belum tersedia':b,done.filter(r=>duration(r)===b).length]),'F97316')];
 }
 if(title==='Kinerja SLA'){const m=slaMetrics(rows);return [chart('Kinerja SLA',[['Within SLA',m.within],['Overdue',m.overdue]]),chart('Overdue per PIC',people(rows).map((p):[string,number]=>[p.name,slaMetrics(p.rows).overdue]).slice(0,6),'F97316')];}
 if(title==='Overview Produk'||title==='Overview per Segmen'){
  const key=title==='Overview Produk'?field.product:field.group,items=breakdown(rows,key);
  const series=(['N','M','—'] as const).map((type,i)=>({name:type,color:['F97316','087F8C','8996A4'][i],values:items.map(([label])=>rows.filter(r=>(value(r,key)||'—')===label&&requestType(r)===type).length)})).filter(s=>s.name!=='—'||s.values.some(Boolean));
  return [{title,items,color:'087F8C',series}];
 }
 if(title==='Rincian Discrepancy'){const cases=rows.filter(r=>value(r,field.discrepancy)==='Discrepancy');return [chart('Discrepancy per Sales',breakdown(cases,'PIC Sales'),'F97316'),chart('Discrepancy per Segmen',breakdown(cases,field.group),'F97316')];}
 return [];
}
export async function chartPng(chart:ReportChart):Promise<Uint8Array>{
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=430;const c=canvas.getContext('2d');if(!c)throw new Error('Grafik report tidak dapat dibuat.');c.fillStyle='#fff';c.fillRect(0,0,1000,430);c.fillStyle='#08275c';c.font='bold 28px Arial';c.fillText(chart.title,24,38);const max=Math.max(1,...chart.items.map(x=>x[1])),size=Math.min(42,315/Math.max(1,chart.items.length));
 const series=chart.series||[{name:'Permohonan',color:chart.color,values:chart.items.map(x=>x[1])}],peak=Math.max(1,...series.flatMap(s=>s.values));
 if(chart.series){c.font='18px Arial';series.forEach((s,i)=>{c.fillStyle='#'+s.color;c.fillRect(370+i*150,48,16,12);c.fillStyle='#173a63';c.fillText(s.name,393+i*150,60);});}
 chart.items.forEach(([label],i)=>{const y=78+i*size;c.fillStyle='#173a63';c.font=`${Math.min(20,Math.max(10,size*.55))}px Arial`;c.fillText(label.length>28?label.slice(0,27)+'…':label,24,y+size*.55);const height=Math.max(2,(size-8)/series.length);series.forEach((s,j)=>{const n=s.values[i],top=y+j*height;c.fillStyle='#'+s.color;c.fillRect(370,top,520*n/peak,Math.max(1,height-2));c.fillStyle='#08275c';c.font=`${Math.min(16,Math.max(9,height))}px Arial`;c.fillText(String(n),Math.min(910,378+520*n/peak),top+height-1);});});
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Grafik tidak tersedia.')),'image/png'));return new Uint8Array(await blob.arrayBuffer());
}

