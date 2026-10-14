import {type DatasetKind,type Payload} from '../types';
import {isoDate} from './work-calendar';
type DateSelection={period:string;from:string;to:string};

/** Request period is independent of the dates used to calculate SLA. */
export function requestDate(payload:Payload,kind:DatasetKind):string {
 const candidates=kind==='corporate'?[payload.createDate,payload.submitDate,payload.assignDate]:[payload[kind==='ijr'?'Request Date':'salesDate']];
 return candidates.map(isoDate).find(Boolean)||'';
}
export function matchesDateSelection(value:unknown,selection:DateSelection):boolean {
 if(!selection.period&&!selection.from&&!selection.to)return true;
 const day=isoDate(value);
 return !!day&&(!selection.period||day.startsWith(selection.period))&&(!selection.from||day>=selection.from)&&(!selection.to||day<=selection.to);
}
/** A monthly selection also owns its generated date bounds. Clear it as one filter. */
export function clearDateSelection<T extends DateSelection>(selection:T):T {
 return {...selection,period:'',from:'',to:''};
}
