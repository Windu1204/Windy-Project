import {type Payload, text} from '../types';

const clean=(value:unknown)=>String(value??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
// Request vocabulary approved for Corporate Non Piloting. Specific VA/API evidence wins.
const bnidirectRequest=/\b(?:rekening|user|pengguna|admin|administrator|pejabat|bendahara|kpa|ppk|payroll|penggajian|gaji|limit|token|mobiletoken|hardtoken|email|e mail|telepon|telpon|telp|tlp|handphone|hand phone|nomor hp|no hp)\b|\bbaterai (?:habis|lemah)\b/;
/** Resolve a service from the source without assigning a generic VA/API a default SLA. */
export function corporateService(row:Payload):string|null {
 const product=clean(row.product);
 if(/^auto ?deb(?:et|it)$/.test(product))return 'BNIdirect';
 if(/^auto ?collection$/.test(product))return 'OGP';
 if(/^(integrasi erp|bni ?direct gfx)$/.test(product))return 'BNIdirect-GFX';
 if(/^(va )?vam$/.test(product))return 'VA eCollection (Portal)';
 if(/^api snap(?: transfer credit)?$/.test(product))return 'OGP SNAP';
 const known=['VA Debit/Kredit berkartu','VA Debit berkartu','VA Kredit berkartu','VA eCollection (Portal)','Virtual Account SNAP','Virtual Account Non SNAP (Integrasi)','Virtual Account (upload iCons/RPA)','API ITR','API FSCM','API Notification Account Statement'];
 const named=known.find(name=>clean(name)===product);if(named)return named;
 const generic=!product||/^(virtual account|va|application programming interface(?: api)?|api|others?)$/.test(product);
 if(!generic)return null;
 const source=clean([row.formType,row.requestType,row.description,row.remarks].map(text).join(' ')).replace(/\bvirtualaccount\b/g,'virtual account').replace(/\bva(debit|debet|kredit|credit)\b/g,'va $1');
 const va=/\b(?:va|virtual account|vam)\b/.test(product+' '+source)||/\b(?:e ?collection|e ?coll|ecoll)\b/.test(source);
 const debit=/\b(?:debit|debet)\b/.test(source),credit=/\b(?:kredit|credit)\b/.test(source);
 // A VA request may also mention linking the account to BNIdirect. Keep its VA service.
 if(va){
  if(debit&&credit)return 'VA Debit/Kredit berkartu';
  if(debit)return 'VA Debit berkartu';
  if(credit)return 'VA Kredit berkartu';
  if(/\b(?:e ?collection|e ?coll|ecoll|vam|portal va|va portal)\b/.test(source))return 'VA eCollection (Portal)';
  if(/\bnon snap\b/.test(source))return 'Virtual Account Non SNAP (Integrasi)';
  if(/\bsnap\b/.test(source))return 'Virtual Account SNAP';
  if(/\b(?:icons|rpa|upload va)\b/.test(source))return 'Virtual Account (upload iCons/RPA)';
  if(/\bintegrasi\b/.test(source))return 'Virtual Account Non SNAP (Integrasi)';
  return null;
 }
 const found=new Set<string>();
 const add=(condition:boolean,service:string)=>{if(condition)found.add(service);};
 for(const name of ['RDN','RDL','RDF','MPN','OTR','ITR','FSCM'])add(new RegExp('\\b(?:api )?'+name.toLowerCase()+'\\b').test(source),'API '+name);
 add(/\bapi bni ?direct\b/.test(source),'API BNIdirect');
 add(/\b(?:api notification account statement|api nas)\b/.test(source),'API Notification Account Statement');
 if(!va)add(/\bapi snap\b/.test(source),'OGP SNAP');
 add(/\b(?:ogp|one gate payment|autocollection)\b/.test(source),/\bsnap\b/.test(source)?'OGP SNAP':'OGP');
 add(/\b(?:integrasi erp|bni ?direct gfx)\b/.test(source),'BNIdirect-GFX');
 // API BNIdirect and BNIdirect-GFX are more specific than plain BNIdirect.
 if(![...found].some(s=>/BNIdirect/.test(s)))add(/\bbni ?direct\b/.test(source),'BNIdirect');
 add(/\bauto ?deb(?:et|it)\b/.test(source),'BNIdirect');
 if(found.size===1)return [...found][0];
 if(found.size===0&&!/\b(?:api|application programming interface|digital services?)\b/.test(product+' '+source)&&bnidirectRequest.test(source))return 'BNIdirect';
 return null;
}

/** Use the same existing Product field in current dashboards, reports and future uploads. */
export function corporateProductPayload(row:Payload):Payload {
 const product=clean(row.product);
 if(product&&!/^(virtual account|va|application programming interface(?: api)?|api|others?)$/.test(product))return row;
 const service=corporateService(row);
 if(service)return {...row,product:service};
 if(!product&&/\b(?:va|virtual account|vam)\b/i.test([row.formType,row.requestType,row.description,row.remarks].map(text).join(' ')))return {...row,product:'Virtual Account'};
 return row;
}
