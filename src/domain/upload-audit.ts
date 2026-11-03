import * as XLSX from 'xlsx';
import {reconcileCorporateRows} from './corporate-upload';
import {auditRows,sheetRows,type RejectedRow} from './imports';
import {readPiloting,auditPiloting} from '../piloting/imports';
import {type ApplicationKind,type Payload,text} from '../types';
export interface UploadAudit {rows:Payload[];issues:RejectedRow[];source:number;duplicates:number;file:string;}
export async function readUpload(file:File,kind:ApplicationKind,attachments:File[]=[],selection?:Record<string,string[]>):Promise<UploadAudit>{
 if(kind==='piloting'){const a=await readPiloting(file,attachments,selection);return {rows:a.validRows,issues:a.revisions,source:a.source,duplicates:a.duplicates,file:[file,...attachments].map(f=>f.name).join(' + ')};}
 const matches:UploadAudit[]=[];for(const input of [file,...attachments]){const wb=XLSX.read(await input.arrayBuffer(),{type:'array'});
 for(const name of wb.SheetNames){if(selection&&!selection[input.name]?.includes(name))continue;let raw:Payload[];try{raw=sheetRows(wb.Sheets[name],kind,attachments.length?input.name+' / '+name:name);}catch{continue;}
  const a=auditRows(raw,kind);matches.push({rows:a.rows,issues:a.revisions,source:a.source,duplicates:a.duplicates,file:input.name});
 }
 }
 if(!matches.length)throw new Error('Header sumber tidak sesuai dashboard tujuan. Periksa nama kolom dan sheet.');
 return combineUploadAudits(matches,kind);
}
export function combineUploadAudits(matches:UploadAudit[],kind:ApplicationKind):UploadAudit{
 const source=matches.reduce((n,a)=>n+a.source,0),file=[...new Set(matches.map(a=>a.file))].join(' + ');
 const rows=matches.flatMap(a=>a.rows),issues=matches.flatMap(a=>a.issues);
 if(kind==='piloting'){const result=auditPiloting(rows);return {rows:result.validRows,issues:[...issues,...result.revisions],source,duplicates:result.duplicates,file};}
 if(kind==='corporate'){const reconciled=reconcileCorporateRows(rows);return {...reconciled,issues,source,file};}
 // Conflicting duplicate identities are deliberately not resolved by row order.
 const key=(r:Payload)=>JSON.stringify((kind==='ijr'?['Application Number']:['company','cid','product','type','salesDate']).map(k=>text(r[k]).toLowerCase()));
 const content=(r:Payload)=>JSON.stringify(Object.entries(r).filter(([k])=>!k.startsWith('_source')).sort(([a],[b])=>a.localeCompare(b)));
 const groups=new Map<string,{content:Set<string>;rows:Payload[]}>();for(const r of rows){const k=key(r),g=groups.get(k)||{content:new Set<string>(),rows:[]};g.content.add(content(r));g.rows.push(r);groups.set(k,g);}
 let duplicates=0;const accepted:Payload[]=[];
 for(const g of groups.values()){if(g.content.size>1){for(const r of g.rows)issues.push({row:r,sourceRow:Number(r._sourceRow),sheet:text(r._sourceSheet),reason:'Konflik identitas: isi berbeda memakai nomor pekerjaan yang sama.'});}else {accepted.push(...g.rows);duplicates+=g.rows.length-1;}}
 return {rows:accepted,issues,source,duplicates,file};
}

export async function uploadSheets(files:File[]){return Promise.all(files.map(async file=>{const wb=XLSX.read(await file.arrayBuffer(),{type:'array',bookSheets:true});return {file:file.name,sheets:wb.SheetNames};}));}
