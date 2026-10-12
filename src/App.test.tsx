// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import App from './App'

const mock = vi.hoisted(() => ({
  configured: true,
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  onAuthStateChange: vi.fn(),
}))

vi.mock('./lib/supabase', () => ({
  get supabase() {
    return mock.configured ? { auth: mock } : null
  },
}))

const session = { user: { email: 'student@example.edu' } } as Session

beforeEach(() => {
  vi.resetAllMocks()
  mock.configured = true
  mock.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mock.unsubscribe } } })
  mock.signInWithPassword.mockResolvedValue({ data: { session }, error: null })
  mock.signOut.mockResolvedValue({ error: null })
})

afterEach(cleanup)

async function submitLogin() {
  const user = userEvent.setup()
  await screen.findByRole('button', { name: 'Sign in' })
  await user.type(screen.getByLabelText('Email address'), 'student@example.edu')
  await user.type(screen.getByLabelText('Password', { exact: true }), 'example-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('email/password authentication', () => {
  it('signs in using the supplied credentials and shows the authenticated email', async () => {
    render(<App />)
    await submitLogin()
    expect(mock.signInWithPassword).toHaveBeenCalledWith({ email: 'student@example.edu', password: 'example-password' })
    expect(await screen.findByText('student@example.edu')).toBeTruthy()
    expect(screen.queryByLabelText('Password', { exact: true })).toBeNull()
  })

  it('shows a useful error and allows retry after invalid credentials', async () => {
    mock.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: 'invalid_credentials' } })
    render(<App />)
    await submitLogin()
    expect((await screen.findByRole('alert')).textContent).toContain('Check your email and password')
    expect((screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
  })

  it('handles a network failure without leaving the form busy', async () => {
    mock.signInWithPassword.mockRejectedValue(new Error('network unavailable'))
    render(<App />)
    await submitLogin()
    expect((await screen.findByRole('alert')).textContent).toContain('Check your internet connection')
    expect((screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('restores a stored session and signs out of this device', async () => {
    mock.getSession.mockResolvedValue({ data: { session }, error: null })
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy()
  })

  it('retains the signed-in screen when logout fails', async () => {
    mock.getSession.mockResolvedValue({ data: { session }, error: null })
    mock.signOut.mockResolvedValue({ error: { message: 'network unavailable' } })
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to sign out')
    expect(screen.getByText('student@example.edu')).toBeTruthy()
  })

  it('does not let stale session restoration overwrite a newer auth event', async () => {
    let resolveSession!: (value: { data: { session: Session | null }; error: null }) => void
    mock.getSession.mockReturnValue(new Promise((resolve) => { resolveSession = resolve }))
    mock.onAuthStateChange.mockImplementation((callback) => {
      callback('SIGNED_IN', session)
      return { data: { subscription: { unsubscribe: mock.unsubscribe } } }
    })
    const { unmount } = render(<App />)
    resolveSession({ data: { session: null }, error: null })
    await waitFor(() => expect(screen.getByText('student@example.edu')).toBeTruthy())
    unmount()
    expect(mock.unsubscribe).toHaveBeenCalled()
  })

  it('disables sign-in when Supabase configuration is missing', () => {
    mock.configured = false
    render(<App />)
    expect(screen.getByRole('status').textContent).toContain('Sign-in is currently unavailable')
    expect((screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement).disabled).toBe(true)
    expect(mock.signInWithPassword).not.toHaveBeenCalled()
  })
})
