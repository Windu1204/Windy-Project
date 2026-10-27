export const kpiGroups = {
  regional_fscm: 'Regional Head Office – FSCM',
  regional_non_bni: 'Regional Head Office – Non BNIdirect',
  ijr: 'IJR', corporate: 'Corporate Non Piloting', piloting: 'Corporate Piloting – Activation Team',
} as const;
export type KpiGroup = keyof typeof kpiGroups;
export interface KpiIndicator { key:string; perspective:string; section:string; label:string; weight:number; unit:string; nature:string; classification?:string; details:string[] }
export interface KpiTemplate { code:string; group_code:KpiGroup; title:string; indicators:KpiIndicator[] }
export interface KpiPerson { id:string; template_code:string; name:string; npp:string; grade:string; position:string; managed:string; aliases:string[]; user_id:string|null; leader_id:string|null }
export interface KpiValue { person_id:string; period:string; indicator_key:string; target:string; actual:number|null; note:string; updated_at:string }
export interface KpiSnapshot { people:KpiPerson[]; templates:KpiTemplate[]; values:KpiValue[] }
export const emptyKpi:KpiSnapshot = {people:[],templates:[],values:[]};
/** Indonesian decimal commas are supported; ambiguous grouping separators are rejected. */
export function kpiNumber(value:string):number|null {
  const s=value.trim();
  if(!s || !/^-?\d+(?:[.,]\d+)?$/.test(s))return null;
  const number=Number(s.replace(',','.'));
  return Number.isFinite(number)?number:null;
}
export function kpiTarget(value:string,unit:string) {
  const s=value.trim().replace(/\s+/g,'');
  const match=s.match(/^(>=|<=|≥|≤|>|<|=)?(-?\d+(?:[.,]\d+)?)(%)?$/);
  if(!match)return null;
  const n=kpiNumber(match[2]);if(n===null)return null;
  // Percent targets are displayed and entered as 95%, not the Excel fraction 0.95.
  return {value:n,operator:match[1]||'=',percent:unit==='%'||!!match[3]};
}
export function kpiProgress(indicator:KpiIndicator,target:string,actual:number|null) {
  if(actual===null)return {label:'Belum diinput',tone:'neutral',ratio:null};
  const parsed=kpiTarget(target,indicator.unit);
  if(!parsed)return {label:'Target belum diisi',tone:'neutral',ratio:null};
  if(indicator.unit==='Special Scoring')return {label:'Menunggu aturan skor',tone:'neutral',ratio:null};
  const delta=actual-parsed.value, tolerance=1e-8;
  let met:boolean;
  if(['>=','≥'].includes(parsed.operator))met=delta>=-tolerance;
  else if(['<=','≤'].includes(parsed.operator))met=delta<=tolerance;
  else if(parsed.operator==='>')met=delta>tolerance;
  else if(parsed.operator==='<')met=delta<-tolerance;
  else if(indicator.nature==='Precise is Better')met=Math.abs(delta)<tolerance;
  else met=delta>=-tolerance;
  const ratio=indicator.nature==='Higher is Better'&&parsed.value>0&&!['<=','≤','<'].includes(parsed.operator)?actual/parsed.value*100:null;
  return {label:met?'Target tercapai':'Belum tercapai',tone:met?'green':'amber',ratio};
}
export function formatKpi(value:number|null,unit:string,locale='id-ID') {
  return value===null?'—':value.toLocaleString(locale,{maximumFractionDigits:4})+(unit==='%'?'%':'');
}
