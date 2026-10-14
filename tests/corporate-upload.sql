begin;

do $qa$
declare w uuid; actor uuid; fixture uuid; session_id uuid; batch uuid; result jsonb; input jsonb; count_jobs integer; other_before jsonb;
begin
 select p.workspace_id,p.user_id into w,actor from public.wci_profiles p
 where p.active and p.role in('admin','super_admin') and not exists(select 1 from wci_private.wci_password_requirements q where q.user_id=p.user_id)
 and exists(select 1 from public.wci_datasets d where d.workspace_id=p.workspace_id and d.kind='corporate') limit 1;
 if w is null then raise exception 'No authorized test workspace';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 select jsonb_agg(jsonb_build_array(kind,active_batch,operational_batch,data_mode) order by kind) into other_before from public.wci_datasets where workspace_id=w and kind<>'corporate';
 insert into public.wci_batches(workspace_id,dataset,name,row_count,created_by,data_mode) values(w,'corporate','Transactional Corporate QA',3,actor,'reference') returning id into fixture;
 insert into public.wci_records(workspace_id,dataset,batch_id,position,payload,job_key) values
 (w,'corporate',fixture,1,'{"noreg":"QA-A","company":"QA","product":"BNIdirect","status":"On Progress","assignDate":"2026-08-14"}','corporate:qa-a'),
 (w,'corporate',fixture,2,'{"noreg":"QA-A","company":"QA","product":"BNIdirect","status":"On Progress","assignDate":"2026-08-14","remarks":"legacy variant"}','corporate:qa-a'),
 (w,'corporate',fixture,3,'{"noreg":"QA-OTHER","company":"Other","product":"BNIdirect","status":"On Progress"}','corporate:qa-other');
 update public.wci_datasets set active_batch=fixture,data_mode='reference' where workspace_id=w and kind='corporate';
 input:='[{"noreg":"QA-A","company":"QA","product":"BNIdirect","status":"Done","assignDate":"2026-08-14","doneDate":"2026-08-18","_corporateIdentity":"qa-a","_corporateLatest":"2026-08-18","_sourceRow":2,"_sourceSheet":"QA"},{"noreg":"QA-A","company":"QA","product":"BNIdirect","status":"Done","assignDate":"2026-08-14","doneDate":"2026-08-18","_corporateIdentity":"qa-a","_corporateLatest":"2026-08-18","_sourceRow":3,"_sourceSheet":"QA"},{"noreg":null,"company":"Unregistered","product":null,"status":null,"_corporateIdentity":"unregistered:qa","_sourceRow":4,"_sourceSheet":"QA"}]';
 session_id:=wci_private.begin_upload(w,'corporate','Transactional QA',3);
 perform wci_private.stage_upload(session_id,0,input,'[]');
 result:=wci_private.review_staged_upload(session_id);
 if result <> '{"new":1,"updated":1,"unchanged":0,"duplicates":1,"conflicts":0}'::jsonb then raise exception 'Review mismatch: %',result;end if;
 batch:=wci_private.commit_staged_upload(session_id);
 select count(*) into count_jobs from public.wci_records where batch_id=batch;
 if count_jobs<>3 then raise exception 'Wrong merged population: %',count_jobs;end if;
 if not exists(select 1 from public.wci_records where batch_id=batch and job_key='corporate:qa-a' and payload->>'status'='Done' and payload->>'doneDate'='2026-08-18') then raise exception 'Done update lost';end if;
 if not exists(select 1 from public.wci_records where batch_id=batch and job_key='corporate:unregistered:qa' and payload->>'noreg' is null) then raise exception 'Unregistered source lost';end if;
 session_id:=wci_private.begin_upload(w,'corporate','Transactional repeat QA',3);
 perform wci_private.stage_upload(session_id,0,input,'[]');
 result:=wci_private.review_staged_upload(session_id);
 if result <> '{"new":0,"updated":0,"unchanged":2,"duplicates":1,"conflicts":0}'::jsonb then raise exception 'Repeated upload mismatch: %',result;end if;
 perform wci_private.commit_staged_upload(session_id);
 session_id:=wci_private.begin_upload(w,'corporate','Transactional stale QA',1);
 perform wci_private.stage_upload(session_id,0,'[{"noreg":"QA-A","company":"QA","product":"BNIdirect","status":"On Progress","_corporateIdentity":"qa-a","_corporateLatest":"2026-08-14","_sourceRow":2,"_sourceSheet":"QA"}]','[]');
 result:=wci_private.review_staged_upload(session_id);
 if (result->>'unchanged')::integer<>1 or (result->>'updated')::integer<>0 then raise exception 'Stale upload mismatch: %',result;end if;
 if other_before is distinct from (select jsonb_agg(jsonb_build_array(kind,active_batch,operational_batch,data_mode) order by kind) from public.wci_datasets where workspace_id=w and kind<>'corporate') then raise exception 'Other dashboard changed';end if;
end $qa$;

rollback;
