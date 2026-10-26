import { useMemo } from 'react';
import { type MonitoringRecord } from '../types';
import { regionSummary, displayAverageDays, type RegionSummaryKind } from '../domain/region-summary';
import { Panel } from './Charts';
import { useLanguage } from '../lib/language';

export function RegionAverages({ rows, kind }: { rows: MonitoringRecord[]; kind: RegionSummaryKind }) {
  const { t } = useLanguage();
  const summary = useMemo(() => regionSummary(rows.map(row => row.payload), kind), [rows, kind]);
  const unclassified = summary.grandTotal.unclassified > 0;
  return <Panel title="Rata-rata Durasi per Wilayah" hint="Average Days N dan M berasal dari pekerjaan selesai dengan durasi tersedia. Tanda — berarti belum ada durasi yang dapat dirata-ratakan.">
    <div className="table-scroll region-average-table"><table>
      <thead><tr>{['Wilayah', 'N', 'M', ...(unclassified ? ['Belum diklasifikasikan'] : []), 'Total', 'Average Days N', 'Average Days M'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead>
      <tbody>{[...summary.rows, summary.grandTotal].map(row => <tr key={row.name} className={row.name === 'Grand Total' ? 'grand-total' : ''}>
        <th scope="row">{t(row.name)}</th><td>{row.new}</td><td>{row.maintenance}</td>{unclassified && <td>{row.unclassified}</td>}<td>{row.total}</td>
        {[row.averageNew, row.averageMaintenance].map((average, i) => <td key={i} title={`${average.count} ${t('pekerjaan selesai dengan durasi tersedia')}`}>{displayAverageDays(average.days)}</td>)}
      </tr>)}</tbody>
    </table></div>
    <p className="muted">{t('N = New · M = Maintenance. Total tetap mencakup pekerjaan dengan tanggal kosong. Rata-rata menggunakan durasi hari kerja yang berlaku; Grand Total dihitung dari seluruh pekerjaan yang memiliki durasi.')}</p>
  </Panel>;
}
