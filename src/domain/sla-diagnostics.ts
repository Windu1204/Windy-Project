import { type ApplicationKind, type MonitoringRecord, text } from '../types';
import { field, value } from '../piloting/model';

export function slaIssue(row: MonitoringRecord, kind: ApplicationKind): { reason: string; detail: string } | null {
 const p=row.payload,s=row.sla;
 if(kind==='piloting'&&value(row,field.status)!=='Done')return {reason:'Pekerjaan belum Done',detail:'Pencapaian SLA Piloting dihitung dari pekerjaan selesai.'};
 if(['Within SLA','Overdue'].includes(s.status))return null;
 const ref=kind==='ijr'?text(p['Request Date']):kind==='regional'?text(p.docComplete)||text(p.approvalDate)||text(p.salesDate):kind==='piloting'?value(row,field.assigned):text(p.assignDate)||text(p.submitDate)||text(p.createDate)||text(p.slaPolicyDate);
 if(s.solution&&s.status==='Without SLA'&&ref&&ref.slice(0,10)<'2025-07-14')return {reason:'Sebelum periode kebijakan SLA',detail:'Tanggal acuan '+ref+'. Kebijakan berlaku mulai 14 Juli 2025.'};
 if(s.target===null){const product=text(p.product)||value(row,field.product);return product?{reason:'Produk belum memiliki pemetaan SLA',detail:'Produk '+product+' perlu dicocokkan dengan aturan dan jenis layanan yang berlaku.'}:{reason:'Produk belum tercantum',detail:'Nama produk pada sumber diperlukan untuk menentukan aturan SLA.'};}
 if(kind==='regional'){
  if(!text(p.docComplete))return {reason:'Tanggal Dokumen Lengkap belum tersedia',detail:'Tanggal Dokumen Lengkap diperlukan sebagai awal perhitungan SLA.'};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text(p.docComplete)))return {reason:'Tanggal Dokumen Lengkap belum valid',detail:'Tanggal Dokumen Lengkap diperlukan sebagai awal perhitungan SLA.'};
  const end=[p.handover,p.training,p.customerInfo,p.settingDone].map(text).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort().pop();
  if(!end)return {reason:'Tanggal penyelesaian belum tersedia',detail:'Selesai Setting, Info Nasabah, Training, atau Handover belum memiliki tanggal yang dapat digunakan.'};
  if(end<text(p.docComplete))return {reason:'Urutan tanggal perlu diperiksa',detail:'Tanggal penyelesaian mendahului Dokumen Lengkap.'};
 }
 return {reason:'Durasi SLA belum tersedia',detail:kind==='piloting'?'Hari Penyelesaian SLA pada sumber belum memiliki nilai numerik yang valid.':'Durasi SLA Real pada sumber belum memiliki nilai numerik yang valid.'};
}
