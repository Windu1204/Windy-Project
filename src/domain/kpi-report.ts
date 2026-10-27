import { kpiGroups, kpiProgress, formatKpi, type KpiSnapshot, type KpiPerson, type KpiTemplate, type KpiValue } from './formal-kpi';
export const kpiMonths=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export interface KpiReportPerson { person:KpiPerson; template:KpiTemplate; values:KpiValue[] }
export interface KpiReport { period:string; annual:boolean; label:string; generated:string; people:KpiReportPerson[] }
/** Scope a fresh server-authorized snapshot, never unsaved form values. */
export function kpiReport(snapshot:KpiSnapshot,period:string,annual:boolean,personId?:string,group?:string):KpiReport {
 const templates=new Map(snapshot.templates.map(t=>[t.code,t]));
 const people=snapshot.people.filter(p=>(!personId||p.id===personId)&&(!group||templates.get(p.template_code)?.group_code===group)).flatMap(person=>{
  const template=templates.get(person.template_code);return template?[{person,template,values:snapshot.values.filter(v=>v.person_id===person.id&&(annual?v.period.slice(0,4)===period.slice(0,4):v.period.slice(0,7)===period))}]:[];
 });
 if(!people.length)throw new Error('Tidak ada KPI sesuai pilihan dan hak akses saat ini.');
 return {period,annual,label:annual?'Tahun '+period.slice(0,4):kpiMonths[Number(period.slice(5,7))-1]+' '+period.slice(0,4),generated:new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}),people};
}
export function kpiReportRows(entry:KpiReportPerson,period:string) {
 return entry.template.indicators.map(i=>{
  const v=entry.values.find(v=>v.indicator_key===i.key&&v.period.slice(0,7)===period);
  const state=kpiProgress(i,v?.target||'',v?.actual??null);
  return {indicator:i,value:v,target:v?.target||'Belum diisi',actual:formatKpi(v?.actual??null,i.unit),ratio:state.ratio,status:state.label};
 });
}
export function kpiReportName(report:KpiReport,extension:string) {
 const scope=report.people.length===1?report.people[0].person.name:'Seluruh_Anggota';
 return ('KPI_'+(report.annual?'Tahunan_'+report.period.slice(0,4):'Bulanan_'+report.period)+'_'+scope).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150)+'.'+extension;
}
export { kpiGroups };
