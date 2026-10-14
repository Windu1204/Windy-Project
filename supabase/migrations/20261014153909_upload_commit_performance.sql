-- Keep all merge, role and transaction rules; avoid quadratic staging scans.
do $$ declare body text; needle text; begin
 select pg_get_functiondef('wci_private.wci_replace_dataset(uuid,text,jsonb,text)'::regprocedure) into body;
 needle:='duplicate_count:=jsonb_array_length(p_rows)-(select count(*) from wci_merge_stage_v2);';
 if position(needle in body)=0 then raise exception 'Merge staging changed';end if;
 body:=replace(body,needle,needle||'
 create index if not exists wci_merge_stage_v2_job_idx on pg_temp.wci_merge_stage_v2(job_key);
 analyze pg_temp.wci_merge_stage_v2;');
 needle:='select r.* from public.wci_records r where r.batch_id=baseline and (p_kind<>''corporate'' or r.position=(select min(z.position) from public.wci_records z where z.batch_id=baseline and z.job_key=r.job_key))';
 if position(needle in body)=0 then raise exception 'Baseline projection changed';end if;
 body:=replace(body,needle,'select r.* from public.wci_records r where r.batch_id=baseline and p_kind<>''corporate'' union all select r.* from (select distinct on(job_key) * from public.wci_records where batch_id=baseline order by job_key,position) r where p_kind=''corporate'' and r.job_key is not null');
 needle:='not exists(select 1 from wci_merge_stage_v2 s where s.job_key is not distinct from r.job_key)';
 if position(needle in body)=0 then raise exception 'Baseline retention changed';end if;
 body:=replace(body,needle,'not exists(select 1 from wci_merge_stage_v2 s where s.job_key=r.job_key) and (r.job_key is not null or not exists(select 1 from wci_merge_stage_v2 s where s.job_key is null))');
 execute body;
end $$;
-- This bulk Admin operation has a bounded allowance; normal requests stay at 8s.
alter function public.wci_commit_staged_upload(uuid) set statement_timeout='55s';
alter function public.wci_commit_staged_upload(uuid) set jit='off';
notify pgrst,'reload schema';
