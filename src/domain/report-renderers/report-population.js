import { requestCategory } from '../request-category';
import { regionMonthlyOverview, regionMonthHeaderRows } from './region-overview';
export const reportCategory=value=>requestCategory(value);
export const reportDimension=value=>String(value??'').trim()&&!/^w?0+$/i.test(String(value).trim())?String(value).trim():'Belum tersedia';
export function reportMonth(value){const raw=String(value??'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||raw<'2000-01-01')return 'Tanpa tanggal';const date=new Date(raw+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===raw?raw.slice(0,7):'Tanpa tanggal';}
export function categoryOverview(pptx,rows,{title,label,key,type,month,addHeader,colors:C}){
 const totals=new Map();for(const row of rows){const name=reportDimension(key(row));totals.set(name,(totals.get(name)||0)+1);}
 const ordered=[...totals].sort((a,b)=>b[1]-a[1]),chosen=ordered.filter(([n])=>n!=='Belum tersedia').slice(0,8).map(([n])=>n);if(totals.has('Belum tersedia'))chosen.push('Belum tersedia');
 const visible=r=>chosen.includes(reportDimension(key(r)))?reportDimension(key(r)):'Lainnya';
 const model=regionMonthlyOverview(rows,{region:visible,type,month},rows.some(r=>type(r)==='U')?2:3);
 model.pages.forEach((page,index)=>{
  const slide=pptx.addSlide();addHeader(slide,title,`${title} ${index+1}/${model.pages.length}`);
  const headers=regionMonthHeaderRows(page.months,model.types);headers[0][0].text=label;
  slide.addTable([...headers,...page.rows],{regionOverviewLayout:true,regionOverviewHeaderRows:2,x:.55,y:1.35,w:12.2,h:4.9,colW:[2.15,...Array(page.months.length*model.types.length).fill(8.5/(page.months.length*model.types.length)),1.55],fontFace:'Arial',fontSize:10,rowH:.3,margin:.015,border:{type:'solid',pt:.5,color:'DCE3E7'},autoPage:false});
  slide.addText(`Total report: ${rows.length}. N = New · M = Maintenance. Jenis kosong/tidak dikenali dicatat terpisah. Total bulan halaman hanya mencakup bulan yang terlihat.`,{x:.55,y:6.7,w:12.2,h:.36,fontSize:9,color:C.muted,align:'center',margin:0});
 });
}
