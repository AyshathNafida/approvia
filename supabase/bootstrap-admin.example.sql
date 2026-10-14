-- Run as database owner AFTER both migrations. Replace only placeholder values.
-- Create and confirm this dedicated Auth login first; keep its password private.
begin;
do $$
declare
  admin_email text := 'admin@example.test';
  admin_name text := 'Institution Administrator';
  user_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(20261014, 1);
  if exists (select 1 from public.profiles where account_type = 'ADMIN') then
    raise exception 'An Admin profile already exists. This script only bootstraps the first Admin.';
  end if;
  if admin_email = 'admin@example.test' then raise exception 'Replace the placeholder with your dedicated confirmed Admin login email.'; end if;
  if (select count(*) from auth.users where lower(email) = lower(btrim(admin_email)) and email_confirmed_at is not null) <> 1 then
    raise exception 'Exactly one confirmed login must match the dedicated Admin email.';
  end if;
  select id into user_id from auth.users where lower(email) = lower(btrim(admin_email)) and email_confirmed_at is not null;
  if exists (select 1 from public.profiles where id = user_id) then
    raise exception 'This login already has a profile. Use a separate dedicated Admin login.';
  end if;
  insert into public.profiles(id, full_name, account_type) values (user_id, admin_name, 'ADMIN');
end;
$$;
commit;
