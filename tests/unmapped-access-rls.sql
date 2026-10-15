-- Entire test runs in one transaction and leaves no accounts, data or audit rows behind.
begin;
create temporary table wci_test_ids(name text primary key,id uuid default gen_random_uuid());
insert into wci_test_ids(name) values('workspace'),('super'),('admin'),('head'),('leader'),('person'),('outsider'),('team'),('unmapped_person'),('unmapped_leader'),('gated'),('inactive');
grant select on wci_test_ids to authenticated;
insert into auth.users(id,email) select id,name||'@wci-test.invalid' from wci_test_ids where name in('super','admin','head','leader','person','outsider','unmapped_person','unmapped_leader','gated','inactive');
insert into public.wci_workspaces(id,name) select id,'Temporary RLS test' from wci_test_ids where name='workspace';
insert into public.wci_profiles(workspace_id,user_id,email,name,role)
select w.id,u.id,u.name||'@wci-test.invalid',u.name,case u.name when 'super' then 'super_admin' when 'head' then 'department_head' when 'leader' then 'team_leader' when 'person' then 'individual' when 'unmapped_person' then 'individual' when 'unmapped_leader' then 'team_leader' when 'gated' then 'team_leader' when 'inactive' then 'team_leader' else 'admin' end
from wci_test_ids w cross join wci_test_ids u where w.name='workspace' and u.name in('super','admin','head','leader','person','unmapped_person','unmapped_leader','gated','inactive');
insert into public.wci_members(workspace_id,user_id,role) select workspace_id,user_id,'viewer' from public.wci_profiles where workspace_id=(select id from wci_test_ids where name='workspace');
insert into public.wci_datasets(workspace_id,kind) select w.id,k from wci_test_ids w cross join unnest(array['ijr','regional','corporate','piloting']) k where w.name='workspace';
insert into public.wci_teams(id,workspace_id,dataset,name,leader_id) values((select id from wci_test_ids where name='team'),(select id from wci_test_ids where name='workspace'),'regional','Team A',(select id from wci_test_ids where name='leader'));
insert into public.wci_team_people(team_id,pic) values((select id from wci_test_ids where name='team'),'Person A');
insert into public.wci_access(workspace_id,user_id,dataset,team_id,pic) select w.id,u.id,'regional',case when u.name='leader' then (select id from wci_test_ids where name='team') else null end,case when u.name='person' then 'Person A' else '' end from wci_test_ids w cross join wci_test_ids u where w.name='workspace' and u.name in('head','leader','person','unmapped_person','unmapped_leader','gated','inactive');
insert into public.wci_batches(workspace_id,dataset,name,row_count) select id,'regional','RLS baseline',3 from wci_test_ids where name='workspace';
update public.wci_datasets set active_batch=(select id from public.wci_batches where workspace_id=(select id from wci_test_ids where name='workspace') and dataset='regional') where workspace_id=(select id from wci_test_ids where name='workspace') and kind='regional';
insert into public.wci_records(workspace_id,dataset,batch_id,position,payload,job_key) select b.workspace_id,b.dataset,b.id,n,jsonb_build_object('company','Test '||n,'cid',n,'product','VA','type','Maintenance','salesDate','2026-08-03','status','Pending','implementor',case n when 1 then 'Person A' when 2 then 'Person B' else null end),wci_private.job_identity('regional',jsonb_build_object('company','Test '||n,'cid',n,'product','VA','type','Maintenance','salesDate','2026-08-03')) from public.wci_batches b cross join generate_series(1,3) n where b.workspace_id=(select id from wci_test_ids where name='workspace');

update public.wci_profiles set active=false where user_id=(select id from wci_test_ids where name='inactive');
insert into wci_private.wci_password_requirements(user_id,initial_hash) select id,'fixture-only' from wci_test_ids where name='gated';
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='person'),true);
do $$ begin
 if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>1 then raise exception 'person read scope failed';end if;
 if exists(select 1 from public.wci_records where workspace_id<>(select id from wci_test_ids where name='workspace')) then raise exception 'Cross workspace leak';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='leader'),true);
do $$ begin
 if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>1 then raise exception 'leader read scope failed';end if;
 if exists(select 1 from public.wci_records where workspace_id<>(select id from wci_test_ids where name='workspace')) then raise exception 'Cross workspace leak';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='unmapped_person'),true);
do $$ begin
 if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>0 then raise exception 'unmapped_person read scope failed';end if;
 if exists(select 1 from public.wci_records where workspace_id<>(select id from wci_test_ids where name='workspace')) then raise exception 'Cross workspace leak';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='unmapped_leader'),true);
do $$ begin
 if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>3 then raise exception 'unmapped_leader read scope failed';end if;
 if exists(select 1 from public.wci_records where workspace_id<>(select id from wci_test_ids where name='workspace')) then raise exception 'Cross workspace leak';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='head'),true);
do $$ begin
 if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>3 then raise exception 'head read scope failed';end if;
 if exists(select 1 from public.wci_records where workspace_id<>(select id from wci_test_ids where name='workspace')) then raise exception 'Cross workspace leak';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='super'),true);
do $$ begin
 if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>3 then raise exception 'super read scope failed';end if;
 if exists(select 1 from public.wci_records where workspace_id<>(select id from wci_test_ids where name='workspace')) then raise exception 'Cross workspace leak';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='admin'),true);
do $$ begin
 if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>0 then raise exception 'admin read scope failed';end if;
 if exists(select 1 from public.wci_records where workspace_id<>(select id from wci_test_ids where name='workspace')) then raise exception 'Cross workspace leak';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='outsider'),true);
do $$ begin
 if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>0 then raise exception 'outsider read scope failed';end if;
 if exists(select 1 from public.wci_records where workspace_id<>(select id from wci_test_ids where name='workspace')) then raise exception 'Cross workspace leak';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='gated'),true);
do $$ begin
 if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>0 then raise exception 'gated read scope failed';end if;
 if exists(select 1 from public.wci_records where workspace_id<>(select id from wci_test_ids where name='workspace')) then raise exception 'Cross workspace leak';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='inactive'),true);
do $$ begin
 if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>0 then raise exception 'inactive read scope failed';end if;
 if exists(select 1 from public.wci_records where workspace_id<>(select id from wci_test_ids where name='workspace')) then raise exception 'Cross workspace leak';end if;
end $$;

select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='unmapped_person'),true);
do $$ begin
 if wci_private.row_access((select id from wci_test_ids where name='workspace'),'regional','{"implementor":"Person B"}'::jsonb) then raise exception 'Unmapped view granted edit ownership';end if;
 begin
 perform public.wci_mark_done((select id from wci_test_ids where name='workspace'),(select id from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace') and position=2),'');
 raise exception 'Unmapped edit was allowed';
 exception when others then if sqlerrm='Unmapped edit was allowed' then raise;end if;end;
end $$;
-- TL may be saved before team mapping; individual users still require an explicit PIC.
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='super'),true);
do $$ begin
 begin
 perform public.wci_save_user((select id from wci_test_ids where name='workspace'),(select id from wci_test_ids where name='unmapped_person'),'Unmapped reader','individual',true,'[{"dataset":"regional","source":"AT","pic":"","team_id":null}]'::jsonb);
 raise exception 'Empty individual mapping accepted';
 exception when others then if sqlerrm='Empty individual mapping accepted' then raise;end if;end;
end $$;
select public.wci_save_user((select id from wci_test_ids where name='workspace'),(select id from wci_test_ids where name='unmapped_leader'),'Unmapped leader','team_leader',true,'[{"dataset":"regional","source":"AT","pic":"","team_id":null}]'::jsonb);
select public.wci_save_user((select id from wci_test_ids where name='workspace'),(select id from wci_test_ids where name='unmapped_person'),'Mapped reader','individual',true,'[{"dataset":"regional","source":"AT","pic":"Person B","team_id":null}]'::jsonb);
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='unmapped_person'),true);
do $$ begin
 if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>1 then raise exception 'Mapping did not narrow visibility';end if;
end $$;
reset role;
-- An empty valid team is unmapped; a foreign leader link is invalid and must not widen access.
delete from public.wci_team_people where team_id=(select id from wci_test_ids where name='team');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from wci_test_ids where name='leader'),true);
do $$ begin if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>3 then raise exception 'Empty valid team fallback failed';end if;end $$;
reset role;
update public.wci_teams set leader_id=(select id from wci_test_ids where name='unmapped_leader') where id=(select id from wci_test_ids where name='team');
set local role authenticated;
do $$ begin if (select count(*) from public.wci_records where workspace_id=(select id from wci_test_ids where name='workspace'))<>0 then raise exception 'Invalid leader link widened access';end if;end $$;
reset role;
rollback;
select 'PASS: unmapped and mapped roles, disabled and gated users, dashboard isolation, edit ownership and mapping transitions' as verification;
