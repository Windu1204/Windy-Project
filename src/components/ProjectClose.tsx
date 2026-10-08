import { type MonitoringRecord } from '../types';
import { field, value } from '../piloting/model';
import { Panel } from './Charts';
import { useLanguage } from '../lib/language';
export function ProjectClose({rows,onOpen}:{rows:MonitoringRecord[];onOpen:(rows:MonitoringRecord[])=>void}) {
  const { t } = useLanguage();
  const close=rows.filter(r=>['Done','Reject/Retur'].includes(value(r,field.status)));
  const percent=rows.length?close.length/rows.length*100:0;
  return <Panel title="Project Close vs Project Assign" hint="Project Close = Done + Reject · Reject tidak termasuk SLA">
    <button className="project-close-bar" onClick={()=>onOpen(close)} aria-label={`Project Close ${close.length} dari ${rows.length} Project Assign`}>
      <span><b>Project Close: {close.length.toLocaleString()}</b><span>Project Assign: {rows.length.toLocaleString()}</span></span>
      <span className="project-close-track" aria-hidden="true"><i style={{width:percent+'%'}}/><i className="project-open-segment" style={{width:(100-percent)+'%'}}/></span>
      <span className="project-close-legend"><span><i/>{t('Project Close')}: {close.length.toLocaleString()}</span><span><i className="project-open-key"/>{t('Belum Close')}: {(rows.length-close.length).toLocaleString()}</span></span>
      <span className="project-close-percent">{t('Persentase proyek ditutup')}: <b>{rows.length?percent.toFixed(1)+'%':'—'}</b><small>Project Close / Project Assign · {t('Bukan persentase pencapaian SLA')}</small></span>
    </button>
  </Panel>;
}
