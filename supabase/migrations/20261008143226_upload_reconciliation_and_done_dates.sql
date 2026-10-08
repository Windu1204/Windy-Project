-- Preserve original completion instant on repeat clicks and persist Jakarta Done date.
create or replace function wci_private.wci_mark_done(p_workspace uuid,p_id uuid,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.wci_records; mode text; completed timestamptz;
begin
 select * into r from public.wci_records where id=p_id and workspace_id=p_workspace for update;
 if auth.uid() is null or r.id is null or r.dataset<>'regional' or wci_private.role_of(p_workspace)<>'individual' or not wci_private.row_access(p_workspace,'regional',r.payload) then raise exception 'Hanya pengguna Regional dapat menyelesaikan pekerjaannya sendiri';end if;
 select data_mode into mode from public.wci_batches where id=r.batch_id;
 if not exists(select 1 from public.wci_datasets where workspace_id=p_workspace and kind='regional' and data_mode=mode and r.batch_id=case when mode='reference' then active_batch else operational_batch end) then raise exception 'Versi historis hanya dapat dibaca';end if;
 insert into wci_private.wci_done_overrides(workspace_id,data_mode,job_key,user_id,note)
 values(p_workspace,mode,r.job_key,auth.uid(),left(p_note,500))
 on conflict(workspace_id,data_mode,job_key) do update set note=excluded.note,user_id=excluded.user_id
 returning completed_at into completed;
 update public.wci_records set payload=payload||jsonb_build_object('status','Done','doneDate',to_char(completed at time zone 'Asia/Jakarta','YYYY-MM-DD'),'dashboardNote',left(p_note,500),'dashboardUpdatedAt',completed)
 where workspace_id=p_workspace and dataset='regional' and job_key=r.job_key and batch_id=r.batch_id;
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(p_workspace,auth.uid(),'mark_done','regional',jsonb_build_object('job_key',r.job_key,'before',r.payload,'doneDate',to_char(completed at time zone 'Asia/Jakarta','YYYY-MM-DD')));
 update public.wci_events set revision=revision+1,updated_at=now() where workspace_id=p_workspace;
end $$;

-- Chunk transport keeps large uploads below a single HTTP request payload.
create table wci_private.upload_sessions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.wci_workspaces(id),
 dataset text not null check(dataset in('ijr','regional','corporate','piloting')), name text not null,
 created_by uuid not null,created_at timestamptz not null default now(),source_count integer not null check(source_count between 1 and 100000),
 baseline uuid,data_mode text not null,batch_id uuid,committed boolean not null default false
);
create table wci_private.upload_chunks(session_id uuid not null references wci_private.upload_sessions(id),chunk_no integer not null,payload jsonb not null,primary key(session_id,chunk_no));
create table public.wci_upload_issues(
 id bigint generated always as identity primary key, upload_id uuid not null references wci_private.upload_sessions(id),
 workspace_id uuid not null references public.wci_workspaces(id),dataset text not null,file_name text not null,
 source_row integer,sheet text,reason text not null,payload jsonb not null,created_at timestamptz not null default now()
);
alter table public.wci_upload_issues enable row level security;
create policy scoped_issue_read on public.wci_upload_issues for select to authenticated using(wci_private.admin(workspace_id) or wci_private.row_access(workspace_id,dataset,payload));
grant select on public.wci_upload_issues to authenticated;
revoke all on wci_private.upload_sessions,wci_private.upload_chunks from public,anon,authenticated;

create function wci_private.begin_upload(p_workspace uuid,p_kind text,p_name text,p_source integer) returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; mode text; baseline uuid;
begin
 if auth.uid() is null or not wci_private.admin(p_workspace) then raise exception 'Admin access required';end if;
 select data_mode,case when data_mode='operational' then operational_batch else active_batch end into mode,baseline from public.wci_datasets where workspace_id=p_workspace and kind=p_kind;
 if mode is null then raise exception 'Dataset unavailable';end if;
 insert into wci_private.upload_sessions(workspace_id,dataset,name,created_by,source_count,baseline,data_mode) values(p_workspace,p_kind,left(p_name,250),auth.uid(),p_source,baseline,mode) returning id into b;return b;
end $$;
create function wci_private.stage_upload(p_id uuid,p_chunk integer,p_rows jsonb,p_issues jsonb) returns void language plpgsql security definer set search_path='' as $$
declare s wci_private.upload_sessions;
begin
 select * into s from wci_private.upload_sessions where id=p_id for update;
 if auth.uid() is null or s.id is null or s.created_by<>auth.uid() or not wci_private.admin(s.workspace_id) or s.committed then raise exception 'Upload session unavailable';end if;
 if p_chunk<0 or jsonb_typeof(p_rows)<>'array' or jsonb_typeof(p_issues)<>'array' or jsonb_array_length(p_rows)+jsonb_array_length(p_issues)>1000 then raise exception 'Invalid upload chunk';end if;
 if exists(select 1 from wci_private.upload_chunks where session_id=p_id and chunk_no=p_chunk) then
  if (select payload from wci_private.upload_chunks where session_id=p_id and chunk_no=p_chunk)<>jsonb_build_object('rows',p_rows,'issues',p_issues) then raise exception 'Chunk already staged with different content';end if;return;
 end if;
 if (select coalesce(sum(jsonb_array_length(payload->'rows')+jsonb_array_length(payload->'issues')),0) from wci_private.upload_chunks where session_id=p_id)+jsonb_array_length(p_rows)+jsonb_array_length(p_issues)>s.source_count then raise exception 'Source count exceeded';end if;
 insert into wci_private.upload_chunks values(p_id,p_chunk,jsonb_build_object('rows',p_rows,'issues',p_issues));
 insert into public.wci_upload_issues(upload_id,workspace_id,dataset,file_name,source_row,sheet,reason,payload)
 select p_id,s.workspace_id,s.dataset,s.name,(x->>'sourceRow')::integer,left(x->>'sheet',250),left(x->>'reason',2000),coalesce(x->'row','{}'::jsonb) from jsonb_array_elements(p_issues) x;
end $$;
create function wci_private.review_staged_upload(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s wci_private.upload_sessions; rows jsonb; actual bigint;
begin
 select * into s from wci_private.upload_sessions where id=p_id;
 if auth.uid() is null or s.id is null or s.created_by<>auth.uid() or not wci_private.admin(s.workspace_id) then raise exception 'Upload session unavailable';end if;
 select coalesce(sum(jsonb_array_length(payload->'rows')+jsonb_array_length(payload->'issues')),0) into actual from wci_private.upload_chunks where session_id=p_id;
 if actual<>s.source_count then raise exception 'Upload belum lengkap: % dari % baris',actual,s.source_count;end if;
 select coalesce(jsonb_agg((select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) from jsonb_each(r) e where left(e.key,7)<>'_source') order by c.chunk_no),'[]'::jsonb) into rows from wci_private.upload_chunks c cross join lateral jsonb_array_elements(c.payload->'rows') r where c.session_id=p_id;
 return case when jsonb_array_length(rows)=0 then jsonb_build_object('new',0,'updated',0,'unchanged',0,'duplicates',0,'conflicts',0) else wci_private.wci_upload_review(s.workspace_id,s.dataset,rows) end;
end $$;
create function wci_private.commit_staged_upload(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s wci_private.upload_sessions; rows jsonb; b uuid; current_batch uuid; current_mode text;
begin
 select * into s from wci_private.upload_sessions where id=p_id for update;
 if auth.uid() is null or s.id is null or s.created_by<>auth.uid() or not wci_private.admin(s.workspace_id) then raise exception 'Upload session unavailable';end if;
 if s.committed then return s.batch_id;end if;
 perform wci_private.review_staged_upload(p_id);
 select data_mode,case when data_mode='operational' then operational_batch else active_batch end into current_mode,current_batch from public.wci_datasets where workspace_id=s.workspace_id and kind=s.dataset for update;
 if current_batch is distinct from s.baseline or current_mode<>s.data_mode then raise exception 'Data aktif berubah sejak pemeriksaan. Periksa ulang upload sebelum menerapkan.';end if;
 select jsonb_agg((select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) from jsonb_each(r) e where left(e.key,7)<>'_source') order by c.chunk_no) into rows from wci_private.upload_chunks c cross join lateral jsonb_array_elements(c.payload->'rows') r where c.session_id=p_id;
 if rows is null then raise exception 'Tidak ada baris valid untuk diterapkan';end if;
 b:=wci_private.wci_replace_dataset(s.workspace_id,s.dataset,rows,s.name);
 update wci_private.upload_sessions set batch_id=b,committed=true where id=p_id;
 return b;
end $$;
create function public.wci_begin_upload(p_workspace uuid,p_kind text,p_name text,p_source integer) returns uuid language sql security invoker set search_path='' as $$select wci_private.begin_upload(p_workspace,p_kind,p_name,p_source)$$;
create function public.wci_stage_upload(p_id uuid,p_chunk integer,p_rows jsonb,p_issues jsonb) returns void language sql security invoker set search_path='' as $$select wci_private.stage_upload(p_id,p_chunk,p_rows,p_issues)$$;
create function public.wci_review_staged_upload(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select wci_private.review_staged_upload(p_id)$$;
create function public.wci_commit_staged_upload(p_id uuid) returns uuid language sql security invoker set search_path='' as $$select wci_private.commit_staged_upload(p_id)$$;
revoke all on function wci_private.begin_upload(uuid,text,text,integer),wci_private.stage_upload(uuid,integer,jsonb,jsonb),wci_private.review_staged_upload(uuid),wci_private.commit_staged_upload(uuid),public.wci_begin_upload(uuid,text,text,integer),public.wci_stage_upload(uuid,integer,jsonb,jsonb),public.wci_review_staged_upload(uuid),public.wci_commit_staged_upload(uuid) from public,anon;
grant execute on function wci_private.begin_upload(uuid,text,text,integer),wci_private.stage_upload(uuid,integer,jsonb,jsonb),wci_private.review_staged_upload(uuid),wci_private.commit_staged_upload(uuid),public.wci_begin_upload(uuid,text,text,integer),public.wci_stage_upload(uuid,integer,jsonb,jsonb),public.wci_review_staged_upload(uuid),public.wci_commit_staged_upload(uuid) to authenticated;

create function wci_private.upload_summary(p_workspace uuid,p_kind text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not (wci_private.admin(p_workspace) or wci_private.dashboard_access(p_workspace,p_kind)) then raise exception 'Dashboard access required';end if;
 select jsonb_build_object('file',s.name,'source',s.source_count,'valid',coalesce(sum(jsonb_array_length(c.payload->'rows')),0),'failed',coalesce(sum(jsonb_array_length(c.payload->'issues')),0),'committed',s.committed,'createdAt',s.created_at)
 into result from (select * from wci_private.upload_sessions where workspace_id=p_workspace and dataset=p_kind order by created_at desc limit 1) s left join wci_private.upload_chunks c on c.session_id=s.id group by s.id,s.name,s.source_count,s.committed,s.created_at;
 return result;
end $$;
create function public.wci_upload_summary(p_workspace uuid,p_kind text) returns jsonb language sql security invoker set search_path='' as $$select wci_private.upload_summary(p_workspace,p_kind)$$;
revoke all on function wci_private.upload_summary(uuid,text),public.wci_upload_summary(uuid,text) from public,anon;
grant execute on function wci_private.upload_summary(uuid,text),public.wci_upload_summary(uuid,text) to authenticated;

-- Review must compare the same non-empty patch that commit will store.
create or replace function wci_private.wci_upload_review(p_workspace uuid,p_kind text,p_rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare baseline uuid;mode text;result jsonb;
begin
 if auth.uid() is null or not wci_private.admin(p_workspace) then raise exception 'Admin access required';end if;
 if jsonb_typeof(p_rows)<>'array' then raise exception 'Invalid rows';end if;
 select data_mode,case when data_mode='operational' then operational_batch else active_batch end into mode,baseline from public.wci_datasets where workspace_id=p_workspace and kind=p_kind;
 with incoming as(select wci_private.job_identity(p_kind,r) key,r payload from jsonb_array_elements(p_rows) r),
 unique_incoming as(select distinct on(key) key,payload from incoming order by key),
 old as(select distinct on(job_key) job_key,payload from public.wci_records where batch_id=baseline order by job_key,position),
 patched as(select n.key,old.job_key,old.payload old_payload,
 coalesce(old.payload,'{}'::jsonb)||coalesce((select jsonb_object_agg(e.key,e.value) from jsonb_each(n.payload) e where e.value<>'null'::jsonb and e.value<>'""'::jsonb),'{}'::jsonb)||
 case when o.job_key is not null then jsonb_build_object('status','Done','doneDate',to_char(o.completed_at at time zone 'Asia/Jakarta','YYYY-MM-DD'),'dashboardUpdatedAt',o.completed_at,'dashboardNote',o.note) else '{}'::jsonb end payload
 from unique_incoming n left join old on old.job_key=n.key left join wci_private.wci_done_overrides o on p_kind='regional' and o.workspace_id=p_workspace and o.data_mode=mode and o.job_key=n.key)
 select jsonb_build_object('new',count(*) filter(where job_key is null),'updated',count(*) filter(where job_key is not null and old_payload<>payload),'unchanged',count(*) filter(where old_payload=payload),'duplicates',(select count(*) from incoming)-(select count(*) from unique_incoming),'conflicts',(select count(*) from(select key from incoming group by key having count(distinct payload)>1)c)+(select count(*) from(select job_key from public.wci_records where batch_id=baseline group by job_key having count(distinct payload)>1)c)) into result from patched;
 return result;
end $$;

-- Install a non-empty field patch before the existing merge and its completion override.
-- Keep the current auth, ambiguity guards, history and atomic activation intact.
do $$
declare body text; anchor text;
begin
 select pg_get_functiondef('wci_private.wci_replace_dataset(uuid,text,jsonb,text)'::regprocedure) into body;
 anchor := 'update wci_import_stage s set payload=s.payload||jsonb_build_object';
 if position(anchor in body)=0 then raise exception 'Upload merge definition changed; review migration before applying';end if;
 body := replace(body,anchor,
 'update wci_import_stage s set payload=old.payload||coalesce((select jsonb_object_agg(e.key,e.value) from jsonb_each(s.payload) e where e.key not like ''\_source%'' escape ''\'' and e.value<>''null''::jsonb and e.value<>''""''::jsonb),''{}''::jsonb) from (select distinct on(job_key) job_key,payload from public.wci_records where batch_id=baseline order by job_key,position) old where old.job_key=s.job_key;
 update wci_import_stage s set payload=s.payload||jsonb_build_object');
 body := replace(body,'''dashboardUpdatedAt'',o.completed_at','''doneDate'',to_char(o.completed_at at time zone ''Asia/Jakarta'',''YYYY-MM-DD''),''dashboardUpdatedAt'',o.completed_at');
 execute body;
end $$;
