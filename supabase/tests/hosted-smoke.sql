-- Development-only owner verification. All synthetic request data rolls back.
-- Run after schema and test profile setup. Replace the two placeholder emails.
begin;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'student@example.test'), true);
set local role authenticated;
select set_config('approvia.smoke_request_id', public.submit_request(
  'MVP smoke check', 'Temporary request used to verify the live database transaction.',
  (select id from public.request_types where code = 'general')
)::text, true);
select 'student_submission' as check_name, status, (select count(*) from public.request_actions where request_id = r.id) as history_events
from public.requests r where id = current_setting('approvia.smoke_request_id')::uuid;
reset role;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'tutor@example.test'), true);
set local role authenticated;
select public.decide_request(current_setting('approvia.smoke_request_id')::uuid, 'APPROVED', 'Approved during the rolled-back MVP verification.');
select 'tutor_decision' as check_name, status from public.requests where id = current_setting('approvia.smoke_request_id')::uuid;
reset role;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'student@example.test'), true);
set local role authenticated;
select 'student_history' as check_name, action, responsibility from public.request_actions where request_id = current_setting('approvia.smoke_request_id')::uuid order by action;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select 'unconfigured_user_access' as check_name, count(*) as visible_requests from public.requests;
rollback;
