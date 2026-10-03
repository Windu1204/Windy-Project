import { useLanguage } from '../lib/language';
import { type MonitoringRecord, type DatasetKind } from '../types';
import { durationBucket } from '../domain/analytics';
import { Panel } from './Charts';
export interface DurationSelection { key: string; bucket: string }
export function DurationCards({ rows, selected, onSelect }: { rows: MonitoringRecord[]; selected: DurationSelection | null; onSelect: (value: DurationSelection | null) => void }) {
  const { t } = useLanguage();
  const card = (key: string, label: string, i: number) => <section className={'duration-card tone-' + i} key={key}><h3>{t(label)}</h3><div className="duration-grid">{['Same Day (0 Hari)', '1 Hari', '2 Hari', '>2 Hari'].map(bucket => <button key={bucket} className={selected?.key === key && selected.bucket === bucket ? 'active' : ''} onClick={() => onSelect(selected?.key === key && selected.bucket === bucket ? null : { key, bucket })}><strong>{rows.filter(r => durationBucket(r.payload[key]) === bucket).length.toLocaleString()}</strong><span>{t(bucket === 'Same Day (0 Hari)' ? 'Same Day' : bucket)}</span></button>)}</div></section>;
  return <div className="duration-overview">{card('_TotalDayNum', 'Durasi Penyelesaian', 0)}<details className="duration-breakdown"><summary>{t('Rincian Durasi Cabang & TBS')}</summary><div className="duration-summaries">{card('_CabangDayNum', 'Durasi di Cabang', 1)}{card('_TBSDayNum', 'Durasi di TBS', 2)}</div></details></div>;
}
