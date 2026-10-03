import {it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {pilotSla,slaMetrics,pendingAge} from '../src/piloting/sla';
import {field,filterPiloting,initialFilters} from '../src/piloting/model';
import {productCategory} from '../src/domain/analytics';
import {type Payload,type MonitoringRecord} from '../src/types';
const hasSource=existsSync('private/seed/piloting.json');
const source=hasSource?JSON.parse(readFileSync('private/seed/piloting.json','utf8')) as Payload[]:[];
const row=(payload:Payload):MonitoringRecord=>({id:'x',payload,sla:pilotSla(payload)});
it('uses corporate targets with original Piloting duration and correctly recognizes No New Pipeline as maintenance',()=>{
 const p={...source.find(p=>p[field.product]==='BNIdirect'&&String(p[field.form]).startsWith('Maintenance'))!,[field.product]:'BNIdirect',[field.form]:'Maintenance, Form, No New Pipeline',[field.status]:'Done',[field.days]:2},before=JSON.stringify(p);
 expect(pilotSla(p)).toMatchObject({target:2,real:2,status:'Within SLA'});expect(pilotSla({...p,[field.days]:3})).toMatchObject({target:2,status:'Overdue',over:1});expect(pilotSla({...p,[field.form]:'Baru, New Pipeline'})).toMatchObject({target:3});expect(pilotSla({...p,[field.days]:null})).toMatchObject({real:null,status:'SLA Real Unavailable'});expect(pilotSla({...p,[field.days]:0})).toMatchObject({real:0,status:'Within SLA'});expect(JSON.stringify(p)).toBe(before);
});
it('excludes pending/return from completed achievement, unknown products remain unmeasured and custom rules are shared',()=>{
 const p={...source[0],[field.status]:'Done',[field.product]:'Unmapped Test',[field.form]:'Maintenance',[field.days]:4,'Jenis Permintaan':'test','Catatan (TL AT / AT)':''};
 expect(pilotSla(p).target).toBeNull();expect(pilotSla(p,[{product:'Unmapped Test',name:'Test',aliases:'',newDays:7,maintDays:3}])).toMatchObject({target:3,real:4,status:'Overdue'});
 const pending={...p,[field.product]:'BNIdirect',[field.status]:'Masih Pending',[field.assigned]:'2026-08-03'};
 expect(pilotSla(pending)).toMatchObject({target:2,real:null,status:'SLA Real Unavailable'});expect(pendingAge(row(pending),'2026-08-03')).toBe(0);expect(pendingAge(row(pending),'2026-08-10')).toBe(5);
 if(!hasSource)return;
 const rows=source.map(row),m=slaMetrics(rows);expect(m.within+m.overdue).toBe(m.measured);expect(m.measured+m.unavailable).toBe(238);expect(rows.filter(r=>r.payload[field.status]!=='Done').every(r=>!['Within SLA','Overdue'].includes(r.sla.status))).toBe(true);
});
it.skipIf(!hasSource)('product categories and subproducts scope real COB groups without modifying source and independent date filters',()=>{
 const rows=source.map(row),before=JSON.stringify(source);const f={...initialFilters,category:'Virtual Account / e-Collection',product:'VA Debit'};const selected=filterPiloting(rows,f);expect(selected).toHaveLength(42);expect(selected.every(r=>productCategory(String(r.payload[field.product]),'corporate')===f.category)).toBe(true);expect(new Set(selected.map(r=>r.payload[field.group])).size).toBeGreaterThan(1);expect(filterPiloting(rows,{...f,from:'2026-08-01',to:'2026-08-31'})).toHaveLength(42);expect(JSON.stringify(source)).toBe(before);
});
