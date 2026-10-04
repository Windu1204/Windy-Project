create or replace function wci_private.wci_save_team(p_workspace uuid,p_id uuid,p_dataset text,p_source text,p_name text,p_leader uuid,p_people text[]) returns uuid language plpgsql security definer set search_path='' as $$
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
 delete from public.wci_access where workspace_id=p_workspace and team_id=team and (user_id is distinct from p_leader or dataset<>p_dataset or source<>p_source);
 if p_leader is not null then insert into public.wci_access(workspace_id,user_id,dataset,source,team_id,pic) values(p_workspace,p_leader,p_dataset,p_source,team,'') on conflict(workspace_id,user_id,dataset,source) do update set team_id=excluded.team_id;end if;
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(p_workspace,auth.uid(),'team_mapping',p_dataset,jsonb_build_object('team',team,'before',before_data,'name',p_name,'source',p_source,'leader',p_leader,'people',p_people));
 update public.wci_events set revision=revision+1,updated_at=now() where workspace_id=p_workspace;
 return team;
end $$;

create function wci_private.pic_choices(p_workspace uuid,p_dataset text) returns text[] language plpgsql security definer set search_path='' as $$
declare choices text[];
begin
 if auth.uid() is null or not wci_private.admin(p_workspace) then raise exception 'Admin access required';end if;
 select array_agg(distinct trim(n) order by trim(n)) into choices from public.wci_datasets d join public.wci_records r on r.batch_id=d.active_batch cross join lateral unnest(case when p_dataset='ijr' then array[r.payload->>'Implementor 1',r.payload->>'Implementor 2',r.payload->>'CS BNI Direct'] when p_dataset='piloting' then array[r.payload->>'PIC AT'] else array[r.payload->>'implementor'] end) n where d.workspace_id=p_workspace and d.kind=p_dataset and coalesce(trim(n),'')<>'';
 return coalesce(choices,'{}'::text[]);
end $$;
revoke all on function wci_private.pic_choices(uuid,text) from public,anon;
grant execute on function wci_private.pic_choices(uuid,text) to authenticated;
create function public.wci_pic_choices(p_workspace uuid,p_dataset text) returns text[] language sql security invoker set search_path='' as $$ select wci_private.pic_choices(p_workspace,p_dataset) $$;
revoke all on function public.wci_pic_choices(uuid,text) from public,anon;
grant execute on function public.wci_pic_choices(uuid,text) to authenticated;
