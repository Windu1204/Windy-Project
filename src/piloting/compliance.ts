import { type MonitoringRecord } from '../types';
import { field, value } from './model';
export function isDiscrepancy(row:MonitoringRecord){return value(row,field.discrepancy)==='Discrepancy';}
export function fulfillment(row:MonitoringRecord):'fulfilled'|'unfulfilled'{
 const text=value(row,'Pemenuhan Discrepancy').trim();
 return /^(sudah\s+terpenuhi|terpenuhi|dipenuhi|fulfilled|complete(?:d)?|done)(?:\b|$)/i.test(text)?'fulfilled':'unfulfilled';
}
export function complianceMetrics(rows:MonitoringRecord[]){
 const cases=rows.filter(isDiscrepancy),fulfilled=cases.filter(r=>fulfillment(r)==='fulfilled').length,unfulfilled=cases.length-fulfilled;
 return {total:rows.length,exceptions:cases.length,fulfilled,unfulfilled,rate:rows.length?100*(1-unfulfilled/rows.length):null};
}
