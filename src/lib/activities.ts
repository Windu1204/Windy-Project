import {saveBlob} from './exports';
import {supabase} from './supabase';
import {type Activity,type ActivityDataset,type ActivityBody,type ActivityKind,type ActivityFile} from '../domain/activities';
const db=()=>{if(!supabase)throw new Error('Koneksi belum tersedia.');return supabase;};
export const activityBucket='wci-activity-files';
export async function loadActivities(workspace:string,dataset:ActivityDataset,asUser?:string){const rows:Activity[]=[];for(let offset=0;;offset+=500){const {data,error}=await db().rpc('wci_activity_read',{p_workspace:workspace,p_dataset:dataset,p_as:asUser||null}).range(offset,offset+499);if(error)throw error;rows.push(...data as Activity[]);if(data.length<500)return rows;}}
export async function saveActivity(workspace:string,dataset:ActivityDataset,id:string,kind:ActivityKind,payload:ActivityBody,attachments:ActivityFile[],expected?:string,record?:string){const {data,error}=await db().rpc('wci_activity_save',{p_workspace:workspace,p_dataset:dataset,p_id:id,p_kind:kind,p_payload:payload,p_attachments:attachments,p_expected:expected||null,p_record:record||null});if(error)throw error;return data as Activity;}
export async function uploadActivityFile(workspace:string,dataset:ActivityDataset,user:string,id:string,file:File):Promise<ActivityFile>{
 const ext=file.name.split('.').pop()?.toLowerCase(),types:Record<string,string>={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',eml:'message/rfc822',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
 if(!ext||!types[ext]||file.size===0||file.size>10*1024*1024)throw new Error('Pilih PDF, gambar, EML, atau DOCX berukuran maksimal 10 MB.');
 const path=[workspace,dataset,user,id,crypto.randomUUID()+'.'+ext].join('/');const {error}=await db().storage.from(activityBucket).upload(path,file,{contentType:types[ext],upsert:false});if(error)throw error;return {path,name:file.name.slice(0,200)};
}
export async function openActivityFile(file:ActivityFile){const {data,error}=await db().storage.from(activityBucket).download(file.path);if(error)throw error;saveBlob(data,file.name);}

export async function discardActivityFiles(files:ActivityFile[]){if(!files.length||!supabase)return;await supabase.storage.from(activityBucket).remove(files.map(f=>f.path)).catch(()=>{});}
