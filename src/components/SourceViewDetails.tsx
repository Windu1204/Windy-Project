import { useMemo, useState } from 'react';
import { type MonitoringRecord, type DatasetKind, text } from '../types';
import { durationBucket, metrics } from '../domain/analytics';
import { Panel } from './Charts';
export interface DurationSelection { key: string; bucket: string }
export function DurationCards({ rows, selected, onSelect }: { rows: MonitoringRecord[]; selected: DurationSelection | null; onSelect: (value: DurationSelection | null) => void }) {
  return <div className="duration-summaries">{[['_TotalDayNum', 'Total Process'], ['_CabangDayNum', 'Cabang Process'], ['_TBSDayNum', 'TBS Process']].map(([key, label], i) => <section className={'duration-card tone-' + i} key={key}><h3>{label}</h3><div className="duration-grid">{['Same Day (0 Hari)', '1 Hari', '2 Hari', '>2 Hari'].map(bucket => <button key={bucket} className={selected?.key === key && selected.bucket === bucket ? 'active' : ''} onClick={() => onSelect(selected?.key === key && selected.bucket === bucket ? null : { key, bucket })}><strong>{rows.filter(r => durationBucket(r.payload[key]) === bucket).length.toLocaleString()}</strong><span>{bucket === 'Same Day (0 Hari)' ? 'Same Day' : bucket}</span></button>)}</div></section>)}</div>;
}
export function SlaPeople({ rows, kind, selected, onSelect }: { rows: MonitoringRecord[]; kind: DatasetKind; selected: string; onSelect: (name: string) => void }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const people = useMemo(() => {
  const map = new Map<string, { name: string; role: string; rows: MonitoringRecord[] }>();
  for (const row of rows) for (const role of kind === 'ijr' ? ['CS BNI Direct', 'Validator 1', 'Implementor 1', 'Implementor 2'] : ['implementor']) {
    const name = text(row.payload[role]); if (!name) continue;
    const key = name + '|' + role, item = map.get(key) || { name, role, rows: [] }; item.rows.push(row); map.set(key, item);
  }
  return [...map.values()].map(p => ({ ...p, ...metrics(p.rows, kind) })).sort((a, b) => b.overdue - a.overdue || b.total - a.total || a.name.localeCompare(b.name));
  }, [rows, kind]);
  const search = query.trim().toLocaleLowerCase();
  const matches = people.filter(p => p.name.toLocaleLowerCase().includes(search));
  const pages = Math.max(1, Math.ceil(matches.length / 10));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * 10;
  return <Panel className="sla-people" title={kind === 'ijr' ? 'KPI SLA per PIC / Implementor' : 'KPI SLA per Implementor'} hint="Klik nama untuk melihat case orang tersebut pada SLA Detail."><label style={{ maxWidth: 360, marginBottom: 16 }}>Cari nama PIC / Implementor<input type="search" placeholder="Ketik nama…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label><div className="table-scroll"><table><thead><tr><th>{kind === 'ijr' ? 'Person' : 'Implementor'}</th>{kind === 'ijr' && <th>Role</th>}<th>Total Case</th><th>Measurable</th><th>Within SLA</th><th>Overdue</th><th>SLA Achievement</th><th>Avg SLA Real</th></tr></thead><tbody>{matches.slice(start, start + 10).map(p => <tr key={p.name + '|' + p.role} className={selected === p.name ? 'selected-row' : ''}><td><button className="text-button" onClick={() => onSelect(selected === p.name ? '' : p.name)}>{p.name}</button></td>{kind === 'ijr' && <td>{p.role}</td>}<td>{p.total}</td><td>{p.measurable}</td><td>{p.within}</td><td>{p.overdue}</td><td>{p.achievement.toFixed(1)}%</td><td>{p.average.toFixed(1)} d</td></tr>)}</tbody></table></div>{matches.length === 0 && <p className="muted" role="status">Tidak ada nama yang cocok dengan pencarian.</p>}<nav className="pagination" aria-label="Halaman KPI SLA"><span aria-live="polite">{matches.length ? `${start + 1}–${Math.min(start + 10, matches.length)} dari ${matches.length}` : '0 hasil'}</span><button className="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Halaman {currentPage} / {pages}</span><button className="secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></nav><p className="muted">{selected ? 'Selected: ' + selected + ' · klik nama yang sama untuk kembali ke semua person.' : 'Klik nama untuk menampilkan case orang tersebut pada SLA Detail.'}</p></Panel>;
}
