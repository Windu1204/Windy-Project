import { useLanguage } from '../lib/language';
import { RotateCcw } from 'lucide-react';
import { type DatasetKind, type MonitoringRecord, type Filters, type FilterKey, text, emptyFilters } from '../types';
import { fields, options, people, status, productCategory } from '../domain/analytics';
import { productKey, regionalProductLabels } from '../domain/display';
import { PeriodPicker } from './PeriodPicker';
export function FilterBar({ rows, kind, value, onChange }: {
    rows: MonitoringRecord[];
    kind: DatasetKind;
    value: Filters;
    onChange: (f: Filters) => void;
}) { const { t } = useLanguage(); 
    const k = fields[kind], set = (key: FilterKey, v: string) => onChange({ ...value, [key]: v, ...(key === 'category' ? { product: '' } : {}) });
    const select = (key: FilterKey, label: string, values: string[]) => <label key={key}>{t(label)}<select aria-label={t(label)} disabled={key === 'product' && !value.category} value={value[key]} onChange={e => set(key, e.target.value)}><option value="">{t('Semua') + ' ' + t(label)}</option>{values.map(v => <option key={v}>{v}</option>)}</select></label>;
    const labels = regionalProductLabels(rows);
    const products = [...new Set(options(rows.filter(r => productCategory(text(r.payload.product), kind) === value.category), 'product').map(name => kind === 'regional' ? labels.get(productKey(name)) || name : name))];
    const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
    return <section className="filter-panel"><div className={'primary-filters filter-' + kind}><label>{t("Search")}<input aria-label={t("Cari data")} placeholder={t(kind === 'ijr' ? 'Application no, applicant, PIC...' : 'Company, CID, produk, implementor...')} value={value.search} onChange={e => set('search', e.target.value)}/></label><PeriodPicker value={value} onChange={onChange}/>{kind === 'ijr' ? <>{select('type', 'Application Type', options(rows, k.type))}{select('status', 'Status', uniq(rows.map(r => status(r, kind))))}{select('flow', 'Flow Process', ['Asisten CS BNI Direct', 'Validator 1', 'Implementor 1', 'Implementor 2'])}{select('region', 'Wilayah', options(rows, k.region))}</> : kind === 'regional' ? <>{select('region', 'Wilayah', options(rows, k.region))}{select('status', 'Status', uniq(rows.map(r => status(r, kind))))}{select('type', 'New / Maintenance', options(rows, k.type))}{select('category', 'TB Produk', uniq(rows.map(r => productCategory(text(r.payload.product), kind))))}{select('product', 'Sub TB Produk', products)}{<label>{t("Implementor (HO)")}<input aria-label={t("Implementor (HO)")} list="regional-implementors" value={value.person} placeholder={t("Semua Implementor")} onChange={e => set('person', e.target.value)}/><datalist id="regional-implementors">{uniq(rows.flatMap(r => people(r, kind))).map(name => <option key={name} value={name}/>)}</datalist></label>}</> : <>{select('region', 'Segment', options(rows, k.region))}{select('type', 'Project Type', options(rows, k.type))}{select('category', 'Product', uniq(rows.map(r => productCategory(text(r.payload.product), kind))))}{select('product', 'Sub Product', products)}{select('status', 'Status', uniq(rows.map(r => status(r, kind))))}{select('sla', 'SLA Status', ['Within SLA', 'Overdue', 'Without SLA', 'SLA Real Unavailable'])}</>}<button className="secondary" onClick={() => onChange({ ...emptyFilters })}><RotateCcw size={14}/>{t("Reset Filter")}</button></div>{Object.entries(value).some(([, v]) => v) && <div className="chips">{Object.entries(value).filter(([, v]) => v).map(([key, v]) => <button key={key} onClick={() => set(key as FilterKey, '')}>{v}<span>{t("×")}</span></button>)}</div>}</section>;
}
