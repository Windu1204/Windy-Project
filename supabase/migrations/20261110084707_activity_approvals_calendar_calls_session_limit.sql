-- New Handover requests require TL approval. Existing handovers retain their history.
alter table public.wci_activities add column approval_status text, add column approved_at timestamptz,
 add column approved_by uuid references auth.users(id), add column approver_name text;
update public.wci_activities set approval_status='legacy' where kind='handover';
alter table public.wci_activities add constraint handover_approval_state check (
 (kind<>'handover' and approval_status is null and approved_at is null and approved_by is null) or
 (kind='handover' and approval_status is not null and (approval_status in ('pending','legacy') and approved_at is null and approved_by is null or approval_status='approved' and approved_at is not null and approved_by is not null)));
create unique index wci_call_calendar on public.wci_activities(workspace_id,dataset,(payload->>'calendarId')) where kind='call' and nullif(payload->>'calendarId','') is not null;

do $patch$
declare definition text;
begin
 select replace(pg_get_functiondef('wci_private.activity_save(uuid,text,uuid,text,jsonb,jsonb,timestamptz,uuid)'::regprocedure),E'\r\n',E'\n') into definition;
 if strpos(definition,'old.updated_at is distinct from expected')=0 or strpos(definition,'attachments)'||chr(10)||' values')=0 then raise exception 'Activity save structure changed';end if;
 definition:=replace(definition,'  if old.updated_at is distinct from expected', $new$  if kind='handover' and old.approval_status is distinct from 'pending' then raise exception 'Handover yang sudah tercatat atau disetujui tidak dapat diubah';end if;
  if old.updated_at is distinct from expected$new$);
 -- A Call Report must belong to a visible schedule owned by the same implementor.
 definition:=replace(definition, $old$ if kind='handover' then$old$, $new$ if kind='call' then
  if nullif(body->>'calendarId','') is null then
   if old.id is null or nullif(old.payload->>'calendarId','') is not null then raise exception 'Pilih jadwal Calendar untuk Call Report';end if;
  else
   if coalesce(body->>'calendarId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Jadwal Calendar tidak valid';end if;
   perform 1 from public.wci_activities c where c.id=(body->>'calendarId')::uuid and c.workspace_id=w and c.dataset=k and c.kind='calendar'
    and c.owner_id=coalesce(old.owner_id,case when role in('admin','super_admin') then c.owner_id else auth.uid() end) and c.pic=person and wci_private.activity_access(w,k,c.owner_id,c.pic,auth.uid()) for share;
   if not found then raise exception 'Jadwal Calendar tidak tersedia untuk kegiatan ini';end if;
   if old.id is not null and nullif(old.payload->>'calendarId','') is not null and old.payload->>'calendarId' is distinct from body->>'calendarId' then raise exception 'Call Report sudah terhubung ke jadwal lain';end if;
  end if;
 end if;
 if kind='handover' then$new$);
 definition:=replace(definition,'job_key,data_mode,payload,attachments)'||chr(10)||' values','job_key,data_mode,payload,attachments,approval_status)'||chr(10)||' values');
 definition:=replace(definition,'person,key,mode,body,files)','person,key,mode,body,files,case when kind=''handover'' then ''pending'' else null end)');
 definition:=replace(definition,'coalesce(old.owner_id,auth.uid()),person,key,mode,body,files', $new$coalesce(old.owner_id,case when kind='call' and nullif(body->>'calendarId','') is not null then (select c.owner_id from public.wci_activities c where c.id=(body->>'calendarId')::uuid) else auth.uid() end),person,key,mode,body,files$new$);
 execute definition;
end $patch$;

create function wci_private.handover_approve(w uuid,id uuid,expected timestamptz) returns public.wci_activities
language plpgsql security definer set search_path='' as $$
declare a public.wci_activities;role text;name text;begin
 role:=wci_private.role_of(w);
 if auth.uid() is null or role is distinct from 'team_leader' then raise exception 'Hanya TL yang dapat menyetujui Handover';end if;
 select * into a from public.wci_activities x where x.id=handover_approve.id and x.workspace_id=w and x.kind='handover' for update;
 if a.id is null or not wci_private.activity_access(w,a.dataset,a.owner_id,a.pic,auth.uid()) or a.owner_id=auth.uid() then raise exception 'Handover bukan anggota dalam cakupan TL';end if;
 if a.approval_status is distinct from 'pending' then raise exception 'Handover sudah diproses';end if;
 if a.updated_at is distinct from expected then raise exception 'Handover telah diperbarui. Muat ulang sebelum menyetujui';end if;
 select p.name into name from public.wci_profiles p where p.workspace_id=w and p.user_id=auth.uid();
 update public.wci_activities x set approval_status='approved',approved_at=clock_timestamp(),approved_by=auth.uid(),approver_name=name,updated_at=clock_timestamp() where x.id=a.id returning * into a;
 insert into public.wci_audit(workspace_id,user_id,action,dataset,details) values(w,auth.uid(),'handover_approved',a.dataset,jsonb_build_object('activity_id',a.id));
 insert into public.wci_events(workspace_id,revision) values(w,1) on conflict(workspace_id) do update set revision=public.wci_events.revision+1,updated_at=now();
 return a;
end $$;
create function public.wci_handover_approve(p_workspace uuid,p_id uuid,p_expected timestamptz) returns public.wci_activities
language sql security invoker set search_path='' as $$select wci_private.handover_approve(p_workspace,p_id,p_expected)$$;
revoke all on function wci_private.handover_approve(uuid,uuid,timestamptz),public.wci_handover_approve(uuid,uuid,timestamptz) from public,anon;
grant execute on function wci_private.handover_approve(uuid,uuid,timestamptz),public.wci_handover_approve(uuid,uuid,timestamptz) to authenticated;

-- Absolute 15-minute session lifetime, derived from the authenticated session, not token refresh time.
create function wci_private.session_deadline() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare sid text:=auth.jwt()->>'session_id';deadline timestamptz;begin
 if auth.uid() is null or coalesce(sid,'')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise sqlstate 'PT401' using message='WCI_SESSION_EXPIRED';end if;
 select s.created_at+interval '15 minutes' into deadline from auth.sessions s where s.id=sid::uuid and s.user_id=auth.uid();
 if deadline is null or deadline<=statement_timestamp() then raise sqlstate 'PT401' using message='WCI_SESSION_EXPIRED';end if;
 return jsonb_build_object('expires_at',deadline,'server_now',statement_timestamp());
end $$;
create function public.wci_session_deadline() returns jsonb language sql stable security invoker set search_path='' as $$select wci_private.session_deadline()$$;
revoke all on function wci_private.session_deadline(),public.wci_session_deadline() from public,anon;
grant execute on function wci_private.session_deadline(),public.wci_session_deadline() to authenticated;
create function public.wci_check_session() returns void language plpgsql security invoker set search_path='' as $$begin
 if auth.role()='authenticated' then perform wci_private.session_deadline();end if;
end $$;
revoke all on function public.wci_check_session() from public;
grant execute on function public.wci_check_session() to anon,authenticated,service_role;
alter role authenticator set pgrst.db_pre_request='public.wci_check_session';
notify pgrst,'reload config';
notify pgrst,'reload schema';
