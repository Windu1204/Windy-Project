import {describe,it,expect} from 'vitest';
import {regionalActions,regionalStatus} from '../src/domain/regional-progress';
describe('Regional user workflow',()=>{
 it('requires New to complete before handover, and keeps existing Done eligible for Company ID completion',()=>{
  expect(regionalActions({type:'New',status:'In progress'})).toMatchObject({isNew:true,canDone:true,canHandover:false});
  expect(regionalActions({type:'New',status:'Done'})).toMatchObject({canDone:true,canHandover:false});
  expect(regionalActions({type:'New',status:'Done',companyId:'001'})).toMatchObject({canDone:false,canHandover:true});
  expect(regionalActions({type:'New',status:'Done',companyId:'001',dashboardHandoverAt:'2026-10-29T00:00:00Z'})).toMatchObject({canDone:false,canHandover:false,handed:true});
 });
 it('never offers handover on Maintenance or completion on unknown/rejected work',()=>{
  expect(regionalActions({type:'Maintenance',status:'In progress'}).canDone).toBe(true);
  expect(regionalActions({type:'Maintenance',status:'Done',companyId:'001'}).canHandover).toBe(false);
  for(const row of [{type:'',status:'Pending'},{type:'New',status:'Reject'},{type:'Maintenance',status:'Retur'}])expect(regionalActions(row).canDone).toBe(false);
 });
});

import {filterRows,status,isDone,metrics} from '../src/domain/analytics';
import {emptyFilters,type MonitoringRecord} from '../src/types';
it('filters handover from metadata without changing completion or SLA totals',()=>{
 const row={id:'h',payload:{status:'Done',type:'New',handover:'Handover',doneDate:'2026-10-29'},sla:{status:'Within SLA',real:2,target:3,over:0,solution:'VA'}} as MonitoringRecord;
 const plain={...row,id:'d',payload:{status:'Done',type:'Maintenance'}};
 expect(status(row,'regional')).toBe('Handover');
 expect(isDone(row,'regional')).toBe(true);
 expect(metrics([row,plain],'regional')).toMatchObject({total:2,done:2,within:2});
 expect(filterRows([row,plain],'regional',{...emptyFilters,status:'Handover'}).map(r=>r.id)).toEqual(['h']);
 expect(filterRows([row,plain],'regional',{...emptyFilters,status:'Done'}).map(r=>r.id)).toEqual(['d']);
 expect(regionalStatus({status:'Done',dashboardHandoverAt:'2026-10-30'})).toBe('Handover');
 expect(regionalStatus({status:'Handover'})).toBe('Handover');
 expect(status(row,'corporate')).not.toBe('Handover');
 expect(row.payload.status).toBe('Done');
});
