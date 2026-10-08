import { type DatasetKind, type Payload, type SlaResult, type SlaRule, text } from '../types';
import { memoSemanticMatch, regSlaTarget } from './memo';
import { workingDays, completionDate } from './work-calendar';
export function workdaysInclusive(a: string, b: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b) || b < a)
    return null; const d = new Date(a + 'T00:00:00Z'), end = new Date(b + 'T00:00:00Z'); let n = 0, guard = 0; while (d <= end && guard++ < 4000) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6)
        n++;
    d.setUTCDate(d.getUTCDate() + 1);
} return n; }
const unavailable = (solution: string | null = null): SlaResult => ({ target: null, real: null, status: 'Without SLA', over: null, solution });
export function calculateSla(p: Payload, kind: DatasetKind, rules: SlaRule[] = [], useSourceDuration = false): SlaResult {
    if (kind === 'ijr') {
        const target = /maint/i.test(text(p['Application Type'])) ? 2 : 3;
        if (text(p['Request Date']) && text(p['Request Date']) < '2025-07-14')
            return unavailable('BNIdirect');
        const raw = p._TBSDayNum ?? p['Total Day TBS'];
        const real = raw != null && text(raw) !== '' && Number.isFinite(Number(raw)) && Number(raw)>=0 ? Number(raw) : null;
        return real !== null ? { target, real, status: real > target ? 'Overdue' : 'Within SLA', over: Math.max(0, real - target), solution: 'BNIdirect' } : { target, real: null, status: 'SLA Real Unavailable', over: null, solution: 'BNIdirect' };
    }
    if (kind === 'regional') {
        const m = regSlaTarget(p);
        if (!m)
            return unavailable();
        const start = /^\d{4}-\d{2}-\d{2}$/.test(text(p.docComplete)) ? text(p.docComplete) : '';
        const policy = start || text(p.approvalDate) || text(p.salesDate);
        if (policy && policy < '2025-07-14')
            return unavailable(m.solution);
        const end = completionDate(p.doneDate,p.dashboardUpdatedAt);
        const real = /^done$/i.test(text(p.status)) && start && end ? workingDays(start, end) : null;
        return { target: m.target, real, status: real == null ? 'SLA Real Unavailable' : real > m.target ? 'Overdue' : 'Within SLA', over: real == null ? null : Math.max(0, real - m.target), solution: m.solution };
    }
    const sourceReal = useSourceDuration ? (p.slaReal != null && text(p.slaReal)!=='' && Number.isFinite(Number(p.slaReal)) && Number(p.slaReal)>=0 ? Number(p.slaReal) : null) : workingDays(p.assignDate,p.doneDate);
    const m = memoSemanticMatch(p, rules), ref = text(p.assignDate) || text(p.submitDate) || text(p.createDate) || text(p.slaPolicyDate);
    if (!m)
        return { ...unavailable(), real: sourceReal };
    if (m.map !== 'Custom SLA Setting' && ref && ref.slice(0, 10) < '2025-07-14')
        return { ...unavailable(m.solution), target: m.target, real: sourceReal, map: m.map };
    if (sourceReal == null)
        return { target: m.target, real: null, status: 'SLA Real Unavailable', over: null, solution: m.solution, map: m.map };
    const real = sourceReal;
    return { target: m.target, real, status: real > m.target ? 'Overdue' : 'Within SLA', over: Math.max(0, real - m.target), solution: m.solution, map: m.map };
}
