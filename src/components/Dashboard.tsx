import { useState, useMemo, lazy, Suspense } from 'react';
import { type DatasetKind, type MonitoringRecord, type Filters, type FilterKey, type Payload, type SlaRule, text, emptyFilters } from '../types';
import { fields, counts, status, filterRows, personMetrics, durationBucket, severity, productCategory } from '../domain/analytics';
import { REG_SLA_RULES } from '../domain/memo';
import { FilterBar } from './Filters';
import { Panel, Bars, Donut, Trend } from './Charts';
import { Kpis } from './Kpis';
import { Records, Detail } from './Records';
const ImportData = lazy(() => import('./ImportData')), Report = lazy(() => import('./Report')), SlaSettings = lazy(() => import('./SlaSettings'));
interface Props {
    kind: DatasetKind;
    rows: MonitoringRecord[];
    rules: SlaRule[];
    canEdit: boolean;
    onApply: (r: Payload[], name: string) => Promise<void>;
    onRestore: () => Promise<void>;
    onDone: (r: MonitoringRecord, note: string) => Promise<void>;
    onSaveRule: (r: SlaRule) => Promise<void>;
    onDeleteRule: (product: string) => Promise<void>;
}
export default function Dashboard(p: Props) {
    const { kind, rows } = p, [filters, setFilters] = useState<Filters>({ ...emptyFilters }), [view, setView] = useState('overview'), [detail, setDetail] = useState<MonitoringRecord | null>(null), [duration, setDuration] = useState<{
        key: string;
        bucket: string;
    } | null>(null), [person, setPerson] = useState(''), [personStatus, setPersonStatus] = useState('All');
    const filtered = useMemo(() => filterRows(rows, kind, filters), [rows, kind, filters]), k = fields[kind];
    const set = (key: FilterKey, v: string) => setFilters(f => ({ ...f, [key]: f[key] === v ? '' : v }));
    const chart = (title: string, field: string, key?: FilterKey, data = filtered, color?: string) => <Panel title={title} hint={key ? 'Klik bar untuk memfilter record' : undefined}><Bars items={counts(data, r => text(r.payload[field]))} onSelect={key ? v => set(key, v) : undefined} color={color}/></Panel>;
    const tabs = kind === 'ijr' ? [['overview', 'Ringkasan'], ['process', 'Proses & Durasi'], ['regional', 'Wilayah & Cabang'], ['people', 'PIC & Beban Kerja'], ['sla', 'Kinerja SLA'], ['report', 'Report'], ['data', 'Data']] : kind === 'regional' ? [['overview', 'Ringkasan'], ['status', 'Status Implementasi'], ['regional', 'Wilayah'], ['products', 'Produk'], ['people', 'Beban Implementor'], ['sla', 'Kinerja SLA'], ['report', 'Report'], ['data', 'Data']] : [['overview', 'Ringkasan'], ['sla', 'Kinerja SLA'], ['people', 'PIC & Implementor'], ['report', 'Report'], ['data', 'Data']];
    const slaRows = filtered.filter(r => r.sla.status === 'Within SLA' || r.sla.status === 'Overdue'), overdue = filtered.filter(r => r.sla.status === 'Overdue'), people = personMetrics(filtered, kind, view === 'sla');
    let detailRows = filtered;
    if (duration && view === 'process')
        detailRows = detailRows.filter(r => durationBucket(r.payload[duration.key]) === duration.bucket);
    if (person && (view === 'people' || view === 'sla')) {
        detailRows = people.find(p => p.name === person)?.records || [];
        if (personStatus === 'Done')
            detailRows = detailRows.filter(r => kind === 'ijr' ? r.payload.Status === 'Proses Selesai' : status(r, kind) === 'Done');
        if (personStatus === 'Overdue')
            detailRows = detailRows.filter(r => r.sla.status === 'Overdue');
        if (personStatus === 'Active')
            detailRows = detailRows.filter(r => kind === 'ijr' ? r.payload.Status !== 'Proses Selesai' : status(r, kind) !== 'Done');
    }
    const achievement = (field: string) => <div className="achievement-list">{counts(slaRows, r => text(r.payload[field])).slice(0, 20).map(([name, n]) => { const w = slaRows.filter(r => text(r.payload[field]) === name && r.sla.status === 'Within SLA').length, pct = n ? w / n * 100 : 0; return <button key={name} onClick={() => set(field === k.region ? 'region' : field === k.type ? 'type' : 'product', name)}><span>{name}<small>{pct.toFixed(1)}% · {n} measurable</small></span><i><b style={{ width: pct + '%' }}/></i></button>; })}</div>;
    return <><FilterBar rows={rows} kind={kind} value={filters} onChange={f => { setFilters(f); setDuration(null); setPerson(''); }}/><nav className="tabs" aria-label="Dashboard sections">{tabs.map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => { setView(id); setDuration(null); setPerson(''); setPersonStatus('All'); }}>{label}</button>)}</nav><Suspense fallback={<p className="empty">Memuat tampilan…</p>}>
 {view === 'report' ? <Report allRows={rows} currentRows={filtered} kind={kind}/> : view === 'data' ? <><ImportData rows={rows} kind={kind} canEdit={p.canEdit} onApply={p.onApply} onRestore={p.onRestore}/>{kind === 'corporate' && <SlaSettings rules={p.rules} canEdit={p.canEdit} onSave={p.onSaveRule} onDelete={p.onDeleteRule}/>}<Records rows={filtered} kind={kind} onOpen={setDetail}/></> : <>
 <Kpis rows={filtered} kind={kind} sla={view === 'sla'} onSelect={(v, isSla) => set(isSla ? 'sla' : 'status', v)}/>
 {view === 'overview' && <><div className="grid-two"><Panel title="Status Distribution" hint="Komposisi status pada periode terpilih"><Donut items={counts(filtered, r => status(r, kind))} onSelect={v => set('status', v)}/></Panel><Panel title="Request Volume" hint="Jumlah request per bulan"><Trend items={counts(filtered, r => text(r.payload[k.date]).slice(0, 7))}/></Panel></div><div className="grid-two">{chart(kind === 'corporate' ? 'Volume by Segment' : 'Volume by Wilayah', k.region, 'region')}{kind === 'ijr' ? chart('Flow Process', 'Flow Process', 'flow') : <Panel title="Kategori Produk" hint="Klik untuk melihat sub produk"><Bars items={counts(filtered, r => productCategory(text(r.payload.product), kind))} onSelect={v => set('category', v)}/></Panel>}{kind === 'ijr' ? chart('Cabang', 'Cabang', 'branch') : chart('Product & Sub Product', 'product', 'product')}{chart('New / Maintenance', k.type, 'type')}</div></>}
 {view === 'process' && <><div className="grid-three">{[['_TotalDayNum', 'Total Process'], ['_CabangDayNum', 'Cabang Process'], ['_TBSDayNum', 'TBS Process']].map(([key, label]) => <Panel key={key} title={label} hint="Klik durasi untuk melihat detail"><Bars items={counts(filtered, r => durationBucket(r.payload[key]))} onSelect={bucket => setDuration(duration?.key === key && duration.bucket === bucket ? null : { key, bucket })}/></Panel>)}</div>{chart('Flow Process', 'Flow Process', 'flow')}{duration && <div className="notice">Detail {duration.bucket}<button className="text-button" onClick={() => setDuration(null)}>Hapus pilihan</button></div>}</>}
 {view === 'status' && <div className="grid-two"><Panel title="Status Implementasi"><Donut items={counts(filtered, r => status(r, kind))} onSelect={v => set('status', v)}/></Panel><Panel title="Milestone Completion"><Bars color="#19a67b" items={['salesDate', 'approvalDate', 'docComplete', 'settingDone', 'customerInfo', 'training', 'handover'].map(field => [field, filtered.filter(r => text(r.payload[field])).length])}/></Panel></div>}
 {view === 'regional' && <div className="grid-two">{chart(kind === 'corporate' ? 'Segment' : 'Wilayah', k.region, 'region')}{kind === 'ijr' ? chart('Cabang', 'Cabang', 'branch') : chart('Products by Wilayah', k.product, 'product')}{kind === 'ijr' && chart('Unit Pembuka', 'Unit Pembuka')}</div>}
 {view === 'products' && <div className="grid-two"><Panel title="Kategori Produk"><Bars items={counts(filtered, r => productCategory(text(r.payload.product), kind))} onSelect={v => set('category', v)}/></Panel>{chart('Sub Produk', 'product', 'product')}{chart('New / Maintenance', k.type, 'type')}</div>}
 {(view === 'people' || view === 'sla') && <>{view === 'people' && <div className="grid-two">{chart(kind === 'ijr' ? 'Implementor 1' : 'Implementor', k.person, 'person')}{kind === 'ijr' ? chart('Implementor 2', 'Implementor 2', 'person') : chart('Overdue by Implementor', 'implementor', 'person', overdue, '#da5369')}{kind === 'ijr' ? chart('CS BNI Direct', 'CS BNI Direct', 'person') : kind === 'corporate' ? chart('PIC Sales', 'sales') : null}{kind === 'corporate' && chart('Assigner', 'assigner')}{kind === 'corporate' && chart('Complexity', 'complexity')}{kind === 'corporate' && chart('Priority', 'priority')}</div>}{view === 'sla' && <><p className="notice">Acuan SLA: Memo PEMP/005, efektif 14 Juli 2025. Achievement = Within SLA / (Within SLA + Overdue). Record Without SLA dan SLA Real Unavailable dikecualikan.</p><div className="grid-two"><Panel title="SLA Distribution"><Donut items={counts(filtered, r => r.sla.status)} onSelect={v => set('sla', v)}/></Panel><Panel title="Overdue Severity"><Bars items={severity(overdue)} color="#da5369"/></Panel><Panel title="Overdue by Solution"><Bars items={counts(overdue, r => r.sla.solution || 'Unmapped')} color="#da5369"/></Panel>{chart('Overdue by ' + (kind === 'corporate' ? 'Segment' : 'Wilayah'), k.region, 'region', overdue, '#da5369')}<Panel title="SLA Achievement by Product / Type">{achievement(k.product || k.type)}</Panel><Panel title={'SLA Achievement by ' + (kind === 'corporate' ? 'Segment' : 'Wilayah')}>{achievement(k.region)}</Panel></div></>}
 <Panel title="KPI Per Person" hint="Klik PIC untuk melihat semua assignment dan detail pekerjaan."><div className="table-scroll"><table><thead><tr><th>PIC / Implementor</th><th>Assigned</th><th>Done</th><th>Active</th><th>Waiting</th><th>Overdue</th><th>SLA Measurable</th><th>Achievement</th><th>Avg Real</th></tr></thead><tbody>{people.map(p => <tr key={p.name} className={person === p.name ? 'selected-row' : ''}><td><button className="text-button" onClick={() => { setPerson(person === p.name ? '' : p.name); setPersonStatus('All'); }}>{p.name}</button></td><td>{p.total}</td><td>{p.done}</td><td>{p.total - p.done}</td><td>{p.waiting}</td><td>{p.overdue}</td><td>{p.measurable}</td><td>{p.achievement.toFixed(1)}%</td><td>{p.average.toFixed(1)} d</td></tr>)}</tbody></table></div></Panel>{person && <div className="person-toolbar"><b>{person}</b><div className="button-row">{['All', 'Done', 'Active', 'Overdue'].map(s => <button key={s} className={personStatus === s ? 'primary' : 'secondary'} onClick={() => setPersonStatus(s)}>{s}</button>)}<button className="secondary" onClick={() => setPerson('')}>Semua PIC</button></div></div>}</>}
 <Records rows={detailRows} kind={kind} onOpen={setDetail} title={person ? 'Detail ' + person : duration ? 'Detail ' + duration.bucket : 'Detail Data'}/>
 {view === 'sla' && <Panel title="Official SLA Target Reference"><div className="table-scroll"><table><thead><tr><th>Solution</th><th>New Project</th><th>Maintenance</th></tr></thead><tbody>{(kind === 'ijr' ? REG_SLA_RULES.filter(r => r[0] === 'BNIdirect') : REG_SLA_RULES).map(([name, n, m]) => <tr key={name}><td>{name}</td><td>{n} working days</td><td>{m} working days</td></tr>)}</tbody></table></div></Panel>}
 </>}
 </Suspense>{detail && <Detail record={detail} kind={kind} canEdit={p.canEdit} onClose={() => setDetail(null)} onDone={p.onDone}/>}</>;
}
