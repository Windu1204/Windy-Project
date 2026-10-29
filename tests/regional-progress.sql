-- Entire test runs in one transaction and leaves no accounts, data or audit rows behind.
begin;
create temporary table wci_test_ids(name text primary key,id uuid default gen_random_uuid());
insert into wci_test_ids(name) values('workspace'),('super'),('admin'),('head'),('leader'),('person'),('outsider'),('team');
grant select on wci_test_ids to authenticated;
insert into auth.users(id,email) select id,name||'@wci-test.invalid' from wci_test_ids where name in('super','admin','head','leader','person','outsider');
insert into public.wci_workspaces(id,name) select id,'Temporary RLS test' from wci_test_ids where name='workspace';
insert into public.wci_profiles(workspace_id,user_id,email,name,role)
select w.id,u.id,u.name||'@wci-test.invalid',u.name,case u.name when 'super' then 'super_admin' when 'head' then 'department_head' when 'leader' then 'team_leader' when 'person' then 'individual' else 'admin' end
from wci_test_ids w cross join wci_test_ids u where w.name='workspace' and u.name in('super','admin','head','leader','person');
insert into public.wci_members(workspace_id,user_id,role) select workspace_id,user_id,'viewer' from public.wci_profiles where workspace_id=(select id from wci_test_ids where name='workspace');
insert into public.wci_datasets(workspace_id,kind) select w.id,k from wci_test_ids w cross join unnest(array['ijr','regional','corporate','piloting']) k where w.name='workspace';
insert into public.wci_teams(id,workspace_id,dataset,name,leader_id) values((select id from wci_test_ids where name='team'),(select id from wci_test_ids where name='workspace'),'regional','Team A',(select id from wci_test_ids where name='leader'));
insert into public.wci_team_people(team_id,pic) values((select id from wci_test_ids where name='team'),'Person A');
insert into public.wci_access(workspace_id,user_id,dataset,team_id,pic) select w.id,u.id,'regional',case when u.name='leader' then (select id from wci_test_ids where name='team') else null end,case when u.name='person' then 'Person A' else '' end from wci_test_ids w cross join wci_test_ids u where w.name='workspace' and u.name in('head','leader','person');
insert into public.wci_batches(workspace_id,dataset,name,row_count) select id,'regional','RLS baseline',4 from wci_test_ids where name='workspace';
update public.wci_datasets set active_batch=(select id from public.wci_batches where workspace_id=(select id from wci_test_ids where name='workspace') and dataset='regional') where workspace_id=(select id from wci_test_ids where name='workspace') and kind='regional';
insert into public.wci_records(workspace_id,dataset,batch_id,position,payload,job_key) select b.workspace_id,b.dataset,b.id,n,jsonb_build_object('company','Test '||n,'cid',n,'product','VA','type',case n when 2 then 'Maintenance' else 'New' end,'salesDate','2026-08-03','status',case n when 4 then 'Done' else 'Pending' end,'doneDate',case n when 4 then '2026-08-03' end,'implementor',case when n=3 then 'Person B' else 'Person A' end),wci_private.job_identity('regional',jsonb_build_object('company','Test '||n,'cid',n,'product','VA','type',case n when 2 then 'Maintenance' else 'New' end,'salesDate','2026-08-03')) from public.wci_batches b cross join generate_series(1,4) n where b.workspace_id=(select id from wci_test_ids where name='workspace');

insert into wci_test_ids(name,id) select 'record-'||position,id from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace');
insert into public.wci_events(workspace_id,revision) values((select id from wci_test_ids where name='workspace'),1) on conflict(workspace_id) do nothing;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='person'),true);
do $$declare w uuid:=(select id from wci_test_ids where name='workspace');a uuid:=(select id from wci_test_ids where name='record-1');m uuid:=(select id from wci_test_ids where name='record-2');d text;stamp text;rev bigint;begin
 begin perform public.wci_regional_progress(w,a,'handover',null,'');raise exception 'EARLY_HANDOVER';exception when others then if sqlerrm='EARLY_HANDOVER' then raise;end if;end;
 begin perform public.wci_regional_progress(w,a,'done',null,'');raise exception 'MISSING_COMPANY';exception when others then if sqlerrm='MISSING_COMPANY' then raise;end if;end;
 begin perform public.wci_mark_done(w,a,'');raise exception 'LEGACY_BYPASS';exception when others then if sqlerrm='LEGACY_BYPASS' then raise;end if;end;
 begin perform public.wci_regional_progress(w,(select id from wci_test_ids where name='record-3'),'done','other','');raise exception 'CROSS_PERSON';exception when others then if sqlerrm='CROSS_PERSON' then raise;end if;end;
 perform public.wci_regional_progress(w,(select id from wci_test_ids where name='record-4'),'done','SOURCE-DONE','');
 perform public.wci_regional_progress(w,(select id from wci_test_ids where name='record-4'),'handover',null,'');
 if (select payload->>'doneDate' from public.wci_records where id=(select id from wci_test_ids where name='record-4'))<>'2026-08-03' then raise exception 'Source Done date changed';end if;
 perform public.wci_regional_progress(w,a,'done','  COMPANY-001  ','Completed');
 if (select payload->>'companyId' from public.wci_records where id=a)<>'COMPANY-001' then raise exception 'Company ID missing';end if;
 select payload->>'doneDate' into d from public.wci_records where id=a;
 perform public.wci_regional_progress(w,m,'done',null,'');
 if (select payload->>'status' from public.wci_records where id=m)<>'Done' or (select payload->>'companyId' from public.wci_records where id=m) is not null then raise exception 'Maintenance should complete without Company ID';end if;
 begin perform public.wci_regional_progress(w,m,'handover',null,'');raise exception 'MAINT_HANDOVER';exception when others then if sqlerrm='MAINT_HANDOVER' then raise;end if;end;
 perform public.wci_regional_progress(w,a,'handover',null,'');
 if (select payload->>'doneDate' from public.wci_records where id=a) is distinct from d or (select payload->>'status' from public.wci_records where id=a)<>'Done' then raise exception 'Handover changed Done date/status';end if;
 select payload->>'dashboardHandoverAt' into stamp from public.wci_records where id=a;
 if stamp is null then raise exception 'Handover missing';end if;
 select revision into rev from public.wci_events where workspace_id=w;
 perform public.wci_regional_progress(w,a,'handover',null,'');
 if (select payload->>'dashboardHandoverAt' from public.wci_records where id=a) is distinct from stamp or (select revision from public.wci_events where workspace_id=w)<>rev then raise exception 'Repeat handover changed state';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='leader'),true);
do $$begin
 begin perform public.wci_regional_progress((select id from wci_test_ids where name='workspace'),(select id from wci_test_ids where name='record-1'),'done','TL','');raise exception 'TL_WRITE';exception when others then if sqlerrm='TL_WRITE' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='super'),true);
do $$declare w uuid:=(select id from wci_test_ids where name='workspace');source jsonb;begin
 select jsonb_agg(payload-'companyId'-'handover'-'dashboardHandoverAt'-'dashboardUpdatedAt'-'doneDate') into source from public.wci_records where workspace_id=w;
 perform public.wci_upload_review(w,'regional',source);
 perform public.wci_replace_dataset(w,'regional',source,'Reupload fixture');
 if not exists(select 1 from public.wci_records r join public.wci_datasets d on d.workspace_id=r.workspace_id and d.kind='regional' and d.active_batch=r.batch_id where r.workspace_id=w and r.payload->>'companyId'='COMPANY-001' and r.payload->>'handover'='Handover' and r.payload->>'status'='Done') then raise exception 'Reupload lost completion metadata';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='person'),true);
do $$begin
 begin perform public.wci_regional_progress((select id from wci_test_ids where name='workspace'),(select id from wci_test_ids where name='record-1'),'done','HISTORIC','');raise exception 'HISTORICAL_WRITE';exception when others then if sqlerrm='HISTORICAL_WRITE' then raise;end if;end;
end $$;
reset role;
rollback;
