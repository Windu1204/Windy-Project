import {exportMonitoringWord} from './word-report';
import {reportCategory,reportDimension,reportMonth,categoryOverview} from './report-population.js';
import {regionOverview,regionMonthlyOverview} from './region-overview';
import { corporateWordDocument } from './word-style.js';
import { corporateStyle, summaryCard } from './corporate-style.js';
// Report layout and aggregation preserved from Corporate_Area_IJR_Monitoring_WCI_v78.html.
// Pure renderer: React supplies data/filter state; no DOM discovery or legacy credentials.
export function createRenderer(context) {
const RC={"title":"Regional - Non BNIDirect","dateKey":"salesDate","statusKey":"status","productKey":"product","productMode":"regional","dimensionKey":"region","dimensionLabel":"Wilayah","slaKey":null,"contents":["Executive Summary","Status Breakdown","Wilayah","Product & Sub Product","Beban Implementor","Detail Data"],"defaultChecked":6,"detailCols":[["Company","company"],["CID","cid"],["Request Date","salesDate"],["Wilayah","region"],["TB Produk","product"],["Implementor","implementor"],["Status","status"]]};
if(context.renderProfile==='ijr')Object.assign(RC,{title:'IJR - BNIdirect',productMode:'ijr',managementLayout:true,singleProduct:true,detailCols:[['Applicant','company'],['Application Number','cid'],['Request Date','salesDate'],['Wilayah','region'],['Application Type','type'],['Implementor','implementor'],['Status','status']]});
const DATA=context.dataset;
const $r=()=>({value:context.person});
const reportRows=()=>context.rows;
const selectedPersonName=()=>context.person === 'All Name' ? '' : context.person;
const selectedContent=()=>context.selected;
const periodLabel=()=>context.period;
const pptPeriodLabel=()=>context.presentationPeriod;
const PptxGenJS=context.PptxGenJS;
const docx=context.docx;
const productCategory=context.productCategory;
const corpProductCategory=context.productCategory;
const regSlaOf=r=>({status:r.slaStatus,real:r.slaReal,over:r.slaOverBy,solution:r.slaSolution});
const validSalesDate=context.validDate;
const regProductName=context.productName;
const validR=v=>v!==null&&v!==undefined&&String(v).trim()!=='';
const normDateR=v=>{if(!v)return'';let s=String(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''};
const countByR=(rows,fn)=>{let m={};rows.forEach(x=>{let k=fn(x);if(validR(k))m[String(k)]=(m[String(k)]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])};
const pctR=(n,d)=>d?Math.round(n/d*1000)/10:0;
function reportAllPeople(){let p=$r('rfPerson'),v=String(p?.value||'').trim();return !v||v.toLowerCase()==='all name'}
function reportPeople(rows){
  let map=new Map(),selected=reportAllPeople()?'':String($r('rfPerson')?.value||'').trim().toLowerCase();
  rows.forEach(r=>{let names=RC.title.startsWith('IJR')?[r['Implementor 1'],r['Implementor 2']]:[r.implementor];[...new Set(names.filter(validR).map(x=>String(x).trim()).filter(Boolean))].filter(name=>!selected||name.toLowerCase()===selected).forEach(name=>{if(!map.has(name))map.set(name,[]);map.get(name).push(r)})});
  return [...map.entries()].map(([name,records])=>{let done=records.filter(isDoneReport).length,waiting=records.filter(isWaitingReport).length,overdue=records.filter(x=>typeof regSlaOf==='function'&&regSlaOf(x).status==='Overdue').length;return{name,records,assigned:records.length,done,active:RC.productMode==='ijr'?records.filter(r=>!isDoneReport(r)&&reportStatusGroup(r)!=='Cancelled').length:records.length-done,waiting,overdue}}).sort((a,b)=>b.assigned-a.assigned||a.name.localeCompare(b.name));
}
function statusOf(x){return x[RC.statusKey]||'Unknown'}
function productOf(x){try{return RC.productMode==='regional'?productCategory(x[RC.productKey]):RC.productMode==='corporate'?corpProductCategory(x[RC.productKey]):x[RC.productKey]}catch(e){return x[RC.productKey]}}
function reportStatusGroup(x){
  const raw=String(statusOf(x)||'').trim(),v=raw.toLowerCase();
  // Handover is determined ONLY by the actual status field.
  // Project/Application Type = New must never imply Handover.
  if(/handover/.test(v))return 'Handover';
  if(RC.productMode==='corporate'){
    if(/retur|return/.test(v))return 'Retur';
    if(/transaction|done|complete|selesai|closed/.test(v))return 'Done';
    if(/progress|setup|initiation|waiting transactions|active/.test(v))return 'On Progress';
    return 'Pending';
  }
  if(RC.title.startsWith('IJR')){
    if(/dibatalkan|cancelled/.test(v))return 'Cancelled';
    if(/retur|return|reject/.test(v))return 'Retur';
    if(/proses selesai|done|complete|selesai|closed|delivered/.test(v))return 'Done';
    if(/pending|waiting|approval|submitted|submited|amandment|amendment/.test(v))return 'Pending';
    return 'On Progress';
  }
  if(/retur|return|reject/.test(v))return 'Retur';
  if(/done|complete|selesai|closed/.test(v))return 'Done';
  if(/pending|waiting|approval|document|doc/.test(v))return 'Pending';
  return 'On Progress';
}
function reportStatusOrder(){return ['Pending','On Progress','Done','Handover','Retur']}
function groupedStatuses(rows){if(RC.productMode==='ijr')return countByR(rows,statusOf);const c={};reportStatusOrder().forEach(k=>c[k]=0);rows.forEach(r=>{const k=reportStatusGroup(r);c[k]=(c[k]||0)+1});return reportStatusOrder().filter(k=>c[k]>0).map(k=>[k,c[k]])}
function isDoneReport(x){return reportStatusGroup(x)==='Done'}
function isWaitingReport(x){return reportStatusGroup(x)==='Pending'}
function reportModel(){
  const rows=reportRows();
  const statuses=groupedStatuses(rows), products=countByR(rows,productOf), dims=countByR(rows,x=>x[RC.dimensionKey]);
  const done=rows.filter(x=>reportStatusGroup(x)==='Done').length;
  const handover=rows.filter(x=>reportStatusGroup(x)==='Handover').length;
  const retur=rows.filter(x=>reportStatusGroup(x)==='Retur').length;
  const waiting=rows.filter(x=>reportStatusGroup(x)==='Pending').length;
  const inProgress=rows.filter(x=>reportStatusGroup(x)==='On Progress').length;
  const active=inProgress+waiting+retur;
  const attention=waiting;
  const within=rows.filter(x=>typeof regSlaOf==='function'&&regSlaOf(x).status==='Within SLA').length;
  const overdue=rows.filter(x=>typeof regSlaOf==='function'&&regSlaOf(x).status==='Overdue').length;
  return {rows,total:rows.length,done,handover,retur,active,waiting,inProgress,attention,within,overdue,statuses,products,dims,person:selectedPersonName(),people:reportPeople(rows),allPeople:reportAllPeople()};
}
function cleanFileName(s){return String(s).replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'')}
async function exportPptx(m){
  if(typeof PptxGenJS==='undefined') throw new Error('PowerPoint library belum tersedia. Pastikan koneksi internet aktif saat pertama kali membuka dashboard.');
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='Dashboard Monitoring WCI';pptx.subject=RC.title+' Monitoring Report';pptx.title=RC.title+' Monitoring Report';pptx.company='BNI';pptx.lang='id-ID';pptx.theme={headFontFace:'Arial',bodyFontFace:'Arial',lang:'id-ID'};
  const C={navy:'08275C',blue:'008B98',blue2:'008B98',green:'007A83',orange:'F47721',amber:'F28A13',red:'E44755',teal:'087486',ink:'173B68',muted:'607696',line:'D9E7F6',soft:'F4F9FF',white:'FFFFFF'};
  corporateStyle(pptx,context,RC.title);
  const coverPhoto=context.coverPhoto;
  const person=String($r('rfPerson')?.value||'').trim();
  const selected=selectedContent();
  const addHeader=(sl,title,section)=>{sl.background={color:'F8FBFF'};if(section){sl.addShape(pptx.ShapeType.roundRect,{x:.10,y:.07,w:1.62,h:.28,rectRadius:.05,line:{color:C.ink,transparency:100},fill:{color:C.ink}});sl.addText(section,{x:.16,y:.115,w:1.48,h:.13,fontFace:'Arial',fontSize:8.2,bold:true,color:C.white,margin:0,fit:'shrink'});}sl.addText(title,{x:.30,y:.40,w:7.1,h:.34,fontFace:'Arial',fontSize:18.5,bold:true,color:C.navy,margin:0});sl.addShape(pptx.ShapeType.line,{x:.30,y:.79,w:.38,h:0,line:{color:C.orange,width:2.2}});sl.addText(RC.title+' | Monitoring Report',{x:9.15,y:.29,w:3.75,h:.16,fontFace:'Arial',fontSize:7.2,bold:true,color:'0A5FAF',align:'right',margin:0});sl.addText('Periode: '+pptPeriodLabel(),{x:9.15,y:.45,w:3.75,h:.32,fontFace:'Arial',fontSize:6.7,color:C.muted,align:'right',margin:0});};
  const addCard=(sl,x,y,w,label,val,accent)=>summaryCard(sl,pptx,x,y,w,label,val,accent);
  const addPanel=(sl,x,y,w,h,title)=>{sl.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:.05,line:{color:C.line,width:.65},fill:{color:C.white}});sl.addText(title,{x:x+.15,y:y+.13,w:w-.30,h:.20,fontFace:'Arial',fontSize:10.1,bold:true,color:C.navy,margin:0});};
  const addBars=(sl,items,x,y,w,h,accent=C.blue)=>{const arr=RC.productMode==='ijr'?items:items.slice(0,5),mx=Math.max(1,...arr.map(z=>z[1]));arr.forEach((it,i)=>{const yy=y+i*(h/Math.max(1,arr.length));sl.addText(String(it[0]).slice(0,30),{x,y:yy,w:w*.38,h:.18,fontFace:'Arial',fontSize:7.2,color:C.ink,breakLine:false});sl.addShape(pptx.ShapeType.rect,{x:x+w*.42,y:yy+.01,w:w*.48,h:.16,line:{color:'E9F0F8',transparency:100},fill:{color:'E9F0F8'}});sl.addShape(pptx.ShapeType.rect,{x:x+w*.42,y:yy+.01,w:w*.48*(it[1]/mx),h:.16,line:{color:accent,transparency:100},fill:{color:accent,transparency:10}});sl.addText(String(it[1]),{x:x+w*.91,y:yy,w:w*.08,h:.18,fontFace:'Arial',fontSize:7.3,bold:true,color:C.navy,align:'right'});});};
  const dateKey=RC.dateKey;
  const monthKey=r=>reportMonth(r[dateKey]);
  const monthly=()=>{let mp=new Map();m.rows.forEach(r=>{let k=monthKey(r);if(!k)return;if(!mp.has(k))mp.set(k,{total:0,status:{}});let z=mp.get(k),g=reportStatusGroup(r);z.total++;z.status[g]=(z.status[g]||0)+1});return [...mp.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-9)};

  const reportHasSla=RC.productMode==='regional'||!!RC.slaKey;
  const managementProductName=r=>{if(!String(r[RC.productKey]??'').trim()||String(r[RC.productKey])==='Belum tersedia')return 'Belum tersedia';try{if(RC.productMode==='regional')return typeof regProductName==='function'?regProductName(r.product):String(r.product||'');if(RC.productMode==='corporate')return String(r.slaSolution||r.product||'Without Mapping');return productOf(r)}catch(e){return String(r[RC.productKey]||'')}};
  const managementType=r=>{const category=reportCategory(RC.productMode==='regional'?r.type:r.projectType);return category==='M'?'Maintenance':category==='N'?'New':'Belum diklasifikasikan';};
  const managementSla=r=>{if(RC.productMode==='regional'&&typeof regSlaOf==='function')return regSlaOf(r);return {status:String(r.slaStatus||''),real:r.slaReal,over:r.slaOverBy,solution:r.slaSolution||null}};
  const monthLabel=k=>/^\d{4}-\d{2}$/.test(k)?new Date(k+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'short',year:'2-digit',timeZone:'UTC'}):k;
  const chunk=(a,n)=>{let z=[];for(let i=0;i<a.length;i+=n)z.push(a.slice(i,i+n));return z};
  const keyCounts=(rows,keyFn)=>{let o={};rows.forEach(r=>{let k=String(keyFn(r)||'').trim();if(!k)return;o[k]=(o[k]||0)+1});return Object.entries(o).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))};
  const pairCount=(rows,keyFn,key,month)=>{let maint=0,neu=0;rows.forEach(r=>{if(monthKey(r)!==month)return;let k=String(keyFn(r)||'').trim();if(k!==key)return;if(managementType(r)==='Maintenance')maint++;else neu++});return [maint,neu]};
  const othersPair=(rows,keyFn,topSet,month)=>{let maint=0,neu=0;rows.forEach(r=>{if(monthKey(r)!==month)return;let k=String(keyFn(r)||'').trim();if(!k||topSet.has(k))return;if(managementType(r)==='Maintenance')maint++;else neu++});return [maint,neu]};
  // One reconciled population is used by BOTH Product and Dimension overviews.
  // A record is included only when date, product, and dimension are all valid.
  // This makes Overall Total Product = Overall Total Dimension and keeps every chart/table auditable.
  const commonOverviewRows=()=>m.rows.map(r=>({...r,[RC.productKey]:reportDimension(r[RC.productKey]),[RC.dimensionKey]:reportDimension(r[RC.dimensionKey])}));
  const addOverviewSlides=(title,keyLabel,keyFn,sectionBase)=>{
    const overviewRows=commonOverviewRows(),type=r=>reportCategory(RC.productMode==='regional'?r.type:r.projectType);
    if(String(keyLabel).toLowerCase()==='wilayah'){regionOverview(pptx,overviewRows,{region:r=>reportDimension(keyFn(r)),type,month:monthKey,addHeader,colors:C,monthlyComparison:true,separateProducts:true,kind:RC.productMode});return;}
    categoryOverview(pptx,overviewRows,{title,label:keyLabel,key:r=>reportDimension(keyFn(r)),type,month:monthKey,addHeader,colors:C,separateUnclassified:RC.productMode==='regional'});
  };
  const addProductDetailSlides=()=>{
    const map=new Map();m.rows.forEach(r=>{let name=String(managementProductName(r)||'').trim()||'Without Mapping';if(!map.has(name))map.set(name,[]);map.get(name).push(r)});
    const stats=[...map.entries()].map(([name,rows])=>{let maint=rows.filter(r=>managementType(r)==='Maintenance').length,neu=rows.length-maint,done=rows.filter(isDoneReport).length,waiting=rows.filter(isWaitingReport).length,active=rows.length-done,within=0,over=0;rows.forEach(r=>{let s=managementSla(r);if(s.status==='Within SLA')within++;else if(s.status==='Overdue')over++});let meas=within+over;return{name,total:rows.length,maint,neu,done,active,waiting,over,ach:meas?within/meas*100:null}}).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
    chunk(stats,11).forEach((part,pi)=>{const s=pptx.addSlide();addHeader(s,'Detail Implementasi per Produk','Detail Produk '+(stats.length>11?(pi+1)+'/'+Math.ceil(stats.length/11):''));let rows=[['Produk','Total','Maintenance','New Project','Completed','Active','Waiting','Overdue','SLA Achievement'],...part.map(x=>[x.name,x.total,x.maint,x.neu,x.done,x.active,x.waiting,x.over,x.ach==null?'-':x.ach.toFixed(1)+'%'])];s.addTable(rows,{x:.38,y:1.18,w:12.55,h:5.72,border:{type:'solid',pt:.5,color:'D6E4F3'},fill:C.white,color:'29456E',fontFace:'Arial',fontSize:7.2,margin:.04,rowH:.38,autoFit:false,bold:false,fillHeader:'087486',colorHeader:'FFFFFF'});});
  };
  const addManagementOverviewSlides=()=>{if(RC.managementLayout&&!selected.includes('Wilayah'))return;if(!RC.singleProduct)addOverviewSlides('Overview Implementasi per Produk','Produk',managementProductName,'Overview Produk');addOverviewSlides('Overview Implementasi per '+RC.dimensionLabel,RC.dimensionLabel,r=>r[RC.dimensionKey],'Overview '+RC.dimensionLabel);};
  const addManagementKeyTakeaways=()=>{
    if(RC.managementLayout&&!selected.includes('Key Takeaways'))return;
    const base=commonOverviewRows();
    const validDim=base;
    if(!base.length)return;
    const prod=keyCounts(base,managementProductName)[0];
    const dim=keyCounts(validDim,r=>r[RC.dimensionKey])[0];
    const monMap={};base.forEach(r=>{let k=monthKey(r);if(!k)return;monMap[k]=(monMap[k]||0)+1});const peak=Object.entries(monMap).sort((a,b)=>b[1]-a[1])[0];
    const maint=base.filter(r=>managementType(r)==='Maintenance').length,neu=base.filter(r=>managementType(r)==='New').length,unclassified=base.length-maint-neu;
    let within=0,over=0;base.forEach(r=>{const z=managementSla(r);if(z.status==='Within SLA')within++;else if(z.status==='Overdue')over++});const meas=within+over,ach=meas?Math.round(within/meas*1000)/10:null;
    const s=pptx.addSlide();addHeader(s,'Key Takeaways - Overview Implementasi','Management Highlights');
    const cards=[
      ['Capaian Implementasi',`${m.done.toLocaleString()} dari ${m.total.toLocaleString()} selesai (${pctR(m.done,m.total)}%)`,`${m.inProgress.toLocaleString()} permohonan masih dalam proses.`,C.teal],
      RC.singleProduct?['Registered / Delivered',String(base.filter(r=>/delivered/i.test(String(r.status))).length)+' permohonan','Proses telah selesai di TBS; Proses Selesai cabang ditampilkan terpisah dalam status.',C.orange]:['Top Product',prod?prod[0]:'-',prod?`${prod[1].toLocaleString()} implementasi pada basis overview.`:'Tidak ada produk yang dapat diringkas.',C.orange],
      ['Top '+RC.dimensionLabel,dim?dim[0]:'-',dim?`${dim[1].toLocaleString()} implementasi.`:'Tidak ada '+RC.dimensionLabel+' yang dapat diringkas.',C.teal],
      ['Peak Month',peak?monthLabel(peak[0]):'-',peak?`${peak[1].toLocaleString()} implementasi.`:'Tidak ada tren bulanan.',C.blue2],
      ['Komposisi',`${maint.toLocaleString()} Maintenance`,`${neu.toLocaleString()} New Project.${unclassified?'\n'+unclassified.toLocaleString()+' belum diklasifikasikan.':''}`,C.green],
      ['SLA',ach==null?'N/A':ach.toFixed(1)+'%',`${over.toLocaleString()} Overdue dari ${meas.toLocaleString()} measurable.`,C.red]
    ];
    cards.forEach((c,i)=>{const x=.55+(i%2)*6.18,y=1.38+Math.floor(i/2)*1.72;
      s.addText(String(i+1).padStart(2,'0'),{x,y:y+.12,w:.62,h:.45,fontFace:'Arial',fontSize:27,bold:true,color:C.teal,margin:0});
      s.addShape(pptx.ShapeType.line,{x:x+.72,y:y+.12,w:0,h:1.08,line:{color:C.line,width:1}});
      s.addText(c[0],{x:x+.96,y:y+.10,w:4.67,h:.27,fontFace:'Arial',fontSize:14,bold:true,color:C.navy,margin:0});
      s.addText(c[1]+'\n'+c[2],{x:x+.96,y:y+.44,w:4.67,h:.86,fontFace:'Arial',fontSize:13,color:C.ink,margin:0});
      s.addShape(pptx.ShapeType.line,{x,y:y+1.48,w:5.75,h:0,line:{color:C.line,width:.6}});
    });
  };
  const addImplementationSla=()=>{
    if(!selected.includes('Proses Implementasi & SLA'))return;
    const p=pptx.addSlide();addHeader(p,'Proses Implementasi & SLA','Proses Implementasi & SLA');const measured=m.within+m.overdue;
    addCard(p,.38,1.15,3.9,'Within SLA',m.within,C.teal);addCard(p,4.58,1.15,3.9,'Overdue',m.overdue,C.orange);addCard(p,8.78,1.15,4.1,'SLA Achievement',measured?(100*m.within/measured).toFixed(1)+'%':'—',C.teal);
    addPanel(p,.38,2.55,6.05,4.15,'Status Implementasi');addBars(p,m.statuses,.7,3.25,5.35,2.85,C.teal);
    addPanel(p,6.65,2.55,6.29,4.15,'SLA terukur');addBars(p,[['Within SLA',m.within],['Overdue',m.overdue]],6.95,3.25,5.45,2.65,C.teal);
    p.addText('Data terukur: '+measured+' dari '+m.total+' total record',{x:6.95,y:6.10,w:5.5,h:.2,fontSize:10,color:C.ink,margin:0});
    p.addText(RC.productMode==='ijr'?'IJR: SLA menggunakan Total Day TBS. Proses Selesai dan Registered, Delivered tetap ditampilkan sebagai status terpisah.':'Regional: tanggal dokumen lengkap sampai tanggal Done. Akhir pekan, libur nasional, dan cuti bersama dikecualikan.',{x:.7,y:6.45,w:11.9,h:.23,fontSize:9,color:C.muted,align:'center',margin:0});
  };
  if(!m.allPeople&&!RC.managementLayout){
    // 1. Cover — all text and decorative elements remain editable PowerPoint objects.
    let s=pptx.addSlide();s.background={color:'F8FBFF'};s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:7.5,line:{color:'F8FBFF',transparency:100},fill:{color:'F8FBFF'}});s.addImage({data:coverPhoto,x:7.72,y:.18,w:5.38,h:7.14,transparency:0});s.addShape(pptx.ShapeType.chevron,{x:6.55,y:-.20,w:2.15,h:7.95,line:{color:'DCEEFF',transparency:100},fill:{color:'DCEEFF',transparency:4}});s.addShape(pptx.ShapeType.chevron,{x:7.02,y:-.20,w:1.48,h:7.95,line:{color:C.white,transparency:100},fill:{color:C.white,transparency:5}});s.addShape(pptx.ShapeType.chevron,{x:10.72,y:4.85,w:2.72,h:3.05,line:{color:C.orange,transparency:100},fill:{color:C.orange,transparency:3}});s.addShape(pptx.ShapeType.rect,{x:.74,y:.72,w:.17,h:.18,line:{color:C.orange,transparency:100},fill:{color:C.orange}});s.addText('BNI',{x:.98,y:.64,w:1.22,h:.34,fontFace:'Arial',fontSize:21,bold:true,color:C.teal,margin:0});s.addText(RC.title,{x:.74,y:2.22,w:5.6,h:.42,fontFace:'Arial',fontSize:24,bold:true,color:C.navy,margin:0});s.addText('Monitoring Report',{x:.74,y:2.69,w:5.8,h:.43,fontFace:'Arial',fontSize:24,bold:true,color:C.blue,margin:0});s.addText('Periode: '+pptPeriodLabel(),{x:.74,y:3.22,w:5.6,h:.43,fontFace:'Arial',fontSize:11,color:C.navy,margin:0});s.addShape(pptx.ShapeType.line,{x:.74,y:3.72,w:.68,h:0,line:{color:C.orange,width:2.3}});s.addShape(pptx.ShapeType.ellipse,{x:.74,y:4.15,w:.50,h:.50,line:{color:C.blue,transparency:100},fill:{color:C.blue,transparency:8}});s.addShape(pptx.ShapeType.ellipse,{x:.90,y:4.27,w:.18,h:.18,line:{color:C.white,transparency:100},fill:{color:C.white}});s.addText('Implementor',{x:1.43,y:4.15,w:1.55,h:.17,fontFace:'Arial',fontSize:8.2,color:C.ink,margin:0});s.addText(person||'-',{x:1.43,y:4.39,w:4.75,h:.26,fontFace:'Arial',fontSize:13.5,bold:true,color:C.navy,margin:0});s.addText('Generated '+new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}),{x:.74,y:6.95,w:3.2,h:.16,fontFace:'Arial',fontSize:6.5,color:C.muted,margin:0});s.addText('1',{x:12.75,y:7.05,w:.20,h:.12,fontFace:'Arial',fontSize:6,color:C.white,align:'center',margin:0});
    // 2. Executive Summary
    s=pptx.addSlide();addHeader(s,'Executive Summary','2. Executive Summary');const k3=RC.slaKey?['Within SLA',m.within,C.teal]:['In Progress',m.inProgress,C.blue];const k4=RC.slaKey?['Overdue',m.overdue,C.red]:['Waiting / Pending',m.waiting,C.amber];addCard(s,.38,1.05,2.34,'Total Assigned',m.total,C.blue);addCard(s,2.91,1.05,2.34,'Completed / Done',m.done,C.green);addCard(s,5.44,1.05,2.34,k3[0],k3[1],k3[2]);addCard(s,7.97,1.05,2.34,k4[0],k4[1],k4[2]);addCard(s,10.50,1.05,2.44,'Overdue SLA (subset)',m.overdue,C.red);s.addText('Tidak dijumlahkan ke status; merupakan subset pekerjaan yang sudah ada.',{x:10.55,y:1.82,w:2.32,h:.18,fontFace:'Arial',fontSize:5.5,color:C.muted,align:'center',margin:0,fit:'shrink'});addPanel(s,.38,2.12,6.05,4.78,'Status Breakdown');addPanel(s,6.65,2.12,6.29,4.78,'Top Product (by assigned)');
    const sts=m.statuses.slice(0,6);if(sts.length){try{s.addChart(pptx.ChartType.doughnut,[{name:'Status',labels:sts.map(x=>x[0]),values:sts.map(x=>x[1])}],{x:.62,y:2.72,w:2.65,h:2.65,holeSize:62,showLegend:false,showTitle:false,showValue:false,chartColors:sts.map(x=>({'Pending':C.amber,'On Progress':C.blue,'Done':C.green,'Handover':C.teal,'Retur':'7B61D1'}[x[0]]||'9AA9BC')),border:{color:C.white,pt:0}})}catch(e){addBars(s,sts,.65,2.85,5.3,3.3,C.blue)}sts.slice(0,5).forEach((it,i)=>{s.addText(`${it[0]}   ${it[1]} (${m.total?pctR(it[1],m.total):0}%)`,{x:3.35,y:2.75+i*.5,w:2.7,h:.22,fontFace:'Arial',fontSize:7.4,color:C.ink})});}addBars(s,m.products,6.92,2.82,5.55,3.25,C.blue2);
    // 3. Workload & Product
    addImplementationSla();
    s=pptx.addSlide();addHeader(s,'Workload & Product Overview','3. Workload & Product');addPanel(s,.38,1.05,6.05,5.95,'Distribution by '+(RC.title.startsWith('IJR')?'Application Type':'Product / Category'));addPanel(s,6.65,1.05,6.29,5.95,'Top '+(RC.title.startsWith('IJR')?'Wilayah / Cabang':RC.dimensionLabel));
    const prods=m.products.slice(0,6);if(prods.length){try{s.addChart(pptx.ChartType.doughnut,[{name:'Product',labels:prods.map(x=>x[0]),values:prods.map(x=>x[1])}],{x:.7,y:2.0,w:2.7,h:2.7,holeSize:62,showLegend:false,showTitle:false,chartColors:['0D3B75',C.blue,C.orange,'82B7F2','7B61D1','4FB5C6'],border:{color:C.white,pt:0}})}catch(e){addBars(s,prods,.7,1.8,5.2,3.7,C.blue)}prods.slice(0,5).forEach((it,i)=>s.addText(`${it[0]}   ${it[1]} (${m.total?pctR(it[1],m.total):0}%)`,{x:3.45,y:2.0+i*.55,w:2.55,h:.22,fontFace:'Arial',fontSize:7.4,color:C.ink}));}addBars(s,m.dims,6.95,1.85,5.45,3.9,C.blue2);
    // 4. Status & Timeline
    s=pptx.addSlide();addHeader(s,'Status Trend & Request Date','4. Status & Timeline');addPanel(s,.38,1.05,6.05,5.95,'Status Trend per Month');addPanel(s,6.65,1.05,6.29,5.95,'Request Date Distribution');const mons=monthly();if(mons.length){const labels=mons.map(x=>monthLabel(x[0]));try{const order=reportStatusOrder().filter(k=>mons.some(x=>(x[1].status[k]||0)>0)),colorMap={'Pending':C.amber,'On Progress':C.blue,'Done':C.green,'Handover':C.teal,'Retur':'7B61D1'};s.addChart(pptx.ChartType.bar,order.map(k=>({name:k,labels,values:mons.map(x=>x[1].status[k]||0)})),{x:.72,y:1.78,w:5.35,h:4.3,catAxisLabelFontSize:7,valAxisLabelFontSize:7,showLegend:true,legendFontSize:7,legendPos:'t',showTitle:false,showValue:false,chartColors:order.map(k=>colorMap[k]),showCatName:false,showValAxisTitle:false,showCatAxisTitle:false,showGridLines:true,gridLine:{color:'E6EEF7',pt:.5},catAxisLineColor:'CBD8E8',valAxisLineColor:'CBD8E8',grouping:'stacked'})}catch(e){addBars(s,mons.map(x=>[x[0],x[1].total]),.7,1.8,5.3,3.8,C.blue)}try{s.addChart(pptx.ChartType.line,[{name:'Requests',labels,values:mons.map(x=>x[1].total)}],{x:6.95,y:1.78,w:5.35,h:4.3,catAxisLabelFontSize:7,valAxisLabelFontSize:7,showLegend:false,showTitle:false,showValue:false,chartColors:[C.blue],lineSize:2,showMarker:true,markerSize:5,showGridLines:true,gridLine:{color:'E6EEF7',pt:.5},catAxisLineColor:'CBD8E8',valAxisLineColor:'CBD8E8'})}catch(e){addBars(s,mons.map(x=>[x[0],x[1].total]),6.95,1.8,5.3,3.8,C.blue)}}
    // 5. Detailed Work List, paginated only when necessary.
    if(selected.includes('Detail Data')){let cols=RC.detailCols.slice(0,8),chunkSize=10,totalPages=Math.max(1,Math.ceil(m.rows.length/chunkSize));for(let pg=0;pg<totalPages;pg++){s=pptx.addSlide();addHeader(s,'Detail Work List – '+(person||'Selected Implementor'),`5. Detailed List${totalPages>1?' '+(pg+1)+'/'+totalPages:''}`);let part=m.rows.slice(pg*chunkSize,(pg+1)*chunkSize),headerRow=cols.map((c,i)=>({text:String(c[0]),options:{fill:'087486',color:'FFFFFF',bold:true,align:i===0?'left':'center',valign:'mid'}})),rows=[headerRow,...part.map(r=>cols.map(c=>String(r[c[1]]??'-').slice(0,36)))];s.addTable(rows,{x:.38,y:1.15,w:12.55,h:5.72,border:{type:'solid',pt:.5,color:'D6E4F3'},fill:C.white,color:'29456E',fontFace:'Arial',fontSize:6.8,margin:.04,rowH:.38,autoFit:false,bold:false,fillHeader:'087486',colorHeader:'FFFFFF'});s.addText(`Records ${pg*chunkSize+1}-${pg*chunkSize+part.length} of ${m.rows.length}`,{x:.42,y:7.0,w:3,h:.16,fontFace:'Arial',fontSize:6.5,color:C.muted});}}
    // 6. Key Takeaways & Next Actions — only deterministic statements derived from the selected data.
    s=pptx.addSlide();addHeader(s,'Key Takeaways & Next Actions','6. Key Takeaways');addPanel(s,.38,1.12,6.05,5.75,'Key Takeaways');addPanel(s,6.65,1.12,6.29,5.75,'Next Actions');const completion=m.total?Math.round(m.done/m.total*100):0,topProd=m.products[0],peak=monthly().sort((a,b)=>b[1].total-a[1].total)[0];let take=[`Total ${m.total} pekerjaan; ${m.done} completed (${completion}%).`,topProd?`Kategori terbesar: ${topProd[0]} (${topProd[1]} record).`:'Tidak ada kategori product yang dapat diringkas.',RC.slaKey?`${m.overdue} record berstatus Overdue dan ${m.within} Within SLA.`:`${m.inProgress} pekerjaan In Progress dan ${m.waiting} Waiting / Pending.`,peak?`Volume request tertinggi pada ${peak[0]} (${peak[1].total} record).`:null].filter(Boolean);let acts=[];if(RC.slaKey&&m.overdue)acts.push(`Prioritaskan review ${m.overdue} pekerjaan Overdue.`);if(m.waiting)acts.push(`Follow up ${m.waiting} pekerjaan Waiting / Pending.`);if(m.inProgress)acts.push(`Monitor penyelesaian ${m.inProgress} pekerjaan In Progress.`);if(!acts.length)acts.push('Tidak ada pekerjaan aktif/waiting yang memerlukan tindak lanjut berdasarkan filter report.');acts.push('Gunakan Detail Work List untuk tindak lanjut per application/request.');take.forEach((t,i)=>{s.addText(String(i+1).padStart(2,'0'),{x:.72,y:1.9+i*.95,w:.55,h:.35,fontFace:'Arial',fontSize:24,bold:true,color:C.teal,margin:0});s.addText(t,{x:1.43,y:1.9+i*.95,w:4.5,h:.68,fontFace:'Arial',fontSize:13,color:C.ink,margin:0});});acts.forEach((t,i)=>{s.addText(String(i+1).padStart(2,'0'),{x:7.0,y:1.9+i*.95,w:.55,h:.35,fontFace:'Arial',fontSize:24,bold:true,color:C.teal,margin:0});s.addText(t,{x:7.71,y:1.9+i*.95,w:4.8,h:.68,fontFace:'Arial',fontSize:13,color:C.ink,margin:0});});s.addShape(pptx.ShapeType.arc,{x:11.65,y:5.95,w:1.8,h:1.8,adjustPoint:.25,rotate:20,line:{color:C.blue,width:11,transparency:20},fill:{color:C.white,transparency:100}});s.addShape(pptx.ShapeType.arc,{x:11.9,y:6.2,w:1.35,h:1.35,adjustPoint:.25,rotate:20,line:{color:C.orange,width:9,transparency:15},fill:{color:C.white,transparency:100}});
  }else{
    // All Name keeps the management-summary behavior; no record-by-record appendix.
    let s=pptx.addSlide();s.background={color:'F8FBFF'};s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:7.5,line:{color:'F8FBFF',transparency:100},fill:{color:'F8FBFF'}});s.addImage({data:coverPhoto,x:7.72,y:.18,w:5.38,h:7.14});s.addShape(pptx.ShapeType.chevron,{x:6.55,y:-.20,w:2.15,h:7.95,line:{color:'DCEEFF',transparency:100},fill:{color:'DCEEFF',transparency:4}});s.addShape(pptx.ShapeType.chevron,{x:7.02,y:-.20,w:1.48,h:7.95,line:{color:C.white,transparency:100},fill:{color:C.white,transparency:5}});s.addShape(pptx.ShapeType.chevron,{x:10.72,y:4.85,w:2.72,h:3.05,line:{color:C.orange,transparency:100},fill:{color:C.orange,transparency:3}});s.addShape(pptx.ShapeType.rect,{x:.74,y:.72,w:.17,h:.18,line:{color:C.orange,transparency:100},fill:{color:C.orange}});s.addText('BNI',{x:.98,y:.64,w:1.22,h:.34,fontFace:'Arial',fontSize:21,bold:true,color:C.teal,margin:0});s.addText(RC.title,{x:.74,y:2.22,w:5.6,h:.42,fontFace:'Arial',fontSize:24,bold:true,color:C.navy,margin:0});s.addText('Monitoring Report',{x:.74,y:2.69,w:5.8,h:.43,fontFace:'Arial',fontSize:24,bold:true,color:C.blue,margin:0});s.addText('Periode: '+pptPeriodLabel(),{x:.74,y:3.22,w:5.6,h:.43,fontFace:'Arial',fontSize:11,color:C.navy,margin:0});s.addShape(pptx.ShapeType.line,{x:.74,y:3.72,w:.68,h:0,line:{color:C.orange,width:2.3}});s.addShape(pptx.ShapeType.ellipse,{x:.74,y:4.15,w:.50,h:.50,line:{color:C.blue,transparency:100},fill:{color:C.blue,transparency:8}});s.addShape(pptx.ShapeType.ellipse,{x:.90,y:4.27,w:.18,h:.18,line:{color:C.white,transparency:100},fill:{color:C.white}});s.addText('Implementor',{x:1.43,y:4.15,w:1.55,h:.17,fontFace:'Arial',fontSize:8.2,color:C.ink,margin:0});s.addText(m.person||'ALL IMPLEMENTORS',{x:1.43,y:4.39,w:4.75,h:.26,fontFace:'Arial',fontSize:13.5,bold:true,color:C.navy,margin:0});s.addText('Generated '+new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}),{x:.74,y:6.95,w:3.2,h:.16,fontFace:'Arial',fontSize:6.5,color:C.muted,margin:0});
    if(!RC.managementLayout||selected.includes('Executive Summary')||selected.includes('Status Breakdown')){s=pptx.addSlide();addHeader(s,'Executive Summary','2. Executive Summary');addCard(s,.38,1.05,2.34,'Total Records',m.total,C.blue);addCard(s,2.91,1.05,2.34,'Completed / Done',m.done,C.green);addCard(s,5.44,1.05,2.34,RC.slaKey?'Within SLA':'In Progress',RC.slaKey?m.within:m.inProgress,RC.slaKey?C.teal:C.blue);addCard(s,7.97,1.05,2.34,'Waiting / Pending',m.waiting,C.amber);addCard(s,10.50,1.05,2.44,'Overdue SLA (subset)',m.overdue,C.red);s.addText(RC.singleProduct?'Completed = Proses Selesai + Registered, Delivered. Dibatalkan: '+m.rows.filter(r=>reportStatusGroup(r)==='Cancelled').length+'. Overdue tidak ditambahkan ke total.':'Tidak dijumlahkan ke status; merupakan subset pekerjaan yang sudah ada.',RC.singleProduct?{x:.38,y:1.94,w:12.57,h:.16,fontFace:'Arial',fontSize:10,color:C.ink,margin:0}:{x:10.55,y:1.82,w:2.32,h:.18,fontFace:'Arial',fontSize:5.5,color:C.muted,align:'center',margin:0,fit:'shrink'});addPanel(s,.38,2.12,6.05,4.78,'Status Breakdown');{const cm={'Pending':C.amber,'On Progress':C.blue,'Done':C.green,'Handover':C.teal,'Retur':'7B61D1'},mx=Math.max(1,...m.statuses.map(x=>x[1]));m.statuses.forEach((it,i)=>{const yy=2.82+i*.55;s.addText(it[0],{x:.72,y:yy,w:1.55,h:.18,fontFace:'Arial',fontSize:7.2,color:C.ink,margin:0});s.addShape(pptx.ShapeType.rect,{x:2.28,y:yy+.02,w:2.75,h:.14,line:{color:'EAF0F7',transparency:100},fill:{color:'EAF0F7'}});s.addShape(pptx.ShapeType.rect,{x:2.28,y:yy+.02,w:2.75*(it[1]/mx),h:.14,line:{color:cm[it[0]]||C.blue,transparency:100},fill:{color:cm[it[0]]||C.blue}});s.addText(String(it[1]),{x:5.14,y:yy-.01,w:.48,h:.18,fontFace:'Arial',fontSize:7.2,bold:true,color:C.navy,align:'right',margin:0})})}addPanel(s,6.65,2.12,6.29,4.78,RC.singleProduct?'Tahapan Proses':'Top Product / Category');addBars(s,RC.singleProduct?countByR(m.rows,r=>r['Flow Process']||'Belum tersedia'):m.products,6.95,2.85,5.4,3.4,C.blue2);}
    addImplementationSla();
    addManagementOverviewSlides();
    addManagementKeyTakeaways();
    if(m.people&&m.people.length&&(!RC.managementLayout||selected.includes('Beban Implementor'))){let chunk=10,total=Math.ceil(m.people.length/chunk);for(let pg=0;pg<total;pg++){s=pptx.addSlide();addHeader(s,'KPI Per Person',`3. KPI Per Person${total>1?' '+(pg+1)+'/'+total:''}`);let part=m.people.slice(pg*chunk,(pg+1)*chunk),head=['PIC / Implementor','Assigned','Completed','Active','Waiting','Overdue'];let headerRow=head.map((v,i)=>({text:String(v),options:{fill:'087486',color:'FFFFFF',bold:true,align:i===0?'left':'center',valign:'mid'}}));let rows=[headerRow,...part.map(p=>[p.name,p.assigned,p.done,p.active,p.waiting,p.overdue])];s.addTable(rows,{x:.55,y:1.25,w:12.1,h:5.75,border:{type:'solid',pt:.5,color:'DCE8F6'},fill:C.white,color:'29456E',fontFace:'Arial',fontSize:8,margin:.05,rowH:.38,autoFit:false,bold:false,fillHeader:'087486',colorHeader:'FFFFFF'});if(RC.singleProduct)s.addText('Satu permohonan dapat melibatkan beberapa implementor. Dibatalkan tidak termasuk Active; Waiting merupakan bagian dari Active.',{x:.55,y:6.85,w:12.1,h:.18,fontFace:'Arial',fontSize:9,color:C.muted,margin:0});}}
  }
  if(!m.allPeople&&selected.includes('Wilayah'))addOverviewSlides('Overview Implementasi per Wilayah','Wilayah',r=>r[RC.dimensionKey],'Overview Wilayah');
  if(RC.managementLayout&&!m.allPeople&&selected.includes('Detail Data')){
    for(let page=0;page<Math.ceil(m.rows.length/10);page++){
      const s=pptx.addSlide();addHeader(s,'Detail Work List – '+person,`Detail Data ${page+1}/${Math.ceil(m.rows.length/10)}`);
      s.addTable([RC.detailCols.map(c=>c[0]),...m.rows.slice(page*10,(page+1)*10).map(r=>RC.detailCols.map(c=>String(r[c[1]]??'—')))],{x:.38,y:1.25,w:12.55,h:5.5,fontFace:'Arial',fontSize:10,margin:.04,rowH:.38,autoPage:false});
    }
  }
  const fn=`${cleanFileName(RC.title)}_Monitoring_Report_${new Date().toISOString().slice(0,10)}.pptx`;await pptx.writeFile({fileName:fn});
}
async function exportDocx(m){await exportMonitoringWord(context,RC.productMode==='ijr'?'ijr':RC.productMode,m,RC.title);}
return {model:reportModel,pptx:exportPptx,docx:exportDocx};
}
