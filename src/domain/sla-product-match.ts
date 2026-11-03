import catalogue from './sla-catalogue.json';
import {type Payload,text} from '../types';
export const SLA_CATALOGUE=catalogue;
export const additionalSlaNames=new Set(['BNIdirect Bisnis','BNIdirect Overseas','Cash Pooling manual iCons Cabang','Cash Deposit Machine','EBS','Dashboard custom','Restrukturisasi Rek Pemerintah','SPC','MT101']);
const aliases:Record<string,string[]>={
 'Restrukturisasi Rek Pemerintah':['Rekening Restrukturisasi Pemerintah','Restrukturisasi Rekening Pemerintah','Restruktur Rek Pemerintah','Restrukturisasi Pemerintah'],
 'Cash Deposit Machine':['CDM'],'Cash Pooling manual iCons Cabang':['Cash Pooling Manual'],
 'BNIdirect Bisnis':['BNI Direct Bisnis'],'BNIdirect Overseas':['BNI Direct Overseas'],
 'VA eCollection (Portal)':['VA eCollection','VA Ecoll Portal','VA eColl','VA eColletion Portal'],
 'VA Debit berkartu':['Virtual Account Debit berkartu','VA Debet berkartu','VA Debit'],
 'VA Kredit berkartu':['Virtual Account Kredit berkartu','VA Credit berkartu'],
 'Virtual Account (upload iCons/RPA)':['VA upload icons','VA upload RPA'],
 'Virtual Account SNAP':['VA SNAP'],'Virtual Account Non SNAP (Integrasi)':['VA non SNAP','VA Integrasi'],
 'BNIdirect GFX':['BNIdirect-GFX'],'MT100 (standart)':['MT100 standard'],
};
export const normalizeSlaProduct=(s:string)=>s.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\brek\b/g,'rekening').replace(/\bdebet\b/g,'debit').replace(/\bcredit\b/g,'kredit').replace(/\bstandart\b/g,'standard').replace(/\s+/g,' ').trim();
const entries=catalogue.flatMap(rule=>[rule.name,...(aliases[rule.name]||[])].map(alias=>({rule,normalized:normalizeSlaProduct(alias)})));
const compact=(s:string)=>s.replace(/ /g,'');
const exact=new Map(entries.map(entry=>[compact(entry.normalized),entry.rule]));
const signature=(s:string)=>s.split(' ').filter(token=>/^(?:non|snap|debit|kredit|bisnis|overseas|gfx|manual|custom|swift|email|\d+|mt\d+|otr|itr|rdn|rdl|rdf|mpn|fscm|spc|ebs)$/.test(token)).sort().join('|');
function edits(a:string,b:string){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}return row[b.length];}
const cache=new Map<string,typeof catalogue[number]|null>();
export function resolveSlaProduct(source:string){const n=normalizeSlaProduct(source);if(cache.has(n))return cache.get(n)!;let result=exact.get(compact(n))||null;
 if(!result&&n.length>=8&&n.length<100){const tokens=n.split(' ').sort(),matches=new Map<string,typeof catalogue[number]>();for(const entry of entries){const other=entry.normalized.split(' ').sort();if(tokens.length!==other.length||signature(n)!==signature(entry.normalized))continue;if(tokens.every((token,i)=>token===other[i]||Math.min(token.length,other[i].length)>=5&&edits(token,other[i])<=(Math.max(token.length,other[i].length)>=10?2:1)))matches.set(entry.rule.name,entry.rule);}if(matches.size===1)result=[...matches.values()][0];}
 if(cache.size>512)cache.clear();cache.set(n,result);return result;
}
export function governmentRequest(row:Payload){return [row.product,row.requestType,row.formType].map(text).some(value=>{const normalized=normalizeSlaProduct(value);if(/\b(?:perubahan|ubah|penggantian|pergantian|ganti|update)\s+(?:data\s+)?(?:pejabat|user|pengguna|kpa|bendahara|bpp)\b/.test(normalized))return true;const words=normalized.split(' ');return words.some((word,i)=>{if(word.length<6||!['perubahan','penggantian','pergantian','update'].some(action=>edits(word,action)<=1))return false;const subject=words[i+1]==='data'?words[i+2]:words[i+1];return !!subject&&(/^(pejabat|user|pengguna|kpa|bendahara|bpp)$/.test(subject)||subject.length>=6&&['pejabat','pengguna','bendahara'].some(name=>edits(subject,name)<=1));});});}
export function additionalSlaInText(source:string){const n=' '+normalizeSlaProduct(source)+' ';return entries.filter(e=>additionalSlaNames.has(e.rule.name)).sort((a,b)=>b.normalized.length-a.normalized.length).find(e=>n.includes(' '+e.normalized+' '))?.rule||null;}
export function documentSlaTarget(name:string,isNew:boolean){const rule=resolveSlaProduct(name),target=rule&&(isNew?rule.newDays:rule.maintDays);return rule&&target?{target,solution:rule.name,map:'Tabel SLA Implementasi'}:null;}
