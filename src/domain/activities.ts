import {type Payload,text} from '../types';
import {requestCategory} from './request-category';
export type ActivityDataset='ijr'|'regional';
export type ActivityKind='calendar'|'training'|'call'|'handover';
export interface Participant{name:string;attended:boolean}
export interface ActivityFile{path:string;name:string}
export interface ActivityBody{implementor:string;date:string;time?:string;place?:string;remarks?:string;product?:string;bni?:Participant[];customers?:Participant[];feedback?:string;discussion?:string;title?:string;company?:string;start?:string;end?:string;mode?:string;potential?:string;followup?:string;measure?:'volume'|'item';quantity?:string;informed?:boolean;reference?:string;recordId?:string;calendarId?:string}
export interface Activity{id:string;workspace_id:string;dataset:ActivityDataset;kind:ActivityKind;owner_id:string;pic:string;job_key:string|null;data_mode:string|null;payload:ActivityBody;attachments:ActivityFile[];created_at:string;updated_at:string;approval_status?:'pending'|'approved'|'legacy';approved_at?:string|null;approved_by?:string|null;approver_name?:string|null}
export function pastedParticipants(source:string,previous:Participant[]=[]):Participant[]{
 const history=new Map<string,boolean[]>();for(const p of previous){const key=p.name.trim().toLocaleLowerCase();history.set(key,[...(history.get(key)||[]),p.attended]);}
 return source.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(name=>({name,attended:history.get(name.toLocaleLowerCase())?.shift()??true}));
}
export function duplicateParticipants(rows:Participant[]){const counts=new Map<string,number>();for(const p of rows){const key=p.name.toLocaleLowerCase();counts.set(key,(counts.get(key)||0)+1);}return [...counts].filter(([,n])=>n>1).map(([name])=>name);}
export const presentCount=(rows:Participant[]=[])=>rows.filter(p=>p.attended).length;
// Legacy schedules retain their original start time; never invent an end time.
export function calendarBody(body:ActivityBody):ActivityBody{return {...body,start:body.start||body.time||'',end:body.end||''};}
export function calendarTimeLabel(body:ActivityBody){return (body.start||body.time||'—')+' – '+(body.end||'—');}
export function activityJobKey(kind:ActivityDataset,p:Payload){if(kind==='ijr')return 'ijr:'+text(p['Application Number']).trim().toLowerCase();return 'regional:['+['company','cid','product','type','salesDate'].map(k=>JSON.stringify(text(p[k]).trim().toLowerCase())).join(', ')+']';}
export function handoverEligible(kind:ActivityDataset,p:Payload){return requestCategory(p[kind==='ijr'?'Application Type':'type'])==='N'&&(kind==='regional'?/^done$/i.test(text(p.status))&&!!text(p.companyId):/^(proses selesai|registered,\s*delivered|delivered|done)$/i.test(text(p.Status)))&&!text(p.handoverActivityId)&&!text(p.handoverDate)&&!text(p.dashboardHandoverAt)&&!/^handover$/i.test(text(p.handover));}
export function validateActivity(kind:ActivityKind,b:ActivityBody,files:ActivityFile[]){
 if(!b.implementor.trim())return 'Implementor wajib diisi.';
 if(kind==='handover'){const n=Number(b.quantity);if(!b.quantity||!Number.isFinite(n)||n<=0||n>1e18||b.measure==='item'&&!Number.isInteger(n))return 'Isi volume atau jumlah item positif; item harus bilangan bulat.';if(!b.informed)return 'Konfirmasi bahwa nasabah sudah diinformasikan.';if(!files.length)return 'Bukti email ke nasabah wajib diunggah.';return '';}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date))return 'Tanggal wajib diisi.';
 if(kind==='calendar'){
  const start=b.start||b.time||'',end=b.end||'',valid=/^([01]\d|2[0-3]):[0-5]\d$/;
  if(!valid.test(start)||!valid.test(end)||!b.place?.trim())return 'Jam mulai, jam selesai, dan tempat wajib diisi.';
  return end<=start?'Jam selesai harus setelah jam mulai.':'';
 }
 if(!b.product?.trim())return 'Produk wajib diisi.';
 const participants=[...(b.bni||[]),...(b.customers||[])];if(participants.some(p=>p.name.length>160)||Math.max(b.bni?.length||0,b.customers?.length||0)>2000)return 'Periksa nama peserta (maksimal 160 karakter per nama dan 2.000 peserta per daftar).';
 if(kind==='training')return !files.length?'Bukti training wajib diunggah.':'';
 if([b.title,b.company,b.start,b.end,b.mode,b.place,b.discussion,b.feedback,b.potential,b.followup].some(v=>!v?.trim()))return 'Lengkapi identitas kegiatan dan seluruh bagian Call Report.';
 if(b.end!<b.start!)return 'Waktu selesai tidak boleh sebelum waktu mulai.';
 if(!files.length)return 'Lampiran Call Report wajib diunggah.';return '';
}
export function handoverApprovalLabel(a:Activity){return a.approval_status==='pending'?'Menunggu persetujuan TL':a.approval_status==='approved'?'Disetujui TL':'Handover tercatat sebelumnya';}
export function overlayHandovers<T extends {payload:Payload}>(rows:T[],kind:ActivityDataset,activities:Activity[],mode:string){
 const handovers=new Map(activities.filter(a=>a.kind==='handover'&&a.data_mode===mode).map(a=>[a.job_key,a]));
 return rows.map(row=>{const a=handovers.get(activityJobKey(kind,row.payload));return a?{...row,payload:{...row.payload,handover:a.approval_status==='pending'?row.payload.handover:'Handover',dashboardHandoverAt:a.approval_status==='pending'?row.payload.dashboardHandoverAt:(a.approved_at||a.created_at),handoverApproval:handoverApprovalLabel(a),handoverMeasure:a.payload.measure,handoverQuantity:a.payload.quantity,handoverInformed:a.payload.informed,handoverActivityId:a.id}}:row;});
}
