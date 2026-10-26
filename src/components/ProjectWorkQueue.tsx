import { useEffect, useMemo, useState } from 'react';
import { type ApplicationKind, type MonitoringRecord, text } from '../types';
import { fields, status } from '../domain/analytics';
import { field } from '../piloting/model';
import { projectQueueState, selectProjectQueue } from '../domain/project-queues';
import { jakartaToday } from '../domain/work-calendar';
import { useLanguage } from '../lib/language';

export function ProjectWorkQueue({ rows, kind, overdue, onOpen }: { rows: MonitoringRecord[]; kind: ApplicationKind; overdue: boolean; onOpen: (row: MonitoringRecord) => void }) {
  const { t } = useLanguage();
  const [today, setToday] = useState(jakartaToday), [page, setPage] = useState(1);
  useEffect(() => { const timer = window.setInterval(() => setToday(jakartaToday()), 60000); return () => window.clearInterval(timer); }, []);
  const selected = useMemo(() => selectProjectQueue(rows, kind, overdue, today), [rows, kind, overdue, today]);
  useEffect(() => setPage(1), [selected]);
  const pages = Math.max(1, Math.ceil(selected.length / 25)), current = Math.min(page, pages);
  const key = kind === 'piloting' ? { id: field.id, company: field.company, product: field.product, person: field.person } : fields[kind];
  return <section className="panel records project-work-queue"><div className="table-heading"><div>
    <h3>{t(overdue ? 'Project Overdue' : 'Project Berjalan')}</h3><small>{selected.length.toLocaleString()} {t('pekerjaan sesuai filter dan hak akses')}</small>
  </div></div>
  <p className="muted">{t(overdue ? 'Pekerjaan yang masih terbuka dan durasi berjalannya telah melewati target SLA.' : 'Pekerjaan yang masih terbuka, termasuk pekerjaan menunggu dan dalam proses. Pekerjaan selesai, reject/retur, dibatalkan, dan handover tidak termasuk.')}</p>
  <div className="table-scroll"><table><thead><tr>{['Nomor Permohonan', 'Perusahaan / Pemohon', 'Produk', 'PIC / Implementor', 'Status Pekerjaan', 'Durasi Berjalan', 'Target SLA', 'Lewat SLA', 'Detail'].map(label => <th key={label}>{t(label)}</th>)}</tr></thead><tbody>
    {selected.slice((current - 1) * 25, current * 25).map(row => { const state = projectQueueState(row, kind, today); return <tr key={row.id}>
      <td>{text(row.payload[key.id]) || '—'}</td><td>{text(row.payload[key.company]) || '—'}</td><td>{kind === 'ijr' ? 'BNIdirect' : text(row.payload[key.product]) || '—'}</td>
      <td>{kind === 'ijr' ? [row.payload['Implementor 1'], row.payload['Implementor 2']].map(text).filter(Boolean).join(' / ') || '—' : text(row.payload[key.person]) || '—'}</td>
      <td>{kind === 'piloting' ? text(row.payload[field.status]) : status(row, kind)}</td><td>{state.age === null ? '—' : `${state.age} ${t('hari kerja')}`}</td><td>{state.target === null ? '—' : `${state.target} ${t('hari kerja')}`}</td>
      <td>{state.overdue ? `+${state.age! - state.target!} ${t('hari kerja')}` : '—'}</td><td><button className="text-button" onClick={() => onOpen(row)}>{t('Detail')}</button></td>
    </tr>; })}
  </tbody></table>{!selected.length && <p className="empty">{t('Tidak ada pekerjaan pada kategori dan filter ini.')}</p>}</div>
  <p className="muted">{t('Durasi atau target yang belum tersedia ditandai — dan tidak dianggap overdue. Pekerjaan tanpa durasi tetap muncul pada Project Berjalan.')}</p>
  <div className="pagination"><span>{selected.length.toLocaleString()} {t('pekerjaan')}</span><button className="secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>{t('Sebelumnya')}</button><span>{current} / {pages}</span><button className="secondary" disabled={current >= pages} onClick={() => setPage(current + 1)}>{t('Berikutnya')}</button></div>
  </section>;
}
