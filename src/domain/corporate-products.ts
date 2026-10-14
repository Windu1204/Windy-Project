import {type Payload, text} from '../types';

const clean=(value:unknown)=>String(value??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
/** Resolve only named services. A generic VA/API is never a default SLA. */
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
 const source=clean([row.formType,row.requestType,row.description,row.remarks].map(text).join(' '));
 const found=new Set<string>();
 const add=(condition:boolean,service:string)=>{if(condition)found.add(service);};
 add(/\b(?:va|virtual account) (?:debit|debet) (?:kredit|credit)\b/.test(source),'VA Debit/Kredit berkartu');
 if(!found.has('VA Debit/Kredit berkartu')){
  add(/\b(?:va|virtual account) (?:debit|debet)\b/.test(source),'VA Debit berkartu');
  add(/\b(?:va|virtual account) (?:kredit|credit)\b/.test(source),'VA Kredit berkartu');
 }
 add(/\b(?:e ?collection|e ?coll|ecoll|vam|portal va|va portal)\b/.test(source),'VA eCollection (Portal)');
 const va=/\b(?:va|virtual account)\b/.test(product+' '+source);
 if(va){
  if(/\bnon snap\b/.test(source))found.add('Virtual Account Non SNAP (Integrasi)');
  else add(/\bsnap\b/.test(source),'Virtual Account SNAP');
  add(/\b(?:icons|rpa|upload va)\b/.test(source),'Virtual Account (upload iCons/RPA)');
  if(!/\bsnap\b/.test(source))add(/\bintegrasi\b/.test(source),'Virtual Account Non SNAP (Integrasi)');
 }
 for(const name of ['RDN','RDL','RDF','MPN','OTR','ITR','FSCM'])add(new RegExp('\\b(?:api )?'+name.toLowerCase()+'\\b').test(source),'API '+name);
 add(/\bapi bni ?direct\b/.test(source),'API BNIdirect');
 add(/\b(?:api notification account statement|api nas)\b/.test(source),'API Notification Account Statement');
 if(!va)add(/\bapi snap\b/.test(source),'OGP SNAP');
 add(/\b(?:ogp|one gate payment|autocollection)\b/.test(source),/\bsnap\b/.test(source)?'OGP SNAP':'OGP');
 add(/\b(?:integrasi erp|bni ?direct gfx)\b/.test(source),'BNIdirect-GFX');
 // API BNIdirect and BNIdirect-GFX are more specific than plain BNIdirect.
 if(![...found].some(s=>/BNIdirect/.test(s)))add(/\bbni ?direct\b/.test(source),'BNIdirect');
 add(/\bauto ?deb(?:et|it)\b/.test(source),'BNIdirect');
 return found.size===1?[...found][0]:null;
}
