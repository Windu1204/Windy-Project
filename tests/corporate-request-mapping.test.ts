import {describe,it,expect} from 'vitest';
import {corporateProductPayload,corporateService} from '../src/domain/corporate-products';
import {normalize} from '../src/domain/imports';
import {calculateSla} from '../src/domain/sla';
import {pilotSla} from '../src/piloting/sla';
import {exportedRows} from '../src/lib/exports';

describe('approved Corporate Non Piloting request mapping',()=>{
 const base={projectType:'Maintenance',assignDate:'2026-08-14',doneDate:'2026-08-18'};
 it.each(['Penambahan_Rekening,','Perubahan User','Perubahan No. Telp','Maintenance User','Perubahan limit','Pendaftaran Mobile Token','Hard Token','Ubah_Admin_1,','Ubah Pejabat','Ubah_User,','Hapus_Rekening,','Hapus User','Perubahan Data KPA','Perubahan Bendahara','Perubahan Email','Perubahan PPK','Payroll','Penggantian nomor telepon','Reset Administrator','Penghapusan pengguna','Penggajian','Token_Rusak,','Baterai Habis'])('maps request meaning %s to BNIdirect',requestType=>{
  const p={...base,requestType};expect(corporateService(p)).toBe('BNIdirect');expect(corporateProductPayload(p).product).toBe('BNIdirect');expect(calculateSla(p,'corporate')).toMatchObject({solution:'BNIdirect',target:2,real:1});
 });
 it.each([
  ['Maintenance VA Debet','Penambahan rekening dan user BNIdirect','VA Debit berkartu'],
  ['Other / IMP01','Penggantian kartu VA Kredit dan perubahan email','VA Kredit berkartu'],
  ['BNIDirect Baru','Pengajuan BNIdirect dan VA Debit / Kredit','VA Debit/Kredit berkartu'],
  ['Maintenance VA','VA Debit dan VA Kredit','VA Debit/Kredit berkartu'],
  ['Maintenance','Tambah user portal VA eCollection','VA eCollection (Portal)'],
  ['Maintenance','Penambahan rekening VA non SNAP','Virtual Account Non SNAP (Integrasi)'],
  ['Maintenance VA','Migrasi SNAP','Virtual Account SNAP'],
  ['Maintenance','Upload VA melalui RPA','Virtual Account (upload iCons/RPA)'],
 ])('classifies %s / %s as its VA service',(formType,requestType,expected)=>{
  const p=corporateProductPayload({...base,formType,requestType});expect(p.product).toBe(expected);expect(calculateSla(p,'corporate').target).not.toBeNull();
 });
 it('uses the same product in future uploads, current rows and exports without changing source data',()=>{
  const raw={...base,requestType:'Penambahan_Rekening,'};const current=corporateProductPayload(raw),[incoming]=normalize([raw],'corporate');expect(raw).not.toHaveProperty('product');expect(current.product).toBe(incoming.product);const record={id:'x',payload:current,sla:calculateSla(current,'corporate')};expect(JSON.stringify(exportedRows([record]))).toContain('BNIdirect');
 });
 it('keeps generic VA/API unresolved and preserves explicitly named products and custom targets',()=>{
  for(const p of [{...base,formType:'Maintenance VA',requestType:'Ubah User'},{...base,product:'Virtual Account',requestType:'Penambahan rekening'},{...base,product:'API',requestType:'Ubah user API'}])expect(calculateSla(p,'corporate').target).toBeNull();
  const named={...base,product:'OGP',requestType:'Penambahan rekening'};expect(corporateProductPayload(named)).toBe(named);expect(calculateSla(named,'corporate').solution).toBe('OGP');expect(calculateSla({...base,requestType:'Ubah User',slaTarget:9,slaSolution:'Custom'},'corporate').target).toBe(9);
 });
 it('does not extend these request rules to Piloting, IJR or Regional',()=>{
  expect(pilotSla({'Jenis Produk / Solusi':'Other','Jenis Formulir':'Maintenance','Jenis Permintaan':'Ubah user','Hari Penyelesaian (SLA, hari kerja)':1,Kategori:'Done'}).target).toBeNull();
  expect(calculateSla({...base,requestType:'Ubah user'},'regional').target).toBeNull();expect(calculateSla({'Application Type':'Maintenance','Total Day TBS':1},'ijr')).toMatchObject({target:2,real:1});
 });
});
