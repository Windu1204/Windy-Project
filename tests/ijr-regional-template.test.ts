import {describe,it,expect} from 'vitest';
import {adaptIJRReportContext} from '../src/domain/report-renderers/ijr-report-profile';
import {createRenderer} from '../src/domain/report-renderers/regional.js';
import {reportContext,reportContents} from '../src/domain/report-model';
import {calculateSla} from '../src/domain/sla';
import type {Payload} from '../src/types';
const raw:Payload[]=[
 {'Application Number':'ONE','Applicant Name':'Example','Application Type':'New Request','Status':'Proses Selesai','Flow Process':'Permohonan Disetujui','Request Date':'2026-09-15','Wilayah':'KANTOR WILAYAH 01','Implementor 1':'Alex','Implementor 2':'Alex',_TBSDayNum:0,_CabangDayNum:99},
 {'Application Number':'TWO','Application Type':'Maintenance BNI Direct','Status':'Registered, Delivered','Request Date':'2026-09-16','Wilayah':'KANTOR WILAYAH 02','Implementor 1':'Alex',_TBSDayNum:3},
 {'Application Number':'THREE','Application Type':'New Request','Status':'Dibatalkan','Request Date':'2026-09-16','Wilayah':'KANTOR WILAYAH 01','Implementor 1':'Alex',_TBSDayNum:1},
];
const records=raw.map((payload,i)=>({id:String(i),payload,sla:calculateSla(payload,'ijr')}));
describe('IJR uses the Regional report template with IJR data',()=>{
 it('preserves source fields and TBS duration while adapting presentation fields',()=>{
  const source=reportContext(records,'ijr',reportContents.ijr),profile=adaptIJRReportContext(source);
  expect(profile.renderProfile).toBe('ijr');
  expect(profile.rows[0]).toMatchObject({'Application Number':'ONE',cid:'ONE',region:'W01',salesDate:'2026-09-15',status:'Proses Selesai',slaReal:0,implementor:'Alex'});
  expect(source.rows[0]).not.toHaveProperty('region');
  expect(profile.rows[1].slaStatus).toBe('Overdue');
 });
 it('keeps all source statuses separate, excludes cancelled work from active and counts each PIC once per request',()=>{
  const renderer=createRenderer(adaptIJRReportContext(reportContext(records,'ijr',reportContents.ijr)));
  const model=renderer.model();
  expect(model.statuses.map(r=>r[0])).toEqual(expect.arrayContaining(['Proses Selesai','Registered, Delivered','Dibatalkan']));
  expect(model.statuses.reduce((n,r)=>n+r[1],0)).toBe(3);
  expect(model.people[0]).toMatchObject({assigned:3,done:2,active:0,overdue:1});
 });
 it('uses the scoped rows rather than the larger dataset for report totals',()=>{
  const profile=adaptIJRReportContext(reportContext(records.slice(0,1),'ijr',reportContents.ijr,{person:'Alex',dataset:records}));
  const model=createRenderer(profile).model();
  expect(model.total).toBe(1);expect(model.people[0].assigned).toBe(1);expect(profile.dataset).toHaveLength(3);
 });
 it('has the Regional sections without a product overview',()=>{
  expect(reportContents.ijr).toEqual(['Executive Summary','Proses Implementasi & SLA','Status Breakdown','Wilayah','Key Takeaways','Beban Implementor','Detail Data']);
 });
});
