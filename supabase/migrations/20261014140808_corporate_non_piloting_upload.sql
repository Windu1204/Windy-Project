-- Corporate Non Piloting only. No record, SLA rule, role, or other dataset is rewritten.
create or replace function wci_private.corporate_patch(previous jsonb,incoming jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb;
begin
 if coalesce(previous->>'_corporateLatest','')<>'' and coalesce(incoming->>'_corporateLatest','')<>''
 and incoming->>'_corporateLatest'<previous->>'_corporateLatest' then return previous;end if;
 select coalesce(previous,'{}'::jsonb)||coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) into result
 from jsonb_each(incoming) e where left(e.key,7)<>'_source' and e.value<>'null'::jsonb and e.value<>'""'::jsonb;
 if coalesce(incoming->>'_corporateConflict','')<>'' then
  result:=result||jsonb_build_object('status',null,'doneDate',null);
 else result:=result-'_corporateConflict';end if;
 if coalesce(previous->>'status','') is distinct from coalesce(incoming->>'status','')
 and coalesce(incoming->>'status','')<>'' and coalesce(incoming->>'doneDate','')=''
 and incoming->>'status'!~*'(transaction|done|complete|selesai|closed)' then result:=result||jsonb_build_object('doneDate',null);end if;
 return result;
end $$;
revoke all on function wci_private.corporate_patch(jsonb,jsonb) from public,anon;
grant execute on function wci_private.corporate_patch(jsonb,jsonb) to authenticated;

-- Generated references for missing registers stay internal; visible No Reg remains empty.
create or replace function wci_private.job_identity(k text,p jsonb) returns text language sql immutable set search_path='' as $$
 select case when k='ijr' then 'ijr:'||lower(trim(p->>'Application Number'))
 when k='corporate' then 'corporate:'||coalesce(nullif(trim(p->>'_corporateIdentity'),''),lower(trim(p->>'noreg')))
 when k='piloting' then 'piloting:AT:'||lower(trim(p->>'No. Register'))||':'||coalesce(trim(p->>'Tanggal Assign to AT'),'')
 else 'regional:'||jsonb_build_array(lower(trim(p->>'company')),lower(trim(coalesce(p->>'cid',''))),lower(trim(p->>'product')),lower(trim(coalesce(p->>'type',''))),lower(trim(coalesce(p->>'salesDate',''))))::text end
$$;

-- Patch existing guarded paths; fail atomically if their definitions no longer match.
do $$
declare body text; needle text; replacement text;
begin
 select pg_get_functiondef('wci_private.wci_replace_dataset(uuid,text,jsonb,text)'::regprocedure) into body;
 needle:='(p_kind=''corporate'' and (coalesce(trim(r->>''noreg''),'''')='''' or coalesce(trim(r->>''product''),'''')='''' or coalesce(trim(r->>''company''),'''')=''''))';
 replacement:='(p_kind=''corporate'' and coalesce(nullif(trim(r->>''_corporateIdentity''),''''),nullif(trim(r->>''noreg''),'''')) is null)';
 if position(needle in body)=0 then raise exception 'Corporate source validation changed';end if;
 body:=replace(body,needle,replacement);
 needle:='if exists(select 1 from public.wci_records where batch_id=baseline and job_key in';
 if position(needle in body)=0 then raise exception 'Baseline validation changed';end if;
 body:=replace(body,needle,'if p_kind<>''corporate'' and exists(select 1 from public.wci_records where batch_id=baseline and job_key in');
 needle:='update wci_merge_stage_v2 s set payload=old.payload||';
 if position(needle in body)=0 then raise exception 'Merge patch changed';end if;
 body:=replace(body,needle,'if p_kind=''corporate'' then
 update wci_merge_stage_v2 s set payload=wci_private.corporate_patch(old.payload,s.payload)
 from (select distinct on(job_key) job_key,payload from public.wci_records where batch_id=baseline order by job_key,position) old where old.job_key=s.job_key;
 else update wci_merge_stage_v2 s set payload=old.payload||');
 needle:='from public.wci_records old where old.batch_id=baseline and old.job_key=s.job_key;';
 if position(needle in body)=0 then raise exception 'Merge baseline changed';end if;
 body:=replace(body,needle,needle||' end if;');
 -- Count patched jobs once even when a legacy batch contained repeated registers.
 needle:='left join public.wci_records old on old.batch_id=baseline and old.job_key=s.job_key;';
 if position(needle in body)=0 then raise exception 'Merge counts changed';end if;
 body:=replace(body,needle,'left join (select r.* from public.wci_records r where r.batch_id=baseline and (p_kind<>''corporate'' or r.position=(select min(z.position) from public.wci_records z where z.batch_id=baseline and z.job_key=r.job_key))) old on old.job_key=s.job_key;');
 execute body;

 select pg_get_functiondef('wci_private.wci_upload_review(uuid,text,jsonb)'::regprocedure) into body;
 needle:='coalesce(old.payload,''{}''::jsonb)||';
 if position(needle in body)=0 then raise exception 'Review patch changed';end if;
 body:=replace(body,needle,'case when p_kind=''corporate'' then wci_private.corporate_patch(old.payload,n.payload) else '||needle);
 needle:='end payload';
 if position(needle in body)=0 then raise exception 'Review projection changed';end if;
 body:=replace(body,needle,'end end payload');
 needle:='where batch_id=baseline and job_key in';
 if position(needle in body)=0 then raise exception 'Review baseline check changed';end if;
 body:=replace(body,needle,'where p_kind<>''corporate'' and batch_id=baseline and job_key in');
 execute body;

 select pg_get_functiondef('wci_private.reconcile_upload(uuid)'::regprocedure) into body;
 needle:='if s.committed then return;end if;';
 if position(needle in body)=0 then raise exception 'Reconciliation guard changed';end if;
 body:=replace(body,needle,'if s.committed or s.dataset=''corporate'' then return;end if;');
 execute body;
end $$;
