
create table public.wci_workspaces (
 id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now()
);
create table public.wci_members (
 workspace_id uuid not null references public.wci_workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','editor','viewer')),
 primary key (workspace_id,user_id)
);
create index wci_members_user_idx on public.wci_members(user_id);
create table public.wci_datasets (
 workspace_id uuid not null references public.wci_workspaces(id) on delete cascade,
 kind text not null check(kind in ('ijr','regional','corporate')),
 active_batch uuid, original_batch uuid, primary key(workspace_id,kind)
);
create table public.wci_batches (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, dataset text not null,
 name text not null, row_count integer not null check(row_count>=0), is_original boolean not null default false,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 foreign key(workspace_id,dataset) references public.wci_datasets(workspace_id,kind),
 unique(id,workspace_id,dataset)
);
create index wci_batches_scope_idx on public.wci_batches(workspace_id,dataset);
create unique index wci_one_original_batch_idx on public.wci_batches(workspace_id,dataset) where is_original;
alter table public.wci_datasets add constraint wci_active_batch_fk foreign key(active_batch,workspace_id,kind) references public.wci_batches(id,workspace_id,dataset);
alter table public.wci_datasets add constraint wci_original_batch_fk foreign key(original_batch,workspace_id,kind) references public.wci_batches(id,workspace_id,dataset);
create table public.wci_records (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, dataset text not null,
 batch_id uuid not null, position integer not null check(position>0), payload jsonb not null check(jsonb_typeof(payload)='object'),
 updated_at timestamptz not null default now(),
 foreign key(batch_id,workspace_id,dataset) references public.wci_batches(id,workspace_id,dataset) on delete cascade,
 unique(batch_id,position)
);
create index wci_records_scope_idx on public.wci_records(workspace_id,dataset,batch_id,position);
create table public.wci_sla_rules (
 workspace_id uuid not null references public.wci_workspaces(id) on delete cascade,
 product text not null check(length(trim(product))>0), name text not null, aliases text not null default '',
 new_days integer not null check(new_days between 1 and 365), maint_days integer not null check(maint_days between 1 and 365),
 primary key(workspace_id,product)
);
create table public.wci_audit (
 id bigint generated always as identity primary key, workspace_id uuid not null references public.wci_workspaces(id),
 user_id uuid references auth.users(id), action text not null, dataset text, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index wci_audit_workspace_idx on public.wci_audit(workspace_id,created_at desc);
alter table public.wci_workspaces enable row level security;
alter table public.wci_members enable row level security;
alter table public.wci_datasets enable row level security;
alter table public.wci_batches enable row level security;
alter table public.wci_records enable row level security;
alter table public.wci_sla_rules enable row level security;
alter table public.wci_audit enable row level security;
create policy wci_members_self_read on public.wci_members for select to authenticated using(user_id=(select auth.uid()));
create policy wci_workspaces_read on public.wci_workspaces for select to authenticated using(exists(select 1 from public.wci_members m where m.workspace_id=wci_workspaces.id and m.user_id=(select auth.uid())));
create policy wci_datasets_read on public.wci_datasets for select to authenticated using(exists(select 1 from public.wci_members m where m.workspace_id=wci_datasets.workspace_id and m.user_id=(select auth.uid())));
create policy wci_batches_read on public.wci_batches for select to authenticated using(exists(select 1 from public.wci_members m where m.workspace_id=wci_batches.workspace_id and m.user_id=(select auth.uid())));
create policy wci_records_read on public.wci_records for select to authenticated using(exists(select 1 from public.wci_members m where m.workspace_id=wci_records.workspace_id and m.user_id=(select auth.uid())));
create policy wci_sla_rules_read on public.wci_sla_rules for select to authenticated using(exists(select 1 from public.wci_members m where m.workspace_id=wci_sla_rules.workspace_id and m.user_id=(select auth.uid())));
create policy wci_audit_read on public.wci_audit for select to authenticated using(exists(select 1 from public.wci_members m where m.workspace_id=wci_audit.workspace_id and m.user_id=(select auth.uid())));
create policy wci_datasets_update on public.wci_datasets for update to authenticated using(exists(select 1 from public.wci_members m where m.workspace_id=wci_datasets.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','editor'))) with check(exists(select 1 from public.wci_members m where m.workspace_id=wci_datasets.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','editor')));
create policy wci_sla_rules_update on public.wci_sla_rules for update to authenticated using(exists(select 1 from public.wci_members m where m.workspace_id=wci_sla_rules.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','editor'))) with check(exists(select 1 from public.wci_members m where m.workspace_id=wci_sla_rules.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','editor')));
create policy wci_batches_insert on public.wci_batches for insert to authenticated with check(exists(select 1 from public.wci_members m where m.workspace_id=wci_batches.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','editor')) and not is_original and created_by=(select auth.uid()));
create policy wci_sla_rules_insert on public.wci_sla_rules for insert to authenticated with check(exists(select 1 from public.wci_members m where m.workspace_id=wci_sla_rules.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','editor')));
create policy wci_sla_rules_delete on public.wci_sla_rules for delete to authenticated using(exists(select 1 from public.wci_members m where m.workspace_id=wci_sla_rules.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','editor')));
create policy wci_records_insert on public.wci_records for insert to authenticated with check(exists(select 1 from public.wci_members m where m.workspace_id=wci_records.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','editor')) and exists(select 1 from public.wci_batches b where b.id=batch_id and not b.is_original and b.created_by=(select auth.uid())));
create policy wci_records_update on public.wci_records for update to authenticated using(exists(select 1 from public.wci_members m where m.workspace_id=wci_records.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','editor')) and exists(select 1 from public.wci_datasets d join public.wci_batches b on b.id=d.active_batch where d.workspace_id=wci_records.workspace_id and d.kind=wci_records.dataset and d.active_batch=wci_records.batch_id and not b.is_original)) with check(exists(select 1 from public.wci_members m where m.workspace_id=wci_records.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','editor')) and exists(select 1 from public.wci_datasets d join public.wci_batches b on b.id=d.active_batch where d.workspace_id=wci_records.workspace_id and d.kind=wci_records.dataset and d.active_batch=wci_records.batch_id and not b.is_original));
create policy wci_audit_insert on public.wci_audit for insert to authenticated with check(exists(select 1 from public.wci_members m where m.workspace_id=wci_audit.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','editor')) and user_id=(select auth.uid()));

revoke all on public.wci_workspaces,public.wci_members,public.wci_datasets,public.wci_batches,public.wci_records,public.wci_sla_rules,public.wci_audit from anon,authenticated;
grant select on public.wci_workspaces,public.wci_members,public.wci_datasets,public.wci_batches,public.wci_records,public.wci_sla_rules,public.wci_audit to authenticated;
grant insert on public.wci_batches,public.wci_records,public.wci_audit to authenticated;
grant update(active_batch) on public.wci_datasets to authenticated;
grant update(payload) on public.wci_records to authenticated;
grant insert,update,delete on public.wci_sla_rules to authenticated;
grant usage on sequence public.wci_audit_id_seq to authenticated;
create function public.wci_replace_dataset(p_workspace uuid,p_kind text,p_rows jsonb,p_name text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare batch uuid; n integer;
begin
 if auth.uid() is null or not exists(select 1 from public.wci_members where workspace_id=p_workspace and user_id=auth.uid() and role in ('admin','editor')) then raise exception 'Workspace write access required'; end if;
 if jsonb_typeof(p_rows)<>'array' then raise exception 'Rows must be an array'; end if;
 n=jsonb_array_length(p_rows);if n<1 or n>100000 then raise exception 'Invalid row count'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r)<>'object' or
  (p_kind='ijr' and (coalesce(trim(r->>'Application Number'),'')='' or coalesce(trim(r->>'Status'),'')='')) or
  (p_kind in ('regional','corporate') and (coalesce(trim(r->>'company'),'')='' or coalesce(trim(r->>'product'),'')='' or coalesce(trim(r->>'status'),'')='')) or
  (p_kind='corporate' and coalesce(trim(r->>'noreg'),'')='')) then raise exception 'Missing required row fields'; end if;
 perform 1 from public.wci_datasets where workspace_id=p_workspace and kind=p_kind for update;
 insert into public.wci_batches(workspace_id,dataset,name,row_count,created_by) values(p_workspace,p_kind,left(p_name,250),n,auth.uid()) returning id into batch;
 insert into public.wci_records(workspace_id,dataset,batch_id,position,payload) select p_workspace,p_kind,batch,ordinality::integer,value from jsonb_array_elements(p_rows) with ordinality;
 update public.wci_datasets set active_batch=batch where workspace_id=p_workspace and kind=p_kind;
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(p_workspace,auth.uid(),'import',p_kind,jsonb_build_object('batch',batch,'rows',n,'file',left(p_name,250)));
 return batch;
end $$;
create function public.wci_restore_original(p_workspace uuid,p_kind text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare source uuid; batch uuid; n integer;
begin
 if auth.uid() is null or not exists(select 1 from public.wci_members where workspace_id=p_workspace and user_id=auth.uid() and role in ('admin','editor')) then raise exception 'Workspace write access required'; end if;
 select original_batch into source from public.wci_datasets where workspace_id=p_workspace and kind=p_kind for update;
 if source is null then raise exception 'Original dataset unavailable'; end if;
 select count(*) into n from public.wci_records where batch_id=source;
 insert into public.wci_batches(workspace_id,dataset,name,row_count,created_by) values(p_workspace,p_kind,'Restore original',n,auth.uid()) returning id into batch;
 insert into public.wci_records(workspace_id,dataset,batch_id,position,payload) select workspace_id,dataset,batch,position,payload from public.wci_records where batch_id=source;
 update public.wci_datasets set active_batch=batch where workspace_id=p_workspace and kind=p_kind;
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(p_workspace,auth.uid(),'restore',p_kind,jsonb_build_object('batch',batch,'rows',n));
 return batch;
end $$;
create function public.wci_record_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.updated_at=now();
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(new.workspace_id,auth.uid(),'update_record',new.dataset,jsonb_build_object('record',new.id,'old_status',old.payload->>'status','new_status',new.payload->>'status','note',new.payload->>'dashboardNote'));
 return new;
end $$;
create trigger wci_record_audit before update on public.wci_records for each row execute function public.wci_record_audit();
revoke execute on function public.wci_replace_dataset(uuid,text,jsonb,text),public.wci_restore_original(uuid,text),public.wci_record_audit() from public,anon;
grant execute on function public.wci_replace_dataset(uuid,text,jsonb,text),public.wci_restore_original(uuid,text) to authenticated;
-- Pre-authorized email grants are maintained only by project administrators.
create schema if not exists wci_private;
revoke all on schema wci_private from public,anon,authenticated;
create table wci_private.access_grants (
 email text primary key, workspace_id uuid not null references public.wci_workspaces(id),
 role text not null check(role in ('admin','editor','viewer'))
);
alter table wci_private.access_grants enable row level security;
-- This private definer is invoked exclusively by the trusted Auth table trigger,
-- after email verification. It grants only a previously authorized email and is
-- not callable through the Data API or by application roles.
create function wci_private.accept_verified_grant() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is null then return new; end if;
 insert into public.wci_members(workspace_id,user_id,role)
 select workspace_id,new.id,role from wci_private.access_grants where lower(email)=lower(new.email)
 on conflict(workspace_id,user_id) do nothing;
 return new;
end $$;
revoke all on function wci_private.accept_verified_grant() from public,anon,authenticated;
create trigger wci_accept_verified_grant after insert or update of email_confirmed_at,email on auth.users for each row execute function wci_private.accept_verified_grant();
