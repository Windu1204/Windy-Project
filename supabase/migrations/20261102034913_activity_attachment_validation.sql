create or replace function wci_private.activity_save(w uuid,k text,id uuid,kind text,body jsonb,files jsonb,expected timestamptz,record_id uuid) returns public.wci_activities
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
  if coalesce(f->>'name','')='' or length(f->>'name')>200 or not exists(select 1 from storage.objects o where o.bucket_id='wci-activity-files' and o.name=f->>'path' and o.name like w::text||'/'||k||'/%/'||activity_save.id::text||'/%' and ((split_part(o.name,'/',3)=auth.uid()::text and wci_private.activity_upload_access(o.name)) or old.id is not null and exists(select 1 from jsonb_array_elements(old.attachments) ofile where ofile->>'path'=o.name))) then raise exception 'Lampiran tidak tersedia atau bukan milik kegiatan ini';end if;
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
