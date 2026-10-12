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
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `)
  await db.exec(readFileSync(new URL('../supabase/migrations/202610120001_small_mvp.sql', import.meta.url), 'utf8'))
  for (const id of [ids.student, ids.otherStudent, ids.tutor, ids.otherFaculty, ids.admin, ids.unconfigured]) {
    await db.query('insert into auth.users(id) values ($1)', [id])
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
      await denied('select public.submit_request($1, $2, $3)', ['Title', 'Details', typeId], /active department and faculty Tutor/)
    }
    await db.exec('reset role')
    await db.query('update public.classes set tutor_id = $1 where id = $2', [ids.tutor, ids.class])
    await db.query('update public.profiles set active = false where id = $1', [ids.tutor])
    await asUser(ids.student)
    await denied('select public.submit_request($1, $2, $3)', ['Title', 'Details', typeId], /active department and faculty Tutor/)
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
