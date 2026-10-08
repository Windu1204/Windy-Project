import { type DatasetKind, type Payload, type MonitoringRecord, type Filters, text } from '../types';
import { productKey } from './display';
export const fields = {
    ijr: { company: 'Applicant Name', id: 'Application Number', date: 'Request Date', status: 'Status', type: 'Application Type', region: 'Wilayah', product: '', person: 'Implementor 1' },
    regional: { company: 'company', id: 'cid', date: 'salesDate', status: 'status', type: 'type', region: 'region', product: 'product', person: 'implementor' },
    corporate: { company: 'company', id: 'noreg', date: 'createDate', status: 'status', type: 'projectType', region: 'segment', product: 'product', person: 'implementor' },
} as const;
export function statusGroup(s: string) {
    const x = s.toLowerCase();
    if (x.includes('handover'))
        return 'Handover';
    if (/retur|retured|return/.test(x))
        return 'Retur';
    if (/transaction|done|complete/.test(x))
        return 'Done';
    if (/progress|setup|initiation|waiting transactions/.test(x))
        return 'On Progress';
    return 'Pending Task';
}
export function status(r: MonitoringRecord, kind: DatasetKind) { const s = text(r.payload[fields[kind].status]); return kind === 'corporate' ? statusGroup(s) : s; }
export function isDone(r: MonitoringRecord, kind: DatasetKind) { return kind === 'ijr' ? /^(proses selesai|delivered)$/i.test(text(r.payload.Status)) : status(r, kind) === 'Done'; }
export function isWaiting(r: MonitoringRecord, kind: DatasetKind) { return kind === 'corporate' ? status(r, kind) === 'Pending Task' : /waiting|pending|approval/i.test(text(r.payload[fields[kind].status])); }
export function productCategory(value: string, kind: DatasetKind) {
    const p = value.toUpperCase();
    if (!p)
        return '';
    if (p.includes('API'))
        return 'API';
    if (/BNIDIRECT|BNI DIRECT/.test(p))
        return 'BNIDirect';
    if (/VIRTUAL ACCOUNT|VA |^VA|E-COLLECTION/.test(p))
        return 'Virtual Account / e-Collection';
    if (/FSCM|SCF/.test(p))
        return 'FSCM';
    if (kind === 'regional' && p.includes('BTO'))
        return 'BTO';
    if (p.includes('CASH'))
        return 'Cash Management';
    if (kind === 'corporate') {
        if (/MT940|MT101|MT100/.test(p))
            return 'Messaging / Statement';
        if (p.includes('OGP'))
            return 'OGP';
        if (p.includes('BTO'))
            return 'BTO';
    }
    else {
        if (p.includes('PAYROLL'))
            return 'Payroll';
        if (/AUTODEBET|AUTO DEBET/.test(p))
            return 'Autodebet';
        if (/H2H|HOST/.test(p))
            return 'Host to Host';
    }
    return 'Other Products';
}
export function people(r: MonitoringRecord, kind: DatasetKind, allRoles = false) {
    const keys = kind === 'ijr' ? (allRoles ? ['CS BNI Direct', 'Validator 1', 'Implementor 1', 'Implementor 2'] : ['Implementor 1', 'Implementor 2']) : ['implementor'];
    return [...new Set(keys.map(k => text(r.payload[k])).filter(Boolean))];
}
export function filterRows(rows: MonitoringRecord[], kind: DatasetKind, f: Filters) {
    const k = fields[kind], q = f.search.toLowerCase().trim();
    return rows.filter(r => { const p = r.payload, d = text(p[k.date]); return (!q || Object.values(p).some(v => text(v).toLowerCase().includes(q))) && (!f.period || d.startsWith(f.period)) && (!f.from || d >= f.from) && (!f.to || d <= f.to) && (!f.status || (f.status === '__waiting__' ? text(p[k.status]).startsWith('Waiting') : status(r, kind) === f.status)) && (!f.type || text(p[k.type]) === f.type) && (!f.region || text(p[k.region]) === f.region) && (!f.category || productCategory(text(p.product), kind) === f.category) && (!f.product || (kind === 'regional' ? productKey(p.product) === productKey(f.product) : text(p.product) === f.product)) && (!f.person || people(r, kind, true).some(n => n.toLowerCase().includes(f.person.toLowerCase()))) && (!f.sla || r.sla.status === f.sla) && (!f.flow || text(p['Flow Process']) === f.flow) && (!f.branch || text(p.Cabang) === f.branch); });
}
export function counts<T>(rows: T[], get: (r: T) => string): [
    string,
    number
][] { const m = new Map<string, number>(); for (const r of rows) {
    const k = get(r);
    if (k)
        m.set(k, (m.get(k) || 0) + 1);
} return [...m].sort((a, b) => b[1] - a[1]); }
export function options(rows: MonitoringRecord[], field: string) { return [...new Set(rows.map(r => text(r.payload[field])).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
export function metrics(rows: MonitoringRecord[], kind: DatasetKind) { const within = rows.filter(r => r.sla.status === 'Within SLA').length, overdue = rows.filter(r => r.sla.status === 'Overdue').length, measurable = within + overdue; return { total: rows.length, done: rows.filter(r => isDone(r, kind)).length, waiting: rows.filter(r => isWaiting(r, kind)).length, within, overdue, measurable, achievement: measurable ? within / measurable * 100 : 0, without: rows.filter(r => r.sla.status === 'Without SLA').length, unavailable: rows.filter(r => r.sla.status === 'SLA Real Unavailable').length, average: measurable ? rows.reduce((s, r) => s + (r.sla.status === 'Within SLA' || r.sla.status === 'Overdue' ? r.sla.real || 0 : 0), 0) / measurable : 0 }; }
export function personMetrics(rows: MonitoringRecord[], kind: DatasetKind, allRoles = false) { const map = new Map<string, MonitoringRecord[]>(); for (const r of rows)
    for (const n of people(r, kind, allRoles)) {
        if (!map.has(n))
            map.set(n, []);
        map.get(n)!.push(r);
    } return [...map].map(([name, records]) => ({ name, records, ...metrics(records, kind) })).sort((a, b) => b.total - a.total); }
export function severity(rows: MonitoringRecord[]): [
    string,
    number
][] { const out: {
    [k: string]: number;
} = { '1-2 days': 0, '3-5 days': 0, '6-10 days': 0, '>10 days': 0 }; for (const r of rows) {
    const n = r.sla.over;
    if (!n)
        continue;
    out[n <= 2 ? '1-2 days' : n <= 5 ? '3-5 days' : n <= 10 ? '6-10 days' : '>10 days']++;
} return Object.entries(out); }
export function quality(rows: MonitoringRecord[], kind: DatasetKind): [string, number][] {
    if (kind === 'ijr') return [['Additional duplicate occurrences', rows.length - new Set(rows.map(r => text(r.payload['Application Number'])).filter(Boolean)).size], ['Missing / null Total Day', rows.filter(r => r.payload._TotalDayNum == null).length], ['Blank Implementor 1', rows.filter(r => !text(r.payload['Implementor 1'])).length], ['Blank Implementor 2', rows.filter(r => !text(r.payload['Implementor 2'])).length]];
    if (kind === 'regional') return [['Missing Company', rows.filter(r => !text(r.payload.company)).length], ['Missing Region', rows.filter(r => !text(r.payload.region)).length], ['Missing Product', rows.filter(r => !text(r.payload.product)).length], ['Missing Implementor', rows.filter(r => !text(r.payload.implementor)).length]];
    return [['Without SLA', rows.filter(r => r.sla.status === 'Without SLA').length], ['SLA Real Unavailable', rows.filter(r => r.sla.status === 'SLA Real Unavailable').length], ['Blank product', rows.filter(r => !text(r.payload.product)).length]];
}
export function durationBucket(value: Payload[string]) { if (value == null || !Number.isFinite(Number(value)))
    return ''; const n = Number(value); return n === 0 ? 'Same Day (0 Hari)' : n === 1 ? '1 Hari' : n === 2 ? '2 Hari' : n > 2 ? '>2 Hari' : ''; }
