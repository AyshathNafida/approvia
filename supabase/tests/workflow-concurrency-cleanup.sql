-- OWNER ONLY. Deletes ONLY the fixture created by workflow-concurrency-setup.sql.
-- Roll back/finish outstanding A/B sessions first. Refuses unrelated membership
-- or reviewer relationships. Never adapt this into broad prefix-based deletion.
begin;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if exists(select 1 from auth.users where id in (
 'f15f0000-0000-4000-8000-000000000001','f15f0000-0000-4000-8000-000000000002','f15f0000-0000-4000-8000-000000000003','f15f0000-0000-4000-8000-000000000004','f15f0000-0000-4000-8000-000000000005')
 and email not like 'workflow-concurrency-%@example.invalid') then raise exception 'Unexpected Auth identity: refuse cleanup'; end if;
 if exists(select 1 from public.profiles where class_id='f15f0000-0000-4000-8000-000000000011' and id<>'f15f0000-0000-4000-8000-000000000001') then raise exception 'Unexpected membership: refuse cleanup'; end if;
 if exists(select 1 from public.requests where submitted_class_id='f15f0000-0000-4000-8000-000000000011' and student_id<>'f15f0000-0000-4000-8000-000000000001') then raise exception 'Unexpected request owner: refuse cleanup'; end if;
 if exists(select 1 from public.approval_steps s join public.requests r on r.id=s.request_id where s.approver_id in ('f15f0000-0000-4000-8000-000000000002','f15f0000-0000-4000-8000-000000000003','f15f0000-0000-4000-8000-000000000004') and r.submitted_class_id is distinct from 'f15f0000-0000-4000-8000-000000000011'::uuid) then raise exception 'Unexpected review relationship: refuse cleanup'; end if;
end $$;
delete from public.request_reassignments where request_id in (select id from public.requests where submitted_class_id='f15f0000-0000-4000-8000-000000000011');
delete from public.request_actions where request_id in (select id from public.requests where submitted_class_id='f15f0000-0000-4000-8000-000000000011');
delete from public.approval_steps where request_id in (select id from public.requests where submitted_class_id='f15f0000-0000-4000-8000-000000000011');
delete from public.audit_logs where actor_id in ('f15f0000-0000-4000-8000-000000000001','f15f0000-0000-4000-8000-000000000002','f15f0000-0000-4000-8000-000000000003','f15f0000-0000-4000-8000-000000000004','f15f0000-0000-4000-8000-000000000005')
 or entity_id in ('f15f0000-0000-4000-8000-000000000001','f15f0000-0000-4000-8000-000000000002','f15f0000-0000-4000-8000-000000000003','f15f0000-0000-4000-8000-000000000004','f15f0000-0000-4000-8000-000000000005','f15f0000-0000-4000-8000-000000000010','f15f0000-0000-4000-8000-000000000011');
delete from public.requests where submitted_class_id='f15f0000-0000-4000-8000-000000000011';
delete from public.responsibility_changes where class_id='f15f0000-0000-4000-8000-000000000011' or department_id='f15f0000-0000-4000-8000-000000000010';
delete from public.authority_assignments where department_id='f15f0000-0000-4000-8000-000000000010';
delete from public.profiles where id='f15f0000-0000-4000-8000-000000000001';
delete from public.classes where id='f15f0000-0000-4000-8000-000000000011';
delete from public.departments where id='f15f0000-0000-4000-8000-000000000010';
delete from public.profiles where id in ('f15f0000-0000-4000-8000-000000000002','f15f0000-0000-4000-8000-000000000003','f15f0000-0000-4000-8000-000000000004','f15f0000-0000-4000-8000-000000000005');
delete from auth.users where id in ('f15f0000-0000-4000-8000-000000000001','f15f0000-0000-4000-8000-000000000002','f15f0000-0000-4000-8000-000000000003','f15f0000-0000-4000-8000-000000000004','f15f0000-0000-4000-8000-000000000005');
-- Configuration delete triggers append metadata. Remove only those fixture IDs.
delete from public.audit_logs where entity_id in ('f15f0000-0000-4000-8000-000000000001','f15f0000-0000-4000-8000-000000000002','f15f0000-0000-4000-8000-000000000003','f15f0000-0000-4000-8000-000000000004','f15f0000-0000-4000-8000-000000000005','f15f0000-0000-4000-8000-000000000010','f15f0000-0000-4000-8000-000000000011');
select 'CLEAN: disposable workflow fixtures removed' as result;
commit;
