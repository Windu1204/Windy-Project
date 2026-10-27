import {describe,it,expect} from 'vitest';
import {kpiReport,kpiReportRows,kpiReportName} from '../src/domain/kpi-report';
import {type KpiSnapshot} from '../src/domain/formal-kpi';
import {kpiExcel} from '../src/lib/kpi-report-excel';
import JSZip from 'jszip';
const fixture:KpiSnapshot={templates:[{code:'a',group_code:'piloting',title:'AT',indicators:[{key:'sla',perspective:'Process',section:'',label:'SLA',weight:1,unit:'%',nature:'Higher is Better',details:[]}]},{code:'b',group_code:'corporate',title:'Corporate',indicators:[]}],people:[{id:'1',template_code:'a',name:'Person / A',npp:'00001',grade:'8',position:'AMGR',managed:'AT',aliases:[],user_id:null,leader_id:null},{id:'2',template_code:'b',name:'Hidden Person',npp:'2',grade:'',position:'',managed:'',aliases:[],user_id:null,leader_id:null}],values:[{person_id:'1',period:'2026-06-01',indicator_key:'sla',target:'≥95%',actual:0,note:'',updated_at:''},{person_id:'1',period:'2027-06-01',indicator_key:'sla',target:'secret future target',actual:100,note:'',updated_at:''},{person_id:'2',period:'2026-06-01',indicator_key:'sla',target:'hidden',actual:99,note:'',updated_at:''}]};
describe('KPI report scopes',()=>{
 it('exports only the selected authorized person and period and retains zero',()=>{const report=kpiReport(fixture,'2026-06',false,'1');expect(report.people).toHaveLength(1);expect(report.people[0].values).toHaveLength(1);expect(kpiReportRows(report.people[0],'2026-06')[0].actual).toBe('0%');expect(kpiReportName(report,'docx')).not.toContain('/');});
 it('filters by group and year without fabricating missing months',()=>{const report=kpiReport(fixture,'2026-10',true,undefined,'piloting');expect(report.people).toHaveLength(1);expect(report.people[0].values).toHaveLength(1);expect(kpiReportRows(report.people[0],'2026-01')[0].status).toBe('Belum diinput');});
 it('does not silently fall back to everyone for an unavailable selected person',()=>{expect(()=>kpiReport(fixture,'2026-06',false,'unavailable')).toThrow();});
 it('keeps identifiers as text, numbers typed, and spreadsheet-like text inert',async()=>{
  const source=structuredClone(fixture);source.people[0].name='=HYPERLINK("https://example.invalid")';source.values[0].note='& <note> '+('long note '.repeat(100));
  const report=kpiReport(source,'2026-06',false,'1');const blob=await kpiExcel(report);const zip=await JSZip.loadAsync(await blob.arrayBuffer());
  const xml=await zip.file('xl/worksheets/sheet2.xml')!.async('string');expect(xml).toContain('NPP 00001');expect(xml).toContain('<v>0</v>');expect(xml).toContain('=HYPERLINK');expect(xml).not.toContain('<f>');expect(await zip.file('xl/worksheets/sheet3.xml')!.async('string')).toContain('&amp; &lt;note&gt;');
 });
});
