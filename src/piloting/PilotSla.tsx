import { lazy, Suspense } from 'react';
import { type MonitoringRecord, type SlaRule } from '../types';
import { REG_SLA_RULES } from '../domain/memo';
import { Panel, Bars, Donut } from '../components/Charts';
import { breakdown, field, value, duration } from './model';
import { isMeasured, slaMetrics } from './sla';
import { usePilotText, PilotRecords, PilotTable } from './ui';
const SlaSettings=lazy(()=>import('../components/SlaSettings'));
export function PilotSla({rows,rules,canEdit,onSave,onDelete,onOpen,onDrill}:{rows:MonitoringRecord[];rules:SlaRule[];canEdit:boolean;onSave:(r:SlaRule)=>Promise<void>;onDelete:(s:string)=>Promise<void>;onOpen:(r:MonitoringRecord)=>void;onDrill:(title:string,rows:MonitoringRecord[])=>void}) {
  const t=usePilotText(),m=slaMetrics(rows),measured=rows.filter(isMeasured),overdue=measured.filter(r=>r.sla.status==='Overdue');
  const cards:[string,string,MonitoringRecord[]][]=[['Measurable',String(m.measured),measured],['Within SLA',String(m.within),measured.filter(r=>r.sla.status==='Within SLA')],['Overdue',String(m.overdue),overdue],['SLA Achievement',m.achievement===null?'—':m.achievement.toFixed(1)+'%',measured],['Belum dapat dinilai',String(m.unavailable),rows.filter(r=>value(r,field.status)==='Done'&&!isMeasured(r))]];
  const solutions=new Map<string,number>();overdue.forEach(r=>{const n=r.sla.solution||'—';solutions.set(n,(solutions.get(n)||0)+1);});
  const severity=[['1–2 hari',overdue.filter(r=>(r.sla.over||0)<=2).length],['3–5 hari',overdue.filter(r=>(r.sla.over||0)>2&&(r.sla.over||0)<=5).length],['>5 hari',overdue.filter(r=>(r.sla.over||0)>5).length]] as [string,number][];
  const groups=breakdown(measured,field.group).map(([name])=>{const eligible=measured.filter(r=>value(r,field.group)===name);return {name,...slaMetrics(eligible),rows:eligible};});
  return <><div className="kpis pilot-cards">{cards.map(([name,n,data],i)=><button key={name} className={'kpi source-'+['blue','green','red','teal','amber'][i]} onClick={()=>onDrill(name,data)}><small>{t(name)}</small><strong>{n}</strong><span>{t('Pekerjaan selesai')}</span></button>)}</div><p className="report-sub">{t('SLA Achievement')} = Within SLA / {t('Measurable')}</p>
    <div className="grid-two"><Panel title={t('SLA Performance')}><Donut items={[[t('Within SLA'),m.within],[t('Overdue'),m.overdue]]} colors={['#087f8c','#c85f69']} onSelect={name=>onDrill(name,measured.filter(r=>t(r.sla.status)===name))}/></Panel><Panel title={t('Overdue by SLA Solution')}><Bars items={[...solutions]} color="#c85f69" onSelect={name=>onDrill(name,overdue.filter(r=>r.sla.solution===name))}/></Panel><Panel title={t('Overdue Severity')}><Bars items={severity} color="#d5913d" onSelect={name=>onDrill(name,overdue.filter(r=>name==='1–2 hari'?(r.sla.over||0)<=2:name==='3–5 hari'?(r.sla.over||0)>2&&(r.sla.over||0)<=5:(r.sla.over||0)>5))}/></Panel><Panel title={t('SLA Achievement by Segment')}><PilotTable rows={groups} idOf={r=>r.name} columns={[{label:'Kelompok',render:r=><button className="text-button" onClick={()=>onDrill(r.name,r.rows)}>{r.name}</button>},{label:'Measurable',render:r=>r.measured},{label:'Within SLA',render:r=>r.within},{label:'Overdue',render:r=>r.overdue},{label:'SLA Achievement',render:r=>r.achievement===null?'—':r.achievement.toFixed(1)+'%'}]}/></Panel></div>
    <Panel title={t('Official SLA Target Reference')}><div className="table-wrap"><table><thead><tr><th>{t('Solution')}</th><th>{t('New Project')}</th><th>{t('Maintenance')}</th></tr></thead><tbody>{REG_SLA_RULES.map(([name,n,m])=><tr key={name}><td>{name}</td><td>{n} {t('working days')}</td><td>{m} {t('working days')}</td></tr>)}</tbody></table></div></Panel>
    <Suspense fallback={<p>{t('Memproses…')}</p>}><SlaSettings rules={rules} canEdit={canEdit} onSave={onSave} onDelete={onDelete}/></Suspense>
  </>;
}
