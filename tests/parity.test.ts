import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { calculateSla, workdaysInclusive } from '../src/domain/sla';
import { filterRows, metrics, counts, status, fields } from '../src/domain/analytics';
import { auditRows, validDate } from '../src/domain/imports';
import { reportStatus } from '../src/domain/report-status';
import { reportModel } from '../src/domain/report-model';
import { type DatasetKind, type Payload, emptyFilters } from '../src/types';
function legacy(kind: DatasetKind) {
    const source = readFileSync(`private/reference/${kind}.js`, 'utf8'), ast = ts.createSourceFile('legacy.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const functions = kind === 'corporate' ? ['customSlaSimilarity', 'customSlaMatch', 'memoSemanticMatch', 'applyMemoSla', 'statusGroup'] : kind === 'regional' ? ['regSlaResult', 'regSlaTarget', 'workdaysInclusive', 'latestRegMilestone', 'regSlaOf'] : ['ijrSlaOf'];
    let code = ast.statements.filter(s => ts.isFunctionDeclaration(s) && s.name && functions.includes(s.name.text)).map(s => s.getText(ast)).join('\n');
    if (kind === 'corporate')
        code = "const CUSTOM_SLA_RULES=[];const normSlaText=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();\n" + code;
    if (kind === 'regional')
        code = "const slaNorm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\\s+/g,' ').trim();\n" + source.split('\n').filter(s => s.startsWith('const REG_SLA_RULES=') || s.startsWith('const REG_SLA_RULE_MAP=')).join('\n') + '\n' + code;
    const context = vm.createContext({});
    vm.runInContext(code, context);
    return (p: Payload) => { if (kind === 'corporate') {
        const r = context.applyMemoSla(p);
        return { target: r.slaTarget ?? null, real: r.slaReal ?? null, status: r.slaStatus, over: r.slaOverBy ?? null, solution: r.slaSolution ?? null };
    } const r = kind === 'regional' ? context.regSlaOf(p) : context.ijrSlaOf(p); return { target: r.target, real: r.real, status: r.status, over: r.over, solution: r.solution }; };
}
describe('calculation parity against the v78 application', () => {
    for (const kind of ['ijr', 'regional', 'corporate'] as DatasetKind[]) {
        const available = existsSync(`private/seed/${kind}.json`) && existsSync(`private/reference/${kind}.js`);
        it.skipIf(!available)(`${kind}: every original record has the same SLA result`, () => {
            const data = JSON.parse(readFileSync(`private/seed/${kind}.json`, 'utf8')) as Payload[], original = legacy(kind);
            data.forEach((payload, index) => { const { target, real, status, over, solution } = calculateSla(payload, kind); expect({ target, real, status, over, solution }, `${kind} source row ${index + 1}`).toEqual(original(payload)); });
            const rows = data.map((payload, i) => ({ id: String(i), payload, sla: calculateSla(payload, kind) }));
            expect(metrics(rows, kind).total).toBe({ ijr: 1000, regional: 1098, corporate: 4509 }[kind]);
            expect(counts(rows, r => status(r, kind)).reduce((n, x) => n + x[1], 0)).toBe(rows.filter(r => status(r, kind)).length);
            for (const [name] of counts(rows, r => status(r, kind))) {
                const result = filterRows(rows, kind, { ...emptyFilters, status: name });
                expect(result.length).toBe(rows.filter(r => status(r, kind) === name).length);
            }
            const month = String(data.find(r => r[fields[kind].date])?.[fields[kind].date]).slice(0, 7);
            expect(filterRows(rows, kind, { ...emptyFilters, period: month }).length).toBe(data.filter(r => String(r[fields[kind].date] || '').startsWith(month)).length);
            console.info(kind, JSON.stringify(metrics(rows, kind)));
        });
    }
});
describe('SLA boundaries and import integrity', () => {
    it('counts inclusive weekdays across weekends and rejects reversed intervals', () => { expect(workdaysInclusive('2026-10-02', '2026-10-05')).toBe(2); expect(workdaysInclusive('2026-10-05', '2026-10-02')).toBeNull(); });
    it('uses memo date and maintenance targets for IJR', () => { expect(calculateSla({ 'Request Date': '2025-07-13', _TotalDayNum: 10 }, 'ijr').status).toBe('Without SLA'); expect(calculateSla({ 'Request Date': '2025-07-14', 'Application Type': 'Maintenance', _TotalDayNum: 3 }, 'ijr').status).toBe('Overdue'); expect(calculateSla({ _TotalDayNum: 3 }, 'ijr').status).toBe('Within SLA'); });
    it('keeps unavailable regional milestones outside the SLA denominator', () => { const r = calculateSla({ product: 'BNIdirect', type: 'New', salesDate: '2026-01-01' }, 'regional'); expect(r.target).toBe(3); expect(r.status).toBe('SLA Real Unavailable'); });
    it('matches custom aliases only when memo mapping is unavailable', () => { const rules = [{ product: 'Special Service', name: 'Special', aliases: 'Custom X', newDays: 9, maintDays: 4 }]; expect(calculateSla({ product: 'Special Service', projectType: 'Maintenance', slaReal: 5 }, 'corporate', rules).status).toBe('Overdue'); });
    it('quarantines missing fields and impossible calendar dates while retaining duplicates', () => { const audit = auditRows([{ 'Application Number': 'A', Status: 'Proses Selesai', 'Request Date': '2026-02-30' }, { 'Application Number': 'B', Status: 'Dalam Proses', 'Request Date': '2026-02-02' }, { 'Application Number': 'B', Status: 'Dalam Proses', 'Request Date': '2026-02-02' }, { Status: 'Done' }], 'ijr'); expect(audit.rows.length).toBe(2); expect(audit.revisions.length).toBe(2); expect(audit.duplicates).toBe(1); expect(validDate('2026-02-30')).toBe(false); });
    it('does not infer Handover from a New Project type', () => { const payload = { projectType: 'New', status: 'In progress' }, r = { id: '1', payload, sla: calculateSla(payload, 'regional') }; expect(reportStatus(r, 'regional')).toBe('On Progress'); expect(reportModel([r], 'regional').handover).toBe(0); expect(reportModel([r], 'regional').inProgress).toBe(1); });
});
