import {supabase} from './supabase';
import {type ApplicationKind} from '../types';
import {type UploadAudit} from '../domain/upload-audit';
export type UploadReview=Record<'new'|'updated'|'unchanged'|'duplicates'|'conflicts',number>;
const db=()=>{if(!supabase)throw new Error('Supabase belum dikonfigurasi.');return supabase;};
export async function stageUpload(workspace:string,kind:ApplicationKind,audit:UploadAudit,progress?:(done:number,total:number)=>void){
 const {data:id,error}=await db().rpc('wci_begin_upload',{p_workspace:workspace,p_kind:kind,p_name:audit.file,p_source:audit.source});if(error)throw error;
 const entries=[...audit.rows.map(row=>({row,issue:false})),...audit.issues.map(issue=>({row:issue,issue:true}))];
 for(let start=0;start<entries.length;start+=1000){const chunk=entries.slice(start,start+1000);const {error}=await db().rpc('wci_stage_upload',{p_id:id,p_chunk:start/1000,p_rows:chunk.filter(x=>!x.issue).map(x=>x.row),p_issues:chunk.filter(x=>x.issue).map(x=>x.row)});if(error)throw error;progress?.(Math.min(start+1000,entries.length),entries.length);}
 const {data:review,error:reviewError}=await db().rpc('wci_review_staged_upload',{p_id:id});if(reviewError)throw reviewError;
 const issues:UploadAudit['issues']=[];
 for(let offset=0;;offset+=1000){const {data,error}=await db().from('wci_upload_issues').select('payload,reason,source_row,sheet').eq('upload_id',id).order('id').range(offset,offset+999);if(error)throw error;issues.push(...data.map(x=>({row:x.payload,reason:x.reason,sourceRow:x.source_row,sheet:x.sheet})));if(data.length<1000)break;}
 const rejected=new Set(issues.map(x=>x.sheet+':'+x.sourceRow));
 return {id:String(id),review:review as UploadReview,audit:{...audit,issues,rows:audit.rows.filter(r=>!rejected.has(String(r._sourceSheet)+':'+r._sourceRow))}};
}
export async function commitUpload(id:string){const {error}=await db().rpc('wci_commit_staged_upload',{p_id:id});if(error)throw error;}
