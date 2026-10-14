import {describe,it,expect} from 'vitest';
import {emptyFilters,type MonitoringRecord,type DatasetKind} from '../src/types';
import {requestDate,matchesDateSelection,clearDateSelection} from '../src/domain/date-filter';
import {filterRows} from '../src/domain/analytics';
import {filterPiloting,initialFilters} from '../src/piloting/model';
import {reportContext} from '../src/domain/report-model';
const row=(payload:MonitoringRecord['payload'],id='x'):MonitoringRecord=>({id,payload,sla:{target:null,real:null,status:'Without SLA',over:null,solution:null}});
describe('date filtering and reset',()=>{
 it('uses Corporate Create, then Submit, then Assign without modifying source fields',()=>{
  expect(requestDate({createDate:'2026-08-10',submitDate:'2026-09-01',assignDate:'2026-10-01'},'corporate')).toBe('2026-08-10');
  const p={createDate:null,submitDate:'2026-08-31 23:59:00',assignDate:'2026-09-01'};expect(requestDate(p,'corporate')).toBe('2026-08-31');expect(p.createDate).toBeNull();expect(requestDate({createDate:'0000-00-00',assignDate:'2026-08-15'},'corporate')).toBe('2026-08-15');
 });
 it.each<DatasetKind>(['ijr','regional','corporate'])('filters and restores all %s rows, including missing dates',kind=>{
  const key={ijr:'Request Date',regional:'salesDate',corporate:'submitDate'}[kind];const rows=[row({[key]:'2026-08-31T23:59:59'},'aug'),row({[key]:'2026-09-01'},'sep'),row({},'blank')];
  expect(filterRows(rows,kind,{...emptyFilters,period:'2026-08',from:'2026-08-01',to:'2026-08-31'}).map(r=>r.id)).toEqual(['aug']);
  expect(filterRows(rows,kind,{...emptyFilters,to:'2026-08-31'}).map(r=>r.id)).toEqual(['aug']);
  expect(filterRows(rows,kind,clearDateSelection({...emptyFilters,period:'2026-08',from:'2026-08-01',to:'2026-08-31'}))).toEqual(rows);
 });
 it('filters Piloting by Assign month and restores undated rows on reset',()=>{
  const rows=[row({'Tanggal Assign to AT':'2026-08-31T23:59:59'},'aug'),row({'Tanggal Assign to AT':'2026-09-01'},'sep'),row({},'blank')];
  expect(filterPiloting(rows,{...initialFilters,period:'2026-08'}).map(r=>r.id)).toEqual(['aug']);expect(filterPiloting(rows,{...initialFilters,to:'2026-08-31'}).map(r=>r.id)).toEqual(['aug']);expect(filterPiloting(rows,{...initialFilters})).toEqual(rows);
 });
 it('clears the full date selection while preserving other active filters',()=>{
  expect(clearDateSelection({...emptyFilters,period:'2026-08',from:'2026-08-01',to:'2026-08-31',search:'company',status:'Done'})).toEqual({...emptyFilters,search:'company',status:'Done'});
 });
 it('uses the same Corporate request date for the report period',()=>{
  const context=reportContext([row({submitDate:'2026-08-31'})],'corporate',[]);expect(context.presentationPeriod).toContain('31 Aug 2026');
 });
 it('rejects invalid dates only while a date filter is active',()=>{
  expect(matchesDateSelection('2026-02-30',{...emptyFilters,period:'2026-02'})).toBe(false);expect(matchesDateSelection(null,emptyFilters)).toBe(true);
 });
});
