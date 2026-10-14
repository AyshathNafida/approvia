import { describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const baseline = readFileSync(new URL('../supabase/migrations/202610120001_small_mvp.sql', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/202610140001_admin_setup.sql', import.meta.url), 'utf8')
const bootstrap = readFileSync(new URL('../supabase/bootstrap-admin.example.sql', import.meta.url), 'utf8')
const hostedSmoke = readFileSync(new URL('../supabase/tests/hosted-admin-smoke.sql', import.meta.url), 'utf8')
const ids = { tutor: '11111111-1111-4111-8111-111111111111', student: '22222222-2222-4222-8222-222222222222', admin: '33333333-3333-4333-8333-333333333333' }
async function setup() {
  const db = new PGlite()
  await db.exec(`create role authenticated nologin; create role anon nologin; create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
  await db.exec(baseline)
  return db
}
async function expectRejected(db: PGlite, sql: string, match: RegExp) {
  await expect(db.exec(sql)).rejects.toThrow(match)
  await db.exec('rollback')
}

describe('migration and first Admin bootstrap', () => {
  it('runs the owner smoke script with actual role switches and leaves no synthetic records', async () => {
    const db = await setup()
    try {
      await db.exec(migration)
      await db.exec(hostedSmoke)
      for (const table of ['auth.users','public.profiles','public.requests','public.classes','public.departments','public.audit_logs','public.request_reassignments']) {
        expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0)
      }
    } finally { await db.close() }
  }, 30000)

  it('backfills matching legacy request classes, flags mismatches, and preserves initial Tutor history', async () => {
    const db = await setup()
    try {
      await db.query('insert into auth.users(id) values ($1),($2)', [ids.tutor, ids.student])
      await db.query("insert into profiles(id,full_name,account_type) values ($1,'Tutor','FACULTY')", [ids.tutor])
      await db.exec("insert into departments(name) values ('CS'); insert into classes(department_id,name,tutor_id) select id,'CS-A','11111111-1111-4111-8111-111111111111' from departments;")
      await db.query("insert into profiles(id,full_name,account_type,class_id) select $1,'Student','STUDENT',id from classes", [ids.student])
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.student])
      await db.exec("select public.submit_request('Matching','Details',(select id from request_types)); select public.submit_request('Mismatch','Details',(select id from request_types)); update requests set class_name='Old unmatched class' where title='Mismatch';")
      await db.exec(migration)
      const rows = (await db.query<{ title: string; submitted_class_id: string | null }>('select title,submitted_class_id from requests order by title')).rows
      expect(rows[0].submitted_class_id).toBeTruthy()
      expect(rows[1].submitted_class_id).toBeNull()
      expect((await db.query<{ faculty_id: string; actor_id: string | null }>('select faculty_id,actor_id from responsibility_changes')).rows).toEqual([{ faculty_id: ids.tutor, actor_id: null }])
      expect((await db.query('select * from request_actions')).rows).toHaveLength(2)
      expect((await db.query('select * from profiles')).rows).toHaveLength(2)
    } finally { await db.close() }
  }, 30000)

  it('creates exactly one dedicated confirmed Admin and refuses existing or unconfirmed profiles', async () => {
    const db = await setup()
    try {
      await db.exec(migration)
      const script = bootstrap.replace("'admin@example.test';", "'dedicated@example.test';")
      await expectRejected(db, bootstrap, /Replace the placeholder/)
      await db.query("insert into auth.users(id,email) values ($1,'dedicated@example.test')", [ids.admin])
      await expectRejected(db, script, /Exactly one confirmed/)
      await db.exec("update auth.users set email_confirmed_at=now()")
      await db.query("insert into profiles(id,full_name,account_type) values ($1,'Existing Faculty','FACULTY')", [ids.admin])
      await expectRejected(db, script, /already has a profile/)
      await db.query('delete from profiles where id=$1', [ids.admin])
      await db.exec(script)
      expect((await db.query<{ account_type: string }>('select account_type from profiles')).rows).toEqual([{ account_type: 'ADMIN' }])
      await expectRejected(db, script, /Admin profile already exists/)
    } finally { await db.close() }
  }, 30000)
})
