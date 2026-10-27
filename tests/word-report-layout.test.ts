import {describe,it,expect} from 'vitest';
import * as docx from 'docx';
import JSZip from 'jszip';
import {reportContext,reportModel} from '../src/domain/report-model';
import {calculateSla} from '../src/domain/sla';
import {createWordDocument,wordColumnWidths} from '../src/domain/report-renderers/word-document';
import {exportMonitoringWord} from '../src/domain/report-renderers/word-report.js';
const logo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWQAAAABJRU5ErkJggg==';
const context={brandLogo:logo,presentationPeriod:'Agustus 2026',person:'All Name'};

describe('shared Word report layout',()=>{
 it('separates empty Regional work types and hides missing-region rows without changing totals',async()=>{
  let blob:Blob|undefined;
  const source=[{product:'API OGP',region:'W01',type:'New',status:'Done',docComplete:'2026-09-07',doneDate:'2026-09-09',salesDate:'2026-09-01'},{product:'API OGP',region:'W01',type:'New',status:'Done',salesDate:'2026-09-01'},{product:'API OGP',region:'',type:'',salesDate:'2026-09-01'}];
  const rows=source.map((payload,i)=>({id:String(i),payload,sla:calculateSla(payload,'regional')}));
  const ctx={...reportContext(rows,'regional',['Product & Sub Product','Wilayah']),...context,docx,saveFile:(value:Blob)=>{blob=value;}};
  await exportMonitoringWord(ctx,'regional',reportModel(rows,'regional'),'Regional Head Office');
  const zip=await JSZip.loadAsync(await blob!.arrayBuffer()),body=await zip.file('word/document.xml')!.async('string');
  expect(body).toContain('Jenis pekerjaan belum diisi');expect(body).not.toContain('Belum diklasifikasikan');expect(body).not.toContain('>Belum tersedia<');expect(body).toContain('>2.0<');
 });
 it('allocates more space to long descriptions than count columns and keeps the table inside the page',()=>{
  const widths=wordColumnWidths({title:'Overview',headers:['Produk','N','M','Total'],rows:[['Virtual Account eCollection Portal dengan deskripsi panjang',1,2,3]]});
  expect(widths[0]).toBeGreaterThan(widths[1]*3);
  expect(widths.reduce((sum,n)=>sum+n,0)).toBe(10466);
 });
 it('uses consistent month subcolumns with room for product names',()=>{
  const widths=wordColumnWidths({title:'Monthly',headers:['Produk','N','M','N','M','Total'],rows:[],months:['2026-01','2026-02'],types:['N','M']});
  expect(widths[0]).toBeGreaterThan(widths[1]);expect(new Set(widths.slice(1,-1)).size).toBe(1);
 });
 it('puts the logo on the left and report date on the right on cover and body pages',async()=>{
  const doc=createWordDocument(docx,context,'Corporate - Non Piloting',[{title:'Overview Produk',headers:['Produk','Jumlah'],rows:[['VA eCollection Portal',7]]}]);
  const zip=await JSZip.loadAsync(await docx.Packer.toBuffer(doc));
  const headers=Object.keys(zip.files).filter(name=>/^word\/header\d+\.xml$/.test(name));expect(headers).toHaveLength(2);
  for(const name of headers){const xml=await zip.file(name)!.async('string');expect(xml).toContain('Tanggal report:');expect(xml).toContain('w:val="left"');expect(xml).toContain('w:val="right"');expect(xml.indexOf('<w:drawing>')).toBeLessThan(xml.indexOf('Tanggal report:'));}
  const body=await zip.file('word/document.xml')!.async('string');expect(body).toContain('w:type="fixed"');expect(body).toContain('w:tblHeader');
 });
 it('labels monthly product and segment tables according to their actual dimension',async()=>{
  let blob:Blob|undefined;
  const payload={product:'VA Portal',segment:'COB1',projectType:'New',createDate:'2026-08-01'};
  const rows=[{id:'one',payload,sla:calculateSla(payload,'corporate')}];
  const ctx={...reportContext(rows,'corporate',['Product & Sub Product','Overview per Segmen']),...context,docx,saveFile:(value:Blob)=>{blob=value;}};
  const model=reportModel(rows,'corporate');
  await exportMonitoringWord(ctx,'corporate',model,'Corporate - Non Piloting');
  const zip=await JSZip.loadAsync(await blob!.arrayBuffer());const body=await zip.file('word/document.xml')!.async('string');
  expect(body).not.toContain('>Wilayah<');expect(body).toContain('>Produk<');expect(body).toContain('>Segmen<');
  expect(body).toContain('Agustus 2026');expect(body).toContain('w:gridSpan w:val="2"');
 });
});
