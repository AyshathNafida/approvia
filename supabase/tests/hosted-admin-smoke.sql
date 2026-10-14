-- Owner-side DEVELOPMENT check after both migrations.
-- All synthetic Auth identities, profiles, configuration, requests and audits
-- roll back. No passwords/tokens are created and no emails are sent.
-- This checks hosted RPC/RLS, not password login or concurrent sessions.
begin;
select set_config('approvia.smoke_admin',gen_random_uuid()::text,true);
select set_config('approvia.smoke_student',gen_random_uuid()::text,true);
select set_config('approvia.smoke_old',gen_random_uuid()::text,true);
select set_config('approvia.smoke_new',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at)
select current_setting(key)::uuid,current_setting(key)||'@example.invalid',now()
from unnest(array['approvia.smoke_admin','approvia.smoke_student','approvia.smoke_old','approvia.smoke_new']) as keys(key);
insert into public.profiles(id,full_name,account_type)
values (current_setting('approvia.smoke_admin')::uuid,'Synthetic Smoke Admin','ADMIN');
select set_config('request.jwt.claim.sub',current_setting('approvia.smoke_admin'),true);
set local role authenticated;
select public.admin_provision_profile(current_setting('approvia.smoke_old')||'@example.invalid','Synthetic Original Tutor','FACULTY',null);
select public.admin_provision_profile(current_setting('approvia.smoke_new')||'@example.invalid','Synthetic Replacement Tutor','FACULTY',null);
select set_config('approvia.smoke_department',public.admin_save_department(null,'Smoke '||current_setting('approvia.smoke_admin'),true)::text,true);
select set_config('approvia.smoke_class',public.admin_save_class(null,current_setting('approvia.smoke_department')::uuid,'Smoke class',2026,2030,true,current_setting('approvia.smoke_old')::uuid,'Initial synthetic Tutor')->>'id',true);
select public.admin_provision_profile(current_setting('approvia.smoke_student')||'@example.invalid','Synthetic Student','STUDENT',current_setting('approvia.smoke_class')::uuid);
select public.admin_assign_responsibility('HOD',current_setting('approvia.smoke_department')::uuid,current_setting('approvia.smoke_new')::uuid,'Synthetic HOD assignment');
select set_config('request.jwt.claim.sub',current_setting('approvia.smoke_student'),true);
select set_config('approvia.smoke_completed',public.submit_request('Synthetic completed request','Rolled-back hosted verification.',(select id from public.request_types where code='general'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('approvia.smoke_old'),true);
select public.decide_request(current_setting('approvia.smoke_completed')::uuid,'APPROVED','Synthetic original decision');
select set_config('request.jwt.claim.sub',current_setting('approvia.smoke_student'),true);
select set_config('approvia.smoke_pending',public.submit_request('Synthetic pending request','Rolled-back hosted verification.',(select id from public.request_types where code='general'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('approvia.smoke_admin'),true);
do $$
begin
  if public.admin_assign_responsibility('TUTOR',current_setting('approvia.smoke_class')::uuid,current_setting('approvia.smoke_new')::uuid,'Synthetic replacement check') <> 1 then raise exception 'Expected one transferred pending request'; end if;
  if exists(select 1 from public.requests) or exists(select 1 from public.request_actions) or exists(select 1 from public.request_reassignments) then raise exception 'Admin request privacy failed'; end if;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('approvia.smoke_old'),true);
do $$
begin
  if (select count(*) from public.requests) <> 1 then raise exception 'Original Tutor should retain only the completed request'; end if;
  begin
    perform public.decide_request(current_setting('approvia.smoke_pending')::uuid,'APPROVED','Old Tutor must be denied');
    raise exception 'Old Tutor unexpectedly decided a transferred request';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_setup_summary();
    raise exception 'Faculty unexpectedly used Admin operations';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('approvia.smoke_new'),true);
do $$
begin
  if (select count(*) from public.requests) <> 1 or (select count(*) from public.request_reassignments) <> 1 then raise exception 'Replacement Tutor access failed'; end if;
end;
$$;
select public.decide_request(current_setting('approvia.smoke_pending')::uuid,'APPROVED','Synthetic replacement decision');
select set_config('request.jwt.claim.sub',current_setting('approvia.smoke_student'),true);
do $$
begin
  if (select count(*) from public.request_actions where request_id=current_setting('approvia.smoke_pending')::uuid) <> 3 then raise exception 'Student reassignment/decision history failed'; end if;
  if (select count(*) from public.request_actions where request_id=current_setting('approvia.smoke_completed')::uuid) <> 2 then raise exception 'Completed history was altered'; end if;
  if not exists(select 1 from public.requests where id=current_setting('approvia.smoke_pending')::uuid and status='APPROVED') then raise exception 'Replacement decision not persisted'; end if;
  begin
    update public.profiles set account_type='ADMIN' where id=auth.uid();
    raise exception 'Direct self-promotion unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
