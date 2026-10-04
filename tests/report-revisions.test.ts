import { describe, expect, it } from 'vitest';
import { trendData } from '../src/piloting/trend-data';
import { discrepancyPages } from '../src/piloting/report-pagination';
import { summaryCard } from '../src/domain/report-renderers/corporate-style.js';

describe('Report revision boundaries', () => {
  it('preserves percentage text rather than coercing it to NaN', () => {
    const values: unknown[] = [];
    summaryCard({addShape:()=>{},addText:(text:unknown)=>values.push(text)}, {ShapeType:{rect:'rect'}}, 0,0,4,'SLA Achievement','64.6%','008596');
    expect(values).toContain('64.6%');
    expect(values).not.toContain('NaN');
  });
  it('aggregates dense trends without losing counts', () => {
    const rows: [string,number][] = Array.from({length:365},(_,i)=>[new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),i%9+1]);
    const result=trendData(rows);
    expect(result.unit).toBe('month');
    expect(result.values).toHaveLength(12);
    expect(result.values.reduce((n,r)=>n+r[1],0)).toBe(rows.reduce((n,r)=>n+r[1],0));
  });
  it('fits long discrepancy text to slide budgets without dropping words', () => {
    const reason=Array.from({length:350},(_,i)=>`word${i}`).join(' ');
    const pages=discrepancyPages([['REG001','Company','PIC','Done',reason,'2026-08-14','TIDAK ADA'],['REG002','Company','PIC','Done','Short reason','—','—']]);
    expect(pages.length).toBeGreaterThan(1);
    for(const page of pages)expect(.44+page.heights.reduce((a,b)=>a+b,0)).toBeLessThanOrEqual(5.1);
    expect(pages.flatMap(p=>p.rows.map(r=>r[4])).join(' ').replace(/\s+/g,' ').trim()).toBe(reason+' Short reason');
  });
});
