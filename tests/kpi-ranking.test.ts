import {describe,it,expect} from 'vitest';
import {kpiMonthScore,kpiPersonScore,kpiRanking} from '../src/domain/kpi-ranking';
import {kpiProgress,type KpiTemplate,type KpiValue,type KpiPerson} from '../src/domain/formal-kpi';
const template:KpiTemplate={code:'t',group_code:'ijr',title:'KPI',indicators:[
 {key:'h',label:'Higher',weight:.5,unit:'Numbers',nature:'Higher is Better',perspective:'',section:'',details:[]},
 {key:'p',label:'Precise',weight:.3,unit:'%',nature:'Precise is Better',perspective:'',section:'',details:[]},
 {key:'s',label:'Special',weight:.2,unit:'Special Scoring',nature:'Higher is Better',perspective:'',section:'',details:[]}]};
const values=(person_id='a',period='2026-06',actual=120):KpiValue[]=>['h','p','s'].map((key,i)=>({person_id,period,indicator_key:key,target:i===2?'':'100',actual:[actual,100,80][i],note:'',updated_at:''}));
const person=(id:string):KpiPerson=>({id,name:id,template_code:'t',npp:'',grade:'',position:'',managed:'',aliases:[],user_id:null,leader_id:null});
describe('complete weighted KPI ranking',()=>{
 it('includes every indicator with original weight and no achievement cap',()=>{expect(kpiMonthScore(template,values(),'2026-06')).toMatchObject({score:106,assessed:3,total:3});expect(kpiProgress(template.indicators[0],'100',200).ratio).toBe(200);});
 it('assigns precise 100 or 0, respecting explicit target thresholds',()=>{expect(kpiProgress(template.indicators[1],'100',99).ratio).toBe(0);expect(kpiProgress(template.indicators[1],'≥95%',96).ratio).toBe(100);const v=values();v[1].actual=99;expect(kpiMonthScore(template,v,'2026-06').score).toBe(76);});
 it('keeps incomplete months and unsupported targets unranked instead of zero or reweighting',()=>{const v=values();v[2].actual=null;expect(kpiMonthScore(template,v,'2026-06')).toMatchObject({score:null,assessed:2});v[2].actual=0;expect(kpiMonthScore(template,v,'2026-06').score).toBe(90);v[0].target='0';expect(kpiMonthScore(template,v,'2026-06').score).toBeNull();});
 it('averages only complete monthly totals in the selected year and displays the month count',()=>{const v=[...values(),...values('a','2026-07',80),...values('a','2027-01',500)];expect(kpiPersonScore(template,v,'2026-10',true)).toMatchObject({score:96,months:2,total:36});expect(kpiPersonScore(template,[],'2026-10',true).score).toBeNull();});
 it('uses tied competition ranks and never includes people outside the supplied authorized scope',()=>{const rows=kpiRanking(['b','a','c','d'].map(person),[template],[...values('a'),...values('b'),...values('c','2026-06',80),...values('hidden','2026-06',900)],'2026-06');expect(rows.map(r=>[r.person.id,r.rank])).toEqual([['a',1],['b',1],['c',3],['d',null]]);});
 it('rejects malformed template weights and invalid special achievement',()=>{expect(kpiMonthScore({...template,indicators:template.indicators.slice(0,2)},values(),'2026-06').score).toBeNull();expect(kpiMonthScore({...template,indicators:[]},[],'2026-06').score).toBeNull();expect(kpiProgress(template.indicators[2],'',-1).ratio).toBeNull();});
});
