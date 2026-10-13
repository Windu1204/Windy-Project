import { calculateSla } from '../sla';
import { createRenderer as createRegionalRenderer } from './regional.js';
import { adaptIJRReportContext } from './ijr-report-profile';

export function ijrSections(context) {
  const rows=context.rows, total=rows.length;
  const count=key=>[...rows.reduce((m,r)=>{const n=String(r[key]??'').trim()||'Belum tersedia';m.set(n,(m.get(n)||0)+1);return m;},new Map())].sort((a,b)=>b[1]-a[1]);
  const sla=rows.map(r=>calculateSla(r,'ijr')), measured=sla.filter(s=>s.real!==null&&s.real!==undefined&&['Within SLA','Overdue'].includes(s.status));
  const within=measured.filter(s=>s.status==='Within SLA').length;
  const pct=n=>total?(n/total*100).toFixed(1)+'%':'0%';
  const statuses=count('Status'),types=count('Application Type');
  const sections=[];
  const add=(selection,title,headers,data,note='',chart=false)=>{if(context.selected.includes(selection))sections.push({title,headers,data,note,chart});};
  add('Executive Summary','Ringkasan Implementasi',['Indikator','Jumlah'],[['Total permohonan',total],...statuses,...types],`Periode: ${context.presentationPeriod} · PIC: ${context.person}`);
  add('Status Breakdown','Status Permohonan',['Status','Jumlah','Persentase'],statuses.map(([n,v])=>[n,v,pct(v)]),'Proses Selesai adalah penyelesaian cabang. Registered, Delivered adalah penyelesaian proses TBS.',true);
  add('Status Breakdown','Komposisi New / Maintenance',['Jenis permohonan','Jumlah','Persentase'],types.map(([n,v])=>[n,v,pct(v)]),'Seluruh jenis permohonan pada filter aktif ditampilkan.',true);
  add('Process & Duration','Tahapan Proses',['Tahapan','Jumlah'],count('Flow Process'),'Seluruh tahapan proses pada data aktif.',true);
  const average=key=>{const values=rows.map(r=>r[key]).filter(v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))).map(Number);return values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(2):'Belum tersedia';};
  add('Process & Duration','Durasi Proses',['Indikator','Rata-rata hari'],[['Total Day',average('_TotalDayNum')],['Total Day Cabang',average('_CabangDayNum')],['Total Day TBS',average('_TBSDayNum')]],'Durasi mengikuti field sumber. SLA IJR menggunakan Total Day TBS; bukan Total Day Cabang.');
  add('SLA Performance','Kinerja SLA TBS',['Indikator','Nilai'],[['Dapat dihitung SLA',measured.length],['Sesuai SLA',within],['Lewat SLA',measured.length-within],['Belum dapat dihitung SLA',total-measured.length],['Pencapaian SLA',measured.length?(within/measured.length*100).toFixed(1)+'%':'Belum tersedia'],['Rata-rata durasi TBS',measured.length?(measured.reduce((a,s)=>a+s.real,0)/measured.length).toFixed(2):'Belum tersedia']], 'SLA menggunakan Total Day TBS. Target New: 3 hari; Maintenance: 2 hari. Nilai 0 tetap termasuk data terukur.');
  const regions=count('Wilayah');
  add('Wilayah & Cabang','Overview Implementasi per Wilayah',['Wilayah','New','Maintenance','Lainnya','Total'],[...regions.map(([name,n])=>{const selected=rows.filter(r=>(String(r.Wilayah??'').trim()||'Belum tersedia')===name),newCount=selected.filter(r=>/new/i.test(String(r['Application Type']))).length,maintenance=selected.filter(r=>/maint/i.test(String(r['Application Type']))).length;return [name,newCount,maintenance,n-newCount-maintenance,n];}),['Grand Total',rows.filter(r=>/new/i.test(String(r['Application Type']))).length,rows.filter(r=>/maint/i.test(String(r['Application Type']))).length,rows.filter(r=>!/new|maint/i.test(String(r['Application Type']))).length,total]],'Angka mencakup semua status pada filter aktif.');
  for(const key of ['Wilayah','Cabang','Unit Pembuka'])add('Wilayah & Cabang',key==='Wilayah'?`Distribusi ${key}`:`Top 10 ${key}`,[key,'Jumlah'],key==='Wilayah'?count(key):count(key).slice(0,10),key==='Wilayah'?'Seluruh wilayah ditampilkan; grafik lanjutan memakai skala yang sama.':'Sepuluh kategori terbesar; jumlah grafik merupakan bagian dari total permohonan.',true);
  add('Process & Duration','Tren Permohonan Harian',['Tanggal permohonan','Jumlah'],count('Request Date').sort((a,b)=>a[0].localeCompare(b[0])),'Berdasarkan Request Date pada filter aktif.',true);
  for(const key of ['CS BNI Direct','Implementor 1','Implementor 2'])add('PIC & Workload',`Beban Pekerjaan · ${key}`,['PIC','Permohonan'],key==='CS BNI Direct'?count(key).slice(0,10):count(key),(key==='CS BNI Direct'?'Sepuluh CS dengan beban terbesar. ':'Seluruh implementor pada filter aktif. ')+'Satu permohonan dapat melibatkan beberapa PIC; jumlah antarperan bukan permohonan unik.');
  add('Key Takeaways','Key Takeaways',['Indikator','Ringkasan'],[['Volume',`${total} permohonan pada filter aktif`],...types.map(([n,v])=>[n,`${v} permohonan (${pct(v)})`]),...statuses.map(([n,v])=>[n,`${v} permohonan (${pct(v)})`]),['SLA TBS',`${within} sesuai SLA dari ${measured.length} data terukur`]],'Angka mengikuti periode, filter, PIC, dan akses pengguna pada saat report dibuat.');
  if(context.person!=='All Name')add('Detail Data','Rincian Permohonan',['Nomor permohonan','Pemohon','Status','Tahapan','TBS'],rows.map(r=>[r['Application Number'],r['Applicant Name'],r.Status,r['Flow Process'],r._TBSDayNum??r['Total Day TBS']]));
  for(const section of sections)if(section.title==='Overview Implementasi per Wilayah'&&section.data.every(r=>r[3]===0)){section.headers.splice(3,1);section.data.forEach(r=>r.splice(3,1));}
  return sections;
}

// IJR uses the exact Regional report layout with its own source fields and SLA.
export async function exportIJR(context,format) {
  const renderer=createRegionalRenderer(adaptIJRReportContext(context));
  await renderer[format](renderer.model());
}
