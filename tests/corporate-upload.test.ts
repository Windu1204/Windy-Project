import {describe,it,expect} from 'vitest';
import * as XLSX from 'xlsx';
import {readUpload} from '../src/domain/upload-audit';
import {auditRows,normalize} from '../src/domain/imports';
import {mergeUpload} from '../src/domain/data-identity';
import {calculateSla} from '../src/domain/sla';
import {pilotSla} from '../src/piloting/sla';
import {exportedRows} from '../src/lib/exports';
import {detailFields} from '../src/domain/display';
import {slaIssue} from '../src/domain/sla-diagnostics';
import {corporateService} from '../src/domain/corporate-products';
import {statusGroup} from '../src/domain/analytics';
import {reportStatus} from '../src/domain/report-status';

async function upload(rows:unknown[][]){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Data');return readUpload(new File([XLSX.write(wb,{type:'array',bookType:'xlsx'})],'corporate.xlsx'),'corporate');}
const source={ 'No. Register':'JOB-A','Nama Perusahaan':'Company','Jenis Formulir':'Maintenance Autodebet','Jenis Permintaan':'Maintenance','Current Stage':'Transactions Active','Tanggal Assign':'2026-08-14 09:00:00','Tanggal Progress':'2026-08-14 10:00:00','Tanggal Done':'2026-08-18 12:00:00','Tanggal Submit':'2026-08-14 08:00:00','Kelompok':'COB','Keterangan SIL':'Work notes'};
describe('Corporate Non Piloting complete source upload',()=>{
 it('keeps waiting for transaction activation out of completed dashboard and report counts',()=>{
  const payload={status:'Waiting Transactions Active'};
  expect(statusGroup(String(payload.status))).toBe('On Progress');
  expect(reportStatus({id:'1',payload,sla:calculateSla(payload,'corporate')},'corporate')).toBe('On Progress');
  expect(statusGroup('Transactions Active')).toBe('Done');
 });
 it('adapts existing fields while retaining raw values, without adding visible detail fields',()=>{
  const a=auditRows([source],'corporate');expect(a.revisions).toHaveLength(0);const p=a.rows[0];
  expect(p).toMatchObject({noreg:'JOB-A',company:'Company',formType:'Maintenance Autodebet',projectType:'Maintenance',product:'BNIdirect',status:'Transactions Active',submitDate:'2026-08-14',assignDate:'2026-08-14',progressDate:'2026-08-14',doneDate:'2026-08-18',segment:'COB',remarks:'Work notes'});
  expect(calculateSla(p,'corporate')).toMatchObject({real:1,target:2,status:'Within SLA'});
  const fields=detailFields({id:'1',payload:p,sla:calculateSla(p,'corporate')},'corporate').map(([label])=>label);
  expect(fields).not.toContain('Current Stage');expect(fields.some(f=>f.startsWith('_corporate'))).toBe(false);expect(p.createDate).toBeNull();expect(p).not.toHaveProperty('Current Stage');expect(Object.keys(exportedRows([{id:'1',payload:p,sla:calculateSla(p,'corporate')}])[0]).some(k=>k.startsWith('_'))).toBe(false);
 });
 it('keeps incomplete and invalid-date jobs; an invalid Done never becomes zero days',()=>{
  const a=auditRows([{...source,'No. Register':null,'Tanggal Done':'0000-00-00'},{company:'Other'}],'corporate');
  expect(a.rows).toHaveLength(2);expect(a.revisions).toHaveLength(0);expect(a.rows[0].noreg).toBeNull();
  expect(a.rows[0]._corporateIdentity).toMatch(/^unregistered:/);expect(calculateSla(a.rows[0],'corporate').real).toBeNull();
  expect(slaIssue({id:'1',payload:a.rows[0],sla:calculateSla(a.rows[0],'corporate')},'corporate')?.reason).toContain('Tanggal Done');
 });
 it('reads reordered columns and records all nonblank jobs, including an absent register',async()=>{
  const a=await upload([['Tanggal Done','Current Stage','No. Register','Nama Perusahaan','Jenis Formulir','Tanggal Assign'],['0000-00-00','Project Assignment',null,'Company','Maintenance','2026-08-14'],[null,null,null,null,null,null],['2026-08-18','Transactions Active','B','Other','Maintenance Autodebet','2026-08-14']]);
  expect(a.source).toBe(3);expect(a.rows).toHaveLength(2);expect(a.issues).toHaveLength(1);expect(a.issues[0].reason).toBe('Baris kosong');
 });
 it('reconciles different progress versions by timestamps, independent of row order',async()=>{
  const headers=['No. Register','Nama Perusahaan','Jenis Produk','Status','Tanggal Assign','Tanggal Progress','Tanggal Done'];
  const old=['A','Company','Autodebet','On Progress','2026-08-14','2026-08-14',null];
  const done=['A','Company','Autodebet','Done','2026-08-14','2026-08-14','2026-08-18'];
  for(const versions of [[old,done],[done,old]]){const a=await upload([headers,...versions]);expect(a.source).toBe(2);expect(a.rows).toHaveLength(2);expect(a.issues).toHaveLength(0);expect(a.duplicates).toBe(1);const merged=mergeUpload('corporate',[],a.rows);expect(merged.rows).toHaveLength(1);expect(merged.rows[0].status).toBe('Done');expect(JSON.parse(String(merged.rows[0]._corporateVersions))).toHaveLength(2);}
 });
 it('updates a saved job, does not duplicate it, and does not regress to an older upload',async()=>{
  const headers=['No Register','Company','Produk','Status','Assign Date','Done Date'];
  const old=await upload([headers,['A','Company','Autodebet','On Progress','2026-08-14',null]]);
  const done=await upload([headers,['A','Company','Autodebet','Done','2026-08-14','2026-08-18']]);
  const changed=mergeUpload('corporate',old.rows,done.rows);expect(changed).toMatchObject({updated:1,newRows:0});expect(changed.rows).toHaveLength(1);
  expect(calculateSla(changed.rows[0],'corporate').real).toBe(1);
  expect(mergeUpload('corporate',changed.rows,old.rows)).toMatchObject({updated:0,unchanged:1});
  expect(mergeUpload('corporate',changed.rows,done.rows)).toMatchObject({updated:0,unchanged:1});
 });
 it('keeps competing versions without guessing Done if no date distinguishes them',async()=>{
  const a=await upload([['No Register','Company','Produk','Status'],['A','Company','BNIdirect','Done'],['A','Company','BNIdirect','On Progress']]);
  expect(a.rows).toHaveLength(2);expect(a.rows[0]._corporateConflict).toBeTruthy();expect(a.rows[0].status).toBeNull();
  expect(calculateSla(a.rows[0],'corporate').real).toBeNull();
 });
 it('keeps unregistered identity stable across status changes',()=>{
  const [old,next]=normalize([{...source,'No. Register':null,'Tanggal Done':null},{...source,'No. Register':null}],'corporate');
  expect(old._corporateIdentity).toBe(next._corporateIdentity);const initial=mergeUpload('corporate',[],[old]).rows;expect(mergeUpload('corporate',initial,[next]).rows).toHaveLength(1);
 });
 it('does not collapse independent rows when a unique register is absent',async()=>{
  const a=await upload([['No Register','Company','Produk','Status'],[null,'Same company','BNIdirect','On Progress'],[null,'Same company','BNIdirect','On Progress']]);
  expect(a.rows).toHaveLength(2);expect(new Set(a.rows.map(r=>r._corporateIdentity)).size).toBe(2);
  expect(mergeUpload('corporate',[],a.rows).rows).toHaveLength(2);
 });
 it('keeps an inferred VA service measurable after normalization and repeated uploads',()=>{
  const [p]=normalize([{...source,'Jenis Formulir':'Maintenance VA Debet','Jenis Permintaan':'VA Debet'}],'corporate');
  expect(p.product).toBe('VA Debit berkartu');expect(calculateSla(p,'corporate')).toMatchObject({solution:'VA Debit berkartu',target:14,real:1});
 });
});
describe('Corporate Non Piloting existing SLA product mapping',()=>{
 it.each([['Autodebet','BNIdirect',2],['Autocollection','OGP',5],['Integrasi ERP','BNIdirect-GFX',5]])('routes %s to %s using existing Maintenance target',(product,solution,target)=>{
  expect(calculateSla({product,projectType:'Maintenance',assignDate:'2026-08-14',doneDate:'2026-08-18'},'corporate')).toMatchObject({solution,target,real:1});
 });
 it.each([['Virtual Account','VA Debit','VA Debit berkartu'],['Virtual Account','Non SNAP integrasi VA','Virtual Account Non SNAP (Integrasi)'],['Virtual Account','SNAP VA','Virtual Account SNAP'],['Virtual Account','VAM Portal','VA eCollection (Portal)'],['Virtual Account','Upload VA melalui RPA','Virtual Account (upload iCons/RPA)'],['Application Programming Interface (API)','Integrasi API RDN','API RDN'],['Application Programming Interface (API)','API SNAP','OGP SNAP']])('uses explicit description to resolve %s / %s',(product,description,solution)=>{
  const p={product,description,projectType:'Maintenance',assignDate:'2026-08-14',doneDate:'2026-08-18'};expect(corporateService(p)).toBe(solution);expect(calculateSla(p,'corporate').solution).toBe(solution);expect(calculateSla(p,'corporate').target).not.toBeNull();
 });
 it('does not guess generic or conflicting services, or treat API as VA automatically',()=>{
  for(const p of [{product:'Virtual Account',description:'Implementasi layanan'},{product:'Application Programming Interface (API)',description:'Whitelist IP'},{product:'Virtual Account',description:'VA Debit dan VA Kredit'}])expect(calculateSla(p,'corporate').target).toBeNull();
 });
 it('keeps existing SLA arithmetic and AT alias behavior unchanged',()=>{
  const p={product:'BNIdirect',projectType:'Maintenance',assignDate:'2026-08-14',doneDate:'2026-08-18'};
  expect(calculateSla(p,'corporate')).toMatchObject({target:2,real:1});
  const pilot={'Jenis Produk / Solusi':'Autodebet','Jenis Formulir':'Maintenance','Tanggal Assign to AT':'2026-08-14','Hari Penyelesaian (SLA, hari kerja)':1,Kategori:'Done'};
  expect(pilotSla(pilot).target).toBeNull();
  expect(calculateSla({...p,product:'Virtual Account',slaTarget:9,slaSolution:'Configured service'},'corporate')).toMatchObject({target:9,solution:'Configured service',real:1});
 });
});
