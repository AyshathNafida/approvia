-- Run after the migration, as the project owner. Change only the two email values.
-- This prepares profiles for existing users; it never creates or changes passwords.
begin;
do $$
declare
  student_email text := 'student@example.test';
  tutor_email text := 'tutor@example.test';
  student_id uuid;
  tutor_id uuid;
  department_id uuid;
  class_id uuid;
begin
  select id into student_id from auth.users where lower(email) = lower(student_email) and email_confirmed_at is not null;
  select id into tutor_id from auth.users where lower(email) = lower(tutor_email) and email_confirmed_at is not null;
  if student_id is null or tutor_id is null or student_id = tutor_id then
    raise exception 'Create two distinct, email-confirmed development users before preparing profiles.';
  end if;
  if exists (select 1 from public.profiles where id in (student_id, tutor_id)) then
    raise exception 'A supplied user already has a profile. Inspect existing configuration before changing it.';
  end if;
  insert into public.departments(name) values ('MVP Test Department') returning id into department_id;
  insert into public.profiles(id, full_name, account_type) values (tutor_id, 'Test Tutor', 'FACULTY');
  insert into public.classes(department_id, name, tutor_id) values (department_id, 'MVP Test Class', tutor_id) returning id into class_id;
  insert into public.profiles(id, full_name, account_type, class_id) values (student_id, 'Test Student', 'STUDENT', class_id);
end;
$$;
commit;
