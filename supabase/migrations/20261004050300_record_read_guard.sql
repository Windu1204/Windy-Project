-- Evaluate account scope before checking the batch, avoiding nested batch RLS scans.
create function wci_private.record_read(w uuid,k text,p jsonb,batch uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(wci_private.row_access(w,k,p),false) then return false;end if;
 return exists(select 1 from public.wci_batches b join public.wci_datasets d on d.workspace_id=b.workspace_id and d.kind=b.dataset where b.id=batch and b.workspace_id=w and b.dataset=k and b.source='AT' and b.data_mode=d.data_mode);
end $$;
revoke all on function wci_private.record_read(uuid,text,jsonb,uuid) from public,anon;
grant execute on function wci_private.record_read(uuid,text,jsonb,uuid) to authenticated;
alter policy records_read on public.wci_records using(wci_private.record_read(workspace_id,dataset,payload,batch_id));
