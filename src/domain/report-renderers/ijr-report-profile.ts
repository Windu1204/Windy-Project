import { text, type Payload } from '../../types';
import type { ReportContext } from '../report-model';
import { calculateSla } from '../sla';

// Adapt display fields only. Original IJR payload fields are retained for PIC
// attribution, source statuses and the TBS calculation.
export function adaptIJRReportContext(context: ReportContext): ReportContext & { renderProfile: 'ijr' } {
  const adapt = (row: Payload): Payload => {
    const sla = calculateSla(row, 'ijr');
    const names = [...new Set([text(row['Implementor 1']), text(row['Implementor 2'])].filter(Boolean))];
    return {
      ...row,
      company: text(row['Applicant Name']),
      cid: text(row['Application Number']),
      salesDate: text(row['Request Date']).slice(0, 10),
      region: text(row.Wilayah).replace(/^kantor\s+wilayah\s*/i, 'W') || 'Belum tersedia',
      type: text(row['Application Type']),
      projectType: text(row['Application Type']),
      product: 'BNIDirect',
      implementor: names.join(' / '),
      status: text(row.Status) || 'Belum tersedia',
      slaStatus: sla.status,
      slaReal: sla.real,
      slaOverBy: sla.over,
      slaSolution: sla.solution,
    };
  };
  return { ...context, renderProfile: 'ijr', rows: context.rows.map(adapt), dataset: context.dataset.map(adapt) };
}
