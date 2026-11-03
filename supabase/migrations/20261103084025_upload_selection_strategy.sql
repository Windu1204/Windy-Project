-- Selection changes the active pointer; historical batches remain available.
alter table wci_private.upload_sessions add column apply_strategy text not null default 'merge' check(apply_strategy in('merge','selected'));
do $migration$
declare definition text;needle text;
begin
 select replace(pg_get_functiondef('wci_private.wci_replace_dataset(uuid,text,jsonb,text)'::regprocedure),E'\r\n',E'\n') into definition;
 definition:=regexp_replace(definition,'CREATE OR REPLACE FUNCTION [^(]+\([^)]*\)','CREATE OR REPLACE FUNCTION wci_private.replace_selected_dataset(p_workspace uuid,p_kind text,p_rows jsonb,p_name text,p_strategy text)');
 needle:=' if mode is null then raise exception ''Dataset unavailable'';end if;';
 if strpos(definition,needle)=0 then raise exception 'Replace validation changed';end if;
 definition:=replace(definition,needle,needle||E'\n if p_strategy not in(''merge'',''selected'') or p_strategy is null then raise exception ''Invalid upload strategy'';end if;\n if p_strategy=''selected'' then baseline:=null;end if;');
 definition:=replace(definition,'''upload_merge''','''upload_''||p_strategy');
 execute definition;
 revoke all on function wci_private.replace_selected_dataset(uuid,text,jsonb,text,text) from public,anon,authenticated;
 select pg_get_functiondef('wci_private.commit_staged_upload(uuid)'::regprocedure) into definition;
 needle:='wci_private.wci_replace_dataset(s.workspace_id,s.dataset,rows,s.name)';
 if strpos(definition,needle)=0 then raise exception 'Commit validation changed';end if;
 execute replace(definition,needle,'wci_private.replace_selected_dataset(s.workspace_id,s.dataset,rows,s.name,s.apply_strategy)');
 select pg_get_functiondef('wci_private.reconcile_upload(uuid)'::regprocedure) into definition;
 needle:='if s.committed or s.dataset=''corporate'' then return;end if;';
 if strpos(definition,needle)=0 then raise exception 'Reconcile validation changed';end if;
 execute replace(definition,needle,'if s.committed or s.dataset=''corporate'' or s.apply_strategy=''selected'' then return;end if;');
 select pg_get_functiondef('wci_private.review_staged_upload(uuid)'::regprocedure) into definition;
 needle:='else wci_private.wci_upload_review(s.workspace_id,s.dataset,rows) end';
 if strpos(definition,needle)=0 then raise exception 'Review validation changed';end if;
 execute replace(definition,needle,$replace$else case when s.apply_strategy='selected' then jsonb_build_object('new',(select count(distinct wci_private.job_identity(s.dataset,r)) from jsonb_array_elements(rows) r),'updated',0,'unchanged',0,'duplicates',jsonb_array_length(rows)-(select count(distinct wci_private.job_identity(s.dataset,r)) from jsonb_array_elements(rows) r),'conflicts',0) else wci_private.wci_upload_review(s.workspace_id,s.dataset,rows) end end$replace$);
 select pg_get_functiondef('wci_private.upload_summary(uuid,text)'::regprocedure) into definition;
 if strpos(definition,'''file'',s.name')=0 then raise exception 'Summary changed';end if;
 definition:=replace(definition,'''file'',s.name','''strategy'',s.apply_strategy,''file'',s.name');
 execute replace(definition,'group by s.id,s.name,s.source_count,s.committed,s.created_at','group by s.id,s.name,s.source_count,s.committed,s.created_at,s.apply_strategy');
end $migration$;
create function wci_private.set_upload_strategy(p_id uuid,p_strategy text) returns void language plpgsql security definer set search_path='' as $$
declare s wci_private.upload_sessions;
begin
 select * into s from wci_private.upload_sessions where id=p_id for update;
 if auth.uid() is null or s.id is null or s.created_by<>auth.uid() or not wci_private.admin(s.workspace_id) or s.committed then raise exception 'Upload session unavailable';end if;
 if p_strategy not in('merge','selected') or p_strategy is null then raise exception 'Invalid upload strategy';end if;
 if s.apply_strategy<>p_strategy and exists(select 1 from wci_private.upload_chunks where session_id=p_id) then raise exception 'Pilih cara penerapan sebelum pemeriksaan. Pilih ulang file untuk mengubahnya.';end if;
 update wci_private.upload_sessions set apply_strategy=p_strategy where id=p_id;
end $$;
create function wci_private.upload_sources(p_workspace uuid,p_kind text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not wci_private.admin(p_workspace) then raise exception 'Admin access required';end if;
 select coalesce(jsonb_agg(x order by x.created_at desc),'[]') into result from (
 select s.id,s.name,s.created_at,s.source_count,coalesce(sum(jsonb_array_length(c.payload->'rows')),0) as valid_count
 from wci_private.upload_sessions s join public.wci_datasets d on d.workspace_id=s.workspace_id and d.kind=s.dataset and d.data_mode=s.data_mode
 join wci_private.upload_chunks c on c.session_id=s.id where s.workspace_id=p_workspace and s.dataset=p_kind and s.committed
 group by s.id having sum(jsonb_array_length(c.payload->'rows'))>0) x;return result;
end $$;
create function wci_private.upload_source_rows(p_workspace uuid,p_kind text,p_id uuid,p_offset integer default 0) returns table(payload jsonb) language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not wci_private.admin(p_workspace) then raise exception 'Admin access required';end if;
 if not exists(select 1 from wci_private.upload_sessions s join public.wci_datasets d on d.workspace_id=s.workspace_id and d.kind=s.dataset and d.data_mode=s.data_mode where s.id=p_id and s.workspace_id=p_workspace and s.dataset=p_kind and s.committed) then raise exception 'Saved upload unavailable';end if;
 return query select r.value||jsonb_build_object('_sourceSheet',s.name||' / '||coalesce(r.value->>'_sourceSheet','Data')) from wci_private.upload_sessions s join wci_private.upload_chunks c on c.session_id=s.id cross join lateral jsonb_array_elements(c.payload->'rows') with ordinality r(value,n) where s.id=p_id order by c.chunk_no,r.n offset greatest(p_offset,0) limit 200;
end $$;
create function public.wci_set_upload_strategy(p_id uuid,p_strategy text) returns void language sql security invoker set search_path='' as $$select wci_private.set_upload_strategy(p_id,p_strategy)$$;
create function public.wci_upload_sources(p_workspace uuid,p_kind text) returns jsonb language sql security invoker set search_path='' as $$select wci_private.upload_sources(p_workspace,p_kind)$$;
create function public.wci_upload_source_rows(p_workspace uuid,p_kind text,p_id uuid,p_offset integer default 0) returns table(payload jsonb) language sql security invoker set search_path='' as $$select * from wci_private.upload_source_rows(p_workspace,p_kind,p_id,p_offset)$$;
revoke all on function public.wci_set_upload_strategy(uuid,text),public.wci_upload_sources(uuid,text),public.wci_upload_source_rows(uuid,text,uuid,integer),wci_private.set_upload_strategy(uuid,text),wci_private.upload_sources(uuid,text),wci_private.upload_source_rows(uuid,text,uuid,integer) from public,anon;
grant execute on function public.wci_set_upload_strategy(uuid,text),public.wci_upload_sources(uuid,text),public.wci_upload_source_rows(uuid,text,uuid,integer),wci_private.set_upload_strategy(uuid,text),wci_private.upload_sources(uuid,text),wci_private.upload_source_rows(uuid,text,uuid,integer) to authenticated;
