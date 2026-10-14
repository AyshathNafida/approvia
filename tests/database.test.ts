import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const ids = {
  student: '11111111-1111-4111-8111-111111111111',
  otherStudent: '22222222-2222-4222-8222-222222222222',
  tutor: '33333333-3333-4333-8333-333333333333',
  otherFaculty: '44444444-4444-4444-8444-444444444444',
  admin: '55555555-5555-4555-8555-555555555555',
  unconfigured: '66666666-6666-4666-8666-666666666666',
  department: '77777777-7777-4777-8777-777777777777',
  class: '88888888-8888-4888-8888-888888888888',
}
let db: PGlite
let typeId: string

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role authenticated nologin;
    create role anon nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `)
  await db.exec(readFileSync(new URL('../supabase/migrations/202610120001_small_mvp.sql', import.meta.url), 'utf8'))
  await db.exec(readFileSync(new URL('../supabase/migrations/202610140001_admin_setup.sql', import.meta.url), 'utf8'))
  await db.exec(readFileSync(new URL('../supabase/migrations/202610140002_request_workflows.sql', import.meta.url), 'utf8'))
  for (const id of [ids.student, ids.otherStudent, ids.tutor, ids.otherFaculty, ids.admin, ids.unconfigured]) {
    await db.query('insert into auth.users(id, email, email_confirmed_at) values ($1, $2, now())', [id, `${id}@example.test`])
  }
  await db.query("insert into public.departments(id, name) values ($1, 'Test Department')", [ids.department])
  await db.query("insert into public.profiles(id, full_name, account_type) values ($1, 'Tutor', 'FACULTY'), ($2, 'Other Faculty', 'FACULTY'), ($3, 'Admin', 'ADMIN')", [ids.tutor, ids.otherFaculty, ids.admin])
  await db.query("insert into public.classes(id, department_id, name, tutor_id) values ($1, $2, 'Test Class', $3)", [ids.class, ids.department, ids.tutor])
  await db.query("insert into public.profiles(id, full_name, account_type, class_id) values ($1, 'Student', 'STUDENT', $3), ($2, 'Other Student', 'STUDENT', $3)", [ids.student, ids.otherStudent, ids.class])
  const result = await db.query<{ id: string }>("select id from public.request_types where code = 'general'")
  typeId = result.rows[0].id
}, 30000)

beforeEach(async () => { await db.exec('begin') })
afterEach(async () => { await db.exec('rollback; reset role') })
afterAll(async () => { await db?.close() })

async function asUser(id: string) {
  await db.exec('reset role; set role authenticated')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
}

async function submit() {
  await asUser(ids.student)
  const result = await db.query<{ id: string }>('select public.submit_request($1, $2, $3) as id', ['Test request', 'Please review this request.', typeId])
  return result.rows[0].id
}

async function denied(sql: string, params: unknown[], message: RegExp) {
  await db.exec('savepoint expected_failure')
  await expect(db.query(sql, params)).rejects.toThrow(message)
  await db.exec('rollback to savepoint expected_failure; release savepoint expected_failure')
}

describe('actual PostgreSQL MVP operations and RLS', () => {
  it('persists a student submission, resolves the Tutor, and approves with history and audit metadata', async () => {
    const requestId = await submit()
    expect((await db.query<{ status: string }>('select status from public.requests')).rows[0].status).toBe('IN_REVIEW')
    await asUser(ids.tutor)
    expect((await db.query<{ approver_id: string }>('select approver_id from public.approval_steps')).rows[0].approver_id).toBe(ids.tutor)
    await db.query('select public.decide_request($1, $2, $3)', [requestId, 'APPROVED', 'Permission granted.'])
    await asUser(ids.student)
    expect((await db.query<{ status: string }>('select status from public.requests')).rows[0].status).toBe('APPROVED')
    expect((await db.query<{ action: string }>('select action from public.request_actions order by action')).rows.map((row) => row.action)).toEqual(['APPROVED', 'SUBMITTED'])
    await asUser(ids.admin)
    const audit = await db.query<{ event: string }>('select event from public.audit_logs where entity_id = $1 order by event', [requestId])
    expect(audit.rows.map((row) => row.event)).toEqual(['REQUEST_APPROVED', 'REQUEST_CREATED', 'REQUEST_SUBMITTED'])
  })

  it('denies other students, unrelated faculty, Admin, and users without profiles request/history access', async () => {
    const requestId = await submit()
    for (const userId of [ids.otherStudent, ids.otherFaculty, ids.admin, ids.unconfigured]) {
      await asUser(userId)
      expect((await db.query('select * from public.requests')).rows).toHaveLength(0)
      expect((await db.query('select * from public.request_actions')).rows).toHaveLength(0)
      expect((await db.query('select * from public.approval_steps')).rows).toHaveLength(0)
      await denied('select public.decide_request($1, $2, $3)', [requestId, 'APPROVED', 'Not allowed'], /Only active faculty|not assigned/)
    }
  })

  it('blocks direct writes and self-promotion, even for an assigned Tutor', async () => {
    const requestId = await submit()
    await denied("update public.profiles set account_type = 'ADMIN' where id = $1", [ids.student], /permission denied/)
    await denied('delete from public.request_actions where request_id = $1', [requestId], /permission denied/)
    await asUser(ids.tutor)
    await denied("update public.requests set status = 'APPROVED' where id = $1", [requestId], /permission denied/)
  })

  it('requires a decision comment and prevents a second final decision', async () => {
    const requestId = await submit()
    await asUser(ids.tutor)
    await denied('select public.decide_request($1, $2, $3)', [requestId, 'REJECTED', '   '], /comment is required/)
    await db.query('select public.decide_request($1, $2, $3)', [requestId, 'REJECTED', 'Missing justification.'])
    await denied('select public.decide_request($1, $2, $3)', [requestId, 'APPROVED', 'Changed my mind.'], /final decision/)
    expect((await db.query('select * from public.request_actions')).rows).toHaveLength(2)
  })

  it('keeps pending requests assigned to the Tutor resolved at submission', async () => {
    const requestId = await submit()
    await db.exec('reset role')
    await db.query('update public.classes set tutor_id = $1 where id = $2', [ids.otherFaculty, ids.class])
    await asUser(ids.otherFaculty)
    expect((await db.query('select * from public.requests')).rows).toHaveLength(0)
    await asUser(ids.tutor)
    await db.query('select public.decide_request($1, $2, $3)', [requestId, 'APPROVED', 'Original Tutor decision.'])
    expect((await db.query<{ status: string }>('select status from public.requests')).rows[0].status).toBe('APPROVED')
  })

  it('blocks submissions with missing/inactive/non-faculty Tutor configuration', async () => {
    for (const tutorId of [null, ids.admin]) {
      await db.exec('reset role')
      await db.query('update public.classes set tutor_id = $1 where id = $2', [tutorId, ids.class])
      await asUser(ids.student)
      await denied('select public.submit_request($1, $2, $3)', ['Title', 'Details', typeId], /active faculty TUTOR/)
    }
    await db.exec('reset role')
    await db.query('update public.classes set tutor_id = $1 where id = $2', [ids.tutor, ids.class])
    await db.query('update public.profiles set active = false where id = $1', [ids.tutor])
    await asUser(ids.student)
    await denied('select public.submit_request($1, $2, $3)', ['Title', 'Details', typeId], /active faculty TUTOR/)
  })

  it('blocks inactive users from reading or deciding their requests', async () => {
    const requestId = await submit()
    await db.exec('reset role')
    await db.query('update public.profiles set active = false where id in ($1, $2)', [ids.student, ids.tutor])
    await asUser(ids.student)
    expect((await db.query('select * from public.requests')).rows).toHaveLength(0)
    await denied('select public.submit_request($1, $2, $3)', ['Title', 'Details', typeId], /active student/)
    await asUser(ids.tutor)
    await denied('select public.decide_request($1, $2, $3)', [requestId, 'APPROVED', 'Comment'], /active faculty/)
  })

  it('does not grant anonymous users access to submission or decisions', async () => {
    await db.exec('set role anon')
    await denied('select public.submit_request($1, $2, $3)', ['Title', 'Details', typeId], /permission denied/)
    await denied('select * from public.requests', [], /permission denied/)
  })
})

describe('Admin configuration and reassignment', () => {
  const assign = (facultyId: string | null = ids.otherFaculty, reason = 'Tutor replacement for this batch.') =>
    db.query<{ count: number }>("select public.admin_assign_responsibility('TUTOR', $1, $2, $3) as count", [ids.class, facultyId, reason])

  it('denies every Admin operation to non-Admin, unconfigured, and inactive identities', async () => {
    const operations: [string, unknown[]][] = [
      ['select public.admin_setup_summary()', []],
      ['select public.admin_save_department(null, $1, true)', ['Denied']],
      ["select public.admin_assign_responsibility('TUTOR', $1, $2, 'Reason')", [ids.class, ids.tutor]],
      ["select public.admin_save_class(null, $1, 'Class', 2026, 2030, true, $2, 'Reason')", [ids.department, ids.tutor]],
      ["select public.admin_provision_profile('test@example.test', 'Name', 'FACULTY', null)", []],
      ['select public.admin_update_profile($1, $2, null, true)', [ids.tutor, 'Name']],
    ]
    for (const id of [ids.student, ids.tutor, ids.unconfigured]) {
      await asUser(id)
      for (const [sql, args] of operations) await denied(sql, args, /Only active Admin/)
    }
    await db.exec('reset role')
    await db.query('update profiles set active = false where id = $1', [ids.admin])
    await asUser(ids.admin)
    await denied('select public.admin_setup_summary()', [], /Only active Admin/)
    await db.exec('set role anon')
    await denied('select public.admin_setup_summary()', [], /permission denied/)
  })

  it('creates and edits departments, guards dependencies, and never grants direct configuration writes', async () => {
    await asUser(ids.admin)
    const result = await db.query<{ id: string }>("select public.admin_save_department(null, 'New Department', true) as id")
    const id = result.rows[0].id
    await db.query("select public.admin_save_department($1, 'Renamed Department', false)", [id])
    expect((await db.query<{ name: string }>('select name from departments where id = $1', [id])).rows[0].name).toBe('Renamed Department')
    await denied("select public.admin_save_department($1, 'Test Department', false)", [ids.department], /dependent classes/)
    await denied("insert into authority_assignments(responsibility, faculty_id) values ('DEAN', $1)", [ids.tutor], /permission denied/)
    await denied("delete from responsibility_changes", [], /permission denied/)
    await denied('select approvia_private.admin_guard()', [], /permission denied/)
    await denied('select approvia_private.submit_request($1,$2,$3)', ['Title','Description',typeId], /permission denied/)
  })

  it('provisions only confirmed existing logins and refuses account-type overwrites or Admin creation', async () => {
    await asUser(ids.admin)
    await denied("select public.admin_provision_profile('missing@example.test', 'New User', 'FACULTY', null)", [], /No confirmed existing login/)
    await denied('select public.admin_provision_profile($1,$2,$3,null)', [`${ids.tutor}@example.test`, 'Tutor', 'ADMIN'], /Only Student or Faculty/)
    await denied('select public.admin_provision_profile($1,$2,$3,null)', [`${ids.tutor}@example.test`, 'Tutor', 'FACULTY'], /already has a profile/)
    await db.exec('reset role')
    await db.query('update auth.users set email_confirmed_at = null where id = $1', [ids.unconfigured])
    await asUser(ids.admin)
    await denied('select public.admin_provision_profile($1,$2,$3,null)', [`${ids.unconfigured}@example.test`, 'New Faculty', 'FACULTY'], /No confirmed existing login/)
    await db.exec('reset role')
    await db.query('update auth.users set email_confirmed_at = now() where id = $1', [ids.unconfigured])
    await asUser(ids.admin)
    await denied('select public.admin_provision_profile($1,$2,$3,$4)', [`${ids.unconfigured}@example.test`, 'New Student', 'STUDENT', ids.department], /active class/)
    await db.query('select public.admin_provision_profile($1,$2,$3,$4)', [`  ${ids.unconfigured}@EXAMPLE.TEST  `, ' New Student ', 'STUDENT', ids.class])
    expect((await db.query<{ account_type: string; class_id: string; full_name: string }>('select account_type, class_id, full_name from profiles where id = $1', [ids.unconfigured])).rows[0]).toEqual({ account_type: 'STUDENT', class_id: ids.class, full_name: 'New Student' })
  })

  it('creates distinct four-year batches and preserves established class identity and historical names', async () => {
    const request = await submit()
    await asUser(ids.admin)
    const sql = 'select public.admin_save_class($1,$2,$3,$4,$5,$6,$7,$8) as result'
    await db.query(sql, [ids.class, ids.department, 'Renamed class', 2026, 2030, true, ids.tutor, 'Batch setup'])
    await denied(sql, [ids.class, ids.department, 'Renamed class', 2027, 2031, true, ids.tutor, 'Identity edit'], /identity cannot change/)
    await denied(sql, [null, ids.department, 'Renamed class', 2026, 2030, true, ids.tutor, 'Duplicate'], /duplicate key/)
    await denied(sql, [null, ids.department, 'Bad batch', 2026, 2029, true, ids.tutor, 'Invalid'], /four-year batch/)
    await denied(sql, [null, ids.department, 'No Tutor', 2026, 2030, true, ids.admin, 'Invalid'], /active Faculty Tutor/)
    const other = await db.query<{ result: { id: string } }>(sql, [null, ids.department, 'Renamed class', 2027, 2031, true, ids.tutor, 'New cohort'])
    expect(other.rows[0].result.id).not.toBe(ids.class)
    await denied(sql, [ids.class, ids.department, 'Renamed class', 2026, 2030, false, ids.tutor, 'Deactivate'], /active memberships/)
    await asUser(ids.student)
    expect((await db.query<{ class_name: string; submitted_class_id: string }>('select class_name,submitted_class_id from requests where id = $1', [request])).rows[0]).toEqual({ class_name: 'Test Class', submitted_class_id: ids.class })
  })

  it('transfers multiple pending requests atomically, retains completed history, and changes access', async () => {
    const completed = await submit()
    await asUser(ids.tutor)
    await db.query("select public.decide_request($1,'APPROVED','Completed before replacement')", [completed])
    const first = await submit()
    const second = await submit()
    await asUser(ids.admin)
    expect((await assign()).rows[0].count).toBe(2)
    expect((await db.query('select * from requests')).rows).toHaveLength(0)
    expect((await db.query('select * from request_actions')).rows).toHaveLength(0)
    expect((await db.query('select * from request_reassignments')).rows).toHaveLength(0)
    expect((await assign()).rows[0].count).toBe(0)
    await asUser(ids.tutor)
    expect((await db.query<{ id: string }>('select id from requests')).rows.map(r => r.id)).toEqual([completed])
    await denied("select public.decide_request($1,'APPROVED','Old reviewer')", [first], /not assigned/)
    await asUser(ids.otherFaculty)
    expect((await db.query('select * from requests')).rows).toHaveLength(3)
    const reassignment = (await db.query<{ previous_faculty_id: string; faculty_id: string }>('select previous_faculty_id,faculty_id from request_reassignments')).rows
    expect(reassignment).toHaveLength(2)
    expect(reassignment[0]).toEqual({ previous_faculty_id: ids.tutor, faculty_id: ids.otherFaculty })
    await db.query("select public.decide_request($1,'REJECTED','Replacement decision')", [first])
    await asUser(ids.student)
    expect((await db.query<{ action: string }>('select action from request_actions where request_id = $1 order by action', [first])).rows.map(r => r.action)).toEqual(['REASSIGNED', 'REJECTED', 'SUBMITTED'])
    expect((await db.query('select * from request_actions where request_id = $1', [completed])).rows).toHaveLength(2)
    const next = await submit()
    expect((await db.query<{ approver_id: string }>('select approver_id from approval_steps where request_id = $1', [next])).rows[0].approver_id).toBe(ids.otherFaculty)
    await asUser(ids.admin)
    expect((await assign(ids.tutor, 'Restore original Tutor')).rows[0].count).toBe(2)
    await asUser(ids.otherFaculty)
    expect((await db.query<{ id: string }>('select id from requests')).rows.map(r => r.id)).toEqual([first])
    await denied("select public.decide_request($1,'APPROVED','Stale reviewer')", [second], /not assigned/)
  })

  it('rolls back class edits and transfer history when replacement validation fails', async () => {
    await submit()
    await asUser(ids.admin)
    await denied("select public.admin_save_class($1,$2,'Should not persist',2026,2030,true,$3,' ')", [ids.class, ids.department, ids.otherFaculty], /reason is required/)
    expect((await db.query<{ name: string; tutor_id: string }>('select name,tutor_id from classes where id=$1', [ids.class])).rows[0]).toEqual({ name: 'Test Class', tutor_id: ids.tutor })
    expect((await db.query('select * from responsibility_changes')).rows).toHaveLength(0)
    await denied("select public.admin_assign_responsibility('TUTOR',$1,null,'Remove')", [ids.class], /replacement TUTOR/)
    await asUser(ids.student)
    expect((await db.query('select * from request_reassignments')).rows).toHaveLength(0)
  })

  it('rolls back earlier transfers if a later reassignment write fails', async () => {
    await submit()
    await submit()
    await db.exec('reset role')
    await db.exec(`create function approvia_private.test_reassignment_failure() returns trigger language plpgsql as $$
      begin if (select count(*) from public.request_reassignments) > 0 then raise exception 'Synthetic second-write failure'; end if; return new; end $$;
      create trigger test_reassignment_failure before insert on public.request_reassignments for each row execute function approvia_private.test_reassignment_failure();`)
    await asUser(ids.admin)
    await denied("select public.admin_assign_responsibility('TUTOR',$1,$2,'Replacement')", [ids.class, ids.otherFaculty], /Synthetic second-write failure/)
    expect((await db.query<{ tutor_id: string }>('select tutor_id from classes where id=$1', [ids.class])).rows[0].tutor_id).toBe(ids.tutor)
    await asUser(ids.student)
    expect((await db.query<{ approver_id: string }>('select approver_id from approval_steps')).rows.every(s => s.approver_id === ids.tutor)).toBe(true)
    expect((await db.query('select * from request_reassignments')).rows).toHaveLength(0)
    expect((await db.query("select * from request_actions where action='REASSIGNED'")).rows).toHaveLength(0)
  })

  it('fails closed for unresolved legacy pending classes and returns only an Admin count', async () => {
    const id = await submit()
    await db.exec('reset role')
    await db.query('update requests set submitted_class_id = null where id = $1', [id])
    await asUser(ids.admin)
    expect((await db.query<{ summary: object }>('select public.admin_setup_summary() as summary')).rows[0].summary).toEqual({ unresolved_pending_classes: 1 })
    await denied("select public.admin_assign_responsibility('TUTOR',$1,$2,'Replacement')", [ids.class, ids.otherFaculty], /Owner review/)
    expect((await db.query<{ tutor_id: string }>('select tutor_id from classes where id=$1', [ids.class])).rows[0].tutor_id).toBe(ids.tutor)
  })

  it('preserves class identity when legacy completed history cannot be mapped', async () => {
    const request = await submit()
    await asUser(ids.tutor)
    await db.query("select public.decide_request($1,'APPROVED','Finished')", [request])
    await asUser(ids.admin)
    const next = (await db.query<{ result: { id: string } }>("select public.admin_save_class(null,$1,'Next class',2026,2030,true,$2,'Initial Tutor') as result", [ids.department, ids.tutor])).rows[0].result.id
    await db.exec('reset role')
    await db.query('update requests set submitted_class_id=null where id=$1', [request])
    await db.query('update profiles set class_id=$1 where account_type=$2', [next, 'STUDENT'])
    const dept = (await db.query<{ id: string }>("insert into departments(name) values ('Other department') returning id")).rows[0].id
    await asUser(ids.admin)
    await denied("select public.admin_save_class($1,$2,'Test Class',2026,2030,true,$3,'Move department')", [ids.class, dept, ids.tutor], /identity cannot change/)
  })

  it('validates authority scopes, supports overlapping responsibilities, and guards faculty deactivation', async () => {
    await asUser(ids.admin)
    await denied("select public.admin_assign_responsibility('HOD',null,$1,'Reason')", [ids.tutor], /active department/)
    await denied("select public.admin_assign_responsibility('DEAN',$1,$2,'Reason')", [ids.department, ids.tutor], /cannot have/)
    await denied("select public.admin_assign_responsibility('HOD',$1,$2,'Reason')", [ids.department, ids.admin], /active Faculty/)
    for (const responsibility of ['HOD','DEAN','PRINCIPAL']) {
      await db.query('select public.admin_assign_responsibility($1,$2,$3,$4)', [responsibility, responsibility === 'HOD' ? ids.department : null, ids.tutor, 'Initial appointment'])
    }
    expect((await db.query('select * from authority_assignments')).rows).toHaveLength(3)
    await db.query("select public.admin_assign_responsibility('DEAN',null,$1,'Replacement')", [ids.otherFaculty])
    expect((await db.query('select * from authority_assignments')).rows).toHaveLength(3)
    await denied('select public.admin_update_profile($1,$2,null,false)', [ids.tutor, 'Tutor'], /assignments and pending reviews/)
    await denied('select public.admin_update_profile($1,$2,null,false)', [ids.admin, 'Admin'], /Admin accounts cannot/)
    await asUser(ids.otherFaculty)
    expect((await db.query('select * from authority_assignments')).rows).toHaveLength(0)
    expect((await db.query('select * from responsibility_changes')).rows).toHaveLength(0)
  })

  it('guards student movement/deactivation while pending and preserves final request snapshots', async () => {
    const request = await submit()
    await asUser(ids.admin)
    const cls = await db.query<{ result: { id: string } }>("select public.admin_save_class(null,$1,'New class',2026,2030,true,$2,'Initial Tutor') as result", [ids.department, ids.otherFaculty])
    const target = cls.rows[0].result.id
    await denied('select public.admin_update_profile($1,$2,$3,true)', [ids.student, 'Student', target], /pending requests/)
    await denied('select public.admin_update_profile($1,$2,$3,false)', [ids.student, 'Student', ids.class], /pending requests/)
    await asUser(ids.tutor)
    await db.query("select public.decide_request($1,'APPROVED','Done')", [request])
    await asUser(ids.admin)
    await db.query('select public.admin_update_profile($1,$2,$3,true)', [ids.student, 'Updated Student', target])
    await asUser(ids.student)
    expect((await db.query<{ student_name: string; class_name: string; submitted_class_id: string }>('select student_name,class_name,submitted_class_id from requests where id=$1', [request])).rows[0]).toEqual({ student_name: 'Student', class_name: 'Test Class', submitted_class_id: ids.class })
    await asUser(ids.admin)
    await db.query('select public.admin_update_profile($1,$2,$3,false)', [ids.student, 'Updated Student', target])
    await asUser(ids.student)
    expect((await db.query('select * from requests')).rows).toHaveLength(0)
  })

  it('allows faculty deactivation after all assignments are removed, and retains audit metadata only', async () => {
    await asUser(ids.admin)
    await assign(null, 'No pending work; remove assignment')
    await db.query('select public.admin_update_profile($1,$2,null,false)', [ids.tutor, 'Tutor'])
    expect((await db.query<{ active: boolean }>('select active from profiles where id=$1', [ids.tutor])).rows[0].active).toBe(false)
    const events = await db.query<{ event: string; entity_type: string }>('select event,entity_type from audit_logs')
    expect(events.rows.some(r => r.event === 'TUTOR_ASSIGNMENT_CHANGED')).toBe(true)
    expect(events.rows.some(r => r.entity_type === 'profiles')).toBe(true)
    await denied('update request_reassignments set reason = $1', ['Overwrite'], /permission denied/)
  })

  it('requires the same transaction serialization gate in every application write entrypoint', async () => {
    await db.exec('reset role')
    const operations = await db.query<{ proname: string; prosrc: string }>("select proname,prosrc from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and (proname like 'admin_%' or proname in ('submit_request','submit_typed_request','decide_request'))")
    expect(operations.rows).toHaveLength(9)
    for (const operation of operations.rows) expect(operation.prosrc).toMatch(/admin_guard\(\)|pg_advisory_xact_lock\(20261014,\s*1\)/)
    const guard = await db.query<{ prosrc: string }>("select prosrc from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='approvia_private' and proname='admin_guard'")
    expect(guard.rows[0].prosrc).toContain('pg_advisory_xact_lock(20261014, 1)')
  })
})
