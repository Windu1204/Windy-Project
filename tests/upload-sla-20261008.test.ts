import {describe,it,expect} from 'vitest';
import {workingDays,jakartaToday} from '../src/domain/work-calendar';
import {calculateSla} from '../src/domain/sla';
import {mergeUpload} from '../src/domain/data-identity';
import {pilotSla} from '../src/piloting/sla';
import {reportCharts} from '../src/piloting/report-charts';
import {pilotReportModel} from '../src/piloting/reports';
describe('approved SLA and repeated uploads',()=>{
 it('excludes start, weekends, national holidays and collective leave',()=>{
  expect(workingDays('2026-08-14','2026-08-18')).toBe(1);
  expect(workingDays('2026-03-17','2026-03-25')).toBe(1);
  expect(workingDays('2025-08-15','2025-08-19')).toBe(1);
  expect(workingDays('2026-10-08','2026-10-08')).toBe(0);
  expect(workingDays('2026-10-09','2026-10-08')).toBeNull();
  expect(workingDays('2027-01-01','2027-01-05')).toBeNull();
  expect(jakartaToday(new Date('2026-10-07T18:00:00Z'))).toBe('2026-10-08');
 });
 it('uses IJR TBS duration, not branch or total duration',()=>{
  expect(calculateSla({'Request Date':'2026-10-01','Application Type':'Maintenance','Total Day':9,'Total Day TBS':1},'ijr').real).toBe(1);
  expect(calculateSla({'Request Date':'2026-10-01','Application Type':'Maintenance','Total Day':9},'ijr').real).toBeNull();
 });
 it('Regional final SLA requires Done date, not setting milestone',()=>{
  const p={product:'BNIDirect',type:'Maintenance',docComplete:'2026-08-14',settingDone:'2026-08-14',status:'In progress'};
  expect(calculateSla(p,'regional').real).toBeNull();
  expect(calculateSla({...p,status:'Done'},'regional').real).toBeNull();
  expect(calculateSla({...p,status:'Done',doneDate:'2026-08-18'},'regional').real).toBe(1);
 });
 it('Corporate uses Assign to Done; AT keeps source duration and rejects outside SLA',()=>{
  expect(calculateSla({product:'BNIDirect',projectType:'Maintenance',assignDate:'2026-08-14',doneDate:'2026-08-18',slaReal:99},'corporate').real).toBe(1);
  const p={'Jenis Produk / Solusi':'BNIDirect','Jenis Formulir':'Maintenance','Tanggal Assign to AT':'2026-08-14','Hari Penyelesaian (SLA, hari kerja)':2,Kategori:'Done'};
  expect(pilotSla(p).real).toBe(2);expect(pilotSla({...p,Kategori:'Reject/Retur'}).real).toBeNull();
 });
 it('re-reads same identity and updates status, preserves omitted milestones and old unrelated jobs',()=>{
  const p={noreg:'A',company:'A',product:'BNIDirect',assignDate:'2026-08-14',status:'On Progress'};
  const other={...p,noreg:'B'};
  const result=mergeUpload('corporate',[p,other],[{...p,status:'Done',assignDate:null,doneDate:'2026-08-18',_sourceRow:9}]);
  expect(result).toMatchObject({newRows:0,updated:1,unchanged:0});expect(result.rows).toHaveLength(2);
  expect(result.rows[0]).toMatchObject({assignDate:'2026-08-14',doneDate:'2026-08-18',status:'Done'});
  expect(mergeUpload('corporate',result.rows,[{...result.rows[0],_sourceRow:300}])).toMatchObject({unchanged:1,updated:0});
 });
});
it('AT product/segment charts include all categories with N/M consistent and close includes rejects',()=>{
 const rows=Array.from({length:20},(_,i)=>{const payload={'No. Register':String(i),'PIC AT':'AT','PIC PS':'PS','PM':'PM','PIC Sales':'Sales','Nama Perusahaan':'Company','Kelompok':'Segmen '+i,'Jenis Produk / Solusi':'Produk '+i,'Jenis Formulir':i%2?'Maintenance':'New',Kategori:i===0?'Reject/Retur':'Done','Status Discrepancy':'Discrepancy'};return {id:String(i),payload,sla:pilotSla(payload)};});
 const charts=reportCharts('Overview Produk',rows);expect(charts).toHaveLength(1);expect(charts[0].items).toHaveLength(20);expect(charts[0].series?.map(s=>s.name)).toEqual(['N','M']);
 const report=pilotReportModel(rows,'',['discrepancy','highlights']);expect(report.pages[0].headers).toContain('PIC PS');expect(report.pages[0].headers).toContain('PM');expect(report.pages[1].rows[0][1]).toContain('20 dari 20');expect(report.pages[1].rows[0][1]).toContain('SLA Achievement');
});
