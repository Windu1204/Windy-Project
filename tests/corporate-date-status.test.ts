import {describe,it,expect} from 'vitest';
import {type MonitoringRecord,type Payload,emptyFilters} from '../src/types';
import {corporateStatus,corporateStatusPayload} from '../src/domain/corporate-status';
import {status,filterRows,metrics} from '../src/domain/analytics';
import {reportStatus} from '../src/domain/report-status';
import {reportContext,reportContents,reportModel} from '../src/domain/report-model';
import {createRenderer} from '../src/domain/report-renderers/corporate.js';
import {calculateSla} from '../src/domain/sla';
import {detailFields} from '../src/domain/display';
import {normalize} from '../src/domain/imports';
import {reconcileCorporateRows} from '../src/domain/corporate-upload';
const row=(payload:Payload):MonitoringRecord=>({id:String(payload.noreg||'x'),payload,sla:calculateSla(payload,'corporate')});
describe('Corporate Non Piloting milestone statuses',()=>{
 it.each([
  [{status:'Transactions Active',assignDate:'2026-08-14'},'Pending Task'],
  [{status:'Project Assignment',assignDate:'2026-08-14',progressDate:'2026-08-15'},'On Progress'],
  [{status:'Waiting Transactions Active',assignDate:'2026-08-14',progressDate:'2026-08-15',doneDate:'2026-08-18'},'Done'],
  [{status:'Handover',doneDate:'2026-08-18'},'Done'],
  [{status:'Done',assignDate:'2026-08-14',progressDate:'0000-00-00',doneDate:'2026-02-30'},'Pending Task'],
  [{status:'Rejected',doneDate:'2026-08-18'},'Reject/Retur'],
  [{status:'Returned',progressDate:'2026-08-15'},'Reject/Retur'],
  [{status:'Reject/Retur',assignDate:'2026-08-14'},'Reject/Retur'],
 ])('resolves %j to %s without changing the source',(payload,expected)=>{
  const original=JSON.stringify(payload);expect(corporateStatus(payload)).toBe(expected);expect(status(row(payload),'corporate')).toBe(expected);expect(corporateStatusPayload(payload).status).toBe(expected);expect(JSON.stringify(payload)).toBe(original);
 });
 it('keeps dashboard, filters and report totals consistent with reject counted separately',()=>{
  const rows=[row({noreg:'A',assignDate:'2026-08-14'}),row({noreg:'B',progressDate:'2026-08-15'}),row({noreg:'C',doneDate:'2026-08-18'}),row({noreg:'D',status:'Reject',doneDate:'2026-08-18'})];
  expect(metrics(rows,'corporate')).toMatchObject({total:4,done:1,waiting:1});expect(filterRows(rows,'corporate',{...emptyFilters,status:'Reject/Retur'}).map(r=>r.id)).toEqual(['D']);expect(reportStatus(rows[3],'corporate')).toBe('Retur');const model=reportModel(rows,'corporate');expect(model).toMatchObject({total:4,done:1,retur:1,inProgress:1,waiting:1});expect(model).toEqual(createRenderer(reportContext(rows,'corporate',reportContents.corporate)).model());
 });
 it('always shows Request Type and milestone dates in Corporate details',()=>{
  const populated=detailFields(row({requestType:'Perubahan nomor telepon',assignDate:'2026-08-14'}),'corporate');expect(populated).toContainEqual(['Request Type','Perubahan nomor telepon']);expect(populated).toContainEqual(['Status Onboard','Pending Task']);expect(populated).toContainEqual(['Progress Date','—']);expect(detailFields(row({}),'corporate')).toContainEqual(['Request Type','—']);
 });
 it('normalizes future uploads but keeps original Current Stage and request text archived',()=>{
  const [p]=normalize([{'No. Register':'QA','Current Stage':'Project Assignment','Jenis Permintaan':'Ubah User','Tanggal Assign':'2026-08-14','Tanggal Done':'2026-08-18'}],'corporate');expect(p.status).toBe('Done');expect(p.requestType).toBe('Ubah User');expect(JSON.parse(String(p._corporateSource))['Current Stage']).toBe('Project Assignment');
  const a=reconcileCorporateRows(normalize([{'No. Register':'QA','Nama Perusahaan':'One','Status':'Done'},{'No. Register':'QA','Nama Perusahaan':'Other','Status':'Done'}],'corporate'));expect(a.rows[0]._corporateConflict).toBeTruthy();
 });
 it('leaves Assign-to-Done SLA arithmetic and other dashboards unchanged, including rejected rows',()=>{
  const p={product:'BNIdirect',projectType:'Maintenance',assignDate:'2026-08-14',doneDate:'2026-08-18'};expect(calculateSla(p,'corporate')).toEqual(calculateSla({...p,status:'Reject'},'corporate'));expect(calculateSla(p,'corporate')).toMatchObject({real:1,target:2});expect(status(row({status:'Reject',doneDate:'2026-08-18'}),'regional')).toBe('Reject');expect(reportStatus(row({Status:'Waiting for Approval'}),'ijr')).toBe('Pending');
 });
});
