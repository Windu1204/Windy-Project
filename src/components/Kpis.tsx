import { Files, CheckCircle2, Clock3, AlertCircle, ArrowUpRight, BarChart3 } from 'lucide-react';
import { type DatasetKind, type MonitoringRecord, text } from '../types';
import { metrics, counts, status } from '../domain/analytics';
const icons = [Files, CheckCircle2, ArrowUpRight, Clock3, AlertCircle, BarChart3];
export function Kpis({ rows, kind, sla = false, view = 'overview', onSelect }: {
    rows: MonitoringRecord[];
    kind: DatasetKind;
    sla?: boolean;
    view?: string;
    onSelect?: (value: string, isSla: boolean) => void;
}) {
    const m = metrics(rows, kind);
    let cards: [
        string,
        string | number,
        string,
        string
    ][] = sla ? [
        ['SLA Achievement', m.achievement.toFixed(1) + '%', 'Within SLA / Measurable', ''], ['Overdue', m.overdue, 'SLA real > target', 'Overdue'], ['Within SLA', m.within, 'SLA real ≤ target', 'Within SLA'], ['Without SLA', m.without, 'Belum memiliki target berlaku', 'Without SLA'], ['Avg SLA Real', m.average.toFixed(1) + ' d', 'Rata-rata record measurable', ''], kind === 'corporate' ? ['Avg Overdue', (m.overdue ? rows.filter(r => r.sla.status === 'Overdue').reduce((sum, r) => sum + (r.sla.over || 0), 0) / m.overdue : 0).toFixed(1) + ' d', 'Rata-rata hari di atas target', ''] : ['SLA Real Unavailable', m.unavailable, 'Target ada, real belum tersedia', 'SLA Real Unavailable']
    ] : [['Total Records', m.total, 'Record sesuai filter aktif', ''], ...(kind === 'ijr' ? [['Proses Selesai', 'Proses Selesai'], ['Dalam Proses', 'Dalam Proses'], ['Waiting Status', '__waiting__'], ['Need Amendment', 'Need Amandment']] : kind === 'regional' ? [['Done', 'Done'], ['In Progress', 'In progress'], ['Pending Doc', 'Pending doc'], ['Reject', 'Reject']] : [['Done', 'Done'], ['Handover', 'Handover'], ['On Progress', 'On Progress'], ['Pending Task', 'Pending Task'], ['Retur', 'Retur']]).map(([label, key]): [
            string,
            number,
            string,
            string
        ] => { const n = rows.filter(r => key === '__waiting__' ? String(r.payload.Status || '').startsWith('Waiting') : status(r, kind) === key).length; return [label, n, `${m.total ? Math.round(n / m.total * 100) : 0}% dari total records`, key]; }), ...(kind === 'corporate' ? [['Overdue', m.overdue, 'SLA real > target', 'Overdue'] as [
                string,
                number,
                string,
                string
            ]] : [])];
    const distinct = (field: string) => new Set(rows.map(r => text(r.payload[field])).filter(Boolean)).size;
    const card = (label: string, n: number, hint: string): [string, number, string, string] => [label, n, hint, ''];
    if (!sla && kind === 'ijr' && view === 'regional') cards = [card('Wilayah', distinct('Wilayah'), 'Jumlah wilayah pada filter aktif'), card('Cabang', distinct('Cabang'), 'Jumlah cabang pada filter aktif'), card('Unit Pembuka', distinct('Unit Pembuka'), 'Jumlah unit pembuka pada filter aktif'), card('Records', m.total, 'Record sesuai filter aktif'), card('Completed', m.done, 'Status = Proses Selesai')];
    if (!sla && kind === 'ijr' && view === 'people') cards = [card('CS BNI Direct', distinct('CS BNI Direct'), 'Jumlah PIC CS BNI Direct'), card('Implementor 1', distinct('Implementor 1'), 'Jumlah nama Implementor 1'), card('Implementor 2', distinct('Implementor 2'), 'Jumlah nama Implementor 2'), card('Records', m.total, 'Record sesuai filter aktif'), card('Completed', m.done, 'Status = Proses Selesai')];
    if (!sla && kind === 'regional' && ['status', 'regional', 'people'].includes(view)) {
        const done = card('Done', m.done, 'Status = Done'), progress = card('In Progress', rows.filter(r => r.payload.status === 'In progress').length, 'Status = In progress'), pending = card('Pending Doc', rows.filter(r => r.payload.status === 'Pending doc').length, 'Status = Pending doc');
        cards = view === 'status' ? [done, progress, pending, card('Reject', rows.filter(r => r.payload.status === 'Reject').length, 'Status = Reject'), card('Email Sales Date', rows.filter(r => text(r.payload.salesDate)).length, 'Record dengan milestone Email Sales valid')] : [card(view === 'regional' ? 'Wilayah' : 'Implementor', distinct(view === 'regional' ? 'region' : 'implementor'), 'Jumlah pada filter aktif'), done, progress, pending, card('Records', m.total, 'Record sesuai filter aktif')];
    }
    return <div className={sla ? "kpis sla-kpis" : "kpis"}>{cards.map(([label, n, hint, filter], i) => { const Icon = icons[i % icons.length]; return <button key={label} className={'kpi tone-' + i % 6} disabled={!filter || !onSelect} onClick={() => onSelect?.(filter, sla || (kind === 'corporate' && filter === 'Overdue'))}><Icon size={19}/><small>{label}</small><strong>{typeof n === 'number' ? kind === 'corporate' && sla ? String(n) : n.toLocaleString() : n}</strong><span>{hint}</span></button>; })}</div>;
}
