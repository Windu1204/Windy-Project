import {readUpload} from './upload-audit';
import {type ApplicationKind} from '../types';
self.onmessage=async(event:MessageEvent<{file:File;kind:ApplicationKind}>)=>{
 try{self.postMessage({audit:await readUpload(event.data.file,event.data.kind)});}
 catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
