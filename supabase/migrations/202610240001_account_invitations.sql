-- Apply once after D15. Owner controls both switches; neither is enabled here.
begin;

create table approvia_private.account_settings (
 singleton boolean primary key default true check(singleton),
 email_enabled boolean not null default false,
 college_only boolean not null default false
);
insert into approvia_private.account_settings default values;
alter table public.profiles add column onboarding_complete boolean not null default false;
alter table public.profiles add column legacy_access boolean not null default false;
update public.profiles set onboarding_complete=true,legacy_access=true;

create function approvia_private.college_email(value text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(lower(btrim(value)) ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@lbscek[.]ac[.]in$',false);
$$;
create function approvia_private.eligible(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join auth.users u on u.id=p.id
 cross join approvia_private.account_settings s
 where p.id=target and p.active and p.onboarding_complete and u.email_confirmed_at is not null
 and (approvia_private.college_email(u.email) or (not s.college_only and p.legacy_access)));
$$;
create or replace function approvia_private.account_type() returns text
language sql stable security definer set search_path='' as $$
 select account_type from public.profiles where id=auth.uid() and approvia_private.eligible(id);
$$;
drop policy profile_read on public.profiles;
create policy profile_read on public.profiles for select to authenticated
 using ((id=auth.uid() and approvia_private.eligible(id)) or approvia_private.account_type()='ADMIN');

-- Preserve D15's privacy implementation, adding the same eligibility gate.
alter function approvia_private.can_read_request(uuid) rename to can_read_request_d15;
create function approvia_private.can_read_request(target_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select approvia_private.eligible(auth.uid()) and approvia_private.can_read_request_d15(target_id);
$$;
-- Policies depend on the original function OID, so explicitly rebind them.
alter policy request_read on public.requests using (approvia_private.can_read_request(id));
alter policy step_read on public.approval_steps using (approvia_private.can_read_request(request_id));
alter policy history_read on public.request_actions using (approvia_private.can_read_request(request_id));
alter policy reassignment_request_read on public.request_reassignments using (approvia_private.can_read_request(request_id));

-- D15 implementations remain private; API wrappers recheck current Auth state.
alter function public.submit_typed_request(text,text,uuid,jsonb) set schema approvia_private;
create function public.submit_typed_request(p_title text,p_description text,p_request_type_id uuid,p_fields jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(20261014,1);
 if approvia_private.account_type() is distinct from 'STUDENT' then raise exception 'An active, onboarded student account with an eligible verified email is required.' using errcode='42501'; end if;
 result_id:=approvia_private.submit_typed_request(p_title,p_description,p_request_type_id,p_fields);
 if exists(select 1 from public.approval_steps where request_id=result_id and not approvia_private.eligible(approver_id)) then
  raise exception 'Each reviewer needs an active, onboarded Faculty account with an eligible verified email.';
 end if;
 return result_id;
end; $$;
-- General submission already delegates to public.submit_typed_request in D15.
alter function public.decide_request(uuid,text,text) rename to decide_request_d15;
alter function public.decide_request_d15(uuid,text,text) set schema approvia_private;
create function public.decide_request(p_request_id uuid,p_decision text,p_comment text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(20261014,1);
 if approvia_private.account_type() is distinct from 'FACULTY' then raise exception 'An active, onboarded Faculty account with an eligible verified email is required.' using errcode='42501'; end if;
 perform approvia_private.decide_request_d15(p_request_id,p_decision,p_comment);
end; $$;
alter function public.admin_assign_responsibility(text,uuid,uuid,text) set schema approvia_private;
create function public.admin_assign_responsibility(p_responsibility text,p_scope_id uuid,p_faculty_id uuid,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
begin
 perform approvia_private.admin_guard();
 if p_faculty_id is not null and not approvia_private.eligible(p_faculty_id) then raise exception 'Choose an active, onboarded Faculty account with an eligible verified email.'; end if;
 return approvia_private.admin_assign_responsibility(p_responsibility,p_scope_id,p_faculty_id,p_reason);
end; $$;
create or replace function public.admin_provision_profile(p_email text,p_full_name text,p_account_type text,p_class_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform approvia_private.admin_guard();
 raise exception 'Use Invite account. Existing logins cannot bypass invitation onboarding.';
end; $$;

create table public.account_invitations (
 id uuid primary key default gen_random_uuid(),
 email text not null unique check(email=lower(btrim(email)) and approvia_private.college_email(email)),
 full_name text not null check(length(btrim(full_name)) between 1 and 100),
 account_type text not null check(account_type in ('STUDENT','FACULTY')),
 class_id uuid references public.classes(id),
 user_id uuid unique references auth.users(id),
 invited_by uuid not null references public.profiles(id),
 status text not null check(status in ('sending','sent','failed','complete')),
 claim uuid not null default gen_random_uuid(),
 lease_until timestamptz not null default now()+interval '2 minutes',
 last_attempt_at timestamptz not null default now(),
 sent_at timestamptz,
 completed_at timestamptz,
 error_code text check(error_code in ('delivery_failed')),
 created_at timestamptz not null default now(),
 check((account_type='STUDENT' and class_id is not null) or (account_type='FACULTY' and class_id is null))
);
alter table public.account_invitations enable row level security;
revoke all on public.account_invitations from public,anon,authenticated;
grant select(id,email,full_name,account_type,class_id,status,sent_at,completed_at,error_code,created_at) on public.account_invitations to authenticated;
create policy invitations_admin_read on public.account_invitations for select to authenticated using(approvia_private.account_type()='ADMIN');

create table approvia_private.email_migrations (
 user_id uuid primary key references public.profiles(id),
 college_email text not null unique check(college_email=lower(btrim(college_email)) and approvia_private.college_email(college_email)),
 approved_at timestamptz not null default now(),
 completed_at timestamptz
);
create function approvia_private.validate_email_mapping() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(20261014,1);
 if exists(select 1 from auth.users where lower(email)=new.college_email and id<>new.user_id) then raise exception 'Destination email belongs to another identity.'; end if;
 if exists(select 1 from public.account_invitations where email=new.college_email and user_id is distinct from new.user_id) then raise exception 'Destination email is reserved by an invitation.'; end if;
 insert into public.audit_logs(actor_id,event,entity_type,entity_id) values(null,'EMAIL_MIGRATION_APPROVED','profiles',new.user_id);
 return new;
end; $$;
create trigger validate_email_mapping before insert or update of college_email on approvia_private.email_migrations for each row execute function approvia_private.validate_email_mapping();

-- Bind a newly-created Auth identity inside Auth's own transaction, before its
-- invitation email can be delivered. Never adopt an unrelated existing login.
create function approvia_private.bind_invitation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.account_invitations set user_id=new.id where email=lower(new.email) and status='sending' and user_id is null;
 return new;
end; $$;
create trigger approvia_bind_invitation after insert on auth.users for each row execute function approvia_private.bind_invitation();

create function public.admin_reserve_invitation(p_email text,p_full_name text,p_account_type text,p_class_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation public.account_invitations; normalized text:=lower(btrim(p_email));
begin
 perform approvia_private.admin_guard();
 if not (select email_enabled from approvia_private.account_settings) then raise exception 'Email invitations are disabled until SMTP setup is verified.'; end if;
 if not approvia_private.college_email(normalized) then raise exception 'Use an @lbscek.ac.in college email address.'; end if;
 if exists(select 1 from approvia_private.email_migrations where college_email=normalized) then raise exception 'This address is reserved for an existing account migration.'; end if;
 if p_full_name is null or length(btrim(p_full_name)) not between 1 and 100 or p_account_type is null or p_account_type not in ('STUDENT','FACULTY') then raise exception 'Enter a name and Student or Faculty account type.'; end if;
 if p_account_type='STUDENT' and not exists(select 1 from public.classes c join public.departments d on d.id=c.department_id where c.id=p_class_id and c.active and d.active) then raise exception 'Choose an active class and department.'; end if;
 if p_account_type='FACULTY' and p_class_id is not null then raise exception 'Faculty cannot have Student class membership.'; end if;
 select * into invitation from public.account_invitations where email=normalized for update;
 if invitation.id is not null then
  if invitation.status='complete' or exists(select 1 from public.profiles where id=invitation.user_id) then raise exception 'This account already exists.'; end if;
  if invitation.account_type<>p_account_type or invitation.full_name<>btrim(p_full_name) or invitation.class_id is distinct from p_class_id then raise exception 'An invitation already exists with different account details. Retry its original details.'; end if;
  if (invitation.status='sending' and invitation.lease_until>now()) or invitation.last_attempt_at>now()-interval '60 seconds' then raise exception 'An invitation is already in progress. Wait before retrying.'; end if;
  update public.account_invitations set status='sending',claim=gen_random_uuid(),lease_until=now()+interval '2 minutes',last_attempt_at=now(),error_code=null where id=invitation.id returning * into invitation;
 else
  if exists(select 1 from auth.users where lower(email)=normalized) then raise exception 'This login already exists. Ask the owner to review it; no account was overwritten.'; end if;
  insert into public.account_invitations(email,full_name,account_type,class_id,invited_by,status) values(normalized,btrim(p_full_name),p_account_type,p_class_id,auth.uid(),'sending') returning * into invitation;
 end if;
 insert into public.audit_logs(actor_id,event,entity_type,entity_id) values(auth.uid(),'INVITATION_RESERVED','account_invitations',invitation.id);
 return jsonb_build_object('id',invitation.id,'email',invitation.email,'user_id',invitation.user_id,'claim',invitation.claim);
end; $$;

-- Service-only operations. Caller identities are verified by the Edge Function;
-- these functions are never executable by a browser, even an Admin browser.
create function public.account_delivery_result(p_id uuid,p_claim uuid,p_success boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(20261014,1);
 update public.account_invitations set status=case when p_success then 'sent' else 'failed' end,
 sent_at=case when p_success then now() else sent_at end,error_code=case when p_success then null else 'delivery_failed' end
 where id=p_id and claim=p_claim and status='sending';
 if found then insert into public.audit_logs(actor_id,event,entity_type,entity_id) values(null,case when p_success then 'INVITATION_SENT' else 'INVITATION_FAILED' end,'account_invitations',p_id); end if;
end; $$;
create function public.account_onboarding_target(p_user_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 select i.id into result from public.account_invitations i join auth.users u on u.id=i.user_id
 where i.user_id=p_user_id and i.status<>'complete' and u.email_confirmed_at is not null and lower(u.email)=i.email and approvia_private.college_email(u.email);
 if result is null then raise exception 'No verified pending invitation matches this account.'; end if;
 return result;
end; $$;
create function public.account_complete_onboarding(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare invitation public.account_invitations;
begin
 perform pg_catalog.pg_advisory_xact_lock(20261014,1);
 perform public.account_onboarding_target(p_user_id);
 select * into invitation from public.account_invitations where user_id=p_user_id for update;
 if exists(select 1 from public.profiles where id=p_user_id) then raise exception 'This account already has a profile; no changes were made.'; end if;
 if invitation.account_type='STUDENT' and not exists(select 1 from public.classes c join public.departments d on d.id=c.department_id where c.id=invitation.class_id and c.active and d.active) then raise exception 'The invited class is unavailable. Contact your administrator.'; end if;
 insert into public.profiles(id,full_name,account_type,class_id,onboarding_complete) values(p_user_id,invitation.full_name,invitation.account_type,invitation.class_id,true);
 update public.account_invitations set status='complete',completed_at=now(),error_code=null where id=invitation.id;
 insert into public.audit_logs(actor_id,event,entity_type,entity_id) values(p_user_id,'ONBOARDING_COMPLETED','account_invitations',invitation.id);
end; $$;

create function public.account_access_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('allowed',approvia_private.eligible(auth.uid()),'email_enabled',s.email_enabled,'college_only',s.college_only,
 'pending_invitation',exists(select 1 from public.account_invitations where user_id=auth.uid() and status<>'complete'),
 'migration_email',(select college_email from approvia_private.email_migrations where user_id=auth.uid()),
 'needs_migration',exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=auth.uid() and not approvia_private.college_email(u.email)))
 from approvia_private.account_settings s;
$$;
create function public.account_email_settings() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('email_enabled',email_enabled) from approvia_private.account_settings;
$$;
create function public.admin_eligible_faculty() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform approvia_private.admin_guard();
 return coalesce((select jsonb_agg(id) from public.profiles where account_type='FACULTY' and approvia_private.eligible(id)),'[]'::jsonb);
end; $$;
create function public.account_migration_target(p_user_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare target text;
begin
 if not (select email_enabled from approvia_private.account_settings) then raise exception 'Email changes are disabled until SMTP setup is verified.'; end if;
 select m.college_email into target from approvia_private.email_migrations m join public.profiles p on p.id=m.user_id where m.user_id=p_user_id and p.active;
 if target is null then raise exception 'Ask the owner to approve your college email mapping first.'; end if;
 if exists(select 1 from auth.users where lower(email)=target and id<>p_user_id) then raise exception 'Destination email belongs to another identity.'; end if;
 insert into public.audit_logs(actor_id,event,entity_type,entity_id) values(p_user_id,'EMAIL_MIGRATION_REQUESTED','profiles',p_user_id);
 return target;
end; $$;
-- Prevent changing away from the institution, or switching to an unapproved
-- college identity through the direct Auth API. Confirmation still belongs to Auth.
create function approvia_private.guard_account_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(20261014,1);
 if new.email_change is distinct from old.email_change and nullif(new.email_change,'') is not null and exists(select 1 from public.profiles where id=new.id) then
  if not (select email_enabled from approvia_private.account_settings) or not approvia_private.college_email(new.email_change) or not exists(select 1 from approvia_private.email_migrations where user_id=new.id and college_email=lower(new.email_change)) then raise exception 'An owner-approved college email mapping and enabled email service are required.'; end if;
 end if;
 if new.email is distinct from old.email and exists(select 1 from public.profiles where id=new.id) then
  if not approvia_private.college_email(new.email) or not exists(select 1 from approvia_private.email_migrations where user_id=new.id and college_email=lower(new.email)) then raise exception 'An owner-approved college email mapping is required.'; end if;
 end if;
 return new;
end; $$;
create trigger approvia_guard_account_email before update of email,email_change on auth.users for each row execute function approvia_private.guard_account_email();
create function approvia_private.audit_account_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email is distinct from old.email or new.email_confirmed_at is distinct from old.email_confirmed_at then
  update approvia_private.email_migrations set completed_at=now() where user_id=new.id and college_email=lower(new.email) and new.email_confirmed_at is not null and completed_at is null;
  if found then insert into public.audit_logs(actor_id,event,entity_type,entity_id) values(new.id,'COLLEGE_EMAIL_VERIFIED','profiles',new.id); end if;
 end if;
 return new;
end; $$;
create trigger approvia_audit_account_email after update of email,email_confirmed_at on auth.users for each row execute function approvia_private.audit_account_email();

-- Default function execution is PUBLIC in PostgreSQL: revoke explicitly.
revoke all on all functions in schema approvia_private from public,anon,authenticated;
grant execute on function approvia_private.account_type(),approvia_private.can_read_request(uuid),approvia_private.eligible(uuid) to authenticated;
revoke all on function public.admin_eligible_faculty(),public.admin_reserve_invitation(text,text,text,uuid),public.account_delivery_result(uuid,uuid,boolean),public.account_onboarding_target(uuid),public.account_complete_onboarding(uuid),public.account_access_status(),public.account_email_settings(),public.account_migration_target(uuid),public.submit_typed_request(text,text,uuid,jsonb),public.decide_request(uuid,text,text),public.admin_assign_responsibility(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_eligible_faculty(),public.admin_reserve_invitation(text,text,text,uuid),public.account_access_status(),public.submit_typed_request(text,text,uuid,jsonb),public.decide_request(uuid,text,text),public.admin_assign_responsibility(text,uuid,uuid,text) to authenticated;
grant execute on function public.account_delivery_result(uuid,uuid,boolean),public.account_onboarding_target(uuid),public.account_complete_onboarding(uuid),public.account_email_settings(),public.account_migration_target(uuid) to service_role;
notify pgrst,'reload schema';
commit;
