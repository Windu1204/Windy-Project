-- Scope the exemption to the Admin upload pipeline for every dataset.
-- PostgreSQL 0 disables the statement timer; provider connection limits still apply.
-- Preserve existing invoker/definer, ownership, role, completeness and baseline guards.
alter function public.wci_begin_upload(uuid,text,text,integer) set statement_timeout='0';
alter function public.wci_begin_upload(uuid,text,text,integer) set jit='off';
alter function public.wci_stage_upload(uuid,integer,jsonb,jsonb) set statement_timeout='0';
alter function public.wci_stage_upload(uuid,integer,jsonb,jsonb) set jit='off';
alter function public.wci_review_staged_upload(uuid) set statement_timeout='0';
alter function public.wci_review_staged_upload(uuid) set jit='off';
alter function public.wci_commit_staged_upload(uuid) set statement_timeout='0';
alter function public.wci_commit_staged_upload(uuid) set jit='off';
notify pgrst,'reload schema';
notify pgrst,'reload config';
