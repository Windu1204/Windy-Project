import { productCategory } from '../domain/analytics';
import { type Payload, type MonitoringRecord, text } from '../types';
export const sourceFields = ['No', 'No. Register', 'Kelompok', 'Nama Perusahaan', 'PIC AT', 'Jenis Permintaan', 'Jenis Produk / Solusi', 'Jenis Formulir', 'Tanggal Assign to AT', 'Waktu Penyelesaian AT', 'Hari Penyelesaian (SLA, hari kerja)', 'Status AT (raw)', 'Kategori', 'Current Stage', 'Catatan (TL AT / AT)', 'Status Discrepancy', 'Alasan Discrepancy', 'Komitmen Discrepancy', 'Pemenuhan Discrepancy'] as const;
export const field = { id: sourceFields[1], group: sourceFields[2], company: sourceFields[3], person: sourceFields[4], product: sourceFields[6], form: sourceFields[7], assigned: sourceFields[8], completed: sourceFields[9], days: sourceFields[10], status: sourceFields[12], discrepancy: sourceFields[15] };
export type PilotFilters = { category: string; sla: string; period: string; search: string; from: string; to: string; group: string; person: string; product: string; form: string; status: string; discrepancy: string };
export const initialFilters: PilotFilters = { category: '', sla: '', period: '', search: '', from: '', to: '', group: '', person: '', product: '', form: '', status: '', discrepancy: '' };
export const value = (r: MonitoringRecord, key: string) => text(r.payload[key]);
export function days(r: MonitoringRecord): number | null {
  const raw = r.payload[field.days];
  if (raw === null || raw === undefined || text(raw) === '') return null;
  const n = Number(raw); return Number.isFinite(n) && n >= 0 ? n : null;
}
export function duration(r: MonitoringRecord) { const n = days(r); return n === null ? 'Unavailable' : n === 0 ? 'Same Day' : n === 1 ? '1 Hari' : n === 2 ? '2 Hari' : '>2 Hari'; }
export function filterPiloting(rows: MonitoringRecord[], filters: PilotFilters) {
  const query = filters.search.trim().toLocaleLowerCase();
  return rows.filter(r => (!filters.category || productCategory(value(r, field.product), 'corporate') === filters.category) && (!filters.sla || r.sla.status === filters.sla) && (!query || Object.values(r.payload).some(v => text(v).toLocaleLowerCase().includes(query))) && (!filters.from || value(r, field.assigned) >= filters.from) && (!filters.to || value(r, field.assigned) <= filters.to) && (Object.keys(field).filter(k => ['group','person','product','form','status','discrepancy'].includes(k)) as Array<keyof typeof field>).every(k => !filters[k as keyof PilotFilters] || value(r, field[k]) === filters[k as keyof PilotFilters]));
}
export function breakdown(rows: MonitoringRecord[], key: string): [string, number][] {
  const counts = new Map<string, number>(); rows.forEach(r => { const name = value(r, key) || '—'; counts.set(name, (counts.get(name) || 0) + 1); });
  return [...counts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
}
export function pilotMetrics(rows: MonitoringRecord[]) {
  const done = rows.filter(r => value(r,field.status) === 'Done');
  const nums = done.map(days).filter((n): n is number => n !== null);
  return { total: rows.length, done: done.length, pending: rows.filter(r => value(r,field.status) === 'Masih Pending').length, returned: rows.filter(r => value(r,field.status) === 'Reject/Retur').length, discrepancy: rows.filter(r => value(r,field.discrepancy) === 'Discrepancy').length, measurable: nums.length, average: nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null };
}
export function people(rows: MonitoringRecord[]) { return breakdown(rows,field.person).map(([name]) => { const records = rows.filter(r => (value(r,field.person)||'—') === name); return { name, rows: records, ...pilotMetrics(records) }; }); }
export function sourcePayload(rows: MonitoringRecord[]): Payload[] { return rows.map(r => ({...r.payload})); }
