import { slaIssue } from '../domain/sla-diagnostics';
import { useLanguage } from '../lib/language';
import { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { type MonitoringRecord, type DatasetKind, text } from '../types';
import { fields } from '../domain/analytics';
import { exportCsv } from '../lib/exports';
import { detailFields } from '../domain/display';
export function Badge({ value }: {
    value: string;
}) { const { t } = useLanguage();  const cls = /done|selesai|within/i.test(value) ? 'green' : /overdue|reject|retur/i.test(value) ? 'red' : /waiting|pending|amand/i.test(value) ? 'amber' : 'blue'; return <span className={'badge ' + cls}>{value || '—'}</span>; }
export function Records({ rows, kind, onOpen, title, productName = (value: string) => value, variant = 'default', diagnostics = false }: {
    rows: MonitoringRecord[];
    kind: DatasetKind;
    onOpen: (r: MonitoringRecord) => void;
    title?: string;
    productName?: (value: string) => string;
    variant?: 'default' | 'sla' | 'duration';
    diagnostics?: boolean;
}) { const { t } = useLanguage(); 
    const [page, setPage] = useState(1), [size, setSize] = useState(25);
    const pages = Math.max(1, Math.ceil(rows.length / size)), current = Math.min(page, pages), start = (current - 1) * size;
    useEffect(() => setPage(1), [rows]);
    const value = (key: string) => (r: MonitoringRecord) => key === 'product' ? productName(text(r.payload[key])) : text(r.payload[key]);
    type Column = [string, (r: MonitoringRecord) => string];
    const slaColumns: Column[] = [['SLA Target', r => r.sla.target == null ? '' : r.sla.target + ' d'], ['SLA Real', r => r.sla.real == null ? '' : r.sla.real + ' d'], ['SLA Status', r => r.sla.status], ['Over By', r => r.sla.over && r.sla.over > 0 ? '+' + r.sla.over + ' d' : '']];
    let columns: Column[] = kind === 'ijr' ? [['Application Number', value('Application Number')], ['Applicant Name', value('Applicant Name')], ['Application Type', value('Application Type')], ['Status', value('Status')], ['Flow Process', value('Flow Process')], ['Request Date', value('Request Date')], ['Wilayah', value('Wilayah')], ['Cabang', value('Cabang')], ['CS BNI Direct', value('CS BNI Direct')], ['Total Day', r => r.payload._TotalDayNum === 0 ? 'Same Day' : text(r.payload['Total Day'])]] : kind === 'regional' ? [['Company', value('company')], ['Wilayah', value('region')], ['New/Maintenance', value('type')], ['TB Produk', value('product')], ['Implementor (HO)', value('implementor')], ['Status', value('status')], ['Email Sales', value('salesDate')], ['Dokumen Lengkap', value('docComplete')], ['Selesai Setting', value('settingDone')], ['Tanggal Done', value('doneDate')]] : [['No Reg', value('noreg')], ['Company', value('company')], ['Segment', value('segment')], ['Project Type', value('projectType')], ['Product', value('product')], ['Status Onboard', value('status')], ['Implementor', value('implementor')], ...slaColumns, ['Create Date', value('createDate')]];
    if (variant === 'sla') columns = kind === 'ijr' ? [['Application Number', value('Application Number')], ['Applicant', value('Applicant Name')], ['Type', value('Application Type')], ['Flow', value('Flow Process')], ['Wilayah', value('Wilayah')], ['PIC / Implementor', r => ['CS BNI Direct', 'Validator 1', 'Implementor 1', 'Implementor 2'].filter(key => text(r.payload[key])).map(key => text(r.payload[key]) + ' (' + key + ')').join(', ')], ...slaColumns] : kind === 'regional' ? [['Company', value('company')], ['Wilayah', value('region')], ['New/Maintenance', value('type')], ['TB Produk', value('product')], ['Implementor', value('implementor')], ...slaColumns] : columns;
    if (variant === 'duration') columns = [['Application Number', value('Application Number')], ['Applicant Name', value('Applicant Name')], ['Status', value('Status')], ['Flow Process', value('Flow Process')], ['Total Day', value('Total Day')], ['Total Day Cabang', value('Total Day Cabang')], ['Total Day TBS', value('Total Day TBS')], ['Request Date', value('Request Date')], ['Wilayah', value('Wilayah')]];
    if(diagnostics) columns.push(['Penyebab SLA',r=>{const issue=slaIssue(r,kind);return issue?t(issue.reason)+' \u2014 '+t(issue.detail):'\u2014';}]);
    const heading = title || (variant === 'sla' ? 'SLA Detail' : kind === 'regional' ? 'Implementation Detail' : kind === 'corporate' ? 'Corporate Application Detail' : 'Application Detail');
    return <section className="panel records"><div className="table-heading"><div><h3>{t(heading)}</h3><small>{rows.length.toLocaleString()} {t("records · klik detail untuk melihat seluruh informasi")}</small></div><button className="secondary" disabled={!rows.length} onClick={() => exportCsv(rows, kind)}><Download size={14}/>{t("CSV")}</button></div><div className="table-scroll"><table><thead><tr>{columns.map(([label]) => <th key={label} className={label==='Penyebab SLA'?'sla-diagnostic-cell':undefined}>{t(label)}</th>)}<th aria-label={t("Detail record")}/></tr></thead><tbody>{rows.slice(start, start + size).map(r => <tr key={r.id} onClick={() => onOpen(r)}>{columns.map(([label, get]) => <td key={label} className={label==='Penyebab SLA'?'sla-diagnostic-cell':undefined}>{/Status$|Status Onboard|SLA Status/.test(label) ? <Badge value={get(r)}/> : get(r) || '—'}</td>)}<td><button className="text-button" onClick={e => { e.stopPropagation(); onOpen(r); }}>{t("Detail")}</button></td></tr>)}</tbody></table>{!rows.length && <p className="empty">{t("Tidak ada data yang sesuai dengan filter.")}</p>}</div><div className="pagination"><span>{rows.length ? `${start + 1}–${Math.min(start + size, rows.length)} dari ${rows.length.toLocaleString()}` : '0 records'}</span><label>{t("Baris")}<select aria-label={t("Baris per halaman")} value={size} onChange={e => { setSize(Number(e.target.value)); setPage(1); }}>{[25, 50, 100].map(n => <option key={n}>{n}</option>)}</select></label><button className="icon-button" aria-label={t("Halaman sebelumnya")} disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft size={17}/></button><span>{current} {t("/")}{pages}</span><button className="icon-button" aria-label={t("Halaman berikutnya")} disabled={current >= pages} onClick={() => setPage(current + 1)}><ChevronRight size={17}/></button></div></section>;
}
export function Detail({ record, kind, canEdit, onClose, onDone, productName = (value: string) => value }: {
    record: MonitoringRecord;
    productName?: (value: string) => string;
    kind: DatasetKind;
    canEdit: boolean;
    onClose: () => void;
    onDone: (r: MonitoringRecord, note: string) => Promise<void>;
}) { const { t } = useLanguage(); 
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
        onClose(); }}><div className="dialog-head"><div><small>{t("DETAIL RECORD")}</small><h2>{text(record.payload[k.company])}</h2><p>{text(record.payload[k.id])}</p></div><button className="icon-button" aria-label={t("Tutup detail")} onClick={onClose}><X /></button></div><div className="detail-grid">{[...detailFields(record, kind),...(slaIssue(record,kind)?[['Penyebab SLA',t(slaIssue(record,kind)!.reason)+' \u2014 '+t(slaIssue(record,kind)!.detail)]]:[])].map(([label, value]) => <div key={label}><small>{t(label)}</small><p>{label === 'TB Produk' ? productName(value) : value}</p></div>)}</div>{kind === 'regional' && canEdit && record.payload.status !== 'Done' && <div className="done-form"><label>{t("Keterangan penyelesaian")}<textarea value={note} onChange={e => setNote(e.target.value)}/></label><button className="primary" disabled={busy} onClick={done}>{t(busy ? 'Menyimpan…' : 'Tandai Done')}</button>{error && <p className="error" role="alert">{error}</p>}</div>}</dialog>;
}
