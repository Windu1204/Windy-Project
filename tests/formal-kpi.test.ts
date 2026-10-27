import { describe, it, expect } from 'vitest';
import { kpiTarget, kpiNumber, kpiProgress, formatKpi, type KpiIndicator } from '../src/domain/formal-kpi';
const percent:KpiIndicator={key:'sla',perspective:'Process',section:'',label:'SLA',weight:.1,unit:'%',nature:'Higher is Better',details:[]};
describe('formal KPI target and actual semantics',()=>{
 it('preserves zero and blank as distinct values, accepts Indonesian decimals',()=>{
  expect(kpiNumber('0')).toBe(0);expect(kpiNumber('16,84')).toBe(16.84);expect(kpiNumber('16.84')).toBe(16.84);expect(kpiNumber('')).toBeNull();expect(kpiNumber('1.000,5')).toBeNull();expect(kpiNumber('abc')).toBeNull();
  expect(kpiProgress(percent,'≥95%',null).label).toBe('Belum diinput');expect(kpiProgress(percent,'≥95%',0).label).toBe('Belum tercapai');
 });
 it('evaluates thresholds at their boundary using percentage point inputs',()=>{
  expect(kpiTarget(' ≥ 95% ','%')).toEqual({value:95,operator:'≥',percent:true});
  expect(kpiProgress(percent,'≥95%',95).label).toBe('Target tercapai');expect(kpiProgress(percent,'≥95%',94.99).label).toBe('Belum tercapai');
  expect(kpiProgress(percent,'>95%',95).label).toBe('Belum tercapai');expect(kpiProgress(percent,'≤5%',5).label).toBe('Target tercapai');
 });
 it('does not invent a special score, a ratio with zero denominator, or missing targets',()=>{
  expect(kpiProgress({...percent,unit:'Special Scoring'},'3',3).ratio).toBeNull();
  expect(kpiProgress({...percent,unit:'Special Scoring'},'3',3).label).toBe('Menunggu aturan skor');
  expect(kpiProgress(percent,'0',0).ratio).toBeNull();expect(kpiProgress(percent,'',3).label).toBe('Target belum diisi');
 });
 it('honors precise targets and explicit inequality and displays percent values consistently',()=>{
  expect(kpiProgress({...percent,nature:'Precise is Better'},'100%',99).label).toBe('Belum tercapai');
  expect(kpiProgress({...percent,nature:'Precise is Better'},'≥95%',96).label).toBe('Target tercapai');
  expect(formatKpi(95,'%')).toBe('95%');expect(formatKpi(null,'%')).toBe('—');
 });
});
