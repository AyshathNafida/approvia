-- OWNER ONLY, approvia-dev. Use only after reviewing original-class evidence.
-- Existing names may have been corrected; never infer scope from today's student
-- membership. Preserve a private review record and replace every placeholder.
-- Add rows only for independently reviewed final requests. All rows are atomic.
begin;
select pg_catalog.pg_advisory_xact_lock(20261014,1);
do $$ declare mapping record; reviewed_request_id uuid; reviewed_class_id uuid; reviewed_department_id uuid; affected integer:=0;
begin
 for mapping in select * from (values
  ('REPLACE_REQUEST_ID','REPLACE_ORIGINAL_CLASS_ID','REPLACE_ORIGINAL_DEPARTMENT_ID')
 ) as mappings(request_id,class_id,department_id)
 loop
  if mapping.request_id like 'REPLACE_%' or mapping.class_id like 'REPLACE_%' or mapping.department_id like 'REPLACE_%' then raise exception 'Replace placeholders only after owner evidence review.'; end if;
  reviewed_request_id:=mapping.request_id::uuid; reviewed_class_id:=mapping.class_id::uuid; reviewed_department_id:=mapping.department_id::uuid;
  if not exists(select 1 from public.requests r join public.classes c on c.id=r.submitted_class_id
   where r.id=reviewed_request_id and r.submitted_class_id=reviewed_class_id and c.department_id=reviewed_department_id
   and r.submitted_department_id is null and r.status in ('APPROVED','REJECTED')) then
   raise exception 'Reviewed final request/scope no longer matches; stop and inspect.';
  end if;
  update public.requests r set submitted_department_id=reviewed_department_id where r.id=reviewed_request_id;
  insert into public.audit_logs(actor_id,event,entity_type,entity_id) values(null,'LEGACY_DEPARTMENT_SCOPE_REVIEWED','requests',reviewed_request_id);
  affected:=affected+1;
 end loop;
 raise notice 'Mapped % owner-reviewed final request department scopes.',affected;
end $$;
select 'PASS: owner-reviewed department mapping; request details and decisions unchanged' as result;
commit;
