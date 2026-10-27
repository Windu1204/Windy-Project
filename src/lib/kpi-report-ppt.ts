import {type KpiReport, kpiMonths, kpiGroups, kpiReportRows} from '../domain/kpi-report';
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
 const coverSlide=slide('');
 coverSlide.addShape(ppt.ShapeType.rect,{x:7.65,y:.72,w:5.68,h:6.15,line:{color:soft,transparency:100},fill:{color:soft}});
 coverSlide.addImage({data:cover,x:7.77,y:1.15,w:5.35,h:5.35});
 coverSlide.addText('KPI Monitoring\nReport',{x:.58,y:1.85,w:6.8,h:1.3,fontSize:35,bold:true,color:navy,margin:0,breakLine:false});
 coverSlide.addShape(ppt.ShapeType.line,{x:.58,y:3.42,w:.8,h:0,line:{color:orange,width:3}});
 coverSlide.addText((report.annual?'Tahunan':'Bulanan')+' · '+report.label,{x:.58,y:3.75,w:6.65,h:.5,fontSize:21,color:teal,bold:true,margin:0});
 coverSlide.addText(report.people.length===1?report.people[0].person.name:report.people.length+' pegawai sesuai pilihan dan hak akses',{x:.58,y:4.55,w:6.65,h:.9,fontSize:22,color:navy,margin:0});
 coverSlide.addText(report.people.length===1?kpiGroups[report.people[0].template.group_code]:'Ringkasan dan rincian KPI anggota',{x:.58,y:5.58,w:6.6,h:.5,fontSize:15,color:gray,margin:0});
 coverSlide.addText('Dibuat '+report.generated+' WIB',{x:.58,y:6.45,w:6.5,h:.25,fontSize:10,color:gray,margin:0});
 if(report.people.length>1)for(let offset=0;offset<report.people.length;offset+=8){
  const part=report.people.slice(offset,offset+8),s=slide('Ringkasan KPI Anggota',`${offset+1}–${offset+part.length} dari ${report.people.length} pegawai · Sesuai filter dan hak akses`);
  table(s,['Nama pegawai','Kelompok KPI','Indikator','Target terisi','Realisasi terisi'],part.map(e=>{const total=e.template.indicators.length*(report.annual?12:1);return [e.person.name,kpiGroups[e.template.group_code],String(e.template.indicators.length),e.values.filter(v=>v.target).length+' / '+total,e.values.filter(v=>v.actual!==null).length+' / '+total];}),[3.3,4.2,1.3,1.8,1.8],[.48,...part.map(()=>.46)]);
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
