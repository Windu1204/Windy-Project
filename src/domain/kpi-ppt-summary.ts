import {type KpiReport, type KpiReportPerson} from './kpi-report';
import {kpiProgress} from './formal-kpi';

/** Counts indicator-period observations; never adds amounts, percentages or weighted scores. */
export function kpiSummary(entries:KpiReportPerson[], report:Pick<KpiReport,'period'|'annual'>, indicatorKey?:string) {
 const result={total:0,targets:0,actuals:0,met:0,below:0,unassessed:0};
 const periods=report.annual?Array.from({length:12},(_,i)=>report.period.slice(0,4)+'-'+String(i+1).padStart(2,'0')):[report.period.slice(0,7)];
 for(const entry of entries)for(const indicator of entry.template.indicators.filter(i=>!indicatorKey||i.key===indicatorKey))for(const period of periods){
  const v=entry.values.find(v=>v.indicator_key===indicator.key&&v.period.slice(0,7)===period);
  result.total++;if(v?.target.trim())result.targets++;if(v?.actual!==null&&v?.actual!==undefined)result.actuals++;
  const state=kpiProgress(indicator,v?.target||'',v?.actual??null);
  if(state.tone==='green')result.met++;else if(state.tone==='amber')result.below++;else result.unassessed++;
 }
 return result;
}
