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
 // Discrepancy details remain in the table; no discrepancy chart page.
 if(title==='Rincian Discrepancy')return [];
 return [];
}
export function productChartPanels(chart:ReportChart):ReportChart[]{
 if(chart.items.length<=6)return [chart];
 const middle=Math.ceil(chart.items.length/2);
 return [[0,middle],[middle,chart.items.length]].map(([start,end],i)=>({...chart,title:i===0?'Produk · Volume Lebih Besar':'Produk · Volume Lebih Kecil',items:chart.items.slice(start,end),series:chart.series?.map(s=>({...s,values:s.values.slice(start,end)}))}));
}
export async function chartPng(chart:ReportChart):Promise<Uint8Array>{
 const panels=chart.title==='Overview Produk'?productChartPanels(chart):[chart];
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=panels.length>1?760:430;const c=canvas.getContext('2d');if(!c)throw new Error('Grafik report tidak dapat dibuat.');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);
 panels.forEach((panel,index)=>{
  const offset=index*360,series=panel.series||[{name:'Permohonan',color:panel.color,values:panel.items.map(x=>x[1])}],peak=Math.max(1,...series.flatMap(s=>s.values)),size=Math.min(44,265/Math.max(1,panel.items.length));
  c.fillStyle='#08275c';c.font='bold 25px Arial';c.fillText(panel.title,24,offset+32);
  if(panel.series){c.font='18px Arial';series.forEach((s,i)=>{c.fillStyle='#'+s.color;c.fillRect(520+i*150,offset+42,16,12);c.fillStyle='#173a63';c.fillText(s.name,543+i*150,offset+55);});}
  panel.items.forEach(([label],i)=>{
   const y=offset+72+i*size;c.fillStyle='#173a63';c.font=`${Math.min(21,Math.max(14,size*.55))}px Arial`;
   const words=label.split(' '),lines=[''];for(const word of words){const last=lines.length-1,trial=(lines[last]+' '+word).trim();if(c.measureText(trial).width>440&&lines[last])lines.push(word);else lines[last]=trial;}
   lines.slice(0,2).forEach((line,j)=>c.fillText(line,24,y+16+j*17));
   const height=Math.max(3,(size-6)/series.length);series.forEach((s,j)=>{const n=s.values[i],top=y+j*height;c.fillStyle='#'+s.color;c.fillRect(520,top,580*n/peak,Math.max(2,height-2));c.fillStyle='#08275c';c.font='16px Arial';if(n)c.fillText(String(n),Math.min(1140,528+580*n/peak),top+height-1);});
  });
 });
 if(panels.length>1){c.fillStyle='#61798d';c.font='18px Arial';c.fillText('Skala tiap panel berbeda; bandingkan angka pada bar. N = New · M = Maintenance',24,744);}
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Grafik tidak tersedia.')),'image/png'));return new Uint8Array(await blob.arrayBuffer());
}

