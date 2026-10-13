import { describe, expect, it } from 'vitest';
import { ijrSections } from '../src/domain/report-renderers/ijr-complete.js';
import type { Payload } from '../src/types';
const rows: Payload[]=[
 {'Status':'Proses Selesai','Application Type':'New Request','Flow Process':'Permohonan Disetujui','Request Date':'2026-09-15',_TBSDayNum:0,_CabangDayNum:20,Wilayah:'W01'},
 {'Status':'Registered, Delivered','Application Type':'Maintenance BNI Direct','Flow Process':'Sales','Request Date':'2026-09-16',_TBSDayNum:3,Wilayah:'W02'},
 {'Status':'Dibatalkan','Application Type':'New Request','Flow Process':'Permohonan Dibatalkan','Request Date':'2026-09-16',_TBSDayNum:1,Wilayah:'W01'},
];
const context=(data=rows,selected=['Executive Summary','Status Breakdown','Process & Duration','Wilayah & Cabang','SLA Performance','Key Takeaways'])=>({rows:data,dataset:rows,person:'All Name',selected,presentationPeriod:'All Period'});
describe('IJR report reconciliation',()=>{
 it('includes every status and process without treating cancelled as active',()=>{const s=ijrSections(context());for(const title of ['Status Permohonan','Tahapan Proses','Komposisi New / Maintenance'])expect(s.find(v=>v.title===title)!.data.reduce((n,r)=>n+Number(r[1]),0)).toBe(3);expect(s.find(v=>v.title==='Status Permohonan')!.data.map(r=>r[0])).toContain('Dibatalkan');});
 it('uses TBS rather than branch duration including a valid zero',()=>{const data=ijrSections(context()).find(v=>v.title==='Kinerja SLA TBS')!.data;expect(data).toContainEqual(['Dapat dihitung SLA',3]);expect(data).toContainEqual(['Sesuai SLA',2]);expect(data).toContainEqual(['Lewat SLA',1]);});
 it('uses only scoped rows and selected report sections',()=>{const s=ijrSections(context(rows.slice(0,1),['Status Breakdown']));expect(s).toHaveLength(2);expect(s[0].data).toEqual([['Proses Selesai',1,'100.0%']]);});
 it('accounts for missing category fields and reconciles region totals',()=>{const s=ijrSections(context([...rows,{}]));expect(s.find(v=>v.title==='Tahapan Proses')!.data).toContainEqual(['Belum tersedia',1]);expect(s.find(v=>v.title==='Overview Implementasi per Wilayah')!.data.at(-1)).toEqual(['Grand Total',2,1,1,4]);});
});
