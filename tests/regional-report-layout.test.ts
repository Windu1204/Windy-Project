import {describe,it,expect} from 'vitest';
import {regionMonthlyOverview,regionMonthHeaderRows,regionProductOverview} from '../src/domain/report-renderers/region-overview.js';
import {categoryOverview} from '../src/domain/report-renderers/report-population.js';
import {regionReportSections} from '../src/domain/report-renderers/region-report';
import type {Payload} from '../src/types';
const accessors={region:(r:Payload)=>String(r.region),type:(r:Payload)=>String(r.type),month:(r:Payload)=>String(r.month)};
describe('Regional monthly report layout',()=>{
 it('hides the missing-region display row without dropping it from totals',()=>{
   const rows=[{region:'W01',type:'New',product:'API OGP'},{region:'Belum tersedia',type:'New',product:'API OGP'}];
   const sections=regionReportSections(rows,'regional');expect(sections[0].rows).toHaveLength(19);expect(sections[0].rows.some(r=>r[0]==='Belum tersedia')).toBe(false);expect(sections[0].rows.at(-1)?.at(-2)).toBe(2);expect(sections[0].note).not.toContain('wilayah kosong');
   const monthly=regionMonthlyOverview(rows,{region:r=>String(r.region),type:()=> 'N',month:()=> '2026-09',hideMissingRegion:true});expect(monthly.names).toEqual(['W01']);expect(monthly.pages[0].rows.at(-1)?.at(-1)).toBe(2);
 });
 it('puts empty request types in a separate product recap while retaining every monthly total',()=>{
   const tables:any[][][]=[],slides:string[]=[];const ppt={addSlide:()=>({addTable:(data:any)=>tables.push(data),addText:()=>{}})};
   categoryOverview(ppt,[{region:'API',type:'N',month:'2026-09'},{region:'API',type:'U',month:'2026-09'}],{title:'Products',label:'Produk',key:r=>String(r.region),...accessors,addHeader:(_s:any,title:string)=>slides.push(title),colors:{muted:'666666'},separateUnclassified:true});
   expect(slides).toContain('Jenis pekerjaan belum diisi');expect(tables[0][1].map((c:any)=>c.text)).toEqual(['N','M']);expect(tables[0].at(-1)).toEqual(['Grand Total',1,0,2]);expect(tables[1].at(-1)).toEqual(['Grand Total',1]);
 });
 it('shows valid completed averages in the IJR PPT, including zero, without discarding incomplete jobs',()=>{
   const tables:any[][][]=[],ppt={addSlide:()=>({addTable:(data:any)=>tables.push(data),addText:()=>{}})};
   regionProductOverview(ppt,[{Status:'Proses Selesai',Wilayah:'W01','Application Type':'New Request',_TBSDayNum:0},{Status:'Registered, Delivered',Wilayah:'W01','Application Type':'New Request',_TBSDayNum:2},{Status:'Waiting for Approval',Wilayah:'W01','Application Type':'New Request',_TBSDayNum:0}],{kind:'ijr',addHeader:()=>{},colors:{muted:'666666'}});
   expect(tables[0][1]).toEqual(['W01',3,3,'1.0']);expect(tables[0].at(-1)).toEqual(['Grand Total',3,3,'1.0']);
 });
 it('balances four months across two pages while keeping all regions and totals',()=>{
   const rows:Payload[]=Array.from({length:4},(_,i)=>({region:i%2?'W02':'W01',type:i%2?'M':'N',month:`2026-0${i+6}`}));
   const result=regionMonthlyOverview(rows,accessors);
   expect(result.pages.map(p=>p.months.length)).toEqual([2,2]);
   expect(result.pages.flatMap(p=>p.months)).toEqual(result.months);
   expect(result.pages.reduce((n,p)=>n+Number(p.rows.at(-1)!.at(-1)),0)).toBe(rows.length);
   for(const page of result.pages)expect(page.rows.slice(0,-1).map(r=>r[0])).toEqual(['W01','W02']);
 });
 it('groups each month once over its New and Maintenance columns',()=>{
   const headers=regionMonthHeaderRows(['2026-06','2026-07']);
   expect(headers[0].filter(c=>c.options?.colspan===2)).toHaveLength(2);
   expect(headers[1].map(c=>c.text)).toEqual(['N','M','N','M']);
 });
 it('does not discard months for a long period or invent pages for empty data',()=>{
   const rows:Payload[]=Array.from({length:10},(_,i)=>({region:'W01',type:'N',month:`2026-${String(i+1).padStart(2,'0')}`}));
   const result=regionMonthlyOverview(rows,accessors);
   expect(result.pages.map(p=>p.months.length)).toEqual([3,3,2,2]);
   expect(new Set(result.pages.flatMap(p=>p.months)).size).toBe(10);
   expect(regionMonthlyOverview([],accessors).pages).toEqual([]);
 });
});
