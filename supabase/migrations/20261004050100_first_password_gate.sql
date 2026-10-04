create table wci_private.wci_password_requirements(user_id uuid primary key references auth.users(id) on delete cascade deferrable initially deferred, initial_hash text not null);
alter table wci_private.wci_password_requirements enable row level security;
revoke all on wci_private.wci_password_requirements from public,anon,authenticated;
create function wci_private.password_gate() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(new.raw_app_meta_data->>'must_change_password','false')='true' and
 (tg_op='INSERT' or new.raw_app_meta_data->>'password_setup_nonce' is distinct from old.raw_app_meta_data->>'password_setup_nonce') then
 insert into wci_private.wci_password_requirements(user_id,initial_hash) values(new.id,new.encrypted_password) on conflict(user_id) do update set initial_hash=excluded.initial_hash;
 elsif tg_op='UPDATE' and new.encrypted_password is distinct from old.encrypted_password and exists(select 1 from wci_private.wci_password_requirements where user_id=new.id and initial_hash is distinct from new.encrypted_password) then
 delete from wci_private.wci_password_requirements where user_id=new.id;
 new.raw_app_meta_data=jsonb_set(coalesce(new.raw_app_meta_data,'{}'::jsonb),'{must_change_password}','false'::jsonb);
 end if;
 return new;
end $$;
revoke all on function wci_private.password_gate() from public,anon,authenticated;
create trigger wci_first_password_gate before insert or update of encrypted_password,raw_app_meta_data on auth.users for each row execute function wci_private.password_gate();
create or replace function wci_private.role_of(w uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.wci_profiles where workspace_id=w and user_id=(select auth.uid()) and active and not exists(select 1 from wci_private.wci_password_requirements where user_id=(select auth.uid()))
$$;
