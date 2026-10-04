import { type MonitoringRecord, emptyFilters } from '../types';
import { productCategory } from '../domain/analytics';
import { PeriodPicker } from '../components/PeriodPicker';
import { breakdown, field, value, initialFilters, type PilotFilters } from './model';
import { usePilotText } from './ui';
export function PilotFilterBar({ rows, filters, onChange, custom = false, hidePerson = false }: { rows: MonitoringRecord[]; filters: PilotFilters; onChange: (f: PilotFilters) => void; custom?: boolean; hidePerson?: boolean }) {
  const t = usePilotText();
  const eligible = rows.filter(r => (!filters.category || productCategory(value(r, field.product), 'corporate') === filters.category) && (!filters.product || value(r, field.product) === filters.product));
  const change = (key: keyof PilotFilters, v: string) => {
    const next = { ...filters, [key]: v, ...(key === 'category' ? { product: '' } : {}) };
    if (key === 'category' || key === 'product') {
      const groups = breakdown(rows.filter(r => (!next.category || productCategory(value(r, field.product), 'corporate') === next.category) && (!next.product || value(r, field.product) === next.product)), field.group).map(([name]) => name);
      // Derive eligible groups; do not force a group if several exist in the source.
      if (next.group && !groups.includes(next.group)) next.group = '';
    }
    onChange(next);
  };
  const select = (key: keyof PilotFilters, label: string, choices: string[], disabled = false) => <label key={key}>{t(label)}<select aria-label={t(label)} value={filters[key]} disabled={disabled} onChange={e => change(key, e.target.value)}><option value="">{t('Semua')}</option>{choices.map(name => <option key={name}>{name}</option>)}</select></label>;
  return <section className={'filter-panel pilot-filters' + (custom ? ' pilot-custom-filters' : '')} aria-label={t(custom ? 'Filter Custom Report' : 'Filter Dashboard')}>
    {custom&&<h4 className="report-filter-title">CUSTOM REPORT FILTERS</h4>}
    <label>{t('Pencarian')}<input aria-label={t('Cari data')} placeholder={t('Cari nomor register, perusahaan, PIC…')} value={filters.search} onChange={e => change('search', e.target.value)}/></label>
    <PeriodPicker label={t('Periode Assign ke AT')} value={{ ...emptyFilters, from: filters.from, to: filters.to, period: filters.period }} onChange={f => onChange({ ...filters, from: f.from, to: f.to, period: f.period })}/>
    {select('category', 'Produk', [...new Set(rows.map(r => productCategory(value(r, field.product), 'corporate')))].sort())}
    {select('product', 'Subproduk', breakdown(rows.filter(r => !filters.category || productCategory(value(r, field.product), 'corporate') === filters.category), field.product).map(([n]) => n), !filters.category)}
    {select('group', 'Kelompok', breakdown(eligible, field.group).map(([n]) => n))}
    {!hidePerson&&select('person', 'PIC AT', breakdown(rows, field.person).map(([n]) => n))}
    {select('status', 'Status Pekerjaan', breakdown(rows, field.status).map(([n]) => n))}
    {select('discrepancy', 'Status Discrepancy', breakdown(rows, field.discrepancy).map(([n]) => n))}
    {select('form', 'Jenis Formulir', breakdown(rows, field.form).map(([n]) => n))}
    {select('sla', 'SLA Status', ['Within SLA', 'Overdue', 'Without SLA', 'SLA Real Unavailable'])}
    <button className="secondary" onClick={() => onChange({ ...initialFilters })}>{t('Reset Filter')}</button>
  </section>;
}
