-- OWNER ONLY, approvia-dev. Disposable synthetic identities; ALL rows roll back.
-- Exercises actual authenticated-role RLS, not password login.
begin;
update public.request_types set active=true where code in ('leave','duty_leave','event','facility','internship');
create temp table workflow_fixture(key text primary key,id uuid not null default gen_random_uuid());
insert into workflow_fixture(key) values('admin'),('student'),('tutor'),('hod'),('dean'),('principal'),('replacement'),('department'),('class');
insert into auth.users(id,email,email_confirmed_at)
 select id,'workflow-'||id||'@example.invalid',now() from workflow_fixture where key not in ('department','class');
insert into public.profiles(id,full_name,account_type)
 select id,'Workflow fixture '||key,case when key='admin' then 'ADMIN' else 'FACULTY' end from workflow_fixture where key in ('admin','tutor','hod','dean','principal','replacement');
insert into public.departments(id,name) select id,'Workflow fixture '||id from workflow_fixture where key='department';
insert into public.classes(id,name,department_id,tutor_id,batch_start_year,batch_end_year)
 select c.id,'Workflow fixture',d.id,t.id,2026,2030 from workflow_fixture c,workflow_fixture d,workflow_fixture t where c.key='class' and d.key='department' and t.key='tutor';
insert into public.profiles(id,full_name,account_type,class_id)
 select s.id,'Workflow fixture Student','STUDENT',c.id from workflow_fixture s,workflow_fixture c where s.key='student' and c.key='class';
grant select on workflow_fixture to authenticated;

do $$
declare student_id uuid; admin_id uuid; tutor_id uuid; hod_id uuid; dean_id uuid; principal_id uuid; replacement_id uuid; department_id uuid;
 completed uuid; pending uuid; college_event uuid; rejected uuid; transferred integer; role_name text; faculty_id uuid; target uuid;
begin
 select id into student_id from workflow_fixture where key='student'; select id into admin_id from workflow_fixture where key='admin';
 select id into tutor_id from workflow_fixture where key='tutor'; select id into hod_id from workflow_fixture where key='hod';
 select id into dean_id from workflow_fixture where key='dean'; select id into principal_id from workflow_fixture where key='principal';
 select id into replacement_id from workflow_fixture where key='replacement'; select id into department_id from workflow_fixture where key='department';
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.admin_assign_responsibility('HOD',department_id,hod_id,'Fixture appointment');
 -- Institution assignments are temporarily replaced inside this rollback transaction.
 perform public.admin_assign_responsibility('DEAN',null,dean_id,'Fixture appointment');
 perform public.admin_assign_responsibility('PRINCIPAL',null,principal_id,'Fixture appointment');
 perform set_config('request.jwt.claim.sub',student_id::text,true);
 completed:=public.submit_typed_request('Workflow completed fixture','Temporary rolled-back test',(select id from public.request_types where code='internship'),'{"visit_kind":"internship","organization":"Fixture","location":"Fixture","from_date":"2026-10-16","to_date":"2026-10-18"}');
 foreach faculty_id in array array[tutor_id,hod_id,dean_id,principal_id] loop
  perform set_config('request.jwt.claim.sub',faculty_id::text,true);
  perform public.decide_request(completed,'APPROVED','Fixture decision');
 end loop;
 perform set_config('request.jwt.claim.sub',student_id::text,true);
 pending:=public.submit_typed_request('Workflow pending fixture','Temporary rolled-back test',(select id from public.request_types where code='leave'),'{"from_date":"2026-10-16","to_date":"2026-10-18"}');
 college_event:=public.submit_typed_request('Workflow college-event fixture','Temporary rolled-back test',(select id from public.request_types where code='event'),'{"scope":"college","event_name":"Fixture","venue":"Fixture","start_at":"2026-10-16T09:00","end_at":"2026-10-16T12:00"}');
 perform set_config('request.jwt.claim.sub',hod_id::text,true);
 if exists(select 1 from public.requests where id=pending) then raise exception 'Future HOD received early access'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 if exists(select 1 from public.requests where id in (completed,pending,college_event)) then raise exception 'Admin request privacy failed'; end if;
 transferred:=public.admin_assign_responsibility('HOD',department_id,replacement_id,'Fixture replacement');
 if transferred<>1 then raise exception 'Expected one future HOD transfer'; end if;
 perform set_config('request.jwt.claim.sub',replacement_id::text,true);
 if not exists(select 1 from public.requests where id=completed) then raise exception 'Replacement archive access failed'; end if;
 if exists(select 1 from public.requests where id=pending) then raise exception 'Replacement future-step privacy failed'; end if;
 perform set_config('request.jwt.claim.sub',tutor_id::text,true); perform public.decide_request(pending,'APPROVED','Tutor fixture decision');
 perform set_config('request.jwt.claim.sub',hod_id::text,true);
 if exists(select 1 from public.requests where id=pending) then raise exception 'Old HOD retained transferred request access'; end if;
 begin perform public.decide_request(pending,'APPROVED','Old HOD'); raise exception 'Old HOD could decide'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',replacement_id::text,true); perform public.decide_request(pending,'APPROVED','Replacement fixture decision');
 perform set_config('request.jwt.claim.sub',dean_id::text,true); perform public.decide_request(college_event,'REJECTED','Fixture rejection');
 perform set_config('request.jwt.claim.sub',principal_id::text,true);
 if exists(select 1 from public.requests where id=college_event) then raise exception 'Skipped Principal received access'; end if;
 perform set_config('request.jwt.claim.sub',student_id::text,true);
 if (select status from public.requests where id=pending)<>'APPROVED' then raise exception 'Sequential completion failed'; end if;
 if (select count(*) from public.request_actions where request_id=pending and action='REASSIGNED')<>1 then raise exception 'Student reassignment history failed'; end if;
 if not exists(select 1 from public.approval_steps where request_id=college_event and responsibility='PRINCIPAL' and status='SKIPPED') then raise exception 'Rejected request did not skip future step'; end if;
 if (select approver_id from public.approval_steps where request_id=completed and responsibility='HOD')<>hod_id then raise exception 'Completed decision reviewer was changed'; end if;
 execute 'reset role';
end $$;
select 'PASS: sequential completion, future-step privacy, replacement archive, old reviewer denial, rejection, Student history, Admin privacy; all fixture rows roll back' as result;
rollback;
