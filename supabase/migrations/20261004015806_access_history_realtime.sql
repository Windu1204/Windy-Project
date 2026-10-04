-- Additive access and versioning upgrade. Existing source batches are retained.
create schema if not exists wci_private;
revoke all on schema wci_private from public;
grant usage on schema wci_private to authenticated;
create table public.wci_profiles (
 workspace_id uuid not null references public.wci_workspaces(id), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null default '', email text not null, role text not null check(role in('super_admin','admin','department_head','team_leader','individual')),
 active boolean not null default true, primary key(workspace_id,user_id)
);
create table public.wci_teams (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.wci_workspaces(id),dataset text not null check(dataset in('ijr','regional','corporate','piloting')),
 name text not null,source text not null default 'AT' check(source in('AT','PM')), leader_id uuid references auth.users(id), unique(workspace_id,dataset,source,name)
);
create table public.wci_access (
 workspace_id uuid not null references public.wci_workspaces(id),user_id uuid not null references auth.users(id) on delete cascade,
 dataset text not null check(dataset in('ijr','regional','corporate','piloting')),source text not null default 'AT' check(source in('AT','PM')),
 team_id uuid references public.wci_teams(id),pic text not null default '',primary key(workspace_id,user_id,dataset,source)
);
create table public.wci_team_people (
 team_id uuid not null references public.wci_teams(id),pic text not null check(length(trim(pic))>0),primary key(team_id,pic)
);
create table public.wci_events (
 workspace_id uuid primary key references public.wci_workspaces(id), revision bigint not null default 0, updated_at timestamptz not null default now()
);
alter table public.wci_datasets add column data_mode text not null default 'reference' check(data_mode in('reference','operational'));
alter table public.wci_datasets add column operational_batch uuid references public.wci_batches(id);
alter table public.wci_batches add column data_mode text not null default 'reference' check(data_mode in('reference','operational'));
alter table public.wci_batches add column source text not null default 'AT' check(source in('AT','PM'));
alter table public.wci_batches add column week_start date not null default date_trunc('week',now() at time zone 'Asia/Jakarta')::date;
alter table public.wci_records add column job_key text;
create table public.wci_done_overrides (
 workspace_id uuid not null references public.wci_workspaces(id),data_mode text not null,job_key text not null,
 user_id uuid not null references auth.users(id),note text not null default '',completed_at timestamptz not null default now(),
 primary key(workspace_id,data_mode,job_key)
);
insert into public.wci_profiles(workspace_id,user_id,name,email,role)
 select m.workspace_id,m.user_id,coalesce(u.raw_user_meta_data->>'display_name',''),u.email,
 case when lower(u.email)='windyolivia01@gmail.com' then 'super_admin' when m.role='admin' then 'admin' else 'department_head' end
 from public.wci_members m join auth.users u on u.id=m.user_id;
insert into public.wci_access(workspace_id,user_id,dataset)
 select p.workspace_id,p.user_id,k from public.wci_profiles p cross join unnest(array['ijr','regional','corporate','piloting']) k;
insert into public.wci_events(workspace_id) select id from public.wci_workspaces;

create function wci_private.role_of(w uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.wci_profiles where workspace_id=w and user_id=(select auth.uid()) and active
$$;
create function wci_private.admin(w uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(wci_private.role_of(w) in('admin','super_admin'),false)
$$;
create function wci_private.dashboard_access(w uuid,k text) returns boolean language sql stable security definer set search_path='' as $$
 select wci_private.role_of(w)='super_admin' or (wci_private.role_of(w) in('department_head','team_leader','individual') and exists(select 1 from public.wci_access where workspace_id=w and user_id=(select auth.uid()) and dataset=k and source='AT'))
$$;
create function wci_private.names(k text,p jsonb) returns text[] language sql immutable set search_path='' as $$
 select case when k='ijr' then array[lower(trim(p->>'Implementor 1')),lower(trim(p->>'Implementor 2')),lower(trim(p->>'CS BNI Direct'))]
 when k='piloting' then array[lower(trim(p->>'PIC AT'))] else array[lower(trim(p->>'implementor'))] end
$$;
create function wci_private.row_access(w uuid,k text,p jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select case when wci_private.role_of(w)='super_admin' then true
 when wci_private.role_of(w)='department_head' then wci_private.dashboard_access(w,k)
 when wci_private.role_of(w) in('individual','team_leader') then exists(
 select 1 from public.wci_access a where a.workspace_id=w and a.user_id=(select auth.uid()) and a.dataset=k and a.source='AT' and
 ((wci_private.role_of(w)='individual' and lower(trim(a.pic))=any(wci_private.names(k,p)) and trim(a.pic)<>'') or
 (wci_private.role_of(w)='team_leader' and exists(select 1 from public.wci_teams t join public.wci_team_people x on x.team_id=t.id where t.id=a.team_id and t.workspace_id=w and t.dataset=k and t.source=a.source and t.leader_id=(select auth.uid()) and lower(trim(x.pic))=any(wci_private.names(k,p))))) ) else false end
$$;
create function wci_private.job_identity(k text,p jsonb) returns text language sql immutable set search_path='' as $$
 select case when k='ijr' then 'ijr:'||lower(trim(p->>'Application Number')) when k='corporate' then 'corporate:'||lower(trim(p->>'noreg')) when k='piloting' then 'piloting:AT:'||lower(trim(p->>'No. Register'))
 else 'regional:'||jsonb_build_array(lower(trim(p->>'company')),lower(trim(coalesce(p->>'cid',''))),lower(trim(p->>'product')),lower(trim(coalesce(p->>'type',''))),lower(trim(coalesce(p->>'salesDate',''))))::text end
$$;
create or replace function public.wci_record_audit() returns trigger language plpgsql set search_path='' as $$
begin
 new.updated_at=now();
 if new.payload is distinct from old.payload then
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(new.workspace_id,auth.uid(),'update_record',new.dataset,jsonb_build_object('record',new.id,'before',old.payload,'after',new.payload));
 end if;return new;
end $$;
update public.wci_records set job_key=wci_private.job_identity(dataset,payload);
create index wci_records_job_idx on public.wci_records(workspace_id,dataset,batch_id,job_key);
create index wci_access_user_idx on public.wci_access(user_id,workspace_id,dataset);
create index wci_teams_leader_idx on public.wci_teams(leader_id,workspace_id);
create function wci_private.signal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.wci_events(workspace_id,revision) values(coalesce(new.workspace_id,old.workspace_id),1)
 on conflict(workspace_id) do update set revision=public.wci_events.revision+1,updated_at=now();return null;
end $$;
create trigger wci_profile_signal after insert or update or delete on public.wci_profiles for each row execute function wci_private.signal();
create trigger wci_access_signal after insert or update or delete on public.wci_access for each row execute function wci_private.signal();
create trigger wci_dataset_signal after update on public.wci_datasets for each row execute function wci_private.signal();

-- Remove the previous workspace-wide write/read policies before installing scoped ones.
do $$ declare x record;begin for x in select tablename,policyname from pg_policies where schemaname='public' and tablename like 'wci_%' loop execute format('drop policy %I on public.%I',x.policyname,x.tablename);end loop;end $$;
alter table public.wci_profiles enable row level security;
alter table public.wci_teams enable row level security;
alter table public.wci_access enable row level security;
alter table public.wci_team_people enable row level security;
alter table public.wci_events enable row level security;
alter table public.wci_done_overrides enable row level security;
create policy members_read on public.wci_members for select to authenticated using(user_id=(select auth.uid()) and wci_private.role_of(workspace_id) is not null);
create policy workspace_read on public.wci_workspaces for select to authenticated using(wci_private.role_of(id) is not null);
create policy profile_read on public.wci_profiles for select to authenticated using(user_id=(select auth.uid()) or wci_private.admin(workspace_id));
create policy access_read on public.wci_access for select to authenticated using(user_id=(select auth.uid()) or wci_private.admin(workspace_id));
create policy teams_read on public.wci_teams for select to authenticated using(wci_private.admin(workspace_id) or leader_id=(select auth.uid()));
create policy team_people_read on public.wci_team_people for select to authenticated using(exists(select 1 from public.wci_teams t where t.id=team_id and (wci_private.admin(t.workspace_id) or t.leader_id=(select auth.uid()))));
create policy event_read on public.wci_events for select to authenticated using(exists(select 1 from public.wci_profiles p where p.workspace_id=wci_events.workspace_id and p.user_id=(select auth.uid())));
create policy datasets_read on public.wci_datasets for select to authenticated using(wci_private.admin(workspace_id) or wci_private.dashboard_access(workspace_id,kind));
create policy batches_read on public.wci_batches for select to authenticated using(wci_private.admin(workspace_id) or wci_private.dashboard_access(workspace_id,dataset));
create policy records_read on public.wci_records for select to authenticated using(wci_private.row_access(workspace_id,dataset,payload) and exists(select 1 from public.wci_batches b join public.wci_datasets d on d.workspace_id=b.workspace_id and d.kind=b.dataset where b.id=batch_id and b.source='AT' and b.data_mode=d.data_mode));
create policy rules_read on public.wci_sla_rules for select to authenticated using(wci_private.role_of(workspace_id) is not null);
create policy rules_insert on public.wci_sla_rules for insert to authenticated with check(wci_private.role_of(workspace_id)='super_admin');
create policy rules_update on public.wci_sla_rules for update to authenticated using(wci_private.role_of(workspace_id)='super_admin') with check(wci_private.role_of(workspace_id)='super_admin');
create policy rules_delete on public.wci_sla_rules for delete to authenticated using(wci_private.role_of(workspace_id)='super_admin');
create policy audit_read on public.wci_audit for select to authenticated using(wci_private.admin(workspace_id));
grant select on public.wci_profiles,public.wci_teams,public.wci_team_people,public.wci_access,public.wci_events to authenticated;
revoke insert,update,delete on public.wci_records,public.wci_datasets,public.wci_batches,public.wci_audit from authenticated;

create or replace function public.wci_replace_dataset(p_workspace uuid,p_kind text,p_rows jsonb,p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; baseline uuid; mode text; new_count integer; updated_count integer; unchanged_count integer; duplicate_count integer; total_count integer;
begin
 if auth.uid() is null or not wci_private.admin(p_workspace) then raise exception 'Admin access required';end if;
 if p_kind not in('ijr','regional','corporate','piloting') or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 100000 then raise exception 'Invalid dataset / rows';end if;
 select data_mode,case when data_mode='operational' then operational_batch else active_batch end into mode,baseline from public.wci_datasets where workspace_id=p_workspace and kind=p_kind for update;
 if mode is null then raise exception 'Dataset unavailable';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r)<>'object' or
 (p_kind='ijr' and coalesce(trim(r->>'Application Number'),'')='') or
 (p_kind='corporate' and (coalesce(trim(r->>'noreg'),'')='' or coalesce(trim(r->>'product'),'')='' or coalesce(trim(r->>'company'),'')='')) or
 (p_kind='regional' and (coalesce(trim(r->>'company'),'')='' or coalesce(trim(r->>'product'),'')='' or coalesce(trim(r->>'salesDate'),'')='')) or
 (p_kind='piloting' and (coalesce(trim(r->>'No. Register'),'')='' or coalesce(trim(r->>'PIC AT'),'')='' or coalesce(trim(r->>'Nama Perusahaan'),'')='' or coalesce(trim(r->>'Jenis Produk / Solusi'),'')='' or coalesce(trim(r->>'Tanggal Assign to AT'),'')='' or coalesce(r->>'Kategori','') not in('Done','Reject/Retur','Masih Pending')))) then raise exception 'Identitas / field sumber tidak lengkap';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r group by wci_private.job_identity(p_kind,r) having count(distinct r)>1) then raise exception 'Konflik: identitas sama memiliki isi berbeda dalam file';end if;
 if exists(select 1 from public.wci_records where batch_id=baseline group by job_key having count(distinct payload)>1) then raise exception 'Identitas data sebelumnya ambigu. Tentukan kunci pekerjaan sebelum menggabungkan';end if;
 create temporary table wci_import_stage(job_key text primary key,payload jsonb) on commit drop;
 insert into wci_import_stage select distinct wci_private.job_identity(p_kind,r),r from jsonb_array_elements(p_rows) r;
 duplicate_count=jsonb_array_length(p_rows)-(select count(*) from wci_import_stage);
 update wci_import_stage s set payload=s.payload||jsonb_build_object('status','Done','dashboardUpdatedAt',o.completed_at,'dashboardNote',o.note) from public.wci_done_overrides o where p_kind='regional' and o.workspace_id=p_workspace and o.data_mode=mode and o.job_key=s.job_key;
 select count(*) filter(where old.id is null),count(*) filter(where old.id is not null and old.payload<>s.payload),count(*) filter(where old.payload=s.payload) into new_count,updated_count,unchanged_count from wci_import_stage s left join (select distinct on(job_key) id,job_key,payload from public.wci_records where batch_id=baseline order by job_key,position) old using(job_key);
 insert into wci_import_stage select distinct on(job_key) job_key,payload from public.wci_records where batch_id=baseline order by job_key,position on conflict(job_key) do nothing;
 select count(*) into total_count from wci_import_stage;
 insert into public.wci_batches(workspace_id,dataset,name,row_count,created_by,data_mode) values(p_workspace,p_kind,left(p_name,250),total_count,auth.uid(),mode) returning id into b;
 insert into public.wci_records(workspace_id,dataset,batch_id,position,payload,job_key) select p_workspace,p_kind,b,row_number() over(order by job_key)::integer,payload,job_key from wci_import_stage;
 update public.wci_datasets set active_batch=case when mode='reference' then b else active_batch end,operational_batch=case when mode='operational' then b else operational_batch end where workspace_id=p_workspace and kind=p_kind;
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(p_workspace,auth.uid(),'upload_merge',p_kind,jsonb_build_object('batch',b,'file',left(p_name,250),'mode',mode,'new',new_count,'updated',updated_count,'unchanged',unchanged_count,'duplicates',duplicate_count,'total',total_count));
 return b;
end $$;
create function public.wci_mark_done(p_workspace uuid,p_id uuid,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare r public.wci_records; mode text;
begin
 select * into r from public.wci_records where id=p_id and workspace_id=p_workspace for update;
 if auth.uid() is null or r.id is null or r.dataset<>'regional' or wci_private.role_of(p_workspace)<>'individual' or not wci_private.row_access(p_workspace,'regional',r.payload) then raise exception 'Hanya pengguna Regional dapat menyelesaikan pekerjaannya sendiri';end if;
 select data_mode into mode from public.wci_batches where id=r.batch_id;
 if not exists(select 1 from public.wci_datasets where workspace_id=p_workspace and kind='regional' and data_mode=mode and r.batch_id=case when mode='reference' then active_batch else operational_batch end) then raise exception 'Versi historis hanya dapat dibaca';end if;
 insert into public.wci_done_overrides(workspace_id,data_mode,job_key,user_id,note) values(p_workspace,mode,r.job_key,auth.uid(),left(p_note,500)) on conflict(workspace_id,data_mode,job_key) do update set note=excluded.note,user_id=excluded.user_id,completed_at=now();
 update public.wci_records set payload=payload||jsonb_build_object('status','Done','dashboardNote',left(p_note,500),'dashboardUpdatedAt',now()) where workspace_id=p_workspace and dataset='regional' and job_key=r.job_key and batch_id=r.batch_id;
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(p_workspace,auth.uid(),'mark_done','regional',jsonb_build_object('job_key',r.job_key,'before',r.payload,'after',r.payload||jsonb_build_object('status','Done'),'note',left(p_note,500)));
 update public.wci_events set revision=revision+1,updated_at=now() where workspace_id=p_workspace;
end $$;
create function public.wci_set_data_mode(p_workspace uuid,p_kind text,p_mode text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or wci_private.role_of(p_workspace) is distinct from 'super_admin' or p_mode not in('reference','operational') then raise exception 'Super Admin access required';end if;
 update public.wci_datasets set data_mode=p_mode where workspace_id=p_workspace and kind=p_kind;
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(p_workspace,auth.uid(),'data_mode',p_kind,jsonb_build_object('mode',p_mode));
end $$;
-- The legacy restore endpoint is explicitly disabled; history is selected without overwriting data.
create or replace function public.wci_restore_original(p_workspace uuid,p_kind text) returns uuid language plpgsql set search_path='' as $$ begin raise exception 'Pilih versi pada Riwayat Data. Data operasional tidak dipulihkan dari contoh';end $$;
revoke all on all functions in schema wci_private from public,anon;
grant execute on all functions in schema wci_private to authenticated;
revoke all on function public.wci_replace_dataset(uuid,text,jsonb,text),public.wci_mark_done(uuid,uuid,text),public.wci_set_data_mode(uuid,text,text) from public,anon;
grant execute on function public.wci_replace_dataset(uuid,text,jsonb,text),public.wci_mark_done(uuid,uuid,text),public.wci_set_data_mode(uuid,text,text) to authenticated;
do $$ begin if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='wci_events') then alter publication supabase_realtime add table public.wci_events;end if;end $$;

create function public.wci_save_user(p_workspace uuid,p_user uuid,p_name text,p_role text,p_active boolean,p_access jsonb) returns void language plpgsql security definer set search_path='' as $$
declare caller text; email_address text; old_profile jsonb; x jsonb;
begin
 caller=wci_private.role_of(p_workspace);
 if auth.uid() is null or not wci_private.admin(p_workspace) then raise exception 'Admin access required';end if;
 if p_role not in('super_admin','admin','department_head','team_leader','individual') then raise exception 'Invalid role';end if;
 if caller<>'super_admin' and (p_role in('super_admin','admin') or exists(select 1 from public.wci_profiles where workspace_id=p_workspace and user_id=p_user and role in('super_admin','admin'))) then raise exception 'Super Admin required to manage administrators';end if;
 if p_user=auth.uid() and (not p_active or p_role<>caller) then raise exception 'Tidak dapat menonaktifkan / mengubah role akun sendiri';end if;
 select email into email_address from auth.users where id=p_user;
 if email_address is null then raise exception 'Auth account unavailable';end if;
 if jsonb_typeof(p_access)<>'array' then raise exception 'Invalid access';end if;
 for x in select value from jsonb_array_elements(p_access) loop
 if x->>'dataset' not in('ijr','regional','corporate','piloting') or coalesce(x->>'source','AT') not in('AT','PM') or (coalesce(x->>'source','AT')='PM' and x->>'dataset'<>'piloting') then raise exception 'Invalid dashboard / source';end if;
 if p_role='individual' and x->>'dataset' not in('regional','piloting') then raise exception 'Individual hanya untuk Regional / Piloting';end if;
 if nullif(x->>'team_id','') is not null and not exists(select 1 from public.wci_teams where id=(x->>'team_id')::uuid and workspace_id=p_workspace and dataset=x->>'dataset' and source=coalesce(x->>'source','AT')) then raise exception 'Tim harus sesuai dashboard / sumber';end if;
 end loop;
 select to_jsonb(p) into old_profile from public.wci_profiles p where workspace_id=p_workspace and user_id=p_user;
 insert into public.wci_profiles(workspace_id,user_id,name,email,role,active) values(p_workspace,p_user,left(p_name,200),email_address,p_role,p_active) on conflict(workspace_id,user_id) do update set name=excluded.name,email=excluded.email,role=excluded.role,active=excluded.active;
 insert into public.wci_members(workspace_id,user_id,role) values(p_workspace,p_user,case when p_role in('super_admin','admin') then 'admin' else 'viewer' end) on conflict(workspace_id,user_id) do update set role=excluded.role;
 delete from public.wci_access where workspace_id=p_workspace and user_id=p_user;
 insert into public.wci_access(workspace_id,user_id,dataset,source,team_id,pic) select p_workspace,p_user,x->>'dataset',coalesce(x->>'source','AT'),nullif(x->>'team_id','')::uuid,coalesce(x->>'pic','') from jsonb_array_elements(p_access) x;
 insert into public.wci_audit(workspace_id,user_id,action,details) values(p_workspace,auth.uid(),'user_access',jsonb_build_object('user',p_user,'before',old_profile,'after',jsonb_build_object('name',p_name,'role',p_role,'active',p_active,'access',p_access)));
end $$;
create function public.wci_save_team(p_workspace uuid,p_id uuid,p_dataset text,p_source text,p_name text,p_leader uuid,p_people text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare team uuid;before_data jsonb;
begin
 if auth.uid() is null or not wci_private.admin(p_workspace) then raise exception 'Admin access required';end if;
 if p_dataset not in('ijr','regional','corporate','piloting') or p_source not in('AT','PM') or (p_source='PM' and p_dataset<>'piloting') or length(trim(p_name))=0 then raise exception 'Invalid team';end if;
 if p_leader is not null and not exists(select 1 from public.wci_profiles where workspace_id=p_workspace and user_id=p_leader and active and role='team_leader') then raise exception 'Leader harus Team Leader aktif';end if;
 if p_id is not null and not exists(select 1 from public.wci_teams where id=p_id and workspace_id=p_workspace) then raise exception 'Team unavailable';end if;
 select to_jsonb(t) into before_data from public.wci_teams t where id=p_id;
 insert into public.wci_teams(id,workspace_id,dataset,source,name,leader_id) values(coalesce(p_id,gen_random_uuid()),p_workspace,p_dataset,p_source,trim(p_name),p_leader) on conflict(id) do update set dataset=excluded.dataset,source=excluded.source,name=excluded.name,leader_id=excluded.leader_id returning id into team;
 delete from public.wci_team_people where team_id=team;
 insert into public.wci_team_people(team_id,pic) select team,trim(x) from (select distinct unnest(p_people) x) a where trim(x)<>'';
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(p_workspace,auth.uid(),'team_mapping',p_dataset,jsonb_build_object('team',team,'before',before_data,'name',p_name,'source',p_source,'leader',p_leader,'people',p_people));
 update public.wci_events set revision=revision+1,updated_at=now() where workspace_id=p_workspace;
 return team;
end $$;
revoke all on function public.wci_save_user(uuid,uuid,text,text,boolean,jsonb),public.wci_save_team(uuid,uuid,text,text,text,uuid,text[]) from public,anon;
grant execute on function public.wci_save_user(uuid,uuid,text,text,boolean,jsonb),public.wci_save_team(uuid,uuid,text,text,text,uuid,text[]) to authenticated;

create function public.wci_upload_review(p_workspace uuid,p_kind text,p_rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare baseline uuid;result jsonb;
begin
 if auth.uid() is null or not wci_private.admin(p_workspace) then raise exception 'Admin access required';end if;
 if jsonb_typeof(p_rows)<>'array' then raise exception 'Invalid rows';end if;
 select case when data_mode='operational' then operational_batch else active_batch end into baseline from public.wci_datasets where workspace_id=p_workspace and kind=p_kind;
 with incoming as(select wci_private.job_identity(p_kind,r) key,r payload from jsonb_array_elements(p_rows) r),
 unique_incoming as(select distinct on(key) key,payload from incoming order by key), old as(select distinct on(job_key) job_key,payload from public.wci_records where batch_id=baseline order by job_key,position)
 select jsonb_build_object('new',count(*) filter(where old.job_key is null),'updated',count(*) filter(where old.job_key is not null and old.payload<>n.payload),'unchanged',count(*) filter(where old.payload=n.payload),'duplicates',(select count(*) from incoming)-(select count(*) from unique_incoming),'conflicts',(select count(*) from(select key from incoming group by key having count(distinct payload)>1)c)+(select count(*) from(select job_key from public.wci_records where batch_id=baseline group by job_key having count(distinct payload)>1)c)) into result from unique_incoming n left join old on old.job_key=n.key;
 return result;
end $$;
revoke all on function public.wci_upload_review(uuid,text,jsonb) from public,anon;
grant execute on function public.wci_upload_review(uuid,text,jsonb) to authenticated;
