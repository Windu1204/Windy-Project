import { type MonitoringRecord, type Payload, type SlaResult, type SlaRule, text } from '../types';
import { calculateSla, workdaysInclusive } from '../domain/sla';
import { field, days, value } from './model';

// Adapt source fields only. The original payload and corporate calculator stay unchanged.
export function pilotSla(payload: Payload, rules: SlaRule[] = []): SlaResult {
  const raw = text(payload[field.product]);
  const product = raw.replace(/^VA Debit$/i, 'Virtual Account Debit').replace(/^VA Kredit Berkartu$/i, 'Virtual Account Kredit berkartu').replace(/^VA eCollection$/i, 'Virtual Account eCollection');
  const source = { id: '', payload, sla: {} as SlaResult };
  // "No New Pipeline" belongs to Maintenance, not a New Project.
  const form = text(payload[field.form]), type = /^maintenance/i.test(form) ? 'Maintenance' : /^baru/i.test(form) ? 'New Project' : form;
  const result = calculateSla({ product, projectType: type, formType: type, requestType: type, description: [payload['Jenis Permintaan'],payload['Catatan (TL AT / AT)']].map(text).join(' '), assignDate: payload[field.assigned], slaReal: days(source) }, 'corporate', rules);
  // Returned and pending work is never counted as completed SLA achievement.
  if (text(payload[field.status]) !== 'Done') return { ...result, real: null, over: null, status: result.target === null ? 'Without SLA' : 'SLA Real Unavailable' };
  return result;
}
export const isMeasured = (r: MonitoringRecord) => value(r, field.status) === 'Done' && (r.sla.status === 'Within SLA' || r.sla.status === 'Overdue');
export function slaMetrics(rows: MonitoringRecord[]) {
  const measured = rows.filter(isMeasured), within = measured.filter(r => r.sla.status === 'Within SLA').length, overdue = measured.length - within;
  return { measured: measured.length, within, overdue, achievement: measured.length ? within / measured.length * 100 : null, unavailable: rows.filter(r => value(r, field.status) === 'Done' && !isMeasured(r)).length };
}
export function pendingAge(row: MonitoringRecord, asOf = new Date().toISOString().slice(0, 10)) {
  if (value(row, field.status) !== 'Masih Pending') return null;
  const n = workdaysInclusive(value(row, field.assigned), asOf);
  // Same-day source duration is zero: elapsed weekdays exclude assignment day.
  return n === null ? null : Math.max(0, n - (new Date(value(row, field.assigned) + 'T00:00:00Z').getUTCDay() % 6 === 0 ? 0 : 1));
}
