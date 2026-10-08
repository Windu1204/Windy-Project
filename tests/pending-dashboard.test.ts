import { describe, it, expect } from 'vitest';
import { calculateSla } from '../src/domain/sla';
import { normalize } from '../src/domain/imports';
import { slaIssue } from '../src/domain/sla-diagnostics';
import { field } from '../src/piloting/model';
import { pilotSla, slaMetrics } from '../src/piloting/sla';
import { reportCharts, productChartPanels } from '../src/piloting/report-charts';
import { regionMonthlyOverview } from '../src/domain/report-renderers/region-overview.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Kpis } from '../src/components/Kpis';
import { type MonitoringRecord, type Payload } from '../src/types';

describe('pending revisions preserve populations and SLA rules',()=>{
  it('shows every IJR source status individually and preserves empty cards after filtering',()=>{
    const statuses=['Dalam Proses','Dibatalkan','Need Amandment','Proses Selesai','Registered, Delivered','Waiting for Approval','Waiting for Onboarding','Status baru'];
    const rows=statuses.map((Status,i)=>({id:String(i),payload:{Status},sla:calculateSla({},'ijr')}));
    const full=renderToStaticMarkup(createElement(Kpis,{kind:'ijr',rows,onSelect:()=>{},onTotal:()=>{}}));
    for(const status of statuses)expect(full).toContain(status);
    expect(full).not.toContain('Waiting Status');
    expect(full.match(/<button/g)).toHaveLength(statuses.length+1);
    const filtered=renderToStaticMarkup(createElement(Kpis,{kind:'ijr',rows:rows.slice(0,1),availableStatuses:statuses,onSelect:()=>{}}));
    expect(filtered.match(/<strong>0<\/strong>/g)).toHaveLength(statuses.length-1);
  });
  it('separates closed Reject jobs from unfinished jobs without including them in SLA',()=>{
    const make=(status:string):MonitoringRecord=>{const payload={[field.status]:status,[field.product]:'BNIDirect',[field.form]:'Maintenance',[field.assigned]:'2026-08-14',[field.days]:1};return {id:status,payload,sla:pilotSla(payload)};};
    const reject=make('Reject/Retur'),pending=make('Masih Pending'),done=make('Done');
    expect(slaIssue(reject,'piloting')?.reason).toContain('tidak termasuk penilaian SLA');
    expect(slaIssue(pending,'piloting')?.reason).toBe('Pekerjaan belum Done');
    expect(slaIssue(done,'piloting')).toBeNull();
    expect(slaMetrics([reject,pending,done])).toMatchObject({measured:1,within:1,unavailable:0});
  });
  it('reads Regional milestone header variations without substituting setting date for Done',()=>{
    const [payload]=normalize([{company:'Company',product:'BNIDirect',type:'Maintenance',status:'Done','Tanggal Dokumen Lengkap':'14/08/2026','Completed Date':'18/08/2026','Selesai Setting':'14/08/2026'}],'regional');
    expect(payload).toMatchObject({docComplete:'2026-08-14',doneDate:'2026-08-18',settingDone:'2026-08-14'});
    expect(calculateSla(payload,'regional').real).toBe(1);
    expect(calculateSla({...payload,doneDate:null},'regional').real).toBeNull();
  });
  it('keeps all regions on every month continuation and reconciles N/M totals',()=>{
    const rows:Payload[]=Array.from({length:22},(_,region)=>Array.from({length:8},(_,month)=>({region:'W'+String(region+1).padStart(2,'0'),month:'2026-'+String(month+1).padStart(2,'0'),type:region%2?'M':'N'}))).flat();
    const result=regionMonthlyOverview(rows,{region:r=>String(r.region),type:r=>String(r.type),month:r=>String(r.month)});
    expect(result.pages).toHaveLength(3);
    let reconciled=0;
    for(const page of result.pages){
      expect(page.rows.slice(0,-1).map(row=>row[0])).toEqual(result.names);
      const total=page.rows.at(-1)!;
      for(let i=1;i<page.headers.length;i++)expect(page.rows.slice(0,-1).reduce((n,row)=>n+Number(row[i]),0)).toBe(Number(total[i]));
      for(let i=1;i<total.length-1;i+=3)expect(Number(total[i])+Number(total[i+1])).toBe(Number(total[i+2]));
      reconciled+=Number(total.at(-1));
    }
    expect(reconciled).toBe(rows.length);
  });
  it('splits product chart panels without losing labels, counts or N/M colors and removes only discrepancy charts',()=>{
    const rows:MonitoringRecord[]=Array.from({length:20},(_,i)=>({id:String(i),payload:{[field.product]:'Product '+i,[field.form]:i%2?'Maintenance':'New'},sla:calculateSla({},'corporate')}));
    const chart=reportCharts('Overview Produk',rows)[0],panels=productChartPanels(chart);
    expect(panels).toHaveLength(2);
    expect(panels.flatMap(p=>p.items)).toEqual(chart.items);
    chart.series!.forEach((series,i)=>{
      expect(panels.flatMap(p=>p.series![i].values)).toEqual(series.values);
      expect(panels.map(p=>p.series![i].color)).toEqual([series.color,series.color]);
    });
    expect(reportCharts('Rincian Discrepancy',rows)).toEqual([]);
    expect(reportCharts('Overview per Segmen',rows)).toHaveLength(1);
  });
});
