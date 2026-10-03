import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { type Payload, type MonitoringRecord } from '../src/types';
import { auditPiloting } from '../src/piloting/imports';
import { pilotMetrics, filterPiloting, initialFilters, people, duration, field } from '../src/piloting/model';
import { pilotReportModel, reportSections } from '../src/piloting/reports';
const source=JSON.parse(readFileSync('private/seed/piloting.json','utf8')) as Payload[];
const rows:MonitoringRecord[]=source.map((payload,i)=>({id:String(i),payload,sla:{target:null,real:null,status:'Without SLA',over:null,solution:null}}));
describe('Corporate Piloting source and reporting',()=>{
 it('reconciles unique source status totals and treats discrepancy as a subset',()=>{expect(new Set(source.map(r=>r[field.id])).size).toBe(257);const m=pilotMetrics(rows);expect(m).toMatchObject({total:257,done:238,returned:15,pending:4,discrepancy:7,measurable:238});expect(m.done+m.returned+m.pending).toBe(m.total);expect(['Same Day','1 Hari','2 Hari','>2 Hari'].map(b=>rows.filter(r=>duration(r)===b).length)).toEqual([151,41,19,27]);expect(rows.filter(r=>duration(r)==='Unavailable')).toHaveLength(19);expect(auditPiloting(source).errors).toEqual([]);});
 it('keeps source values, zero duration, blanks and validates duplicate/invalid imports',()=>{expect(auditPiloting(source).rows).toEqual(source);expect(auditPiloting([...source,source[0]]).errors.some(e=>e.includes('duplicate'))).toBe(true);expect(auditPiloting([{...source[0],[field.assigned]:'2026-02-30'}]).errors.some(e=>e.includes('invalid'))).toBe(true);expect(auditPiloting([{...source[0],[field.days]:''}]).rows[0][field.days]).toBe('');});
 it('scopes dates to assignment and shares exact metrics for every report/person',()=>{const august=filterPiloting(rows,{...initialFilters,from:'2026-08-01',to:'2026-08-31'});expect(august).toHaveLength(257);expect(august.some(r=>String(r.payload[field.completed]).startsWith('2026-09'))).toBe(true);for(const p of ['',...people(rows).map(p=>p.name)]){const model=pilotReportModel(rows,p,Object.keys(reportSections)),expected=pilotMetrics(p?rows.filter(r=>r.payload[field.person]===p):rows);expect(model.m).toEqual(expected);expect(model.pages.find(p=>p.title==='Executive Summary')?.rows[0][1]).toBe(String(expected.total));expect(model.pages.filter(p=>p.title==='Rincian Discrepancy')).toHaveLength(expected.discrepancy);}});
});
