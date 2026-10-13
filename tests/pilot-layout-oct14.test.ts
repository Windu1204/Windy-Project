import {expect,it} from 'vitest';
import {corporateProductFallback} from '../src/domain/product-fallback';
import {memoSemanticMatch} from '../src/domain/memo';
import {pilotReportModel} from '../src/piloting/reports';
import {reportCharts} from '../src/piloting/report-charts';
import {field} from '../src/piloting/model';
import {type MonitoringRecord} from '../src/types';
const row=(days:number|null):MonitoringRecord=>({id:'1',payload:{[field.product]:'VAM',[field.status]:'Done',[field.days]:days,[field.form]:'New'},sla:{real:days,target:7,status:'Within SLA',over:null,solution:null}});
it('preserves original VA eColl while supporting the specified aliases',()=>{
 expect(corporateProductFallback('VAM')).toBe('VA eColl Portal');expect(corporateProductFallback('VA VAM')).toBe('VA eColl Portal');expect(corporateProductFallback('API SNAP')).toBe('OGP SNAP');expect(corporateProductFallback('VA Ecoll')).toBe('VA Ecoll');
 expect(memoSemanticMatch({product:'VA VAM',formType:'New'},[])?.solution).toMatch(/e.*coll/i);
});
it('omits unavailable duration only when zero and shares scoped product populations',()=>{
 const rows=[row(1)];const p=pilotReportModel(rows,'',['process']).pages[0];expect(p.rows.some(r=>r[0]==='Durasi belum tersedia')).toBe(false);
 expect(pilotReportModel([row(null)],'',['process']).pages[0].rows).toContainEqual(['Durasi belum tersedia','1']);
 expect(reportCharts('Proses Implementasi',rows)[1].items.some(r=>r[0]==='Belum tersedia')).toBe(false);
 const charts=reportCharts('Overview Produk',rows);expect(charts[0].kind).toBe('vertical');expect(charts[0].items).toEqual([['VA eColl Portal',1]]);expect(charts[1].kind).toBe('composition');expect(charts[2].title).toBe('Top 5 Produk');expect(rows[0].payload[field.product]).toBe('VAM');
});
