import {createWordDocument} from './word-document';
import {reportCategory,reportDimension,reportMonth} from './report-population';
import {regionMonthlyOverview} from './region-overview';
export async function exportMonitoringWord(context,kind,model,title){
 const rows=model.rows,fieldType=kind==='regional'?'type':'projectType',dimension=kind==='corporate'?'segment':'region',selection=context.selected,sections=[];
 const add=(title,headers,data,note='',options={})=>sections.push({title,headers,rows:data,note,...options});
 const types=rows.some(r=>reportCategory(r[fieldType])==='U')?['N','M','U']:['N','M'];
 const names=types.map(t=>t==='U'?'Belum diklasifikasikan':t);
 const count=r=>reportCategory(r[fieldType]);
 if(selection.includes('Executive Summary'))add('Executive Summary',['Indikator','Jumlah'],[['Total Records',rows.length],['Completed / Done',model.done],['In Progress',model.inProgress],['Waiting / Pending',model.waiting],['Overdue (subset)',model.overdue]],'Seluruh angka mengikuti periode, filter, PIC dan akses pengguna.');
 add('Kategori New / Maintenance',['Kategori','Jumlah'],[...types.map(t=>[t==='N'?'New':t==='M'?'Maintenance':'Belum diklasifikasikan',rows.filter(r=>count(r)===t).length]),['Grand Total',rows.length]],'Jenis kosong atau tidak dikenali tetap dihitung terpisah; tidak otomatis dianggap New.');
 if(selection.includes('Proses Implementasi & SLA')||selection.includes('SLA Performance')||selection.includes('Volume & Status')){const measured=model.within+model.overdue;add('Proses Implementasi & SLA',['Indikator','Nilai'],[['Within SLA',model.within],['Overdue',model.overdue],['SLA Achievement',measured?(100*model.within/measured).toFixed(1)+'%':'Belum dapat dinilai'],['Data terukur SLA',measured],['Belum dapat dihitung SLA',rows.length-measured]],'Kelengkapan tanggal untuk ringkasan tidak mengubah syarat dan rumus SLA yang sudah berlaku.');}
 if(selection.includes('Status Breakdown')||selection.includes('Volume & Status'))add('Status Pekerjaan',['Status','Jumlah'],model.statuses);
 const product=r=>!String(r.product??'').trim()?'Belum tersedia':kind==='corporate'?r.slaSolution||context.productName(String(r.product)):context.productName(String(r.product));
 for(const [name,key,enabled] of [['Produk',product,kind!=='ijr'&&selection.includes('Product & Sub Product')],[kind==='corporate'?'Segmen':'Wilayah',r=>reportDimension(r[dimension]),selection.includes(kind==='corporate'?'Overview per Segmen':'Wilayah')]]){
  if(!enabled)continue;
  const groups=[...new Set(rows.map(key))].sort();
  const data=groups.map(label=>{const scoped=rows.filter(r=>key(r)===label);return [label,...types.map(t=>scoped.filter(r=>count(r)===t).length),scoped.length];});
  data.push(['Grand Total',...types.map(t=>rows.filter(r=>count(r)===t).length),rows.length]);
  add('Overview Implementasi per '+name,[name,...names,'Total'],data,'Semua baris masuk ringkasan, termasuk tanggal kosong serta kategori yang belum tersedia.');
  const monthly=regionMonthlyOverview(rows,{region:key,type:count,month:r=>reportMonth(kind==='corporate'?r.createDate:r.salesDate)},types.length===3?1:2);
  monthly.pages.forEach((page,i)=>add('Implementasi per '+name+' per Bulan '+(i+1)+'/'+monthly.pages.length,page.headers,page.rows,'Tanpa tanggal mencakup tanggal kosong atau tidak valid. Total halaman hanya mencakup bulan yang terlihat.',{months:page.months,types:monthly.types}));
 }
 if(selection.includes('Key Takeaways'))add('Key Takeaways',['Indikator','Ringkasan'],[['Volume',rows.length+' records pada filter aktif'],...types.map(t=>[t==='N'?'New':t==='M'?'Maintenance':'Belum diklasifikasikan',rows.filter(r=>count(r)===t).length+' records']),['Tanpa tanggal',rows.filter(r=>reportMonth(kind==='corporate'?r.createDate:r.salesDate)==='Tanpa tanggal').length+' records']]);
 if(selection.includes('Beban Implementor'))for(let offset=0;offset<model.people.length;offset+=10)add('KPI Per Person '+(offset/10+1)+'/'+Math.ceil(model.people.length/10),['No.','PIC / Implementor','Assigned','Completed','Active','Waiting','Overdue'],model.people.slice(offset,offset+10).map((p,i)=>[offset+i+1,p.name,p.assigned,p.done,p.active,p.waiting,p.overdue]),'Waiting dan Overdue merupakan bagian dari pekerjaan; tidak dijumlahkan sebagai permohonan baru.',{pageBreak:true});
 if(selection.includes('Detail Data')&&!model.allPeople)add('Detail Pekerjaan',['Nomor','Perusahaan / Pemohon','Jenis','Produk','Wilayah / Segmen','Status'],rows.map(r=>[r.cid??r.noreg,r.company,r[fieldType],kind==='ijr'?'BNIDirect':r.product,r[dimension],r.status]));
 const doc=createWordDocument(context.docx,context,title,sections),blob=await context.docx.Packer.toBlob(doc);
 context.saveFile(blob,title.replace(/[^a-z0-9]+/gi,'_')+'_Monitoring_Report.docx');
}
