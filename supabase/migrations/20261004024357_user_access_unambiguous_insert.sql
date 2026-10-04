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
 if p_role='individual' and x->>'dataset' not in('regional','piloting') then raise exception 'Individual hanya untuk Regional / Piloting';end if;
 if nullif(x->>'team_id','') is not null and not exists(select 1 from public.wci_teams where id=(x->>'team_id')::uuid and workspace_id=p_workspace and dataset=x->>'dataset' and source=coalesce(x->>'source','AT')) then raise exception 'Tim harus sesuai dashboard / sumber';end if;
 end loop;
 select to_jsonb(p) into old_profile from public.wci_profiles p where workspace_id=p_workspace and user_id=p_user;
 insert into public.wci_profiles(workspace_id,user_id,name,email,role,active) values(p_workspace,p_user,left(p_name,200),email_address,p_role,p_active) on conflict(workspace_id,user_id) do update set name=excluded.name,email=excluded.email,role=excluded.role,active=excluded.active;
 insert into public.wci_members(workspace_id,user_id,role) values(p_workspace,p_user,case when p_role in('super_admin','admin') then 'admin' else 'viewer' end) on conflict(workspace_id,user_id) do update set role=excluded.role;
 delete from public.wci_access where workspace_id=p_workspace and user_id=p_user;
 insert into public.wci_access(workspace_id,user_id,dataset,source,team_id,pic) select p_workspace,p_user,item.value->>'dataset',coalesce(item.value->>'source','AT'),nullif(item.value->>'team_id','')::uuid,coalesce(item.value->>'pic','') from jsonb_array_elements(p_access) as item(value);
 insert into public.wci_audit(workspace_id,user_id,action,details) values(p_workspace,auth.uid(),'user_access',jsonb_build_object('user',p_user,'before',old_profile,'after',jsonb_build_object('name',p_name,'role',p_role,'active',p_active,'access',p_access)));
end $$;

