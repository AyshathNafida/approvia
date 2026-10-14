-- Apply once AFTER the small MVP baseline, as the database owner.
begin;

alter table public.classes add column batch_start_year integer;
alter table public.classes add column batch_end_year integer;
alter table public.classes add constraint classes_batch_check check (
  (batch_start_year is null and batch_end_year is null) or
  (batch_start_year is not null and batch_end_year is not null and batch_start_year between 1900 and 9995 and batch_end_year = batch_start_year + 4)
);
alter table public.classes drop constraint classes_department_id_name_key;
create unique index classes_batch_identity on public.classes(department_id, lower(btrim(name)), coalesce(batch_start_year, 0));

alter table public.requests add column submitted_class_id uuid references public.classes(id);
update public.requests r set submitted_class_id = c.id
from public.profiles p join public.classes c on c.id = p.class_id
join public.departments d on d.id = c.department_id
where r.student_id = p.id and r.class_name = c.name and r.department_name = d.name;
create index requests_submitted_class_idx on public.requests(submitted_class_id, status);
alter table public.request_actions drop constraint request_actions_action_check;
alter table public.request_actions add constraint request_actions_action_check
  check (action in ('SUBMITTED', 'APPROVED', 'REJECTED', 'REASSIGNED'));

create table public.authority_assignments (
  id uuid primary key default gen_random_uuid(),
  responsibility text not null check (responsibility in ('HOD', 'DEAN', 'PRINCIPAL')),
  department_id uuid references public.departments(id),
  faculty_id uuid not null references public.profiles(id),
  check ((responsibility = 'HOD' and department_id is not null) or (responsibility <> 'HOD' and department_id is null))
);
create unique index authority_assignment_scope on public.authority_assignments(responsibility, coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid));
create table public.responsibility_changes (
  id uuid primary key default gen_random_uuid(),
  responsibility text not null check (responsibility in ('TUTOR', 'HOD', 'DEAN', 'PRINCIPAL')),
  class_id uuid references public.classes(id),
  department_id uuid references public.departments(id),
  previous_faculty_id uuid references public.profiles(id),
  faculty_id uuid references public.profiles(id),
  actor_id uuid references public.profiles(id),
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  created_at timestamptz not null default now(),
  check ((responsibility = 'TUTOR' and class_id is not null and department_id is null)
    or (responsibility = 'HOD' and department_id is not null and class_id is null)
    or (responsibility in ('DEAN', 'PRINCIPAL') and class_id is null and department_id is null))
);
-- Preserve the original assignment even if a pending step is subsequently transferred.
insert into public.responsibility_changes(responsibility, class_id, faculty_id, reason)
select 'TUTOR', id, tutor_id, 'Existing Tutor assignment at Admin migration.' from public.classes where tutor_id is not null;
create table public.request_reassignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id),
  step_id uuid not null references public.approval_steps(id),
  previous_faculty_id uuid not null references public.profiles(id),
  faculty_id uuid not null references public.profiles(id),
  actor_id uuid not null references public.profiles(id),
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.authority_assignments enable row level security;
alter table public.responsibility_changes enable row level security;
alter table public.request_reassignments enable row level security;
create policy authorities_admin_read on public.authority_assignments for select to authenticated using (approvia_private.account_type() = 'ADMIN');
create policy responsibility_changes_admin_read on public.responsibility_changes for select to authenticated using (approvia_private.account_type() = 'ADMIN');
create policy reassignment_request_read on public.request_reassignments for select to authenticated using (approvia_private.can_read_request(request_id));
revoke all on public.authority_assignments, public.responsibility_changes, public.request_reassignments from anon, authenticated;
grant select on public.authority_assignments, public.responsibility_changes, public.request_reassignments to authenticated;

-- One write gate for this small test increment. All guarded application writes
-- share it, so assignment/status changes cannot race submissions or decisions.
-- Revisit lock granularity before a high-volume production deployment.
create function approvia_private.admin_guard() returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(20261014, 1);
  if approvia_private.account_type() is distinct from 'ADMIN' then
    raise exception 'Only active Admin accounts may manage configuration.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function approvia_private.admin_guard() from public, anon, authenticated;

-- Move baseline implementations out of the API schema; only the serialized
-- wrappers below remain callable from the browser.
alter function public.submit_request(text, text, uuid) set schema approvia_private;
alter function public.decide_request(uuid, text, text) set schema approvia_private;
revoke all on function approvia_private.submit_request(text, text, uuid), approvia_private.decide_request(uuid, text, text) from public, anon, authenticated;
create function public.submit_request(p_title text, p_description text, p_request_type_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(20261014, 1);
  new_id := approvia_private.submit_request(p_title, p_description, p_request_type_id);
  update public.requests set submitted_class_id = (select class_id from public.profiles where id = auth.uid()) where id = new_id;
  return new_id;
end;
$$;
create function public.decide_request(p_request_id uuid, p_decision text, p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(20261014, 1);
  perform approvia_private.decide_request(p_request_id, p_decision, p_comment);
end;
$$;

create function public.admin_save_department(p_id uuid, p_name text, p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result_id uuid;
begin
  perform approvia_private.admin_guard();
  if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_active is null then raise exception 'Enter a department name and status.'; end if;
  if p_id is not null and not exists (select 1 from public.departments where id = p_id) then raise exception 'Department not found.'; end if;
  if not p_active and (exists (select 1 from public.classes where department_id = p_id and active)
    or exists (select 1 from public.authority_assignments where department_id = p_id)) then
    raise exception 'Deactivate dependent classes and remove the HOD assignment first.';
  end if;
  if p_id is null then
    insert into public.departments(name, active) values (btrim(p_name), p_active) returning id into result_id;
  else
    update public.departments set name = btrim(p_name), active = p_active where id = p_id returning id into result_id;
  end if;
  return result_id;
end;
$$;

create function public.admin_assign_responsibility(p_responsibility text, p_scope_id uuid, p_faculty_id uuid, p_reason text)
returns integer language plpgsql security definer set search_path = '' as $$
declare previous_id uuid; affected integer := 0; target record; actor_name text; new_name text; old_name text; change_id uuid;
begin
  perform approvia_private.admin_guard();
  if p_responsibility is null or p_responsibility not in ('TUTOR','HOD','DEAN','PRINCIPAL') then raise exception 'Choose a valid responsibility.'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 2000 then raise exception 'An assignment change reason is required (up to 2000 characters).'; end if;
  if p_faculty_id is not null and not exists (select 1 from public.profiles where id = p_faculty_id and account_type = 'FACULTY' and active) then raise exception 'Choose an active Faculty account.'; end if;
  if p_responsibility in ('DEAN','PRINCIPAL') and p_scope_id is not null then raise exception 'Institution responsibilities cannot have a class or department scope.'; end if;
  if p_responsibility = 'TUTOR' then
    if not exists (select 1 from public.classes where id = p_scope_id) then raise exception 'Class not found.'; end if;
    select tutor_id into previous_id from public.classes where id = p_scope_id;
  elsif p_responsibility = 'HOD' then
    if not exists (select 1 from public.departments where id = p_scope_id and (active or p_faculty_id is null)) then raise exception 'Choose an active department.'; end if;
    select faculty_id into previous_id from public.authority_assignments where responsibility = 'HOD' and department_id = p_scope_id;
  else
    select faculty_id into previous_id from public.authority_assignments where responsibility = p_responsibility;
  end if;
  if previous_id is not distinct from p_faculty_id then return 0; end if;
  if p_responsibility = 'TUTOR' then
    -- An unresolved legacy row could belong to this class. Fail closed instead
    -- of guessing from mutable current memberships or human-readable names.
    if exists (select 1 from public.requests where status = 'IN_REVIEW' and submitted_class_id is null) then
      raise exception 'Owner review of unresolved legacy pending request classes is required before Tutor changes.';
    end if;
    if p_faculty_id is null and exists (select 1 from public.requests where submitted_class_id = p_scope_id and status = 'IN_REVIEW') then
      raise exception 'Choose a replacement Tutor to transfer pending requests.';
    end if;
    select full_name into actor_name from public.profiles where id = auth.uid();
    select full_name into new_name from public.profiles where id = p_faculty_id;
    for target in select r.id, s.id as step_id, s.approver_id
      from public.requests r join public.approval_steps s on s.request_id = r.id and s.position = r.current_position
      where r.submitted_class_id = p_scope_id and r.status = 'IN_REVIEW' and s.status = 'PENDING' and s.responsibility = 'TUTOR'
      order by r.id for update of r, s
    loop
      if target.approver_id = p_faculty_id then continue; end if;
      select full_name into old_name from public.profiles where id = target.approver_id;
      insert into public.request_reassignments(request_id, step_id, previous_faculty_id, faculty_id, actor_id, reason)
      values (target.id, target.step_id, target.approver_id, p_faculty_id, auth.uid(), btrim(p_reason));
      update public.approval_steps set approver_id = p_faculty_id where id = target.step_id;
      insert into public.request_actions(request_id, actor_id, actor_name, responsibility, action, comment)
      values (target.id, auth.uid(), actor_name, 'TUTOR', 'REASSIGNED', left('Tutor changed from ' || old_name || ' to ' || new_name || '. ' || btrim(p_reason), 2000));
      insert into public.audit_logs(actor_id, event, entity_type, entity_id) values (auth.uid(), 'REQUEST_REASSIGNED', 'requests', target.id);
      affected := affected + 1;
    end loop;
    update public.classes set tutor_id = p_faculty_id where id = p_scope_id;
  else
    delete from public.authority_assignments where responsibility = p_responsibility and department_id is not distinct from p_scope_id;
    if p_faculty_id is not null then
      insert into public.authority_assignments(responsibility, department_id, faculty_id) values (p_responsibility, p_scope_id, p_faculty_id);
    end if;
  end if;
  insert into public.responsibility_changes(responsibility, class_id, department_id, previous_faculty_id, faculty_id, actor_id, reason)
  values (p_responsibility, case when p_responsibility = 'TUTOR' then p_scope_id end, case when p_responsibility = 'HOD' then p_scope_id end, previous_id, p_faculty_id, auth.uid(), btrim(p_reason)) returning id into change_id;
  insert into public.audit_logs(actor_id, event, entity_type, entity_id)
  values (auth.uid(), p_responsibility || '_ASSIGNMENT_CHANGED', 'responsibility_changes', change_id);
  return affected;
end;
$$;

create function public.admin_save_class(p_id uuid, p_department_id uuid, p_name text, p_batch_start_year integer, p_batch_end_year integer, p_active boolean, p_tutor_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.classes; result_id uuid; affected integer;
begin
  perform approvia_private.admin_guard();
  if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_active is null then raise exception 'Enter a class name and status.'; end if;
  if p_batch_start_year is null or p_batch_end_year is null or p_batch_start_year not between 1900 and 9995 or p_batch_end_year <> p_batch_start_year + 4 then raise exception 'Enter a four-year batch, such as 2026–2030.'; end if;
  if not exists (select 1 from public.departments where id = p_department_id and (active or not p_active)) then raise exception 'Choose an active department for an active class.'; end if;
  if p_tutor_id is null or not exists (select 1 from public.profiles where id = p_tutor_id and active and account_type = 'FACULTY') then raise exception 'Choose an active Faculty Tutor.'; end if;
  if p_id is not null then
    select * into existing from public.classes where id = p_id;
    if existing.id is null then raise exception 'Class not found.'; end if;
    if (existing.department_id <> p_department_id or (existing.batch_start_year is not null and (existing.batch_start_year <> p_batch_start_year or existing.batch_end_year <> p_batch_end_year)))
      and (exists (select 1 from public.profiles where class_id = p_id) or exists (select 1 from public.requests where submitted_class_id = p_id or submitted_class_id is null)) then
      raise exception 'Department and batch identity cannot change after memberships or request history exist.';
    end if;
  end if;
  if not p_active and (exists (select 1 from public.profiles where class_id = p_id and active)
    or exists (select 1 from public.requests where submitted_class_id = p_id and status = 'IN_REVIEW')) then raise exception 'Resolve active memberships and pending requests before deactivating this class.'; end if;
  if p_id is null then
    insert into public.classes(department_id, name, batch_start_year, batch_end_year, active) values (p_department_id, btrim(p_name), p_batch_start_year, p_batch_end_year, p_active) returning id into result_id;
  else
    update public.classes set department_id = p_department_id, name = btrim(p_name), batch_start_year = p_batch_start_year, batch_end_year = p_batch_end_year, active = p_active where id = p_id returning id into result_id;
  end if;
  affected := public.admin_assign_responsibility('TUTOR', result_id, p_tutor_id, p_reason);
  return jsonb_build_object('id', result_id, 'reassigned_count', affected);
end;
$$;

create function public.admin_provision_profile(p_email text, p_full_name text, p_account_type text, p_class_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  perform approvia_private.admin_guard();
  if p_account_type is null or p_account_type not in ('STUDENT','FACULTY') then raise exception 'Only Student or Faculty profiles can be provisioned.'; end if;
  if p_full_name is null or length(btrim(p_full_name)) not between 1 and 100 then raise exception 'Enter a full name (up to 100 characters).'; end if;
  if (select count(*) from auth.users where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null) <> 1 then raise exception 'No confirmed existing login uniquely matches this email. Create and confirm the test login first.'; end if;
  select id into user_id from auth.users where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null;
  if user_id is null then raise exception 'No confirmed existing login matches this email. Create and confirm the test login first.'; end if;
  if exists (select 1 from public.profiles where id = user_id) then raise exception 'This login already has a profile. Account types cannot be overwritten.'; end if;
  if p_account_type = 'STUDENT' and not exists (select 1 from public.classes c join public.departments d on d.id = c.department_id where c.id = p_class_id and c.active and d.active) then raise exception 'Choose an active class and department.'; end if;
  if p_account_type = 'FACULTY' and p_class_id is not null then raise exception 'Faculty profiles cannot have student class membership.'; end if;
  insert into public.profiles(id, full_name, account_type, class_id) values (user_id, btrim(p_full_name), p_account_type, p_class_id);
  return user_id;
end;
$$;

create function public.admin_update_profile(p_id uuid, p_full_name text, p_class_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare existing public.profiles;
begin
  perform approvia_private.admin_guard();
  select * into existing from public.profiles where id = p_id;
  if existing.id is null or existing.account_type = 'ADMIN' then raise exception 'Choose a Student or Faculty profile. Admin accounts cannot be edited here.'; end if;
  if p_full_name is null or length(btrim(p_full_name)) not between 1 and 100 or p_active is null then raise exception 'Enter a full name and status.'; end if;
  if existing.account_type = 'FACULTY' and p_class_id is not null then raise exception 'Faculty profiles cannot have student class membership.'; end if;
  if existing.account_type = 'STUDENT' then
    if p_class_id is null then raise exception 'Students require a class.'; end if;
    if (p_class_id is distinct from existing.class_id or (p_active and not existing.active)) and not exists (
      select 1 from public.classes c join public.departments d on d.id = c.department_id where c.id = p_class_id and c.active and d.active
    ) then raise exception 'Choose an active class and department.'; end if;
    if (p_class_id is distinct from existing.class_id or not p_active) and exists (select 1 from public.requests where student_id = p_id and status = 'IN_REVIEW') then raise exception 'Resolve the student pending requests before moving or deactivating this account.'; end if;
  elsif not p_active then
    if exists (select 1 from public.classes where tutor_id = p_id) or exists (select 1 from public.authority_assignments where faculty_id = p_id)
      or exists (select 1 from public.approval_steps s join public.requests r on r.id = s.request_id where s.approver_id = p_id and s.status = 'PENDING' and r.status = 'IN_REVIEW') then
      raise exception 'Remove or replace faculty assignments and pending reviews before deactivation.';
    end if;
  end if;
  update public.profiles set full_name = btrim(p_full_name), class_id = p_class_id, active = p_active where id = p_id;
end;
$$;

create function public.admin_setup_summary() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform approvia_private.admin_guard();
  return jsonb_build_object('unresolved_pending_classes', (select count(*) from public.requests where status = 'IN_REVIEW' and submitted_class_id is null));
end;
$$;

-- Explicit function privileges: no default PUBLIC execution, no new table writes.
revoke all on function public.submit_request(text,text,uuid), public.decide_request(uuid,text,text),
  public.admin_save_department(uuid,text,boolean), public.admin_assign_responsibility(text,uuid,uuid,text),
  public.admin_save_class(uuid,uuid,text,integer,integer,boolean,uuid,text), public.admin_provision_profile(text,text,text,uuid),
  public.admin_update_profile(uuid,text,uuid,boolean), public.admin_setup_summary() from public, anon, authenticated;
grant execute on function public.submit_request(text,text,uuid), public.decide_request(uuid,text,text),
  public.admin_save_department(uuid,text,boolean), public.admin_assign_responsibility(text,uuid,uuid,text),
  public.admin_save_class(uuid,uuid,text,integer,integer,boolean,uuid,text), public.admin_provision_profile(text,text,text,uuid),
  public.admin_update_profile(uuid,text,uuid,boolean), public.admin_setup_summary() to authenticated;
comment on table public.responsibility_changes is 'Append-only assignment metadata; browser clients have no writes.';
comment on table public.request_reassignments is 'Preserves previous/current reviewers; follows request visibility, not Admin visibility.';
notify pgrst, 'reload schema';
commit;
