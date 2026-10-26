import { type Payload, text } from '../types';
import { productCategory } from './analytics';
import { requestCategory } from './request-category';
import { workingDays, completionDate } from './work-calendar';

export type RegionSummaryKind = 'regional' | 'ijr';
export const standardRegions = Array.from({ length: 18 }, (_, i) => 'W' + String(i + 1).padStart(2, '0'));
export function normalizeRegion(value: unknown) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(?:(?:kantor\s+)?wilayah\s*|w\s*)?0*(\d{1,2})$/i);
  const number = match ? Number(match[1]) : 0;
  return number >= 1 && number <= 18 ? 'W' + String(number).padStart(2, '0') : raw && raw !== '0' ? raw : 'Belum tersedia';
}
export function completedRegionDays(row: Payload, kind: RegionSummaryKind): number | null {
  const status = text(kind === 'ijr' ? row.Status ?? row.status : row.status);
  if (/reject|retur|return|dibatal|cancel/i.test(status) || !/done|complete|selesai|closed|delivered/i.test(status)) return null;
  if (kind === 'ijr') {
    const value = row._TBSDayNum ?? row['Total Day TBS'] ?? row.slaReal;
    return value != null && text(value) !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  }
  return workingDays(row.docComplete, completionDate(row.doneDate, row.dashboardUpdatedAt));
}
export const averageRegionDays = (rows: Payload[], kind: RegionSummaryKind) => {
  const values = rows.map(row => completedRegionDays(row, kind)).filter((n): n is number => n !== null);
  return { count: values.length, days: values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null };
};
export function regionProductGroup(row: Payload, kind: RegionSummaryKind) {
  if (kind === 'ijr') return 'BNIdirect';
  if (!text(row.product) || /^belum tersedia$/i.test(text(row.product))) return 'Belum tersedia';
  const group = productCategory(text(row.product), 'regional');
  return group === 'BNIDirect' ? 'BNIdirect' : group === 'Virtual Account / e-Collection' ? 'VA' : group || 'Belum tersedia';
}
export function regionSummary(rows: Payload[], kind: RegionSummaryKind) {
  const region = (row: Payload) => normalizeRegion(kind === 'ijr' ? row.Wilayah ?? row.region : row.region);
  const type = (row: Payload) => requestCategory(kind === 'ijr' ? row['Application Type'] ?? row.type : row.type);
  const names = [...standardRegions, ...[...new Set(rows.map(region))].filter(name => !standardRegions.includes(name)).sort()];
  const preferred = ['API', 'BNIdirect', 'VA'];
  const products = [...new Set(rows.map(row => regionProductGroup(row, kind)))].sort((a, b) => {
    const rank = (name: string) => preferred.includes(name) ? preferred.indexOf(name) : preferred.length;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const stats = (name: string, scoped: Payload[]) => ({
    name, total: scoped.length,
    new: scoped.filter(row => type(row) === 'N').length,
    maintenance: scoped.filter(row => type(row) === 'M').length,
    unclassified: scoped.filter(row => type(row) === 'U').length,
    averageNew: averageRegionDays(scoped.filter(row => type(row) === 'N'), kind),
    averageMaintenance: averageRegionDays(scoped.filter(row => type(row) === 'M'), kind),
  });
  const matrices = (['N', 'M', 'U'] as const).map(category => {
    const selected = rows.filter(row => type(row) === category);
    const matrixRow = (name: string, scoped: Payload[]) => ({
      name, counts: products.map(product => scoped.filter(row => regionProductGroup(row, kind) === product).length),
      total: scoped.length, average: averageRegionDays(scoped, kind),
    });
    return { category, products, rows: names.map(name => matrixRow(name, selected.filter(row => region(row) === name))), grandTotal: matrixRow('Grand Total', selected) };
  });
  return { rows: names.map(name => stats(name, rows.filter(row => region(row) === name))), grandTotal: stats('Grand Total', rows), matrices };
}
export const displayAverageDays = (days: number | null) => days === null ? '—' : days.toFixed(1);
