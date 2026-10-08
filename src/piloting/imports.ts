import * as XLSX from 'xlsx';
import { type Payload, text } from '../types';
import { dateVal, validDate } from '../domain/imports';
import { sourceFields, field } from './model';
const canonicalHeader=(s:string)=>s.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases:Record<string,string[]>={
 [field.id]:['No Register','Nomor Register','No Reg','noreg'],[field.group]:['Segmen','Segment','Group'],
 [field.company]:['Company','Nama Perusahaan'],[field.person]:['PIC','PIC AT','AT Person'],
 [field.product]:['Produk','Product','Jenis Produk','Jenis Produk Solusi'],[field.assigned]:['Tanggal Assign ke AT','Assigned to AT','Tanggal Assign to AT'],
 [field.completed]:['End Date','Tanggal Selesai','Waktu Penyelesaian AT'],[field.status]:['Status Pekerjaan','Work Status'],
 [field.days]:['Hari Penyelesaian','Durasi SLA'],[field.discrepancy]:['Discrepancy Status'],[field.form]:['Form Type'],
 'PIC PS':['PIC PS','PS','PIC Product Specialist'], 'PM':['PM','PIC PM','Project Manager'], 'PIC Sales':['PIC Sales','Sales','PIC SALES','Nama Sales']
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
    const id = text(row[field.id]).toLowerCase(),canonical=JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k])=>!k.startsWith('_source')).sort(([a],[b])=>a.localeCompare(b)))); if (seen.has(id)){duplicates++;if(seen.get(id)!==canonical)errors.push(`Row ${i+1}: conflicting duplicate ${id}`);}seen.set(id,canonical);
    if (!['Done','Reject/Retur','Masih Pending'].includes(pilotStatus(text(row[field.status])))) errors.push(`Row ${i+1}: invalid ${field.status}`);
    if (text(row[field.discrepancy])&&!['Discrepancy','Tidak Discrepancy'].includes(text(row[field.discrepancy]))) errors.push(`Row ${i+1}: invalid ${field.discrepancy}`);
    const n = row[field.days]; if (text(n) && (!Number.isFinite(Number(n)) || Number(n)<0)) errors.push(`Row ${i+1}: invalid ${field.days}`);
    if(row._sourceBlank)errors.push(`Row ${i+1}: Baris kosong`);
    if(errors.length>before)revisions.push({row,reason:errors.slice(before).join('; '),sourceRow:Number(row._sourceRow)||i+1,sheet:text(row._sourceSheet)});
    return row;
  });
  const rejected=new Set(revisions.map(r=>r.row));
  const conflicting=new Set<string>();const first=new Map<string,string>();
  for(const row of rows){const id=text(row[field.id]).toLowerCase(),body=JSON.stringify(Object.entries(row).filter(([k])=>!k.startsWith('_source')).sort(([a],[b])=>a.localeCompare(b)));if(first.has(id)&&first.get(id)!==body)conflicting.add(id);else first.set(id,body);}
  for(const row of rows)if(conflicting.has(text(row[field.id]).toLowerCase())&&!rejected.has(row)){const reason='Konflik identitas: nomor register yang sama memiliki isi berbeda.';revisions.push({row,reason,sourceRow:Number(row._sourceRow)||undefined,sheet:text(row._sourceSheet)});errors.push(reason);rejected.add(row);}
  return { rows, errors, duplicates,revisions,source:raw.length,validRows:rows.filter(row=>!rejected.has(row)) };
}
export async function readPiloting(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(),{type:'array'});
  const combined:Payload[]=[];
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name],{header:1,raw:true,defval:null});
    const index = grid.findIndex(row => [field.id,field.company,field.person,field.product,field.status,field.assigned].every(h=>row.some(v=>pilotHeader(String(v??''))===h)));
    if(index<0) continue;
    const headers = grid[index].map(v=>String(v??'').trim());
    const mapped=headers.filter(Boolean).map(pilotHeader);if(new Set(mapped).size!==mapped.length)throw new Error('Ada kolom ganda / ambigu pada file.');
    const base=wb.Sheets[name]['!ref']?XLSX.utils.decode_range(wb.Sheets[name]['!ref']!).s.r:0;
    const rows = grid.slice(index+1).map((row,i)=>({...Object.fromEntries(headers.filter(Boolean).map((h)=>[h,row[headers.indexOf(h)]??null])),_sourceRow:base+index+i+2,_sourceSheet:name,_sourceBlank:!row.some(v=>v!==null&&v!=='')} as Payload));
    combined.push(...rows);
  }
  if(combined.length) return auditPiloting(combined);
  throw new Error('Header Corporate - Piloting tidak ditemukan / Corporate - Piloting headers not found.');
}
export async function exportPiloting(rows: Payload[], format: 'xlsx'|'csv') {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(format === 'csv' ? rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v==='string' && /^[=+@\-]/.test(v) ? "'"+v : v]))) : rows,{header:[...sourceFields]}),'Corporate - Piloting');
  XLSX.writeFile(wb,`corporate_piloting.${format}`,{bookType:format});
}
