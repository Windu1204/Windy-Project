import { useMemo, useState } from 'react';
import { type MonitoringRecord, type DatasetKind, text } from '../types';
import { isDone, metrics } from '../domain/analytics';
import { Panel } from './Charts';
import { Records } from './Records';
import { useLanguage } from '../lib/language';
type Category = 'total' | 'done' | 'active' | 'measurable' | 'within' | 'overdue';
export function WorkloadKpi({ rows, kind, onOpen, productName }: { productName?: (value: string) => string; rows: MonitoringRecord[]; kind: DatasetKind; onOpen: (row: MonitoringRecord) => void }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState(''), [page, setPage] = useState(1);
  const [selection, setSelection] = useState<{ name: string; role: string; category: Category } | null>(null);
  const people = useMemo(() => {
    const groups = new Map<string, { name: string; role: string; records: MonitoringRecord[] }>();
    for (const row of rows) for (const role of kind === 'ijr' ? ['CS BNI Direct', 'Validator 1', 'Implementor 1', 'Implementor 2'] : ['implementor']) {
      const name = text(row.payload[role]); if (!name) continue;
      const key = JSON.stringify([name, role]);
      const person = groups.get(key) || { name, role, records: [] };
      person.records.push(row); groups.set(key, person);
    }
    return [...groups.values()].map(person => ({ ...person, ...metrics(person.records, kind) })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name) || a.role.localeCompare(b.role));
  }, [rows, kind]);
  const matches = people.filter(person => person.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const pages = Math.max(1, Math.ceil(matches.length / 10)), current = Math.min(page, pages), start = (current - 1) * 10;
  const selected = people.find(person => person.name === selection?.name && person.role === selection.role);
  const details = selected?.records.filter(row => selection?.category === 'done' ? isDone(row, kind) : selection?.category === 'active' ? !isDone(row, kind) : selection?.category === 'measurable' ? ['Within SLA', 'Overdue'].includes(row.sla.status) : selection?.category === 'within' ? row.sla.status === 'Within SLA' : selection?.category === 'overdue' ? row.sla.status === 'Overdue' : true) || [];
  const labels: Record<Category, string> = { total: 'Total Pekerjaan', done: 'Selesai', active: 'Aktif', measurable: 'Terukur SLA', within: 'Within SLA', overdue: 'Overdue' };
  return <><Panel className="sla-people workload-kpi" title="KPI per Orang" hint="Klik angka untuk melihat pekerjaan sesuai orang, peran, dan kategori.">
    <label className="kpi-name-search">{t('Cari nama PIC / Implementor')}<input type="search" placeholder={t('Ketik nama…')} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}/></label>
    <div className="table-scroll"><table><thead><tr><th>{t('Nama')}</th><th>{t('Peran')}</th>{Object.values(labels).map(label => <th key={label}>{t(label)}</th>)}<th>{t('Pencapaian SLA')}</th><th>{t('Avg SLA Real')}</th></tr></thead><tbody>{matches.slice(start, start + 10).map(person => <tr key={JSON.stringify([person.name, person.role])} className={selected === person ? 'selected-row' : ''}><td><button className="text-button" onClick={() => setSelection({ name: person.name, role: person.role, category: 'total' })}>{person.name}</button></td><td>{kind === 'ijr' ? person.role : 'Implementor'}</td>{(Object.keys(labels) as Category[]).map(category => { const value = category === 'active' ? person.total - person.done : person[category]; return <td key={category}><button className="text-button" aria-label={`${person.name} · ${t(labels[category])}: ${value}`} onClick={() => setSelection({ name: person.name, role: person.role, category })}>{value.toLocaleString()}</button></td>; })}<td>{person.achievement.toFixed(1)}%</td><td>{person.average.toFixed(1)} {t('hari')}</td></tr>)}</tbody></table></div>
    {!matches.length && <p className="muted" role="status">{t('Tidak ada nama yang cocok dengan pencarian.')}</p>}
    <nav className="pagination" aria-label={t('Halaman KPI')}><span aria-live="polite">{matches.length ? `${start + 1}–${Math.min(start + 10, matches.length)} ${t('dari')} ${matches.length}` : t('0 hasil')}</span><button className="secondary" disabled={current === 1} onClick={() => setPage(current - 1)}>{t('Previous')}</button><span>{t('Halaman')} {current} / {pages}</span><button className="secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>{t('Next')}</button></nav>
  </Panel>{selected && selection && <><div className="button-row kpi-detail-toolbar"><b>{selected.name} · {kind === 'ijr' ? selected.role : 'Implementor'}</b><button className="secondary" onClick={() => setSelection(null)}>{t('Tutup detail KPI')}</button></div><Records productName={productName} rows={details} kind={kind} variant="sla" onOpen={onOpen} title={`${t('Detail')} ${t(labels[selection.category])} — ${selected.name}`}/></>}</>;
}
