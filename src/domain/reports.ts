import { type MonitoringRecord, type DatasetKind } from '../types';
import { reportContext, type ReportOptions } from './report-model';
export { reportStatus } from './report-status';
export async function generateReport(rows: MonitoringRecord[], kind: DatasetKind, selected: readonly string[], format: 'pptx' | 'docx', options: ReportOptions = {}) {
    if (!rows.length) throw new Error('Tidak ada record untuk report.');
    if (!selected.length) throw new Error('Pilih minimal satu bagian report.');
    const context = reportContext(rows, kind, selected, options);
    const renderer = kind === 'ijr' ? await import('./report-renderers/ijr.js') : kind === 'regional' ? await import('./report-renderers/regional.js') : await import('./report-renderers/corporate.js');
    if (format === 'pptx') {
        const [{ default: PptxGenJS }, response] = await Promise.all([import('pptxgenjs'), fetch('/brand/report-cover-ijr.png')]);
        if (!response.ok) throw new Error('Foto sampul report tidak tersedia.');
        context.PptxGenJS = PptxGenJS;
        context.coverPhoto = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Foto sampul tidak dapat dibaca.')); response.blob().then(blob => reader.readAsDataURL(blob), reject); });
    } else context.docx = await import('docx');
    const engine = renderer.createRenderer(context), model = engine.model();
    await (format === 'pptx' ? engine.pptx(model) : engine.docx(model));
}
