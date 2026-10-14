begin;
do $qa$
declare k text; input jsonb; s uuid; w uuid; actor uuid; b uuid; review jsonb; login_role text:=current_user; func regprocedure; denied boolean;
begin
 foreach func in array array['public.wci_begin_upload(uuid,text,text,integer)'::regprocedure,'public.wci_stage_upload(uuid,integer,jsonb,jsonb)'::regprocedure,'public.wci_review_staged_upload(uuid)'::regprocedure,'public.wci_commit_staged_upload(uuid)'::regprocedure] loop
  if not exists(select 1 from pg_proc where oid=func and proconfig @> array['statement_timeout=0','jit=off']) then raise exception 'Upload timer still active: %',func;end if;
 end loop;
 select p.workspace_id,p.user_id into w,actor from public.wci_profiles p where p.active and p.role in('admin','super_admin') and not exists(select 1 from wci_private.wci_password_requirements q where q.user_id=p.user_id) limit 1;
 if w is null then raise exception 'Authorized test workspace unavailable';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 foreach k in array array['ijr','regional','corporate','piloting'] loop
  -- Empty baseline is a transactional fixture; production pointers are restored by rollback.
  update public.wci_datasets set active_batch=null,data_mode='reference' where workspace_id=w and kind=k;
  input:=case k
   when 'ijr' then '[{"Application Number":"QA-TIMER","Status":"Dalam Proses"}]'::jsonb
   when 'regional' then '[{"company":"QA","product":"QA","salesDate":"2026-08-01","type":"N","status":"In progress"}]'::jsonb
   when 'corporate' then '[{"noreg":"QA-TIMER","company":"QA","product":"BNIdirect","status":"On Progress"}]'::jsonb
   else '[{"No. Register":"QA-TIMER","PIC AT":"QA","Nama Perusahaan":"QA","Jenis Produk / Solusi":"BNIdirect","Tanggal Assign to AT":"2026-08-01","Kategori":"Done"}]'::jsonb end;
  execute 'set local role authenticated';
  s:=public.wci_begin_upload(w,k,'Transactional timeout QA',1);
  perform public.wci_stage_upload(s,0,input,'[]');
  -- Identical chunk retries must not duplicate uploaded rows.
  perform public.wci_stage_upload(s,0,input,'[]');
  review:=public.wci_review_staged_upload(s);
  if (review->>'new')::int<>1 or (review->>'conflicts')::int<>0 then raise exception 'Review incorrect: % %',k,review;end if;
  b:=public.wci_commit_staged_upload(s);
  if public.wci_commit_staged_upload(s)<>b then raise exception 'Commit retry duplicated batch: %',k;end if;
  execute format('set local role %I',login_role);
  if (select count(*) from public.wci_records where batch_id=b)<>1 then raise exception 'Incorrect applied row count: %',k;end if;
 end loop;
 -- Removing a timer must not remove authorization.
 perform set_config('request.jwt.claim.sub','',true);
 denied:=false;
 begin perform public.wci_review_staged_upload(s);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Anonymous review accepted';end if;
 denied:=false;
 begin perform public.wci_commit_staged_upload(s);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Anonymous commit accepted';end if;
end $qa$;
rollback;
