-- OWNER ONLY, approvia-dev, after catalogue activation. Creates five disposable
-- identities with no passwords/tokens and two Leave requests. Run cleanup after
-- the three pairs of sessions, even if a check fails. Never use real students.
begin;
do $$ begin
 if exists(select 1 from auth.users where id::text like 'f15f0000-%')
  or exists(select 1 from public.classes where id='f15f0000-0000-4000-8000-000000000011') then
  raise exception 'Concurrency fixture already exists: inspect/clean it before setup.';
 end if;
 if not exists(select 1 from public.request_types where code='leave' and active) then raise exception 'Activate the compatible catalogue first.'; end if;
end $$;
insert into auth.users(id,email,email_confirmed_at) select
 ('f15f0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'workflow-concurrency-'||n||'@example.invalid',now() from generate_series(1,5) n;
insert into public.profiles(id,full_name,account_type) values
 ('f15f0000-0000-4000-8000-000000000002','Concurrency Tutor','FACULTY'),
 ('f15f0000-0000-4000-8000-000000000003','Concurrency Original HOD','FACULTY'),
 ('f15f0000-0000-4000-8000-000000000004','Concurrency Replacement HOD','FACULTY'),
 ('f15f0000-0000-4000-8000-000000000005','Concurrency Admin','ADMIN');
insert into public.departments(id,name) values('f15f0000-0000-4000-8000-000000000010','Disposable workflow concurrency department');
insert into public.classes(id,name,department_id,tutor_id,batch_start_year,batch_end_year) values
 ('f15f0000-0000-4000-8000-000000000011','Disposable workflow concurrency class','f15f0000-0000-4000-8000-000000000010','f15f0000-0000-4000-8000-000000000002',2026,2030);
insert into public.profiles(id,full_name,account_type,class_id) values
 ('f15f0000-0000-4000-8000-000000000001','Concurrency Student','STUDENT','f15f0000-0000-4000-8000-000000000011');
do $$ declare request_id uuid; label text; begin
 perform set_config('request.jwt.claim.sub','f15f0000-0000-4000-8000-000000000005',true);
 execute 'set local role authenticated';
 perform public.admin_assign_responsibility('HOD','f15f0000-0000-4000-8000-000000000010','f15f0000-0000-4000-8000-000000000003','Disposable fixture');
 foreach label in array array['Workflow concurrency: decision-first','Workflow concurrency: replacement-first'] loop
  perform set_config('request.jwt.claim.sub','f15f0000-0000-4000-8000-000000000001',true);
  request_id:=public.submit_typed_request(label,'Disposable concurrency verification',(select id from public.request_types where code='leave'),'{"from_date":"2026-10-16","to_date":"2026-10-18"}');
  perform set_config('request.jwt.claim.sub','f15f0000-0000-4000-8000-000000000002',true);
  perform public.decide_request(request_id,'APPROVED','Fixture Tutor approval');
 end loop;
 execute 'reset role';
end $$;
select 'READY: disposable concurrency fixtures' as result;
commit;
