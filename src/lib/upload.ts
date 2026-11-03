import {supabase} from './supabase';
import {type ApplicationKind,type Payload} from '../types';
import {type UploadAudit} from '../domain/upload-audit';
export type UploadReview=Record<'new'|'updated'|'unchanged'|'duplicates'|'conflicts',number>;
const db=()=>{if(!supabase)throw new Error('Supabase belum dikonfigurasi.');return supabase;};
export async function reviewStagedUpload(id:string):Promise<UploadReview>{
 const {data,error}=await db().rpc('wci_review_staged_upload',{p_id:id});if(error)throw error;
 if(!data)throw new Error('Hasil pemeriksaan upload belum tersedia.');return data as UploadReview;
}
export async function stageUpload(workspace:string,kind:ApplicationKind,audit:UploadAudit,progress?:(done:number,total:number)=>void,strategy:'merge'|'selected'='merge'){
 const {data:id,error}=await db().rpc('wci_begin_upload',{p_workspace:workspace,p_kind:kind,p_name:audit.file,p_source:audit.source});if(error)throw error;
 const configured=await db().rpc('wci_set_upload_strategy',{p_id:id,p_strategy:strategy});if(configured.error)throw configured.error;
 const entries=[...audit.rows.map(row=>({row,issue:false})),...audit.issues.map(issue=>({row:issue,issue:true}))];
 for(let start=0;start<entries.length;start+=1000){const chunk=entries.slice(start,start+1000);const {error}=await db().rpc('wci_stage_upload',{p_id:id,p_chunk:start/1000,p_rows:chunk.filter(x=>!x.issue).map(x=>x.row),p_issues:chunk.filter(x=>x.issue).map(x=>x.row)});if(error)throw error;progress?.(Math.min(start+1000,entries.length),entries.length);}
 const review=await reviewStagedUpload(String(id));
 const issues:UploadAudit['issues']=[];
 for(let offset=0;;offset+=1000){const {data,error}=await db().from('wci_upload_issues').select('payload,reason,source_row,sheet').eq('upload_id',id).order('id').range(offset,offset+999);if(error)throw error;issues.push(...data.map(x=>({row:x.payload,reason:x.reason,sourceRow:x.source_row,sheet:x.sheet})));if(data.length<1000)break;}
 const rejected=new Set(issues.map(x=>x.sheet+':'+x.sourceRow));
 return {id:String(id),review:review as UploadReview,audit:{...audit,issues,rows:audit.rows.filter(r=>!rejected.has(String(r._sourceSheet)+':'+r._sourceRow))}};
}
export async function commitUpload(id:string){const {error}=await db().rpc('wci_commit_staged_upload',{p_id:id});if(error)throw error;}

export type UploadSource={id:string;name:string;created_at:string;source_count:number;valid_count:number};
export async function savedUploadSources(workspace:string,kind:ApplicationKind):Promise<UploadSource[]>{const {data,error}=await db().rpc('wci_upload_sources',{p_workspace:workspace,p_kind:kind});if(error)throw error;return data||[];}
export async function savedUploadAudit(workspace:string,kind:ApplicationKind,source:UploadSource):Promise<UploadAudit>{const rows:Payload[]=[];for(let offset=0;;){const {data,error}=await db().rpc('wci_upload_source_rows',{p_workspace:workspace,p_kind:kind,p_id:source.id,p_offset:offset});if(error)throw error;if(!data?.length)break;rows.push(...data.map((r:{payload:Payload})=>r.payload));offset+=data.length;}return {rows,issues:[],source:rows.length,duplicates:0,file:source.name};}
