-- Formal KPI is separate from operational records and SLA calculations.
create table public.wci_kpi_templates (
 workspace_id uuid not null references public.wci_workspaces(id), code text not null,
 group_code text not null check(group_code in('regional_fscm','regional_non_bni','ijr','corporate','piloting')),
 title text not null, indicators jsonb not null check(jsonb_typeof(indicators)='array'),
 primary key(workspace_id,code)
);
create table public.wci_kpi_people (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.wci_workspaces(id),
 source_key text,template_code text not null,name text not null check(length(trim(name))>0),
 npp text not null default '',grade text not null default '',position text not null default '',managed text not null default '',
 aliases text[] not null default '{}',user_id uuid,leader_id uuid,
 unique(workspace_id,id),unique(workspace_id,source_key),
 foreign key(workspace_id,template_code) references public.wci_kpi_templates(workspace_id,code),
 foreign key(workspace_id,user_id) references public.wci_profiles(workspace_id,user_id),
 foreign key(workspace_id,leader_id) references public.wci_profiles(workspace_id,user_id)
);
create index wci_kpi_people_user_idx on public.wci_kpi_people(workspace_id,user_id);
create index wci_kpi_people_leader_idx on public.wci_kpi_people(workspace_id,leader_id);
create table public.wci_kpi_values (
 workspace_id uuid not null,person_id uuid not null,period date not null check(extract(day from period)=1),
 indicator_key text not null,target text not null default '',actual numeric,
 note text not null default '',updated_at timestamptz not null default clock_timestamp(),updated_by uuid references auth.users(id),
 primary key(workspace_id,person_id,period,indicator_key),
 foreign key(workspace_id,person_id) references public.wci_kpi_people(workspace_id,id)
);
-- Only scoped RPCs expose KPI data. There is no direct client table access.
alter table public.wci_kpi_templates enable row level security;
alter table public.wci_kpi_people enable row level security;
alter table public.wci_kpi_values enable row level security;
revoke all on public.wci_kpi_templates,public.wci_kpi_people,public.wci_kpi_values from public,anon,authenticated;
create policy kpi_templates_rpc_only on public.wci_kpi_templates for all to authenticated using(false) with check(false);
create policy kpi_people_rpc_only on public.wci_kpi_people for all to authenticated using(false) with check(false);
create policy kpi_values_rpc_only on public.wci_kpi_values for all to authenticated using(false) with check(false);

create function wci_private.kpi_allowed(w uuid,subject uuid,viewer uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.wci_kpi_people s join public.wci_kpi_templates t on t.workspace_id=s.workspace_id and t.code=s.template_code
  join public.wci_profiles p on p.workspace_id=s.workspace_id and p.user_id=viewer and p.active
  where s.workspace_id=w and s.id=subject and (
   p.role in('super_admin','admin') or
   (s.user_id=viewer) or
   exists(select 1 from public.wci_access a where a.workspace_id=w and a.user_id=viewer and a.source='AT'
    and a.dataset=case when t.group_code in('regional_fscm','regional_non_bni') then 'regional' else t.group_code end and (
     p.role='department_head' or
     (p.role='individual' and s.user_id is null and trim(a.pic)<>'' and exists(select 1 from unnest(s.aliases||array[s.name]) n where lower(trim(n))=lower(trim(a.pic)))) or
     (p.role='team_leader' and (
      s.leader_id=viewer or
      (s.leader_id is null and (a.team_id is null or exists(
       select 1 from public.wci_teams team where team.id=a.team_id and team.workspace_id=w and team.leader_id=viewer
       and (not exists(select 1 from public.wci_team_people x where x.team_id=team.id) or exists(
        select 1 from public.wci_team_people x,unnest(s.aliases||array[s.name]) n where x.team_id=team.id and lower(trim(x.pic))=lower(trim(n))
       ))
      )))
     ))
    )
   )
  )
 )
$$;
revoke all on function wci_private.kpi_allowed(uuid,uuid,uuid) from public,anon,authenticated;

create function public.wci_kpi_read(p_workspace uuid,p_period date,p_as uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=coalesce(p_as,auth.uid()); result jsonb;
begin
 if auth.uid() is null or wci_private.role_of(p_workspace) is null then raise exception 'Akses KPI tidak diizinkan';end if;
 if p_as is not null and p_as<>auth.uid() and wci_private.role_of(p_workspace)<>'super_admin' then raise exception 'Pratinjau KPI hanya untuk Super Admin';end if;
 if extract(day from p_period)<>1 or p_period is null then raise exception 'Periode KPI tidak valid';end if;
 with people as materialized(select s.* from public.wci_kpi_people s where s.workspace_id=p_workspace and wci_private.kpi_allowed(p_workspace,s.id,viewer)),
 templates as (select t.* from public.wci_kpi_templates t where t.workspace_id=p_workspace and
  (exists(select 1 from people s where s.template_code=t.code) or exists(select 1 from public.wci_profiles p where p.workspace_id=p_workspace and p.user_id=viewer and p.active and p.role in('admin','super_admin'))))
 select jsonb_build_object(
  'people',coalesce((select jsonb_agg(to_jsonb(s)-'source_key'-'workspace_id' order by s.name) from people s),'[]'::jsonb),
  'templates',coalesce((select jsonb_agg(to_jsonb(t)-'workspace_id' order by t.title) from templates t),'[]'::jsonb),
  'values',coalesce((select jsonb_agg(to_jsonb(v)-'workspace_id'-'updated_by') from public.wci_kpi_values v where v.workspace_id=p_workspace and v.period=p_period and v.person_id in(select id from people)),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create function public.wci_kpi_save(p_workspace uuid,p_person uuid,p_period date,p_changes jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare c jsonb; definition jsonb; previous public.wci_kpi_values; clean_target text; raw_actual text;
begin
 if auth.uid() is null or not wci_private.admin(p_workspace) then raise exception 'Hanya Admin yang dapat mengisi KPI';end if;
 if p_period is null or extract(day from p_period)<>1 or extract(year from p_period) not between 2000 and 2100 then raise exception 'Periode KPI tidak valid';end if;
 if jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>100 then raise exception 'Isian KPI tidak valid';end if;
 -- Lock the subject to serialize simultaneous edits, including new months.
 perform 1 from public.wci_kpi_people where workspace_id=p_workspace and id=p_person for update;
 if not found then raise exception 'Pegawai KPI tidak ditemukan';end if;
 for c in select value from jsonb_array_elements(p_changes) loop
  select i into definition from public.wci_kpi_people s join public.wci_kpi_templates t on t.workspace_id=s.workspace_id and t.code=s.template_code,
   jsonb_array_elements(t.indicators) i where s.workspace_id=p_workspace and s.id=p_person and i->>'key'=c->>'indicator_key';
  if definition is null then raise exception 'Indikator tidak sesuai pegawai';end if;
  clean_target:=trim(coalesce(c->>'target',''));raw_actual:=c->>'actual';
  if clean_target<>'' and regexp_replace(clean_target,'\s','','g') !~ '^(>=|<=|≥|≤|>|<|=)?-?[0-9]+([.,][0-9]+)?%?$' then raise exception 'Target harus berupa angka, persentase, atau batas seperti ≥95%%';end if;
  if raw_actual is not null and raw_actual !~ '^-?[0-9]+([.][0-9]+)?$' then raise exception 'Realisasi harus berupa angka';end if;
  if length(coalesce(c->>'note',''))>2000 or length(clean_target)>100 then raise exception 'Isian KPI terlalu panjang';end if;
  select * into previous from public.wci_kpi_values where workspace_id=p_workspace and person_id=p_person and period=p_period and indicator_key=c->>'indicator_key';
  if (previous.updated_at is null)<>(c->>'expected' is null) or (previous.updated_at is not null and previous.updated_at is distinct from (c->>'expected')::timestamptz) then raise exception 'KPI telah diperbarui Admin lain. Muat ulang data sebelum menyimpan.';end if;
  insert into public.wci_kpi_values(workspace_id,person_id,period,indicator_key,target,actual,note,updated_by)
   values(p_workspace,p_person,p_period,c->>'indicator_key',clean_target,raw_actual::numeric,coalesce(c->>'note',''),auth.uid())
  on conflict(workspace_id,person_id,period,indicator_key) do update set target=excluded.target,actual=excluded.actual,note=excluded.note,updated_by=excluded.updated_by,updated_at=clock_timestamp();
  insert into public.wci_audit(workspace_id,user_id,action,details) values(p_workspace,auth.uid(),'save_kpi',jsonb_build_object('person',p_person,'period',p_period,'indicator',c->>'indicator_key','before',to_jsonb(previous),'after',c-'expected'));
 end loop;
 update public.wci_events set revision=revision+1,updated_at=now() where workspace_id=p_workspace;
end $$;

create function public.wci_kpi_save_person(p_workspace uuid,p_person jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare id uuid:=nullif(p_person->>'id','')::uuid; assigned uuid:=nullif(p_person->>'user_id','')::uuid; leader uuid:=nullif(p_person->>'leader_id','')::uuid; oldrow jsonb;
begin
 if auth.uid() is null or not wci_private.admin(p_workspace) then raise exception 'Hanya Admin yang dapat memetakan KPI';end if;
 if length(trim(coalesce(p_person->>'name','')))=0 then raise exception 'Nama pegawai wajib diisi';end if;
 if not exists(select 1 from public.wci_kpi_templates where workspace_id=p_workspace and code=p_person->>'template_code') then raise exception 'Template KPI tidak valid';end if;
 if assigned is not null and not exists(select 1 from public.wci_profiles where workspace_id=p_workspace and user_id=assigned and active) then raise exception 'Akun pegawai tidak valid';end if;
 if leader is not null and not exists(select 1 from public.wci_profiles where workspace_id=p_workspace and user_id=leader and active and role='team_leader') then raise exception 'Akun TL tidak valid';end if;
 select to_jsonb(s) into oldrow from public.wci_kpi_people s where s.workspace_id=p_workspace and s.id=id;
 if id is not null and oldrow is null then raise exception 'Pegawai KPI tidak ditemukan';end if;
 if oldrow is not null and oldrow->>'template_code'<>p_person->>'template_code' and exists(select 1 from public.wci_kpi_values where workspace_id=p_workspace and person_id=id) then raise exception 'Template pegawai dengan riwayat KPI tidak dapat diganti';end if;
 insert into public.wci_kpi_people(id,workspace_id,template_code,name,npp,grade,position,managed,aliases,user_id,leader_id)
 values(coalesce(id,gen_random_uuid()),p_workspace,p_person->>'template_code',trim(p_person->>'name'),coalesce(p_person->>'npp',''),coalesce(p_person->>'grade',''),coalesce(p_person->>'position',''),coalesce(p_person->>'managed',''),array(select trim(value) from jsonb_array_elements_text(coalesce(p_person->'aliases','[]')) where trim(value)<>''),assigned,leader)
 on conflict(id) do update set name=excluded.name,npp=excluded.npp,grade=excluded.grade,position=excluded.position,managed=excluded.managed,aliases=excluded.aliases,user_id=excluded.user_id,leader_id=excluded.leader_id;
 insert into public.wci_audit(workspace_id,user_id,action,details) values(p_workspace,auth.uid(),'map_kpi_person',jsonb_build_object('before',oldrow,'after',p_person));
 update public.wci_events set revision=revision+1,updated_at=now() where workspace_id=p_workspace;
end $$;

revoke all on function public.wci_kpi_read(uuid,date,uuid),public.wci_kpi_save(uuid,uuid,date,jsonb),public.wci_kpi_save_person(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.wci_kpi_read(uuid,date,uuid),public.wci_kpi_save(uuid,uuid,date,jsonb),public.wci_kpi_save_person(uuid,jsonb) to authenticated;
