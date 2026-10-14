begin;

do $qa$
declare w uuid; actor uuid; actor_role text; k text; qa_upload_id uuid; visible integer; allowed boolean; denied boolean; login_role text:=current_user;
begin
 select p.workspace_id,p.user_id into w,actor from public.wci_profiles p where p.active and p.role in('admin','super_admin')
 and not exists(select 1 from wci_private.wci_password_requirements q where q.user_id=p.user_id) limit 1;
 if w is null then raise exception 'Authorized QA account unavailable';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 qa_upload_id:=wci_private.begin_upload(w,'ijr','Access control QA',1);
 perform wci_private.stage_upload(qa_upload_id,0,'[]','[{"row":{"implementor":"QA"},"sourceRow":2,"sheet":"QA","reason":"QA issue"}]');
 foreach k in array array['ijr','regional','corporate','piloting'] loop
  insert into public.wci_access(workspace_id,user_id,dataset,source,pic,team_id)
  select w,actor,k,'AT','QA',null where not exists(select 1 from public.wci_access where workspace_id=w and user_id=actor and dataset=k and source='AT');
 end loop;
 foreach actor_role in array array['super_admin','admin','department_head','team_leader','individual'] loop
  update public.wci_profiles set role=actor_role where workspace_id=w and user_id=actor;
  allowed:=actor_role in('super_admin','admin');
  execute 'set local role authenticated';
  select count(*) into visible from public.wci_upload_issues i where i.upload_id=qa_upload_id;
  if visible<>(case when allowed then 1 else 0 end) then raise exception 'Issue visibility incorrect for %: %',actor_role,visible;end if;
  foreach k in array array['ijr','regional','corporate','piloting'] loop
   denied:=false;
   begin perform public.wci_upload_summary(w,k);
   exception when raise_exception then
    if sqlerrm<>'Admin access required' then raise;end if;
    denied:=true;
   end;
   if denied=allowed then raise exception 'Summary access incorrect for % / %',actor_role,k;end if;
  end loop;
  execute format('set local role %I',login_role);
 end loop;
end $qa$;

rollback;
