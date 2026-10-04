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
insert into public.wci_batches(workspace_id,dataset,name,row_count) select id,'regional','RLS baseline',2 from wci_test_ids where name='workspace';
update public.wci_datasets set active_batch=(select id from public.wci_batches where workspace_id=(select id from wci_test_ids where name='workspace') and dataset='regional') where workspace_id=(select id from wci_test_ids where name='workspace') and kind='regional';
insert into public.wci_records(workspace_id,dataset,batch_id,position,payload,job_key) select b.workspace_id,b.dataset,b.id,n,jsonb_build_object('company','Test '||n,'cid',n,'product','VA','type','Maintenance','salesDate','2026-08-03','status','Pending','implementor',case n when 1 then 'Person A' else 'Person B' end),wci_private.job_identity('regional',jsonb_build_object('company','Test '||n,'cid',n,'product','VA','type','Maintenance','salesDate','2026-08-03')) from public.wci_batches b cross join generate_series(1,2) n where b.workspace_id=(select id from wci_test_ids where name='workspace');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='person'),true);
do $$begin
if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>1 then raise exception 'Individual scope failed';end if;
begin perform public.wci_mark_done((select id from wci_test_ids where name='workspace'),(select id from public.wci_records where position=2),'');raise exception 'Cross-person Done allowed';exception when others then if sqlerrm='Cross-person Done allowed' then raise;end if;end;
perform public.wci_mark_done((select id from wci_test_ids where name='workspace'),(select id from public.wci_records where position=1),'Completed');
if (select payload->>'status' from public.wci_records where position=1)<>'Done' then raise exception 'Own Done failed';end if;
begin perform public.wci_set_data_mode((select id from wci_test_ids where name='workspace'),'regional','operational');raise exception 'Mode privilege escalation';exception when others then if sqlerrm='Mode privilege escalation' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='leader'),true);
do $$begin if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>1 then raise exception 'Team scope failed';end if;end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='head'),true);
do $$begin if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>2 then raise exception 'Department scope failed';end if;end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='admin'),true);
do $$begin
if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>0 then raise exception 'Admin analytics leak';end if;
perform public.wci_replace_dataset((select id from wci_test_ids where name='workspace'),'regional','[{"company":"Test 1","cid":1,"product":"VA","type":"Maintenance","salesDate":"2026-08-03","status":"Pending","implementor":"Person A"},{"company":"Test 3","cid":3,"product":"VA","type":"Maintenance","salesDate":"2026-08-03","status":"Pending","implementor":"Person C"}]','Partial update');
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='super'),true);
do $$begin
if (select count(*) from public.wci_records where batch_id=(select active_batch from public.wci_datasets where workspace_id=(select id from wci_test_ids where name='workspace') and kind='regional'))<>3 then raise exception 'Partial merge lost data';end if;
if (select payload->>'status' from public.wci_records where batch_id=(select active_batch from public.wci_datasets where workspace_id=(select id from wci_test_ids where name='workspace') and kind='regional') and payload->>'company'='Test 1')<>'Done' then raise exception 'Old upload reverted Done';end if;
perform public.wci_set_data_mode((select id from wci_test_ids where name='workspace'),'regional','operational');
if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>0 then raise exception 'Reference mixed into operational';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='outsider'),true);
do $$begin if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>0 then raise exception 'Unmapped access leak';end if;end $$;
reset role;
rollback;
select 'PASS: individual, team, department, admin, super admin, unmapped, partial merge, Done protection and data-mode isolation' as verification;
