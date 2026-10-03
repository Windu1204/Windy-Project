import { useState, useMemo, lazy, Suspense } from 'react';
import { type DatasetKind, type MonitoringRecord, type Filters, type FilterKey, type Payload, type SlaRule, text, emptyFilters } from '../types';
import { fields, counts, status, filterRows, personMetrics, durationBucket, severity, productCategory } from '../domain/analytics';
import { productKey, regionalProductLabels } from '../domain/display';
import { REG_SLA_RULES } from '../domain/memo';
import { FilterBar } from './Filters';
import { Panel, Bars, Donut, Trend } from './Charts';
import { Kpis } from './Kpis';
import { Records, Detail } from './Records';
import PersonWork from './PersonWork';
import { DurationCards, SlaPeople } from './SourceViewDetails';
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
    } | null>(null), [person, setPerson] = useState(''), [personStatus, setPersonStatus] = useState('All'), [drill, setDrill] = useState<{field: string; value: string; label: string} | null>(null);
    const productLabels = useMemo(() => regionalProductLabels(rows), [rows]);
    const productName = (value: string) => kind === 'regional' ? productLabels.get(productKey(value)) || value : value;
    const filtered = useMemo(() => filterRows(rows, kind, filters), [rows, kind, filters]), k = fields[kind];
    const set = (key: FilterKey, v: string) => {
      const same = filters[key] === v;
      setFilters(f => ({ ...f, [key]: same ? '' : v }));
      const eligible = kind === 'ijr' ? !['overview', 'data', 'report'].includes(view) : kind === 'regional' && ['status', 'regional'].includes(view);
      const field = ({region: k.region, status: k.status, type: k.type, product: k.product, person: k.person, flow: 'Flow Process', branch: 'Cabang'} as Partial<Record<FilterKey, string>>)[key];
      setDrill(eligible && !same && field ? {field, value: v, label: key === 'region' ? 'Wilayah' : field} : null);
    };
    const directDrill = (field: string, value: string) => setDrill(previous => previous?.field === field && previous.value === value ? null : {field, value, label: field});
    const chart = (title: string, field: string, key?: FilterKey, data = filtered, color?: string, limit = view === 'overview' ? 10 : kind === 'ijr' ? 15 : 25, direct = false) => <Panel title={title} hint={key ? 'Klik bar untuk memfilter record' : undefined}><Bars limit={limit} items={field === 'Flow Process' ? ['Asisten CS BNI Direct', 'Validator 1', 'Implementor 1', 'Implementor 2'].map(name => [name, data.filter(r => r.payload[field] === name).length] as [string, number]).filter(([, n]) => n > 0) : counts(data, r => field === 'product' ? productName(text(r.payload[field])) : text(r.payload[field]))} onSelect={direct ? v => directDrill(field, v) : key ? v => set(key, v) : undefined} color={color}/></Panel>;
    const tabs = kind === 'ijr' ? [['overview', 'Ringkasan'], ['process', 'Proses & Durasi'], ['regional', 'Wilayah & Cabang'], ['people', 'PIC & Beban Kerja'], ['sla', 'Kinerja SLA'], ['report', 'Report'], ['data', 'Data']] : kind === 'regional' ? [['overview', 'Ringkasan'], ['status', 'Status Implementasi'], ['regional', 'Wilayah'], ['people', 'Beban Implementor'], ['sla', 'Kinerja SLA'], ['report', 'Report'], ['data', 'Data']] : [['overview', 'Ringkasan'], ['sla', 'Kinerja SLA'], ['people', 'PIC & Implementor'], ['report', 'Report'], ['data', 'Data']];
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
    const achievement = (field: string, ranking?: 'low' | 'high') => { const nameOf = (r: MonitoringRecord) => kind === 'ijr' && field === k.type ? /maint/i.test(text(r.payload[field])) ? 'Maintenance' : 'New Request' : field === 'product' ? productName(text(r.payload[field])) : text(r.payload[field]); const values = (kind === 'ijr' && field === k.type ? ['New Request', 'Maintenance'].map(name => [name, slaRows.filter(r => nameOf(r) === name).length] as [string, number]) : counts(slaRows, nameOf)).map(([name, n]) => { const within = slaRows.filter(r => nameOf(r) === name && r.sla.status === 'Within SLA').length; return { name, n, pct: n ? within / n * 100 : 0 }; }); if (ranking) values.sort((a, b) => ranking === 'low' ? a.pct - b.pct || b.n - a.n : b.pct - a.pct || b.n - a.n); return <div className="achievement-list">{values.slice(0, ranking ? 5 : 10).map(({name, n, pct}) => { return <button key={name} disabled={kind === 'ijr' && field === k.type} onClick={() => set(field === k.region ? 'region' : field === k.type ? 'type' : 'product', name)}><span>{name}<small>{pct.toFixed(1)}% · {n} measurable</small></span><i><b style={{ width: pct + '%' }}/></i></button>; })}</div>; };
    return <div className={"dashboard-content dash-" + kind}><nav className="tabs" aria-label="Dashboard sections">{tabs.map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => { setView(id); setDrill(null); setDuration(null); setPerson(''); setPersonStatus('All'); }}>{label}</button>)}</nav>{!['report', 'data'].includes(view) && <FilterBar rows={rows} kind={kind} value={filters} onChange={f => { setFilters(f); setDrill(null); setDuration(null); setPerson(''); }}/>}<Suspense fallback={<p className="empty">Memuat tampilan…</p>}>
 {view === 'report' ? <Report allRows={rows} kind={kind}/> : view === 'data' ? <><ImportData rows={rows} kind={kind} canEdit={p.canEdit} onApply={p.onApply} onRestore={p.onRestore}/><Records productName={productName} rows={filtered} kind={kind} onOpen={setDetail}/></> : <>
 {view !== 'process' && !(kind === 'corporate' && view === 'people') && <Kpis rows={filtered} kind={kind} view={view} sla={view === 'sla'} onSelect={(v, isSla) => set(isSla ? 'sla' : 'status', v)}/>}
 {view === 'overview' && <>{kind === 'corporate' ? <div className="grid-three"><Panel title="SLA Performance" hint="Hanya record effective-period dengan SLA target dan SLA Real numerik."><Donut colorByName={{ 'Within SLA': '#12a56f', Overdue: '#dd3b45' }} items={counts(slaRows, r => r.sla.status)} onSelect={v => set('sla', v)}/></Panel>{chart('Volume by Segment', k.region, 'region')}{chart('Top Products', 'product', 'product')}</div> : <><div className="grid-three"><Panel title={kind === 'ijr' ? 'Status Application' : 'Status Implementasi'} hint="Komposisi status pada filter aktif."><Donut colorByName={kind === 'regional' ? { Done: '#12a56f', 'In progress': '#d99013', 'Pending doc': '#dd3b45', Reject: '#8390a2' } : {}} items={counts(filtered, r => status(r, kind))} onSelect={v => set('status', v)}/></Panel><Panel className={kind === 'ijr' ? 'ijr-application-type' : ''} title={kind === 'ijr' ? 'Application Type' : 'New / Maintenance'} hint="Distribusi jenis pekerjaan."><Donut colors={['#1769d2', '#7b4be2', '#12a56f']} items={counts(filtered, r => text(r.payload[k.type]))} onSelect={v => set('type', v)}/></Panel>{chart('Top Wilayah', k.region, 'region')}</div><div className="grid-two">{kind === 'ijr' ? <Panel title="Request Trend" hint="Jumlah source rows per Request Date."><Trend items={counts(filtered, r => text(r.payload[k.date]))}/></Panel> : chart('Top TB Produk', 'product', 'product')}{kind === 'ijr' ? chart('Flow Process', 'Flow Process', 'flow') : chart('Implementor Workload', 'implementor', 'person')}</div></>}</>}
 {view === 'process' && <><DurationCards rows={filtered} selected={duration} onSelect={setDuration}/>{duration && <Records productName={productName} variant="duration" rows={detailRows} kind={kind} onOpen={setDetail} title={([['_TotalDayNum', 'Total Process'], ['_CabangDayNum', 'Cabang Process'], ['_TBSDayNum', 'TBS Process']].find(x => x[0] === duration.key)?.[1] || 'Process') + ' — ' + duration.bucket}/>}<div className="grid-two">{chart('Flow Process', 'Flow Process', 'flow')}<Panel title="Status dalam Process View"><Bars items={counts(filtered, r => status(r, kind))} onSelect={v => set('status', v)}/></Panel></div></>}
 {view === 'status' && <div className="grid-two"><Panel title="Status Distribution"><Bars items={counts(filtered, r => status(r, kind))} onSelect={v => set('status', v)}/></Panel><Panel title="Milestone Availability"><Bars color="#19a67b" items={[['salesDate', 'Email Sales'], ['approvalDate', 'Approval'], ['docComplete', 'Dokumen Lengkap'], ['settingDone', 'Selesai Setting'], ['customerInfo', 'Info Nasabah'], ['training', 'Training']].map(([field, label]) => [label, filtered.filter(r => text(r.payload[field])).length])}/></Panel></div>}
 {view === 'regional' && <div className={kind === 'ijr' ? 'grid-three' : 'grid-two'}>{chart(kind === 'ijr' ? 'Records by Wilayah' : 'Volume by Wilayah', k.region, 'region', filtered, undefined, kind === 'ijr' ? 20 : 30)}{kind === 'ijr' ? chart('Top Cabang', 'Cabang', undefined, filtered, undefined, 15, true) : chart('Done by Wilayah', k.region, 'region', filtered.filter(r => status(r, kind) === 'Done'))}{kind === 'ijr' && chart('Top Unit Pembuka', 'Unit Pembuka', undefined, filtered, undefined, 15, true)}</div>}
 {view === 'products' && <div className="grid-two"><Panel title="Kategori Produk"><Bars items={counts(filtered, r => productCategory(text(r.payload.product), kind))} onSelect={v => set('category', v)}/></Panel>{chart('Sub Produk', 'product', 'product')}{chart('New / Maintenance', k.type, 'type')}</div>}
 {(view === 'people' || view === 'sla') && <>{view === 'people' && <><div className="grid-two">{chart(kind === 'ijr' ? 'Top Implementor 1' : 'Implementor Workload', k.person, kind === 'regional' ? 'person' : undefined)}{kind === 'ijr' ? chart('Top Implementor 2', 'Implementor 2') : kind === 'regional' ? chart('Done by Implementor', 'implementor', 'person', filtered.filter(r => status(r, kind) === 'Done'), '#12a56f') : chart('Overdue by Implementor', 'implementor', undefined, overdue, '#dd3b45')}{kind === 'corporate' && chart('PIC Sales', 'sales')}{kind === 'corporate' && chart('Assigner', 'assigner')}</div><PersonWork productName={productName} rows={filtered} kind={kind} canEdit={p.canEdit} onOpen={setDetail} onDone={p.onDone}/></>}{view === 'sla' && <><p className="notice">Acuan SLA: Memo PEMP/005, efektif 14 Juli 2025. Achievement = Within SLA / (Within SLA + Overdue). Record Without SLA dan SLA Real Unavailable dikecualikan.</p><div className="grid-two"><Panel title="Overdue by SLA Solution"><Bars items={counts(overdue, r => r.sla.solution || 'Unmapped')} color="#dd3b45"/></Panel><Panel title="Overdue Severity"><Bars items={severity(overdue)} color="#d99013"/></Panel></div>{kind !== 'corporate' && <div className="grid-two">{kind === 'ijr' ? chart('Overdue by Flow Process', 'Flow Process', 'flow', overdue, '#dd3b45') : chart('Overdue by TB Produk', 'product', 'product', overdue, '#dd3b45')}{kind === 'ijr' ? chart('Overdue by Wilayah', k.region, 'region', overdue, '#dd3b45') : chart('Overdue by Implementor', 'implementor', 'person', overdue, '#dd3b45')}</div>}<div className={kind === 'regional' ? 'grid-two sla-achievements' : 'sla-achievements'}><Panel title={kind === 'corporate' ? 'SLA Achievement by Segment' : kind === 'ijr' ? 'SLA Achievement by Application Type' : 'SLA Achievement by TB Produk (Top 10)'}>{achievement(kind === 'corporate' ? k.region : k.product || k.type)}</Panel>{kind === 'regional' && <div className="sla-region-rankings"><Panel title="Wilayah Need Attention (Lowest SLA)">{achievement(k.region, 'low')}</Panel><Panel title="Top 5 Wilayah Terbaik (Highest SLA)">{achievement(k.region, 'high')}</Panel></div>}</div></>}
 {view === 'sla' && kind !== 'corporate' && <SlaPeople rows={filtered} kind={kind} selected={person} onSelect={setPerson}/>}</>}
  {view === 'sla' && <><Panel title="Official SLA Target Reference"><div className="table-scroll"><table><thead><tr><th>Solution</th><th>New Project</th><th>Maintenance</th></tr></thead><tbody>{(kind === 'ijr' ? REG_SLA_RULES.filter(r => r[0] === 'BNIdirect') : REG_SLA_RULES).map(([name, n, m]) => <tr key={name}><td>{name}</td><td>{n} working days</td><td>{m} working days</td></tr>)}</tbody></table></div></Panel>{kind === 'corporate' && <SlaSettings rules={p.rules} canEdit={p.canEdit} onSave={p.onSaveRule} onDelete={p.onDeleteRule}/>}</>}
 {view === 'sla' && kind !== 'corporate' && <Records productName={productName} variant="sla" rows={detailRows} kind={kind} onOpen={setDetail} title="SLA Detail"/>}
 {(view === 'overview' || drill !== null) && <Records productName={productName} rows={drill ? filtered.filter(r => (drill.field === 'product' ? productName(text(r.payload.product)) : text(r.payload[drill.field])) === drill.value) : filtered} kind={kind} onOpen={setDetail} title={drill ? 'Detail ' + drill.label + ' — ' + drill.value : undefined}/>}


 </>}
 </Suspense>{detail && <Detail productName={productName} record={detail} kind={kind} canEdit={p.canEdit} onClose={() => setDetail(null)} onDone={p.onDone}/>}</div>;
}
