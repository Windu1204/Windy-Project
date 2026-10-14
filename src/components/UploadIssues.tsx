import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {commitUpload,reviewStagedUpload,type UploadReview} from '../lib/upload';
import {type AccessRole} from '../lib/access';
import {type ApplicationKind} from '../types';
type Issue={id:number;file_name:string;source_row:number|null;sheet:string;reason:string;created_at:string};
type Summary={uploadId:string;file:string;source:number;valid:number;failed:number;committed:boolean;canResume:boolean;complete:boolean;baselineCurrent:boolean;reasons:{reason:string;count:number}[]};
const errorMessage=(error:unknown)=>error&&typeof error==='object'&&'message' in error?String(error.message):String(error);
export function UploadIssues({workspace,kind,role,revision,preview=false,onApplied}:{workspace:string;kind:ApplicationKind;role:AccessRole;revision:number;preview?:boolean;onApplied?:(file:string)=>Promise<void>}){
 const canRead=role==='admin'||role==='super_admin';
 const [rows,setRows]=useState<Issue[]>([]),[count,setCount]=useState(0),[page,setPage]=useState(0),[error,setError]=useState('');
 const [summary,setSummary]=useState<Summary|null>(null),[review,setReview]=useState<UploadReview|null>(null),[busy,setBusy]=useState(false),[actionError,setActionError]=useState('');
 useEffect(()=>{
  let active=true;if(!canRead||preview||!supabase)return;
  supabase.rpc('wci_upload_summary',{p_workspace:workspace,p_kind:kind}).then(({data,error})=>{if(!active)return;if(error){setError(error.message);return;}setSummary(data as Summary|null);});
  return()=>{active=false;};
 },[workspace,kind,revision,preview,canRead]);
 useEffect(()=>{setPage(0);setReview(null);setActionError('');},[workspace,kind,summary?.uploadId]);
 useEffect(()=>{
  let active=true;setRows([]);setCount(0);if(!canRead||preview||!supabase||!summary?.uploadId)return;setError('');
  supabase.from('wci_upload_issues').select('id,file_name,source_row,sheet,reason,created_at',{count:'exact'})
   .eq('workspace_id',workspace).eq('dataset',kind).eq('upload_id',summary.uploadId)
   .order('id',{ascending:false}).range(page*20,page*20+19)
   .then(({data,error,count})=>{if(!active)return;if(error){setError(error.message);return;}setRows(data||[]);setCount(count||0);});
  return()=>{active=false;};
 },[workspace,kind,revision,page,preview,canRead,summary?.uploadId]);
 async function continueUpload(){
  if(!summary)return;setBusy(true);setActionError('');
  try{setReview(await reviewStagedUpload(summary.uploadId));}catch(e){setActionError(errorMessage(e));}finally{setBusy(false);}
 }
 async function applyUpload(){
  if(!summary||!review||review.conflicts)return;setBusy(true);setActionError('');
  try{await commitUpload(summary.uploadId);setSummary({...summary,committed:true});setReview(null);await onApplied?.(summary.file);}
  catch(e){setActionError(errorMessage(e));}finally{setBusy(false);}
 }
 if(!canRead||preview||(!count&&!error&&!summary))return null;
 const resumable=summary&&!summary.committed&&summary.canResume&&summary.complete&&summary.baselineCurrent&&summary.valid>0;
 return <details className="panel upload-issues">
  <summary>Hasil pemeriksaan upload{summary?' · '+summary.file:''}</summary>
  {summary&&<>
   <div className="quality-grid">{[['Baris sumber',summary.source],['Valid',summary.valid],['Perlu diperiksa',summary.failed]].map(([label,n])=><div key={label}><b>{Number(n).toLocaleString()}</b><small>{label}</small></div>)}</div>
   <p className="muted">Ringkasan file ini · {summary.committed?'Sudah diterapkan':'Belum diterapkan'}. Rincian pemeriksaan hanya tersedia untuk Admin dan Super Admin.</p>
   {resumable&&<div className="admin-upload-review">
    {!review?<><p>File sudah tersimpan. Lanjutkan pemeriksaan untuk menerapkannya ke dashboard tanpa upload ulang.</p><button className="primary" disabled={busy} onClick={continueUpload}>{busy?'Memeriksa…':'Lanjutkan Upload'}</button></>:<>
     <div className="admin-stats">{Object.entries(review).map(([key,n])=><div key={key}><small>{({new:'Baru',updated:'Diperbarui',unchanged:'Tidak berubah',duplicates:'Duplikat identik',conflicts:'Konflik identitas'} as Record<string,string>)[key]}</small><strong>{n.toLocaleString()}</strong></div>)}</div>
     {review.conflicts>0&&<p className="error">Ada konflik identitas. Periksa data sebelum menerapkan upload.</p>}
     <button className="primary" disabled={busy||review.conflicts>0||review.new+review.updated+review.unchanged===0} onClick={applyUpload}>{busy?'Menerapkan…':'Terapkan Upload'}</button>
    </>}
   </div>}
   {!summary.committed&&!summary.complete&&<p className="notice">Upload belum lengkap. Pilih file lagi untuk mengulangi pemeriksaan.</p>}
   {!summary.committed&&summary.complete&&!summary.baselineCurrent&&<p className="notice">Data atau mode dashboard berubah sejak file diperiksa. Upload ulang file agar pemeriksaan memakai data terbaru.</p>}
   {!summary.committed&&summary.complete&&summary.baselineCurrent&&!summary.canResume&&<p className="notice">Lanjutkan upload melalui akun Admin yang mengunggah file ini.</p>}
   {summary.reasons?.length>0&&<ul>{summary.reasons.map(x=><li key={x.reason}>{x.reason}: {x.count.toLocaleString()}</li>)}</ul>}
   {summary.failed===0&&<p>Tidak ada baris bermasalah pada upload ini.</p>}
  </>}
  {actionError&&<p role="alert" className="error">{actionError}</p>}
  {error?<p role="alert" className="error">{error}</p>:count>0?<>
   <div className="table-scroll"><table><thead><tr><th>File</th><th>Sheet</th><th>Baris Excel</th><th>Alasan</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.file_name}</td><td>{r.sheet||'—'}</td><td>{r.source_row||'—'}</td><td>{r.reason}</td></tr>)}</tbody></table></div>
   <div className="pagination"><button className="secondary" disabled={!page} onClick={()=>setPage(page-1)}>Sebelumnya</button><span>{page+1} / {Math.max(1,Math.ceil(count/20))}</span><button className="secondary" disabled={(page+1)*20>=count} onClick={()=>setPage(page+1)}>Berikutnya</button></div>
  </>:null}
 </details>;
}
