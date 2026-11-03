import {readUpload,uploadSheets,combineUploadAudits,type UploadAudit} from './upload-audit';
import {type ApplicationKind} from '../types';
self.onmessage=async(event:MessageEvent<{file:File;kind:ApplicationKind;attachments?:File[];selection?:Record<string,string[]>;files?:File[];audits?:UploadAudit[]}>)=>{
 try{if(event.data.audits){self.postMessage({audit:combineUploadAudits(event.data.audits,event.data.kind)});return;}if(event.data.files){self.postMessage({sheets:await uploadSheets(event.data.files)});return;}self.postMessage({audit:await readUpload(event.data.file,event.data.kind,event.data.attachments,event.data.selection)});}
 catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
