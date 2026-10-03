import { useState } from 'react';
import { useLanguage } from '../lib/language';
export function PilotTrend({ items }: { items: [string, number][] }) {
  const { language } = useLanguage(), [active, setActive] = useState<number | null>(null);
  const values = [...items].sort((a,b)=>a[0].localeCompare(b[0])), max = Math.max(1,...values.map(x=>x[1]));
  const points = values.map((v,i)=>[45 + i * 535 / Math.max(1,values.length-1),160-v[1]/max*125]);
  const step = Math.max(1,Math.ceil((values.length-1)/4));
  const date = (s: string, full = false) => new Date(s+'T00:00:00Z').toLocaleDateString(language === 'id' ? 'id-ID' : 'en-GB', {day:'2-digit',month:full?'long':'short',...(full?{year:'numeric' as const}:{}),timeZone:'UTC'});
  return !values.length ? <p className="empty">{language==='id'?'Tidak ada tanggal valid.':'No valid dates.'}</p> : <div className="pilot-trend"><svg viewBox="0 0 625 205" role="img" aria-label={language==='id'?'Tren Assign ke AT':'Requests Assigned to AT'}>
    {[0,1,2,3].map(n=><g key={n}><line x1="45" x2="580" y1={35+n*42} y2={35+n*42} stroke="#e3ebef"/><text x="32" y={39+n*42} fontSize="12" fill="#64748b" textAnchor="end">{Math.round(max*(1-n/3))}</text></g>)}
    <path d={points.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ')} fill="none" stroke="#087f8c" strokeWidth="2.5"/>
    {points.map(([x,y],i)=><g key={values[i][0]}><circle cx={x} cy={y} r="4" fill="#087f8c"/><circle cx={x} cy={y} r="10" fill="transparent" tabIndex={0} role="button" aria-label={`${date(values[i][0],true)}: ${values[i][1]}`} onMouseEnter={()=>setActive(i)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(i)} onBlur={()=>setActive(null)}><title>{date(values[i][0],true)}: {values[i][1]}</title></circle>{(i%step===0||i===values.length-1)&&<text x={x} y="191" fontSize="12" fill="#64748b" textAnchor={i===0?'start':i===values.length-1?'end':'middle'}>{date(values[i][0])}</text>}</g>)}
  </svg>{active!==null&&<div className="pilot-trend-tooltip" role="status">{date(values[active][0],true)} · <b>{values[active][1]}</b></div>}</div>;
}
