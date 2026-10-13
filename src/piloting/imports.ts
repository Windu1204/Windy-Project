import * as XLSX from 'xlsx';
import { type Payload, text } from '../types';
import { dateVal, validDate } from '../domain/imports';
import { sourceFields, field } from './model';
const canonicalHeader=(s:string)=>s.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases:Record<string,string[]>={
 [field.id]:['No Register','Nomor Register','No Reg','noreg','Trace No','No. Trace'],[field.group]:['Segmen','Segment','Group'],
 [field.company]:['Company','Nama Perusahaan'],[field.person]:['PIC','PIC AT','AT Person'],
 [field.product]:['Produk','Product','Jenis Produk','Jenis Produk Solusi'],[field.assigned]:['Tanggal Assign ke AT','Assigned to AT','Tanggal Assign to AT'],
 [field.completed]:['End Date','Tanggal Selesai','Waktu Penyelesaian AT'],[field.status]:['Status Pekerjaan','Work Status'],
 'Alasan Discrepancy':['Deskripsi / Alasan Discrepancy','Keterangan Discrepancy'], 'Komitmen Discrepancy':['Komitmen'], 'Pemenuhan Discrepancy':['Pemenuhan','Status Pemenuhan'],
 [field.days]:['Hari Penyelesaian','Durasi SLA'],[field.discrepancy]:['Discrepancy Status'],[field.form]:['Form Type'],
 'PIC PS':['PIC PS','PS','PIC Product Specialist','Nama PS'], 'PM':['PM','PIC PM','Project Manager','Implementor (PM)','Nama PM'], 'PIC Sales':['PIC Sales','Sales','PIC SALES','Nama Sales']
};
export function pilotHeader(source:string){const key=canonicalHeader(source);return [...sourceFields,'PIC PS','PM','PIC Sales'].find(h=>canonicalHeader(h)===key||aliases[h]?.some(a=>canonicalHeader(a)===key))||source.trim();}
export function pilotStatus(s:string){return /^(masih pending|pending|on progress|in progress)$/i.test(s.trim())?'Masih Pending':/^done$|^selesai$/i.test(s.trim())?'Done':/^reject(?:\s*[/–-]\s*(retur|return))?$|^retur$|^return$/i.test(s.trim())?'Reject/Retur':s.trim();}
export function normalizePilot(raw:Payload):Payload{const out:Payload={...raw};for(const [key,value] of Object.entries(raw)){const mapped=pilotHeader(key);if(mapped in out&&mapped!==key&&text(out[mapped])&&text(value)&&text(out[mapped])!==text(value))throw new Error('Kolom ambigu: '+mapped);out[mapped]=value;}return out;}
export function auditPiloting(raw: Payload[]) {
  const seen = new Map<string,string>(), errors: string[] = [],revisions:{row:Payload;reason:string;sourceRow?:number;sheet?:string}[]=[];let duplicates=0;
  const rows = raw.map((r, i) => {
    const before=errors.length;const row = normalizePilot(r);
    row[field.status]=pilotStatus(text(row[field.status]));
    for (const key of [field.assigned, field.completed]) row[key] = dateVal(row[key]);
    for (const key of [field.id, field.company, field.person, field.status, field.product, field.assigned]) if (!text(row[key])) errors.push(`Row ${i+1}: ${key}`);
    for (const key of [field.assigned, field.completed]) if (!validDate(row[key])) errors.push(`Row ${i+1}: invalid ${key}`);
    const id = JSON.stringify([text(row[field.id]).toLowerCase(),text(row[field.assigned])]),canonical=JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k])=>!k.startsWith('_source')).sort(([a],[b])=>a.localeCompare(b)))); if (seen.has(id)){duplicates++;if(seen.get(id)!==canonical)errors.push(`Row ${i+1}: conflicting duplicate ${id}`);}seen.set(id,canonical);
    if (!['Done','Reject/Retur','Masih Pending'].includes(pilotStatus(text(row[field.status])))) errors.push(`Row ${i+1}: invalid ${field.status}`);
    if (text(row[field.discrepancy])&&!['Discrepancy','Tidak Discrepancy'].includes(text(row[field.discrepancy]))) errors.push(`Row ${i+1}: invalid ${field.discrepancy}`);
    const n = row[field.days]; if (text(n) && (!Number.isFinite(Number(n)) || Number(n)<0)) errors.push(`Row ${i+1}: invalid ${field.days}`);
    if(row._sourceBlank)errors.push(`Row ${i+1}: Baris kosong`);
    if(errors.length>before)revisions.push({row,reason:errors.slice(before).join('; '),sourceRow:Number(row._sourceRow)||i+1,sheet:text(row._sourceSheet)});
    return row;
  });
  const rejected=new Set(revisions.map(r=>r.row));
  const conflicting=new Set<string>();const first=new Map<string,string>();
  for(const row of rows){const id=JSON.stringify([text(row[field.id]).toLowerCase(),text(row[field.assigned])]),body=JSON.stringify(Object.entries(row).filter(([k])=>!k.startsWith('_source')).sort(([a],[b])=>a.localeCompare(b)));if(first.has(id)&&first.get(id)!==body)conflicting.add(id);else first.set(id,body);}
  for(const row of rows)if(conflicting.has(JSON.stringify([text(row[field.id]).toLowerCase(),text(row[field.assigned])]))&&!rejected.has(row)){const reason='Konflik identitas: nomor register yang sama memiliki isi berbeda.';revisions.push({row,reason,sourceRow:Number(row._sourceRow)||undefined,sheet:text(row._sourceSheet)});errors.push(reason);rejected.add(row);}
  return { rows, errors, duplicates,revisions,source:raw.length,validRows:rows.filter(row=>!rejected.has(row)) };
}
export function joinDiscrepancy(rows:Payload[],cases:Payload[]):Payload[]{
 const details=new Map<string,Payload>();
 for(const raw of cases){const r=normalizePilot(raw),id=text(r[field.id]).trim().toLowerCase();if(!id)continue;
  const previous=details.get(id);if(previous&&JSON.stringify(previous)!==JSON.stringify(r))throw new Error('Data discrepancy memiliki nomor register ganda dengan isi berbeda: '+id);
  details.set(id,r);
 }
 return rows.map(row=>{const extra=details.get(text(row[field.id]).trim().toLowerCase());if(!extra)return row;
  const patch:Payload={[field.discrepancy]:'Discrepancy'};
  for(const key of ['PIC PS','PM','Alasan Discrepancy','Komitmen Discrepancy','Pemenuhan Discrepancy'])patch[key]=key==='Pemenuhan Discrepancy'?(text(extra[key])||'Belum terpenuhi'):(key==='Komitmen Discrepancy'&&typeof extra[key]==='number'?dateVal(extra[key]):extra[key]??'');
  return {...row,...patch};
 });
}
export async function readPiloting(file:File,attachments:File[]=[]){
 const combined:Payload[]=[],cases:Payload[]=[];
 for(const input of [file,...attachments]){
  const wb=XLSX.read(await input.arrayBuffer(),{type:'array'});
  for(const name of wb.SheetNames){
   const grid=XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name],{header:1,raw:true,defval:null});
   const index=grid.findIndex(row=>[field.id,field.company,field.person,field.product,field.status,field.assigned].every(h=>row.some(v=>pilotHeader(String(v??''))===h)));
   const discrepancyIndex=grid.findIndex(row=>[field.id,'Alasan Discrepancy','Pemenuhan Discrepancy'].every(h=>row.some(v=>pilotHeader(String(v??''))===h)));
   const headerIndex=index>=0?index:discrepancyIndex;if(headerIndex<0)continue;
   const headers=grid[headerIndex].map(v=>String(v??'').trim()),mapped=headers.filter(Boolean).map(pilotHeader);
   if(new Set(mapped).size!==mapped.length)throw new Error('Ada kolom ganda / ambigu pada file.');
   const base=wb.Sheets[name]['!ref']?XLSX.utils.decode_range(wb.Sheets[name]['!ref']!).s.r:0;
   const rows=grid.slice(headerIndex+1).map((row,i)=>({...Object.fromEntries(headers.filter(Boolean).map(h=>[h,row[headers.indexOf(h)]??null])),_sourceRow:base+headerIndex+i+2,_sourceSheet:attachments.length?input.name+' / '+name:name,_sourceBlank:!row.some(v=>v!==null&&v!=='')} as Payload));
   if(index>=0)combined.push(...rows);else cases.push(...rows.filter(r=>text(r[headers.find(h=>pilotHeader(h)===field.id)!])));
  }
 }
 if(!combined.length)throw new Error('Header Corporate - Piloting tidak ditemukan. Pilih rekap AT bersama file Eksepsi Discrepancy jika terpisah.');
 return auditPiloting(joinDiscrepancy(combined,cases));
}
export async function exportPiloting(rows: Payload[], format: 'xlsx'|'csv') {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(format === 'csv' ? rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v==='string' && /^[=+@\-]/.test(v) ? "'"+v : v]))) : rows,{header:[...sourceFields]}),'Corporate - Piloting');
  XLSX.writeFile(wb,`corporate_piloting.${format}`,{bookType:format});
}
