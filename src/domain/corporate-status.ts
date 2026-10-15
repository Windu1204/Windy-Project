import {type Payload,text} from '../types';
import {isoDate} from './work-calendar';

/** Corporate Non Piloting only: rejected work remains rejected; other work follows milestones. */
export function corporateStatus(payload:Payload):'Reject/Retur'|'Done'|'On Progress'|'Pending Task' {
 if(/reject|retur|return/i.test(text(payload.status)))return 'Reject/Retur';
 if(isoDate(payload.doneDate))return 'Done';
 if(isoDate(payload.progressDate))return 'On Progress';
 // An assignment without progress is pending. Missing/invalid dates never imply completion.
 return 'Pending Task';
}
export function corporateStatusPayload(payload:Payload):Payload {
 const status=corporateStatus(payload);
 return payload.status===status?payload:{...payload,status};
}
