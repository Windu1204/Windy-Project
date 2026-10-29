-- Regional user workflow; all mutations retain existing PIC access and revision events.
alter table wci_private.wci_done_overrides add column company_id text;
alter table wci_private.wci_done_overrides add column handover_at timestamptz;

create function wci_private.regional_progress_fields(company_id text,handover_at timestamptz) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('companyId',company_id,'handover',case when handover_at is not null then 'Handover' end,'dashboardHandoverAt',handover_at))
$$;
revoke all on function wci_private.regional_progress_fields(text,timestamptz) from public,anon,authenticated;

create function wci_private.regional_progress(p_workspace uuid,p_id uuid,p_action text,p_company_id text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.wci_records; mode text; active uuid; category text; company text; completed timestamptz; handed timestamptz; patch jsonb;
begin
 if auth.uid() is null or wci_private.role_of(p_workspace) is distinct from 'individual' then raise exception 'Hanya pengguna Regional dapat memperbarui pekerjaannya sendiri';end if;
 select data_mode,case when data_mode='reference' then active_batch else operational_batch end into mode,active
 from public.wci_datasets where workspace_id=p_workspace and kind='regional' for update;
 select * into r from public.wci_records where id=p_id and workspace_id=p_workspace for update;
 if r.id is null or r.dataset<>'regional' or wci_private.row_access(p_workspace,'regional',r.payload) is not true then raise exception 'Hanya pengguna Regional dapat memperbarui pekerjaannya sendiri';end if;
 if r.batch_id is distinct from active then raise exception 'Versi historis hanya dapat dibaca. Muat ulang data terbaru.';end if;
 category:=trim(coalesce(r.payload->>'type',''));
 if category~*'^(maintenance|maint(\y|enance)|m$)' then category:='M';
 elsif category~*'^(baru|new(?!.*no new)|n$)' then category:='N';else raise exception 'Jenis pekerjaan harus New atau Maintenance';end if;
 if coalesce(r.payload->>'status','')~*'(reject|retur|return|dibatal|cancel)' then raise exception 'Pekerjaan Reject/Retur tidak dapat diubah melalui tindakan ini';end if;
 company:=coalesce(nullif(trim(p_company_id),''),nullif(trim(r.payload->>'companyId'),''));
 if length(company)>100 then raise exception 'Company ID maksimal 100 karakter';end if;
 if p_action='handover' then
  if category<>'N' or coalesce(r.payload->>'status','')!~*'^done$' then raise exception 'Handover hanya untuk pengajuan New yang sudah Done';end if;
  if company is null then raise exception 'Company ID wajib diisi untuk pengajuan New';end if;
  if nullif(r.payload->>'dashboardHandoverAt','') is not null then return;end if;
  handed:=now();
  insert into wci_private.wci_done_overrides(workspace_id,data_mode,job_key,user_id,note,company_id,handover_at,completed_at)
  values(p_workspace,mode,r.job_key,auth.uid(),coalesce(r.payload->>'dashboardNote',''),company,handed,case when coalesce(r.payload->>'doneDate','')~'^\d{4}-\d{2}-\d{2}$' then (r.payload->>'doneDate')::date::timestamp at time zone 'Asia/Jakarta' else now() end)
  on conflict(workspace_id,data_mode,job_key) do update set company_id=excluded.company_id,handover_at=excluded.handover_at;
  patch:=wci_private.regional_progress_fields(company,handed)||jsonb_build_object('dashboardUpdatedAt',handed);
 elsif p_action='done' then
  if category='N' and company is null then raise exception 'Company ID wajib diisi untuk pengajuan New';end if;
  if nullif(r.payload->>'dashboardHandoverAt','') is not null then raise exception 'Pekerjaan sudah Handover';end if;
  insert into wci_private.wci_done_overrides(workspace_id,data_mode,job_key,user_id,note,company_id,completed_at)
  values(p_workspace,mode,r.job_key,auth.uid(),left(coalesce(p_note,''),500),case when category='N' then company end,case when coalesce(r.payload->>'status','')~*'^done$' and coalesce(r.payload->>'doneDate','')~'^\d{4}-\d{2}-\d{2}$' then (r.payload->>'doneDate')::date::timestamp at time zone 'Asia/Jakarta' else now() end)
  on conflict(workspace_id,data_mode,job_key) do update set note=excluded.note,user_id=excluded.user_id,
   company_id=coalesce(excluded.company_id,wci_done_overrides.company_id),
   completed_at=case when coalesce(r.payload->>'status','')~*'^done$' then wci_done_overrides.completed_at else now() end,superseded_at=null
  returning completed_at into completed;
  patch:=jsonb_build_object('status','Done','doneDate',case when coalesce(r.payload->>'status','')~*'^done$' then coalesce(nullif(r.payload->>'doneDate',''),to_char(completed at time zone 'Asia/Jakarta','YYYY-MM-DD')) else to_char(completed at time zone 'Asia/Jakarta','YYYY-MM-DD') end,'dashboardNote',left(coalesce(p_note,''),500),'dashboardUpdatedAt',now());
  if category='N' then patch:=patch||jsonb_build_object('companyId',company);end if;
 else raise exception 'Tindakan tidak tersedia';end if;
 update public.wci_records set payload=payload||patch,updated_at=now() where workspace_id=p_workspace and dataset='regional' and batch_id=r.batch_id and job_key=r.job_key;
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(p_workspace,auth.uid(),'regional_'||p_action,'regional',jsonb_build_object('job_key',r.job_key,'before',r.payload,'changes',patch));
 update public.wci_events set revision=revision+1,updated_at=now() where workspace_id=p_workspace;
end $$;
revoke all on function wci_private.regional_progress(uuid,uuid,text,text,text) from public,anon;
grant execute on function wci_private.regional_progress(uuid,uuid,text,text,text) to authenticated;
create function public.wci_regional_progress(p_workspace uuid,p_id uuid,p_action text,p_company_id text default null,p_note text default '') returns void
language sql security invoker set search_path='' as $$select wci_private.regional_progress(p_workspace,p_id,p_action,p_company_id,p_note)$$;
revoke all on function public.wci_regional_progress(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.wci_regional_progress(uuid,uuid,text,text,text) to authenticated;
-- The legacy RPC must enforce the same validation, not bypass Company ID.
create or replace function wci_private.wci_mark_done(p_workspace uuid,p_id uuid,p_note text) returns void
language sql security definer set search_path='' as $$ select wci_private.regional_progress(p_workspace,p_id,'done',null,p_note) $$;

-- Preserve user-entered Company ID/Handover in both upload review and application.
do $$declare signature text;body text;needle text:='''dashboardNote'',o.note)';begin
 foreach signature in array array['wci_private.wci_replace_dataset(uuid,text,jsonb,text)','wci_private.wci_upload_review(uuid,text,jsonb)'] loop
  select pg_get_functiondef(signature::regprocedure) into body;
  if strpos(body,needle)=0 then raise exception 'Regional upload override location missing: %',signature;end if;
  body:=replace(body,needle,needle||'||wci_private.regional_progress_fields(o.company_id,o.handover_at)');
  execute body;
 end loop;
end $$;
