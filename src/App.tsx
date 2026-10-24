import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Workspace from './Workspace'
import AccountGate, { ForgotPassword, PasswordSetup } from './AccountAccess'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [forgot, setForgot] = useState(false)
  const [callback, setCallback] = useState(() => {
    const path = window.location.pathname
    return path === '/auth/invite' ? 'invite' : path === '/auth/recovery' ? 'recovery' : path === '/auth/email-change' ? 'email-change' : null
  })
  const [callbackError] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    return params.has('error') || new URLSearchParams(window.location.search).has('error')
  })
  function finishCallback() {
    window.history.replaceState(null, '', '/')
    setCallback(null); setSession(null); setError(''); setForgot(false)
  }

  useEffect(() => {
    if (!supabase) return
    let mounted = true
    let receivedAuthEvent = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true
      if (mounted) {
        setSession(nextSession)
        setCheckingSession(false)
      }
    })
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      // Supabase consumes the callback session first; strip token-bearing URLs
      // even when a newer Auth event wins the session-restoration race.
      if (window.location.pathname.startsWith('/auth/')) window.history.replaceState(null, '', window.location.pathname)
      if (!mounted || receivedAuthEvent) return
      setSession(data.session)
      setCheckingSession(false)
      if (sessionError) setError('Could not restore your session. Please sign in again.')
    }).catch(() => {
      if (window.location.pathname.startsWith('/auth/')) window.history.replaceState(null, '', window.location.pathname)
      if (!mounted || receivedAuthEvent) return
      setCheckingSession(false)
      setError('Could not restore your session. Please sign in again.')
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    setError('')
    setBusy(true)
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (loginError) {
        setError(loginError.code === 'email_not_confirmed'
          ? 'Please verify your email before signing in.'
          : 'Unable to sign in. Check your email and password and try again.')
      } else {
        setSession(data.session)
        setPassword('')
        setShowPassword(false)
      }
    } catch {
      setError('Unable to connect. Check your internet connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    if (!supabase || busy) return false
    setError('')
    setBusy(true)
    try {
      const { error: logoutError } = await supabase.auth.signOut({ scope: 'local' })
      if (logoutError) { setError('Unable to sign out. Please try again.'); return false }
      setSession(null)
      return true
    } catch {
      setError('Unable to sign out. Check your connection and try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <header className="app-header"><div className="brand"><span className="brand-mark" aria-hidden="true">A</span> Approvia</div>{session && <div className="signed-in-header"><p className="account-email">{session.user.email}</p><button className="secondary-button" type="button" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button></div>}</header>
      {callback ? <div className="account-flow">{checkingSession ? <p role="status">Checking your email link…</p> : callbackError || (!session && callback !== 'email-change') ? <section className="auth-card"><h2>Email link unavailable</h2><p>This link is invalid, expired, or has already been used. Request a fresh invitation from Admin or a new password reset email.</p><button className="secondary-button" onClick={finishCallback}>Back to sign in</button></section> : callback === 'email-change' ? <section className="auth-card"><h2>Email confirmation received</h2><p>If another confirmation is required, check both inboxes. Sign out and sign in with your confirmed college email once the change is complete.</p><button className="secondary-button" onClick={async () => { if (!session || await signOut()) finishCallback() }}>Return to sign in</button></section> : <PasswordSetup mode={callback as 'invite' | 'recovery'} onDone={finishCallback} />}</div> : session ? <><AccountGate key={`${session.user.id}:${session.user.email}`} session={session}><Workspace key={session.user.id} userId={session.user.id} /></AccountGate>{error && <p className="error" role="alert">{error}</p>}</> : forgot ? <div className="account-flow"><ForgotPassword onBack={() => setForgot(false)} /></div> : <>
      <div className="content">
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Institutional approval management</p>
        <h1 id="page-title">A clearer path<br />to every approval.</h1>
        <p className="description">A central place for students and faculty to manage requests, follow approval progress, and keep a record of every decision.</p>
        <p className="note">Your institution. Your requests. One place to stay connected.</p>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        {checkingSession ? <p role="status">Checking your session…</p> : (
          <>
            <p className="eyebrow">Welcome back</p>
            <h2 id="auth-title">Sign in to Approvia</h2>
            <p className="auth-copy">Enter your email and password to continue.</p>
            {!supabase && <p role="status" className="notice">Sign-in is currently unavailable. Please contact your administrator.</p>}
            <form onSubmit={signIn}>
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" autoComplete="username" placeholder="name@lbscek.ac.in" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy || !supabase} />
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy || !supabase} />
                <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} disabled={busy || !supabase}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
              <button className="primary-button" type="submit" disabled={busy || !supabase}>{busy ? 'Signing in…' : 'Sign in'}</button>
            </form>
            <button className="secondary-button" type="button" disabled={!supabase || busy} onClick={() => setForgot(true)}>Forgot password?</button>
            <p className="account-help">Need an account or help signing in? Contact your administrator.</p>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      </div>
      </>}
      {callback && error && <p className="error" role="alert">{error}</p>}
      <footer>Approvia · Institutional Digital Approval Management System</footer>
    </main>
  )
}

export default App
