import {describe,it,expect} from 'vitest';
import {kpiSummary} from '../src/domain/kpi-ppt-summary';
import {kpiReport,type KpiReportPerson} from '../src/domain/kpi-report';
const entry:KpiReportPerson={person:{id:'a',template_code:'t',name:'A',npp:'01',grade:'',position:'',managed:'',aliases:[],user_id:null,leader_id:null},template:{code:'t',title:'T',group_code:'piloting',indicators:[{key:'sla',label:'SLA',perspective:'Process',section:'',details:[],weight:1,unit:'%',nature:'Higher is Better'}]},values:[{person_id:'a',period:'2026-06-01',indicator_key:'sla',target:'≥95%',actual:0,note:'',updated_at:''},{person_id:'a',period:'2027-06-01',indicator_key:'sla',target:'≥95%',actual:100,note:'',updated_at:''}]};
describe('compact KPI PPT counts',()=>{
 it('retains zero as a filled realization and below target',()=>{expect(kpiSummary([entry],{period:'2026-06',annual:false})).toEqual({total:1,targets:1,actuals:1,met:0,below:1,unassessed:0});});
 it('counts missing months separately and excludes other years',()=>{expect(kpiSummary([entry],{period:'2026-06',annual:true})).toEqual({total:12,targets:1,actuals:1,met:0,below:1,unassessed:11});});
 it('uses Admin-entered special achievement while keeping ordinary missing targets unassessed',()=>{const e=structuredClone(entry);e.template.indicators[0].unit='Special Scoring';expect(kpiSummary([e],{period:'2026-06',annual:false}).below).toBe(1);e.template.indicators[0].unit='%';e.values[0].target='';expect(kpiSummary([e],{period:'2026-06',annual:false}).below).toBe(0);});
 it('distinguishes All from a selected person even when only one member is authorized',()=>{const snapshot={people:[entry.person],templates:[entry.template],values:entry.values};expect(kpiReport(snapshot,'2026-06',false).allMembers).toBe(true);expect(kpiReport(snapshot,'2026-06',false,'a').allMembers).toBe(false);});
});
