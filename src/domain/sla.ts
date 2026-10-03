import { type DatasetKind, type Payload, type SlaResult, type SlaRule, text } from '../types';
import { memoSemanticMatch, regSlaTarget } from './memo';
export function workdaysInclusive(a: string, b: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b) || b < a)
    return null; const d = new Date(a + 'T00:00:00Z'), end = new Date(b + 'T00:00:00Z'); let n = 0, guard = 0; while (d <= end && guard++ < 4000) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6)
        n++;
    d.setUTCDate(d.getUTCDate() + 1);
} return n; }
const unavailable = (solution: string | null = null): SlaResult => ({ target: null, real: null, status: 'Without SLA', over: null, solution });
export function calculateSla(p: Payload, kind: DatasetKind, rules: SlaRule[] = []): SlaResult {
    if (kind === 'ijr') {
        const target = /maint/i.test(text(p['Application Type'])) ? 2 : 3;
        if (text(p['Request Date']) && text(p['Request Date']) < '2025-07-14')
            return unavailable('BNIdirect');
        // Preserve the source application's Number(null) = 0 convention for IJR.
        const real = Number(p._TotalDayNum);
        return Number.isFinite(real) ? { target, real, status: real > target ? 'Overdue' : 'Within SLA', over: Math.max(0, real - target), solution: 'BNIdirect' } : { target, real: null, status: 'SLA Real Unavailable', over: null, solution: 'BNIdirect' };
    }
    if (kind === 'regional') {
        const m = regSlaTarget(p);
        if (!m)
            return unavailable();
        const start = /^\d{4}-\d{2}-\d{2}$/.test(text(p.docComplete)) ? text(p.docComplete) : '';
        const policy = start || text(p.approvalDate) || text(p.salesDate);
        if (policy && policy < '2025-07-14')
            return unavailable(m.solution);
        const end = [p.handover, p.training, p.customerInfo, p.settingDone].map(text).filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v)).sort().pop();
        const real = start && end ? workdaysInclusive(start, end) : null;
        return { target: m.target, real, status: real == null ? 'SLA Real Unavailable' : real > m.target ? 'Overdue' : 'Within SLA', over: real == null ? null : Math.max(0, real - m.target), solution: m.solution };
    }
    const sourceReal = p.slaReal != null && Number.isFinite(Number(p.slaReal)) ? Number(p.slaReal) : null;
    const m = memoSemanticMatch(p, rules), ref = text(p.assignDate) || text(p.submitDate) || text(p.createDate) || text(p.slaPolicyDate);
    if (!m)
        return { ...unavailable(), real: sourceReal };
    if (m.map !== 'Custom SLA Setting' && ref && ref.slice(0, 10) < '2025-07-14')
        return { ...unavailable(m.solution), target: m.target, real: sourceReal, map: m.map };
    if (p.slaReal == null || !Number.isFinite(Number(p.slaReal)))
        return { target: m.target, real: null, status: 'SLA Real Unavailable', over: null, solution: m.solution, map: m.map };
    const real = Number(p.slaReal);
    return { target: m.target, real, status: real > m.target ? 'Overdue' : 'Within SLA', over: Math.max(0, real - m.target), solution: m.solution, map: m.map };
}
