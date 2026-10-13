import {expect,it} from 'vitest';
import {auditPiloting,joinDiscrepancy} from '../src/piloting/imports';
import {identity,mergeUpload} from '../src/domain/data-identity';
import {complianceMetrics} from '../src/piloting/compliance';
import {pilotReportModel} from '../src/piloting/reports';
import {reportCharts,productChartPanels} from '../src/piloting/report-charts';
import {field} from '../src/piloting/model';
import {type Payload,type MonitoringRecord} from '../src/types';
const job:Payload={'No. Register':'R-1','Nama Perusahaan':'Example','PIC AT':'A','Jenis Produk / Solusi':'BNIDirect','Jenis Formulir':'Baru, New Pipeline','Tanggal Assign to AT':'2026-08-03','Kategori':'Done','Status Discrepancy':'Discrepancy','Pemenuhan Discrepancy':'TIDAK ADA'};
const row=(payload:Payload):MonitoringRecord=>({id:identity('piloting',payload),payload,sla:{target:2,real:1,status:'Within SLA',over:null,solution:null}});
it('keeps distinct AT assignment cycles and updates the same cycle without duplication',()=>{
 const next={...job,[field.assigned]:'2026-08-26'};expect(auditPiloting([job,next]).errors).toEqual([]);
 const first=mergeUpload('piloting',[],[job,next]);expect(first.rows).toHaveLength(2);
 const updated=mergeUpload('piloting',first.rows,[{...job,'Pemenuhan Discrepancy':'SUDAH TERPENUHI'}]);expect(updated.rows).toHaveLength(2);expect(updated.updated).toBe(1);
 expect(complianceMetrics(updated.rows.map(row))).toMatchObject({exceptions:2,fulfilled:1,unfulfilled:1,rate:50});
 const reversed=mergeUpload('piloting',updated.rows,[job]);expect(complianceMetrics(reversed.rows.map(row)).fulfilled).toBe(0);
});
it('reads discrepancy PS/PM headers and fulfillment changes by register',()=>{
 const joined=joinDiscrepancy([job],[{'Trace No':'R-1','PS':'Sales A','PM':'Manager A','Deskripsi / Alasan Discrepancy':'Missing form','Pemenuhan':'SUDAH TERPENUHI (5 Agustus 2026)'}]);
 expect(joined[0]).toMatchObject({'PIC PS':'Sales A','PM':'Manager A','Alasan Discrepancy':'Missing form'});expect(complianceMetrics(joined.map(row)).rate).toBe(100);
 expect(complianceMetrics(joinDiscrepancy(joined,[{'Trace No':'R-1','Pemenuhan':''}]).map(row)).rate).toBe(0);
});
it('reports overdue, N/M totals, one product chart, overall mix and monthly compliance',()=>{
 const rows=[row(job),row({...job,[field.id]:'R-2','Jenis Formulir':'Maintenance, Form','Status Discrepancy':'Tidak Discrepancy'})];rows[0].sla.status='Overdue';
 const model=pilotReportModel(rows,'',['summary','products','highlights']);expect(model.pages[0].rows).toContainEqual(['Overdue','1']);
 const products=model.pages.find(p=>p.title==='Overview Produk')!;expect(products.headers).toEqual(['Produk','N','M','Total']);expect(products.rows.at(-1)).toEqual(['Grand Total','1','1','2']);
 const charts=reportCharts('Overview Produk',rows);expect(charts).toHaveLength(3);expect(productChartPanels(charts[0])).toHaveLength(1);expect(charts[1].items).toEqual([['New',1],['Maintenance',1]]);
 const takeaways=model.pages.find(p=>p.title==='Key Takeaways')!.rows;expect(takeaways[2][1]).toContain('2026-08: 50.0%');expect(takeaways[5][1]).toContain('SLA Achievement');
});
