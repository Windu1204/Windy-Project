import { type MonitoringRecord, type DatasetKind, text } from '../types';
import { durationBucket, metrics } from '../domain/analytics';
import { Panel } from './Charts';
export interface DurationSelection { key: string; bucket: string }
export function DurationCards({ rows, selected, onSelect }: { rows: MonitoringRecord[]; selected: DurationSelection | null; onSelect: (value: DurationSelection | null) => void }) {
  return <div className="duration-summaries">{[['_TotalDayNum', 'Total Process'], ['_CabangDayNum', 'Cabang Process'], ['_TBSDayNum', 'TBS Process']].map(([key, label], i) => <section className={'duration-card tone-' + i} key={key}><h3>{label}</h3><div className="duration-grid">{['Same Day (0 Hari)', '1 Hari', '2 Hari', '>2 Hari'].map(bucket => <button key={bucket} className={selected?.key === key && selected.bucket === bucket ? 'active' : ''} onClick={() => onSelect(selected?.key === key && selected.bucket === bucket ? null : { key, bucket })}><strong>{rows.filter(r => durationBucket(r.payload[key]) === bucket).length.toLocaleString()}</strong><span>{bucket === 'Same Day (0 Hari)' ? 'Same Day' : bucket}</span></button>)}</div></section>)}</div>;
}
export function SlaPeople({ rows, kind, selected, onSelect }: { rows: MonitoringRecord[]; kind: DatasetKind; selected: string; onSelect: (name: string) => void }) {
  const map = new Map<string, { name: string; role: string; rows: MonitoringRecord[] }>();
  for (const row of rows) for (const role of kind === 'ijr' ? ['CS BNI Direct', 'Validator 1', 'Implementor 1', 'Implementor 2'] : ['implementor']) {
    const name = text(row.payload[role]); if (!name) continue;
    const key = name + '|' + role, item = map.get(key) || { name, role, rows: [] }; item.rows.push(row); map.set(key, item);
  }
  const people = [...map.values()].map(p => ({ ...p, ...metrics(p.rows, kind) })).sort((a, b) => b.overdue - a.overdue || b.total - a.total || a.name.localeCompare(b.name));
  return <Panel title={kind === 'ijr' ? 'KPI SLA per PIC / Implementor' : 'KPI SLA per Implementor'} hint="Klik nama untuk melihat case orang tersebut pada SLA Detail."><div className="table-scroll"><table><thead><tr><th>{kind === 'ijr' ? 'Person' : 'Implementor'}</th>{kind === 'ijr' && <th>Role</th>}<th>Total Case</th><th>Measurable</th><th>Within SLA</th><th>Overdue</th><th>SLA Achievement</th><th>Avg SLA Real</th></tr></thead><tbody>{people.map(p => <tr key={p.name + '|' + p.role} className={selected === p.name ? 'selected-row' : ''}><td><button className="text-button" onClick={() => onSelect(selected === p.name ? '' : p.name)}>{p.name}</button></td>{kind === 'ijr' && <td>{p.role}</td>}<td>{p.total}</td><td>{p.measurable}</td><td>{p.within}</td><td>{p.overdue}</td><td>{p.achievement.toFixed(1)}%</td><td>{p.average.toFixed(1)} d</td></tr>)}</tbody></table></div><p className="muted">{selected ? 'Selected: ' + selected + ' · klik nama yang sama untuk kembali ke semua person.' : 'Klik nama untuk menampilkan case orang tersebut pada SLA Detail.'}</p></Panel>;
}
