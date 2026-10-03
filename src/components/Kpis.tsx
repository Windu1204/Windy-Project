import { Files, CheckCircle2, Clock3, AlertCircle, ArrowUpRight, BarChart3 } from 'lucide-react';
import { type DatasetKind, type MonitoringRecord } from '../types';
import { metrics, counts, status } from '../domain/analytics';
const icons = [Files, CheckCircle2, ArrowUpRight, Clock3, AlertCircle, BarChart3];
export function Kpis({ rows, kind, sla = false, onSelect }: {
    rows: MonitoringRecord[];
    kind: DatasetKind;
    sla?: boolean;
    onSelect?: (value: string, isSla: boolean) => void;
}) {
    const m = metrics(rows, kind);
    const cards: [
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
    return <div className={sla ? "kpis sla-kpis" : "kpis"}>{cards.map(([label, n, hint, filter], i) => { const Icon = icons[i % icons.length]; return <button key={label} className={'kpi tone-' + i % 6} disabled={!filter || !onSelect} onClick={() => onSelect?.(filter, sla || (kind === 'corporate' && filter === 'Overdue'))}><Icon size={19}/><small>{label}</small><strong>{typeof n === 'number' ? n.toLocaleString() : n}</strong><span>{hint}</span></button>; })}</div>;
}
