import {it,expect} from 'vitest';
import {monthlyOverview,requestType} from '../src/piloting/report-overview';
import {field} from '../src/piloting/model';
import {type MonitoringRecord} from '../src/types';
const row=(id:string,date:string,type:string,segment:string):MonitoringRecord=>({id,payload:{[field.assigned]:date,[field.form]:type,[field.group]:segment},sla:{status:'Without SLA',target:null,real:null,over:null,solution:null}});
it('segment monthly overview reconciles every source row without treating No New Pipeline as New',()=>{
 const rows=[row('1','2026-08-03','Maintenance, Form, No New Pipeline','COB1'),row('2','2026-08-03','Baru, New Pipeline','COB1'),row('3','','','COB2')],before=JSON.stringify(rows),model=monthlyOverview(rows,field.group);
 expect(requestType(rows[0])).toBe('M');expect(requestType(rows[1])).toBe('N');expect(requestType(rows[2])).toBe('—');expect(model.total).toBe(3);
 for(const page of model.pages){const total=page.rows.at(-1)!;expect(total[0]).toBe('Grand Total');expect(total.slice(1,-1).reduce((n,v)=>n+Number(v),0)).toBe(Number(total.at(-1)));for(let i=1;i<total.length;i++)expect(page.rows.slice(0,-1).reduce((n,r)=>n+Number(r[i]),0)).toBe(Number(total[i]));}
 expect(JSON.stringify(rows)).toBe(before);
});
