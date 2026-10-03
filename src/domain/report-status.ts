import { type MonitoringRecord, type DatasetKind, text } from '../types';
import { fields } from './analytics';
export function reportStatus(r: MonitoringRecord, kind: DatasetKind) { const s = text(r.payload[fields[kind].status]).toLowerCase(); if (/handover/.test(s))
    return 'Handover'; if (kind === 'corporate') {
    if (/retur|return/.test(s))
        return 'Retur';
    if (/transaction|done|complete|selesai|closed/.test(s))
        return 'Done';
    if (/progress|setup|initiation|waiting transactions|active/.test(s))
        return 'On Progress';
    return 'Pending';
} if (/retur|return|reject/.test(s))
    return 'Retur'; if (/done|complete|selesai|closed/.test(s))
    return 'Done'; if (kind === 'ijr') {
    if (/pending|waiting|approval|submitted|submited|amandment|amendment/.test(s))
        return 'Pending';
    return 'On Progress';
} return /pending|waiting|approval|document|doc/.test(s) ? 'Pending' : 'On Progress'; }
