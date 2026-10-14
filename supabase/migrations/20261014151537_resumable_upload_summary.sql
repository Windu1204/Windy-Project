-- Preserve existing Admin/Super Admin guards and commit validation.
do $$ declare body text; needle text; replacement text; begin
 select pg_get_functiondef('wci_private.upload_summary(uuid,text)'::regprocedure) into body;
 needle:='jsonb_build_object(''file'',s.name';
 replacement:='jsonb_build_object(''uploadId'',s.id,
 ''canResume'',(select u.created_by=auth.uid() from wci_private.upload_sessions u where u.id=s.id),
 ''complete'',coalesce(sum(jsonb_array_length(c.payload->''rows'')+jsonb_array_length(c.payload->''issues'')),0)=s.source_count,
 ''baselineCurrent'',(select exists(select 1 from public.wci_datasets d where d.workspace_id=u.workspace_id and d.kind=u.dataset and d.data_mode=u.data_mode and u.baseline is not distinct from case when d.data_mode=''operational'' then d.operational_batch else d.active_batch end) from wci_private.upload_sessions u where u.id=s.id),
 ''file'',s.name';
 if position(needle in body)=0 then raise exception 'Upload summary projection changed';end if;
 body:=replace(body,needle,replacement);execute body;
end $$;
