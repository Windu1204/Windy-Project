import { type DatasetKind, type Filters, datasetTitles, text } from '../types';
import { type ReportModel } from '../domain/report-model';
import { Panel } from './Charts';

const detailColumns: Record<DatasetKind, [string, string][]> = {
 ijr: [['Application Number','Application Number'],['Applicant Name','Applicant Name'],['Request Date','Request Date'],['Status','Status'],['Flow Process','Flow Process'],['Wilayah','Wilayah'],['Cabang','Cabang']],
 regional: [['Company','company'],['CID','cid'],['Request Date','salesDate'],['Wilayah','region'],['TB Produk','product'],['Implementor','implementor'],['Status','status']],
 corporate: [['No. Reg','noreg'],['Company','company'],['Request Date','createDate'],['Segment','segment'],['Product','product'],['Status','status'],['SLA Status','slaStatus']],
};
export function ReportPreview({ model, kind, filters, person }: { model: ReportModel; kind: DatasetKind; filters: Filters; person: string }) {
 const period = filters.from || filters.to ? `${filters.from || '...'} – ${filters.to || '...'}` : 'All Period';
 const kpis = kind === 'corporate' ? [['Total Records', model.total], ['Completed / Done', model.done], ['Within SLA', model.within], ['Overdue', model.overdue]] : [['Total Records', model.total], ['Completed / Done', model.done], ['In Progress', model.inProgress], ['Waiting / Pending', model.waiting]];
 const columns = detailColumns[kind];
 return <Panel title="Report Preview" hint="Preview ini mengikuti data source dan periode report yang dipilih.">
   <div className="report-active-filter"><span>Custom Report Filter</span>{Object.entries(filters).filter(([, value]) => value).map(([key, value]) => <span key={key}>{value}</span>)}<span>{model.allPeople ? 'All Name' : person}</span></div>
   <div className="preview-cover"><div className="bni-logo" role="img" aria-label="BNI"/><h2>{datasetTitles[kind]}<br/>Monitoring Report</h2><p>Periode: {period}</p></div>
   <div className="report-preview-kpis">{kpis.map(([label, value]) => <div key={label}><small>{label}</small><b>{Number(value).toLocaleString()}</b></div>)}</div>
   <div className="report-detail-preview"><b>Preview report content</b>{model.total ? <>
     <ul className="report-people"><li>Top status: {model.statuses[0]?.[0] || '—'} ({model.statuses[0]?.[1].toLocaleString() || 0})</li><li>Top product: {model.products[0]?.[0] || '—'} ({model.products[0]?.[1].toLocaleString() || 0})</li></ul>
     {model.allPeople ? <><h4>KPI Per Person · {model.people.length.toLocaleString()} nama</h4><ul className="report-people">{model.people.slice(0, 8).map(p => <li key={p.name}>{p.name} — {p.assigned} assigned, {p.done} completed, {p.active} active, {p.waiting} waiting{kind === 'corporate' ? `, ${p.overdue} overdue` : ''}</li>)}{model.people.length > 8 && <li>+ {model.people.length - 8} nama lainnya akan ikut di-export</li>}</ul><p className="report-sub">All Name menggunakan format Management Summary. Detail seluruh record tidak ditampilkan agar report tetap ringkas.</p></> : <><h4>Operational Detail · {person}</h4><p className="report-sub">Detail pekerjaan menampilkan tanggal pengajuan dan field operasional sesuai filter report.</p><div className="table-scroll"><table><thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{model.rows.slice(0,10).map((row,i) => <tr key={i}>{columns.map(([label,key]) => <td key={label}>{text(row[key] ?? '-').slice(0,60)}</td>)}</tr>)}</tbody></table></div><p className="report-sub">Preview 10 dari {model.total.toLocaleString()} pekerjaan implementor terpilih.</p></>}
   </> : <p className="empty">No data matches the selected report filters.</p>}</div>
 </Panel>;
}
