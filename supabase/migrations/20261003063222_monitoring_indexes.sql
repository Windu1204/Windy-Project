create index wci_audit_user_idx on public.wci_audit(user_id);
create index wci_batches_author_idx on public.wci_batches(created_by);
create index wci_datasets_active_idx on public.wci_datasets(active_batch,workspace_id,kind);
create index wci_datasets_original_idx on public.wci_datasets(original_batch,workspace_id,kind);
create index wci_records_batch_fk_idx on public.wci_records(batch_id,workspace_id,dataset);
create index wci_grants_workspace_idx on wci_private.access_grants(workspace_id);
create policy wci_grants_deny_client on wci_private.access_grants for all to public using(false) with check(false);

