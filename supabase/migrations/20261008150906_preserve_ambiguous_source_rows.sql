-- Reclassify incoming rows whose legacy identity cannot uniquely locate a job.
-- Every legacy row remains intact; unaffected incoming jobs can still be applied.
create function wci_private.reconcile_upload(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare s wci_private.upload_sessions;c record;bad jsonb;good jsonb;
begin
 select * into s from wci_private.upload_sessions where id=p_id for update;
 if auth.uid() is null or s.id is null or s.created_by<>auth.uid() or not wci_private.admin(s.workspace_id) then raise exception 'Upload session unavailable';end if;
 if s.committed then return;end if;
 for c in select * from wci_private.upload_chunks where session_id=p_id loop
  with ambiguous as(select job_key from public.wci_records where batch_id=s.baseline and job_key is not null group by job_key having count(*)>1),
  incoming as(select r,wci_private.job_identity(s.dataset,r) key from jsonb_array_elements(c.payload->'rows') r)
  select coalesce(jsonb_agg(jsonb_build_object('row',r,'sourceRow',r->'_sourceRow','sheet',r->'_sourceSheet','reason','Identitas data lama tidak unik; diperlukan nomor pekerjaan pembeda sebelum status dapat diperbarui.')) filter(where key in(select job_key from ambiguous)),'[]'::jsonb),
  coalesce(jsonb_agg(r) filter(where key not in(select job_key from ambiguous)),'[]'::jsonb) into bad,good from incoming;
  if jsonb_array_length(bad)>0 then
   update wci_private.upload_chunks set payload=jsonb_build_object('rows',good,'issues',(payload->'issues')||bad) where session_id=p_id and chunk_no=c.chunk_no;
   insert into public.wci_upload_issues(upload_id,workspace_id,dataset,file_name,source_row,sheet,reason,payload)
   select p_id,s.workspace_id,s.dataset,s.name,(x->>'sourceRow')::integer,x->>'sheet',x->>'reason',x->'row' from jsonb_array_elements(bad) x;
  end if;
 end loop;
end $$;
revoke all on function wci_private.reconcile_upload(uuid) from public,anon;
grant execute on function wci_private.reconcile_upload(uuid) to authenticated;
do $$ declare body text;begin
 select pg_get_functiondef('wci_private.review_staged_upload(uuid)'::regprocedure) into body;
 body:=replace(body,'select coalesce(sum(jsonb_array_length(payload->''rows'')','perform wci_private.reconcile_upload(p_id); select coalesce(sum(jsonb_array_length(payload->''rows'')');
 execute body;
 select pg_get_functiondef('wci_private.wci_upload_review(uuid,text,jsonb)'::regprocedure) into body;
 body:=replace(body,'where batch_id=baseline group by job_key having count(distinct payload)>1','where batch_id=baseline and job_key in(select key from incoming) group by job_key having count(*)>1');
 execute body;
end $$;

create or replace function wci_private.wci_replace_dataset(p_workspace uuid,p_kind text,p_rows jsonb,p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid;baseline uuid;mode text;new_count integer;updated_count integer;unchanged_count integer;duplicate_count integer;total_count integer;
begin
 if auth.uid() is null or not wci_private.admin(p_workspace) then raise exception 'Admin access required';end if;
 if p_kind not in('ijr','regional','corporate','piloting') or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 100000 then raise exception 'Invalid dataset / rows';end if;
 select data_mode,case when data_mode='operational' then operational_batch else active_batch end into mode,baseline from public.wci_datasets where workspace_id=p_workspace and kind=p_kind for update;
 if mode is null then raise exception 'Dataset unavailable';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r)<>'object' or
 (p_kind='ijr' and coalesce(trim(r->>'Application Number'),'')='') or
 (p_kind='corporate' and (coalesce(trim(r->>'noreg'),'')='' or coalesce(trim(r->>'product'),'')='' or coalesce(trim(r->>'company'),'')='')) or
 (p_kind='regional' and (coalesce(trim(r->>'company'),'')='' or coalesce(trim(r->>'product'),'')='' or coalesce(trim(r->>'salesDate'),'')='')) or
 (p_kind='piloting' and (coalesce(trim(r->>'No. Register'),'')='' or coalesce(trim(r->>'PIC AT'),'')='' or coalesce(trim(r->>'Nama Perusahaan'),'')='' or coalesce(trim(r->>'Jenis Produk / Solusi'),'')='' or coalesce(trim(r->>'Tanggal Assign to AT'),'')='' or coalesce(r->>'Kategori','') not in('Done','Reject/Retur','Masih Pending')))) then raise exception 'Identitas / field sumber tidak lengkap';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r group by wci_private.job_identity(p_kind,r) having count(distinct r)>1) then raise exception 'Konflik identitas dalam file';end if;
 if exists(select 1 from public.wci_records where batch_id=baseline and job_key in(select wci_private.job_identity(p_kind,r) from jsonb_array_elements(p_rows) r) group by job_key having count(*)>1) then raise exception 'Identitas lama tidak unik. Periksa kembali hasil upload.';end if;
 create temporary table if not exists wci_merge_stage_v2(stage_key text primary key,job_key text,payload jsonb) on commit drop;
 truncate pg_temp.wci_merge_stage_v2;
 insert into wci_merge_stage_v2 select distinct 'incoming:'||wci_private.job_identity(p_kind,r),wci_private.job_identity(p_kind,r),r from jsonb_array_elements(p_rows) r;
 duplicate_count:=jsonb_array_length(p_rows)-(select count(*) from wci_merge_stage_v2);
 update wci_merge_stage_v2 s set payload=old.payload||coalesce((select jsonb_object_agg(e.key,e.value) from jsonb_each(s.payload) e where left(e.key,7)<>'_source' and e.value<>'null'::jsonb and e.value<>'""'::jsonb),'{}'::jsonb) from public.wci_records old where old.batch_id=baseline and old.job_key=s.job_key;
 update wci_merge_stage_v2 s set payload=s.payload||jsonb_build_object('status','Done','doneDate',to_char(o.completed_at at time zone 'Asia/Jakarta','YYYY-MM-DD'),'dashboardUpdatedAt',o.completed_at,'dashboardNote',o.note) from wci_private.wci_done_overrides o where p_kind='regional' and o.workspace_id=p_workspace and o.data_mode=mode and o.job_key=s.job_key;
 select count(*) filter(where old.id is null),count(*) filter(where old.id is not null and old.payload<>s.payload),count(*) filter(where old.payload=s.payload) into new_count,updated_count,unchanged_count from wci_merge_stage_v2 s left join public.wci_records old on old.batch_id=baseline and old.job_key=s.job_key;
 insert into wci_merge_stage_v2 select 'baseline:'||r.id,r.job_key,r.payload from public.wci_records r where r.batch_id=baseline and not exists(select 1 from wci_merge_stage_v2 s where s.job_key is not distinct from r.job_key);
 select count(*) into total_count from wci_merge_stage_v2;
 insert into public.wci_batches(workspace_id,dataset,name,row_count,created_by,data_mode) values(p_workspace,p_kind,left(p_name,250),total_count,auth.uid(),mode) returning id into b;
 insert into public.wci_records(workspace_id,dataset,batch_id,position,payload,job_key) select p_workspace,p_kind,b,row_number() over(order by stage_key)::integer,payload,job_key from wci_merge_stage_v2;
 update public.wci_datasets set active_batch=case when mode='reference' then b else active_batch end,operational_batch=case when mode='operational' then b else operational_batch end where workspace_id=p_workspace and kind=p_kind;
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(p_workspace,auth.uid(),'upload_merge',p_kind,jsonb_build_object('batch',b,'file',left(p_name,250),'mode',mode,'new',new_count,'updated',updated_count,'unchanged',unchanged_count,'duplicates',duplicate_count,'total',total_count));
 return b;
end $$;
