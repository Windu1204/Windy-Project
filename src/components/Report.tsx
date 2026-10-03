import { useState, useMemo } from 'react';
import { type MonitoringRecord, type DatasetKind, type Filters, type FilterKey, emptyFilters, text } from '../types';
import { filterRows, fields, options, productCategory, status } from '../domain/analytics';
import { reportContents, reportModel, reportNames, selectReportPerson } from '../domain/report-model';
import { generateReport } from '../domain/reports';
import { Panel, Bars } from './Charts';

export default function Report({ allRows, currentRows, kind }: { allRows: MonitoringRecord[]; currentRows: MonitoringRecord[]; kind: DatasetKind }) {
  const [source, setSource] = useState<'custom' | 'current'>('custom');
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [person, setPerson] = useState('All Name');
  const [selected, setSelected] = useState<string[]>([...reportContents[kind]]);
  const [format, setFormat] = useState<'pptx' | 'docx'>('pptx');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const rows = useMemo(() => selectReportPerson(source === 'current' ? currentRows : filterRows(allRows, kind, filters), kind, person), [source, currentRows, allRows, kind, filters, person]);
  const model = useMemo(() => reportModel(rows, kind, person), [rows, kind, person]);
  const names = useMemo(() => [...new Set(allRows.flatMap(row => reportNames(row, kind)))].sort(), [allRows, kind]);
  const k = fields[kind];
  const definitions: [FilterKey, string, string][] = kind === 'ijr'
    ? [['status', 'Status', k.status], ['type', 'Application Type', k.type], ['flow', 'Flow Process', 'Flow Process'], ['region', 'Wilayah', k.region]]
    : kind === 'regional'
      ? [['status', 'Status', k.status], ['type', 'New / Maintenance', k.type], ['region', 'Wilayah', k.region], ['category', 'TB Produk', 'category'], ['product', 'Sub TB Produk', 'product']]
      : [['status', 'Status', k.status], ['type', 'Project Type', k.type], ['region', 'Segment', k.region], ['category', 'Product', 'category'], ['product', 'Sub Product', 'product'], ['sla', 'SLA Status', 'sla']];
  function set(key: FilterKey, value: string) { setFilters(previous => ({ ...previous, [key]: value })); }
  async function generate() {
    setBusy(true); setError(''); setMessage('');
    try { await generateReport(rows, kind, selected, format, { person, filters, source, dataset: allRows }); setMessage('Report siap diunduh.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Report gagal.'); }
    finally { setBusy(false); }
  }
  const previewKpis = kind === 'corporate' ? [['Total Records', model.total], ['Completed / Done', model.done], ['Within SLA', model.within], ['Overdue', model.overdue]] : [['Total Records', model.total], ['Completed / Done', model.done], ['In Progress', model.inProgress], ['Waiting / Pending', model.waiting]];
  return <div className="report-shell"><Panel title="Custom Report" hint="Generate report dari data dashboard dalam format PowerPoint atau Word.">
    <div className="button-row"><label className="radio"><input type="radio" name="source" checked={source === 'custom'} onChange={() => setSource('custom')}/>Filter khusus report</label><label className="radio"><input type="radio" name="source" checked={source === 'current'} onChange={() => setSource('current')}/>Filter dashboard aktif</label></div>
    <fieldset className="report-filter-fields" disabled={source === 'current'}><div className="report-fields"><label>Start Date<input type="date" value={filters.from} onChange={e => set('from', e.target.value)}/></label><label>End Date<input type="date" value={filters.to} onChange={e => set('to', e.target.value)}/></label>
      {definitions.map(([key, label, field]) => { const values = field === 'category' ? [...new Set(allRows.map(row => productCategory(text(row.payload.product), kind)).filter(Boolean))].sort() : field === 'sla' ? [...new Set(allRows.map(row => row.sla.status))] : key === 'status' ? [...new Set(allRows.map(row => status(row, kind)))].sort() : options(allRows, field); return <label key={key}>{label}<select value={filters[key]} onChange={e => set(key, e.target.value)}><option value="">All {label}</option>{values.map(value => <option key={value}>{value}</option>)}</select></label>; })}
    </div></fieldset>
    <label className="report-person">PIC / Implementor<input list="report-person-names" value={person} onFocus={e => { if (person === 'All Name') e.target.select(); }} onChange={e => setPerson(e.target.value)} placeholder="All Name atau ketik nama"/><datalist id="report-person-names"><option value="All Name"/>{names.map(name => <option key={name} value={name}/>)}</datalist></label>
    <p className="report-sub">Pilih <b>All Name</b> untuk seluruh PIC / Implementor, atau ketik nama untuk mencari.</p>
    <label className="report-format-label">Format<select aria-label="Format" value={format} onChange={e => setFormat(e.target.value as 'pptx' | 'docx')}><option value="pptx">PowerPoint (.pptx)</option><option value="docx">Word (.docx)</option></select></label>
    <h4>Report Content</h4><div className="report-contents">{reportContents[kind].map(section => <label key={section} className="checkbox"><input type="checkbox" checked={selected.includes(section)} onChange={e => setSelected(previous => e.target.checked ? [...previous, section] : previous.filter(value => value !== section))}/>{section}</label>)}</div>
    <p className="report-principle"><b>Report Principle:</b> KPI, breakdown, dan detail dihitung dari dataset report yang sama. All Name menggunakan Management Summary dan KPI seluruh implementor; satu nama menggunakan report individual dengan Operational Detail.</p>
    <button className="primary" disabled={busy || !rows.length || !selected.length} onClick={generate}>{busy ? 'Membuat report…' : 'Generate Report'}</button>{message && <p role="status" className="success">{message}</p>}{error && <p role="alert" className="error">{error}</p>}
  </Panel><Panel title="Report Preview" hint="Preview mengikuti data source, periode, dan implementor report yang dipilih.">
    <h2>{rows.length.toLocaleString()} records</h2><p className="report-sub">{source === 'current' ? 'Current Dashboard Filter' : filters.from || filters.to ? `${filters.from || '...'} – ${filters.to || '...'}` : 'All Period'} · {model.allPeople ? 'All Name' : person}</p>
    <div className="report-preview-kpis">{previewKpis.map(([label, value]) => <div key={label}><small>{label}</small><b>{Number(value).toLocaleString()}</b></div>)}</div>
    <h4>Status Breakdown</h4><Bars items={model.statuses}/><h4>Top Product / Category</h4><Bars items={model.products} limit={5}/>
    <h4>KPI Per Person · {model.people.length.toLocaleString()} nama</h4><ul className="report-people">{model.people.slice(0, 8).map(p => <li key={p.name}>{p.name} — {p.assigned} assigned, {p.done} completed, {p.active} active, {p.waiting} waiting</li>)}</ul>
    <p className="report-sub">{model.allPeople ? 'Seluruh nama ikut diekspor. Detail seluruh record tidak ditampilkan agar report tetap ringkas.' : `${model.rows.length.toLocaleString()} operational detail records untuk PIC / Implementor terpilih.`}</p>
  </Panel></div>;
}
