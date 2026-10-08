import { type MonitoringRecord } from '../types';
import { field, value } from '../piloting/model';
import { Panel } from './Charts';
export function ProjectClose({rows,onOpen}:{rows:MonitoringRecord[];onOpen:(rows:MonitoringRecord[])=>void}) {
  const close=rows.filter(r=>['Done','Reject/Retur'].includes(value(r,field.status)));
  const percent=rows.length?close.length/rows.length*100:0;
  return <Panel title="Project Close vs Project Assign" hint="Project Close = Done + Reject · Reject tidak termasuk SLA">
    <button className="project-close-bar" onClick={()=>onOpen(close)} aria-label={`Project Close ${close.length} dari ${rows.length} Project Assign`}>
      <span><b>Project Close: {close.length.toLocaleString()}</b><span>Project Assign: {rows.length.toLocaleString()}</span></span>
      <span className="project-close-track"><i style={{width:percent+'%'}}/></span><span>{percent.toFixed(1)}%</span>
    </button>
  </Panel>;
}
