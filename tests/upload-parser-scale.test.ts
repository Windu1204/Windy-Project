import {describe,it,expect} from 'vitest';
import * as XLSX from 'xlsx';
import {readUpload} from '../src/domain/upload-audit';
import {auditPiloting,readPiloting} from '../src/piloting/imports';
describe('header-based complete upload audit',()=>{
 it('reads AT rows from every compatible sheet with their original sheet and row',async()=>{
  const wb=XLSX.utils.book_new();
  const headers=['No Register','Nama Perusahaan','PIC AT','Produk','Status Pekerjaan','Tanggal Assign to AT'];
  for(const name of ['August','September'])XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers,[name,'Company','AT','BNIDirect','Done','2026-08-03']]),name);
  const audit=await readPiloting(new File([XLSX.write(wb,{type:'array',bookType:'xlsx'})],'at.xlsx'));
  expect(audit.source).toBe(2);expect(audit.validRows).toHaveLength(2);
  expect(audit.rows.map(row=>[row._sourceSheet,row._sourceRow])).toEqual([['August',2],['September',2]]);
 });
 it('reads 100000 reordered CSV records without a positional-column assumption',async()=>{
  const lines=['Status,Produk,No Register,Company,Assign Date,Done Date'];
  for(let i=1;i<=100000;i++)lines.push(`Done,BNIDirect,R-${i},Company ${i},2026-08-14,2026-08-18`);
  const audit=await readUpload(new File([lines.join('\n')],'scale.csv'),'corporate');
  expect(audit.source).toBe(100000);expect(audit.rows).toHaveLength(100000);expect(audit.issues).toHaveLength(0);
  expect(audit.rows.at(-1)).toMatchObject({noreg:'R-100000',assignDate:'2026-08-14',doneDate:'2026-08-18',_sourceRow:100001});
 },30000);
 it('finds a late header, includes every compatible sheet, and traces blank/invalid rows',async()=>{
  const wb=XLSX.utils.book_new(),intro=Array.from({length:120},()=>['Introduction']);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([...intro,['Status','Company','No Register','Produk','Assign Date'],['Done','A','A','BNIDirect','2026-08-03'],[null,null,null,null,null],['Done','B','B','BNIDirect','2026-02-30']]),'August');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Produk','No Register','Company','Status'],['BNIDirect','C','C','On Progress']]),'September');
  const bytes=XLSX.write(wb,{type:'array',bookType:'xlsx'});
  const audit=await readUpload(new File([bytes],'mixed.xlsx'),'corporate');
  expect(audit.source).toBe(4);expect(audit.rows).toHaveLength(2);expect(audit.issues).toHaveLength(2);
  expect(audit.issues.map(x=>[x.sheet,x.sourceRow])).toEqual([['August',123],['August',124]]);
  expect(audit.issues[0].reason).toContain('kosong');expect(audit.issues[1].reason).toContain('assignDate');
 });
 it('quarantines every row in a conflicting AT identity, keeps an absent discrepancy field optional',()=>{
  const p={'No. Register':'A','Nama Perusahaan':'A','PIC AT':'AT','Kategori':'Done','Jenis Produk / Solusi':'BNIDirect','Tanggal Assign to AT':'2026-08-03'};
  expect(auditPiloting([p]).validRows).toHaveLength(1);
  const result=auditPiloting([p,{...p,Kategori:'Masih Pending'}]);expect(result.validRows).toHaveLength(0);expect(result.revisions).toHaveLength(2);expect(result.source).toBe(2);
 });
});
