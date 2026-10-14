import { expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
it('preserves legacy decisions and backfills only evidence-matched department scope',async()=>{
  const db=new PGlite()
  try {
    await db.exec(`create role authenticated;create role anon;create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;`)
    for(const name of ['202610120001_small_mvp.sql','202610140001_admin_setup.sql']) await db.exec(readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'))
    const tutor='10000000-0000-4000-8000-000000000001',student='10000000-0000-4000-8000-000000000002'
    await db.query('insert into auth.users(id) values($1),($2)',[tutor,student])
    await db.query("insert into profiles(id,full_name,account_type) values($1,'Original Tutor','FACULTY')",[tutor])
    const dept=(await db.query<{id:string}>("insert into departments(name) values('Original Department') returning id")).rows[0].id
    const batch=(await db.query<{id:string}>("insert into classes(name,department_id,tutor_id) values('Original Class',$1,$2) returning id",[dept,tutor])).rows[0].id
    await db.query("insert into profiles(id,full_name,account_type,class_id) values($1,'Student','STUDENT',$2)",[student,batch])
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[student]);await db.exec('set role authenticated')
    const complete=(await db.query<{id:string}>("select submit_request('Legacy','Details',(select id from request_types where code='general')) as id")).rows[0].id
    const unmatched=(await db.query<{id:string}>("select submit_request('Unmatched','Details',(select id from request_types where code='general')) as id")).rows[0].id
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[tutor]);await db.query("select decide_request($1,'APPROVED','Original decision')",[complete]);await db.exec('reset role')
    await db.query("update profiles set full_name='Renamed Tutor' where id=$1",[tutor])
    await db.query("update requests set department_name='Unmatched historical department' where id=$1",[unmatched])
    await db.exec(readFileSync(new URL('../supabase/migrations/202610140002_request_workflows.sql',import.meta.url),'utf8'))
    const rows=(await db.query<{id:string;submitted_department_id:string|null;type_code:string;status:string;route_snapshot:string[]}>('select id,submitted_department_id,type_code,status,route_snapshot from requests order by title')).rows
    expect(rows.find(r=>r.id===complete)).toMatchObject({submitted_department_id:dept,type_code:'general',status:'APPROVED',route_snapshot:['TUTOR']})
    expect(rows.find(r=>r.id===unmatched)?.submitted_department_id).toBeNull()
    expect((await db.query<{approver_name:string}>('select approver_name from approval_steps where request_id=$1',[complete])).rows[0].approver_name).toBe('Original Tutor')
    expect((await db.query("select * from request_types where active")).rows).toHaveLength(1)
    expect((await db.query<{comment:string}>("select comment from request_actions where request_id=$1 and action='APPROVED'",[complete])).rows[0].comment).toBe('Original decision')
  }finally{await db.close()}
},30000)
