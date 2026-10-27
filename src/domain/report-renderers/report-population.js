import { requestCategory } from '../request-category';
import { regionMonthlyOverview, regionMonthHeaderRows } from './region-overview';
export const reportCategory=value=>requestCategory(value);
export const reportDimension=value=>String(value??'').trim()&&!/^w?0+$/i.test(String(value).trim())?String(value).trim():'Belum tersedia';
export function reportMonth(value){const raw=String(value??'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||raw<'2000-01-01')return 'Tanpa tanggal';const date=new Date(raw+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===raw?raw.slice(0,7):'Tanpa tanggal';}
export function categoryOverview(pptx,rows,{title,label,key,type,month,addHeader,colors:C,separateUnclassified=false}){
 const totals=new Map();for(const row of rows){const name=reportDimension(key(row));totals.set(name,(totals.get(name)||0)+1);}
 const ordered=[...totals].sort((a,b)=>b[1]-a[1]),chosen=ordered.filter(([n])=>n!=='Belum tersedia').slice(0,8).map(([n])=>n);if(totals.has('Belum tersedia'))chosen.push('Belum tersedia');
 const visible=r=>chosen.includes(reportDimension(key(r)))?reportDimension(key(r)):'Lainnya';
 const model=regionMonthlyOverview(rows,{region:visible,type,month,separateUnclassified},!separateUnclassified&&rows.some(r=>type(r)==='U')?2:3);
 model.pages.forEach((page,index)=>{
  const slide=pptx.addSlide();addHeader(slide,title,`${title} ${index+1}/${model.pages.length}`);
  const headers=regionMonthHeaderRows(page.months,model.types);headers[0][0].text=label;
  slide.addTable([...headers,...page.rows],{regionOverviewLayout:true,regionOverviewHeaderRows:2,x:.55,y:1.35,w:12.2,h:4.9,colW:[2.15,...Array(page.months.length*model.types.length).fill(8.5/(page.months.length*model.types.length)),1.55],fontFace:'Arial',fontSize:10,rowH:.3,margin:.015,border:{type:'solid',pt:.5,color:'DCE3E7'},autoPage:false});
  slide.addText(`Total report: ${rows.length}. N = New · M = Maintenance. ${separateUnclassified?'Total mencakup jenis pekerjaan belum diisi; rinciannya ada pada ringkasan terpisah.':'Jenis kosong/tidak dikenali dicatat terpisah.'} Total bulan halaman hanya mencakup bulan yang terlihat.`,{x:.55,y:6.7,w:12.2,h:.36,fontSize:9,color:C.muted,align:'center',margin:0});
 });
 if(separateUnclassified){
  const pending=rows.filter(r=>type(r)==='U'),groups=[...new Set(pending.map(r=>reportDimension(key(r))))].sort();
  for(let offset=0;offset<groups.length;offset+=10){
   const part=groups.slice(offset,offset+10),slide=pptx.addSlide();addHeader(slide,'Jenis pekerjaan belum diisi','Ringkasan Jenis Pekerjaan');
   const data=[[label,'Jumlah'],...part.map(name=>[name,pending.filter(r=>reportDimension(key(r))===name).length]),['Grand Total',pending.length]];
   slide.addTable(data,{regionOverviewLayout:true,x:1.4,y:1.42,w:10.5,h:Math.min(4.9,data.length*.39),colW:[7.5,3],rowH:.39,fontFace:'Arial',fontSize:12,margin:.04,border:{type:'solid',pt:.5,color:'DCE3E7'},autoPage:false});
   slide.addText('Data ini tetap masuk Total report dan tidak otomatis dianggap New atau Maintenance.',{x:.55,y:6.7,w:12.2,h:.3,fontSize:10,color:C.muted,align:'center',margin:0});
  }
 }
}
