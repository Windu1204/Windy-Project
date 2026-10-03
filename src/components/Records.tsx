import { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { type MonitoringRecord, type DatasetKind, text } from '../types';
import { fields } from '../domain/analytics';
import { exportCsv } from '../lib/exports';
export function Badge({ value }: {
    value: string;
}) { const cls = /done|selesai|within/i.test(value) ? 'green' : /overdue|reject|retur/i.test(value) ? 'red' : /waiting|pending|amand/i.test(value) ? 'amber' : 'blue'; return <span className={'badge ' + cls}>{value || '—'}</span>; }
export function Records({ rows, kind, onOpen, title = 'Detail Data' }: {
    rows: MonitoringRecord[];
    kind: DatasetKind;
    onOpen: (r: MonitoringRecord) => void;
    title?: string;
}) {
    const [page, setPage] = useState(1), [size, setSize] = useState(25);
    const pages = Math.max(1, Math.ceil(rows.length / size)), current = Math.min(page, pages), start = (current - 1) * size, k = fields[kind];
    useEffect(() => setPage(1), [rows]);
    return <section className="panel records"><div className="table-heading"><div><h3>{title}</h3><small>{rows.length.toLocaleString()} records · klik detail untuk melihat seluruh informasi</small></div><button className="secondary" disabled={!rows.length} onClick={() => exportCsv(rows, kind)}><Download size={14}/>CSV</button></div><div className="table-scroll"><table><thead><tr><th>Nomor / CID</th><th>Perusahaan</th><th>{kind === 'corporate' ? 'Segment' : 'Wilayah'}</th><th>Tipe</th>{kind !== 'ijr' && <th>Produk</th>}<th>Status</th><th>Implementor</th><th>Tanggal</th><th>Target</th><th>Real</th><th>SLA</th><th /></tr></thead><tbody>{rows.slice(start, start + size).map(r => <tr key={r.id}><td>{text(r.payload[k.id]) || '—'}</td><td><b>{text(r.payload[k.company]) || '—'}</b></td><td>{text(r.payload[k.region])}</td><td>{text(r.payload[k.type])}</td>{kind !== 'ijr' && <td>{text(r.payload.product)}</td>}<td><Badge value={text(r.payload[k.status])}/></td><td>{text(r.payload[k.person]) || '—'}</td><td>{text(r.payload[k.date]) || '—'}</td><td>{r.sla.target == null ? '—' : r.sla.target + ' d'}</td><td>{r.sla.real == null ? '—' : r.sla.real + ' d'}</td><td><Badge value={r.sla.status}/></td><td><button className="text-button" onClick={() => onOpen(r)}>Detail</button></td></tr>)}</tbody></table>{!rows.length && <p className="empty">Tidak ada data yang sesuai dengan filter.</p>}</div><div className="pagination"><span>{rows.length ? `${start + 1}–${Math.min(start + size, rows.length)} dari ${rows.length.toLocaleString()}` : '0 records'}</span><label>Baris<select aria-label="Baris per halaman" value={size} onChange={e => { setSize(Number(e.target.value)); setPage(1); }}>{[25, 50, 100].map(n => <option key={n}>{n}</option>)}</select></label><button className="icon-button" aria-label="Halaman sebelumnya" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft size={17}/></button><span>{current} / {pages}</span><button className="icon-button" aria-label="Halaman berikutnya" disabled={current >= pages} onClick={() => setPage(current + 1)}><ChevronRight size={17}/></button></div></section>;
}
export function Detail({ record, kind, canEdit, onClose, onDone }: {
    record: MonitoringRecord;
    kind: DatasetKind;
    canEdit: boolean;
    onClose: () => void;
    onDone: (r: MonitoringRecord, note: string) => Promise<void>;
}) {
    const ref = useRef<HTMLDialogElement>(null), [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    useEffect(() => { ref.current?.showModal(); }, []);
    const k = fields[kind];
    async function done() { setBusy(true); try {
        await onDone(record, note);
        onClose();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Update gagal');
    }
    finally {
        setBusy(false);
    } }
    return <dialog ref={ref} className="detail-dialog" onClose={onClose} onClick={e => { if (e.target === ref.current)
        onClose(); }}><div className="dialog-head"><div><small>DETAIL RECORD</small><h2>{text(record.payload[k.company])}</h2><p>{text(record.payload[k.id])}</p></div><button className="icon-button" aria-label="Tutup detail" onClick={onClose}><X /></button></div><div className="detail-grid">{Object.entries(record.payload).filter(([, v]) => v != null && v !== '').map(([key, v]) => <div key={key}><small>{key}</small><p>{String(v)}</p></div>)}{Object.entries(record.sla).map(([key, v]) => <div key={'sla-' + key}><small>SLA {key}</small><p>{v == null ? '—' : String(v)}</p></div>)}</div>{kind === 'regional' && canEdit && record.payload.status !== 'Done' && <div className="done-form"><label>Keterangan penyelesaian<textarea value={note} onChange={e => setNote(e.target.value)}/></label><button className="primary" disabled={busy} onClick={done}>{busy ? 'Menyimpan…' : 'Tandai Done'}</button>{error && <p className="error" role="alert">{error}</p>}</div>}</dialog>;
}
