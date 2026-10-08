import { discrepancyPages } from './report-pagination';

import { requestType } from './report-overview';

import {reportCharts,chartPng,productChartPanels} from './report-charts';



import { type MonitoringRecord } from '../types';



import { saveBlob, type ReportFile } from '../lib/exports';



import { slaMetrics } from './sla';



import { field, value, pilotMetrics, people, breakdown, duration, type PilotFilters } from './model';



export const reportSections: Record<string,string> = {summary:'Executive Summary',people:'Kinerja & Beban Kerja',process:'Proses Implementasi',sla:'Kinerja SLA',products:'Overview Produk',segments:'Overview per Segmen',discrepancy:'Rincian Discrepancy',highlights:'Key Takeaways'};



export interface PilotReportPage { title:string; headers:string[]; rows:string[][] }



export function pilotReportModel(source:MonitoringRecord[],person:string,selected:readonly string[]) {



 const rows=person?source.filter(r=>value(r,field.person)===person):source,m=pilotMetrics(rows),pages:PilotReportPage[]=[];



 if(!rows.length)throw new Error('Tidak ada data untuk report / No report data.');



 const add=(key:string,headers:string[],data:string[][])=>{if(selected.includes(key))pages.push({title:reportSections[key],headers,rows:data});};



 add('summary',['Indikator','Jumlah'],[['Total Permohonan',String(m.total)],['Selesai',String(m.done)],['Reject/Retur',String(m.returned)],['Pending',String(m.pending)],['Discrepancy (bagian dari total)',String(m.discrepancy)]]);



 add('people',['No.','PIC AT','Total','Selesai','Reject/Retur','Pending','Discrepancy','Rata-rata hari kerja'],people(rows).map((p,i)=>[String(i+1),p.name,String(p.total),String(p.done),String(p.returned),String(p.pending),String(p.discrepancy),p.average===null?'—':p.average.toFixed(1)]));



 const sm=slaMetrics(rows);add('sla',['Indikator SLA pekerjaan selesai','Nilai'],[['Within SLA',String(sm.within)],['Overdue',String(sm.overdue)],['Measurable',String(sm.measured)],['SLA Achievement',sm.achievement===null?'—':sm.achievement.toFixed(1)+'%'],['Durasi / target belum tersedia',String(sm.unavailable)]]);



 if(selected.includes('sla'))pages.push({title:'KPI SLA per PIC AT',headers:['No.','PIC AT','Measurable','Within SLA','Overdue','Achievement'],rows:people(rows).map((p,i)=>{const k=slaMetrics(p.rows);return [String(i+1),p.name,String(k.measured),String(k.within),String(k.overdue),k.achievement===null?'—':k.achievement.toFixed(1)+'%'];})});



 const done=rows.filter(r=>value(r,field.status)==='Done');



 add('process',['Durasi pekerjaan selesai','Jumlah'],['Same Day','1 Hari','2 Hari','>2 Hari','Unavailable'].map(b=>[b==='Same Day'?'Hari yang sama':b==='Unavailable'?'Durasi belum tersedia':b,String(done.filter(r=>duration(r)===b).length)]));



 for(const [section,key] of [['products',field.product],['segments',field.group]])if(selected.includes(section)){const categories=breakdown(rows,key);pages.push({title:reportSections[section],headers:[section==='products'?'Produk':'Segmen','N','M','Lainnya','Total'],rows:categories.map(([name,total])=>{const scoped=rows.filter(r=>(value(r,key)||'—')===name);return [name,...(['N','M','—'] as const).map(type=>String(scoped.filter(r=>requestType(r)===type).length)),String(total)];})});}



 if(selected.includes('discrepancy')){



  const cases=rows.filter(r=>value(r,field.discrepancy)==='Discrepancy');



  if(cases.length)pages.push({title:'Rincian Discrepancy',headers:['Nomor Register','Perusahaan','PIC AT','PIC PS','PM','Status','Alasan Discrepancy','Komitmen','Pemenuhan'],rows:cases.map(r=>[value(r,field.id),value(r,field.company),value(r,field.person),value(r,'PIC PS')||'—',value(r,'PM')||'—',value(r,field.status),...['Alasan Discrepancy','Komitmen Discrepancy','Pemenuhan Discrepancy'].map(k=>value(r,k)||'—')])});



  else for(const r of cases)pages.push({title:'Rincian Discrepancy',headers:['Field','Isi'],rows:[['Nomor Register',value(r,field.id)],['Perusahaan',value(r,field.company)],['PIC AT',value(r,field.person)],['Status Pekerjaan',value(r,field.status)],...['Alasan Discrepancy','Komitmen Discrepancy','Pemenuhan Discrepancy'].map(k=>[k,value(r,k)||'—'])]});



 }



 const top=breakdown(rows,field.product)[0],group=breakdown(rows,field.group)[0];



 add('highlights',['No.','Key Takeaways'],[['01',`${m.done+m.returned} dari ${m.total} permohonan selesai / close (${(100*(m.done+m.returned)/m.total).toFixed(1)}%): ${m.done} Done dan ${m.returned} Reject/Retur. SLA Achievement ${sm.achievement===null?'—':sm.achievement.toFixed(1)+'%'} (Reject/Retur tidak dihitung dalam SLA).`],['02',`${m.pending} permohonan pending; ${m.returned} reject/retur.`],['03',`${m.discrepancy} permohonan memiliki discrepancy.`],['04',top?`${top[0]}: ${top[1]} permohonan.`:'—'],['05',group?`${group[0]}: ${group[1]} permohonan.`:'—'],['06',m.average===null?'Durasi pekerjaan selesai belum tersedia.':`Rata-rata penyelesaian ${m.average.toFixed(1)} hari kerja dari ${m.measurable} pekerjaan selesai dengan durasi tersedia.`]]);



 return {rows,m,pages};



}



async function asset(path:string){const r=await fetch(path);if(!r.ok)throw new Error('Report asset unavailable');return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Report asset unreadable'));r.blob().then(b=>reader.readAsDataURL(b),reject);});}



export async function generatePilotReport(source:MonitoringRecord[],person:string,format:'pptx'|'docx',selected:readonly string[],filters:PilotFilters,download=true):Promise<ReportFile> {



 const model=pilotReportModel(source,person,selected),[logo,photo]=await Promise.all([asset('/brand/source-f56b239053.png'),asset('/brand/report-cover-blended.png')]);



 const dates=model.rows.map(r=>value(r,field.assigned)).filter(Boolean).sort(),period=`Periode Assign ke AT: ${filters.from||dates[0]} – ${filters.to||dates.at(-1)}`,title='Corporate - Piloting',who=person||'ALL PIC AT',file='Corporate_Piloting_'+(person||'All').replace(/[^a-z0-9_-]/gi,'_');



 if(format==='pptx') {



  const Pptx=(await import('pptxgenjs')).default,pptx=new Pptx();pptx.layout='LAYOUT_WIDE';pptx.theme={headFontFace:'Arial',bodyFontFace:'Arial'};pptx.author='WCI Monitoring';pptx.subject=title;pptx.title=title+' Monitoring Report';



  let page=0;



  const slide=(name:string,cover=false)=>{const s=pptx.addSlide();page++;s.background={color:'FFFFFF'};if(cover)s.addImage({data:photo,x:0,y:0,w:13.333,h:7.02});s.addImage({data:logo,x:.38,y:.16,w:1.2,h:.46});if(!cover){s.addText(title+' | Monitoring Report',{x:7,y:.16,w:5.9,h:.22,fontSize:10,bold:true,color:'173A63',align:'right',margin:0});s.addText(period,{x:7,y:.42,w:5.9,h:.22,fontSize:9,color:'173A63',align:'right',margin:0});s.addText(name,{x:.38,y:.76,w:12.55,h:.5,fontSize:24,bold:true,color:'08275C',margin:0});s.addShape(pptx.ShapeType.line,{x:.38,y:1.32,w:.65,h:0,line:{color:'FF7518',width:2}});}s.addShape(pptx.ShapeType.line,{x:.38,y:7.1,w:12.55,h:0,line:{color:'CBD8DE',width:.6}});s.addText(title+' | Monitoring Report',{x:.38,y:7.2,w:11.8,h:.16,fontSize:8,color:'08275C',margin:0});s.addText(String(page),{x:12.45,y:7.2,w:.5,h:.16,fontSize:8,color:'08275C',align:'right',margin:0});return s;};



  const cover=slide('',true);cover.addText(title,{x:.7,y:2.2,w:7.5,h:.65,fontSize:32,bold:true,color:'08275C',margin:0});cover.addText('Monitoring Report',{x:.7,y:2.95,w:7.5,h:.5,fontSize:25,color:'08275C',margin:0});cover.addText('Activation Team (AT)',{x:.7,y:3.52,w:7.4,h:.35,fontSize:18,color:'08275C',margin:0});cover.addShape(pptx.ShapeType.line,{x:.7,y:4.08,w:.7,h:0,line:{color:'FF7518',width:2}});cover.addText(period+'\nPIC AT: '+who,{x:.7,y:4.4,w:7.4,h:1,fontSize:16,color:'08275C',margin:0,breakLine:false});



  for(const p of model.pages){



   if(p.title==='Executive Summary'){



    const s=slide(p.title),colors=['173A63','087F8C','F97316','C38E38','8072A4'];



    p.rows.forEach(([label,n],i)=>{const x=.38+i*2.54;s.addShape(pptx.ShapeType.rect,{x,y:1.62,w:2.4,h:1.08,line:{color:'DCE3E7',width:.6},fill:{color:'FFFFFF'}});s.addShape(pptx.ShapeType.rect,{x,y:1.62,w:.055,h:1.08,line:{transparency:100},fill:{color:colors[i]}});s.addText(label,{x:x+.12,y:1.77,w:2.16,h:.35,fontSize:11,align:'center',color:'08275C',margin:0});s.addText(Number(n).toLocaleString(),{x:x+.12,y:2.2,w:2.16,h:.35,fontSize:27,bold:true,align:'center',color:'08275C',margin:0});});



    const bars=(title:string,items:[string,number][],x:number)=>{s.addShape(pptx.ShapeType.rect,{x,y:3.1,w:6.12,h:3.55,line:{color:'DCE3E7',width:.6},fill:{color:'FFFFFF'}});s.addText(title,{x:x+.2,y:3.3,w:5.7,h:.3,fontSize:16,bold:true,color:'08275C',margin:0});const max=Math.max(1,...items.map(i=>i[1]));items.forEach(([label,n],i)=>{const y=3.95+i*.46;s.addText(label,{x:x+.2,y,w:2.3,h:.3,fontSize:11,color:'08275C',margin:0});s.addShape(pptx.ShapeType.rect,{x:x+2.55,y:y+.05,w:2.9,h:.2,line:{transparency:100},fill:{color:'EDF2F4'}});if(n)s.addShape(pptx.ShapeType.rect,{x:x+2.55,y:y+.05,w:2.9*n/max,h:.2,line:{transparency:100},fill:{color:'087F8C'}});s.addText(String(n),{x:x+5.5,y,w:.42,h:.3,fontSize:11,bold:true,color:'08275C',margin:0,align:'right'});});};



    bars('Status Pekerjaan',breakdown(model.rows,field.status).map(([n,v])=>[n==='Masih Pending'?'Pending':n,v]),.38);bars('Produk Terbanyak',breakdown(model.rows,field.product).slice(0,5),6.82);continue;



   }



   if(p.title==='Key Takeaways'){



    const sl=slide('Key Takeaways - Overview Implementasi');



    const labels=['Capaian Implementasi','Status Pekerjaan','Discrepancy','Produk Terbanyak','Segmen Terbanyak','Durasi Penyelesaian'];



    p.rows.forEach(([n,content],i)=>{const x=.55+(i%2)*6.18,y=1.55+Math.floor(i/2)*1.6;sl.addText(n,{x,y:y+.12,w:.62,h:.45,fontFace:'Arial',fontSize:27,bold:true,color:'087F8C',margin:0});sl.addShape(pptx.ShapeType.line,{x:x+.72,y:y+.12,w:0,h:1.08,line:{color:'CBD8DE',width:1}});sl.addText(labels[i],{x:x+.96,y:y+.1,w:4.67,h:.27,fontFace:'Arial',fontSize:14,bold:true,color:'08275C',margin:0});sl.addText(content,{x:x+.96,y:y+.44,w:4.67,h:.86,fontFace:'Arial',fontSize:13,color:'08275C',margin:0});sl.addShape(pptx.ShapeType.line,{x,y:y+1.48,w:5.75,h:0,line:{color:'CBD8DE',width:.6}});});continue;



   }



   const charts=reportCharts(p.title,model.rows);



   const chartSlide=(existing?:ReturnType<typeof slide>)=>{const g=existing||slide(p.title+' · Grafik'),compact=!!existing;const panels=p.title==='Overview Produk'?charts.flatMap(productChartPanels):charts;if(p.title==='Overview Produk'&&panels.length>1)g.addText('N = New · M = Maintenance · Skala tiap panel berbeda; bandingkan angka pada bar.',{x:.55,y:6.88,w:12.1,h:.18,fontSize:10,color:'61798D',margin:0});panels.forEach((chart,i)=>{const wide=panels.length===1,x=.55+i*6.18,w=wide?12.1:5.7;g.addText(chart.title,{x,y:compact?4.28:1.65,w,h:.3,fontSize:compact?13:16,bold:true,color:'08275C',margin:0});if(chart.items.length)g.addChart(pptx.ChartType.bar,(chart.series||[{name:'Permohonan',color:chart.color,values:chart.items.map(x=>x[1])}]).map(series=>({name:series.name,labels:chart.items.map(x=>x[0]==='Masih Pending'?'Pending':x[0]),values:series.values})),{x,y:compact?4.7:2.25,w,h:compact?2.15:4.2,barDir:p.title==='Proses Implementasi'?'col':'bar',showLegend:!!chart.series,legendPos:'b',legendFontSize:11,valAxisMinVal:0,barGrouping:'clustered',showValue:true,showTitle:false,chartColors:chart.series?.map(s=>s.color)||[chart.color],catAxisLabelFontSize:compact?9:chart.items.length>15?8:11,valAxisLabelFontSize:9,dataLabelFormatCode:'0',dataLabelPosition:'outEnd'});else g.addText('Tidak ada data',{x,y:compact?5:3,w:5.7,h:.5,fontSize:14,color:'61798D'});});};



   if(p.title==='Rincian Discrepancy') {

    const parts=discrepancyPages(p.rows);

    parts.forEach((part,index)=>{const s=slide(p.title+(parts.length>1?` · ${index+1}/${parts.length}`:''));

     const cells=[p.headers.map(text=>({text,options:{bold:true,color:'FFFFFF',fill:{color:'087F8C'}}})),...part.rows.map((row,i)=>row.map(text=>({text,options:{fill:{color:i%2?'F2F5F7':'FFFFFF'},color:'08275C'}})))];

     s.addTable(cells,{x:.38,y:1.6,w:12.55,colW:[1.2,1.7,.85,.85,.85,.85,3.1,1.45,1.7],rowH:[.44,...part.heights],fontFace:'Arial',fontSize:10,margin:.06,align:'left',valign:'top',border:{type:'solid',color:'DCE3E7',pt:.5},autoPage:false});

    });

    if(charts.length)chartSlide();continue;

   }

   const expanded=p.rows;

   const overview=p.title==='Overview Produk'||p.title==='Overview per Segmen';const size=p.title==='Rincian Discrepancy'?6:overview?10:8,combined=!overview&&charts.length>0&&expanded.length<=5&&p.title!=='Rincian Discrepancy';



   for(let start=0;start<expanded.length;start+=size){const part=expanded.slice(start,start+size),s=slide(p.title+(expanded.length>size?` · ${Math.floor(start/size)+1}/${Math.ceil(expanded.length/size)}`:''));const cells=[p.headers.map(text=>({text,options:{bold:true,color:'FFFFFF',fill:{color:'087F8C'},align:(overview?'center':'left') as 'left'|'center'}})),...part.map((r,i)=>r.map((text,j)=>({text,options:{fill:{color:i%2?'F2F5F7':'FFFFFF'},align:(overview?j===0?'left':'center':j===0||j===1?'left':'center') as 'left'|'center',color:'08275C'}})))];



    if(overview)s.addText('N = New · M = Maintenance',{x:.38,y:6.87,w:12.55,h:.16,fontSize:8,color:'08275C',margin:0});

    s.addTable(cells.map(row=>row.map(cell=>({...cell,text:cell.text==='Masih Pending'?'Pending':cell.text}))),{x:.38,y:1.6,w:12.55,h:combined?2.35:p.headers.length===7?5.1:4.7,border:{type:'solid',color:'DCE3E7',pt:.5},fontFace:'Arial',fontSize:overview?12:p.title==='Rincian Discrepancy'?(p.headers.length===7?11:14):13,margin:.1,rowH:.45,colW:overview?[4.55,...Array(p.headers.length-1).fill(8/(p.headers.length-1))]:p.headers.length===2?[3,9.55]:p.title==='Rincian Discrepancy'?[1.4,1.8,.95,.95,3,1.65,2.8]:undefined,autoPage:false,verbose:false});if(combined)chartSlide(s);



   }



   if(charts.length&&!combined)chartSlide();



  }



  const result={blob:await pptx.write({outputType:'blob'}) as Blob,name:file+'.pptx'};if(download)saveBlob(result.blob,result.name);return result;



 } else {



  const d=await import('docx'),{Paragraph,TextRun,ImageRun,Document,Header,Footer,PageNumber,AlignmentType,Table,TableRow,TableCell,WidthType,HeadingLevel}=d;



  const bytes=(data:string)=>Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));



  const para=(text:string,bold=false)=>new Paragraph({children:[new TextRun({text,bold,color:'08275C',size:22})],spacing:{after:120}}),brand=()=>new Paragraph({children:[new ImageRun({data:bytes(logo),transformation:{width:112,height:43}})]});



  const cover=[brand(),new Paragraph({text:title,heading:HeadingLevel.TITLE,spacing:{before:700,after:160}}),para('Monitoring Report'),para(period),para('PIC AT: '+who),new Paragraph({children:[new ImageRun({data:bytes(photo),transformation:{width:580,height:326}})]})];



  const body=(await Promise.all(model.pages.map(async(p,index)=>{



   const heading=new Paragraph({text:p.title,heading:HeadingLevel.HEADING_1,pageBreakBefore:index>0,keepNext:true});



   if(p.title==='Key Takeaways')return [heading,new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[0,1,2].map(i=>new TableRow({cantSplit:true,children:[0,1].map(j=>{const r=p.rows[i*2+j];return new TableCell({margins:{top:180,bottom:240,left:180,right:180},children:[new Paragraph({children:[new TextRun({text:r[0],bold:true,color:'087F8C',size:38})],spacing:{after:120}}),para(r[1])]});})}))})];



   const images=await Promise.all(reportCharts(p.title,model.rows).map(async chart=>new Paragraph({pageBreakBefore:p.title==='Overview Produk'||p.title==='Overview per Segmen',children:[new ImageRun({data:await chartPng(chart),transformation:{width:580,height:chart.title==='Overview Produk'&&productChartPanels(chart).length>1?367:208}})],spacing:{before:160,after:160}})));



   return [heading,new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({tableHeader:true,children:p.headers.map(text=>new TableCell({shading:{fill:'087F8C'},children:[new Paragraph({children:[new TextRun({text,bold:true,color:'FFFFFF',size:22})]})]}))}),...p.rows.map((r,i)=>new TableRow({cantSplit:false,children:r.map((text,j)=>new TableCell({shading:{fill:i%2?'F2F5F7':'FFFFFF'},children:[new Paragraph({alignment:j>0&&(p.title==='Overview Produk'||p.title==='Overview per Segmen')?AlignmentType.CENTER:j>1&&p.title!=='Rincian Discrepancy'?AlignmentType.CENTER:AlignmentType.LEFT,children:[new TextRun({text:text==='Masih Pending'?'Pending':text,color:'08275C',size:22})]})]}))}))]}),...images];



  }))).flat();



  const doc=new Document({styles:{default:{document:{run:{font:'Arial',size:22,color:'08275C'}}}},sections:[{properties:{page:{margin:{top:720,bottom:720,left:720,right:720}}},children:cover},{properties:{page:{margin:{top:1260,bottom:900,left:720,right:720}}},headers:{default:new Header({children:[brand(),para(title+' | Monitoring Report',true),para(period)]})},footers:{default:new Footer({children:[new Paragraph({children:[new TextRun({text:title+' | Monitoring Report   ',size:18}),new TextRun({children:[PageNumber.CURRENT],size:18})]})]})},children:body}]});



  const result={blob:await d.Packer.toBlob(doc),name:file+'.docx'};if(download)saveBlob(result.blob,result.name);return result;



 }



}











