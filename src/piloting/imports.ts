import * as XLSX from 'xlsx';
import { type Payload, text } from '../types';
import { dateVal, validDate } from '../domain/imports';
import { sourceFields, field } from './model';
export function auditPiloting(raw: Payload[]) {
  const seen = new Set<string>(), errors: string[] = [];
  const rows = raw.map((r, i) => {
    const row = {...r};
    for (const key of [field.assigned, field.completed]) row[key] = dateVal(row[key]);
    for (const key of [field.id, field.company, field.person, field.status, field.product, field.assigned]) if (!text(row[key])) errors.push(`Row ${i+1}: ${key}`);
    for (const key of [field.assigned, field.completed]) if (!validDate(row[key])) errors.push(`Row ${i+1}: invalid ${key}`);
    const id = text(row[field.id]); if (seen.has(id)) errors.push(`Row ${i+1}: duplicate ${id}`); seen.add(id);
    if (!['Done','Reject/Retur','Masih Pending'].includes(text(row[field.status]))) errors.push(`Row ${i+1}: invalid ${field.status}`);
    if (!['Discrepancy','Tidak Discrepancy'].includes(text(row[field.discrepancy]))) errors.push(`Row ${i+1}: invalid ${field.discrepancy}`);
    const n = row[field.days]; if (text(n) && (!Number.isFinite(Number(n)) || Number(n)<0)) errors.push(`Row ${i+1}: invalid ${field.days}`);
    return row;
  });
  return { rows, errors };
}
export async function readPiloting(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(),{type:'array'});
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name],{header:1,raw:true,defval:null});
    const index = grid.findIndex(row => sourceFields.every(h => row.includes(h)));
    if(index<0) continue;
    const headers = grid[index].map(v=>String(v??'').trim());
    const rows = grid.slice(index+1).filter(row=>row.some(v=>v!==null && v!=='')).map(row=>Object.fromEntries(headers.filter(Boolean).map((h)=>[h,row[headers.indexOf(h)]??null])) as Payload);
    return auditPiloting(rows);
  }
  throw new Error('Header Corporate - Piloting tidak ditemukan / Corporate - Piloting headers not found.');
}
export async function exportPiloting(rows: Payload[], format: 'xlsx'|'csv') {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(format === 'csv' ? rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v==='string' && /^[=+@\-]/.test(v) ? "'"+v : v]))) : rows,{header:[...sourceFields]}),'Corporate - Piloting');
  XLSX.writeFile(wb,`corporate_piloting.${format}`,{bookType:format});
}
