-- Transactional integration tests. All fixture writes, including audit/event changes, roll back.
begin;
do $$
declare w uuid:=gen_random_uuid(); other_w uuid:=gen_random_uuid(); u uuid[]; subject uuid; hidden uuid; snapshot jsonb; stamp text; blocked boolean;
begin
 select array_agg(id) into u from (select id from auth.users a where not exists(select 1 from wci_private.wci_password_requirements r where r.user_id=a.id) order by id limit 5) x;
 if array_length(u,1)<5 then raise exception 'KPI tests require five existing auth identities';end if;
 insert into public.wci_workspaces(id,name) values(w,'KPI isolated test'),(other_w,'KPI unrelated workspace');
 insert into public.wci_profiles(workspace_id,user_id,name,email,role) values
  (w,u[1],'KPI Admin','admin@example.invalid','admin'),(w,u[2],'KPI DH','dh@example.invalid','department_head'),
  (w,u[3],'KPI TL','tl@example.invalid','team_leader'),(w,u[4],'PIC A','a@example.invalid','individual'),(w,u[5],'PIC B','b@example.invalid','individual');
 insert into public.wci_access(workspace_id,user_id,dataset,source,pic) values(w,u[2],'piloting','AT',''),(w,u[3],'piloting','AT',''),(w,u[4],'piloting','AT','PIC A'),(w,u[5],'piloting','AT','PIC B');
 insert into public.wci_kpi_templates(workspace_id,code,group_code,title,indicators) values(w,'qa','piloting','Test','[{"key":"sla","label":"SLA","unit":"%"}]');
 insert into public.wci_kpi_people(workspace_id,template_code,name,aliases,user_id,leader_id) values(w,'qa','PIC A',array['PIC A'],u[4],u[3]) returning id into subject;
 insert into public.wci_kpi_people(workspace_id,template_code,name,aliases,user_id) values(w,'qa','PIC B',array['PIC B'],u[5]) returning id into hidden;
 perform set_config('request.jwt.claim.sub',u[1]::text,true);
 snapshot:=public.wci_kpi_read(w,'2026-01-01');
 if jsonb_array_length(snapshot->'people')<>2 then raise exception 'Admin cannot read all KPI';end if;
 perform public.wci_kpi_save(w,subject,'2026-01-01',jsonb_build_array(jsonb_build_object('indicator_key','sla','target','≥95%','actual',0,'note','zero preserved','expected',null)));
 select updated_at::text into stamp from public.wci_kpi_values where workspace_id=w and person_id=subject;
 if not exists(select 1 from public.wci_kpi_values where workspace_id=w and person_id=subject and actual=0 and period='2026-01-01') then raise exception 'New month/zero not saved';end if;
 blocked:=false;begin
  perform public.wci_kpi_save(w,subject,'2026-01-01',jsonb_build_array(jsonb_build_object('indicator_key','sla','target','≥95%','actual',99,'expected',null)));
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Stale write not rejected';end if;
 perform public.wci_kpi_save(w,subject,'2026-01-01',jsonb_build_array(jsonb_build_object('indicator_key','sla','target','≥95%','actual',96,'expected',stamp)));
 perform set_config('request.jwt.claim.sub',u[2]::text,true);
 if jsonb_array_length(public.wci_kpi_read(w,'2026-01-01')->'people')<>2 then raise exception 'DH scope wrong';end if;
 perform set_config('request.jwt.claim.sub',u[3]::text,true);
 if jsonb_array_length(public.wci_kpi_read(w,'2026-01-01')->'people')<>2 then raise exception 'Unmapped TL fallback wrong';end if;
 -- Explicit leader mapping must override the unmapped-team fallback.
 update public.wci_kpi_people set leader_id=u[2] where id=hidden;
 if jsonb_array_length(public.wci_kpi_read(w,'2026-01-01')->'people')<>1 then raise exception 'TL saw another leader''s KPI';end if;
 perform set_config('request.jwt.claim.sub',u[4]::text,true);
 snapshot:=public.wci_kpi_read(w,'2026-01-01');
 if jsonb_array_length(snapshot->'people')<>1 or snapshot->'people'->0->>'id'<>subject::text or (snapshot->'values'->0->>'actual')::numeric<>96 then raise exception 'Individual scope/realtime read wrong';end if;
 blocked:=false;begin perform public.wci_kpi_read(w,'2026-01-01',u[5]);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Individual impersonation allowed';end if;
 blocked:=false;begin perform public.wci_kpi_save(w,subject,'2026-02-01','[]');exception when others then blocked:=true;end;
 if not blocked then raise exception 'Individual write allowed';end if;
 blocked:=false;begin perform public.wci_kpi_save_person(w,jsonb_build_object('id',subject,'name','Hijacked','template_code','qa'));exception when others then blocked:=true;end;
 if not blocked then raise exception 'Individual remapping allowed';end if;
 blocked:=false;begin perform public.wci_kpi_read(other_w,'2026-01-01');exception when others then blocked:=true;end;
 if not blocked then raise exception 'Cross-workspace read allowed';end if;
 perform set_config('request.jwt.claim.sub','',true);
 blocked:=false;begin perform public.wci_kpi_read(w,'2026-01-01');exception when others then blocked:=true;end;
 if not blocked then raise exception 'Anonymous KPI read allowed';end if;
 if has_table_privilege('authenticated','public.wci_kpi_values','SELECT') or has_function_privilege('anon','public.wci_kpi_read(uuid,date,uuid)','EXECUTE') then raise exception 'Direct table/anonymous access enabled';end if;
end $$;
rollback;
select 'KPI role scope, new-month save, zero, optimistic concurrency, isolation and write authorization passed' as result;
