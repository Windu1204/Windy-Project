import { type MonitoringRecord } from '../types';
import { field, value } from './model';
export function requestType(row:MonitoringRecord):'N'|'M'|'—'{const form=value(row,field.form);return /^maintenance/i.test(form)?'M':/^baru|^new(?!.*no new)/i.test(form)?'N':'—';}
/** Every source row stays in one monthly bucket, including missing dates/types. */
export function monthlyOverview(rows:MonitoringRecord[],key:string){
 const month=(r:MonitoringRecord)=>/^\d{4}-\d{2}-\d{2}$/.test(value(r,field.assigned))?value(r,field.assigned).slice(0,7):'Tanpa tanggal';
 const months=[...new Set(rows.map(month))].sort(),types:('M'|'N'|'—')[]=rows.some(r=>requestType(r)==='—')?['M','N','—']:['M','N'];
 const names=[...new Set(rows.map(r=>value(r,key)||'—'))].sort();
 return {months,types,total:rows.length,pages:Array.from({length:Math.ceil(months.length/4)},(_,i)=>{const ms=months.slice(i*4,i*4+4),headers=[key===field.group?'Segmen':'Produk',...ms.flatMap(m=>types.map(t=>m+' '+t)),'Overall Total'];const table=names.map(name=>{const scoped=rows.filter(r=>(value(r,key)||'—')===name);return [name,...ms.flatMap(m=>types.map(t=>String(scoped.filter(r=>month(r)===m&&requestType(r)===t).length))),String(scoped.filter(r=>ms.includes(month(r))).length)];});table.push(['Grand Total',...ms.flatMap(m=>types.map(t=>String(rows.filter(r=>month(r)===m&&requestType(r)===t).length))),String(rows.filter(r=>ms.includes(month(r))).length)]);return {headers,rows:table};})};
}
