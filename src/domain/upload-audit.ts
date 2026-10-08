import * as XLSX from 'xlsx';
import {auditRows,sheetRows,type RejectedRow} from './imports';
import {readPiloting} from '../piloting/imports';
import {type ApplicationKind,type Payload,text} from '../types';
export interface UploadAudit {rows:Payload[];issues:RejectedRow[];source:number;duplicates:number;file:string;}
export async function readUpload(file:File,kind:ApplicationKind):Promise<UploadAudit>{
 if(kind==='piloting'){const a=await readPiloting(file);return {rows:a.validRows,issues:a.revisions,source:a.source,duplicates:a.duplicates,file:file.name};}
 const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),matches:UploadAudit[]=[];
 for(const name of wb.SheetNames){let raw:Payload[];try{raw=sheetRows(wb.Sheets[name],kind,name);}catch{continue;}
  const a=auditRows(raw,kind);matches.push({rows:a.rows,issues:a.revisions,source:a.source,duplicates:a.duplicates,file:file.name});
 }
 if(!matches.length)throw new Error('Header sumber tidak sesuai dashboard tujuan. Periksa nama kolom dan sheet.');
 const rows=matches.flatMap(a=>a.rows),issues=matches.flatMap(a=>a.issues);
 // Conflicting duplicate identities are deliberately not resolved by row order.
 const key=(r:Payload)=>JSON.stringify((kind==='ijr'?['Application Number']:kind==='corporate'?['noreg']:['company','cid','product','type','salesDate']).map(k=>text(r[k]).toLowerCase()));
 const content=(r:Payload)=>JSON.stringify(Object.entries(r).filter(([k])=>!k.startsWith('_source')).sort(([a],[b])=>a.localeCompare(b)));
 const groups=new Map<string,{content:Set<string>;rows:Payload[]}>();for(const r of rows){const k=key(r),g=groups.get(k)||{content:new Set<string>(),rows:[]};g.content.add(content(r));g.rows.push(r);groups.set(k,g);}
 let duplicates=0;const accepted:Payload[]=[];
 for(const g of groups.values()){if(g.content.size>1){for(const r of g.rows)issues.push({row:r,sourceRow:Number(r._sourceRow),sheet:text(r._sourceSheet),reason:'Konflik identitas: isi berbeda memakai nomor pekerjaan yang sama.'});}else {accepted.push(...g.rows);duplicates+=g.rows.length-1;}}
 return {rows:accepted,issues,source:matches.reduce((s,a)=>s+a.source,0),duplicates,file:file.name};
}
