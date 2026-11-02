-- Activities use existing workspace/PIC/team boundaries. No SLA or source status is modified.
create table public.wci_activities (
 id uuid primary key,workspace_id uuid not null references public.wci_workspaces(id) on delete cascade,
 dataset text not null check(dataset in('ijr','regional')),kind text not null check(kind in('calendar','training','call','handover')),
 owner_id uuid not null references auth.users(id),pic text not null,job_key text,data_mode text,
 payload jsonb not null,attachments jsonb not null default '[]',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(kind<>'training' or dataset='ijr'),check(jsonb_typeof(payload)='object'),check(jsonb_typeof(attachments)='array')
);
create index wci_activities_scope on public.wci_activities(workspace_id,dataset,owner_id,updated_at);
create unique index wci_activities_handover_job on public.wci_activities(workspace_id,dataset,data_mode,job_key) where kind='handover';
alter table public.wci_activities enable row level security;
revoke all on public.wci_activities from anon,authenticated;

create function wci_private.activity_access(w uuid,k text,owner uuid,person_name text,actor uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare role text;grant_row public.wci_access;begin
 select p.role into role from public.wci_profiles p where p.workspace_id=w and p.user_id=actor and p.active
 and not exists(select 1 from wci_private.wci_password_requirements q where q.user_id=actor);
 if role in('admin','super_admin') then return true;end if;
 for grant_row in select * from public.wci_access a where a.workspace_id=w and a.user_id=actor and a.dataset=k and a.source='AT' loop
  if role='department_head' then return true;end if;
  if role='individual' and owner=actor and trim(grant_row.pic)<>'' and lower(trim(grant_row.pic))=lower(trim(person_name)) then return true;end if;
  if role='team_leader' then
   if grant_row.team_id is null then return true;end if;
   if exists(select 1 from public.wci_teams t where t.id=grant_row.team_id and t.workspace_id=w and t.dataset=k and t.source='AT' and t.leader_id=actor) and (
    not exists(select 1 from public.wci_team_people x where x.team_id=grant_row.team_id and trim(x.pic)<>'') or
    exists(select 1 from public.wci_team_people x where x.team_id=grant_row.team_id and lower(trim(x.pic))=lower(trim(person_name)))) then return true;end if;
  end if;
 end loop;return false;
end $$;
revoke all on function wci_private.activity_access(uuid,text,uuid,text,uuid) from public,anon;
grant execute on function wci_private.activity_access(uuid,text,uuid,text,uuid) to authenticated;
create policy activities_read on public.wci_activities for select to authenticated using(wci_private.activity_access(workspace_id,dataset,owner_id,pic,(select auth.uid())));
grant select on public.wci_activities to authenticated;

create function wci_private.activity_read(w uuid,k text,as_user uuid) returns setof public.wci_activities
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=coalesce(as_user,auth.uid());begin
 if auth.uid() is null or (as_user is not null and wci_private.role_of(w) is distinct from 'super_admin') then raise exception 'Akses kegiatan tidak diizinkan';end if;
 return query select a.* from public.wci_activities a where a.workspace_id=w and a.dataset=k and wci_private.activity_access(w,k,a.owner_id,a.pic,actor) order by a.updated_at desc,a.id;
end $$;
create function public.wci_activity_read(p_workspace uuid,p_dataset text,p_as uuid default null) returns setof public.wci_activities
language sql stable security invoker set search_path='' as $$select * from wci_private.activity_read(p_workspace,p_dataset,p_as)$$;
revoke all on function wci_private.activity_read(uuid,text,uuid),public.wci_activity_read(uuid,text,uuid) from public,anon;
grant execute on function wci_private.activity_read(uuid,text,uuid),public.wci_activity_read(uuid,text,uuid) to authenticated;

create function wci_private.activity_upload_access(path text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare parts text[]:=string_to_array(path,'/');w uuid;role text;begin
 if array_length(parts,1)<>5 or parts[1]!~*'^[0-9a-f-]{36}$' or parts[4]!~*'^[0-9a-f-]{36}$' then return false;end if;
 w:=parts[1]::uuid;role:=wci_private.role_of(w);
 return parts[2] in('ijr','regional') and parts[3]=auth.uid()::text and (role in('admin','super_admin') or role='individual' and exists(select 1 from public.wci_access a where a.workspace_id=w and a.dataset=parts[2] and a.user_id=auth.uid() and a.source='AT' and trim(a.pic)<>''));
exception when invalid_text_representation then return false;end $$;
create function wci_private.activity_file_access(path text) returns boolean
language sql stable security definer set search_path='' as $$
 select wci_private.activity_upload_access(path) or exists(select 1 from public.wci_activities a where a.workspace_id::text=split_part(path,'/',1) and a.id::text=split_part(path,'/',4)
 and wci_private.activity_access(a.workspace_id,a.dataset,a.owner_id,a.pic,auth.uid()) and exists(select 1 from jsonb_array_elements(a.attachments) f where f->>'path'=path));
$$;
revoke all on function wci_private.activity_upload_access(text),wci_private.activity_file_access(text) from public,anon;
grant execute on function wci_private.activity_upload_access(text),wci_private.activity_file_access(text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('wci-activity-files','wci-activity-files',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp','message/rfc822','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create policy activity_file_insert on storage.objects for insert to authenticated with check(bucket_id='wci-activity-files' and wci_private.activity_upload_access(name));
create policy activity_file_read on storage.objects for select to authenticated using(bucket_id='wci-activity-files' and wci_private.activity_file_access(name));
create policy activity_file_draft_delete on storage.objects for delete to authenticated using(bucket_id='wci-activity-files' and wci_private.activity_upload_access(name) and not exists(select 1 from public.wci_activities a where a.id::text=split_part(name,'/',4) and exists(select 1 from jsonb_array_elements(a.attachments) f where f->>'path'=name)));

create function wci_private.activity_save(w uuid,k text,id uuid,kind text,body jsonb,files jsonb,expected timestamptz,record_id uuid) returns public.wci_activities
language plpgsql security definer set search_path='' as $$
declare old public.wci_activities;result public.wci_activities;r public.wci_records;role text;person text;active uuid;mode text;key text;f jsonb;participant jsonb;grp text;nm text;n numeric;begin
 role:=wci_private.role_of(w);
 if auth.uid() is null or role is null or role not in('individual','admin','super_admin') then raise exception 'Hanya pengguna pemilik kegiatan atau Admin yang dapat menyimpan';end if;
 if k not in('ijr','regional') or kind not in('calendar','training','call','handover') or kind='training' and k<>'ijr' then raise exception 'Jenis kegiatan tidak tersedia';end if;
 if jsonb_typeof(body) is distinct from 'object' or octet_length(body::text)>524288 or jsonb_typeof(files) is distinct from 'array' or jsonb_array_length(files)>10 then raise exception 'Isian atau lampiran tidak valid';end if;
 perform pg_advisory_xact_lock(hashtextextended(id::text,0));
 select * into old from public.wci_activities a where a.id=activity_save.id for update;
 if old.id is not null then
  if old.workspace_id<>w or old.dataset<>k or old.kind<>kind or (role='individual' and (old.owner_id<>auth.uid() or not wci_private.activity_access(w,k,old.owner_id,old.pic,auth.uid()))) then raise exception 'Tidak berhak mengubah kegiatan ini';end if;
  if old.updated_at is distinct from expected then raise exception 'Kegiatan telah diperbarui. Tutup form dan muat ulang sebelum menyimpan.';end if;
  person:=old.pic;key:=old.job_key;mode:=old.data_mode;
 elsif expected is not null then raise exception 'Kegiatan tidak ditemukan';
 else
  person:=trim(body->>'implementor');
  if coalesce(person,'')='' or length(person)>160 or role='individual' and not exists(select 1 from public.wci_access a where a.workspace_id=w and a.dataset=k and a.user_id=auth.uid() and a.source='AT' and trim(a.pic)<>'' and lower(trim(a.pic))=lower(person)) then raise exception 'Implementor harus sesuai PIC akun';end if;
 end if;
 if kind='handover' then
  if old.id is null then
   select d.data_mode,case when d.data_mode='reference' then d.active_batch else d.operational_batch end into mode,active from public.wci_datasets d where d.workspace_id=w and d.kind=k for update;
   select * into r from public.wci_records a where a.id=record_id and a.workspace_id=w and a.dataset=k for update;
   if r.id is null or r.batch_id is distinct from active then raise exception 'Handover hanya pada data terbaru';end if;
   if role<>'individual' or not wci_private.activity_access(w,k,auth.uid(),person,auth.uid()) or not lower(person)=any(wci_private.names(k,r.payload)) then raise exception 'Handover hanya untuk pekerjaan sendiri';end if;
   nm:=coalesce(r.payload->>case when k='ijr' then 'Application Type' else 'type' end,'');
   if nm!~*'^(baru|new(?!.*no new)|n$)' then raise exception 'Handover hanya untuk pengajuan New';end if;
   nm:=coalesce(r.payload->>case when k='ijr' then 'Status' else 'status' end,'');
   if (k='regional' and nm!~*'^done$') or (k='ijr' and nm!~*'^(proses selesai|registered,\s*delivered|delivered|done)$') then raise exception 'Pekerjaan harus sudah Done sebelum Handover';end if;
   if k='regional' and coalesce(trim(r.payload->>'companyId'),'')='' then raise exception 'Company ID wajib diisi untuk pengajuan New';end if;
   key:=r.job_key;
   body:=body||jsonb_build_object('company',coalesce(r.payload->>'company',r.payload->>'Applicant Name'),'product',coalesce(r.payload->>'product','BNIdirect'),'reference',coalesce(r.payload->>'cid',r.payload->>'Application Number'),'recordId',r.id);
  else body:=body||jsonb_build_object('company',old.payload->>'company','product',old.payload->>'product','reference',old.payload->>'reference','recordId',old.payload->>'recordId');end if;
  if body->>'measure' not in('volume','item') or coalesce(body->>'quantity','')!~'^\d+(\.\d+)?$' then raise exception 'Isi volume atau jumlah item yang valid';end if;
  n:=(body->>'quantity')::numeric;if n<=0 or n>1e18 or body->>'measure'='item' and n<>trunc(n) then raise exception 'Jumlah harus positif; item harus bilangan bulat';end if;
  if body->>'informed' is distinct from 'true' or jsonb_array_length(files)=0 then raise exception 'Checklist informasi nasabah dan bukti email wajib diisi';end if;
  body:=body||jsonb_build_object('date',coalesce(old.payload->>'date',to_char(now() at time zone 'Asia/Jakarta','YYYY-MM-DD')));
 else
  if coalesce(body->>'date','')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Tanggal wajib diisi';end if;perform (body->>'date')::date;
  if kind='calendar' then
   if coalesce(body->>'time','')!~'^([01]\d|2[0-3]):[0-5]\d$' or coalesce(trim(body->>'place'),'')='' then raise exception 'Waktu dan tempat wajib diisi';end if;
  else
   if coalesce(trim(body->>'product'),'')='' then raise exception 'Produk wajib diisi';end if;
   foreach grp in array array['bni','customers'] loop
    if jsonb_typeof(body->grp) is distinct from 'array' or jsonb_array_length(body->grp)>2000 then raise exception 'Daftar peserta tidak valid';end if;
    for participant in select * from jsonb_array_elements(body->grp) loop
     if coalesce(trim(participant->>'name'),'')='' or length(participant->>'name')>160 or jsonb_typeof(participant->'attended') is distinct from 'boolean' then raise exception 'Nama atau kehadiran peserta tidak valid';end if;
    end loop;
   end loop;
   if kind='training' and jsonb_array_length(files)=0 then raise exception 'Bukti training wajib diunggah';end if;
   if kind='call' then
    foreach grp in array array['title','company','start','end','mode','place','discussion','feedback','potential','followup'] loop
     if coalesce(trim(body->>grp),'')='' then raise exception 'Lengkapi identitas dan isi Call Report';end if;
    end loop;
    if (body->>'start')!~'^([01]\d|2[0-3]):[0-5]\d$' or (body->>'end')!~'^([01]\d|2[0-3]):[0-5]\d$' or (body->>'end')::time<(body->>'start')::time then raise exception 'Waktu Call Report tidak valid';end if;
   end if;
  end if;
 end if;
 for f in select * from jsonb_array_elements(files) loop
  if coalesce(f->>'name','')='' or length(f->>'name')>200 or not exists(select 1 from storage.objects o where o.bucket_id='wci-activity-files' and o.name=f->>'path' and o.name like w::text||'/'||k||'/%/'||id::text||'/%' and ((split_part(o.name,'/',3)=auth.uid()::text and wci_private.activity_upload_access(o.name)) or old.id is not null and exists(select 1 from jsonb_array_elements(old.attachments) ofile where ofile->>'path'=o.name))) then raise exception 'Lampiran tidak tersedia atau bukan milik kegiatan ini';end if;
  if kind in('handover','training') and lower(f->>'name')!~'\.(pdf|png|jpe?g|webp|eml)$' then raise exception 'Bukti harus PDF, gambar, atau email';end if;
 end loop;
 body:=body||jsonb_build_object('implementor',person);
 insert into public.wci_activities as a(id,workspace_id,dataset,kind,owner_id,pic,job_key,data_mode,payload,attachments)
 values(id,w,k,kind,coalesce(old.owner_id,auth.uid()),person,key,mode,body,files)
 on conflict on constraint wci_activities_pkey do update set payload=excluded.payload,attachments=excluded.attachments,updated_at=clock_timestamp() returning * into result;
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(w,auth.uid(),'activity_'||kind,k,jsonb_build_object('activity_id',id,'operation',case when old.id is null then 'create' else 'update' end));
 insert into public.wci_events(workspace_id,revision) values(w,1) on conflict(workspace_id) do update set revision=public.wci_events.revision+1,updated_at=now();
 return result;
end $$;
create function public.wci_activity_save(p_workspace uuid,p_dataset text,p_id uuid,p_kind text,p_payload jsonb,p_attachments jsonb,p_expected timestamptz default null,p_record uuid default null) returns public.wci_activities
language sql security invoker set search_path='' as $$select wci_private.activity_save(p_workspace,p_dataset,p_id,p_kind,p_payload,p_attachments,p_expected,p_record)$$;
revoke all on function wci_private.activity_save(uuid,text,uuid,text,jsonb,jsonb,timestamptz,uuid),public.wci_activity_save(uuid,text,uuid,text,jsonb,jsonb,timestamptz,uuid) from public,anon;
grant execute on function wci_private.activity_save(uuid,text,uuid,text,jsonb,jsonb,timestamptz,uuid),public.wci_activity_save(uuid,text,uuid,text,jsonb,jsonb,timestamptz,uuid) to authenticated;

-- Old clients cannot bypass the new checklist and proof requirement.
create or replace function public.wci_regional_progress(p_workspace uuid,p_id uuid,p_action text,p_company_id text default null,p_note text default '') returns void
language plpgsql security invoker set search_path='' as $$begin
 if p_action='handover' then raise exception 'Gunakan formulir Handover terbaru dengan checklist dan bukti email';end if;
 perform wci_private.regional_progress(p_workspace,p_id,p_action,p_company_id,p_note);
end $$;
