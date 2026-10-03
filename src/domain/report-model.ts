import { type DatasetKind, type Filters, type MonitoringRecord, type Payload, type Value, text } from '../types';
import { counts, fields, productCategory } from './analytics';
import { validDate } from './imports';
import { reportStatus } from './report-status';

export const reportContents: Record<DatasetKind, readonly string[]> = {
  ijr: ['Executive Summary', 'Status Breakdown', 'Process & Duration', 'Wilayah & Cabang', 'PIC & Workload', 'Detail Data'],
  regional: ['Executive Summary', 'Status Breakdown', 'Wilayah', 'Product & Sub Product', 'Beban Implementor', 'Detail Data'],
  corporate: ['Executive Summary', 'Volume & Status', 'SLA Performance', 'Overdue Analysis', 'Product & Sub Product', 'Detail Data'],
};
export interface ReportPerson {
  name: string; records: Payload[]; assigned: number; done: number; active: number; waiting: number; overdue: number;
}
export interface ReportModel {
  rows: Payload[]; total: number; done: number; handover: number; retur: number; active: number; waiting: number;
  inProgress: number; attention: number; within: number; overdue: number; statuses: [string, number][];
  products: [string, number][]; dims: [string, number][]; person: string; people: ReportPerson[]; allPeople: boolean;
}
export interface ReportOptions { person?: string; filters?: Filters; source?: 'custom' | 'current'; dataset?: MonitoringRecord[] }
export interface ReportContext {
  rows: Payload[]; dataset: Payload[]; person: string; selected: readonly string[]; period: string; presentationPeriod: string;
  productCategory: (value: string) => string; productName: (value: string) => string; validDate: (value: Value) => boolean;
  PptxGenJS?: typeof import('pptxgenjs').default; docx?: typeof import('docx'); coverPhoto?: string; brandLogo?: string;
}
export const reportTitles: Record<DatasetKind, string> = {
  ijr: 'IJR - BNIdirect', regional: 'Regional - Non BNIDirect', corporate: 'Corporate - Non Piloting',
};
export function reportNames(row: MonitoringRecord, kind: DatasetKind) {
  return [...new Set((kind === 'ijr' ? [row.payload['Implementor 1'], row.payload['Implementor 2']] : [row.payload.implementor]).map(text).filter(Boolean))];
}
export function selectReportPerson(rows: MonitoringRecord[], kind: DatasetKind, person: string) {
  if (!person || person.trim().toLowerCase() === 'all name') return rows;
  return rows.filter(row => reportNames(row, kind).some(name => kind === 'ijr' ? name === person : name.toLowerCase().includes(person.toLowerCase())));
}
export function reportModel(rows: MonitoringRecord[], kind: DatasetKind, person = ''): ReportModel {
  const selected = person.trim().toLowerCase() === 'all name' ? '' : person.trim();
  const payload = (row: MonitoringRecord) => ({ ...row.payload, slaStatus: row.sla.status, slaReal: row.sla.real, slaOverBy: row.sla.over, slaSolution: row.sla.solution });
  const order = ['Pending', 'On Progress', 'Done', 'Handover', 'Retur'];
  const statusCounts = counts(rows, row => reportStatus(row, kind));
  const n = (status: string) => statusCounts.find(item => item[0] === status)?.[1] || 0;
  const peopleMap = new Map<string, MonitoringRecord[]>();
  for (const row of rows) for (const name of reportNames(row, kind)) {
    if (selected && name.toLowerCase() !== selected.toLowerCase()) continue;
    const records = peopleMap.get(name) || []; records.push(row); peopleMap.set(name, records);
  }
  const people = [...peopleMap].map(([name, records]) => {
    const done = records.filter(row => reportStatus(row, kind) === 'Done').length;
    return { name, records: records.map(payload), assigned: records.length, done, active: records.length - done,
      waiting: records.filter(row => reportStatus(row, kind) === 'Pending').length,
      overdue: kind !== 'ijr' ? records.filter(row => row.sla.status === 'Overdue').length : 0 };
  }).sort((a, b) => b.assigned - a.assigned || a.name.localeCompare(b.name));
  return { rows: rows.map(payload), total: rows.length, done: n('Done'), handover: n('Handover'), retur: n('Retur'),
    active: n('On Progress') + n('Pending') + n('Retur'), waiting: n('Pending'), inProgress: n('On Progress'), attention: n('Pending'),
    within: kind !== 'ijr' ? rows.filter(row => row.sla.status === 'Within SLA').length : 0,
    overdue: kind !== 'ijr' ? rows.filter(row => row.sla.status === 'Overdue').length : 0,
    statuses: order.filter(status => n(status) > 0).map(status => [status, n(status)]),
    products: counts(rows, row => kind === 'ijr' ? text(row.payload['Application Type']) : productCategory(text(row.payload.product), kind)),
    dims: counts(rows, row => text(row.payload[fields[kind].region])), person: selected, people, allPeople: !selected };
}
export function reportContext(rows: MonitoringRecord[], kind: DatasetKind, selected: readonly string[], options: ReportOptions = {}): ReportContext {
  const model = reportModel(rows, kind, options.person), dataset = options.dataset || rows, filters = options.filters;
  const period = options.source === 'current' ? 'Current Dashboard Filter' : filters?.from || filters?.to ? `${filters.from || '...'} - ${filters.to || '...'}` : 'All Period';
  const dates = dataset.map(row => text(row.payload[fields[kind].date])).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && validDate(value, kind === 'regional')).sort();
  const formatDate = (date: string) => new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const labels = new Map<string, string>();
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  for (const [label] of counts(dataset, row => text(row.payload.product))) if (!labels.has(normalize(label))) labels.set(normalize(label), label);
  return { rows: model.rows, dataset: reportModel(dataset, kind).rows, person: model.person || 'All Name', selected, period,
    presentationPeriod: period === 'All Period' && dates.length ? `All Period\n${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}` : period,
    productCategory: value => productCategory(value, kind), productName: value => labels.get(normalize(String(value || ''))) || String(value || ''), validDate: value => validDate(value, kind === 'regional') };
}
