import {describe,it,expect} from 'vitest';
import {regionMonthlyOverview,regionMonthHeaderRows} from '../src/domain/report-renderers/region-overview.js';
import type {Payload} from '../src/types';
const accessors={region:(r:Payload)=>String(r.region),type:(r:Payload)=>String(r.type),month:(r:Payload)=>String(r.month)};
describe('Regional monthly report layout',()=>{
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
