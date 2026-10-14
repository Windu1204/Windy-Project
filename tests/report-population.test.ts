import {describe,it,expect} from 'vitest';
import {requestCategory,requestCategoryLabel,availableCategory} from '../src/domain/request-category';
import {regionMonthlyOverview} from '../src/domain/report-renderers/region-overview.js';
import {requestType} from '../src/piloting/report-overview';
import {reportCharts} from '../src/piloting/report-charts';
import {field} from '../src/piloting/model';
import {calculateSla} from '../src/domain/sla';
import type {Payload,MonitoringRecord} from '../src/types';
describe('report populations include incomplete source rows',()=>{
 it('never classifies empty or unrecognised source values as New',()=>{
  expect(['New Request','New Project','Baru','Maintenance BNI Direct','M','',null,'Other','New (No New)'].map(requestCategory)).toEqual(['N','N','N','M','M','U','U','U','U']);
  expect(requestCategoryLabel(null)).toBe('Belum diklasifikasikan');expect(availableCategory('0',true)).toBe('Belum tersedia');
 });
 it('reconciles every monthly and region total including missing dates and types',()=>{
  const rows:Payload[]=[{region:'W01',type:'New',month:'2026-08'},{region:'W01',type:'Maintenance',month:null},{region:null,type:null,month:null},{region:'0',type:'Other',month:'2026-08'}];
  const result=regionMonthlyOverview(rows,{region:r=>availableCategory(r.region,true),type:r=>requestCategory(r.type),month:r=>String(r.month||'')});
  expect(result.types).toEqual(['N','M','U']);expect(result.months).toContain('Tanpa tanggal');expect(result.names).toContain('Belum tersedia');
  expect(result.pages.reduce((n,p)=>n+Number(p.rows.at(-1)!.at(-1)),0)).toBe(rows.length);
  for(const page of result.pages){const total=page.rows.at(-1)!;expect(total.slice(1,-1).reduce<number>((n,v)=>n+Number(v),0)).toBe(Number(total.at(-1)));}
 });
 it('includes unknown Piloting categories in overall composition without changing SLA results',()=>{
  const rows:MonitoringRecord[]=['New','Maintenance',''].map((form,i)=>({id:String(i),payload:{[field.form]:form,[field.product]:'Example'},sla:calculateSla({},'corporate')}));
  expect(rows.map(requestType)).toEqual(['N','M','—']);
  const chart=reportCharts('Overview Produk',rows).find(c=>c.kind==='composition')!;
  expect(chart.items.reduce((n,r)=>n+r[1],0)).toBe(3);expect(chart.items).toContainEqual(['Belum diklasifikasikan',1]);
  expect(calculateSla({'Application Type':'New Request',_TBSDayNum:0,'Request Date':'2026-08-01'},'ijr').real).toBe(0);
 });
});
