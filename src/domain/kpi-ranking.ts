import {kpiProgress,type KpiTemplate,type KpiValue,type KpiPerson} from './formal-kpi';

export const kpiScoringNote='Nilai KPI = jumlah (capaian × bobot) seluruh indikator. Special Scoring diisi sebagai capaian akhir (%). Capaian boleh melebihi 100%. Precise is Better: 100% bila target terpenuhi, 0% bila tidak. Data belum lengkap tidak diberi peringkat.';
export function kpiMonthScore(template:KpiTemplate,values:KpiValue[],period:string){
 const lookup=new Map(values.filter(v=>v.period.slice(0,7)===period.slice(0,7)).map(v=>[v.indicator_key,v]));
 const validWeights=template.indicators.length>0&&template.indicators.every(i=>Number.isFinite(i.weight)&&i.weight>=0)&&Math.abs(template.indicators.reduce((s,i)=>s+i.weight,0)-1)<1e-6;
 let assessed=0,points=0;
 for(const indicator of template.indicators){
  const value=lookup.get(indicator.key),ratio=kpiProgress(indicator,value?.target||'',value?.actual??null).ratio;
  if(ratio!==null&&Number.isFinite(ratio)){assessed++;points+=ratio*indicator.weight;}
 }
 return {score:validWeights&&assessed===template.indicators.length&&Number.isFinite(points)?points:null,assessed,total:template.indicators.length,validWeights};
}
export function kpiPersonScore(template:KpiTemplate,values:KpiValue[],period:string,annual=false){
 const periods=annual?Array.from({length:12},(_,i)=>period.slice(0,4)+'-'+String(i+1).padStart(2,'0')):[period.slice(0,7)];
 const months=periods.map(p=>({period:p,...kpiMonthScore(template,values,p)})),complete=months.filter(m=>m.score!==null);
 return {score:complete.length?complete.reduce((s,m)=>s+m.score!,0)/complete.length:null,months:complete.length,assessed:months.reduce((s,m)=>s+m.assessed,0),total:months.reduce((s,m)=>s+m.total,0),validWeights:months.every(m=>m.validWeights)};
}
export function kpiRanking(people:KpiPerson[],templates:KpiTemplate[],values:KpiValue[],period:string,annual=false){
 const byTemplate=new Map(templates.map(t=>[t.code,t])),byPerson=new Map<string,KpiValue[]>();
 for(const v of values){const list=byPerson.get(v.person_id)||[];list.push(v);byPerson.set(v.person_id,list);}
 const result=people.flatMap(person=>{const template=byTemplate.get(person.template_code);return template?[{person,template,...kpiPersonScore(template,byPerson.get(person.id)||[],period,annual),rank:null as number|null}]:[];});
 // Display precision is also tie precision; alphabetical order never breaks a tied rank.
 const key=(score:number)=>Math.round(score*10000);
 result.sort((a,b)=>a.score===null?(b.score===null?a.person.name.localeCompare(b.person.name):1):b.score===null?-1:key(b.score)-key(a.score)||a.person.name.localeCompare(b.person.name));
 let previous:number|null=null,rank=0;
 result.forEach((row,index)=>{if(row.score!==null){const score=key(row.score);if(previous!==score)rank=index+1;row.rank=rank;previous=score;}});
 return result;
}
