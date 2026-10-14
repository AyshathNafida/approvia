-- Apply once after the MVP and Admin migrations. New catalogue stays inactive
-- until the compatible frontend is deployed and the owner activates it.
begin;

alter table public.request_types drop constraint request_types_approval_route_check;
alter table public.request_types add column form_kind text not null default 'general';
alter table public.request_types add column permitted_routes jsonb not null default '[["TUTOR"]]'::jsonb;
insert into public.request_types(code,name,approval_route,form_kind,permitted_routes,active) values
 ('leave','Leave',array['TUTOR','HOD'],'leave','[["TUTOR","HOD"]]',false),
 ('duty_leave','Duty Leave / On-duty Permission',array['TUTOR','HOD','DEAN'],'duty_leave','[["TUTOR","HOD","DEAN"]]',false),
 ('event','Event Permission',array['TUTOR','HOD'],'event','[["TUTOR","HOD"],["DEAN","PRINCIPAL"]]',false),
 ('facility','Facility / Equipment Permission',array['TUTOR','HOD'],'facility','[["TUTOR","HOD"],["DEAN","PRINCIPAL"]]',false),
 ('internship','Internship / Industrial Visit Permission',array['TUTOR','HOD','DEAN','PRINCIPAL'],'internship','[["TUTOR","HOD","DEAN","PRINCIPAL"]]',false);

alter table public.requests add column submitted_department_id uuid references public.departments(id);
alter table public.requests add column type_code text;
alter table public.requests add column type_name text;
alter table public.requests add column fields jsonb not null default '{}'::jsonb;
alter table public.requests add column form_snapshot jsonb not null default '{}'::jsonb;
alter table public.requests add column route_snapshot text[];
update public.requests r set submitted_department_id=d.id from public.classes c join public.departments d on d.id=c.department_id
 where c.id=r.submitted_class_id and c.name=r.class_name and d.name=r.department_name;
update public.requests r set type_code=t.code,type_name=t.name,
 form_snapshot=jsonb_build_object('kind',t.form_kind,'version',1,'time_zone','Asia/Kolkata'),
 route_snapshot=(select array_agg(s.responsibility order by s.position) from public.approval_steps s where s.request_id=r.id)
 from public.request_types t where t.id=r.request_type_id;
alter table public.requests alter column type_code set not null;
alter table public.requests alter column type_name set not null;
alter table public.requests alter column route_snapshot set not null;
create index requests_department_scope_idx on public.requests(submitted_department_id,status);
alter table public.approval_steps drop constraint approval_steps_status_check;
alter table public.approval_steps add constraint approval_steps_status_check check(status in ('PENDING','APPROVED','REJECTED','SKIPPED'));
alter table public.approval_steps add column approver_name text;
update public.approval_steps s set approver_name=coalesce(
 (select a.actor_name from public.request_actions a where a.request_id=s.request_id and a.actor_id=s.approver_id and a.responsibility=s.responsibility and a.action=s.status order by a.created_at desc limit 1),p.full_name)
 from public.profiles p where p.id=s.approver_id;
alter table public.approval_steps alter column approver_name set not null;
alter table public.request_actions add column step_position integer;
update public.request_actions a set step_position=s.position from public.approval_steps s where s.request_id=a.request_id and s.responsibility=a.responsibility;
alter table public.request_actions add column history_order bigint;
with ordered as (select id,row_number() over(order by created_at,case action when 'SUBMITTED' then 0 when 'REASSIGNED' then 1 else 2 end,id) as n from public.request_actions)
 update public.request_actions a set history_order=o.n from ordered o where o.id=a.id;
create sequence public.request_history_sequence;
select setval('public.request_history_sequence',coalesce((select max(history_order)+1 from public.request_actions),1),false);
alter table public.request_actions alter column history_order set default nextval('public.request_history_sequence');
alter table public.request_actions alter column history_order set not null;
alter table public.request_actions alter column created_at set default clock_timestamp();
revoke all on sequence public.request_history_sequence from public,anon,authenticated;

create function approvia_private.form_definition(p_kind text) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('kind',p_kind,'version',1,'time_zone','Asia/Kolkata','fields',coalesce(jsonb_agg(jsonb_build_object('key',key,'label',label,'type',input_type,'options',options) order by position),'[]'::jsonb))
 from (values
 ('leave',1,'from_date','From date','date',null::jsonb),('leave',2,'to_date','To date','date',null::jsonb),
 ('duty_leave',1,'activity','Activity name','text',null),('duty_leave',2,'organizer','Organizer','text',null),('duty_leave',3,'from_date','From date','date',null),('duty_leave',4,'to_date','To date','date',null),
 ('event',1,'scope','Event scope','select','[["class","Class event"],["college","College event"]]'::jsonb),('event',2,'event_name','Event name','text',null),('event',3,'venue','Venue','text',null),('event',4,'start_at','Start date and time','datetime-local',null),('event',5,'end_at','End date and time','datetime-local',null),
 ('facility',1,'scope','Facility scope','select','[["department","Department"],["college","College"]]'::jsonb),('facility',2,'resource','Room or equipment requested','text',null),('facility',3,'start_at','Start date and time','datetime-local',null),('facility',4,'end_at','End date and time','datetime-local',null),
 ('internship',1,'visit_kind','Permission for','select','[["internship","Internship"],["industrial_visit","Industrial visit"]]'::jsonb),('internship',2,'organization','Organization','text',null),('internship',3,'location','Location','text',null),('internship',4,'from_date','From date','date',null),('internship',5,'to_date','To date','date',null)
 ) as fields(kind,position,key,label,input_type,options) where kind=p_kind;
$$;
update public.requests set form_snapshot=approvia_private.form_definition(form_snapshot->>'kind');

create function approvia_private.validate_fields(p_kind text,p_fields jsonb) returns jsonb language plpgsql set search_path='' as $$
declare keys text[]; k text; result jsonb:='{}'; start_value timestamp; end_value timestamp;
begin
 if p_fields is null or jsonb_typeof(p_fields)<>'object' then raise exception 'Enter the required request details.'; end if;
 keys:=case p_kind
 when 'general' then array[]::text[]
 when 'leave' then array['from_date','to_date']
 when 'duty_leave' then array['activity','organizer','from_date','to_date']
 when 'event' then array['scope','event_name','venue','start_at','end_at']
 when 'facility' then array['scope','resource','start_at','end_at']
 when 'internship' then array['visit_kind','organization','location','from_date','to_date']
 else null end;
 if keys is null then raise exception 'This request type is unavailable.'; end if;
 if exists(select 1 from jsonb_object_keys(p_fields) x where not(x=any(keys))) then raise exception 'Unexpected request fields.'; end if;
 foreach k in array keys loop
  if jsonb_typeof(p_fields->k) is distinct from 'string' or length(btrim(p_fields->>k)) not between 1 and 200 then raise exception 'Enter a valid value for % (up to 200 characters).',k; end if;
  result:=result||jsonb_build_object(k,btrim(p_fields->>k));
 end loop;
 if p_kind='event' and result->>'scope' not in ('class','college') or p_kind='facility' and result->>'scope' not in ('department','college') then raise exception 'Choose a valid scope.'; end if;
 if p_kind='internship' and result->>'visit_kind' not in ('internship','industrial_visit') then raise exception 'Choose Internship or Industrial Visit.'; end if;
 if p_kind in ('leave','duty_leave','internship') then
  if result->>'from_date' !~ '^\d{4}-\d{2}-\d{2}$' or result->>'to_date' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Enter valid dates.'; end if;
  start_value:=(result->>'from_date')::date; end_value:=(result->>'to_date')::date;
 elsif p_kind in ('event','facility') then
  if result->>'start_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' or result->>'end_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then raise exception 'Enter valid college-local dates and times.'; end if;
  start_value:=(result->>'start_at')::timestamp; end_value:=(result->>'end_at')::timestamp;
  if to_char(start_value,'YYYY-MM-DD"T"HH24:MI')<>result->>'start_at' or to_char(end_value,'YYYY-MM-DD"T"HH24:MI')<>result->>'end_at' then raise exception 'Enter valid college-local dates and times.'; end if;
 end if;
 if end_value<start_value then raise exception 'End date/time must not precede the start.'; end if;
 return result;
end; $$;

create function approvia_private.request_route(p_kind text,p_fields jsonb) returns text[] language sql immutable set search_path='' as $$
 select case p_kind when 'general' then array['TUTOR'] when 'leave' then array['TUTOR','HOD']
 when 'duty_leave' then array['TUTOR','HOD','DEAN'] when 'internship' then array['TUTOR','HOD','DEAN','PRINCIPAL']
 when 'event' then case when p_fields->>'scope'='college' then array['DEAN','PRINCIPAL'] else array['TUTOR','HOD'] end
 when 'facility' then case when p_fields->>'scope'='college' then array['DEAN','PRINCIPAL'] else array['TUTOR','HOD'] end end;
$$;

create function public.submit_typed_request(p_title text,p_description text,p_request_type_id uuid,p_fields jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare student public.profiles; batch public.classes; department public.departments; kind public.request_types; details jsonb; route text[]; reviewer uuid; reviewers uuid[]:=array[]::uuid[]; reviewer_name text; role_name text; new_id uuid; n integer:=0;
begin
 perform pg_catalog.pg_advisory_xact_lock(20261014,1);
 select * into student from public.profiles where id=auth.uid();
 if student.id is null or not student.active or student.account_type<>'STUDENT' then raise exception 'Only active student accounts can submit requests.' using errcode='42501'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 140 or p_description is null or length(btrim(p_description)) not between 1 and 5000 then raise exception 'Enter a title (up to 140 characters) and description (up to 5000 characters).'; end if;
 select * into kind from public.request_types where id=p_request_type_id and active;
 if kind.id is null or kind.code<>kind.form_kind then raise exception 'This request type is unavailable.'; end if;
 details:=approvia_private.validate_fields(kind.form_kind,p_fields);
 route:=approvia_private.request_route(kind.form_kind,details);
 select * into batch from public.classes where id=student.class_id and active;
 select * into department from public.departments where id=batch.department_id and active;
 if batch.id is null or department.id is null then raise exception 'Your class needs an active department before you can submit. Contact your administrator.'; end if;
 foreach role_name in array route loop
  reviewer:=null;
  if role_name='TUTOR' then reviewer:=batch.tutor_id;
  else select faculty_id into reviewer from public.authority_assignments where responsibility=role_name and department_id is not distinct from case when role_name='HOD' then department.id else null end; end if;
  if reviewer is null or not exists(select 1 from public.profiles where id=reviewer and active and account_type='FACULTY') then raise exception 'Your class needs an active faculty % assignment before you can submit. Contact your administrator.',role_name; end if;
  if reviewer=any(reviewers) then raise exception 'Each required responsibility needs a different Faculty member. Contact your administrator.'; end if;
  reviewers:=array_append(reviewers,reviewer);
 end loop;
 insert into public.requests(student_id,request_type_id,title,description,student_name,class_name,department_name,submitted_class_id,submitted_department_id,type_code,type_name,fields,form_snapshot,route_snapshot)
 values(student.id,kind.id,btrim(p_title),btrim(p_description),student.full_name,batch.name,department.name,batch.id,department.id,kind.code,kind.name,details,approvia_private.form_definition(kind.form_kind),route) returning id into new_id;
 foreach role_name in array route loop
  n:=n+1; select full_name into reviewer_name from public.profiles where id=reviewers[n];
  insert into public.approval_steps(request_id,approver_id,approver_name,responsibility,position) values(new_id,reviewers[n],reviewer_name,role_name,n);
 end loop;
 insert into public.request_actions(request_id,actor_id,actor_name,action) values(new_id,student.id,student.full_name,'SUBMITTED');
 insert into public.audit_logs(actor_id,event,entity_type,entity_id) values(auth.uid(),'REQUEST_CREATED','requests',new_id),(auth.uid(),'REQUEST_SUBMITTED','requests',new_id);
 return new_id;
end; $$;

create or replace function public.submit_request(p_title text,p_description text,p_request_type_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(20261014,1);
 if not exists(select 1 from public.request_types where id=p_request_type_id and code='general') then raise exception 'Use the updated request form for this request type.'; end if;
 return public.submit_typed_request(p_title,p_description,p_request_type_id,'{}');
end; $$;

create or replace function public.decide_request(p_request_id uuid,p_decision text,p_comment text) returns void language plpgsql security definer set search_path='' as $$
declare faculty public.profiles; target public.requests; step public.approval_steps; next_position integer;
begin
 perform pg_catalog.pg_advisory_xact_lock(20261014,1);
 select * into faculty from public.profiles where id=auth.uid();
 if faculty.id is null or not faculty.active or faculty.account_type<>'FACULTY' then raise exception 'Only active faculty accounts can process assigned requests.' using errcode='42501'; end if;
 select * into target from public.requests where id=p_request_id for update;
 select * into step from public.approval_steps where request_id=p_request_id and position=target.current_position for update;
 if target.id is null or step.id is null or step.approver_id<>faculty.id then raise exception 'This request is not assigned to you.' using errcode='42501'; end if;
 if target.status<>'IN_REVIEW' or step.status<>'PENDING' then raise exception 'This request already has a final decision. Refresh to see its status.'; end if;
 if p_decision is null or p_decision not in ('APPROVED','REJECTED') then raise exception 'Choose Approve or Reject.'; end if;
 if p_comment is null or length(btrim(p_comment)) not between 1 and 2000 then raise exception 'A decision comment is required (up to 2000 characters).'; end if;
 update public.approval_steps set status=p_decision where id=step.id;
 select min(position) into next_position from public.approval_steps where request_id=target.id and position>step.position and status='PENDING';
 if p_decision='REJECTED' then
  update public.approval_steps set status='SKIPPED' where request_id=target.id and status='PENDING';
  update public.requests set status='REJECTED',decided_at=clock_timestamp() where id=target.id;
 elsif next_position is not null then update public.requests set current_position=next_position where id=target.id;
 else update public.requests set status='APPROVED',decided_at=clock_timestamp() where id=target.id; end if;
 insert into public.request_actions(request_id,actor_id,actor_name,responsibility,step_position,action,comment) values(target.id,faculty.id,faculty.full_name,step.responsibility,step.position,p_decision,btrim(p_comment));
 insert into public.audit_logs(actor_id,event,entity_type,entity_id) values(auth.uid(),case when p_decision='REJECTED' then 'REQUEST_REJECTED' when next_position is null then 'REQUEST_APPROVED' else 'STEP_APPROVED' end,'requests',target.id);
end; $$;

create or replace function approvia_private.can_read_request(target_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.requests r join public.profiles p on p.id=auth.uid() and p.active where r.id=target_id and (
  (p.account_type='STUDENT' and r.student_id=p.id) or (p.account_type='FACULTY' and (
   exists(select 1 from public.approval_steps s where s.request_id=r.id and s.approver_id=p.id and (s.status in ('APPROVED','REJECTED') or (r.status='IN_REVIEW' and s.status='PENDING' and s.position=r.current_position)))
   or (r.status in ('APPROVED','REJECTED') and r.submitted_class_id is not null and r.submitted_department_id is not null and exists(select 1 from public.approval_steps s where s.request_id=r.id and s.status in ('APPROVED','REJECTED') and (
    (s.responsibility='TUTOR' and r.submitted_department_id is not null and exists(select 1 from public.classes c where c.id=r.submitted_class_id and c.tutor_id=p.id))
    or exists(select 1 from public.authority_assignments a where a.responsibility=s.responsibility and a.faculty_id=p.id and (a.responsibility<>'HOD' or a.department_id=r.submitted_department_id))
   )))
  ))
 ));
$$;

create or replace function public.admin_assign_responsibility(p_responsibility text,p_scope_id uuid,p_faculty_id uuid,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare previous_id uuid; affected integer:=0; target record; actor_name text; new_name text; change_id uuid;
begin
 perform approvia_private.admin_guard();
 if p_responsibility is null or p_responsibility not in ('TUTOR','HOD','DEAN','PRINCIPAL') then raise exception 'Choose a valid responsibility.'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 1 and 2000 then raise exception 'An assignment change reason is required (up to 2000 characters).'; end if;
 if p_faculty_id is not null and not exists(select 1 from public.profiles where id=p_faculty_id and account_type='FACULTY' and active) then raise exception 'Choose an active Faculty account.'; end if;
 if p_responsibility in ('DEAN','PRINCIPAL') and p_scope_id is not null then raise exception 'Institution responsibilities cannot have a class or department scope.'; end if;
 if p_responsibility='TUTOR' then
  if not exists(select 1 from public.classes where id=p_scope_id) then raise exception 'Class not found.'; end if;
  select tutor_id into previous_id from public.classes where id=p_scope_id;
 elsif p_responsibility='HOD' then
  if not exists(select 1 from public.departments where id=p_scope_id and (active or p_faculty_id is null)) then raise exception 'Choose an active department.'; end if;
  select faculty_id into previous_id from public.authority_assignments where responsibility='HOD' and department_id=p_scope_id;
 else select faculty_id into previous_id from public.authority_assignments where responsibility=p_responsibility; end if;
 if previous_id is not distinct from p_faculty_id then return 0; end if;
 if exists(select 1 from public.requests r where r.status='IN_REVIEW' and (
  (p_responsibility='TUTOR' and r.submitted_class_id is null) or
  exists(select 1 from public.approval_steps s where s.request_id=r.id and s.responsibility=p_responsibility and s.status='PENDING' and (r.submitted_class_id is null or r.submitted_department_id is null)))) then
  raise exception 'Owner review of unresolved legacy pending request classes is required before responsibility changes.';
 end if;
 select full_name into actor_name from public.profiles where id=auth.uid();
 select full_name into new_name from public.profiles where id=p_faculty_id;
 for target in select r.id,s.id as step_id,s.approver_id,s.approver_name,s.position
  from public.requests r join public.approval_steps s on s.request_id=r.id
  where r.status='IN_REVIEW' and s.status='PENDING' and s.responsibility=p_responsibility
   and (case p_responsibility when 'TUTOR' then r.submitted_class_id=p_scope_id when 'HOD' then r.submitted_department_id=p_scope_id else true end)
  order by r.id,s.position for update of r,s
 loop
  if p_faculty_id is null then raise exception 'Choose a replacement % to transfer pending requests.',p_responsibility; end if;
  if target.approver_id=p_faculty_id then continue; end if;
  if exists(select 1 from public.approval_steps where request_id=target.id and id<>target.step_id and approver_id=p_faculty_id) then raise exception 'Replacement would assign the same Faculty member to multiple required roles. Choose a different Faculty account.'; end if;
  insert into public.request_reassignments(request_id,step_id,previous_faculty_id,faculty_id,actor_id,reason) values(target.id,target.step_id,target.approver_id,p_faculty_id,auth.uid(),btrim(p_reason));
  update public.approval_steps set approver_id=p_faculty_id,approver_name=new_name where id=target.step_id;
  insert into public.request_actions(request_id,actor_id,actor_name,responsibility,step_position,action,comment)
   values(target.id,auth.uid(),actor_name,p_responsibility,target.position,'REASSIGNED',left(p_responsibility||' changed from '||target.approver_name||' to '||new_name||'. '||btrim(p_reason),2000));
  insert into public.audit_logs(actor_id,event,entity_type,entity_id) values(auth.uid(),'REQUEST_REASSIGNED','requests',target.id);
  affected:=affected+1;
 end loop;
 if p_responsibility='TUTOR' then update public.classes set tutor_id=p_faculty_id where id=p_scope_id;
 else
  delete from public.authority_assignments where responsibility=p_responsibility and department_id is not distinct from p_scope_id;
  if p_faculty_id is not null then insert into public.authority_assignments(responsibility,department_id,faculty_id) values(p_responsibility,p_scope_id,p_faculty_id); end if;
 end if;
 insert into public.responsibility_changes(responsibility,class_id,department_id,previous_faculty_id,faculty_id,actor_id,reason)
 values(p_responsibility,case when p_responsibility='TUTOR' then p_scope_id end,case when p_responsibility='HOD' then p_scope_id end,previous_id,p_faculty_id,auth.uid(),btrim(p_reason)) returning id into change_id;
 insert into public.audit_logs(actor_id,event,entity_type,entity_id) values(auth.uid(),p_responsibility||'_ASSIGNMENT_CHANGED','responsibility_changes',change_id);
 return affected;
end; $$;

revoke all on function approvia_private.validate_fields(text,jsonb),approvia_private.request_route(text,jsonb),approvia_private.form_definition(text) from public,anon,authenticated;
revoke all on function public.submit_typed_request(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.submit_typed_request(text,text,uuid,jsonb) to authenticated;
comment on table public.requests is 'Immutable typed request and route snapshots; guarded sequential decisions; final-scope archive access.';
notify pgrst,'reload schema';
commit;
