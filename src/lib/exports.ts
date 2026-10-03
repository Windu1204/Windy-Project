import { type MonitoringRecord, type DatasetKind, type Payload } from '../types';
export interface ReportFile { blob: Blob; name: string }
export function saveBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function exportedRows(rows: MonitoringRecord[]): Payload[] { return rows.map(r => ({ ...r.payload, slaSolution: r.sla.solution, slaTarget: r.sla.target, slaReal: r.sla.real, slaStatus: r.sla.status, slaOverBy: r.sla.over })); }
export function exportCsv(rows: MonitoringRecord[], kind: DatasetKind) { const data = exportedRows(rows), keys = [...new Set(data.flatMap(r => Object.keys(r)))]; const cell = (v: Payload[string]) => { let s = String(v ?? ''); if (/^[=+@\-]/.test(s))
    s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }; const csv = [keys.map(cell).join(','), ...data.map(r => keys.map(k => cell(r[k])).join(','))].join('\r\n'); saveBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), `${kind}_filtered.csv`); }
export async function exportExcel(rows: MonitoringRecord[], kind: DatasetKind) { const XLSX = await import('xlsx'); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportedRows(rows)), 'Data'); XLSX.writeFile(wb, `${kind}_filtered.xlsx`); }
