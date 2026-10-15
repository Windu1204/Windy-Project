-- An active TL with a dashboard grant may read all source members until the team is mapped.
-- Explicit PIC/team mappings still restrict records. Invalid/foreign team links fail closed.
-- row_access is intentionally unchanged: the fallback does not grant editing rights.
create or replace function wci_private.session_record_scope() returns jsonb language sql stable security definer set search_path='' as $$
 with profiles as materialized (
 select p.* from public.wci_profiles p where p.user_id=(select auth.uid()) and p.active and not exists(select 1 from wci_private.wci_password_requirements r where r.user_id=p.user_id)
 ), entries as (
 select p.workspace_id,d.kind as dataset,true as full_access,null::text as name from profiles p join public.wci_datasets d on d.workspace_id=p.workspace_id where p.role='super_admin'
 union all
 select p.workspace_id,a.dataset,true,null::text from profiles p join public.wci_access a on a.workspace_id=p.workspace_id and a.user_id=p.user_id and a.source='AT' where p.role='department_head'
 union all
 select p.workspace_id,a.dataset,false,lower(trim(a.pic)) from profiles p join public.wci_access a on a.workspace_id=p.workspace_id and a.user_id=p.user_id and a.source='AT' where p.role='individual' and trim(a.pic)<>''
 union all
 select p.workspace_id,a.dataset,true,null::text from profiles p join public.wci_access a on a.workspace_id=p.workspace_id and a.user_id=p.user_id and a.source='AT' where p.role='team_leader' and a.team_id is null
 union all
 select p.workspace_id,a.dataset,m.names is null,n.name
 from profiles p join public.wci_access a on a.workspace_id=p.workspace_id and a.user_id=p.user_id and a.source='AT'
 join public.wci_teams t on t.id=a.team_id and t.workspace_id=p.workspace_id and t.dataset=a.dataset and t.source=a.source and t.leader_id=p.user_id
 left join lateral (select array_agg(distinct lower(trim(x.pic))) as names from public.wci_team_people x where x.team_id=t.id and trim(x.pic)<>'') m on true
 cross join lateral unnest(coalesce(m.names,array[null::text])) n(name)
 where p.role='team_leader'
 ), grouped as (
 select workspace_id,dataset,jsonb_build_object('full',bool_or(full_access),'names',coalesce(jsonb_agg(distinct name) filter(where name is not null),'[]'::jsonb)) as scope from entries group by workspace_id,dataset
 )
 select jsonb_build_object('scopes',coalesce((select jsonb_object_agg(workspace_id::text||':'||dataset,scope) from grouped),'{}'::jsonb),'batches',coalesce((select jsonb_agg(b.id::text) from public.wci_batches b join public.wci_datasets d on d.workspace_id=b.workspace_id and d.kind=b.dataset join grouped g on g.workspace_id=b.workspace_id and g.dataset=b.dataset where b.source='AT' and b.data_mode=d.data_mode),'[]'::jsonb))
$$;

create or replace function wci_private.wci_save_user(p_workspace uuid,p_user uuid,p_name text,p_role text,p_active boolean,p_access jsonb) returns void language plpgsql security definer set search_path='' as $$
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
 if nullif(x->>'team_id','') is not null and not exists(select 1 from public.wci_teams where id=(x->>'team_id')::uuid and workspace_id=p_workspace and dataset=x->>'dataset' and source=coalesce(x->>'source','AT')) then raise exception 'Tim harus sesuai dashboard / sumber';end if;
 end loop;
 if p_active and p_role in('department_head','team_leader','individual') and jsonb_array_length(p_access)=0 then raise exception 'Pilih dashboard untuk akun aktif';end if;
 if p_active then for x in select value from jsonb_array_elements(p_access) loop
 if p_role='individual' and coalesce(trim(x->>'pic'),'')='' then raise exception 'Pilih PIC untuk dashboard pengguna';end if;
 if p_role='individual' and coalesce(x->>'source','AT')='AT' and not exists(select 1 from unnest(wci_private.pic_choices(p_workspace,x->>'dataset')) n where lower(trim(n))=lower(trim(x->>'pic'))) then raise exception 'PIC tidak ditemukan pada sumber dashboard';end if;
 end loop;end if;
 if p_role='team_leader' then
 for x in select value from jsonb_array_elements(p_access) loop
 if nullif(x->>'team_id','') is not null then
 if exists(select 1 from public.wci_teams where id=(x->>'team_id')::uuid and leader_id is not null and leader_id<>p_user) then raise exception 'Tim sudah memiliki Team Leader lain';end if;
 update public.wci_teams set leader_id=p_user where id=(x->>'team_id')::uuid and workspace_id=p_workspace;
 end if;end loop;end if;
 select to_jsonb(p) into old_profile from public.wci_profiles p where workspace_id=p_workspace and user_id=p_user;
 insert into public.wci_profiles(workspace_id,user_id,name,email,role,active) values(p_workspace,p_user,left(p_name,200),email_address,p_role,p_active) on conflict(workspace_id,user_id) do update set name=excluded.name,email=excluded.email,role=excluded.role,active=excluded.active;
 insert into public.wci_members(workspace_id,user_id,role) values(p_workspace,p_user,case when p_role in('super_admin','admin') then 'admin' else 'viewer' end) on conflict(workspace_id,user_id) do update set role=excluded.role;
 delete from public.wci_access where workspace_id=p_workspace and user_id=p_user;
 insert into public.wci_access(workspace_id,user_id,dataset,source,team_id,pic) select p_workspace,p_user,item.value->>'dataset',coalesce(item.value->>'source','AT'),nullif(item.value->>'team_id','')::uuid,coalesce(item.value->>'pic','') from jsonb_array_elements(p_access) as item(value);
 insert into public.wci_audit(workspace_id,user_id,action,details) values(p_workspace,auth.uid(),'user_access',jsonb_build_object('user',p_user,'before',old_profile,'after',jsonb_build_object('name',p_name,'role',p_role,'active',p_active,'access',p_access)));
end $$;


-- Notify existing sessions, including those that previously cached an empty scope.
update public.wci_events set revision=revision+1,updated_at=now();
