import { type KpiReport, type KpiReportPerson, kpiMonths, kpiGroups, kpiReportRows } from '../domain/kpi-report';
import { formatKpi } from '../domain/formal-kpi';

export async function kpiWord(report:KpiReport):Promise<Blob> {
 const d=await import('docx');
 const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,Header,Footer,PageNumber,AlignmentType,WidthType,BorderStyle,TableLayoutType,HeadingLevel}=d;
 const width=report.annual?15038:10106;
 const p=(text:string,options:Record<string,unknown>={})=>new Paragraph({spacing:{after:65},children:[new TextRun({text,size:21,font:'Arial'})],...options});
 const heading=(text:string,level:(typeof HeadingLevel)[keyof typeof HeadingLevel]=HeadingLevel.HEADING_2)=>new Paragraph({text,heading:level,keepNext:true,spacing:{before:120,after:80}});
 const border={style:BorderStyle.SINGLE,size:4,color:'D9E4EA'};
 function table(rows:string[][],widths:number[],headerRows=1,spans?:number[][]) {
  return new Table({width:{size:width,type:WidthType.DXA},columnWidths:widths,layout:TableLayoutType.FIXED,borders:{top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border},rows:rows.map((row,index)=>{
   let col=0;return new TableRow({tableHeader:index<headerRows,cantSplit:true,children:row.map((text,j)=>{const span=spans?.[index]?.[j]||1,start=col;col+=span;return new TableCell({columnSpan:span,width:{size:widths.slice(start,start+span).reduce((a,b)=>a+b,0),type:WidthType.DXA},verticalAlign:'center',margins:{top:55,bottom:55,left:60,right:60},shading:{fill:index<headerRows?'008592':index%2?'F3F7F9':'FFFFFF'},children:[new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0,line:report.annual?200:220},children:text.split('\n').map((line,k)=>new TextRun({text:line,break:k?1:0,bold:index<headerRows,font:'Arial',size:report.annual?18:19,color:index<headerRows?'FFFFFF':'173451'}))})]});})});})});
 }
 const header=new Header({children:[new Paragraph({tabStops:[{type:d.TabStopType.RIGHT,position:width}],children:[new TextRun({text:'WCI Monitoring',bold:true,size:19,color:'008592'}),new TextRun({text:'\t'+report.label,size:19})]})]});
 const footer=new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'Internal Application  |  ',size:17}),new TextRun({children:[PageNumber.CURRENT],size:17}),new TextRun({text:' / ',size:17}),new TextRun({children:[PageNumber.TOTAL_PAGES],size:17})]})]});
 const sections:any[]=[];
 const section=(children:any[])=>({properties:{page:{size:{width:report.annual?16838:11906,height:report.annual?11906:16838},margin:{top:report.annual?720:900,bottom:report.annual?720:900,left:900,right:900,header:360,footer:360}}},headers:{default:header},footers:{default:footer},children});
 if(report.people.length>1)sections.push(section([
  heading('Report KPI '+(report.annual?'Tahunan':'Bulanan'),HeadingLevel.TITLE),p('Periode '+report.label),p('Dibuat '+report.generated+' WIB'),p('Ringkasan KPI anggota sesuai pilihan dan hak akses. Rincian setiap pegawai dimulai pada halaman baru.'),
  table([['Nama','Kelompok KPI','Indikator','Target terisi','Realisasi terisi'],...report.people.map(e=>[e.person.name,kpiGroups[e.template.group_code],String(e.template.indicators.length),String(e.values.filter(v=>v.target).length)+' / '+e.template.indicators.length*(report.annual?12:1),String(e.values.filter(v=>v.actual!==null).length)+' / '+e.template.indicators.length*(report.annual?12:1)])],[Math.round(width*.27),Math.round(width*.37),Math.round(width*.1),Math.round(width*.13),width-Math.round(width*.27)-Math.round(width*.37)-Math.round(width*.1)-Math.round(width*.13)])
 ]));
 function identity(e:KpiReportPerson) {return [heading('Report KPI '+(report.annual?'Tahunan':'Bulanan'),HeadingLevel.TITLE),heading(e.person.name,HeadingLevel.HEADING_1),p(kpiGroups[e.template.group_code]+' · '+e.template.title),p('Periode '+report.label+'   |   Dibuat '+report.generated+' WIB'),
  table([['NPP','Jabatan','Grade','Kelolaan'],[e.person.npp||'—',e.person.position||'—',e.person.grade||'—',e.person.managed||'—']],[Math.round(width*.2),Math.round(width*.2),Math.round(width*.1),width-Math.round(width*.2)*2-Math.round(width*.1)]),p('Indikator: '+e.template.indicators.length+'   |   Target terisi: '+e.values.filter(v=>v.target).length+'   |   Realisasi terisi: '+e.values.filter(v=>v.actual!==null).length,{spacing:{before:150,after:150}})];}
 for(const e of report.people){
  if(!report.annual){
   const rows=kpiReportRows(e,report.period),children:any[]=identity(e);
   for(const perspective of [...new Set(e.template.indicators.map(i=>i.perspective))]){
    children.push(heading(perspective),table([['Indikator KPI','Bobot','Satuan','Target','Realisasi','Capaian / Status'],...rows.filter(r=>r.indicator.perspective===perspective).map(r=>[r.indicator.label+(r.indicator.details.length?'\n'+r.indicator.details.join('\n'):''),(r.indicator.weight*100).toLocaleString('id-ID')+'%',r.indicator.unit,r.target,r.value?.actual===null||r.value?.actual===undefined?'Belum diinput':r.actual,(r.ratio!==null?r.ratio.toLocaleString('id-ID',{maximumFractionDigits:1})+'%\n':'')+r.status])],[3600,850,1100,1250,1250,width-8050]));
   }
   const notes=rows.filter(r=>r.value?.note);if(notes.length){children.push(heading('Catatan realisasi'));for(const r of notes)children.push(p(r.indicator.label,{keepNext:true}),p(r.value!.note));}
   children.push(p('Nilai akhir berbobot dan Special Scoring belum dihitung karena aturan penilaian belum ditetapkan.',{spacing:{before:180,after:0}}));sections.push(section(children));
  } else {
   for(let half=0;half<2;half++){
    const children:any[]=half===0?[heading('Report KPI Tahunan',HeadingLevel.TITLE),heading(e.person.name,HeadingLevel.HEADING_1),p(kpiGroups[e.template.group_code]+' · '+e.template.title),p('NPP '+(e.person.npp||'—')+' · Jabatan '+e.person.position+' · Grade '+e.person.grade+' · Kelolaan '+e.person.managed),p(report.label+' · Dibuat '+report.generated+' WIB · Indikator '+e.template.indicators.length+' · Target terisi '+e.values.filter(v=>v.target).length+' · Realisasi terisi '+e.values.filter(v=>v.actual!==null).length)]:[heading(e.person.name,HeadingLevel.HEADING_1),p(kpiGroups[e.template.group_code]+' · '+report.label)];
    children.push(heading('Semester '+(half+1)+' '+report.period.slice(0,4)),p('Persentase, rata-rata, dan angka kumulatif tidak dijumlahkan.'));
    const first=half*6,heads=['Indikator KPI',...kpiMonths.slice(first,first+6)],sub=['Bobot dan satuan',...Array.from({length:6},()=>['Target','Realisasi']).flat()];
    const values=e.template.indicators.map((i,index)=>[(index===0||e.template.indicators[index-1].perspective!==i.perspective?i.perspective+'\n':'')+i.label+'\n'+(i.weight*100).toLocaleString('id-ID')+'% · '+i.unit,...Array.from({length:6},(_,j)=>{const period=report.period.slice(0,4)+'-'+String(first+j+1).padStart(2,'0');const v=e.values.find(v=>v.indicator_key===i.key&&v.period.slice(0,7)===period);return [v?.target||'Belum diisi',v?.actual===null||v?.actual===undefined?'Belum diinput':formatKpi(v.actual,i.unit)];}).flat()]);
    const columns=[3638,...Array(12).fill(950)];children.push(table([heads,sub,...values],columns,2,[[1,...Array(6).fill(2)]]));
    const notes=e.values.filter(v=>v.note&&+v.period.slice(5,7)>first&&+v.period.slice(5,7)<=first+6);if(notes.length){children.push(heading('Catatan realisasi'));for(const v of notes)children.push(p(kpiMonths[+v.period.slice(5,7)-1]+' · '+(e.template.indicators.find(i=>i.key===v.indicator_key)?.label||''),{keepNext:true}),p(v.note));}
    sections.push(section(children));
   }
  }
 }
 return Packer.toBlob(new Document({creator:'WCI Monitoring',title:'Report KPI '+report.label,styles:{default:{document:{run:{font:'Arial',size:21,color:'173451'}}},paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',run:{font:'Arial',size:34,bold:true,color:'000000'}},{id:'Heading1',name:'Heading 1',basedOn:'Normal',run:{font:'Arial',size:27,bold:true,color:'000000'}},{id:'Heading2',name:'Heading 2',basedOn:'Normal',run:{font:'Arial',size:23,bold:true,color:'000000'}}]},sections}));
}
