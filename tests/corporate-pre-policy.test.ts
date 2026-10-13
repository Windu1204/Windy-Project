import {expect,it} from 'vitest';
import {calculateSla} from '../src/domain/sla';
import {pilotSla} from '../src/piloting/sla';
import {reportModel} from '../src/domain/report-model';
it('counts historical non-piloting jobs with the same working-day and report rules',()=>{
 const payload={product:'BNIDirect',projectType:'Maintenance',assignDate:'2025-07-07',doneDate:'2025-07-09'};
 const sla=calculateSla(payload,'corporate');expect(sla).toMatchObject({target:2,real:2,status:'Within SLA'});
 const model=reportModel([{id:'1',payload,sla}],'corporate');expect(model.within).toBe(1);expect(model.rows[0].slaStatus).toBe('Within SLA');
 expect(calculateSla({...payload,doneDate:'2025-07-10'},'corporate').status).toBe('Overdue');
 expect(calculateSla({...payload,doneDate:''},'corporate').status).toBe('SLA Real Unavailable');
 expect(calculateSla({...payload,product:'Unmapped service'},'corporate').target).toBeNull();
});
it('preserves date policy for IJR, Regional and Piloting',()=>{
 expect(calculateSla({'Request Date':'2025-07-07','Total Day TBS':1},'ijr').status).toBe('Without SLA');
 expect(calculateSla({product:'BNIDirect',type:'Maintenance',status:'Done',docComplete:'2025-07-07',doneDate:'2025-07-09'},'regional').status).toBe('Without SLA');
 expect(pilotSla({'Kategori':'Done','Jenis Produk / Solusi':'BNIDirect','Jenis Formulir':'Maintenance','Tanggal Assign to AT':'2025-07-07','Hari Penyelesaian (SLA, hari kerja)':1}).status).toBe('Without SLA');
});
