import { type MonitoringRecord, type DatasetKind } from '../types';
import { counts, isDone } from '../domain/analytics';
import { regionName, validRegion } from '../domain/region-details';
import { useLanguage } from '../lib/language';
import { Panel } from './Charts';

export function RegionActivity({ rows, kind='regional', selected, onSelect }: {
  rows: MonitoringRecord[];
  kind?: DatasetKind;
  selected?: {region:string;completed:boolean}|null;
  onSelect: (region: string, completed: boolean) => void;
}) {
  const { t } = useLanguage();
  const regions = counts(rows, row => regionName(row,kind)).filter(([name])=>validRegion(name,kind));
  const peak = Math.max(1, ...regions.map(([, total]) => total));
  return <Panel title="Jumlah project dan Project done per Wilayah" hint="Klik bar untuk melihat pekerjaan sesuai wilayah dan kategori.">
    <div className="region-activity-legend"><span><i className="volume-key"/>{t('Jumlah project')}</span><span><i className="completed-key"/>{t('Project done')}</span></div>
    <div className="region-activity">{regions.map(([region, total]) => {
      const completed = rows.filter(row => regionName(row,kind) === region && isDone(row,kind)).length;
      return <div className="region-activity-row" key={region}><strong>{region}</strong><div>{[[false, total], [true, completed]].map(([done, value]) => {
        const n = Number(value), label = t(done ? 'Project done' : 'Jumlah project');
        const active=selected?.region===region&&selected.completed===Boolean(done);
        return <button key={label} aria-pressed={active} className={'region-activity-bar ' + (done ? 'completed' : 'volume')+(active?' selected':'')} aria-label={`${region} · ${label}: ${n}`} onClick={() => onSelect(region, Boolean(done))}>
          <span>{label}</span><span className="bar-track"><i style={{ width: `${n / peak * 100}%` }}/></span><b>{n.toLocaleString()}</b>
        </button>;
      })}</div></div>;
    })}{!regions.length && <p className="empty">{t('Tidak ada data.')}</p>}</div>
  </Panel>;
}
