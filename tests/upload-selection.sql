begin;
do $qa$
declare w uuid;actor uuid;k text;input jsonb;second_input jsonb;sid uuid;sid2 uuid;b uuid;old_b uuid;combined_b uuid;review jsonb;original_role text:=current_user;source_rows jsonb;denied boolean;
begin
 select p.workspace_id,p.user_id into w,actor from public.wci_profiles p where p.active and p.role='super_admin' and not exists(select 1 from wci_private.wci_password_requirements q where q.user_id=p.user_id) limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 foreach k in array array['ijr','regional','corporate','piloting'] loop
  update public.wci_datasets set active_batch=null,data_mode='reference' where workspace_id=w and kind=k;
  input:=case k when 'ijr' then '[{"Application Number":"QA-SELECT-A","Status":"Dalam Proses"}]'::jsonb when 'regional' then '[{"company":"QA-SELECT-A","product":"QA","salesDate":"2026-08-01","type":"N","status":"In progress"}]'::jsonb when 'corporate' then '[{"noreg":"QA-SELECT-A","company":"QA","product":"BNIdirect","status":"On Progress"}]'::jsonb else '[{"No. Register":"QA-SELECT-A","PIC AT":"QA","Nama Perusahaan":"QA","Jenis Produk / Solusi":"BNIdirect","Tanggal Assign to AT":"2026-08-01","Kategori":"Done"}]'::jsonb end;
  second_input:=replace(input::text,'QA-SELECT-A','QA-SELECT-B')::jsonb;
  old_b:=wci_private.wci_replace_dataset(w,k,replace(input::text,'QA-SELECT-A','QA-SELECT-OLD')::jsonb,'Old fixture');
  execute 'set local role authenticated';
  sid:=public.wci_begin_upload(w,k,'Selected A fixture',1);perform public.wci_set_upload_strategy(sid,'selected');perform public.wci_stage_upload(sid,0,input,'[]');review:=public.wci_review_staged_upload(sid);
  if review->>'new'<>'1' or review->>'updated'<>'0' then raise exception 'Selected review includes baseline: %',review;end if;
  b:=public.wci_commit_staged_upload(sid);if public.wci_commit_staged_upload(sid)<>b then raise exception 'Retry created duplicate batch';end if;
  if (select count(*) from public.wci_records where batch_id=b)<>1 then raise exception 'Selected mode retained old records: %',k;end if;
  if (select count(*) from public.wci_records where batch_id=old_b)<>1 then raise exception 'History was deleted';end if;
  if public.wci_upload_summary(w,k)->>'strategy'<>'selected' then raise exception 'Selected mode not persisted';end if;
  sid2:=public.wci_begin_upload(w,k,'Merge B fixture',1);perform public.wci_set_upload_strategy(sid2,'merge');perform public.wci_stage_upload(sid2,0,second_input,'[]');perform public.wci_review_staged_upload(sid2);combined_b:=public.wci_commit_staged_upload(sid2);
  if (select count(*) from public.wci_records where batch_id=combined_b)<>2 then raise exception 'Merge lost baseline: %',k;end if;
  select jsonb_agg(payload) into source_rows from public.wci_upload_source_rows(w,k,sid2,0);
  if jsonb_array_length(source_rows)<>1 then raise exception 'Saved source returned merged dataset';end if;
  if not public.wci_upload_sources(w,k) @> jsonb_build_array(jsonb_build_object('id',sid2,'valid_count',1)) then raise exception 'Source picker missing original upload';end if;
  denied:=false;begin perform public.wci_set_upload_strategy(sid2,'selected');exception when others then denied:=true;end;if not denied then raise exception 'Committed session modified';end if;
  denied:=false;begin perform public.wci_upload_source_rows(w,case when k='ijr' then 'regional' else 'ijr' end,sid2,0);exception when others then denied:=true;end;if not denied then raise exception 'Cross-dataset source allowed';end if;
  execute format('set local role %I',original_role);
 end loop;
 perform set_config('request.jwt.claim.sub','',true);denied:=false;begin perform public.wci_upload_sources(w,'corporate');exception when others then denied:=true;end;if not denied then raise exception 'Anonymous source listing allowed';end if;
if has_function_privilege('authenticated','wci_private.replace_selected_dataset(uuid,text,jsonb,text,text)','execute') then raise exception 'Internal helper exposed';end if;
 select user_id into actor from public.wci_profiles where active and role='individual' limit 1;
 if actor is not null then perform set_config('request.jwt.claim.sub',actor::text,true);denied:=false;begin perform public.wci_upload_sources(w,'corporate');exception when others then denied:=true;end;if not denied then raise exception 'Individual source access accepted';end if;end if;
end $qa$;
rollback;
