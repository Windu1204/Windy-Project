import { type MonitoringRecord, type DatasetKind } from '../types';
import { reportContext, type ReportOptions } from './report-model';
export { reportStatus } from './report-status';
export async function generateReport(rows: MonitoringRecord[], kind: DatasetKind, selected: readonly string[], format: 'pptx' | 'docx', options: ReportOptions = {}) {
    if (!rows.length) throw new Error('Tidak ada record untuk report.');
    if (!selected.length) throw new Error('Pilih minimal satu bagian report.');
    const context = reportContext(rows, kind, selected, options);
    const renderer = kind === 'ijr' ? await import('./report-renderers/ijr.js') : kind === 'regional' ? await import('./report-renderers/regional.js') : await import('./report-renderers/corporate.js');
    {
        const [response, logoResponse] = await Promise.all([fetch('/brand/report-cover-corporate.png'), fetch('/brand/source-f56b239053.png')]);
        if (!response.ok) throw new Error('Foto sampul report tidak tersedia.');
        if (!logoResponse.ok) throw new Error('Logo report tidak tersedia.');
        context.brandLogo = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Logo tidak dapat dibaca.')); logoResponse.blob().then(blob => reader.readAsDataURL(blob), reject); });
        context.coverPhoto = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Foto sampul tidak dapat dibaca.')); response.blob().then(blob => reader.readAsDataURL(blob), reject); });
    }
    if (format === 'pptx') context.PptxGenJS = (await import('pptxgenjs')).default;
    else context.docx = await import('docx');
    const engine = renderer.createRenderer(context), model = engine.model();
    await (format === 'pptx' ? engine.pptx(model) : engine.docx(model));
}

