import { type ApplicationKind, type MonitoringRecord, text } from '../types';
import { status } from './analytics';
import { field } from '../piloting/model';
import { isoDate, jakartaToday, workingDays } from './work-calendar';

/** Separate open-work monitoring; does not change completed SLA results or targets. */
export function projectQueueState(row: MonitoringRecord, kind: ApplicationKind, today = jakartaToday()) {
  const name = kind === 'piloting' ? text(row.payload[field.status]) : status(row, kind);
  const closed = /reject|retur|return|dibatal|cancel|handover/i.test(name) || /done|complete|selesai|closed|delivered/i.test(name);
  if (closed) return { open: false, overdue: false, age: null, target: row.sla.target };
  const rawTarget = row.sla.target;
  const target = rawTarget !== null && Number.isFinite(rawTarget) && rawTarget >= 0 ? rawTarget : null;
  // IJR uses the source TBS duration, not total time at the branch.
  const age = kind === 'ijr' ? row.sla.real : workingDays(kind === 'regional' ? row.payload.docComplete : kind === 'piloting' ? row.payload[field.assigned] : row.payload.assignDate, today);
  const invalidFutureStart = kind !== 'ijr' && !isoDate(kind === 'regional' ? row.payload.docComplete : kind === 'piloting' ? row.payload[field.assigned] : row.payload.assignDate);
  return { open: true, overdue: !invalidFutureStart && target !== null && age !== null && age > target, age, target };
}
export const selectProjectQueue = (rows: MonitoringRecord[], kind: ApplicationKind, overdue: boolean, today = jakartaToday()) => rows.filter(row => {
  const state = projectQueueState(row, kind, today);
  return state.open && (!overdue || state.overdue);
});
