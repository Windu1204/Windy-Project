import {it,expect} from 'vitest';
import {normalize,auditRows} from '../src/domain/imports';
import {completionDates,handoverDate} from '../src/domain/completion-dates';
import {calculateSla} from '../src/domain/sla';
import {detailFields} from '../src/domain/display';
for(const kind of ['ijr','regional'] as const){
 it(kind+' reads actual Done/Handover aliases and leaves absent dates empty',()=>{
  const p=normalize([{'TGL_DONE':'02/11/2026','Tanggal HANDOVER':'3 November 2026'}],kind)[0];
  expect(p.doneDate).toBe('2026-11-02');expect(p.handoverDate).toBe('2026-11-03');
  expect(completionDates({'Done Date':'2026-11-02'}).handoverDate).toBeNull();
  expect(completionDates(p)).toEqual(p);
  expect(handoverDate({...p,dashboardHandoverAt:'2026-11-04T01:00:00Z'})).toBe('2026-11-04T01:00:00Z');
  const row={id:'a',payload:p,sla:calculateSla(p,kind)};
  expect(detailFields(row,kind)).toContainEqual(['Tanggal Done','2026-11-02']);
  expect(detailFields(row,kind)).toContainEqual(['Tanggal Handover','2026-11-03']);
 });
}
it('does not infer handover from Done or alter IJR SLA source duration',()=>{
 const payload={'Application Number':'A',Status:'Done','Request Date':'2026-11-01','Application Type':'New Request',_TBSDayNum:4,'Tanggal Done':'2026-11-02'};
 const normalized=normalize([payload],'ijr')[0];expect(calculateSla(normalized,'ijr')).toEqual(calculateSla(payload,'ijr'));expect(normalized.handoverDate).toBeNull();
 expect(auditRows([{...payload,'Tanggal Handover':'31/02/2026'}],'ijr').invalidDates).toBe(1);
});
