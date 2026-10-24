import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { assignResponsibility, loadAdminData, inviteAccount, saveClass, saveDepartment, updateProfile, type AdminData, type Responsibility } from './lib/admin'
import type { Profile } from './lib/requests'
import { isCollegeEmail } from './lib/accounts'
import './AdminWorkspace.css'

type Tab = 'Departments' | 'Class batches' | 'Accounts' | 'Assignments'
const emptyClass = { id: '', department_id: '', name: '', batch_start_year: '', tutor_id: '', active: true, reason: '' }
const emptyAccount = { id: '', email: '', full_name: '', account_type: 'FACULTY' as 'STUDENT' | 'FACULTY', class_id: '', active: true }
const failureMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'

export default function AdminWorkspace({ profile }: { profile: Profile }) {
  const [data, setData] = useState<AdminData | null>(null)
  const [tab, setTab] = useState<Tab>('Departments')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [department, setDepartment] = useState({ id: '', name: '', active: true })
  const [classForm, setClassForm] = useState(emptyClass)
  const [account, setAccount] = useState(emptyAccount)
  const [assignment, setAssignment] = useState({ responsibility: 'TUTOR' as Responsibility, scope_id: '', faculty_id: '', reason: '' })
  const generation = useRef({ value: 0 })
  const busyRef = useRef(false)

  const refresh = useCallback(async () => {
    const current = ++generation.current.value
    setLoading(true); setError('')
    try {
      const next = await loadAdminData()
      if (current === generation.current.value) setData(next)
    } catch (failure) {
      if (current === generation.current.value) { setData(null); setError(failureMessage(failure)) }
    } finally { if (current === generation.current.value) setLoading(false) }
  }, [])
  useEffect(() => {
    const counter = generation.current
    // oxlint-disable-next-line react/set-state-in-effect -- Load protected remote Admin configuration.
    void refresh()
    return () => { counter.value++ }
  }, [refresh])

  async function run(action: () => Promise<string>, reset: () => void) {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setError(''); setNotice('')
    const current = generation.current.value
    try {
      const result = await action()
      if (current !== generation.current.value) return
      reset(); setNotice(result)
      await refresh()
    } catch (failure) {
      if (current === generation.current.value) {
        const message = failureMessage(failure)
        setError(message)
        if (message.includes('Only active Admin')) setData(null)
      }
    } finally { busyRef.current = false; setBusy(false) }
  }
  const filtered = (value: string) => value.toLowerCase().includes(search.trim().toLowerCase())
  const faculty = data?.profiles.filter(p => p.account_type === 'FACULTY' && p.active && p.onboarding_complete && p.eligible) ?? []
  const departmentName = (id: string) => data?.departments.find(d => d.id === id)?.name ?? 'Unknown department'
  const facultyName = (id: string | null) => data?.profiles.find(p => p.id === id)?.full_name ?? 'Unassigned'
  const className = (id: string) => {
    const c = data?.classes.find(c => c.id === id)
    return c ? `${departmentName(c.department_id)} · ${c.name} · ${c.batch_start_year ? `${c.batch_start_year}–${c.batch_end_year}` : 'Batch not set'}` : 'Unknown class'
  }
  const selectedClass = data?.classes.find(c => c.id === classForm.id)
  const tutorChanged = !classForm.id || selectedClass?.tutor_id !== classForm.tutor_id
  const switchTab = (next: Tab) => { setTab(next); setSearch(''); setError(''); setNotice('') }

  async function submitDepartment(event: FormEvent) {
    event.preventDefault()
    await run(async () => { await saveDepartment(department.id || null, department.name.trim(), department.active); return 'Department saved.' }, () => setDepartment({ id: '', name: '', active: true }))
  }
  async function submitClass(event: FormEvent) {
    event.preventDefault()
    const start = Number(classForm.batch_start_year)
    if (!Number.isInteger(start) || start < 1900 || start > 9995) { setError('Enter a valid batch start year.'); return }
    if (tutorChanged && !classForm.reason.trim()) { setError('Enter a reason for the Tutor assignment.'); return }
    await run(async () => {
      const result = await saveClass({ ...classForm, id: classForm.id || null, batch_start_year: start, batch_end_year: start + 4, reason: classForm.reason.trim() || 'Class configuration updated.' })
      return `Class saved. ${result.reassigned_count} pending request${result.reassigned_count === 1 ? '' : 's'} transferred.`
    }, () => setClassForm(emptyClass))
  }
  async function submitAccount(event: FormEvent) {
    event.preventDefault()
    if (!account.id && !isCollegeEmail(account.email)) { setError('Use an @lbscek.ac.in college email address.'); return }
    await run(async () => {
      const classId = account.account_type === 'STUDENT' ? account.class_id : null
      if (account.id) await updateProfile(account.id, account.full_name.trim(), classId, account.active)
      else await inviteAccount(account.email.trim().toLowerCase(), account.full_name.trim(), account.account_type, classId)
      return account.id ? 'Profile updated.' : 'Invitation sent. Account setup is pending.'
    }, () => setAccount(emptyAccount))
  }
  async function submitAssignment(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      const count = await assignResponsibility(assignment.responsibility, ['TUTOR', 'HOD'].includes(assignment.responsibility) ? assignment.scope_id : null, assignment.faculty_id || null, assignment.reason.trim())
      return `Assignment saved. ${count} pending request${count === 1 ? '' : 's'} transferred.`
    }, () => setAssignment({ responsibility: 'TUTOR', scope_id: '', faculty_id: '', reason: '' }))
  }

  return <div className="workspace admin-workspace">
    <div className="workspace-heading"><div><p className="eyebrow">Admin workspace</p><h1>Administration</h1><p>Hello, {profile.full_name}. Set up your institution and faculty assignments.</p></div><button type="button" className="secondary-button" disabled={busy || loading} onClick={() => void refresh()}>Refresh</button></div>
    {notice && <p className="success-message" role="status">{notice}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading administration…</p> : !data ? <button className="secondary-button" onClick={() => void refresh()}>Try again</button> : <>
      <section className="admin-gaps" aria-label="Setup gaps"><strong>Setup checks</strong>
        <p>{data.classes.filter(c => c.active && (!c.batch_start_year || !c.tutor_id || !faculty.some(p => p.id === c.tutor_id))).length} active classes need batch details or an active Tutor.</p>
        <p>{data.departments.filter(d => d.active && !data.assignments.some(a => a.responsibility === 'HOD' && a.department_id === d.id && faculty.some(p => p.id === a.faculty_id))).length} active departments need an active HOD.</p>
        <p>Dean: {facultyName(data.assignments.find(a => a.responsibility === 'DEAN')?.faculty_id ?? null)} · Principal: {facultyName(data.assignments.find(a => a.responsibility === 'PRINCIPAL')?.faculty_id ?? null)}</p>
        {data.unresolved_pending_classes > 0 && <p className="error">{data.unresolved_pending_classes} pending requests need owner review of their original class before Tutor changes.</p>}
        <p>Request types use configured Tutor, HOD, Dean, and Principal assignments. Each required role on a route needs a different Faculty member.</p>
      </section>
      <nav className="admin-tabs" aria-label="Administration sections">{(['Departments', 'Class batches', 'Accounts', 'Assignments'] as Tab[]).map(t => <button type="button" key={t} className={`secondary-button ${tab === t ? 'selected' : ''}`} aria-current={tab === t ? 'page' : undefined} disabled={busy} onClick={() => switchTab(t)}>{t}</button>)}</nav>
      <label htmlFor="admin-search">Search {tab.toLowerCase()}</label><input id="admin-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name" />
      {tab === 'Accounts' && <section className="panel"><h2>Invitations</h2>{!data.email_enabled && <p role="status">Invitations are disabled until SMTP email setup is verified.</p>}{data.invitations.length ? <ul className="admin-list">{data.invitations.map(invitation => <li key={invitation.id}><div><strong>{invitation.full_name}</strong><span>{invitation.email} · {invitation.account_type} · {invitation.status === 'sent' ? 'Awaiting setup' : invitation.status === 'complete' ? 'Setup complete' : invitation.status}</span>{invitation.error_code && <p className="error">Email delivery failed. Check email configuration and retry.</p>}</div>{invitation.status !== 'complete' && <button className="secondary-button" disabled={busy || !data.email_enabled} onClick={() => void run(async () => { const result = await inviteAccount(invitation.email, invitation.full_name, invitation.account_type, invitation.class_id); return result.message }, () => {})}>Resend invitation for {invitation.email}</button>}</li>)}</ul> : <p>No invitations yet.</p>}</section>}
      <div className="admin-grid"><section className="panel">
        <h2>{tab}</h2>
        {tab === 'Departments' && <ul className="admin-list">{data.departments.filter(d => filtered(d.name)).map(d => <li key={d.id}><div><strong>{d.name}</strong><span>{d.active ? 'Active' : 'Inactive'}</span></div><button className="secondary-button" disabled={busy} onClick={() => setDepartment(d)}>Edit {d.name}</button></li>)}</ul>}
        {tab === 'Class batches' && <ul className="admin-list">{data.classes.filter(c => filtered(className(c.id))).map(c => <li key={c.id}><div><strong>{className(c.id)}</strong><span>{c.active ? 'Active' : 'Inactive'} · Tutor: {facultyName(c.tutor_id)}</span></div><button className="secondary-button" disabled={busy} onClick={() => setClassForm({ id: c.id, department_id: c.department_id, name: c.name, batch_start_year: c.batch_start_year?.toString() ?? '', tutor_id: c.tutor_id ?? '', active: c.active, reason: '' })}>Edit {c.name}</button></li>)}</ul>}
        {tab === 'Accounts' && <ul className="admin-list">{data.profiles.filter(p => filtered(`${p.full_name} ${p.account_type}`)).map(p => <li key={p.id}><div><strong>{p.full_name}</strong><span>{p.account_type} · {p.active ? 'Active' : 'Inactive'}{p.class_id ? ` · ${className(p.class_id)}` : ''}</span></div>{p.account_type !== 'ADMIN' && <button className="secondary-button" disabled={busy} onClick={() => setAccount({ id: p.id, email: '', full_name: p.full_name, account_type: p.account_type as 'STUDENT' | 'FACULTY', class_id: p.class_id ?? '', active: p.active })}>Edit {p.full_name}</button>}</li>)}</ul>}
        {tab === 'Assignments' && <ul className="admin-list">{[...data.classes.filter(c => c.tutor_id).map(c => ({ id: c.id, responsibility: 'TUTOR' as Responsibility, scope_id: c.id, label: className(c.id), faculty_id: c.tutor_id! })), ...data.assignments.map(a => ({ id: a.id, responsibility: a.responsibility as Responsibility, scope_id: a.department_id ?? '', label: a.department_id ? departmentName(a.department_id) : 'Institution', faculty_id: a.faculty_id }))].filter(a => filtered(`${a.responsibility} ${a.label} ${facultyName(a.faculty_id)}`)).map(a => <li key={a.id}><div><strong>{a.responsibility} · {a.label}</strong><span>{facultyName(a.faculty_id)}</span></div><button className="secondary-button" disabled={busy} onClick={() => setAssignment({ responsibility: a.responsibility, scope_id: a.scope_id, faculty_id: a.faculty_id, reason: '' })}>Change {a.responsibility} · {a.label}</button></li>)}</ul>}
        {!data.departments.length && tab === 'Departments' && <p className="empty-state">Create your first department.</p>}
        {!data.classes.length && tab === 'Class batches' && <p className="empty-state">Create a class batch after adding a department and Faculty profile.</p>}
      </section><section className="panel">
        <fieldset disabled={busy} className="admin-fieldset">
          {tab === 'Departments' && <form onSubmit={submitDepartment}><h2>{department.id ? 'Edit department' : 'New department'}</h2><label htmlFor="department-name">Department name</label><input id="department-name" required maxLength={100} value={department.name} onChange={e => setDepartment({ ...department, name: e.target.value })} /><StatusField active={department.active} onChange={active => setDepartment({ ...department, active })} /><button className="primary-button">Save department</button><button type="button" className="secondary-button" onClick={() => setDepartment({ id: '', name: '', active: true })}>New department</button></form>}
          {tab === 'Class batches' && <form onSubmit={submitClass}><h2>{classForm.id ? 'Edit class batch' : 'New class batch'}</h2><label htmlFor="class-department">Department</label><select id="class-department" required value={classForm.department_id} onChange={e => setClassForm({ ...classForm, department_id: e.target.value })}><option value="">Choose department</option>{data.departments.filter(d => d.active || d.id === classForm.department_id).map(d => <option key={d.id} value={d.id}>{d.name}{d.active ? '' : ' (inactive)'}</option>)}</select><label htmlFor="class-name">Class / division name</label><input id="class-name" required maxLength={100} value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })} /><label htmlFor="batch-start">Batch start year</label><input id="batch-start" type="number" min={1900} max={9995} required value={classForm.batch_start_year} onChange={e => setClassForm({ ...classForm, batch_start_year: e.target.value })} /><p className="field-note">Batch end: {classForm.batch_start_year ? Number(classForm.batch_start_year) + 4 : '—'}. The Tutor stays with this class for four years.</p><label htmlFor="class-tutor">Tutor</label><select id="class-tutor" required value={classForm.tutor_id} onChange={e => setClassForm({ ...classForm, tutor_id: e.target.value })}><option value="">Choose Faculty Tutor</option>{faculty.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>{tutorChanged && <><label htmlFor="class-reason">Tutor assignment reason</label><textarea id="class-reason" required maxLength={2000} value={classForm.reason} onChange={e => setClassForm({ ...classForm, reason: e.target.value })} /><p className="field-note">Saving a replacement transfers this class's pending requests. Completed decisions stay unchanged.</p></>}<StatusField active={classForm.active} onChange={active => setClassForm({ ...classForm, active })} /><button className="primary-button">Save class batch</button><button type="button" className="secondary-button" onClick={() => setClassForm(emptyClass)}>New class batch</button></form>}
          {tab === 'Accounts' && <form onSubmit={submitAccount}><h2>{account.id ? 'Edit profile' : 'Invite account'}</h2>{!account.id && <><p className="field-note">Invite a Student or Faculty member after checking institutional records. They will verify their college email and set their own password.</p><label htmlFor="profile-email">College email</label><input id="profile-email" type="email" required value={account.email} onChange={e => setAccount({ ...account, email: e.target.value })} /></>}<label htmlFor="profile-name">Full name</label><input id="profile-name" required maxLength={100} value={account.full_name} onChange={e => setAccount({ ...account, full_name: e.target.value })} /><label htmlFor="profile-type">Account type</label><select id="profile-type" disabled={!!account.id} value={account.account_type} onChange={e => setAccount({ ...account, account_type: e.target.value as 'STUDENT' | 'FACULTY', class_id: '' })}><option value="FACULTY">Faculty</option><option value="STUDENT">Student</option></select>{account.account_type === 'STUDENT' && <><label htmlFor="profile-class">Student class batch</label><select id="profile-class" required value={account.class_id} onChange={e => setAccount({ ...account, class_id: e.target.value })}><option value="">Choose class batch</option>{data.classes.filter(c => (c.active && data.departments.some(d => d.id === c.department_id && d.active)) || c.id === account.class_id).map(c => <option key={c.id} value={c.id}>{className(c.id)}{c.active ? '' : ' (inactive)'}</option>)}</select><p className="field-note">A student with pending requests cannot move class or be deactivated.</p></>}{account.id && <StatusField active={account.active} onChange={active => setAccount({ ...account, active })} />}<button className="primary-button" disabled={!account.id && !data.email_enabled}>{account.id ? 'Save profile' : 'Send invitation'}</button><button type="button" className="secondary-button" onClick={() => setAccount(emptyAccount)}>Invite another account</button></form>}
          {tab === 'Assignments' && <form onSubmit={submitAssignment}><h2>Assign responsibility</h2><label htmlFor="responsibility">Responsibility</label><select id="responsibility" value={assignment.responsibility} onChange={e => setAssignment({ ...assignment, responsibility: e.target.value as Responsibility, scope_id: '', faculty_id: '' })}>{(['TUTOR','HOD','DEAN','PRINCIPAL'] as Responsibility[]).map(r => <option key={r}>{r}</option>)}</select>{['TUTOR','HOD'].includes(assignment.responsibility) && <><label htmlFor="assignment-scope">{assignment.responsibility === 'TUTOR' ? 'Class batch' : 'Department scope'}</label><select id="assignment-scope" required value={assignment.scope_id} onChange={e => setAssignment({ ...assignment, scope_id: e.target.value })}><option value="">Choose scope</option>{assignment.responsibility === 'TUTOR' ? data.classes.map(c => <option key={c.id} value={c.id}>{className(c.id)}</option>) : data.departments.map(d => <option key={d.id} value={d.id}>{d.name}{d.active ? '' : ' (inactive)'}</option>)}</select></>}<label htmlFor="assignment-faculty">Faculty account</label><select id="assignment-faculty" value={assignment.faculty_id} onChange={e => setAssignment({ ...assignment, faculty_id: e.target.value })}><option value="">Remove assignment</option>{faculty.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select><label htmlFor="assignment-reason">Change reason</label><textarea id="assignment-reason" required maxLength={2000} value={assignment.reason} onChange={e => setAssignment({ ...assignment, reason: e.target.value })} /><p className="field-note">Replacement transfers unfinished reviews with history. The new holder also sees completed history for this responsibility. Removing an assignment is blocked while reviews depend on it.</p><button className="primary-button">Save assignment</button></form>}
        </fieldset>
      </section></div>
      {tab === 'Assignments' && <section className="panel admin-history"><h2>Assignment history</h2><p className="field-note">Latest 100 configuration changes. Request contents and decision comments are not shown.</p>{data.changes.length ? <ol className="history-list">{data.changes.map(c => <li key={c.id}><strong>{c.responsibility} · {c.class_id ? className(c.class_id) : c.department_id ? departmentName(c.department_id) : 'Institution'}</strong><span>{facultyName(c.previous_faculty_id)} → {facultyName(c.faculty_id)} · {new Date(c.created_at).toLocaleString()} · {c.actor_id ? facultyName(c.actor_id) : 'Owner setup'}</span><p>{c.reason}</p></li>)}</ol> : <p>No assignment changes recorded.</p>}</section>}
    </>}
  </div>
}

function StatusField({ active, onChange }: { active: boolean; onChange: (value: boolean) => void }) {
  return <><label htmlFor="record-status">Status</label><select id="record-status" value={active ? 'active' : 'inactive'} onChange={e => onChange(e.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></>
}
