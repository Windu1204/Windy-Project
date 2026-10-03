begin;
insert into auth.users(id,email,email_confirmed_at) values('a3399c02-c2b5-46af-8db3-483497d3f789','wci-verification@example.invalid',now());
insert into public.wci_members(workspace_id,user_id,role) values('00a0f3a9-ba2b-42fb-8f98-211e5c1fa8cb','a3399c02-c2b5-46af-8db3-483497d3f789','viewer');
set local role authenticated;
select set_config('request.jwt.claim.sub','a3399c02-c2b5-46af-8db3-483497d3f789',true);
do $$ declare n integer; begin
 select count(*) into n from public.wci_records where dataset='ijr';if n<>2000 then raise exception 'Viewer read failed';end if;
 update public.wci_records set payload=payload||'{"dashboardNote":"verification"}'::jsonb where dataset='regional';
 get diagnostics n=row_count;if n<>0 then raise exception 'Viewer unexpectedly changed records';end if;
 begin
  perform public.wci_restore_original('00a0f3a9-ba2b-42fb-8f98-211e5c1fa8cb','ijr');
  raise exception 'Viewer unexpectedly restored records';
 exception when raise_exception then
  if sqlerrm<>'Workspace write access required' then raise;end if;
 end;
end $$;
reset role;
update public.wci_members set role='editor' where user_id='a3399c02-c2b5-46af-8db3-483497d3f789';
set local role authenticated;
do $$ declare b uuid;n integer; begin
 b=public.wci_replace_dataset('00a0f3a9-ba2b-42fb-8f98-211e5c1fa8cb','ijr','[{"Application Number":"TEST-DB","Status":"Proses Selesai"}]'::jsonb,'Database verification');
 select count(*) into n from public.wci_records where batch_id=b;if n<>1 then raise exception 'Editor import failed';end if;
 b=public.wci_restore_original('00a0f3a9-ba2b-42fb-8f98-211e5c1fa8cb','ijr');
 select count(*) into n from public.wci_records where batch_id=b;if n<>1000 then raise exception 'Editor restore failed';end if;
 update public.wci_records set payload=payload||'{"status":"Done","dashboardNote":"verification"}'::jsonb where dataset='regional' and position=1 and batch_id in(select active_batch from public.wci_datasets);
 get diagnostics n=row_count;if n<>1 then raise exception 'Editor record update failed';end if;
 update public.wci_records set payload=payload||'{"dashboardNote":"verification"}'::jsonb where batch_id in(select original_batch from public.wci_datasets);
 get diagnostics n=row_count;if n<>0 then raise exception 'Original data mutable';end if;
 insert into public.wci_sla_rules(workspace_id,product,name,new_days,maint_days) values('00a0f3a9-ba2b-42fb-8f98-211e5c1fa8cb','TEST-RULE','Verification',3,2);
end $$;
select set_config('request.jwt.claim.sub','5a39dd8b-a595-4321-8876-bd518414a731',true);
do $$ declare n integer; begin select count(*) into n from public.wci_records;if n<>0 then raise exception 'Nonmember read failed';end if;end $$;
set local role anon;
do $$ begin
 begin
  perform count(*) from public.wci_records;raise exception 'Anonymous records exposed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
select 'Viewer, editor, nonmember, anonymous, import, restore, original immutability and audit checks passed; transaction rolled back.' as result;
