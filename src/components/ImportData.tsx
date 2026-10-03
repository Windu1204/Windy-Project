import { useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { Upload, RotateCcw, FileSpreadsheet } from 'lucide-react';
import { type DatasetKind, type MonitoringRecord, type Payload } from '../types';
import { auditRows, sheetRows, type ImportAudit } from '../domain/imports';
import { exportCsv, exportExcel, saveBlob } from '../lib/exports';
import { quality } from '../domain/analytics';
import { Panel } from './Charts';
export default function ImportData({ rows, kind, canEdit, onApply, onRestore }: {
    rows: MonitoringRecord[];
    kind: DatasetKind;
    canEdit: boolean;
    onApply: (rows: Payload[], name: string) => Promise<void>;
    onRestore: () => Promise<void>;
}) {
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null), [sheet, setSheet] = useState(''), [name, setName] = useState(''), [audit, setAudit] = useState<ImportAudit | null>(null), [mode, setMode] = useState('success'), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [restoreConfirm, setRestoreConfirm] = useState(false);
    function parse(wb: XLSX.WorkBook, key: string) { setSheet(key); setAudit(auditRows(sheetRows(wb.Sheets[key], kind), kind)); setMessage(''); }
    async function read(e: ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file)
        return; setError(''); try {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
        setWorkbook(wb);
        setName(file.name);
        parse(wb, wb.SheetNames[0]);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'File tidak dapat dibaca.');
    } e.target.value = ''; }
    async function apply() { if (!audit?.rows.length)
        return; setBusy(true); setError(''); try {
        await onApply(audit.rows, name);
        setMessage(`${audit.rows.length.toLocaleString()} record berhasil diterapkan.`);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Import gagal.');
    }
    finally {
        setBusy(false);
    } }
    async function restore() { setBusy(true); try {
        await onRestore();
        setMessage('Dataset asli dipulihkan.');
        setRestoreConfirm(false);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Restore gagal');
    }
    finally {
        setBusy(false);
    } }
    const displayed = mode === 'success' ? (audit?.rows || []).map(row => ({ row, reason: '' })) : audit?.revisions || [], cols = [...new Set(displayed.slice(0, 20).flatMap(x => Object.keys(x.row)))].slice(0, 9);
    return <><div className="quality-grid">{quality(rows, kind).map(([label, n]) => <div key={label}><b>{n.toLocaleString()}</b><small>{label}</small></div>)}</div><Panel title="Import & Export Data" hint="Pilih sheet, periksa hasil validasi, lalu terapkan dataset secara utuh."><div className="upload-zone"><Upload size={30}/><h3>Upload Excel atau CSV</h3><p>File .xlsx, .xls, atau .csv · Header dapat berada di 100 baris pertama</p><label className="primary file-button"><FileSpreadsheet size={16}/>Pilih file<input type="file" accept=".xlsx,.xls,.csv" onChange={read}/></label></div><div className="button-row"><button className="secondary" onClick={() => exportCsv(rows, kind)}>Export CSV</button><button className="secondary" onClick={() => exportExcel(rows, kind).catch(e => setError(String(e)))}>Export Excel</button><button className="secondary" disabled={!canEdit || busy} onClick={() => setRestoreConfirm(true)}><RotateCcw size={14}/>Pulihkan dataset asli</button></div>{restoreConfirm && <div className="notice"><p>Dataset aktif akan diganti dengan dataset asli. Riwayat import tetap tersimpan.</p><div className="button-row"><button className="primary" disabled={busy} onClick={restore}>Pulihkan sekarang</button><button className="secondary" onClick={() => setRestoreConfirm(false)}>Batal</button></div></div>}{workbook && <label>Sheet<select value={sheet} onChange={e => { try {
        parse(workbook, e.target.value);
    }
    catch (e) {
        setError(String(e));
    } }}>{workbook.SheetNames.map(s => <option key={s}>{s}</option>)}</select></label>}{audit && <><div className="quality-grid">{[['Source', audit.source], ['Success', audit.rows.length], ['Perlu Revisi', audit.revisions.length], ['Duplicate ID', audit.duplicates], ['Invalid Date', audit.invalidDates]].map(([l, n]) => <div key={l}><b>{n}</b><small>{l}</small></div>)}</div><p className="muted">Duplicate ID dipertahankan seperti pada aplikasi asli. Baris dengan field wajib kosong atau tanggal tidak valid tidak diterapkan.</p><div className="tabs"><button className={mode === 'success' ? 'active' : ''} onClick={() => setMode('success')}>Success ({audit.rows.length})</button><button className={mode === 'revision' ? 'active' : ''} onClick={() => setMode('revision')}>Perlu Revisi ({audit.revisions.length})</button></div><div className="table-scroll"><table><thead><tr>{mode === 'revision' && <th>Alasan</th>}{cols.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{displayed.slice(0, 20).map((x, i) => <tr key={i}>{mode === 'revision' && <td>{x.reason}</td>}{cols.map(c => <td key={c}>{String(x.row[c] ?? '')}</td>)}</tr>)}</tbody></table></div><p className="muted">Preview 20 record · {name}</p><div className="button-row"><button className="primary" disabled={!canEdit || busy || !audit.rows.length} onClick={apply}>{busy ? 'Menyimpan…' : `Terapkan ${audit.rows.length} record`}</button>{audit.revisions.length > 0 && <button className="secondary" onClick={() => { const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(audit.revisions.map(x => ({ ...x.row, Reason: x.reason })))); saveBlob(new Blob([csv], { type: 'text/csv' }), 'perlu_revisi.csv'); }}>Download revisi</button>}</div></>}{error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}</Panel></>;
}
