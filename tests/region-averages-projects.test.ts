import { describe, expect, it } from 'vitest';
import { regionSummary, normalizeRegion, completedRegionDays } from '../src/domain/region-summary';
import { regionReportSections } from '../src/domain/report-renderers/region-report';
import { projectQueueState, selectProjectQueue, filterProjectPerson } from '../src/domain/project-queues';
import { type MonitoringRecord, type Payload } from '../src/types';
import { field } from '../src/piloting/model';
const row = (payload: Payload, real: number | null = null, target: number | null = 2): MonitoringRecord => ({id:String(payload.id||'fixture'),payload,sla:{real,target,status:real===null?'SLA Real Unavailable':real>Number(target)?'Overdue':'Within SLA',over:null,solution:null}});
describe('region duration and product matrices', () => {
  it('shows all 18 regions and normalizes their source labels', () => {
    expect(['W1','W01','KANTOR WILAYAH 18','Wilayah 2',18].map(normalizeRegion)).toEqual(['W01','W01','W18','W02','W18']);
    expect(regionSummary([], 'regional').rows.map(r=>r.name)).toEqual(Array.from({length:18},(_,i)=>'W'+String(i+1).padStart(2,'0')));
  });
  it('keeps missing-date rows in totals but calculates a weighted completed average', () => {
    const base={status:'Done',docComplete:'2026-09-07',type:'New',product:'API OGP'};
    const data:Payload[]=[{...base,region:'W1',doneDate:'2026-09-07'},{...base,region:'W01',doneDate:'2026-09-09'},{...base,region:'W02',doneDate:'2026-09-21'},{...base,region:'W02',doneDate:''}];
    const result=regionSummary(data,'regional');
    expect(result.rows[0].averageNew).toEqual({count:2,days:1});
    expect(result.rows[1].averageNew).toEqual({count:1,days:10});
    expect(result.grandTotal).toMatchObject({total:4,new:4,averageNew:{count:3,days:4}});
  });
  it('excludes weekends, holidays, unfinished work and invalid dates from completed durations', () => {
    expect(completedRegionDays({status:'Done',docComplete:'2026-08-14',doneDate:'2026-08-18'},'regional')).toBe(1);
    expect(completedRegionDays({status:'In progress',docComplete:'2026-09-07',doneDate:'2026-09-09'},'regional')).toBeNull();
    expect(completedRegionDays({status:'Done',docComplete:'2026-09-09',doneDate:'2026-09-07'},'regional')).toBeNull();
    expect(completedRegionDays({Status:'Proses Selesai',_TBSDayNum:0,_TotalDayNum:99},'ijr')).toBe(0);
  });
  it('keeps product counts, missing regions and unclassified rows balanced without assuming New', () => {
    const data:Payload[]=[{region:'W1',product:'API OGP',type:'New'},{region:'W1',product:'VA Debit',type:'Maintenance'},{region:null,product:'BNIdirect',type:''}];
    const result=regionSummary(data,'regional');
    expect(result.matrices.map(m=>m.grandTotal.total)).toEqual([1,1,1]);
    expect(result.matrices[0].products).toEqual(['API','BNIdirect','VA']);
    for(const m of result.matrices)expect(m.grandTotal.counts.reduce((a,b)=>a+b,0)).toBe(m.grandTotal.total);
    expect(result.rows.find(r=>r.name==='Belum tersedia')?.unclassified).toBe(1);
    expect(result.grandTotal.total).toBe(3);
  });
  it('makes New and Maintenance separate report tables with Average Days after Total', () => {
    const sections=regionReportSections([{region:'W01',type:'New',product:'API OGP'},{region:'W02',type:'Maintenance',product:'VA Debit'}],'regional');
    expect(sections.map(s=>s.title)).toEqual(['Implementasi Wilayah New','Implementasi Wilayah Maintenance']);
    expect(sections[0].headers.slice(-2)).toEqual(['Total New','Average Days N']);
    expect(sections[1].headers.slice(-2)).toEqual(['Total Maintenance','Average Days M']);
    expect(sections.every(s=>s.rows.length===19)).toBe(true);
    expect(sections[0].rows.at(-1)?.at(-2)).toBe(1);
  });
  it('treats report placeholder products exactly like the original empty source field', () => {
    const raw=[{region:'W01',type:'New',product:''}];
    const normalized=[{...raw[0],product:'Belum tersedia'}];
    expect(regionSummary(normalized,'regional')).toEqual(regionSummary(raw,'regional'));
  });
});
describe('open project queues preserve completed SLA calculations', () => {
  it('filters either IJR implementor without duplicating requests or matching partial names', () => {
    const data=[row({id:'one','Implementor 1':'Ann','Implementor 2':'Bea'}),row({id:'two','Implementor 1':'Anna','Implementor 2':'Anna'})];
    expect(filterProjectPerson(data,'ijr','ANN').map(r=>r.id)).toEqual(['one']);
    expect(filterProjectPerson(data,'ijr','Bea').map(r=>r.id)).toEqual(['one']);
    expect(filterProjectPerson(data,'ijr','Anna')).toHaveLength(1);
    expect(filterProjectPerson(data,'ijr','')).toHaveLength(2);
  });
  it('uses each source PIC field without widening the supplied access scope', () => {
    const data=[row({id:'a',implementor:'A',[field.person]:'Pilot A'}),row({id:'b',implementor:'B',[field.person]:'Pilot B'})];
    expect(filterProjectPerson(data,'corporate','B').map(r=>r.id)).toEqual(['b']);
    expect(filterProjectPerson(data,'regional','A').map(r=>r.id)).toEqual(['a']);
    expect(filterProjectPerson(data,'piloting','Pilot A').map(r=>r.id)).toEqual(['a']);
    expect(filterProjectPerson(data.slice(0,1),'regional','B')).toEqual([]);
  });
  it('includes pending work without dates but excludes completed, rejected and cancelled work', () => {
    const data=['Pending doc','In progress','Done','Reject','Dibatalkan','Handover'].map((status,i)=>row({id:i,status}));
    expect(selectProjectQueue(data,'regional',false,'2026-09-09')).toHaveLength(2);
    expect(selectProjectQueue(data,'regional',true,'2026-09-09')).toHaveLength(0);
  });
  it('detects overdue open work using the existing SLA start and target, without changing the result', () => {
    const r=row({status:'In progress',docComplete:'2026-09-07'},null,1),before=structuredClone(r);
    expect(projectQueueState(r,'regional','2026-09-09')).toEqual({open:true,overdue:true,age:2,target:1});
    expect(r).toEqual(before);
    expect(projectQueueState(row({status:'Pending',docComplete:'2026-09-07'},null,null),'regional','2026-09-09').overdue).toBe(false);
  });
  it('uses IJR TBS time and Corporate assignment time, and rejects future starts', () => {
    expect(projectQueueState(row({Status:'Dalam Proses','Request Date':'2026-01-01'},0,3),'ijr','2026-09-09').overdue).toBe(false);
    expect(projectQueueState(row({status:'Pending Task',assignDate:'2026-09-07'},null,1),'corporate','2026-09-09').overdue).toBe(true);
    expect(projectQueueState(row({status:'Pending Task',assignDate:'2026-09-10'},null,1),'corporate','2026-09-09').overdue).toBe(false);
    expect(projectQueueState(row({status:'Reject/Retur',assignDate:'2026-09-07'},null,1),'corporate','2026-09-09').open).toBe(false);
  });
  it('recognizes Piloting pending work while excluding returned and completed requests', () => {
    const pending=row({[field.status]:'Masih Pending',[field.assigned]:'2026-09-07'},null,1);
    expect(projectQueueState(pending,'piloting','2026-09-09').overdue).toBe(true);
    for(const state of ['Done','Reject/Retur'])expect(projectQueueState(row({[field.status]:state}),'piloting').open).toBe(false);
  });
});
