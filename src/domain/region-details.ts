import { type DatasetKind, type MonitoringRecord, text } from '../types';
import { fields, isDone, isWaiting, status } from './analytics';
export const blankCategory = '__blank_category__';
export const categoryName = (value: string) => value || blankCategory;
export const categoryLabel = (value: string) => value === blankCategory ? 'Belum diisi' : value;
export function regionName(row: MonitoringRecord, kind: DatasetKind) { return text(row.payload[fields[kind].region]) || '—'; }
export function validRegion(name: string, kind: DatasetKind) { return kind !== 'regional' || name !== '0'; }
export type RegionMode = 'all' | 'done' | 'progress' | 'pending' | 'returned' | 'overdue' | 'other';
export function matchesRegionMode(row: MonitoringRecord, kind: DatasetKind, mode: RegionMode): boolean {
 const name = status(row, kind);
 if (mode === 'all') return true;
 if (mode === 'done') return isDone(row, kind);
 if (mode === 'progress') return /^(in progress|on progress|dalam proses|progress)$/i.test(name);
 if (mode === 'pending') return isWaiting(row, kind);
 if (mode === 'returned') return /reject|retur|return|dibatal|cancel/i.test(name);
 if (mode === 'overdue') return row.sla.status === 'Overdue';
 return !(['done','progress','pending','returned'] as RegionMode[]).some(m => matchesRegionMode(row,kind,m));
}
