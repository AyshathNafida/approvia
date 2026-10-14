import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { decideRequest, loadProfile, loadRequests, loadRequestTypes, submitRequest, type ApprovalRequest, type Profile, type RequestType, type RequestStatus } from './lib/requests'
import './Workspace.css'
import AdminWorkspace from './AdminWorkspace'

const labels: Record<RequestStatus, string> = { IN_REVIEW: 'In review', APPROVED: 'Approved', REJECTED: 'Rejected' }
const formatDate = (date: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'

export default function Workspace({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [types, setTypes] = useState<RequestType[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<RequestStatus | 'ALL'>('ALL')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [typeId, setTypeId] = useState('')
  const [comment, setComment] = useState('')
  const [actionError, setActionError] = useState('')
  const generation = useRef({ value: 0 })
  const selected = requests.find((request) => request.id === selectedId)

  const refresh = useCallback(async (initial = false) => {
    const version = ++generation.current.value
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      const account = await loadProfile(userId)
      if (version !== generation.current.value) return
      setProfile(account)
      if (!account?.active || account.account_type === 'ADMIN') {
        setRequests([])
        setTypes([])
        return
      }
      const [list, availableTypes] = await Promise.all([
        loadRequests(), account.account_type === 'STUDENT' ? loadRequestTypes() : Promise.resolve([]),
      ])
      if (version !== generation.current.value) return
      setRequests(list)
      setTypes(availableTypes)
      setTypeId((current) => availableTypes.some((type) => type.id === current) ? current : availableTypes[0]?.id ?? '')
    } catch (failure) {
      if (version !== generation.current.value) return
      // Do not keep displaying previously authorized data after a failed refresh.
      setRequests([])
      setError(message(failure))
    } finally {
      if (version === generation.current.value) { setLoading(false); setRefreshing(false) }
    }
  }, [userId])

  useEffect(() => {
    const counter = generation.current
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize the authenticated workspace with remote Supabase data.
    void refresh(true)
    return () => { counter.value++ }
  }, [refresh])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !title.trim() || !description.trim() || !typeId) return
    setBusy(true); setActionError(''); setNotice('')
    try {
      const id = await submitRequest(title.trim(), description.trim(), typeId)
      setTitle(''); setDescription(''); setSelectedId(id); setFilter('ALL')
      setNotice('Your request was submitted to your class Tutor.')
      await refresh()
    } catch (failure) { setActionError(message(failure)) }
    finally { setBusy(false) }
  }

  async function decide(decision: 'APPROVED' | 'REJECTED') {
    if (!selected || busy) return
    if (!comment.trim()) { setActionError('Enter a decision comment before approving or rejecting.'); return }
    setBusy(true); setActionError(''); setNotice('')
    try {
      await decideRequest(selected.id, decision, comment.trim())
      setComment('')
      setNotice(`The request was ${decision === 'APPROVED' ? 'approved' : 'rejected'}.`)
      await refresh()
    } catch (failure) {
      setActionError(message(failure))
      await refresh()
    } finally { setBusy(false) }
  }

  if (loading) return <section className="workspace-state" role="status">Loading your workspace…</section>
  if (error) return <section className="workspace-state"><p className="error" role="alert">{error}</p><button className="secondary-button" onClick={() => void refresh(true)}>Try again</button></section>
  if (!profile) return <section className="workspace-state"><h1>Your account is almost ready.</h1><p>Your administrator needs to assign your student or faculty profile before you can use requests.</p><button className="secondary-button" onClick={() => void refresh(true)}>Check again</button></section>
  if (!profile.active) return <section className="workspace-state"><h1>Account inactive</h1><p>Contact your administrator to restore access.</p></section>
  if (profile.account_type === 'ADMIN') return <AdminWorkspace profile={profile} />

  const student = profile.account_type === 'STUDENT'
  const visibleRequests = requests.filter((request) => filter === 'ALL' || request.status === filter)
  const canDecide = !student && selected?.status === 'IN_REVIEW' && selected.approval_steps.some((step) => step.approver_id === userId && step.status === 'PENDING')

  return (
    <div className="workspace">
      <div className="workspace-heading"><div><p className="eyebrow">{student ? 'Student workspace' : 'Tutor workspace'}</p><h1>Hello, {profile.full_name}.</h1><p>{student ? 'Submit a request and follow its progress.' : 'Review the requests assigned to you.'}</p></div><button className="secondary-button" onClick={() => void refresh()} disabled={refreshing || busy}>{refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
      <div className="stats"><div><strong>{requests.length}</strong><span>Total requests</span></div><div><strong>{requests.filter((request) => request.status === 'IN_REVIEW').length}</strong><span>In review</span></div><div><strong>{requests.filter((request) => request.status === 'APPROVED').length}</strong><span>Approved</span></div></div>
      {notice && <p className="success-message" role="status">{notice}</p>}
      <div className="workspace-grid">
        <div className="workspace-column">
          {student && <section className="panel"><p className="eyebrow">New request</p><h2>What do you need approved?</h2><form onSubmit={create}>
            <label htmlFor="request-type">Request type</label><select id="request-type" value={typeId} onChange={(event) => setTypeId(event.target.value)} disabled={busy || !types.length}>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
            <p className="field-note">Approval route: {types.find((type) => type.id === typeId)?.approval_route.join(' → ') ?? 'Unavailable'}. Your class Tutor is assigned automatically.</p>
            <label htmlFor="request-title">Title</label><input id="request-title" maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A short summary of your request" required disabled={busy} />
            <label htmlFor="request-description">Description</label><textarea id="request-description" maxLength={5000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what you need and why." required disabled={busy} />
            <p className="field-note">Check your details before submitting. Submitted requests cannot be edited in this version.</p>
            <button className="primary-button" disabled={busy || !typeId || !title.trim() || !description.trim()}>{busy ? 'Submitting…' : 'Submit request'}</button>
            {actionError && <p className="error" role="alert">{actionError}</p>}
          </form></section>}
          <section className="panel"><div className="list-heading"><h2>{student ? 'Your requests' : 'Assigned requests'}</h2><label className="sr-only" htmlFor="status-filter">Filter requests by status</label><select id="status-filter" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="ALL">All statuses</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            {!visibleRequests.length ? <p className="empty-state">{requests.length ? 'No requests match this status.' : student ? 'Your submitted requests will appear here.' : 'No requests are assigned to you yet.'}</p> : <ul className="request-list">{visibleRequests.map((request) => <li key={request.id}><button className={`request-item ${selectedId === request.id ? 'selected' : ''}`} onClick={() => { setSelectedId(request.id); setComment(''); setActionError('') }} aria-pressed={selectedId === request.id}><span className="request-item-top"><strong>{request.title}</strong><span className={`badge ${request.status.toLowerCase()}`}>{labels[request.status]}</span></span><span className="request-item-meta">{student ? request.class_name : request.student_name} · {formatDate(request.created_at)}</span></button></li>)}</ul>}
          </section>
        </div>
        <section className="panel detail-panel" aria-label="Request details">
          {!selected ? <div className="empty-detail"><span aria-hidden="true">↗</span><h2>Every decision, in one place.</h2><p>Select a request to see its details, progress, and decision history.</p></div> : <>
            <div className="detail-heading"><p className="eyebrow">Request details</p><span className={`badge ${selected.status.toLowerCase()}`}>{labels[selected.status]}</span></div><h2>{selected.title}</h2><p className="request-reference">Reference {selected.id.slice(0, 8).toUpperCase()}</p>
            <dl className="request-info"><div><dt>Student</dt><dd>{selected.student_name}</dd></div><div><dt>Class / department</dt><dd>{selected.class_name} · {selected.department_name}</dd></div><div><dt>Submitted</dt><dd>{formatDate(selected.created_at)}</dd></div></dl>
            <h3>Description</h3><p className="request-description">{selected.description}</p>
            <div className="approval-progress"><span>Tutor review</span><strong>{selected.status === 'IN_REVIEW' ? 'Awaiting decision' : labels[selected.status]}</strong></div>
            {canDecide && <div className="decision-form"><label htmlFor="decision-comment">Decision comment</label><textarea id="decision-comment" maxLength={2000} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Explain your approval or rejection." disabled={busy} required /><div className="decision-buttons"><button className="primary-button" onClick={() => void decide('APPROVED')} disabled={busy}>Approve</button><button className="reject-button" onClick={() => void decide('REJECTED')} disabled={busy}>Reject</button></div>{busy && <p role="status">Saving your decision…</p>}{actionError && <p className="error" role="alert">{actionError}</p>}</div>}
            <h3>Activity history</h3><ol className="history-list">{[...selected.request_actions].sort((a, b) => a.created_at.localeCompare(b.created_at) || (a.action === 'SUBMITTED' ? -1 : 1)).map((action) => <li key={action.id}><strong>{action.action === 'SUBMITTED' ? 'Submitted' : action.action === 'APPROVED' ? 'Approved' : action.action === 'REASSIGNED' ? 'Tutor reassigned' : 'Rejected'}</strong><span>{action.actor_name}{action.responsibility ? ` · ${action.responsibility}` : ''} · {formatDate(action.created_at)}</span>{action.comment && <p>{action.comment}</p>}</li>)}</ol>
          </>}
        </section>
      </div>
    </div>
  )
}
