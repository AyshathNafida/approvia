-- TEMPLATE ONLY. Apply reviewed statements separately, as database owner.
-- Never run this entire template. Never use real mappings in version control.
-- All switches remain false in the migration.

-- 1. Approve ONE existing account's destination, using privately reviewed UUIDs.
-- Start with the dedicated Admin; do not create a replacement identity.
-- begin;
-- select pg_advisory_xact_lock(20261014,1);
-- insert into approvia_private.email_migrations(user_id,college_email)
-- values ('REPLACE_WITH_EXISTING_AUTH_UUID'::uuid,'REPLACE_WITH_ADDRESS@lbscek.ac.in');
-- commit;

-- 2. AFTER custom SMTP and authorized delivery testing are ready, enable the UI
-- and server email operations. This does not enable college-only cutover.
-- begin;
-- select pg_advisory_xact_lock(20261014,1);
-- update approvia_private.account_settings set email_enabled=true;
-- commit;

-- 3. Inspect migration progress privately. Users initiate email change within
-- Approvia and confirm both inboxes. Never directly UPDATE auth.users to migrate.
select p.id,p.account_type,p.active,m.college_email,m.completed_at,
 approvia_private.eligible(p.id) as currently_eligible,
 approvia_private.college_email(u.email) and u.email_confirmed_at is not null as verified_college_email
from public.profiles p join auth.users u on u.id=p.id
left join approvia_private.email_migrations m on m.user_id=p.id;

-- 4. Run ONLY after real college Admin login, migration review and regression
-- acceptance. The guard prevents lockout and refuses active unmigrated accounts.
-- begin;
-- select pg_advisory_xact_lock(20261014,1);
-- do $$ begin
--  if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id
--   where p.account_type='ADMIN' and p.active and p.onboarding_complete
--   and approvia_private.college_email(u.email) and u.email_confirmed_at is not null) then
--   raise exception 'Verify a migrated active college Admin before cutover.';
--  end if;
--  if exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.active
--   and (not approvia_private.college_email(u.email) or u.email_confirmed_at is null)) then
--   raise exception 'Review and migrate active accounts before cutover.';
--  end if;
--  update approvia_private.account_settings set college_only=true;
--  insert into public.audit_logs(actor_id,event,entity_type,entity_id)
--   select null,'COLLEGE_EMAIL_CUTOVER','profiles',id from public.profiles where account_type='ADMIN' and active;
-- end $$;
-- commit;

-- Emergency owner rollback restores legacy eligibility only; invitation domain
-- checks and onboarding still apply. It never changes account IDs or history.
-- begin;
-- select pg_advisory_xact_lock(20261014,1);
-- update approvia_private.account_settings set college_only=false,email_enabled=false;
-- commit;
