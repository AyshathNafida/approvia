import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { accountOperation, isCollegeEmail, loadAccountAccess, type AccountAccess } from './lib/accounts'
import { supabase } from './lib/supabase'

const message = (error: unknown) => error instanceof Error ? error.message : 'Please try again.'

export function PasswordSetup({ mode, onDone }: { mode: 'invite' | 'recovery'; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !supabase) return
    if (password !== confirmation) { setError('Passwords must match.'); return }
    setBusy(true); setError('')
    try {
      if (mode === 'invite') await accountOperation('onboard', { password })
      else {
        const result = await supabase.auth.updateUser({ password })
        if (result.error) throw new Error('Password update failed. Request a fresh recovery link or choose a different password.')
      }
      setPassword(''); setConfirmation('')
      const signedOut = await supabase.auth.signOut({ scope: 'local' })
      if (signedOut.error) throw new Error('Password saved. Please sign out and sign in again.')
      onDone()
    } catch (failure) { setError(message(failure)) } finally { setBusy(false) }
  }
  return <section className="auth-card account-form"><h2>{mode === 'invite' ? 'Finish account setup' : 'Choose a new password'}</h2>
    <p>Use 12–128 characters. Your password is private; your administrator cannot see it.</p>
    <form onSubmit={submit}><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      <label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
      <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : mode === 'invite' ? 'Complete setup' : 'Save password'}</button></form>
    {error && <p role="alert" className="error">{error}</p>}</section>
}

export function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('Checking email availability…')
  const [error, setError] = useState('')
  useEffect(() => {
    let mounted = true
    accountOperation('settings').then(result => {
      if (mounted) { setEnabled(result.email_enabled === true); setNotice(result.email_enabled ? '' : 'Email recovery is disabled until email setup is ready. Contact your administrator.') }
    }).catch(() => { if (mounted) setNotice('Email recovery is currently unavailable. Contact your administrator.') })
    return () => { mounted = false }
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !enabled) return
    if (!isCollegeEmail(email)) { setError('Use your @lbscek.ac.in college email address.'); return }
    setBusy(true); setError('')
    try { const result = await accountOperation('recover', { email: email.trim().toLowerCase() }); setNotice(result.message) } catch (failure) { setError(message(failure)) } finally { setBusy(false) }
  }
  return <section className="auth-card account-form"><h2>Reset your password</h2><form onSubmit={submit}><label htmlFor="recovery-email">College email</label><input id="recovery-email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={!enabled || busy} /><button className="primary-button" disabled={!enabled || busy}>{busy ? 'Sending…' : 'Send reset email'}</button></form>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="error">{error}</p>}<button className="secondary-button" onClick={onBack}>Back to sign in</button></section>
}

export function MigrationNotice({ access }: { access: AccountAccess }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  async function migrate() {
    setBusy(true)
    try { setNotice((await accountOperation('migrate')).message) } catch (failure) { setNotice(message(failure)) } finally { setBusy(false) }
  }
  return <section className="notice" aria-label="College email migration"><h2>Move to your college email</h2>
    <p>Your requests, assignments, and history will stay with this account.</p>
    {access.migration_email ? <><p>Approved address: {access.migration_email}</p><button className="secondary-button" disabled={!access.email_enabled || busy} onClick={() => void migrate()}>{busy ? 'Sending…' : 'Send email change confirmations'}</button></> : <p>Ask the system owner to approve your @lbscek.ac.in address.</p>}
    {!access.email_enabled && <p>Email changes are disabled until email setup is verified.</p>}{notice && <p role="status">{notice}</p>}</section>
}

export default function AccountGate({ session, children }: { session: Session; children: ReactNode }) {
  const [access, setAccess] = useState<AccountAccess | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let mounted = true
    loadAccountAccess().then(value => { if (mounted) { setAccess(value); setError('') } }).catch(failure => { if (mounted) { setAccess(null); setError(message(failure)) } })
    return () => { mounted = false }
  }, [session, retry])
  if (error) return <section className="auth-card"><p role="alert" className="error">{error}</p><button onClick={() => { setError(''); setRetry(value => value + 1) }}>Retry access check</button></section>
  if (!access) return <p role="status">Checking account access…</p>
  if (access.pending_invitation) return <PasswordSetup mode="invite" onDone={() => window.location.assign('/')} />
  return <>{access.needs_migration && <MigrationNotice access={access} />}{access.allowed ? children : <section className="auth-card"><h2>Account access is unavailable</h2><p>Use an active, verified college account with completed setup. Contact your administrator if you need help.</p></section>}</>
}
