import { Search, RotateCcw } from 'lucide-react';
import { type DatasetKind, type MonitoringRecord, type Filters, type FilterKey, text, emptyFilters } from '../types';
import { fields, options, people, status, productCategory } from '../domain/analytics';
export function FilterBar({ rows, kind, value, onChange }: {
    rows: MonitoringRecord[];
    kind: DatasetKind;
    value: Filters;
    onChange: (f: Filters) => void;
}) {
    const k = fields[kind], set = (key: FilterKey, v: string) => onChange({ ...value, [key]: v });
    const select = (key: FilterKey, label: string, values: string[]) => <label key={key}>{label}<select aria-label={label} value={value[key]} onChange={e => set(key, e.target.value)}><option value="">Semua {label}</option>{values.map(v => <option key={v}>{v}</option>)}</select></label>;
    const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
    return <section className="filter-panel"><div className="filter-top"><label className="search"><Search size={17}/><input aria-label="Cari data" placeholder="Cari perusahaan, nomor aplikasi, PIC…" value={value.search} onChange={e => set('search', e.target.value)}/></label><button className="secondary" onClick={() => onChange({ ...emptyFilters })}><RotateCcw size={14}/>Reset</button></div><div className="filters">{select('period', 'Periode', uniq(rows.map(r => text(r.payload[k.date]).slice(0, 7))))}<label>Dari tanggal<input type="date" value={value.from} onChange={e => set('from', e.target.value)}/></label><label>Sampai tanggal<input type="date" min={value.from || undefined} value={value.to} onChange={e => set('to', e.target.value)}/></label>{select('status', 'Status', uniq(rows.map(r => status(r, kind))))}{select('type', kind === 'ijr' ? 'Tipe aplikasi' : 'New / Maintenance', options(rows, k.type))}{select('region', kind === 'corporate' ? 'Segment' : 'Wilayah', options(rows, k.region))}{kind === 'ijr' ? <>{select('flow', 'Flow Process', ['Asisten CS BNI Direct', 'Validator 1', 'Implementor 1', 'Implementor 2'])}{select('branch', 'Cabang', options(rows, 'Cabang'))}</> : <>{select('category', 'Kategori produk', uniq(rows.map(r => productCategory(text(r.payload.product), kind))))}{select('product', 'Produk', options(rows, 'product'))}</>}{select('person', 'PIC / Implementor', uniq(rows.flatMap(r => people(r, kind, true))))}{select('sla', 'SLA', ['Within SLA', 'Overdue', 'Without SLA', 'SLA Real Unavailable'])}</div>{Object.entries(value).some(([, v]) => v) && <div className="chips">{Object.entries(value).filter(([, v]) => v).map(([key, v]) => <button key={key} onClick={() => set(key as FilterKey, '')}>{v}<span>×</span></button>)}</div>}</section>;
}
