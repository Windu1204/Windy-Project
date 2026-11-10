import {type Payload,text} from '../types';

const key=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const doneNames=['doneDate','Tanggal Done','Tgl Done','tgl_done','Tanggal Selesai','Done Date','Completed Date','Completion Date'];
const handoverNames=['handoverDate','Tanggal Handover','Tgl Handover','tgl_handover','Handover Date'];
function pick(p:Payload,names:string[]){
 for(const name of names){const found=Object.keys(p).find(k=>key(k)===key(name)&&text(p[k]));if(found)return p[found];}
 return null;
}
export function sourceDate(v:Payload[string]):string|null{
 if(v==null||!text(v))return null;
 if(typeof v==='number'){
  if(!Number.isFinite(v)||v<1||v>2958465)return null;
  return new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000).toISOString().slice(0,10);
 }
 const s=text(v),iso=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[T\s])/),local=s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
 let value=iso?`${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`:local?`${local[3].length===2?'20':''}${local[3]}-${local[2].padStart(2,'0')}-${local[1].padStart(2,'0')}`:s;
 const word=s.match(/^(\d{1,2})[\s/-]([A-Za-z]{3,9})[\s/-](\d{4})$/);
 if(word){const months=['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];const token=word[2].toLowerCase().slice(0,3).replace('may','mei').replace('aug','agu').replace('oct','okt').replace('dec','des');const m=months.indexOf(token);if(m>=0)value=`${word[3]}-${String(m+1).padStart(2,'0')}-${word[1].padStart(2,'0')}`;}
 return value;
}
/** Only actual source columns are mapped. Completion never implies a handover. */
export function completionDates(p:Payload):Payload{
 return {...p,doneDate:sourceDate(pick(p,doneNames)),handoverDate:sourceDate(pick(p,handoverNames))};
}
export function handoverDate(p:Payload){return text(p.dashboardHandoverAt)||text(p.handoverDate);}
