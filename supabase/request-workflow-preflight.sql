-- Read-only owner capture before the request-workflow migration. Export privately.
-- Contains application request data; keep outside Git. Excludes Auth credentials.
select jsonb_build_object(
 'captured_at',now(),
 'departments',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.departments t),
 'classes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.classes t),
 'profiles',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.profiles t),
 'request_types',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.request_types t),
 'requests',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.requests t),
 'approval_steps',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.approval_steps t),
 'request_actions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.request_actions t),
 'audit_logs',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.audit_logs t),
 'authority_assignments',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.authority_assignments t),
 'responsibility_changes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.responsibility_changes t),
 'request_reassignments',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.request_reassignments t),
 'columns',(select jsonb_agg(to_jsonb(t)) from information_schema.columns t where table_schema='public'),
 'constraints',(select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid))) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'),
 'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','approvia_private') and p.prokind='f'),
 'policies',(select jsonb_agg(to_jsonb(t)) from pg_policies t where schemaname='public'),
 'grants',(select jsonb_agg(to_jsonb(t)) from information_schema.table_privileges t where table_schema='public' and grantee in ('anon','authenticated')),
 'indexes',(select jsonb_agg(to_jsonb(t)) from pg_indexes t where schemaname='public'),
 'rls',(select jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')
) as private_workflow_snapshot;
