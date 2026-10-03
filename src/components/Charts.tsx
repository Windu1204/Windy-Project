import { useLanguage } from '../lib/language';
import { type ReactNode } from 'react';
const palette = ['#12a56f', '#1769d2', '#d99013', '#7b4be2', '#dd3b45', '#079b98', '#8090a6'];
export function Panel({ title, hint, children, className = '' }: {
    title: string;
    hint?: string;
    children: ReactNode;
    className?: string;
}) { const { t } = useLanguage();  return <section className={'panel ' + className}><div className="panel-head"><h3>{t(title)}</h3>{hint && <p>{t(hint)}</p>}</div>{children}</section>; }
export function Bars({ items, onSelect, color = '#1685f4', limit = 12 }: {
    items: [
        string,
        number
    ][];
    onSelect?: (s: string) => void;
    color?: string;
    limit?: number;
}) { const { t } = useLanguage();  const vals = items.slice(0, limit), max = Math.max(1, ...vals.map(x => x[1])); return <div className="bars">{vals.length ? vals.map(([name, value]) => <button key={name} className="bar-row" title={name} disabled={!onSelect} onClick={() => onSelect?.(name)}><span>{name}</span><span className="bar-track"><i style={{ width: `${value / max * 100}%`, background: color }}/></span><b>{value.toLocaleString()}</b></button>) : <p className="empty">{t("Tidak ada data.")}</p>}</div>; }
export function Donut({ items, onSelect, colors = palette, colorByName = {} }: {
    colors?: string[];
    colorByName?: Record<string, string>;
    items: [
        string,
        number
    ][];
    onSelect?: (s: string) => void;
}) { const { t } = useLanguage();  const total = items.reduce((n, x) => n + x[1], 0); let cursor = 0; const gradient = items.map(([name, v], i) => { const from = cursor; cursor += total ? v / total * 100 : 0; return `${(colorByName[name] || colors[i % colors.length])} ${from}% ${cursor}%`; }).join(','); return <div className="donut-wrap"><div className="donut" role="img" aria-label={items.map(x => x.join(': ')).join(', ')} style={{ background: total ? `conic-gradient(${gradient})` : '#e8eff7' }}><div><strong>{total.toLocaleString()}</strong><small>{t("RECORDS")}</small></div></div><div className="legend">{items.map(([name, n], i) => <button key={name} disabled={!onSelect} onClick={() => onSelect?.(name)}><i style={{ background: (colorByName[name] || colors[i % colors.length]) }}/><span>{name}</span><b>{n.toLocaleString()} <small>{t("(")}{total ? (n / total * 100).toFixed(1) : 0}{t("%)")}</small></b></button>)}</div></div>; }
export function Trend({ items }: {
    items: [
        string,
        number
    ][];
}) { const { t } = useLanguage();  const values = [...items].sort((a, b) => a[0].localeCompare(b[0])), max = Math.max(1, ...values.map(x => x[1])), points = values.map((x, i) => [25 + i * (550 / Math.max(1, values.length - 1)), 160 - x[1] / max * 130]); return values.length ? <svg className="trend" viewBox="0 0 610 205" role="img" aria-label={t("Request volume by date")}>{[0, 1, 2, 3].map(n => <g key={n}><line x1="25" x2="580" y1={30 + n * 43} y2={30 + n * 43} stroke="#e9f0f7"/><text x="4" y={30 + n * 43} fontSize="9" fill="#7e91a8">{Math.round(max * (1 - n / 3))}</text></g>)}<path d={points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')} fill="none" stroke="#1587f5" strokeWidth="3"/>{points.map(([x, y], i) => <g key={values[i][0]}><circle cx={x} cy={y} r="4" fill="#1587f5"><title>{values[i][0]}{t(":")}{values[i][1]}</title></circle><text x={x} y="188" fontSize="9" fill="#6d83a0" textAnchor="middle">{values[i][0].slice(2)}</text></g>)}</svg> : <p className="empty">{t("Tidak ada tanggal valid.")}</p>; }
