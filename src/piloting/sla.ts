import { type MonitoringRecord, type Payload, type SlaResult, type SlaRule, text } from '../types';
import { calculateSla } from '../domain/sla';
import { workingDays, jakartaToday } from '../domain/work-calendar';
import { field, days, value } from './model';

// Adapt source fields only. The original payload and corporate calculator stay unchanged.
export function pilotSla(payload: Payload, rules: SlaRule[] = []): SlaResult {
  const raw = text(payload[field.product]);
  const product = raw.replace(/^VA Debit$/i, 'Virtual Account Debit').replace(/^VA Kredit Berkartu$/i, 'Virtual Account Kredit berkartu').replace(/^VA eCollection$/i, 'Virtual Account eCollection');
  const source = { id: '', payload, sla: {} as SlaResult };
  // "No New Pipeline" belongs to Maintenance, not a New Project.
  const form = text(payload[field.form]), type = /^maintenance/i.test(form) ? 'Maintenance' : /^baru/i.test(form) ? 'New Project' : form;
  const result = calculateSla({ product, projectType: type, formType: type, requestType: type, description: [payload['Jenis Permintaan'],payload['Catatan (TL AT / AT)']].map(text).join(' '), assignDate: payload[field.assigned], slaReal: days(source) }, 'corporate', rules, true);
  // Returned and pending work is never counted as completed SLA achievement.
  if (text(payload[field.status]) !== 'Done') return { ...result, real: null, over: null, status: result.target === null ? 'Without SLA' : 'SLA Real Unavailable' };
  return result;
}
export const isMeasured = (r: MonitoringRecord) => value(r, field.status) === 'Done' && (r.sla.status === 'Within SLA' || r.sla.status === 'Overdue');
export function slaMetrics(rows: MonitoringRecord[]) {
  const measured = rows.filter(isMeasured), within = measured.filter(r => r.sla.status === 'Within SLA').length, overdue = measured.length - within;
  return { measured: measured.length, within, overdue, achievement: measured.length ? within / measured.length * 100 : null, unavailable: rows.filter(r => value(r, field.status) === 'Done' && !isMeasured(r)).length };
}
export function pendingAge(row: MonitoringRecord, asOf = jakartaToday()) {
  if (value(row, field.status) !== 'Masih Pending') return null;
  return workingDays(value(row, field.assigned), asOf);
}
