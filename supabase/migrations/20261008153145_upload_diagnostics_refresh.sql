create index wci_upload_issues_scope on public.wci_upload_issues(workspace_id,dataset,id desc);
create index wci_upload_issues_session on public.wci_upload_issues(upload_id,id);
create index wci_upload_sessions_latest on wci_private.upload_sessions(workspace_id,dataset,created_at desc);
create or replace function wci_private.upload_summary(p_workspace uuid,p_kind text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not (wci_private.admin(p_workspace) or wci_private.dashboard_access(p_workspace,p_kind)) then raise exception 'Dashboard access required';end if;
 select jsonb_build_object('file',s.name,'source',s.source_count,'valid',coalesce(sum(jsonb_array_length(c.payload->'rows')),0),'failed',coalesce(sum(jsonb_array_length(c.payload->'issues')),0),'committed',s.committed,'createdAt',s.created_at,
 'reasons',(select coalesce(jsonb_agg(jsonb_build_object('reason',category,'count',n)),'[]'::jsonb) from (select case when reason~*'Baris kosong' then 'Baris kosong' when reason~*'(Konflik|Identitas data lama)' then 'Identitas tidak unik' when reason~*'(invalid|tidak valid)' then 'Field atau tanggal tidak valid' else 'Field wajib belum lengkap' end category,count(*) n from public.wci_upload_issues where upload_id=s.id group by 1) grouped))
 into result from (select * from wci_private.upload_sessions where workspace_id=p_workspace and dataset=p_kind order by created_at desc limit 1) s left join wci_private.upload_chunks c on c.session_id=s.id group by s.id,s.name,s.source_count,s.committed,s.created_at;
 return result;
end $$;
do $$ declare body text;begin
 select pg_get_functiondef('wci_private.review_staged_upload(uuid)'::regprocedure) into body;
 body:=replace(body,'return case when jsonb_array_length(rows)=0','update public.wci_events set revision=revision+1,updated_at=now() where workspace_id=s.workspace_id; return case when jsonb_array_length(rows)=0');
 execute body;
end $$;
