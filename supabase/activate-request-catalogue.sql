-- OWNER ONLY: run after deploying the compatible typed-request frontend.
-- This does not configure faculty assignments; missing assignments block submission.
begin;
do $$ begin
 if to_regprocedure('public.submit_typed_request(text,text,uuid,jsonb)') is null then
  raise exception 'Apply the request-workflow migration first.';
 end if;
end $$;
update public.request_types set active=true where code in ('leave','duty_leave','event','facility','internship');
select code,name,active from public.request_types order by code;
commit;
