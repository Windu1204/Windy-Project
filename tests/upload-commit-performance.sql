-- Run against a staged Corporate upload; all writes are rolled back.
begin;
set local statement_timeout='55s';
set local jit=off;
do $qa$ declare s wci_private.upload_sessions; t timestamptz; b uuid; n int; begin
 select * into s from wci_private.upload_sessions where dataset='corporate' and not committed order by created_at desc limit 1;
 if s.id is null then raise exception 'No staged fixture';end if;
 perform set_config('request.jwt.claim.sub',s.created_by::text,true);
 t:=clock_timestamp(); b:=public.wci_commit_staged_upload(s.id);
 select count(*) into n from public.wci_records where batch_id=b;
 if n<1 then raise exception 'Empty result';end if;
 if public.wci_commit_staged_upload(s.id)<>b then raise exception 'Retry created new batch';end if;
 perform set_config('wci.qa_result',jsonb_build_object('seconds',extract(epoch from clock_timestamp()-t),'rows',n,'idempotent',true)::text,true);
end $qa$;
select current_setting('wci.qa_result')::jsonb as result;
rollback;
