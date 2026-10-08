import { useLanguage } from '../lib/language';

import { useMemo, useState, useEffect, useRef } from 'react';

import { type DatasetKind, type MonitoringRecord, text } from '../types';

import { people, status, fields } from '../domain/analytics';

import { Badge } from './Records';

import { Panel } from './Charts';



interface Props { individual?:boolean; personNames?:string[]; productName?: (value: string) => string; rows: MonitoringRecord[]; kind: DatasetKind; canEdit: boolean; onOpen: (row: MonitoringRecord) => void; onDone: (row: MonitoringRecord, note: string) => Promise<void> }

export default function PersonWork({ individual=false, personNames, rows, kind, canEdit, onOpen, onDone, productName = (value: string) => value }: Props) { const { t } = useLanguage(); 

  const [selected, setSelected] = useState(''), [query, setQuery] = useState(''), [mode, setMode] = useState('all'), [page,setPage]=useState(1);

  const [confirmation, setConfirmation] = useState<MonitoringRecord | null>(null), [message, setMessage] = useState('');

  const assignments = useMemo(() => {

    const map = new Map<string, MonitoringRecord[]>();

    for (const row of rows) for (const name of people(row, kind)) { const list = map.get(name) || []; list.push(row); map.set(name, list); }

    return [...map].filter(([name])=>!personNames||personNames.some(n=>n.trim().toLocaleLowerCase()===name.toLocaleLowerCase())).map(([name, records]) => ({ name, records })).sort((a, b) => b.records.length - a.records.length || a.name.localeCompare(b.name));

  }, [rows, kind, personNames]);

  useEffect(()=>{if(!selected&&personNames&&assignments.length===1)setSelected(assignments[0].name);},[assignments,selected,personNames]);

  const current = assignments.find(p => p.name === selected), assigned = current?.records || [];

  useEffect(() => { if (selected && !current) { setSelected(''); setMode('all'); } }, [selected, current]);

  const done = (r: MonitoringRecord) => kind === 'ijr' ? /proses selesai|done|completed/i.test(text(r.payload.Status)) : kind === 'regional' ? text(r.payload.status).toLowerCase() === 'done' : status(r, kind) === 'Done';

  const waiting = (r: MonitoringRecord) => (kind === 'ijr' ? /waiting|approval|pending/i : kind === 'regional' ? /pending|waiting/i : /pending|waiting|retur|return|approval|submitted|submited/i).test(text(r.payload[fields[kind].status]));

  const overdue = (r: MonitoringRecord) => r.sla.status === 'Overdue';

  const category = (r: MonitoringRecord) => overdue(r) ? 'Overdue' : waiting(r) ? 'Waiting / Pending' : done(r) ? 'Completed' : 'Active / On Progress';

  const shown = assigned.filter(r => mode === 'within' ? r.sla.status==='Within SLA' : mode === 'measured' ? ['Within SLA','Overdue'].includes(r.sla.status) : mode === 'done' ? done(r) : mode === 'active' ? !done(r) : mode === 'waiting' ? waiting(r) : mode === 'overdue' ? overdue(r) : true);

  // Match the v78 workload summary, including its Number(null) treatment in Avg Process Day.

  const days = assigned.map(r => Number(r.payload._TotalDayNum)).filter(Number.isFinite);
  const measured = assigned.filter(r => ['Within SLA', 'Overdue'].includes(r.sla.status));
  const within = measured.filter(r => r.sla.status === 'Within SLA').length;
  const validDurations = assigned.filter(done).map(r => r.sla.real).filter((n): n is number => n !== null && Number.isFinite(n) && n >= 0);
  const average = validDurations.length ? validDurations.reduce((sum,n) => sum+n,0)/validDurations.length : null;

  const kpis: [string, number | string][] = [['Assigned Records', assigned.length], ['Active Work', assigned.filter(r => !done(r)).length], ['Completed', assigned.filter(done).length], ['Waiting / Pending', assigned.filter(waiting).length], ['Overdue', assigned.filter(overdue).length]];

  const headers = kind === 'ijr' ? ['Application', 'Applicant', 'Role', 'Status', 'Work Category', 'Flow', 'Wilayah', 'Process Day'] : kind === 'regional' ? ['Company', 'CID', 'Product', 'Status', 'Work Category', 'Wilayah', 'Email Sales', 'Dokumen Lengkap', 'Selesai Setting', 'Tanggal Done', 'SLA Status', 'SLA Real'] : ['No. Reg', 'Company', 'Product', 'Status', 'Work Category', 'SLA Status', 'SLA Real'];

  const cells = (r: MonitoringRecord) => {

    const p = r.payload;

    if (kind === 'ijr') return [p['Application Number'], p['Applicant Name'], ['Implementor 1', 'Implementor 2'].filter(key => text(p[key]) === selected).join(' + '), p.Status, category(r), p['Flow Process'], p.Wilayah, p['Total Day']];

    if (kind === 'regional') return [p.company, p.cid, productName(text(p.product)), p.status, category(r), p.region, p.salesDate, p.docComplete, p.settingDone, p.doneDate, r.sla.status, r.sla.real == null ? '-' : r.sla.real + ' d'];

    return [p.noreg, p.company, p.product, p.status, category(r), r.sla.status, r.sla.real == null ? '' : r.sla.real + ' d'];

  };

  useEffect(()=>setPage(1),[selected,mode,rows]);

  const list = assignments.filter(p => p.name.toLowerCase().includes(query.trim().toLowerCase())), max = Math.max(1, ...assignments.map(p => p.records.length));

  return <Panel title={t("KPI Per Person")} hint={t("Klik nama untuk melihat KPI dan pekerjaan yang sedang ditangani.")} className={"person-work"+(individual?" individual-work":"")}>

    {!individual&&selected && <button className="secondary person-selected" onClick={() => { setSelected(''); setMode('all'); }}>{t("Viewing:")} {selected} {t("×")}</button>}

    <div className="person-layout"><div className="person-list"><p className="muted">{kind === 'ijr' ? 'Implementor 1 & 2' : 'Implementor'} {t("pada filter dashboard aktif")}</p>

      {<label>{t("Cari implementor")}<input type="search" aria-label={t("Cari nama implementor")} placeholder={t("Cari nama implementor...")} value={query} onChange={e => setQuery(e.target.value)}/></label>}

      <div className="person-list-items">{list.slice(0, 100).map(p => <button className={'person-row ' + (selected === p.name ? 'active' : '')} key={p.name} onClick={() => { setSelected(selected === p.name ? '' : p.name); setMode('all'); }}><span><b>{p.name}</b><small>{p.records.length.toLocaleString()} {t("assigned records")}</small></span><i><span style={{ width: p.records.length / max * 100 + '%' }}/></i><strong>{p.records.length.toLocaleString()}</strong></button>)}{!list.length && <p className="empty">{t("Nama implementor tidak ditemukan.")}</p>}</div>

    </div><div className="person-detail">{!current ? <p className="empty">{t("Pilih nama implementor untuk melihat KPI dan detail khusus orang tersebut.")}</p> : <>

      <h3>{selected}</h3><div className="person-kpis">{kpis.map(([label, n],i) => <button key={label} disabled={label==='Avg Process Day'} onClick={()=>setMode(['all','active','done','waiting','overdue'][i])}><small>{t(label)}</small><b>{typeof n === 'number' ? n.toLocaleString() : n}</b></button>)}</div>

      <div className="person-metrics"><button className="secondary" onClick={()=>setMode("measured")}>{t("Measurable")}: {measured.length.toLocaleString()}</button><button className="secondary" onClick={()=>setMode("within")}>Within SLA: {within.toLocaleString()}</button>{kind==='ijr'&&<span>{t("Avg Process Day")}: <b>{days.length?(days.reduce((a,b)=>a+b,0)/days.length).toFixed(1):"—"}</b></span>}{kind==='corporate'&&<><span>{t('Rata-rata Hari Kerja')}: <b>{average===null?'—':average.toFixed(1)}</b><small>{t('Pekerjaan Done dengan durasi valid')}: {validDurations.length.toLocaleString()}</small></span><span>{t('Pencapaian SLA')}: <b>{measured.length?(within/measured.length*100).toFixed(1)+'%':'—'}</b><small>Within SLA / {t('Measurable')}</small></span></>}</div>

      <div className="person-detail-toolbar"><b>{t("All Assigned Records ·")}{shown.length.toLocaleString()} {t("records")}</b><div className="person-status-filters">{[['all', 'All Status'], ['active', 'Active'], ['done', 'Completed'], ['waiting', 'Waiting / Pending'], ['overdue', 'Overdue']].map(([id, label]) => <button key={id} className={mode === id ? 'active' : ''} onClick={() => setMode(id)}>{t(label)}</button>)}</div></div>

      <div className="table-scroll"><table><thead><tr>{headers.map(h => <th key={h}>{t(h)}</th>)}</tr></thead><tbody>{shown.slice((page-1)*10,page*10).map(r => <tr key={r.id} onClick={() => onOpen(r)}>{cells(r).map((v, i) => <td key={headers[i]}>{headers[i] === 'Work Category' ? <Badge value={text(v)}/> : text(v)}{headers[i] === 'Status' && r.payload.dashboardUpdatedAt && <small className="update-stamp">{t("Updated via Dashboard")}</small>}</td>)}{kind === 'regional' && canEdit && <td>{!done(r) ? <button className="secondary" disabled={!canEdit} onClick={e => { e.stopPropagation(); setConfirmation(r); }}>{t("Update to Done")}</button> : r.payload.dashboardUpdatedAt ? <small>{t("Updated via Dashboard")}</small> : '—'}</td>}</tr>)}</tbody></table><div className="pagination"><button className="secondary" disabled={page<=1} onClick={()=>setPage(page-1)}>{t('Sebelumnya')}</button><span>{page} / {Math.max(1,Math.ceil(shown.length/10))}</span><button className="secondary" disabled={page>=Math.ceil(shown.length/10)} onClick={()=>setPage(page+1)}>{t('Berikutnya')}</button></div>{!shown.length && <p className="empty">{t("Tidak ada record untuk status ini pada filter saat ini.")}</p>}</div>

    </>}</div></div>{message && <p role="status" className="success">{message}</p>}

    {confirmation && <DoneConfirmation row={confirmation} onClose={() => setConfirmation(null)} onSave={async note => { await onDone(confirmation, note); setConfirmation(null); setMessage('Status berhasil diubah menjadi Done · Updated via Dashboard'); }}/>} </Panel>;

}

function DoneConfirmation({ row, onClose, onSave }: { row: MonitoringRecord; onClose: () => void; onSave: (note: string) => Promise<void> }) { const { t } = useLanguage(); 

  const ref = useRef<HTMLDialogElement>(null), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');

  useEffect(() => { ref.current?.showModal(); }, []);

  return <dialog ref={ref} className="done-confirmation" onClose={onClose}><h3>{t("Update Status to Done")}</h3><p className="muted">{t("Konfirmasi penyelesaian pekerjaan Regional - Non BNIDirect.")}</p><div className="detail-grid">{[['Company', row.payload.company], ['Implementor', row.payload.implementor], ['TB Produk', row.payload.product], ['Current Status', row.payload.status]].map(([label, value]) => <div key={text(label)}><small>{text(label)}</small><p>{text(value)}</p></div>)}</div><label>{t("Keterangan (Opsional)")}<textarea maxLength={500} rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder={t("Tulis keterangan penyelesaian pekerjaan...")}/></label><p className="notice">{t("Hanya status yang diubah menjadi Done. Tanggal milestone, SLA Real, SLA Target, produk, wilayah, dan data lain tetap.")}</p>{error && <p role="alert" className="error">{error}</p>}<div className="button-row"><button className="secondary" disabled={busy} onClick={onClose}>{t("Cancel")}</button><button className="primary" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onSave(note); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); } }}>{busy ? 'Menyimpan…' : 'Update to Done'}</button></div></dialog>;

}

