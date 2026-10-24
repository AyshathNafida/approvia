// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import AccountGate, { ForgotPassword, PasswordSetup } from './AccountAccess'
import App from './App'

const api = vi.hoisted(() => ({ loadAccountAccess: vi.fn(), accountOperation: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), getSession: vi.fn(), onAuthStateChange: vi.fn() }))
vi.mock('./lib/accounts', () => ({ loadAccountAccess: api.loadAccountAccess, accountOperation: api.accountOperation, isCollegeEmail: (email: string) => /^[^@\s]+@lbscek\.ac\.in$/i.test(email.trim()) }))
vi.mock('./lib/supabase', () => ({ supabase: { auth: api } }))
vi.mock('./Workspace', () => ({ default: () => <p>Private workspace</p> }))
const session = { user: { id: 'user', email: 'student@lbscek.ac.in' } } as Session
const access = { allowed: true, email_enabled: true, college_only: false, pending_invitation: false, migration_email: null, needs_migration: false }
beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null,'','/')
  api.loadAccountAccess.mockResolvedValue(access)
  api.accountOperation.mockResolvedValue({ message: 'Email sent', email_enabled: true })
  api.updateUser.mockResolvedValue({ error: null })
  api.signOut.mockResolvedValue({ error: null })
  api.getSession.mockResolvedValue({ data: { session }, error: null })
  api.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})
afterEach(cleanup)

describe('account onboarding and access screens', () => {
  it('does not render the workspace until access has been checked', async () => {
    render(<AccountGate session={session}><p>Private workspace</p></AccountGate>)
    expect(screen.queryByText('Private workspace')).toBeNull()
    expect(await screen.findByText('Private workspace')).toBeTruthy()
  })
  it('fails closed when account verification fails', async () => {
    api.loadAccountAccess.mockRejectedValue(new Error('Access check failed'))
    render(<AccountGate session={session}><p>Private workspace</p></AccountGate>)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Private workspace')).toBeNull()
  })
  it('keeps a pending invitation out of the workspace and shows password setup', async () => {
    api.loadAccountAccess.mockResolvedValue({ ...access, allowed: false, pending_invitation: true })
    render(<AccountGate session={session}><p>Private workspace</p></AccountGate>)
    expect(await screen.findByText('Finish account setup')).toBeTruthy()
    expect(screen.queryByText('Private workspace')).toBeNull()
  })
  it('shows approved migration guidance while denying noncollege access after cutover', async () => {
    api.loadAccountAccess.mockResolvedValue({ ...access, allowed: false, needs_migration: true, migration_email: 'approved@lbscek.ac.in' })
    render(<AccountGate session={session}><p>Private workspace</p></AccountGate>)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Send email change confirmations' }))
    expect(api.accountOperation).toHaveBeenCalledWith('migrate')
    expect(screen.queryByText('Private workspace')).toBeNull()
  })
  it('does not send recovery mail before email setup is enabled', async () => {
    api.accountOperation.mockResolvedValue({ email_enabled: false })
    render(<ForgotPassword onBack={() => {}} />)
    expect(await screen.findByText(/Email recovery is disabled/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send reset email' }) as HTMLButtonElement).disabled).toBe(true)
    expect(api.accountOperation).toHaveBeenCalledTimes(1)
  })
  it('validates the college domain and shows generic recovery success', async () => {
    render(<ForgotPassword onBack={() => {}} />)
    const user = userEvent.setup()
    await waitFor(() => expect((screen.getByLabelText('College email') as HTMLInputElement).disabled).toBe(false))
    await user.type(screen.getByLabelText('College email'), 'user@gmail.com')
    await user.click(screen.getByRole('button', { name: 'Send reset email' }))
    expect((await screen.findByRole('alert')).textContent).toContain('@lbscek.ac.in')
    await user.clear(screen.getByLabelText('College email'))
    await user.type(screen.getByLabelText('College email'), 'USER@LBSCEK.AC.IN')
    await user.click(screen.getByRole('button', { name: 'Send reset email' }))
    expect(api.accountOperation).toHaveBeenCalledWith('recover', { email: 'user@lbscek.ac.in' })
    expect(await screen.findByText('Email sent')).toBeTruthy()
  })
  it('checks password confirmation and completes onboarding through the server', async () => {
    const done = vi.fn()
    render(<PasswordSetup mode="invite" onDone={done} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('New password'), 'new-password-example')
    await user.type(screen.getByLabelText('Confirm password'), 'different-password')
    await user.click(screen.getByRole('button', { name: 'Complete setup' }))
    expect(await screen.findByText('Passwords must match.')).toBeTruthy()
    expect(api.accountOperation).not.toHaveBeenCalled()
    await user.clear(screen.getByLabelText('Confirm password'))
    await user.type(screen.getByLabelText('Confirm password'), 'new-password-example')
    await user.click(screen.getByRole('button', { name: 'Complete setup' }))
    expect(api.accountOperation).toHaveBeenCalledWith('onboard', { password: 'new-password-example' })
    expect(api.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(done).toHaveBeenCalled()
  })
  it('renders recovery before the workspace and scrubs callback tokens', async () => {
    window.history.replaceState(null,'','/auth/recovery#access_token=private&refresh_token=private&type=recovery')
    render(<App />)
    expect(await screen.findByText('Choose a new password')).toBeTruthy()
    expect(screen.queryByText('Private workspace')).toBeNull()
    expect(window.location.hash).toBe('')
  })
  it('shows an expired-link explanation without opening a restored workspace', async () => {
    window.history.replaceState(null,'','/auth/invite#error=access_denied&error_code=otp_expired')
    render(<App />)
    expect(await screen.findByText('Email link unavailable')).toBeTruthy()
    expect(screen.queryByText('Private workspace')).toBeNull()
  })
  it('allows the first secure email-change confirmation without an Auth session', async () => {
    api.getSession.mockResolvedValue({ data: { session: null }, error: null })
    window.history.replaceState(null,'','/auth/email-change')
    render(<App />)
    expect(await screen.findByText('Email confirmation received')).toBeTruthy()
    expect(screen.queryByText('Email link unavailable')).toBeNull()
  })
})
