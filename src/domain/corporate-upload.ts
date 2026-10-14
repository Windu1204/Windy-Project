import {type Payload,text} from '../types';
import * as XLSX from 'xlsx';

const key=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
export function corporatePick(row:Payload,names:string[]){
 for(const name of names){const field=Object.keys(row).find(k=>key(k)===key(name));if(field&&text(row[field]))return row[field];}
 return null;
}
// Internal reference only: a missing register is never replaced by a fabricated visible number.
function fingerprint(value:string){let a=2166136261,b=2246822519,c=3266489917,d=668265263;for(let i=0;i<value.length;i++){const n=value.charCodeAt(i);a=Math.imul(a^n,16777619);b=Math.imul(b^n,3266489917);c=Math.imul(c^n,668265263);d=Math.imul(d^n,374761393);}return [a,b,c,d].map(n=>(n>>>0).toString(16).padStart(8,'0')).join('');}
export function corporateIdentity(row:Payload){
 if(text(row.noreg))return text(row._corporateIdentity)||text(row.noreg).toLowerCase();
 const anchor=['company','cid','sales','formType','requestType','submitDate'].map(k=>text(row[k]).toLowerCase());
 const raw:Payload=JSON.parse(text(row._corporateSource)||'{}');
 anchor.push(timestamp(corporatePick(raw,['Tanggal Submit','tgl_submit','submitDate'])));
 if(!anchor.some(Boolean))anchor.push(text(row._corporateSource));
 return text(row._corporateIdentity)||'unregistered:'+fingerprint(JSON.stringify(anchor));
}
const comparable=(row:Payload)=>({...Object.fromEntries(Object.entries(row).filter(([k])=>!k.startsWith('_source')&&!k.startsWith('_corporate')).sort(([a],[b])=>a.localeCompare(b))),raw:row._corporateSource||null});
function timestamp(value:unknown):string {
 let raw=text(value as string);
 if(typeof value==='number'){
  const date=XLSX.SSF.parse_date_code(value);
  if(!date)return '';
  raw=`${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}T${String(date.H).padStart(2,'0')}:${String(date.M).padStart(2,'0')}:${String(date.S).padStart(2,'0')}`;
 }
 const local=raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(.*)$/);
 if(local)raw=`${local[3]}-${local[2].padStart(2,'0')}-${local[1].padStart(2,'0')}${local[4]}`;
 if(!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(raw)||raw.startsWith('0000'))return '';
 const day=raw.slice(0,10),date=new Date(day+'T00:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)return '';
 const iso=raw.length===10?raw+'T00:00:00Z':raw.replace(' ','T')+(/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)?'':'Z');
 const instant=new Date(iso);return Number.isFinite(instant.getTime())?instant.toISOString():'';
}
function latest(row:Payload){
 const source:Payload=JSON.parse(text(row._corporateSource)||'{}');
 const explicit=corporatePick(source,['Updated At','Last Updated','Tanggal Update','Tanggal Perubahan','Modified At','Last Modified']);
 if(timestamp(explicit))return timestamp(explicit);
 const candidates=['Tanggal Return','tgl_return','returnDate','Tanggal Done','tgl_done','doneDate','Tanggal Progress','tgl_progress','progressDate','Tanggal Assign','tgl_assign','assignDate','Tanggal Submit','tgl_submit','submitDate'].map(k=>corporatePick(source,[k]));
 candidates.push(row.returnDate,row.doneDate,row.progressDate,row.assignDate,row.submitDate);
 return candidates.map(timestamp).filter(Boolean).sort().at(-1)||'';
}
/** Keep every source row for reconciliation; repeated versions carry one identical current job. */
export function reconcileCorporateRows(rows:Payload[]){
 const groups=new Map<string,Payload[]>(),unregistered=new Map<string,number>();
 for(const source of rows){
  let row=source,id=corporateIdentity(row);
  if(!text(row.noreg)&&!row._corporateReferenceSlot){const slot=(unregistered.get(id)||0)+1;unregistered.set(id,slot);id+=':source:'+slot;row={...row,_corporateIdentity:id,_corporateReferenceSlot:true};}
  const group=groups.get(id)||[];group.push(row);groups.set(id,group);
 }
 const result:Payload[]=[];let duplicates=0;
 for(const [id,group] of groups){
  if(group.length===1){const row=group[0];result.push({...row,_corporateIdentity:id,_corporateLatest:text(row._corporateLatest)||latest(row),_corporateConflict:row._corporateConflict??null});continue;}
  const versions=[...new Map(group.map(r=>[JSON.stringify(comparable(r)),r])).values()];
  const sorted=[...versions].sort((a,b)=>latest(a).localeCompare(latest(b))||JSON.stringify(comparable(a)).localeCompare(JSON.stringify(comparable(b))));
  const last=sorted.at(-1)!;
  const tied=sorted.filter(r=>latest(r)===latest(last));
  const fields=['company','product','status','implementor','sales','segment','projectType','formType','requestType','assignDate','progressDate','doneDate','returnDate','description','remarks'];
  const conflict=tied.length>1&&new Set(tied.map(r=>JSON.stringify(fields.map(k=>r[k]??null)))).size>1;
  const patched=sorted.reduce<Payload>((previous,incoming)=>({...previous,...Object.fromEntries(Object.entries(incoming).filter(([,value])=>value!==null&&value!==undefined&&text(value)!==''))}),{});
  // Preserve all competing values, withhold SLA instead of picking a status by row order.
  const current:Payload=conflict?{...patched,status:null,doneDate:null,_corporateConflict:'Beberapa versi pekerjaan berbeda tanpa waktu pembaruan yang dapat membedakannya.'}:{...last,...patched};
  current._corporateIdentity=id;
  current._corporateLatest=latest(last);
  current._corporateConflict=conflict?current._corporateConflict:null;
  if(versions.length>1)current._corporateVersions=JSON.stringify(versions.map(r=>JSON.parse(text(r._corporateSource)||JSON.stringify(comparable(r)))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  duplicates+=group.length-1;
  for(const original of group)result.push({...current,_sourceRow:original._sourceRow,_sourceSheet:original._sourceSheet,_sourceBlank:original._sourceBlank});
 }
 return {rows:result,duplicates};
}
