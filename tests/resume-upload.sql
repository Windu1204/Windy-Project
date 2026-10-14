begin;
do $qa$
declare w uuid; actor uuid; qa_upload_id uuid; s jsonb;
begin
 select p.workspace_id,p.user_id into w,actor from public.wci_profiles p where p.active and p.role in('admin','super_admin') and not exists(select 1 from wci_private.wci_password_requirements q where q.user_id=p.user_id) limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 qa_upload_id:=wci_private.begin_upload(w,'corporate','Resume QA',1);
 perform wci_private.stage_upload(qa_upload_id,0,'[{"noreg":"QA-RESUME","product":"BNIdirect","status":"On Progress"}]','[]');
 s:=public.wci_upload_summary(w,'corporate');
 if s->>'uploadId'<>qa_upload_id::text or not (s->>'canResume')::boolean or not (s->>'complete')::boolean or not (s->>'baselineCurrent')::boolean then raise exception 'Invalid resumable metadata: %',s;end if;
 update wci_private.upload_sessions set source_count=2 where id=qa_upload_id;
 s:=public.wci_upload_summary(w,'corporate');
 if (s->>'complete')::boolean then raise exception 'Incomplete upload accepted';end if;
 update wci_private.upload_sessions set source_count=1,baseline=gen_random_uuid() where id=qa_upload_id;
 s:=public.wci_upload_summary(w,'corporate');
 if (s->>'baselineCurrent')::boolean then raise exception 'Stale baseline accepted';end if;
end $qa$;
rollback;
