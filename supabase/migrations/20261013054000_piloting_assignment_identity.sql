-- A distinct AT assignment date represents a distinct assignment, as confirmed by the owner.
create or replace function wci_private.job_identity(k text,p jsonb) returns text language sql immutable set search_path='' as $$
 select case when k='ijr' then 'ijr:'||lower(trim(p->>'Application Number'))
 when k='corporate' then 'corporate:'||lower(trim(p->>'noreg'))
 when k='piloting' then 'piloting:AT:'||lower(trim(p->>'No. Register'))||':'||coalesce(trim(p->>'Tanggal Assign to AT'),'')
 else 'regional:'||jsonb_build_array(lower(trim(p->>'company')),lower(trim(coalesce(p->>'cid',''))),lower(trim(p->>'product')),lower(trim(coalesce(p->>'type',''))),lower(trim(coalesce(p->>'salesDate',''))))::text end
$$;
update public.wci_records set job_key=wci_private.job_identity(dataset,payload)
where dataset='piloting' and job_key is distinct from wci_private.job_identity(dataset,payload);
