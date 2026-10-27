import {type KpiReport, kpiMonths, kpiGroups, kpiReportRows} from '../domain/kpi-report';
import {kpiSummary} from '../domain/kpi-ppt-summary';
import {formatKpi,kpiProgress} from '../domain/formal-kpi';

/** Editable KPI slides. All values come from the same scoped saved report snapshot. */
export async function kpiPpt(report:KpiReport):Promise<Blob> {
 const {default:PptxGenJS}=await import('pptxgenjs');const ppt=new PptxGenJS();
 ppt.layout='LAYOUT_WIDE';ppt.author='WCI Monitoring';ppt.subject='Target dan realisasi KPI';ppt.title='Report KPI '+report.label;ppt.company='Internal Application';
 ppt.theme={headFontFace:'Arial',bodyFontFace:'Arial'};
 const navy='08275C',teal='008592',orange='FF7718',gray='60758B',line='D9E4EA',soft='EDF6F7';
 const image=async(path:string)=>{const response=await fetch(path);if(!response.ok)throw new Error('Aset report PPT tidak tersedia.');const blob=await response.blob();return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Aset PPT tidak dapat dibaca.'));reader.readAsDataURL(blob);});};
 const [logo,cover]=await Promise.all([image('/brand/source-f56b239053.png'),image('/brand/report-cover-monitor.png')]);
 let number=0;
 function slide(title:string,subtitle='') {
  const s=ppt.addSlide();number++;s.background={color:'FFFFFF'};
  s.addImage({data:logo,x:.45,y:.20,w:1.05,h:.40});
  s.addText('WCI Monitoring | Report KPI',{x:7.15,y:.19,w:5.7,h:.20,fontSize:10,bold:true,color:navy,align:'right',margin:0});
  s.addText(report.label,{x:7.15,y:.45,w:5.7,h:.18,fontSize:10,color:gray,align:'right',margin:0});
  s.addText(title,{x:.45,y:.86,w:12.4,h:.57,fontSize:26,bold:true,color:navy,margin:0,breakLine:false});
  if(title)s.addShape(ppt.ShapeType.line,{x:.45,y:1.53,w:.65,h:0,line:{color:orange,width:2}});
  if(subtitle)s.addText(subtitle,{x:.45,y:1.69,w:12.3,h:.40,fontSize:12,color:gray,margin:0,valign:'middle'});
  s.addShape(ppt.ShapeType.line,{x:.45,y:7.08,w:12.4,h:0,line:{color:line,width:.6}});
  s.addText('Internal Application · KPI '+(report.annual?'Tahunan':'Bulanan'),{x:.45,y:7.19,w:11.4,h:.15,fontSize:8.5,color:gray,margin:0});
  s.addText(String(number),{x:12.2,y:7.17,w:.65,h:.18,fontSize:9,color:navy,margin:0,align:'right'});
  return s;
 }
 type Slide=ReturnType<typeof ppt.addSlide>;
 function table(s:Slide,headers:string[],rows:string[][],widths:number[],heights:number[],y=2.25) {
  const detail=headers[0]==='Indikator KPI';
  if(detail){const sum=heights.slice(1).reduce((a,b)=>a+b,0);const factor=Math.max(1,3.7/sum);heights=heights.map((h,i)=>i?h*factor:h);}
  const formatted=[headers,...rows].map((row,ri)=>row.map((text,ci)=>({text,options:{fill:{color:ri===0?teal:ri%2?'FFFFFF':'F1F5F7'},color:ri===0?'FFFFFF':navy,bold:ri===0,align:'center' as const,valign:'middle' as const,fontSize:ri===0?13:detail?(report.annual?14:15):12.5,margin:.07}})));
  s.addTable(formatted,{x:.45,y,w:12.4,h:heights.reduce((a,b)=>a+b,0),colW:widths,rowH:heights,border:{type:'solid',pt:.5,color:line},fontFace:'Arial',autoPage:false,margin:.07,verbose:false});
 }
 const compact=report.allMembers??report.people.length>1;
 const coverSlide=ppt.addSlide();number++;
 coverSlide.background={color:'FFFFFF'};
 // Same full-width cover master and asset as the operational monitoring reports.
 coverSlide.addImage({data:cover,x:0,y:0,w:13.333,h:7.12});
 coverSlide.addImage({data:logo,x:.38,y:.14,w:1.12,h:.43});
 coverSlide.addText('KPI Monitoring',{x:.74,y:2.22,w:7.5,h:.55,fontSize:32,bold:true,color:navy,margin:0});
 coverSlide.addText('Monitoring Report',{x:.74,y:2.95,w:7.5,h:.5,fontSize:25,color:navy,margin:0});
 coverSlide.addText(compact?'Ringkasan Seluruh Anggota':'Rincian KPI Perorangan',{x:.74,y:3.52,w:7.4,h:.35,fontSize:18,color:navy,margin:0});
 coverSlide.addShape(ppt.ShapeType.line,{x:.74,y:4.08,w:.7,h:0,line:{color:orange,width:2}});
 coverSlide.addText((report.annual?'Tahunan':'Bulanan')+' · '+report.label+'\n'+(compact?report.people.length+' pegawai sesuai filter dan hak akses':report.people[0].person.name),{x:.74,y:4.4,w:7.4,h:1,fontSize:16,color:navy,margin:0});
 coverSlide.addText('Dibuat '+report.generated+' WIB',{x:.74,y:6.55,w:7.4,h:.25,fontSize:10,color:gray,margin:0});
 coverSlide.addShape(ppt.ShapeType.line,{x:.38,y:7.12,w:12.57,h:0,line:{color:line,width:.6}});
 coverSlide.addText('WCI Monitoring | Report KPI',{x:.38,y:7.2,w:11.8,h:.16,fontSize:8,color:navy,margin:0});
 coverSlide.addText('1',{x:12.45,y:7.2,w:.5,h:.16,fontSize:8,color:navy,align:'right',margin:0});
 if(compact){
  const count=kpiSummary(report.people,report),s=slide('Ringkasan KPI Tim',report.label+' · '+report.people.length+' pegawai · Sesuai filter dan hak akses');
  table(s,['Cakupan','Jumlah'],[['Pegawai',String(report.people.length)],['Indikator'+(report.annual?' × 12 bulan':''),String(count.total)],['Target terisi',String(count.targets)],['Realisasi terisi',String(count.actuals)],['Tercapai',String(count.met)],['Belum tercapai',String(count.below)],['Belum dapat dinilai',String(count.unassessed)]],[8.4,4],[.5,...Array(7).fill(.51)]);
  s.addText('Jumlah menunjukkan indikator-periode, bukan nilai KPI akhir. Target/realisasi kosong dan Special Scoring mengikuti aturan yang tersedia.',{x:.45,y:6.68,w:12.4,h:.3,fontSize:10,color:gray,margin:0});
  // One row per member, rather than a complete detailed deck for each member.
  for(const group of [...new Set(report.people.map(e=>e.template.group_code))]){
   const members=report.people.filter(e=>e.template.group_code===group);
   for(let offset=0;offset<members.length;offset+=6){
    const part=members.slice(offset,offset+6),s=slide('Rekap KPI Anggota',kpiGroups[group]+' · '+(offset+1)+'–'+(offset+part.length)+' dari '+members.length+' pegawai');
    table(s,['Pegawai / NPP','Indikator'+(report.annual?' × bulan':''),'Target terisi','Realisasi terisi','Tercapai','Belum tercapai','Belum dinilai'],part.map(e=>{const n=kpiSummary([e],report);return [e.person.name+'\n'+(e.person.npp||'—'),String(n.total),String(n.targets),String(n.actuals),String(n.met),String(n.below),String(n.unassessed)];}),[3.5,1.4,1.5,1.5,1.3,1.6,1.6],[.62,...part.map(()=>.60)],2.15);
    s.addText('Rekap per indikator'+(report.annual?' per bulan':'')+'. Detail target, realisasi dan catatan tiap orang tersedia pada unduhan perorangan.',{x:.45,y:6.78,w:12.4,h:.2,fontSize:10,color:gray,margin:0});
   }
   for(const code of [...new Set(members.map(e=>e.template.code))]){
    const entries=members.filter(e=>e.template.code===code),template=entries[0].template;
    for(let offset=0;offset<template.indicators.length;offset+=6){
     const part=template.indicators.slice(offset,offset+6),s=slide('Rekap per Indikator',kpiGroups[group]+' · '+template.title+' · '+entries.length+' pegawai');
     table(s,['Indikator KPI','Bobot','Target terisi','Realisasi terisi','Tercapai','Belum tercapai','Belum dinilai'],part.map(i=>{const n=kpiSummary(entries,report,i.key);return [i.label,(i.weight*100).toLocaleString('id-ID')+'%',n.targets+' / '+n.total,n.actuals+' / '+n.total,String(n.met),String(n.below),String(n.unassessed)];}),[4.1,.8,1.55,1.55,1.3,1.55,1.55],[.65,...part.map(()=>.62)],2.15);
     s.addText('Bobot mengikuti template. Jumlah capaian tidak dijadikan skor gabungan. '+(report.annual?'Rekap mencakup Januari–Desember.':''),{x:.45,y:6.78,w:12.4,h:.2,fontSize:10,color:gray,margin:0});
    }
   }
  }
  if(report.annual)for(let half=0;half<2;half++){
   const groups=[...new Set(report.people.map(e=>e.template.group_code))],s=slide('Tren Bulanan - Semester '+(half+1),'Rekap kelompok - Tercapai / belum tercapai / belum dapat dinilai');
   table(s,['Kelompok KPI',...kpiMonths.slice(half*6,half*6+6)],groups.map(group=>[kpiGroups[group],...Array.from({length:6},(_,j)=>{const n=kpiSummary(report.people.filter(e=>e.template.group_code===group),{annual:false,period:report.period.slice(0,4)+'-'+String(half*6+j+1).padStart(2,'0')});return n.met+' / '+n.below+' / '+n.unassessed;})]),[3.4,...Array(6).fill(1.5)],[.6,...groups.map(()=>.70)],2.15);
   s.addText('Tiap sel: jumlah indikator tercapai / belum tercapai / belum dapat dinilai. Rincian bulanan per orang tersedia pada unduhan perorangan.',{x:.45,y:6.78,w:12.4,h:.2,fontSize:10,color:gray,margin:0});
  }
  return await ppt.write({outputType:'blob',compression:true}) as Blob;
 }
 function chunks<T>(items:T[],height:(item:T)=>number,budget=4.45) {
  const parts:T[][]=[];let current:T[]=[],used=.48;
  for(const item of items){const h=height(item);if(current.length&&(used+h>budget||current.length===3)){parts.push(current);current=[];used=.48;}current.push(item);used+=h;}
  if(current.length)parts.push(current);return parts;
 }
 for(const entry of report.people){
  const {person,template,values}=entry,total=template.indicators.length*(report.annual?12:1);
  const evaluated=values.map(v=>{const i=template.indicators.find(i=>i.key===v.indicator_key);return i?kpiProgress(i,v.target,v.actual):null;});
  const met=evaluated.filter(v=>v?.tone==='green').length,below=evaluated.filter(v=>v?.tone==='amber').length,unassessed=total-met-below;
  const summary=slide(person.name,kpiGroups[template.group_code]+' · '+template.title);
  summary.addText('NPP '+(person.npp||'—')+'  ·  '+(person.position||'—')+'  ·  Kelolaan '+(person.managed||'—'),{x:.45,y:2.13,w:12.4,h:.3,fontSize:12,color:navy,margin:0});
  const stats=[['Target terisi',values.filter(v=>v.target).length+' / '+total],['Realisasi terisi',values.filter(v=>v.actual!==null).length+' / '+total],['Target tercapai',met+below?met+' / '+(met+below)+' dinilai':'Belum dinilai']];
  stats.forEach(([label,value],i)=>{const x=.45+i*4.2;summary.addShape(ppt.ShapeType.rect,{x,y:2.68,w:4,h:1.08,line:{color:line,width:.6},fill:{color:soft}});summary.addText(label,{x:x+.18,y:2.82,w:3.65,h:.23,fontSize:12,color:gray,margin:0});summary.addText(value,{x:x+.18,y:3.14,w:3.65,h:.37,fontSize:24,bold:true,color:teal,margin:0});});
  const barY=4.05;let x=.45;
  for(const [count,color] of [[met,'149D78'],[below,'E8A138'],[unassessed,'DDE6EB']] as const){const w=total?count/total*12.4:0;if(w>0)summary.addShape(ppt.ShapeType.rect,{x,y:barY,w,h:.16,line:{color,transparency:100},fill:{color}});x+=w;}
  summary.addText(`${met} tercapai   ·   ${below} belum tercapai   ·   ${unassessed} belum dapat dinilai`,{x:.45,y:4.31,w:12.4,h:.25,fontSize:11,color:gray,margin:0});
  const perspectives=[...new Set(template.indicators.map(i=>i.perspective))];
  table(summary,['Perspektif','Bobot','Indikator','Target terisi','Realisasi terisi'],perspectives.map(p=>{const items=template.indicators.filter(i=>i.perspective===p),keys=new Set(items.map(i=>i.key)),vs=values.filter(v=>keys.has(v.indicator_key));return [p,(items.reduce((s,i)=>s+i.weight,0)*100).toLocaleString('id-ID',{maximumFractionDigits:2})+'%',String(items.length),String(vs.filter(v=>v.target).length),String(vs.filter(v=>v.actual!==null).length)];}),[4.8,1.3,1.6,2.35,2.35],[.40,...perspectives.map(()=>.36)],4.83);
  summary.addText('Capaian dihitung per indikator. Nilai akhir berbobot dan Special Scoring belum dihitung.',{x:.45,y:6.82,w:12.4,h:.15,fontSize:9,color:gray,margin:0});
  if(!report.annual){
   const rows=kpiReportRows(entry,report.period);
   for(const perspective of perspectives){
    const height=(r:typeof rows[number])=>Math.max(.8,Math.ceil((r.indicator.label+r.indicator.details.join(' ')).length/43)*.19+.25);
    const parts=chunks(rows.filter(r=>r.indicator.perspective===perspective),height);
    parts.forEach((part,index)=>{
     const s=slide(perspective+(parts.length>1?' · '+(index+1)+'/'+parts.length:''),person.name+' · '+kpiGroups[template.group_code]);
     table(s,['Indikator KPI','Bobot','Satuan','Target','Realisasi','Capaian / Status'],part.map(r=>[r.indicator.label+(r.indicator.details.length?'\n'+r.indicator.details.join('\n'):''),(r.indicator.weight*100).toLocaleString('id-ID')+'%',r.indicator.unit,r.target,r.value?.actual===null||r.value?.actual===undefined?'Belum diinput':r.actual,(r.ratio===null?'':r.ratio.toLocaleString('id-ID',{maximumFractionDigits:1})+'%\n')+r.status]),[4.5,.8,1.25,1.4,1.4,3.05],[.48,...part.map(height)]);
    });
   }
  }else{
   for(let half=0;half<2;half++)for(const perspective of perspectives){
    const items=template.indicators.filter(i=>i.perspective===perspective),height=(i:typeof items[number])=>Math.max(1.0,Math.ceil((i.label+i.details.join(' ')).length/35)*.18+.5);
    const parts=chunks(items,height);
    parts.forEach((part,index)=>{const s=slide('Semester '+(half+1)+' · '+perspective+(parts.length>1?' · '+(index+1)+'/'+parts.length:''),person.name+' · '+kpiGroups[template.group_code]);
     table(s,['Indikator KPI',...kpiMonths.slice(half*6,half*6+6)],part.map(i=>[i.label+(i.details.length?'\n'+i.details.join('\n'):'')+'\nBobot '+(i.weight*100).toLocaleString('id-ID')+'% · '+i.unit,...Array.from({length:6},(_,j)=>{const month=String(half*6+j+1).padStart(2,'0'),v=values.find(v=>v.indicator_key===i.key&&v.period.slice(5,7)===month);return 'Target: '+(v?.target||'—')+'\nRealisasi: '+formatKpi(v?.actual??null,i.unit);})]),[3.4,...Array(6).fill(1.5)],[.48,...part.map(height)]);
     s.addText('— = belum diisi. Nilai bulanan tidak dijumlahkan; gunakan basis periode yang sama dengan target.',{x:.45,y:6.76,w:12.4,h:.22,fontSize:10,color:gray,margin:0});
    });
   }
  }
  const notes=values.filter(v=>v.note).flatMap(v=>{const label=(template.indicators.find(i=>i.key===v.indicator_key)?.label||v.indicator_key)+' · '+kpiMonths[+v.period.slice(5,7)-1];const result:{label:string;text:string}[]=[];for(let n=0;n<v.note.length;n+=350)result.push({label:label+(v.note.length>350?' · Bagian '+(Math.floor(n/350)+1):''),text:v.note.slice(n,n+350)});return result;});
  for(let offset=0;offset<notes.length;offset+=2){const s=slide('Catatan Realisasi',person.name);notes.slice(offset,offset+2).forEach((note,index)=>{const y=2.25+index*2.15;s.addText(note.label,{x:.45,y,w:12.4,h:.45,fontSize:14,bold:true,color:teal,margin:0});s.addText(note.text,{x:.45,y:y+.57,w:12.4,h:1.38,fontSize:15,color:navy,margin:0,valign:'top',breakLine:false});});}
 }
 return await ppt.write({outputType:'blob',compression:true}) as Blob;
}
