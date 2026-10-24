import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

let db: PGlite
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const admin = id(1), student = id(2), tutor = id(3), department = id(4), batch = id(5), invitee = id(6), hod = id(7)
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role authenticated; create role anon; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon,service_role;`)
  for (const file of ['202610120001_small_mvp.sql','202610140001_admin_setup.sql','202610140002_request_workflows.sql']) await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url),'utf8'))
  await db.exec(`insert into auth.users values ('${admin}','admin@personal.test',now()),('${student}','student@personal.test',now()),('${tutor}','tutor@personal.test',now()),('${hod}','hod@lbscek.ac.in',now());
    insert into public.departments(id,name) values('${department}','Department');
    insert into public.profiles(id,full_name,account_type) values('${admin}','Admin','ADMIN'),('${tutor}','Tutor','FACULTY'),('${hod}','HOD','FACULTY');
    insert into public.classes(id,name,department_id,tutor_id) values('${batch}','Class','${department}','${tutor}');
    insert into public.profiles(id,full_name,account_type,class_id) values('${student}','Student','STUDENT','${batch}');`)
  await db.exec('alter table auth.users add column email_change text')
  await db.exec(readFileSync(new URL('../supabase/migrations/202610240001_account_invitations.sql',import.meta.url),'utf8'))
}, 30000)
beforeEach(async () => { await db.exec('begin') })
afterEach(async () => { await db.exec('rollback; reset role') })
afterAll(async () => { await db?.close() })
async function as(user: string) { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]) }
async function owner(sql: string) { await db.exec('reset role'); return db.exec(sql) }
async function reserve(email='new@lbscek.ac.in', type='FACULTY', classId: string | null=null) {
  await as(admin)
  return db.query<{ value: { id: string; claim: string } }>('select public.admin_reserve_invitation($1,$2,$3,$4) value',[email,'New User',type,classId])
}
async function enable() { await owner('update approvia_private.account_settings set email_enabled=true') }
async function bound(confirmed=true) {
  await enable(); const result = await reserve()
  await owner(`insert into auth.users(id,email,email_confirmed_at) values('${invitee}','new@lbscek.ac.in',${confirmed ? 'now()' : 'null'})`)
  return result.rows[0].value
}
async function onboard() { await db.exec('reset role; set role service_role'); await db.query('select public.account_complete_onboarding($1)',[invitee]) }

describe('college accounts and invitation authorization', () => {
  it('keeps existing verified identities eligible until owner cutover', async () => {
    await as(student)
    const result = await db.query<{ value: {allowed: boolean; needs_migration: boolean; email_enabled: boolean} }>('select public.account_access_status() value')
    expect(result.rows[0].value).toMatchObject({allowed:true,needs_migration:true,email_enabled:false})
  })
  it('starts with email disabled and cannot use legacy provisioning', async () => {
    await denied(() => reserve(), 'disabled')
    await as(admin)
    await denied(() => db.query("select public.admin_provision_profile('new@lbscek.ac.in','New','FACULTY',null)"), 'Invite account')
  })
  it.each(['new@gmail.com','new@sub.lbscek.ac.in','new@lbscek.ac.in.evil.test','a@@lbscek.ac.in'])('rejects domain bypass %s', async email => {
    await enable(); await denied(() => reserve(email), '@lbscek.ac.in')
  })
  it('normalizes addresses and does not permit duplicate or conflicting reservations', async () => {
    await enable(); await reserve(' NEW@LBSCEK.AC.IN ')
    await denied(() => reserve(), 'already in progress')
    await denied(() => reserve('new@lbscek.ac.in','STUDENT',batch), 'different account details')
  })
  it('rejects unrelated existing Auth identities without adopting them', async () => {
    await enable(); await owner(`insert into auth.users(id,email,email_confirmed_at) values('${invitee}','new@lbscek.ac.in',null)`)
    await denied(() => reserve(), 'already exists')
  })
  it.each([student,tutor])('denies invitation creation and private listings to non-Admin %s', async user => {
    await enable(); await as(user)
    await denied(() => db.query("select public.admin_reserve_invitation('new@lbscek.ac.in','New','FACULTY',null)"), 'Only active Admin')
    expect((await db.query('select id from public.account_invitations')).rows).toHaveLength(0)
    await denied(() => db.query('select public.account_complete_onboarding($1)',[user]), 'permission denied')
  })
  it('denies inactive Admin and anonymous callers', async () => {
    await enable(); await owner(`update public.profiles set active=false where id='${admin}'`)
    await denied(() => reserve(), 'Only active Admin')
    await db.exec('reset role; set role anon')
    await denied(() => db.query("select public.admin_reserve_invitation('new@lbscek.ac.in','New','FACULTY',null)"), 'permission denied')
  })
  it('blocks pending and unverified identities, including direct assignment and service finalization', async () => {
    await bound(false); await as(invitee)
    expect((await db.query<{ value: {allowed:boolean} }>('select public.account_access_status() value')).rows[0].value.allowed).toBe(false)
    expect((await db.query('select * from public.profiles')).rows).toHaveLength(0)
    await denied(() => onboard(), 'No verified pending invitation')
  })
  it('completes a verified invite exactly once and prevents browser completion/direct writes', async () => {
    await bound(); await as(invitee)
    await denied(() => db.query('select public.account_complete_onboarding($1)',[invitee]), 'permission denied')
    await denied(() => db.query("insert into public.profiles(id,full_name,account_type) values($1,'Hack','ADMIN')",[invitee]), 'permission denied')
    await onboard(); await as(invitee)
    const profile = await db.query<{account_type:string;onboarding_complete:boolean}>('select * from public.profiles')
    expect(profile.rows[0]).toMatchObject({account_type:'FACULTY',onboarding_complete:true})
    await denied(() => onboard(), 'No verified pending invitation')
  })
  it('revalidates Student placement before creating a profile', async () => {
    await enable(); await reserve('new@lbscek.ac.in','STUDENT',batch)
    await owner(`insert into auth.users(id,email,email_confirmed_at) values('${invitee}','new@lbscek.ac.in',now()); update public.classes set active=false where id='${batch}'`)
    await denied(() => onboard(), 'class is unavailable')
    await owner('select 1'); expect((await db.query('select * from public.profiles where id=$1',[invitee])).rows).toHaveLength(0)
  })
  it('retains failed reservations, retries safely, and ignores stale delivery results', async () => {
    const first = await bound()
    await db.exec('set role service_role')
    await db.query('select public.account_delivery_result($1,$2,false)',[first.id,first.claim])
    await owner(`update public.account_invitations set last_attempt_at=now()-interval '3 minutes',lease_until=now()-interval '1 minute'`)
    const second = (await reserve()).rows[0].value
    expect(second.id).toBe(first.id); expect(second.claim).not.toBe(first.claim)
    await db.exec('reset role; set role service_role')
    await db.query('select public.account_delivery_result($1,$2,true)',[first.id,first.claim])
    await as(admin); expect((await db.query<{status:string}>('select status from public.account_invitations')).rows[0].status).toBe('sending')
  })
  it('cutover denies previously issued noncollege sessions and all privileged APIs', async () => {
    await owner('update approvia_private.account_settings set college_only=true')
    await as(student)
    expect((await db.query('select * from public.classes')).rows).toHaveLength(0)
    await denied(() => db.query("select public.submit_typed_request('Title','Body',null,'{}'::jsonb)"), 'eligible verified email')
    await as(tutor); await denied(() => db.query("select public.decide_request($1,'APPROVED','OK')",[id(99)]), 'eligible verified email')
    await as(admin); await denied(() => db.query('select public.admin_setup_summary()'), 'Only active Admin')
  })
  it('migration preserves account identity and requires the approved destination', async () => {
    await owner(`insert into approvia_private.email_migrations(user_id,college_email) values('${admin}','admin@lbscek.ac.in')`)
    await denied(() => owner(`update auth.users set email='wrong@lbscek.ac.in' where id='${admin}'`), 'owner-approved')
    await owner(`update auth.users set email='admin@lbscek.ac.in' where id='${admin}'; update approvia_private.account_settings set college_only=true`)
    await as(admin)
    expect((await db.query<{value:{allowed:boolean}}>('select public.account_access_status() value')).rows[0].value.allowed).toBe(true)
    expect((await db.query('select id from public.profiles where id=$1',[admin])).rows).toHaveLength(1)
    expect((await db.query("select * from public.audit_logs where event='COLLEGE_EMAIL_VERIFIED'")).rows).toHaveLength(1)
  })
  it('rejects migration destinations owned by another account and direct mapping changes', async () => {
    await denied(() => owner(`insert into approvia_private.email_migrations(user_id,college_email) values('${tutor}','hod@lbscek.ac.in')`), 'another identity')
    await as(student); await denied(() => db.query('select * from approvia_private.email_migrations'), 'permission denied')
  })
  it('rejects an ineligible reviewer even if their profile is still active', async () => {
    await owner(`update public.profiles set onboarding_complete=false where id='${tutor}'`)
    await as(student)
    await denied(() => db.query("select public.submit_request('Title','Body',(select id from public.request_types where code='general'))"), 'Each reviewer')
    await as(admin)
    await denied(() => db.query("select public.admin_assign_responsibility('HOD',$1,$2,'New appointment')",[department,tutor]), 'onboarded Faculty')
  })
  it('preserves sequential approval privacy and all saved request history through email migration', async () => {
    await owner("update public.request_types set active=true where code='leave'")
    await as(admin)
    await db.query("select public.admin_assign_responsibility('HOD',$1,$2,'Appoint HOD')",[department,hod])
    await as(student)
    const submitted = await db.query<{id:string}>("select public.submit_typed_request('Leave','Reason',(select id from public.request_types where code='leave'),'{\"from_date\":\"2026-10-25\",\"to_date\":\"2026-10-26\"}') id")
    const requestId = submitted.rows[0].id
    await as(hod); expect((await db.query('select id from public.requests')).rows).toHaveLength(0)
    await as(tutor); await db.query("select public.decide_request($1,'APPROVED','Tutor approved')",[requestId])
    await as(hod); expect((await db.query('select id from public.requests')).rows).toHaveLength(1)
    await db.query("select public.decide_request($1,'APPROVED','HOD approved')",[requestId])
    await as(admin); expect((await db.query('select id from public.requests')).rows).toHaveLength(0)
    await as(student)
    const before = await db.query('select * from public.requests where id=$1',[requestId])
    const history = await db.query('select * from public.request_actions where request_id=$1 order by history_order',[requestId])
    expect(history.rows).toHaveLength(3)
    await owner(`insert into approvia_private.email_migrations(user_id,college_email) values('${student}','student@lbscek.ac.in'); update auth.users set email='student@lbscek.ac.in' where id='${student}'`)
    await as(student)
    expect((await db.query('select * from public.requests where id=$1',[requestId])).rows).toEqual(before.rows)
    expect((await db.query('select * from public.request_actions where request_id=$1 order by history_order',[requestId])).rows).toEqual(history.rows)
  })
  it('blocks direct email-change initiation until its mapping and delivery are ready', async () => {
    await denied(() => owner(`update auth.users set email_change='unapproved@lbscek.ac.in' where id='${student}'`), 'owner-approved')
    await owner(`insert into approvia_private.email_migrations(user_id,college_email) values('${student}','student@lbscek.ac.in')`)
    await denied(() => owner(`update auth.users set email_change='student@lbscek.ac.in' where id='${student}'`), 'enabled email service')
    await enable()
    await owner(`update auth.users set email_change='student@lbscek.ac.in' where id='${student}'`)
  })
  it('prevents invitation and migration reservations from claiming the same college address', async () => {
    await enable()
    await owner(`insert into approvia_private.email_migrations(user_id,college_email) values('${admin}','new@lbscek.ac.in')`)
    await denied(() => reserve(), 'reserved for an existing account migration')
    await reserve('another@lbscek.ac.in')
    await denied(() => owner(`insert into approvia_private.email_migrations(user_id,college_email) values('${student}','another@lbscek.ac.in')`), 'reserved by an invitation')
  })
  it('does not regress completed onboarding when a delivery response arrives late', async () => {
    const reservation = await bound(); await onboard()
    await db.query('select public.account_delivery_result($1,$2,false)',[reservation.id,reservation.claim])
    await as(admin)
    expect((await db.query<{status:string}>('select status from public.account_invitations')).rows[0].status).toBe('complete')
    await denied(() => db.query('select approvia_private.can_read_request_d15($1)',[id(99)]), 'permission denied')
    await denied(() => db.query('select claim from public.account_invitations'), 'permission denied')
  })
})

async function denied(action: () => Promise<unknown>, expected: string) {
  await db.exec('savepoint expected_denial')
  await expect(action()).rejects.toThrow(expected)
  await db.exec('rollback to savepoint expected_denial; release savepoint expected_denial')
}
