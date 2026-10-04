import { type ApplicationKind, type Payload, text } from '../types';
// Status and PIC are mutable, so neither is part of a job's identity.
export function identity(kind: ApplicationKind, row: Payload): string {
  const keys = kind === 'ijr' ? ['Application Number'] : kind === 'corporate' ? ['noreg'] : kind === 'piloting' ? ['No. Register'] : ['company','cid','product','type','salesDate'];
  if (!text(row[keys[0]]) || (kind === 'regional' && (!text(row.product) || !text(row.salesDate)))) throw new Error('Identitas pekerjaan tidak lengkap. Periksa nomor register / perusahaan, produk dan tanggal permohonan.');
  return JSON.stringify(keys.map(k=>text(row[k]).toLocaleLowerCase()));
}
const canonical=(row:Payload)=>JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k])=>!k.startsWith('dashboard')).sort(([a],[b])=>a.localeCompare(b))));
export function mergeUpload(kind:ApplicationKind, previous:Payload[], incoming:Payload[]) {
  const existing=new Map<string,Payload>(), upload=new Map<string,Payload>(); let duplicates=0,newRows=0,updated=0,unchanged=0;
  for(const r of previous){const key=identity(kind,r);if(existing.has(key)&&canonical(existing.get(key)!)!==canonical(r))throw new Error('Identitas pekerjaan pada data sebelumnya ambigu: '+key);existing.set(key,r);}
  for(const r of incoming){const key=identity(kind,r);if(upload.has(key)){if(canonical(upload.get(key)!)!==canonical(r))throw new Error('Dua isi berbeda memakai identitas yang sama: '+key);duplicates++;}else upload.set(key,r);}
  for(const [key,row] of upload){const old=existing.get(key); const next=old?.dashboardUpdatedAt?{...row,status:'Done',dashboardUpdatedAt:old.dashboardUpdatedAt,dashboardNote:old.dashboardNote}:row;
    if(!old)newRows++;else if(canonical(old)===canonical(next))unchanged++;else updated++;existing.set(key,next);
  }
  return {rows:[...existing.values()],duplicates,newRows,updated,unchanged};
}
