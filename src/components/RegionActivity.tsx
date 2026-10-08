import { type MonitoringRecord, text } from '../types';
import { counts, status } from '../domain/analytics';
import { useLanguage } from '../lib/language';
import { Panel } from './Charts';

export function RegionActivity({ rows, onSelect }: {
  rows: MonitoringRecord[];
  onSelect: (region: string, completed: boolean) => void;
}) {
  const { t } = useLanguage();
  const regions = counts(rows, row => text(row.payload.region) || '—');
  const peak = Math.max(1, ...regions.map(([, total]) => total));
  return <Panel title="Volume dan Selesai per Wilayah" hint="Klik bar untuk melihat pekerjaan sesuai wilayah dan kategori.">
    <div className="region-activity-legend"><span><i className="volume-key"/>{t('Volume')}</span><span><i className="completed-key"/>{t('Selesai')}</span></div>
    <div className="region-activity">{regions.map(([region, total]) => {
      const completed = rows.filter(row => (text(row.payload.region) || '—') === region && status(row, 'regional') === 'Done').length;
      return <div className="region-activity-row" key={region}><strong>{region}</strong><div>{[[false, total], [true, completed]].map(([done, value]) => {
        const n = Number(value), label = t(done ? 'Selesai' : 'Volume');
        return <button key={label} className={'region-activity-bar ' + (done ? 'completed' : 'volume')} aria-label={`${region} · ${label}: ${n}`} onClick={() => onSelect(region, Boolean(done))}>
          <span>{label}</span><span className="bar-track"><i style={{ width: `${n / peak * 100}%` }}/></span><b>{n.toLocaleString()}</b>
        </button>;
      })}</div></div>;
    })}{!regions.length && <p className="empty">{t('Tidak ada data.')}</p>}</div>
  </Panel>;
}
