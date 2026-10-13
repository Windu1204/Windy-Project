/** Display/grouping fallback; source payload is never rewritten. */
export function corporateProductFallback(value:string){
 const key=value.trim().toLowerCase().replace(/\s+/g,' ');
 if(/^(?:va )?vam$/.test(key))return 'VA eColl Portal';
 if(/^api snap(?: transfer credit)?$/.test(key))return 'OGP SNAP';
 return value;
}
