import { type MonitoringRecord, type DatasetKind, text } from '../types';
import { fields } from './analytics';
import {corporateStatus} from './corporate-status';
export function reportStatus(r: MonitoringRecord, kind: DatasetKind) { if(kind==='corporate'){const value=corporateStatus(r.payload);return value==='Pending Task'?'Pending':value==='Reject/Retur'?'Retur':value;}const s = text(r.payload[fields[kind].status]).toLowerCase(); if (/handover/.test(s))
    return 'Handover'; if (/retur|return|reject/.test(s))
    return 'Retur'; if (/done|complete|selesai|closed|delivered/.test(s))
    return 'Done'; if (kind === 'ijr') {
    if (/pending|waiting|approval|submitted|submited|amandment|amendment/.test(s))
        return 'Pending';
    return 'On Progress';
} return /pending|waiting|approval|document|doc/.test(s) ? 'Pending' : 'On Progress'; }
