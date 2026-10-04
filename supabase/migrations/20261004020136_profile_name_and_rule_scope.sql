create function wci_private.set_profile_name(p_workspace uuid,p_name text) returns void language plpgsql security definer set search_path='' as $$
begin
if auth.uid() is null or wci_private.role_of(p_workspace) is null or length(trim(p_name))=0 then raise exception 'Active account and name required';end if;
update public.wci_profiles set name=left(trim(p_name),200) where workspace_id=p_workspace and user_id=auth.uid();
end $$;
revoke all on function wci_private.set_profile_name(uuid,text) from public,anon;
grant execute on function wci_private.set_profile_name(uuid,text) to authenticated;
create function public.wci_set_profile_name(p_workspace uuid,p_name text) returns void language sql security invoker set search_path='' as $$select wci_private.set_profile_name(p_workspace,p_name)$$;
revoke all on function public.wci_set_profile_name(uuid,text) from public,anon;
grant execute on function public.wci_set_profile_name(uuid,text) to authenticated;
drop policy rules_read on public.wci_sla_rules;
create policy rules_read on public.wci_sla_rules for select to authenticated using(wci_private.admin(workspace_id) or wci_private.dashboard_access(workspace_id,dataset));

