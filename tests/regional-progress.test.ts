import {describe,it,expect} from 'vitest';
import {regionalActions} from '../src/domain/regional-progress';
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
