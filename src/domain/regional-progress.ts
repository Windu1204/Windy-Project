import {type Payload,text} from '../types';
import {requestCategory} from './request-category';
export type RegionalAction='done'|'handover';
export interface RegionalUpdate {action:RegionalAction;companyId?:string}
export function regionalActions(payload:Payload){
 const category=requestCategory(payload.type),done=/^done$/i.test(text(payload.status));
 const handed=!!text(payload.dashboardHandoverAt)||/^handover$/i.test(text(payload.handover));
 const terminal=/reject|retur|return|dibatal|cancel/i.test(text(payload.status));
 return {isNew:category==='N',done,handed,canDone:category!=='U'&&!terminal&&!handed&&(!done||category==='N'&&!text(payload.companyId)),canHandover:category==='N'&&done&&!handed&&!!text(payload.companyId)};
}
