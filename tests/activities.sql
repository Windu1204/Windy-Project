-- Rollback-only fixtures: no real accounts, files, records or audit data are changed.
begin;
create temporary table activity_ids(name text primary key,id uuid default gen_random_uuid());
insert into activity_ids(name) values('w'),('a'),('b'),('head'),('tl'),('admin'),('super'),('team'),('cal-a'),('cal-b'),('training'),('call'),('h-reg'),('h-ijr');
grant select on activity_ids to authenticated;
insert into auth.users(id,email) select id,'activity-'||name||'@qa.invalid' from activity_ids where name in('a','b','head','tl','admin','super');
insert into public.wci_workspaces(id,name) select id,'Activity rollback fixture' from activity_ids where name='w';
insert into public.wci_profiles(workspace_id,user_id,name,email,role)
 select w.id,u.id,case u.name when 'a' then 'Person A' when 'b' then 'Person B' else u.name end,u.name||'@qa.invalid',case u.name when 'a' then 'individual' when 'b' then 'individual' when 'head' then 'department_head' when 'tl' then 'team_leader' when 'super' then 'super_admin' else 'admin' end
 from activity_ids w cross join activity_ids u where w.name='w' and u.name in('a','b','head','tl','admin','super');
insert into public.wci_members(workspace_id,user_id,role) select workspace_id,user_id,'viewer' from public.wci_profiles where workspace_id=(select id from activity_ids where name='w');
insert into public.wci_access(workspace_id,user_id,dataset,pic) select w.id,u.id,k,case u.name when 'a' then 'Person A' when 'b' then 'Person B' else '' end from activity_ids w cross join activity_ids u cross join unnest(array['ijr','regional']) k where w.name='w' and u.name in('a','b','head','tl');
insert into public.wci_datasets(workspace_id,kind) select id,k from activity_ids cross join unnest(array['ijr','regional']) k where name='w';
insert into public.wci_batches(workspace_id,dataset,name,row_count) select id,k,'Activity fixtures',3 from activity_ids cross join unnest(array['ijr','regional']) k where name='w';
update public.wci_datasets d set active_batch=b.id from public.wci_batches b where d.workspace_id=b.workspace_id and d.kind=b.dataset and d.workspace_id=(select id from activity_ids where name='w');
insert into public.wci_records(workspace_id,dataset,batch_id,position,payload,job_key)
select b.workspace_id,b.dataset,b.id,n,p,wci_private.job_identity(b.dataset,p) from public.wci_batches b cross join generate_series(1,3) n cross join lateral (select case when b.dataset='regional' then jsonb_build_object('company','Fixture '||n,'cid',n,'product','VA','type',case n when 2 then 'Maintenance' else 'New' end,'salesDate','2026-11-01','status',case n when 3 then 'Pending' else 'Done' end,'doneDate','2026-11-01','companyId','COMPANY','implementor','Person A') else jsonb_build_object('Application Number','APP-'||n,'Applicant Name','Fixture '||n,'Application Type',case n when 2 then 'Maintenance' else 'New Request' end,'Status',case n when 3 then 'Dalam Proses' else 'Proses Selesai' end,'Implementor 1','Person A') end p) x where b.workspace_id=(select id from activity_ids where name='w');
insert into activity_ids(name,id) select dataset||position,id from public.wci_records where workspace_id=(select id from activity_ids where name='w');
insert into storage.objects(bucket_id,name,metadata) select 'wci-activity-files',w.id||'/'||k||'/'||u.id||'/'||a.id||'/proof.pdf','{"mimetype":"application/pdf","size":20}'::jsonb from activity_ids w cross join activity_ids u cross join (values('h-reg','regional'),('h-ijr','ijr'),('training','ijr')) v(n,k) join activity_ids a on a.name=v.n where w.name='w' and u.name='a';
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from activity_ids where name='a'),true);
do $$declare w uuid:=(select id from activity_ids where name='w');a uuid:=(select id from activity_ids where name='a');v public.wci_activities;f jsonb;stamp timestamptz;begin
 v:=public.wci_activity_save(w,'regional',(select id from activity_ids where name='cal-a'),'calendar','{"implementor":"Person A","date":"2026-11-04","time":"10:00","place":"Teams","remarks":"Fixture"}','[]');stamp:=v.updated_at;
 if v.owner_id<>a then raise exception 'owner not server-controlled';end if;
 begin perform public.wci_activity_save(w,'regional',v.id,'calendar',v.payload,'[]',null);raise exception 'BUG stale update';exception when others then if sqlerrm='BUG stale update' then raise;end if;end;
 v:=public.wci_activity_save(w,'regional',v.id,'calendar',v.payload||'{"time":"11:00"}','[]',stamp);
 begin perform public.wci_activity_save(w,'regional',gen_random_uuid(),'calendar','{"implementor":"Person B","date":"2026-11-04","time":"10:00","place":"Teams"}','[]');raise exception 'BUG impersonation';exception when others then if sqlerrm='BUG impersonation' then raise;end if;end;
 begin perform public.wci_activity_save(w,'ijr',(select id from activity_ids where name='training'),'training','{"implementor":"Person A","date":"2026-11-04","product":"BNIdirect","bni":[],"customers":[]}','[]');raise exception 'BUG proof optional';exception when others then if sqlerrm='BUG proof optional' then raise;end if;end;
 f:=jsonb_build_array(jsonb_build_object('path',w||'/ijr/'||a||'/'||(select id from activity_ids where name='training')||'/proof.pdf','name','proof.pdf'));
 perform public.wci_activity_save(w,'ijr',(select id from activity_ids where name='training'),'training','{"implementor":"Person A","date":"2026-11-04","product":"BNIdirect","bni":[{"name":"Person A","attended":true}],"customers":[{"name":"Sari","attended":true},{"name":"Sari","attended":false}]}',f);
 perform public.wci_activity_save(w,'ijr',(select id from activity_ids where name='call'),'call','{"implementor":"Person A","date":"2026-11-04","product":"BNIdirect","bni":[],"customers":[],"title":"Call fixture","company":"Example","start":"10:00","end":"11:00","mode":"Online","place":"Teams","discussion":"Discussion","feedback":"Feedback","potential":"Potential","followup":"Follow up"}','[]');
 f:=jsonb_build_array(jsonb_build_object('path',w||'/regional/'||a||'/'||(select id from activity_ids where name='h-reg')||'/proof.pdf','name','proof.pdf'));
 begin perform public.wci_activity_save(w,'regional',(select id from activity_ids where name='h-reg'),'handover','{"implementor":"Person A","measure":"item","quantity":"5","informed":false}',f,null,(select id from activity_ids where name='regional1'));raise exception 'BUG checklist';exception when others then if sqlerrm='BUG checklist' then raise;end if;end;
 v:=public.wci_activity_save(w,'regional',(select id from activity_ids where name='h-reg'),'handover','{"implementor":"Person A","measure":"item","quantity":"5","informed":true}',f,null,(select id from activity_ids where name='regional1'));
 if v.job_key is null or v.data_mode<>'reference' then raise exception 'stable handover identity missing';end if;
 begin perform public.wci_regional_progress(w,(select id from activity_ids where name='regional1'),'handover',null,'');raise exception 'BUG legacy bypass';exception when others then if sqlerrm='BUG legacy bypass' then raise;end if;end;
 begin perform public.wci_activity_save(w,'regional',gen_random_uuid(),'handover','{"implementor":"Person A","measure":"item","quantity":"5","informed":true}',f,null,(select id from activity_ids where name='regional2'));raise exception 'BUG maintenance';exception when others then if sqlerrm='BUG maintenance' then raise;end if;end;
 f:=jsonb_build_array(jsonb_build_object('path',w||'/ijr/'||a||'/'||(select id from activity_ids where name='h-ijr')||'/proof.pdf','name','proof.pdf'));
 begin perform public.wci_activity_save(w,'ijr',(select id from activity_ids where name='h-ijr'),'handover','{"implementor":"Person A","measure":"volume","quantity":"3.5","informed":true}',f,null,(select id from activity_ids where name='ijr3'));raise exception 'BUG pending';exception when others then if sqlerrm='BUG pending' then raise;end if;end;
 perform public.wci_activity_save(w,'ijr',(select id from activity_ids where name='h-ijr'),'handover','{"implementor":"Person A","measure":"volume","quantity":"3.5","informed":true}',f,null,(select id from activity_ids where name='ijr1'));
 if exists(select 1 from public.wci_records where workspace_id=w and dataset='ijr' and position=1 and payload->>'Status'<>'Proses Selesai') then raise exception 'source status changed';end if;
 if (select count(*) from public.wci_activities where workspace_id=w)<>5 then raise exception 'activity count mismatch';end if;
 if not exists(select 1 from storage.objects where bucket_id='wci-activity-files' and name=w||'/ijr/'||a||'/'||(select id from activity_ids where name='h-ijr')||'/proof.pdf') then raise exception 'storage RLS blocks owner';end if;
 if not wci_private.activity_file_access(w||'/ijr/'||a||'/'||(select id from activity_ids where name='h-ijr')||'/proof.pdf') then raise exception 'owner cannot download';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from activity_ids where name='b'),true);
do $$declare w uuid:=(select id from activity_ids where name='w');begin
 if exists(select 1 from public.wci_activity_read(w,'regional')) then raise exception 'other user reads private activities';end if;
 if exists(select 1 from storage.objects where bucket_id='wci-activity-files' and name like w::text||'/ijr/%') then raise exception 'storage RLS exposes other user files';end if;
 if wci_private.activity_file_access(w||'/ijr/'||(select id from activity_ids where name='a')||'/'||(select id from activity_ids where name='h-ijr')||'/proof.pdf') then raise exception 'other user downloads proof';end if;
 begin perform public.wci_activity_save(w,'regional',(select id from activity_ids where name='cal-a'),'calendar','{"implementor":"Person B","date":"2026-11-04","time":"10:00","place":"Teams"}','[]');raise exception 'BUG other write';exception when others then if sqlerrm='BUG other write' then raise;end if;end;
 perform public.wci_activity_save(w,'regional',(select id from activity_ids where name='cal-b'),'calendar','{"implementor":"Person B","date":"2026-11-04","time":"10:00","place":"Teams"}','[]');
 begin perform public.wci_activity_read(w,'regional',(select id from activity_ids where name='a'));raise exception 'BUG view-as';exception when others then if sqlerrm='BUG view-as' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from activity_ids where name='tl'),true);
do $$declare w uuid:=(select id from activity_ids where name='w');begin
 if (select count(*) from public.wci_activity_read(w,'regional'))<>3 then raise exception 'unmapped TL scope mismatch';end if;
 begin perform public.wci_activity_save(w,'regional',gen_random_uuid(),'calendar','{"implementor":"Person A","date":"2026-11-04","time":"10:00","place":"Teams"}','[]');raise exception 'BUG TL write';exception when others then if sqlerrm='BUG TL write' then raise;end if;end;
end $$;
reset role;
insert into public.wci_teams(id,workspace_id,dataset,name,leader_id) select t.id,w.id,'regional','Fixture team',l.id from activity_ids t cross join activity_ids w cross join activity_ids l where t.name='team' and w.name='w' and l.name='tl';
insert into public.wci_team_people(team_id,pic) select id,'Person A' from activity_ids where name='team';
update public.wci_access set team_id=(select id from activity_ids where name='team') where workspace_id=(select id from activity_ids where name='w') and user_id=(select id from activity_ids where name='tl') and dataset='regional';
set local role authenticated;
do $$declare w uuid:=(select id from activity_ids where name='w');source jsonb;begin
 if (select count(*) from public.wci_activity_read(w,'regional'))<>2 then raise exception 'mapped TL scope mismatch';end if;
 perform set_config('request.jwt.claim.sub',(select id::text from activity_ids where name='head'),true);
 if (select count(*) from public.wci_activity_read(w,'regional'))<>3 then raise exception 'DH scope mismatch';end if;
 perform set_config('request.jwt.claim.sub',(select id::text from activity_ids where name='admin'),true);
 if (select count(*) from public.wci_activity_read(w,'ijr'))<>3 then raise exception 'Admin scope mismatch';end if;
 perform set_config('request.jwt.claim.sub',(select id::text from activity_ids where name='super'),true);
 if (select count(*) from public.wci_activity_read(w,'regional',(select id from activity_ids where name='b')))<>1 then raise exception 'Super Admin preview wrong';end if;
 select jsonb_agg(r.payload) into source from public.wci_records r join public.wci_datasets d on d.workspace_id=r.workspace_id and d.kind=r.dataset and d.active_batch=r.batch_id where r.workspace_id=w and r.dataset='regional';
 perform public.wci_replace_dataset(w,'regional',source,'Reupload activity fixture');
 if not exists(select 1 from public.wci_activities a join public.wci_records r on r.workspace_id=a.workspace_id and r.dataset=a.dataset and r.job_key=a.job_key join public.wci_datasets d on d.workspace_id=r.workspace_id and d.kind=r.dataset and d.active_batch=r.batch_id where a.workspace_id=w and a.kind='handover' and a.dataset='regional') then raise exception 'handover identity lost on upload';end if;
 if has_function_privilege('anon','public.wci_activity_save(uuid,text,uuid,text,jsonb,jsonb,timestamptz,uuid)','execute') then raise exception 'anonymous mutation exposed';end if;
end $$;
rollback;
