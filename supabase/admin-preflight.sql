-- Read-only owner-side checks BEFORE applying the Admin migration.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relname;
select to_regclass('public.authority_assignments') as admin_schema,
  to_regclass('supabase_migrations.schema_migrations') as migration_history,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.classes) as classes,
  (select count(*) from public.requests) as requests,
  (select count(*) from public.requests where status = 'IN_REVIEW') as pending_requests;
select p.proname, p.prosecdef as security_definer, p.proconfig, pg_catalog.pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'approvia_private') order by n.nspname, p.proname;
select * from pg_catalog.pg_policies where schemaname = 'public' order by tablename, policyname;

-- Export this result PRIVATELY before changing the database. It contains request
-- contents and must never be committed or uploaded as a public artifact.
-- This is an application-state snapshot, NOT a full Supabase/Auth backup.
select jsonb_build_object(
  'captured_at', now(),
  'departments', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.departments t),
  'classes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.classes t),
  'profiles', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.profiles t),
  'request_types', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.request_types t),
  'requests', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.requests t),
  'approval_steps', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.approval_steps t),
  'request_actions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.request_actions t),
  'audit_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.audit_logs t)
) as private_application_snapshot;
