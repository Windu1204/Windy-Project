import {type ApplicationKind} from '../types';
import {type UploadAudit} from '../domain/upload-audit';
/** Excel parsing stays off the UI thread, so a large workbook cannot freeze navigation. */
export function readUploadInWorker(file:File,kind:ApplicationKind):Promise<UploadAudit>{
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('../domain/upload-worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=(event:MessageEvent<{audit?:UploadAudit;error?:string}>)=>{worker.terminate();if(event.data.error)reject(new Error(event.data.error));else if(event.data.audit)resolve(event.data.audit);else reject(new Error('Hasil pemeriksaan Excel tidak valid.'));};
  worker.onerror=event=>{worker.terminate();reject(new Error(event.message||'File Excel tidak dapat diperiksa.'));};
  worker.postMessage({file,kind});
 });
}
