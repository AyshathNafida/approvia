-- Small MVP: class-resolved Tutor approval. Apply once to approvia-dev.
begin;

create schema if not exists approvia_private;
revoke all on schema approvia_private from public;
grant usage on schema approvia_private to authenticated;

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  active boolean not null default true
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) between 1 and 100),
  account_type text not null check (account_type in ('STUDENT', 'FACULTY', 'ADMIN')),
  active boolean not null default true,
  class_id uuid,
  check ((account_type = 'STUDENT' and class_id is not null) or (account_type <> 'STUDENT' and class_id is null))
);
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id),
  name text not null check (length(btrim(name)) between 1 and 100),
  tutor_id uuid references public.profiles(id),
  active boolean not null default true,
  unique (department_id, name)
);
alter table public.profiles add constraint profiles_class_id_fkey foreign key (class_id) references public.classes(id);

create table public.request_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  approval_route text[] not null default array['TUTOR']::text[],
  active boolean not null default true,
  -- Additional routes require a later approval-engine migration.
  check (approval_route = array['TUTOR']::text[])
);
insert into public.request_types (code, name) values ('general', 'General Request');

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id),
  request_type_id uuid not null references public.request_types(id),
  title text not null check (length(btrim(title)) between 1 and 140),
  description text not null check (length(btrim(description)) between 1 and 5000),
  status text not null default 'IN_REVIEW' check (status in ('IN_REVIEW', 'APPROVED', 'REJECTED')),
  student_name text not null,
  class_name text not null,
  department_name text not null,
  current_position integer not null default 1,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create table public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete restrict,
  approver_id uuid not null references public.profiles(id),
  responsibility text not null check (responsibility in ('TUTOR', 'HOD', 'DEAN', 'PRINCIPAL')),
  position integer not null check (position > 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  unique (request_id, position)
);
create table public.request_actions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete restrict,
  actor_id uuid not null references public.profiles(id),
  actor_name text not null,
  responsibility text,
  action text not null check (action in ('SUBMITTED', 'APPROVED', 'REJECTED')),
  comment text check (comment is null or length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete restrict,
  event text not null,
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now()
);
create index requests_student_idx on public.requests(student_id, created_at desc);
create index approval_steps_approver_idx on public.approval_steps(approver_id, request_id);
create index request_actions_request_idx on public.request_actions(request_id, created_at);
create index profiles_class_idx on public.profiles(class_id);
create index classes_tutor_idx on public.classes(tutor_id);

create function approvia_private.account_type() returns text language sql stable security definer set search_path = '' as $$
  select account_type from public.profiles where id = auth.uid() and active;
$$;
create function approvia_private.can_read_request(target_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests r, public.profiles p
    where r.id = target_id and p.id = auth.uid() and p.active and (
      (p.account_type = 'STUDENT' and r.student_id = p.id)
      or (p.account_type = 'FACULTY' and exists (
        select 1 from public.approval_steps s where s.request_id = r.id and s.approver_id = p.id
          and (s.position <= r.current_position or s.status <> 'PENDING')
      ))
    )
  );
$$;

create function approvia_private.audit_configuration() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(actor_id, event, entity_type, entity_id)
  values (auth.uid(), tg_op, tg_table_name, case when tg_op = 'DELETE' then old.id else new.id end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger audit_profiles after insert or update or delete on public.profiles for each row execute function approvia_private.audit_configuration();
create trigger audit_classes after insert or update or delete on public.classes for each row execute function approvia_private.audit_configuration();
create trigger audit_departments after insert or update or delete on public.departments for each row execute function approvia_private.audit_configuration();
create trigger audit_request_types after insert or update or delete on public.request_types for each row execute function approvia_private.audit_configuration();

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.departments enable row level security;
alter table public.request_types enable row level security;
alter table public.requests enable row level security;
alter table public.approval_steps enable row level security;
alter table public.request_actions enable row level security;
alter table public.audit_logs enable row level security;

create policy profile_read on public.profiles for select to authenticated
  using (id = auth.uid() or approvia_private.account_type() = 'ADMIN');
create policy configuration_classes_read on public.classes for select to authenticated
  using (approvia_private.account_type() is not null);
create policy configuration_departments_read on public.departments for select to authenticated
  using (approvia_private.account_type() is not null);
create policy request_types_read on public.request_types for select to authenticated
  using (approvia_private.account_type() is not null and active);
create policy request_read on public.requests for select to authenticated
  using (approvia_private.can_read_request(id));
create policy step_read on public.approval_steps for select to authenticated
  using (approvia_private.can_read_request(request_id));
create policy history_read on public.request_actions for select to authenticated
  using (approvia_private.can_read_request(request_id));
create policy audit_admin_read on public.audit_logs for select to authenticated
  using (approvia_private.account_type() = 'ADMIN');

-- All writes go through guarded, transactional operations; clients cannot edit roles,
-- assignment snapshots, decisions, or preserved history directly.
revoke all on public.profiles, public.classes, public.departments, public.request_types,
  public.requests, public.approval_steps, public.request_actions, public.audit_logs from anon, authenticated;
grant select on public.profiles, public.classes, public.departments, public.request_types,
  public.requests, public.approval_steps, public.request_actions, public.audit_logs to authenticated;

create function public.submit_request(p_title text, p_description text, p_request_type_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  student public.profiles;
  assigned_class public.classes;
  tutor public.profiles;
  department public.departments;
  selected_type public.request_types;
  new_id uuid;
begin
  select * into student from public.profiles where id = auth.uid() for share;
  if student.id is null or not student.active or student.account_type <> 'STUDENT' then
    raise exception 'Only active student accounts can submit requests.' using errcode = '42501';
  end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 140
    or p_description is null or length(btrim(p_description)) not between 1 and 5000 then
    raise exception 'Enter a title (up to 140 characters) and description (up to 5000 characters).';
  end if;
  select * into selected_type from public.request_types where id = p_request_type_id and active for share;
  if selected_type.id is null or selected_type.approval_route <> array['TUTOR']::text[] then
    raise exception 'This request type is unavailable.';
  end if;
  select * into assigned_class from public.classes where id = student.class_id and active for share;
  select * into department from public.departments where id = assigned_class.department_id and active for share;
  select * into tutor from public.profiles where id = assigned_class.tutor_id and active and account_type = 'FACULTY' for share;
  if assigned_class.id is null or department.id is null or tutor.id is null then
    raise exception 'Your class needs an active department and faculty Tutor before you can submit. Contact your administrator.';
  end if;
  insert into public.requests(student_id, request_type_id, title, description, student_name, class_name, department_name)
    values (student.id, selected_type.id, btrim(p_title), btrim(p_description), student.full_name, assigned_class.name, department.name)
    returning id into new_id;
  insert into public.approval_steps(request_id, approver_id, responsibility, position)
    values (new_id, tutor.id, 'TUTOR', 1);
  insert into public.request_actions(request_id, actor_id, actor_name, action)
    values (new_id, student.id, student.full_name, 'SUBMITTED');
  insert into public.audit_logs(actor_id, event, entity_type, entity_id) values
    (student.id, 'REQUEST_CREATED', 'requests', new_id),
    (student.id, 'REQUEST_SUBMITTED', 'requests', new_id);
  return new_id;
end;
$$;

create function public.decide_request(p_request_id uuid, p_decision text, p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  faculty public.profiles;
  target public.requests;
  step public.approval_steps;
begin
  select * into faculty from public.profiles where id = auth.uid() for share;
  if faculty.id is null or not faculty.active or faculty.account_type <> 'FACULTY' then
    raise exception 'Only active faculty accounts can process assigned requests.' using errcode = '42501';
  end if;
  select * into target from public.requests where id = p_request_id for update;
  select * into step from public.approval_steps where request_id = p_request_id and position = target.current_position for update;
  if target.id is null or step.id is null or step.approver_id <> faculty.id then
    raise exception 'This request is not assigned to you.' using errcode = '42501';
  end if;
  if target.status <> 'IN_REVIEW' or step.status <> 'PENDING' then
    raise exception 'This request already has a final decision. Refresh to see its status.';
  end if;
  if p_decision is null or p_decision not in ('APPROVED', 'REJECTED') then raise exception 'Choose Approve or Reject.'; end if;
  if p_comment is null or length(btrim(p_comment)) not between 1 and 2000 then
    raise exception 'A decision comment is required (up to 2000 characters).';
  end if;
  update public.approval_steps set status = p_decision where id = step.id;
  update public.requests set status = p_decision, decided_at = now() where id = target.id;
  insert into public.request_actions(request_id, actor_id, actor_name, responsibility, action, comment)
    values (target.id, faculty.id, faculty.full_name, step.responsibility, p_decision, btrim(p_comment));
  insert into public.audit_logs(actor_id, event, entity_type, entity_id)
    values (faculty.id, 'REQUEST_' || p_decision, 'requests', target.id);
end;
$$;

revoke all on function approvia_private.account_type(), approvia_private.can_read_request(uuid),
  approvia_private.audit_configuration() from public, anon, authenticated;
grant execute on function approvia_private.account_type(), approvia_private.can_read_request(uuid) to authenticated;
revoke all on function public.submit_request(text, text, uuid), public.decide_request(uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_request(text, text, uuid), public.decide_request(uuid, text, text) to authenticated;

comment on table public.requests is 'MVP General Request; only guarded RPCs may write. Approved/Rejected are final.';
comment on table public.approval_steps is 'Submission-time assignment snapshot; responsibility is separate from account type.';
comment on table public.audit_logs is 'Administrative metadata only. Never store request contents, documents, or comment bodies here.';
notify pgrst, 'reload schema';
commit;
