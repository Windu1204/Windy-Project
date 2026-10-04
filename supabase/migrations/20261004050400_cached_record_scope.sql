-- The policy reads the current user's permissions once per statement, rather than per record.
create function wci_private.session_record_scope() returns jsonb language sql stable security definer set search_path='' as $$
 with profiles as materialized (
 select p.* from public.wci_profiles p where p.user_id=(select auth.uid()) and p.active and not exists(select 1 from wci_private.wci_password_requirements r where r.user_id=p.user_id)
 ), entries as (
 select p.workspace_id,d.kind as dataset,true as full_access,null::text as name from profiles p join public.wci_datasets d on d.workspace_id=p.workspace_id where p.role='super_admin'
 union all
 select p.workspace_id,a.dataset,true,null::text from profiles p join public.wci_access a on a.workspace_id=p.workspace_id and a.user_id=p.user_id and a.source='AT' where p.role='department_head'
 union all
 select p.workspace_id,a.dataset,false,lower(trim(a.pic)) from profiles p join public.wci_access a on a.workspace_id=p.workspace_id and a.user_id=p.user_id and a.source='AT' where p.role='individual' and trim(a.pic)<>''
 union all
 select p.workspace_id,a.dataset,false,lower(trim(x.pic)) from profiles p join public.wci_access a on a.workspace_id=p.workspace_id and a.user_id=p.user_id and a.source='AT' join public.wci_teams t on t.id=a.team_id and t.workspace_id=p.workspace_id and t.dataset=a.dataset and t.source=a.source and t.leader_id=p.user_id join public.wci_team_people x on x.team_id=t.id where p.role='team_leader' and trim(x.pic)<>''
 ), grouped as (
 select workspace_id,dataset,jsonb_build_object('full',bool_or(full_access),'names',coalesce(jsonb_agg(distinct name) filter(where name is not null),'[]'::jsonb)) as scope from entries group by workspace_id,dataset
 )
 select jsonb_build_object('scopes',coalesce((select jsonb_object_agg(workspace_id::text||':'||dataset,scope) from grouped),'{}'::jsonb),'batches',coalesce((select jsonb_agg(b.id::text) from public.wci_batches b join public.wci_datasets d on d.workspace_id=b.workspace_id and d.kind=b.dataset join grouped g on g.workspace_id=b.workspace_id and g.dataset=b.dataset where b.source='AT' and b.data_mode=d.data_mode),'[]'::jsonb))
$$;
create function wci_private.record_scope_check(w uuid,k text,p jsonb,b uuid,permissions jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(permissions->'batches' ? b::text,false) and (coalesce((permissions->'scopes'->(w::text||':'||k)->>'full')::boolean,false) or coalesce((permissions->'scopes'->(w::text||':'||k)->'names') ?| wci_private.names(k,p),false))
$$;
revoke all on function wci_private.session_record_scope() from public,anon;
revoke all on function wci_private.record_scope_check(uuid,text,jsonb,uuid,jsonb) from public,anon;
grant execute on function wci_private.session_record_scope(),wci_private.record_scope_check(uuid,text,jsonb,uuid,jsonb) to authenticated;
alter policy records_read on public.wci_records using(wci_private.record_scope_check(workspace_id,dataset,payload,batch_id,(select wci_private.session_record_scope())));
