import { useState, useMemo } from 'react';
import { type MonitoringRecord, type DatasetKind, type Filters, emptyFilters } from '../types';
import { filterRows, metrics } from '../domain/analytics';
import { sections, type ReportSection, generateReport } from '../domain/reports';
import { FilterBar } from './Filters';
import { Panel } from './Charts';
export default function Report({ allRows, currentRows, kind }: {
    allRows: MonitoringRecord[];
    currentRows: MonitoringRecord[];
    kind: DatasetKind;
}) {
    const [source, setSource] = useState('current'), [filters, setFilters] = useState<Filters>({ ...emptyFilters }), [selected, setSelected] = useState<ReportSection[]>([...sections]), [format, setFormat] = useState<'pptx' | 'docx'>('pptx'), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
    const rows = useMemo(() => source === 'current' ? currentRows : filterRows(allRows, kind, filters), [source, currentRows, allRows, kind, filters]), m = metrics(rows, kind);
    async function generate() { setBusy(true); setError(''); setMessage(''); try {
        await generateReport(rows, kind, selected, format);
        setMessage('Report siap diunduh.');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Report gagal.');
    }
    finally {
        setBusy(false);
    } }
    return <Panel title="Generate Monitoring Report" hint="Report memakai data yang sama dengan dashboard dan mencakup seluruh record terpilih."><div className="button-row"><label className="radio"><input type="radio" name="source" checked={source === 'current'} onChange={() => setSource('current')}/>Filter dashboard aktif</label><label className="radio"><input type="radio" name="source" checked={source === 'custom'} onChange={() => setSource('custom')}/>Filter khusus report</label></div>{source === 'custom' && <FilterBar rows={allRows} kind={kind} value={filters} onChange={setFilters}/>}<div className="report-grid"><div><h3>Bagian report</h3>{sections.map(s => <label key={s} className="checkbox"><input type="checkbox" checked={selected.includes(s)} onChange={e => setSelected(e.target.checked ? [...selected, s] : selected.filter(x => x !== s))}/>{s}</label>)}<label>Format<select aria-label="Format" value={format} onChange={e => setFormat(e.target.value as 'pptx' | 'docx')}><option value="pptx">PowerPoint (.pptx)</option><option value="docx">Word (.docx)</option></select></label></div><div className="report-preview"><small>REPORT PREVIEW</small><h2>{rows.length.toLocaleString()} records</h2><p>{m.done.toLocaleString()} completed · {m.overdue.toLocaleString()} overdue</p><p>SLA Achievement <b>{m.achievement.toFixed(1)}%</b></p><p>{selected.length} bagian · {filters.person || 'Seluruh PIC / Implementor'}</p><button className="primary" disabled={busy || !rows.length || !selected.length} onClick={generate}>{busy ? 'Membuat report…' : 'Generate Report'}</button>{message && <p role="status" className="success">{message}</p>}{error && <p role="alert" className="error">{error}</p>}</div></div></Panel>;
}
