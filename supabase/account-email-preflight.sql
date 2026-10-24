-- Read-only owner checks. Save output privately; do not commit identity mappings.
select current_database(),version();
select to_regclass('public.account_invitations') as invitation_migration_already_applied;
select id,full_name,account_type,active from public.profiles order by account_type,full_name;
select p.id,p.account_type,p.active,u.email,u.email_confirmed_at,
 exists(select 1 from auth.users other where other.id<>p.id and lower(other.email)=lower(u.email)) as duplicate_email
from public.profiles p join auth.users u on u.id=p.id;
select count(*) as requests from public.requests;
select count(*) as steps from public.approval_steps;
select count(*) as actions from public.request_actions;
select n.nspname,p.proname,pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','approvia_private') order by n.nspname,p.proname;
select schemaname,tablename,policyname,qual from pg_policies where schemaname='public';
-- Capture application data/schema separately using the existing private snapshot
-- procedure. This preflight is not a database/Auth backup.
