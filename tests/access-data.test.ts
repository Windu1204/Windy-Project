import { describe,it,expect } from 'vitest';
import { mergeUpload } from '../src/domain/data-identity';
import { scopedRows,visiblePersonNames,type Profile,type Grant,type Team } from '../src/lib/access';
import { pilotReportModel } from '../src/piloting/reports';
import { pilotSla } from '../src/piloting/sla';
import { type Payload } from '../src/types';
describe('versioned uploads',()=>{
 const row:Payload={company:'A',cid:'100',product:'VA',type:'Maintenance',salesDate:'2026-08-03',status:'Pending',implementor:'Desta'};
 it('updates mutable status/PIC, skips identical rows, merges partial uploads and detects conflicts',()=>{const b={...row,cid:'200',company:'B'};const r=mergeUpload('regional',[row,b],[{...row,status:'Done',implementor:'Resti'},{...row,status:'Done',implementor:'Resti'}]);expect(r.rows).toHaveLength(2);expect(r).toMatchObject({newRows:0,updated:1,duplicates:1,unchanged:0});expect(mergeUpload('regional',r.rows,r.rows)).toMatchObject({unchanged:2,updated:0});expect(()=>mergeUpload('regional',[],[row,{...row,status:'Done'}])).toThrow(/berbeda/);});
 it('preserves Done changes when an older spreadsheet is uploaded',()=>{const done={...row,status:'Done',dashboardUpdatedAt:'2026-10-04T00:00:00Z',dashboardNote:'Selesai'};expect(mergeUpload('regional',[done],[row]).rows[0]).toEqual({...done,doneDate:'2026-10-04'});});
 it('does not merge different requests from the same company or missing identity fields',()=>{expect(mergeUpload('regional',[row],[{...row,salesDate:'2026-08-04'}]).rows).toHaveLength(2);expect(()=>mergeUpload('regional',[],[{...row,salesDate:null}])).toThrow(/Identitas/);expect(mergeUpload('piloting',[],[{'No. Register':'A','PIC AT':'Desta'}]).rows).toHaveLength(1);});
});
describe('dashboard access',()=>{
 const p:Profile={workspace_id:'w',user_id:'u',name:'User',email:'x@example.test',role:'individual',active:true};
 const grants:Grant[]=[{dataset:'regional',source:'AT',pic:'Desta',team_id:'t'}],teams:Team[]=[{id:'t',workspace_id:'w',dataset:'regional',source:'AT',name:'Team',leader_id:'u'}],people=[{team_id:'t',pic:'Desta'}];const rows=[{payload:{implementor:'Desta'}},{payload:{implementor:'Resti'}}];
 it('restricts individuals/team leaders, keeps unmapped individuals empty and excludes other dashboards/PM',()=>{expect(scopedRows(rows,'regional',p,grants,teams,people)).toHaveLength(1);expect(scopedRows(rows,'corporate',p,grants,teams,people)).toHaveLength(0);expect(scopedRows(rows,'regional',{...p,role:'team_leader'},grants,teams,people)).toHaveLength(1);expect(scopedRows(rows,'regional',{...p,role:'team_leader'},grants,[],people)).toHaveLength(0);expect(scopedRows(rows,'regional',p,[{...grants[0],pic:''}],teams,people)).toHaveLength(0);expect(scopedRows(rows,'regional',p,[{...grants[0],source:'PM'}],teams,people)).toHaveLength(0);});
 it('shows all source members for an authorized unmapped TL and keeps individuals scoped to themselves',()=>{
  const leader={...p,role:'team_leader' as const},unmapped=[{...grants[0],team_id:null,pic:''}];
  expect(scopedRows(rows,'regional',leader,unmapped,teams,people)).toEqual(rows);
  expect(visiblePersonNames('regional',leader,unmapped,people)).toBeUndefined();
  expect(scopedRows(rows,'regional',p,unmapped,teams,people)).toEqual([]);
  expect(visiblePersonNames('regional',p,unmapped,people)).toEqual([]);
  expect(scopedRows(rows,'corporate',leader,unmapped,teams,people)).toEqual([]);
  expect(scopedRows(rows,'regional',leader,[],teams,people)).toEqual([]);
  expect(scopedRows(rows,'regional',leader,grants,teams,[])).toEqual(rows);
 });
 it('includes new upload members before team mapping and narrows to the team after mapping',()=>{
  const latest=[...rows,{payload:{implementor:'New member'}}],leader={...p,role:'team_leader' as const};
  expect(scopedRows(latest,'regional',leader,[{...grants[0],team_id:null}],teams,people)).toHaveLength(3);
  expect(scopedRows(latest,'regional',leader,grants,teams,people)).toHaveLength(1);
  expect(visiblePersonNames('regional',leader,grants,people)).toEqual(['Desta']);
  for(const changes of [{workspace_id:'other'},{dataset:'corporate' as const},{source:'PM' as const},{leader_id:'other'}])
   expect(scopedRows(latest,'regional',leader,grants,[{...teams[0],...changes}],people)).toEqual([]);
 });
 it('grants full scoped viewing to department heads and super admins, but no analytics to admin/inactive accounts',()=>{expect(scopedRows(rows,'regional',{...p,role:'department_head'},grants,teams,people)).toHaveLength(2);expect(scopedRows(rows,'corporate',{...p,role:'department_head'},grants,teams,people)).toHaveLength(0);expect(scopedRows(rows,'corporate',{...p,role:'super_admin'},[],[],[])).toHaveLength(2);expect(scopedRows(rows,'regional',{...p,role:'admin'},grants,teams,people)).toHaveLength(0);expect(scopedRows(rows,'regional',{...p,active:false},grants,teams,people)).toHaveLength(0);});
});
it('packs All AT discrepancy cases into a table without dropping any original detail, for both All and individual reports',()=>{const payload:Payload={'No. Register':'A','Nama Perusahaan':'A Ltd','PIC AT':'Desta','Kategori':'Done','Status Discrepancy':'Discrepancy','Alasan Discrepancy':'Reason '.repeat(80),'Komitmen Discrepancy':'Commitment','Pemenuhan Discrepancy':'Pending'};const rows=[payload,{...payload,'No. Register':'B'}].map((payload,i)=>({id:String(i),payload,sla:pilotSla(payload)}));const m=pilotReportModel(rows,'',['discrepancy','highlights']);expect(m.pages[0].headers).toHaveLength(9);expect(m.pages[0].rows).toHaveLength(2);expect(m.pages[0].rows[0][6]).toBe(String(payload['Alasan Discrepancy']).trim());expect(m.pages[1].rows).toHaveLength(6);const individual=pilotReportModel(rows,'Desta',['discrepancy']);expect(individual.pages).toHaveLength(1);expect(individual.pages[0].rows).toEqual(m.pages[0].rows);expect(individual.pages[0].headers).toHaveLength(9);});
