import { useLanguage } from '../lib/language';
import { useState, useMemo } from 'react';
import { type MonitoringRecord, type DatasetKind, type Filters, type FilterKey, emptyFilters, text } from '../types';
import { filterRows, fields, options, productCategory, status } from '../domain/analytics';
import { reportContents, reportNames, selectReportPerson } from '../domain/report-model';
import { generateReport } from '../domain/reports';
import { PeriodPicker } from './PeriodPicker';
import { saveBlob } from '../lib/exports';
import { Panel } from './Charts';
import { productKey, regionalProductLabels } from '../domain/display';
import { PersonPicker } from './PersonPicker';

export default function Report({ allRows, kind, dashboardFilters }: { allRows: MonitoringRecord[]; kind: DatasetKind; dashboardFilters: Filters }) {
  const { t } = useLanguage();
  const [source,setSource]=useState<'custom'|'current'>('custom');
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [person, setPerson] = useState('All Name');
  const [selected, setSelected] = useState<string[]>([...reportContents[kind]]);
  const [format, setFormat] = useState<'pptx' | 'docx'>('pptx');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const effectiveFilters=source==='custom'?filters:dashboardFilters;
  const rows = useMemo(() => selectReportPerson(filterRows(allRows, kind, effectiveFilters), kind, person), [allRows, kind, effectiveFilters, person]);
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
    try { const file=await generateReport(rows, kind, selected, format, { person, filters:effectiveFilters, source, dataset: allRows },false);saveBlob(file.blob,file.name);setMessage('Report siap diunduh.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Report gagal.'); }
    finally { setBusy(false); }
  }
  return <div className="report-shell"><Panel title={t("Laporan Monitoring")}><div className="report-mode"><button className={source==='current'?'active':''} onClick={()=>setSource('current')}>{t("Sesuai Filter Dashboard")}</button><button className={source==='custom'?'active':''} onClick={()=>setSource('custom')}>Custom Report</button></div><p className="report-sub">{t(source==='custom'?"Filter laporan terpisah dari filter dashboard.":"Mengikuti filter dashboard yang sedang aktif.")}</p>
    {source==='custom'&&<fieldset className="report-filter-fields"><legend>CUSTOM REPORT FILTERS</legend><div className="report-fields"><label>{t("Pencarian")}<input type="search" value={filters.search} onChange={e=>set("search",e.target.value)} placeholder={t("Cari nomor register, perusahaan…")}/></label><PeriodPicker value={filters} onChange={setFilters}/>
      {definitions.map(([key, label, field]) => { const values = field === 'category' ? [...new Set(allRows.map(row => productCategory(text(row.payload.product), kind)).filter(Boolean))].sort() : field === 'sla' ? [...new Set(allRows.map(row => row.sla.status))] : key === 'status' ? [...new Set(allRows.map(row => status(row, kind)))].sort() : options(key === 'product' ? allRows.filter(row => productCategory(text(row.payload.product), kind) === filters.category) : allRows, field); return <label key={key}>{t(label)}<select disabled={key === 'product' && !filters.category} value={filters[key]} onChange={e => set(key, e.target.value)}><option value="">{t('Semua') + ' ' + t(label)}</option>{[...new Set(values.map(value => kind === 'regional' && key === 'product' ? productLabels.get(productKey(value)) || value : value))].map(value => <option key={value}>{value}</option>)}</select></label>; })}
    </div><button className="text-button" onClick={()=>setFilters({...emptyFilters})}>{t("Reset Filter")}</button></fieldset>}
    <h4>{t("Pengaturan Laporan")}</h4><div className="report-settings"><div><PersonPicker value={person} onChange={setPerson} names={names}/><p className="report-sub">{t("Bisa memilih satu PIC untuk laporan individual.")}</p></div><label>{t("Format")}<select aria-label={t("Format Report")} value={format} onChange={e=>setFormat(e.target.value as 'pptx'|'docx')}><option value="pptx">PowerPoint (.pptx)</option><option value="docx">Word (.docx)</option></select></label></div>
    <h4>{t("Pilih Bagian Laporan")}</h4><div className="report-contents">{reportContents[kind].map(section => <label key={section} className="checkbox"><input type="checkbox" checked={selected.includes(section)} onChange={e => setSelected(previous => e.target.checked ? [...previous, section] : previous.filter(value => value !== section))}/>{section}</label>)}</div>
    <div className="pilot-report-actions"><p className="report-sub">{rows.length.toLocaleString()} {t("data sesuai filter laporan")}</p><button className="primary" disabled={busy || !rows.length || !selected.length} onClick={()=>generate()}>{t(busy ? 'Membuat report…' : 'Buat Report')}</button></div>{message && <p role="status" className="success">{t(message)}</p>}{error && <p role="alert" className="error">{t(error)}</p>}
  </Panel></div>;
}
