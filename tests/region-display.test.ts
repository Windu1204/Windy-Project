import {describe,it,expect} from 'vitest';
import {counts,isDone} from '../src/domain/analytics';
import {categoryName,blankCategory,matchesRegionMode,regionName,validRegion} from '../src/domain/region-details';
import {executiveStatusItems} from '../src/piloting/report-charts';
import {field} from '../src/piloting/model';
import {type MonitoringRecord} from '../src/types';
function row(status:string,kind='regional',overdue=false):MonitoringRecord{return {id:status,payload:kind==='ijr'?{Status:status,Wilayah:'KANTOR WILAYAH 14'}:{status,region:'W10'},sla:{status:overdue?'Overdue':'Within SLA',real:1,target:1,over:0,solution:'VA'}};}
describe('display grouping preserves records and existing definitions',()=>{
 it('includes blank chart categories without changing counts globally',()=>{const rows=[row('Done'),row(''),row('In progress')];expect(counts(rows,r=>categoryName(String(r.payload.status)))).toContainEqual([blankCategory,1]);expect(counts(rows,r=>categoryName(String(r.payload.status))).reduce((n,[,v])=>n+v,0)).toBe(3);expect(counts(rows,r=>String(r.payload.status)).reduce((n,[,v])=>n+v,0)).toBe(2);});
 it('hides Regional zero only from region charts and retains its record',()=>{const rows=[row('Done'),{...row(''),payload:{region:'0'}}];expect(rows.filter(r=>validRegion(regionName(r,'regional'),'regional'))).toHaveLength(1);expect(rows).toHaveLength(2);expect(validRegion('0','ijr')).toBe(true);});
 it('uses existing completed definitions for IJR and Regional',()=>{for(const status of ['Proses Selesai','Delivered','Registered, Delivered','Dalam Proses','Waiting for Approval']){const r=row(status,'ijr');expect(matchesRegionMode(r,'ijr','done')).toBe(isDone(r,'ijr'));}expect(matchesRegionMode(row('Done'),'regional','done')).toBe(true);});
 it('quick categories expose pending, progress, returned, other and SLA subset',()=>{expect(matchesRegionMode(row('Waiting for Onboarding','ijr'),'ijr','pending')).toBe(true);expect(matchesRegionMode(row('Pending doc'),'regional','pending')).toBe(true);expect(matchesRegionMode(row('Dalam Proses','ijr'),'ijr','progress')).toBe(true);expect(matchesRegionMode(row('Reject'),'regional','returned')).toBe(true);expect(matchesRegionMode(row(''),'regional','other')).toBe(true);const done=row('Done','regional',true);expect(matchesRegionMode(done,'regional','done')).toBe(true);expect(matchesRegionMode(done,'regional','overdue')).toBe(true);});
 it('adds Overdue to executive status bars from the existing SLA result only',()=>{const rows=[row('Done','regional',true),row('Done'),row('Reject/Retur')].map((r,i)=>({...r,id:String(i),payload:{[field.status]:i===2?'Reject/Retur':'Done'}}));const items=executiveStatusItems(rows);expect(items).toContainEqual(['Overdue',1]);expect(items).toContainEqual(['Done',2]);});
});
