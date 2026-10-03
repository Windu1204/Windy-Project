import { useLanguage } from '../lib/language';
import { useState, useMemo } from 'react';
import { type MonitoringRecord, type DatasetKind, type Filters, type FilterKey, emptyFilters, text } from '../types';
import { filterRows, fields, options, productCategory, status } from '../domain/analytics';
import { reportContents, reportModel, reportNames, selectReportPerson } from '../domain/report-model';
import { generateReport } from '../domain/reports';
import { ReportPreview } from './ReportPreview';
import { Panel } from './Charts';
import { productKey, regionalProductLabels } from '../domain/display';
import { PersonPicker } from './PersonPicker';

export default function Report({ allRows, kind }: { allRows: MonitoringRecord[]; kind: DatasetKind }) {
  const { t } = useLanguage();
  const source = 'custom' as const;
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [person, setPerson] = useState('All Name');
  const [selected, setSelected] = useState<string[]>([...reportContents[kind]]);
  const [format, setFormat] = useState<'pptx' | 'docx'>('pptx');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const rows = useMemo(() => selectReportPerson(filterRows(allRows, kind, filters), kind, person), [allRows, kind, filters, person]);
  const model = useMemo(() => reportModel(rows, kind, person), [rows, kind, person]);
  const names = useMemo(() => [...new Set(allRows.flatMap(row => reportNames(row, kind)))].sort(), [allRows, kind]);
  const k = fields[kind], productLabels = useMemo(() => regionalProductLabels(allRows), [allRows]);
  const definitions: [FilterKey, string, string][] = kind === 'ijr'
    ? [['status', 'Status', k.status], ['type', 'Application Type', k.type], ['flow', 'Flow Process', 'Flow Process'], ['region', 'Wilayah', k.region]]
    : kind === 'regional'
      ? [['status', 'Status', k.status], ['type', 'New / Maintenance', k.type], ['region', 'Wilayah', k.region], ['category', 'TB Produk', 'category'], ['product', 'Sub TB Produk', 'product']]
      : [['status', 'Status', k.status], ['type', 'Project Type', k.type], ['region', 'Segment', k.region], ['category', 'Product', 'category'], ['product', 'Sub Product', 'product'], ['sla', 'SLA Status', 'sla']];
  function set(key: FilterKey, value: string) { setFilters(previous => ({ ...previous, [key]: value, ...(key === 'category' ? { product: '' } : {}) })); }
  async function generate() {
    setBusy(true); setError(''); setMessage('');
    try { await generateReport(rows, kind, selected, format, { person, filters, source, dataset: allRows }); setMessage('Report siap diunduh.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Report gagal.'); }
    finally { setBusy(false); }
  }
  return <div className="report-shell"><Panel title="Custom Report" hint="Generate report dari data dashboard dalam format PowerPoint atau Word.">
    <fieldset className="report-filter-fields"><div className="report-fields"><label>{t("Start Date")}<input type="date" value={filters.from} onChange={e => set('from', e.target.value)}/></label><label>{t("End Date")}<input type="date" value={filters.to} onChange={e => set('to', e.target.value)}/></label>
      {definitions.map(([key, label, field]) => { const values = field === 'category' ? [...new Set(allRows.map(row => productCategory(text(row.payload.product), kind)).filter(Boolean))].sort() : field === 'sla' ? [...new Set(allRows.map(row => row.sla.status))] : key === 'status' ? [...new Set(allRows.map(row => status(row, kind)))].sort() : options(key === 'product' ? allRows.filter(row => productCategory(text(row.payload.product), kind) === filters.category) : allRows, field); return <label key={key}>{t(label)}<select disabled={key === 'product' && !filters.category} value={filters[key]} onChange={e => set(key, e.target.value)}><option value="">{t('Semua') + ' ' + t(label)}</option>{[...new Set(values.map(value => kind === 'regional' && key === 'product' ? productLabels.get(productKey(value)) || value : value))].map(value => <option key={value}>{value}</option>)}</select></label>; })}
    </div></fieldset>
    <PersonPicker value={person} onChange={setPerson} names={names}/>
    <p className="report-sub">{t("Pilih")}<b>{t("All Name")}</b> {t("untuk seluruh PIC / Implementor, atau ketik nama untuk mencari.")}</p>
    <fieldset className="report-format-label"><legend>{t("Format Report")}</legend><div className="button-row">{([['pptx', 'PowerPoint (.pptx)'], ['docx', 'Word (.docx)']] as const).map(([id, label]) => <label className="radio" key={id}><input type="radio" name="reportFormat" checked={format === id} onChange={() => setFormat(id)}/>{label}</label>)}</div></fieldset>
    <h4>{t("Report Content")}</h4><div className="report-contents">{reportContents[kind].map(section => <label key={section} className="checkbox"><input type="checkbox" checked={selected.includes(section)} onChange={e => setSelected(previous => e.target.checked ? [...previous, section] : previous.filter(value => value !== section))}/>{section}</label>)}</div>
    <p className="report-principle"><b>{t("Report Principle:")}</b> {t("KPI, breakdown, dan detail dihitung dari dataset report yang sama. All Name menggunakan Management Summary dan KPI seluruh implementor; satu nama menggunakan report individual dengan Operational Detail.")}</p>
    <button className="primary" disabled={busy || !rows.length || !selected.length} onClick={generate}>{busy ? 'Membuat report…' : 'Generate Report'}</button>{message && <p role="status" className="success">{t(message)}</p>}{error && <p role="alert" className="error">{t(error)}</p>}
  </Panel><ReportPreview model={model} kind={kind} filters={filters} person={person}/></div>;
}
