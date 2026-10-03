import { type MonitoringRecord, type DatasetKind, text, datasetTitles } from '../types';
import { fields, counts, metrics, personMetrics } from './analytics';
export const sections = ['Executive Summary', 'Volume & Status', 'SLA Performance', 'Overdue Analysis', 'Product & Sub Product', 'KPI Per Person', 'Detail Data'] as const;
export type ReportSection = typeof sections[number];
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
export interface ReportTable {
    title: string;
    headers: string[];
    rows: (string | number)[][];
}
export function reportTables(rows: MonitoringRecord[], kind: DatasetKind, selected: ReportSection[]): ReportTable[] {
    const k = fields[kind], m = metrics(rows, kind), tables: ReportTable[] = [], statuses = counts(rows, r => reportStatus(r, kind));
    if (selected.includes('Executive Summary'))
        tables.push({ title: 'Executive Summary', headers: ['Metric', 'Value'], rows: [['Total Records', rows.length], ...statuses, ['Within SLA', m.within], ['Overdue', m.overdue], ['SLA Achievement', m.achievement.toFixed(1) + '%']] });
    if (selected.includes('Volume & Status')) {
        tables.push({ title: 'Volume & Status', headers: ['Status', 'Records'], rows: statuses });
        tables.push({ title: 'Request Date Distribution', headers: ['Month', 'Records'], rows: counts(rows, r => text(r.payload[k.date]).slice(0, 7)).sort((a, b) => a[0].localeCompare(b[0])) });
    }
    if (selected.includes('SLA Performance'))
        tables.push({ title: 'SLA Performance', headers: ['SLA', 'Records'], rows: counts(rows, r => r.sla.status) });
    if (selected.includes('Overdue Analysis'))
        tables.push({ title: 'Overdue by Solution', headers: ['Solution', 'Overdue'], rows: counts(rows.filter(r => r.sla.status === 'Overdue'), r => r.sla.solution || 'Unmapped') });
    if (selected.includes('Product & Sub Product')) {
        const key = kind === 'ijr' ? k.type : k.product;
        const months = [...new Set(rows.map(r => text(r.payload[k.date]).slice(0, 7)).filter(v => /^\d{4}-\d{2}$/.test(v)))].sort();
        for (const [label, field] of [['Product', key], [kind === 'corporate' ? 'Segment' : 'Wilayah', k.region]]) {
            const names = counts(rows, r => text(r.payload[field])).map(x => x[0]);
            for (let start = 0; start < Math.max(months.length, 1); start += 3) {
                const period = months.slice(start, start + 3);
                tables.push({ title: `Overview per ${label}${months.length > 3 ? ' � ' + period.join(', ') : ''}`, headers: [label, ...period.flatMap(v => [v + ' M', v + ' New']), 'Total filtered'], rows: names.map(name => { const group = rows.filter(r => text(r.payload[field]) === name); return [name, ...period.flatMap(v => { const month = group.filter(r => text(r.payload[k.date]).startsWith(v)); return [month.filter(r => /maint/i.test(text(r.payload[k.type]))).length, month.filter(r => !/maint/i.test(text(r.payload[k.type]))).length]; }), group.length]; }) });
            }
        }
    }
    if (selected.includes('KPI Per Person'))
        tables.push({ title: 'KPI Per Person', headers: ['PIC / Implementor', 'Assigned', 'Done', 'Active', 'Waiting', 'Overdue', 'Achievement'], rows: personMetrics(rows, kind).map(p => [p.name, p.total, p.done, p.total - p.done, p.waiting, p.overdue, p.achievement.toFixed(1) + '%']) });
    if (selected.includes('Detail Data'))
        tables.push({ title: 'Detail Data', headers: ['No / CID', 'Company', 'Date', kind === 'corporate' ? 'Segment' : 'Wilayah', 'Product / Type', 'Status', 'Implementor', 'Target', 'Real', 'SLA'], rows: rows.map(r => [text(r.payload[k.id]), text(r.payload[k.company]), text(r.payload[k.date]), text(r.payload[k.region]), text(r.payload[k.product || k.type]), text(r.payload[k.status]), text(r.payload[k.person]), r.sla.target ?? '—', r.sla.real ?? '—', r.sla.status]) });
    return tables;
}
export async function generateReport(rows: MonitoringRecord[], kind: DatasetKind, selected: ReportSection[], format: 'pptx' | 'docx') {
    if (!rows.length)
        throw new Error('Tidak ada record untuk report.');
    if (!selected.length)
        throw new Error('Pilih minimal satu bagian report.');
    const tables = reportTables(rows, kind, selected), title = datasetTitles[kind], filename = `${kind}_Monitoring_Report_${new Date().toISOString().slice(0, 10)}.${format}`;
    if (format === 'pptx') {
        const { default: PptxGenJS } = await import('pptxgenjs');
        const ppt = new PptxGenJS();
        ppt.layout = 'LAYOUT_WIDE';
        ppt.author = 'Transaction Banking Services';
        ppt.subject = title;
        ppt.title = title;
        const cover = ppt.addSlide();
        cover.background = { color: 'F4F9FF' };
        cover.addShape(ppt.ShapeType.rect, { x: 0, y: 0, w: .2, h: 7.5, fill: { color: 'F26B21' }, line: { color: 'F26B21' } });
        cover.addText('BNI', { x: .7, y: .6, w: 2, h: .7, color: '087486', fontSize: 34, bold: true });
        cover.addText(title, { x: .7, y: 2, w: 11, h: 1.2, fontSize: 32, color: '07386A', bold: true });
        cover.addText(`Monitoring Report\n${rows.length.toLocaleString()} records · ${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}`, { x: .7, y: 3.5, w: 10, h: 1, fontSize: 18, color: '65809C' });
        for (const table of tables) {
            for (let start = 0; start < Math.max(1, table.rows.length); start += 15) {
                const slide = ppt.addSlide();
                slide.background = { color: 'F4F9FF' };
                slide.addText('BNI', { x: .5, y: .25, w: 1.5, h: .4, fontSize: 20, color: '087486', bold: true });
                slide.addText(table.title, { x: 2, y: .25, w: 10.5, h: .5, fontSize: 18, color: '07386A', bold: true });
                slide.addTable([table.headers, ...table.rows.slice(start, start + 15)].map(row => row.map(value => ({ text: String(value) }))), { x: .4, y: 1, w: 12.5, fontFace: 'Arial', fontSize: table.headers.length > 10 ? 6 : 8, border: { type: 'solid', color: 'DCE7F4', pt: .5 }, color: '173B68', fill: { color: 'FFFFFF' }, margin: 5, rowH: .28, autoPage: false });
                slide.addText(`${title} · ${start + 1}–${Math.min(start + 15, table.rows.length)}`, { x: .5, y: 7.05, w: 10, h: .2, fontSize: 8, color: '6B819D' });
            }
        }
        await ppt.writeFile({ fileName: filename });
        return;
    }
    const docx = await import('docx'), { saveBlob } = await import('../lib/exports');
    const children: (InstanceType<typeof docx.Paragraph> | InstanceType<typeof docx.Table>)[] = [new docx.Paragraph({ text: 'BNI', heading: docx.HeadingLevel.TITLE }), new docx.Paragraph({ text: title, heading: docx.HeadingLevel.HEADING_1 }), new docx.Paragraph(`${rows.length.toLocaleString()} records · ${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}`)];
    for (const table of tables) {
        children.push(new docx.Paragraph({ text: table.title, heading: docx.HeadingLevel.HEADING_2 }));
        children.push(new docx.Table({ width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows: [table.headers, ...table.rows].map((cells, i) => new docx.TableRow({ tableHeader: i === 0, children: cells.map(v => new docx.TableCell({ shading: i === 0 ? { fill: 'E5F2FF' } : undefined, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: String(v), bold: i === 0, size: 16 })] })] })) })) }));
    }
    const document = new docx.Document({ sections: [{ properties: { page: { size: { orientation: docx.PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }] });
    saveBlob(await docx.Packer.toBlob(document), filename);
}
