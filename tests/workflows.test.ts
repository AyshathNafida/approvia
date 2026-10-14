import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

let db: PGlite
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const users = { student: id(1), tutor: id(2), hod: id(3), dean: id(4), principal: id(5), replacement: id(6), admin: id(7), other: id(8) }
const department = id(10), batch = id(11)
const dates = { from_date: '2026-10-16', to_date: '2026-10-18' }
const times = { start_at: '2026-10-16T09:00', end_at: '2026-10-16T12:00' }
const catalogue = [
  ['general', {}, ['TUTOR']], ['leave', dates, ['TUTOR','HOD']],
  ['duty_leave', { ...dates, activity: 'Sports', organizer: 'College' }, ['TUTOR','HOD','DEAN']],
  ['event', { ...times, scope: 'class', event_name: 'Seminar', venue: 'Room A' }, ['TUTOR','HOD']],
  ['event', { ...times, scope: 'college', event_name: 'Festival', venue: 'Hall' }, ['DEAN','PRINCIPAL']],
  ['facility', { ...times, scope: 'department', resource: 'Projector' }, ['TUTOR','HOD']],
  ['facility', { ...times, scope: 'college', resource: 'Auditorium' }, ['DEAN','PRINCIPAL']],
  ['internship', { ...dates, visit_kind: 'internship', organization: 'Company', location: 'Kasaragod' }, ['TUTOR','HOD','DEAN','PRINCIPAL']],
] as const
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role authenticated nologin; create role anon nologin; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
  for (const file of ['202610120001_small_mvp.sql','202610140001_admin_setup.sql','202610140002_request_workflows.sql']) await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'))
  expect((await db.query('select * from request_types where active')).rows).toHaveLength(1)
  await db.exec(readFileSync(new URL('../supabase/activate-request-catalogue.sql',import.meta.url),'utf8'))
  for (const [name,user] of Object.entries(users)) {
    await db.query('insert into auth.users values($1,$2,now())',[user,`${name}@example.invalid`])
    if(name!=='student' && name!=='other') await db.query('insert into profiles(id,full_name,account_type) values($1,$2,$3)',[user,name,name==='admin'?'ADMIN':'FACULTY'])
  }
  await db.query("insert into departments(id,name) values($1,'Department')",[department])
  await db.query("insert into classes(id,name,department_id,tutor_id) values($1,'Class',$2,$3)",[batch,department,users.tutor])
  await db.query("insert into profiles(id,full_name,account_type,class_id) values($1,'Student','STUDENT',$3),($2,'Other Student','STUDENT',$3)",[users.student,users.other,batch])
  await db.query("insert into authority_assignments(responsibility,department_id,faculty_id) values('HOD',$1,$2),('DEAN',null,$3),('PRINCIPAL',null,$4)",[department,users.hod,users.dean,users.principal])
},30000)
beforeEach(async()=>{ await db.exec('begin') })
afterEach(async()=>{ await db.exec('rollback; reset role') })
afterAll(async()=>{ await db?.close() })
async function as(user: string) { await db.exec('reset role;set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]) }
async function submit(code='leave',fields: object=dates) {
  await as(users.student)
  const result=await db.query<{id:string}>('select submit_typed_request($1,$2,(select id from request_types where code=$3),$4::jsonb) as id',['Title','Reason',code,JSON.stringify(fields)])
  return result.rows[0].id
}
async function denied(sql: string,args: unknown[],match: RegExp) {
  await db.exec('savepoint denial'); await expect(db.query(sql,args)).rejects.toThrow(match); await db.exec('rollback to denial;release denial')
}
async function decide(request: string,user: string,decision='APPROVED') { await as(user); await db.query('select decide_request($1,$2,$3)',[request,decision,'Recorded decision']) }
async function replace(role: string,user: string|null=users.replacement,scope: string|null=role==='TUTOR'?batch:role==='HOD'?department:null) {
  await as(users.admin)
  return (await db.query<{count:number}>('select admin_assign_responsibility($1,$2,$3,$4) as count',[role,scope,user,'New appointment'])).rows[0].count
}
async function visible(request: string,user: string) { await as(user); return (await db.query('select id from requests where id=$1',[request])).rows.length }

describe('typed requests and sequential approval',()=>{
  it('creates and cleans only the disposable concurrency fixture',async()=>{
    const before=(await db.query<{count:number}>('select count(*)::int as count from auth.users')).rows[0].count
    await db.exec(readFileSync(new URL('../supabase/tests/workflow-concurrency-setup.sql',import.meta.url),'utf8'))
    expect((await db.query("select * from requests where title like 'Workflow concurrency:%'")).rows).toHaveLength(2)
    await db.exec(readFileSync(new URL('../supabase/tests/workflow-concurrency-cleanup.sql',import.meta.url),'utf8'))
    expect((await db.query<{count:number}>('select count(*)::int as count from auth.users')).rows[0].count).toBe(before)
    expect((await db.query('select * from requests')).rows).toHaveLength(0)
    expect((await db.query("select * from audit_logs where entity_id::text like 'f15f0000-%'")).rows).toHaveLength(0)
  })
  it('validates all six hosted concurrency scripts sequentially without the delay',async()=>{
    await db.exec(readFileSync(new URL('../supabase/tests/workflow-concurrency-setup.sql',import.meta.url),'utf8'))
    const scripts=readFileSync(new URL('../supabase/tests/workflow-concurrency-sessions.sql',import.meta.url),'utf8').split(/-- SESSION \d[AB]:[^\n]*\n/).slice(1)
    expect(scripts).toHaveLength(6)
    for(const script of scripts) await db.exec(script.replace('select pg_sleep(30);','select pg_sleep(0);'))
    await db.exec(readFileSync(new URL('../supabase/tests/workflow-concurrency-cleanup.sql',import.meta.url),'utf8'))
    expect((await db.query('select * from requests')).rows).toHaveLength(0)
  })
  it('runs the exact owner hosted-smoke script and leaves no fixture rows',async()=>{
    const before=(await db.query<{count:number}>('select count(*)::int as count from auth.users')).rows[0].count
    await db.exec(readFileSync(new URL('../supabase/tests/hosted-workflow-smoke.sql',import.meta.url),'utf8'))
    expect((await db.query<{count:number}>('select count(*)::int as count from auth.users')).rows[0].count).toBe(before)
    expect((await db.query('select * from requests')).rows).toHaveLength(0)
  })
  for (const [code,fields,route] of catalogue) it(`snapshots and completes ${code} ${'scope' in fields ? fields.scope : ''} route`,async()=>{
    const request=await submit(code,fields)
    const row=(await db.query<{fields:object;route_snapshot:string[];form_snapshot:{time_zone:string};type_code:string}>('select fields,route_snapshot,form_snapshot,type_code from requests where id=$1',[request])).rows[0]
    expect(row.fields).toEqual(fields); expect(row.route_snapshot).toEqual(route); expect(row.type_code).toBe(code); expect(row.form_snapshot.time_zone).toBe('Asia/Kolkata')
    for(let n=0;n<route.length;n++) {
      const user=users[route[n].toLowerCase() as 'tutor'|'hod'|'dean'|'principal']
      for(let future=n+1;future<route.length;future++) expect(await visible(request,users[route[future].toLowerCase() as 'hod'|'dean'|'principal'])).toBe(0)
      await decide(request,user)
      await as(users.student)
      const row=(await db.query<{status:string;decided_at:string|null;current_position:number}>('select status,decided_at,current_position from requests where id=$1',[request])).rows[0]
      expect(row.status).toBe(n===route.length-1?'APPROVED':'IN_REVIEW'); expect(row.current_position).toBe(n===route.length-1?n+1:n+2)
      if(n<route.length-1) expect(row.decided_at).toBeNull()
    }
    await as(users.admin); expect((await db.query('select * from requests')).rows).toHaveLength(0); expect((await db.query('select * from request_actions')).rows).toHaveLength(0)
  })
  it('rejects and skips the remaining steps without granting skipped reviewers access',async()=>{
    const request=await submit('internship',catalogue[7][1]); await decide(request,users.tutor,'REJECTED')
    for(const user of [users.hod,users.dean,users.principal]) expect(await visible(request,user)).toBe(0)
    await as(users.student)
    expect((await db.query<{status:string}>('select status from approval_steps where request_id=$1 order by position',[request])).rows.map(r=>r.status)).toEqual(['REJECTED','SKIPPED','SKIPPED','SKIPPED'])
  })
  it('rejects malformed, missing, forged, and reversed fields server-side',async()=>{
    await as(users.student)
    for(const [code,fields] of [
      ['leave',{}],['leave',{...dates,from_date:'2026-02-30'}],['leave',{...dates,to_date:'2026-01-01'}],
      ['leave',{...dates,approver_id:users.student}],['event',{...catalogue[3][1],scope:'principal'}],
      ['event',{...catalogue[3][1],start_at:'2026-10-16T24:00'}],['general',{route:['PRINCIPAL']}],
      ['internship',{...catalogue[7][1],visit_kind:'anything'}],['leave',{...dates,from_date:123}],
    ]) await denied('select submit_typed_request($1,$2,(select id from request_types where code=$3),$4::jsonb)',['Title','Reason',code,JSON.stringify(fields)],/Enter|date|scope|Unexpected|Choose|out of range/)
    expect((await db.query('select * from requests')).rows).toHaveLength(0)
  })
  it('blocks missing, inactive and repeated people and rolls back submission',async()=>{
    await db.query("delete from authority_assignments where responsibility='HOD'"); await as(users.student)
    await denied("select submit_typed_request('Title','Reason',(select id from request_types where code='leave'),$1::jsonb)",[JSON.stringify(dates)],/active faculty HOD/)
    await db.exec('reset role'); await db.query("insert into authority_assignments(responsibility,department_id,faculty_id) values('HOD',$1,$2)",[department,users.tutor]); await as(users.student)
    await denied("select submit_typed_request('Title','Reason',(select id from request_types where code='leave'),$1::jsonb)",[JSON.stringify(dates)],/different Faculty/)
    await db.exec('reset role'); await db.query("update authority_assignments set faculty_id=$1 where responsibility='HOD'",[users.hod]); await db.query('update profiles set active=false where id=$1',[users.hod]); await as(users.student)
    await denied("select submit_typed_request('Title','Reason',(select id from request_types where code='leave'),$1::jsonb)",[JSON.stringify(dates)],/active faculty HOD/)
  })
  it('keeps old General submission callable but cannot bypass typed field validation',async()=>{
    await as(users.student)
    await db.query("select submit_request('Title','Reason',(select id from request_types where code='general'))")
    await denied("select submit_request('Title','Reason',(select id from request_types where code='leave'))",[],/updated request form/)
  })
  it('denies typed submissions and direct mutations to unauthorized accounts',async()=>{
    for(const user of [users.tutor,users.admin]) { await as(user); await denied("select submit_typed_request('Title','Reason',(select id from request_types where code='general'),'{}')",[],/active student/); await denied("update request_types set active=true",[],/permission denied/) }
    await db.exec('reset role'); await db.query('update profiles set active=false where id=$1',[users.student]); await as(users.student)
    await denied("select submit_typed_request('Title','Reason',$1,'{}')",[id(99)],/active student/)
    await db.exec('set role anon'); await denied("select submit_typed_request('Title','Reason',$1,'{}')",[id(99)],/permission denied/)
  })
  it('requires the current reviewer, mandatory comments and a single decision per step',async()=>{
    const request=await submit(); await as(users.hod); await denied("select decide_request($1,'APPROVED','Early')",[request],/not assigned/)
    await as(users.tutor); await denied("select decide_request($1,'APPROVED',' ')",[request],/comment is required/)
    await decide(request,users.tutor); await as(users.tutor); await denied("select decide_request($1,'APPROVED','Repeat')",[request],/not assigned/)
    await decide(request,users.hod,'REJECTED'); expect(await visible(request,users.tutor)).toBe(1); expect(await visible(request,users.other)).toBe(0)
  })
})

describe('scoped replacement and archive access',()=>{
  it('maps owner-reviewed legacy final scope, preserves decisions, and rejects placeholder/repeat mapping',async()=>{
    const request=await submit('general',{}); await decide(request,users.tutor); await replace('TUTOR')
    await db.exec('reset role'); await db.query('update requests set submitted_department_id=null where id=$1',[request])
    expect(await visible(request,users.replacement)).toBe(0)
    await db.exec('reset role')
    const template=readFileSync(new URL('../supabase/map-legacy-department.example.sql',import.meta.url),'utf8')
    // Strip transaction boundaries so failure assertions can use savepoints.
    const operation=template.replace(/^begin;$/m,'').replace(/^commit;$/m,'')
    await db.exec('savepoint mapping_denial'); await expect(db.exec(operation)).rejects.toThrow(/Replace placeholders/); await db.exec('rollback to mapping_denial;release mapping_denial')
    const reviewed=operation.replaceAll('REPLACE_REQUEST_ID',request).replaceAll('REPLACE_ORIGINAL_CLASS_ID',batch).replaceAll('REPLACE_ORIGINAL_DEPARTMENT_ID',department)
    await db.exec(reviewed)
    await db.exec('savepoint mapping_denial'); await expect(db.exec(reviewed)).rejects.toThrow(/no longer matches/); await db.exec('rollback to mapping_denial;release mapping_denial')
    expect(await visible(request,users.replacement)).toBe(1)
    await as(users.student)
    expect((await db.query<{status:string;description:string}>('select status,description from requests where id=$1',[request])).rows[0]).toEqual({status:'APPROVED',description:'Reason'})
    expect((await db.query<{approver_id:string}>('select approver_id from approval_steps where request_id=$1',[request])).rows[0].approver_id).toBe(users.tutor)
  })
  for(const role of ['TUTOR','HOD','DEAN','PRINCIPAL']) it(`transfers ${role} unfinished reviews and preserves completed decisions`,async()=>{
    const complete=await submit('internship',catalogue[7][1]); for(const user of [users.tutor,users.hod,users.dean,users.principal]) await decide(complete,user)
    const pending=await submit('internship',catalogue[7][1]); expect(await replace(role)).toBe(1)
    expect(await visible(complete,users.replacement)).toBe(1)
    await as(users.replacement); expect((await db.query<{approver_id:string}>('select approver_id from approval_steps where request_id=$1 and responsibility=$2',[complete,role])).rows[0].approver_id).toBe(users[role.toLowerCase() as 'tutor'])
    if(role!=='TUTOR') expect(await visible(pending,users.replacement)).toBe(0)
    const stages=['TUTOR','HOD','DEAN','PRINCIPAL']; for(const stage of stages) await decide(pending,stage===role?users.replacement:users[stage.toLowerCase() as 'tutor'])
    await as(users.student); expect((await db.query('select * from request_reassignments where request_id=$1',[pending])).rows).toHaveLength(1)
    const history=(await db.query<{history_order:number}>('select history_order from request_actions where request_id=$1 order by history_order',[pending])).rows
    expect(new Set(history.map(r=>r.history_order)).size).toBe(history.length)
    await as(users.admin); expect((await db.query('select * from request_reassignments')).rows).toHaveLength(0)
  })
  it('rolls back replacement collision and blocks assignment removal and future-review deactivation',async()=>{
    const request=await submit('internship',catalogue[7][1]); await as(users.admin)
    await denied("select admin_assign_responsibility('HOD',$1,$2,'Collision')",[department,users.tutor],/multiple required roles/)
    await denied("select admin_assign_responsibility('PRINCIPAL',null,null,'Remove')",[],/replacement PRINCIPAL/)
    await denied("select admin_update_profile($1,'Principal',null,false)",[users.principal],/pending reviews/)
    await as(users.student); expect((await db.query('select * from request_reassignments')).rows).toHaveLength(0)
    expect((await db.query<{approver_id:string}>('select approver_id from approval_steps where request_id=$1 and responsibility=$2',[request,'HOD'])).rows[0].approver_id).toBe(users.hod)
  })
  it('uses original scope for archives after membership moves and excludes skipped responsibilities',async()=>{
    const complete=await submit(); await decide(complete,users.tutor); await decide(complete,users.hod)
    const rejected=await submit('internship',catalogue[7][1]); await decide(rejected,users.tutor,'REJECTED')
    await replace('HOD'); expect(await visible(complete,users.replacement)).toBe(1); expect(await visible(rejected,users.replacement)).toBe(0)
    await db.exec('reset role'); const otherDepartment=id(20),otherBatch=id(21)
    await db.query("insert into departments(id,name) values($1,'Other')",[otherDepartment]); await db.query("insert into classes(id,name,department_id,tutor_id) values($1,'Other',$2,$3)",[otherBatch,otherDepartment,users.replacement])
    await db.query('update profiles set class_id=$1 where id=$2',[otherBatch,users.student])
    expect(await visible(complete,users.replacement)).toBe(1)
    await replace('HOD',null); await replace('HOD',users.replacement,otherDepartment); expect(await visible(complete,users.replacement)).toBe(0)
  })
  it('fails closed on unresolved scopes without expanding historical access',async()=>{
    const request=await submit(); await db.exec('reset role'); await db.query('update requests set submitted_department_id=null where id=$1',[request]); await as(users.admin)
    await denied("select admin_assign_responsibility('HOD',$1,$2,'Replace')",[department,users.replacement],/Owner review/)
    await decide(request,users.tutor); await decide(request,users.hod); await replace('HOD'); expect(await visible(request,users.replacement)).toBe(0)
  })
})
