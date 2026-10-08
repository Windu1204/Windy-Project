import { describe, it, expect } from 'vitest';
import { calculateSla } from '../src/domain/sla';
import { pilotSla } from '../src/piloting/sla';
import { slaIssue } from '../src/domain/sla-diagnostics';
import { type Payload, type MonitoringRecord } from '../src/types';

describe('SLA aliases and explicit reasons',()=>{
 it('recognizes exact spelling variants without editing payload or inventing duration',()=>{
  for(const product of ['VA ECOLL','VA Ecoll','VA Ecolletion','API Notif']){
   const payload:Payload={product,type:'Maintenance'},snapshot=JSON.stringify(payload),sla=calculateSla(payload,'regional');
   expect(sla.target).toBe(5);expect(sla.real).toBeNull();expect(JSON.stringify(payload)).toBe(snapshot);
  }
 });
 it('does not guess general API or VA services',()=>{
  for(const product of ['VA','API','API SNAP Transfer Credit','Autodebet'])expect(calculateSla({product,type:'New'},'regional').target).toBeNull();
 });
 it('recognizes a completed eCollection spelling while keeping existing mappings',()=>{
  const payload={'Jenis Produk / Solusi':'VA eCollection','Jenis Formulir':'Maintenance','Kategori':'Done','Tanggal Assign to AT':'2026-08-03','Hari Penyelesaian (SLA, hari kerja)':4};
  expect(pilotSla(payload).status).toBe('Within SLA');expect(pilotSla(payload).target).toBe(5);
  expect(pilotSla({...payload,Kategori:'Pending'}).real).toBeNull();
 });
 it('distinguishes missing Regional start, end, inverted dates and policy exclusion',()=>{
  const row=(p:Payload):MonitoringRecord=>({id:'test',payload:p,sla:calculateSla(p,'regional')});
  const base={product:'BNIDirect',type:'Maintenance',status:'Done'};
  expect(slaIssue(row(base),'regional')?.reason).toContain('Dokumen Lengkap');
  expect(slaIssue(row({...base,docComplete:'2026-10-01'}),'regional')?.reason).toContain('Tanggal Done');
  expect(slaIssue(row({...base,docComplete:'2026-10-02',doneDate:'2026-10-01'}),'regional')?.reason).toContain('Urutan');
  expect(slaIssue(row({...base,docComplete:'2025-07-01',doneDate:'2025-07-02'}),'regional')?.reason).toContain('kebijakan');
 });
});
