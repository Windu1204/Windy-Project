-- Extend the existing workspace dataset without changing membership or RLS.
alter table public.wci_datasets drop constraint wci_datasets_kind_check;
alter table public.wci_datasets add constraint wci_datasets_kind_check check(kind in ('ijr','regional','corporate','piloting'));
do $migration$
declare definition text;
begin
select pg_get_functiondef('public.wci_replace_dataset(uuid,text,jsonb,text)'::regprocedure) into definition;
definition := replace(definition, ' n=jsonb_array_length(p_rows);', $guard$
 if p_kind='piloting' then
  if exists(select 1 from jsonb_array_elements(p_rows) r where coalesce(trim(r->>'No. Register'),'')='' or coalesce(trim(r->>'Nama Perusahaan'),'')='' or coalesce(trim(r->>'PIC AT'),'')='' or coalesce(trim(r->>'Jenis Produk / Solusi'),'')='' or coalesce(trim(r->>'Tanggal Assign to AT'),'')='' or coalesce(r->>'Kategori','') not in ('Done','Reject/Retur','Masih Pending') or coalesce(r->>'Status Discrepancy','') not in ('Discrepancy','Tidak Discrepancy')) then raise exception 'Missing or invalid Corporate Piloting fields'; end if;
  if (select count(*) from jsonb_array_elements(p_rows))<>(select count(distinct trim(r->>'No. Register')) from jsonb_array_elements(p_rows) r) then raise exception 'Duplicate Corporate Piloting register'; end if;
 end if;
 n=jsonb_array_length(p_rows);$guard$);
execute definition;
end $migration$;
