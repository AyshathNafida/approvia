-- OWNER ONLY: execute EACH block separately in the indicated SQL session.
-- Run workflow-concurrency-setup.sql first. Start B while A is sleeping.
-- A holds the write gate for 30 seconds; B should wait and then assert behavior.
-- Finish/rollback every session before workflow-concurrency-cleanup.sql.
-- Before starting B, confirm the held gate in a third read-only session:
-- select count(*) as held_gate from pg_locks l join pg_stat_activity a on a.pid=l.pid
-- where l.locktype='advisory' and l.classid=20261014 and l.objid=1 and l.granted
-- and a.state='active' and lower(coalesce(a.wait_event,''))='pgsleep';
-- Require held_gate=1. UI Running alone does not prove backend execution order.

-- SESSION 1A: decision commits before replacement
begin;
select set_config('workflow.target',(select id::text from public.requests where submitted_class_id='f15f0000-0000-4000-8000-000000000011' and title='Workflow concurrency: decision-first'),true);
select set_config('request.jwt.claim.sub','f15f0000-0000-4000-8000-000000000003',true);
set local role authenticated;
select pg_advisory_xact_lock(20261014,1);
select public.decide_request(current_setting('workflow.target')::uuid,'APPROVED','Concurrent decision before replacement');
select pg_sleep(30);
reset role;
commit;

-- SESSION 1B: replacement waits, keeps the completed original HOD
begin;
select set_config('request.jwt.claim.sub','f15f0000-0000-4000-8000-000000000005',true);
set local role authenticated;
do $$ begin
 if public.admin_assign_responsibility('HOD','f15f0000-0000-4000-8000-000000000010','f15f0000-0000-4000-8000-000000000004','Concurrent replacement after decision')<>1 then raise exception 'Expected one unfinished transfer'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.requests r join public.approval_steps s on s.request_id=r.id where r.submitted_class_id='f15f0000-0000-4000-8000-000000000011' and r.title='Workflow concurrency: decision-first' and r.status='APPROVED' and s.responsibility='HOD' and s.status='APPROVED' and s.approver_id='f15f0000-0000-4000-8000-000000000003') then raise exception 'Completed HOD decision changed'; end if;
end $$;
select 'PASS: decision-first preserved' as result,round(extract(epoch from clock_timestamp()-transaction_timestamp())::numeric,2) as waited_seconds;
commit;

-- SESSION 2A: replacement commits before the stale reviewer decision
begin;
select set_config('request.jwt.claim.sub','f15f0000-0000-4000-8000-000000000005',true);
set local role authenticated;
select public.admin_assign_responsibility('HOD','f15f0000-0000-4000-8000-000000000010','f15f0000-0000-4000-8000-000000000003','Concurrent replacement before stale decision');
select pg_sleep(30);
reset role;
commit;

-- SESSION 2B: stale HOD waits, then is denied
begin;
select set_config('workflow.target',(select id::text from public.requests where submitted_class_id='f15f0000-0000-4000-8000-000000000011' and title='Workflow concurrency: replacement-first'),true);
select set_config('request.jwt.claim.sub','f15f0000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin
 begin
  perform public.decide_request(current_setting('workflow.target')::uuid,'APPROVED','Stale concurrent HOD decision');
  raise exception 'Stale HOD decision was incorrectly accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.requests r join public.approval_steps s on s.request_id=r.id where r.submitted_class_id='f15f0000-0000-4000-8000-000000000011' and r.title='Workflow concurrency: replacement-first' and r.status='IN_REVIEW' and s.responsibility='HOD' and s.status='PENDING' and s.approver_id='f15f0000-0000-4000-8000-000000000003') then raise exception 'Replacement-first state incorrect'; end if;
end $$;
select 'PASS: stale reviewer denied after transfer' as result,round(extract(epoch from clock_timestamp()-transaction_timestamp())::numeric,2) as waited_seconds;
commit;

-- SESSION 3A: submission commits before replacement
begin;
select set_config('request.jwt.claim.sub','f15f0000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.submit_typed_request('Workflow concurrency: submission-first','Disposable concurrency verification',(select id from public.request_types where code='leave'),'{"from_date":"2026-10-16","to_date":"2026-10-18"}');
select pg_sleep(30);
reset role;
commit;

-- SESSION 3B: replacement waits and includes the newly committed future HOD step
begin;
select set_config('request.jwt.claim.sub','f15f0000-0000-4000-8000-000000000005',true);
set local role authenticated;
do $$ begin
 if public.admin_assign_responsibility('HOD','f15f0000-0000-4000-8000-000000000010','f15f0000-0000-4000-8000-000000000004','Concurrent replacement after submission')<>2 then raise exception 'New submission was not included in transfer'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.requests r join public.approval_steps s on s.request_id=r.id where r.submitted_class_id='f15f0000-0000-4000-8000-000000000011' and r.title='Workflow concurrency: submission-first' and r.current_position=1 and s.responsibility='HOD' and s.status='PENDING' and s.approver_id='f15f0000-0000-4000-8000-000000000004') then raise exception 'Submitted future HOD not transferred'; end if;
end $$;
select 'PASS: concurrent submission included' as result,round(extract(epoch from clock_timestamp()-transaction_timestamp())::numeric,2) as waited_seconds;
commit;
