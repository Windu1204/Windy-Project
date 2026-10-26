import { useEffect, useMemo, useState } from 'react';
import { type ApplicationKind, type MonitoringRecord, text } from '../types';
import { fields, status } from '../domain/analytics';
import { field } from '../piloting/model';
import { projectQueueState, selectProjectQueue, projectPeople, filterProjectPerson } from '../domain/project-queues';
import { jakartaToday } from '../domain/work-calendar';
import { useLanguage } from '../lib/language';

export function ProjectWorkQueue({ rows, kind, onOpen }: { rows: MonitoringRecord[]; kind: ApplicationKind; onOpen: (row: MonitoringRecord) => void }) {
  const { t } = useLanguage();
  const [today, setToday] = useState(jakartaToday), [page, setPage] = useState(1);
  const [person, setPerson] = useState(''), [overdue, setOverdue] = useState(false);
  useEffect(() => { const timer = window.setInterval(() => setToday(jakartaToday()), 60000); return () => window.clearInterval(timer); }, []);
  const open = useMemo(() => selectProjectQueue(rows, kind, false, today), [rows, kind, today]);
  const names = useMemo(() => {
    const unique = new Map<string, string>();
    for (const row of open) for (const name of projectPeople(row, kind)) if (!unique.has(name.toLocaleLowerCase())) unique.set(name.toLocaleLowerCase(), name);
    return [...unique.values()].sort((a,b) => a.localeCompare(b));
  }, [open, kind]);
  const activePerson = names.includes(person) ? person : '';
  useEffect(() => { if (person && !names.includes(person)) setPerson(''); }, [names, person]);
  const scoped = useMemo(() => filterProjectPerson(open, kind, activePerson), [open, kind, activePerson]);
  const overdueCount = useMemo(() => scoped.filter(row => projectQueueState(row, kind, today).overdue).length, [scoped, kind, today]);
  const selected = useMemo(() => scoped.filter(row => !overdue || projectQueueState(row, kind, today).overdue).sort((a,b) => {
    const x=projectQueueState(a,kind,today),y=projectQueueState(b,kind,today);
    return Number(y.overdue)-Number(x.overdue) || (y.overdue ? (y.age! - y.target!) - (x.age! - x.target!) : 0);
  }), [scoped, kind, overdue, today]);
  useEffect(() => setPage(1), [selected]);
  const pages = Math.max(1, Math.ceil(selected.length / 25)), current = Math.min(page, pages);
  const key = kind === 'piloting' ? { id: field.id, company: field.company, product: field.product, person: field.person } : fields[kind];
  return <section className="panel records project-work-queue"><div className="table-heading"><div>
    <h3>{t('Project Berjalan & Overdue')}</h3><small>{selected.length.toLocaleString()} {t('pekerjaan sesuai filter dan hak akses')}</small>
  </div></div>
  <div className="project-queue-controls">
    <label>{t('Filter nama PIC / implementor')}<select aria-label={t('Filter nama PIC / implementor')} value={activePerson} onChange={e=>setPerson(e.target.value)}><option value="">{t('Semua PIC / implementor')}</option>{names.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
    <div className="project-queue-modes" role="group" aria-label={t('Filter pekerjaan berjalan')}>
      <button className={'secondary'+(!overdue?' selected':'')} aria-pressed={!overdue} onClick={()=>setOverdue(false)}>{t('Semua Berjalan')} <b>{scoped.length.toLocaleString()}</b></button>
      <button className={'secondary overdue-mode'+(overdue?' selected':'')} aria-pressed={overdue} onClick={()=>setOverdue(true)}>Overdue <b>{overdueCount.toLocaleString()}</b></button>
    </div>
  </div>
  <div className="table-scroll"><table><thead><tr>{['Nomor Permohonan', 'Perusahaan / Pemohon', 'Produk', 'PIC / Implementor', 'Status Pekerjaan', 'Status Monitoring', 'Durasi Berjalan', 'Target SLA', 'Lewat SLA', 'Detail'].map(label => <th key={label}>{t(label)}</th>)}</tr></thead><tbody>
    {selected.slice((current - 1) * 25, current * 25).map(row => { const state = projectQueueState(row, kind, today); return <tr key={row.id}>
      <td>{text(row.payload[key.id]) || '—'}</td><td>{text(row.payload[key.company]) || '—'}</td><td>{kind === 'ijr' ? 'BNIdirect' : text(row.payload[key.product]) || '—'}</td>
      <td>{projectPeople(row,kind).join(' / ') || '—'}</td>
      <td>{kind === 'piloting' ? text(row.payload[field.status]) : status(row, kind)}</td><td><span className={'badge '+(state.overdue?'red':state.age===null||state.target===null?'amber':'blue')}>{state.overdue?'Overdue':t(state.age===null||state.target===null?'Belum dapat dinilai':'Berjalan')}</span></td><td>{state.age === null ? '—' : `${state.age} ${t('hari kerja')}`}</td><td>{state.target === null ? '—' : `${state.target} ${t('hari kerja')}`}</td>
      <td>{state.overdue ? `+${state.age! - state.target!} ${t('hari kerja')}` : '—'}</td><td><button className="text-button" onClick={() => onOpen(row)}>{t('Detail')}</button></td>
    </tr>; })}
  </tbody></table>{!selected.length && <p className="empty">{t('Tidak ada pekerjaan pada kategori dan filter ini.')}</p>}</div>
  <p className="muted">{t('Durasi atau target yang belum tersedia ditandai — dan tidak dianggap overdue. Pekerjaan tanpa durasi tetap muncul pada Project Berjalan.')}</p>
  <div className="pagination"><span>{selected.length.toLocaleString()} {t('pekerjaan')}</span><button className="secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>{t('Sebelumnya')}</button><span>{current} / {pages}</span><button className="secondary" disabled={current >= pages} onClick={() => setPage(current + 1)}>{t('Berikutnya')}</button></div>
  </section>;
}
