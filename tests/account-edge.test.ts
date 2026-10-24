import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accountHandler } from '../supabase/functions/_shared/accounts'

const origin = 'https://approviaproject.vercel.app'
const user = { id: 'invitee', email: 'new@lbscek.ac.in', email_confirmed_at: '2026-10-24' }
const env = (name: string) => ({ APP_URL: origin, ALLOWED_ORIGINS: origin, SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public', SUPABASE_SERVICE_ROLE_KEY: 'secret' })[name]
const service = {
  rpc: vi.fn(), auth: { getUser: vi.fn(), admin: { inviteUserByEmail: vi.fn(), getUserById: vi.fn() } },
}
const caller = { rpc: vi.fn(), auth: { resetPasswordForEmail: vi.fn(), updateUser: vi.fn() } }
const factory = vi.fn((_url: string, key: string) => key === 'secret' ? service : caller)
const authFetch = vi.fn<typeof fetch>()
const handler = (endpoint: 'invite' | 'access' = 'access') => accountHandler(factory as unknown as Parameters<typeof accountHandler>[0], env, endpoint, authFetch)
function request(body: object, options: { origin?: string; token?: string } = {}) {
  return new Request(`${origin}/function`, { method: 'POST', headers: { Origin: options.origin ?? origin, Authorization: `Bearer ${options.token ?? 'token'}` }, body: JSON.stringify(body) })
}
beforeEach(() => {
  vi.resetAllMocks()
  service.rpc.mockResolvedValue({ data: { email_enabled: true }, error: null })
  service.auth.getUser.mockResolvedValue({ data: { user }, error: null })
  service.auth.admin.inviteUserByEmail.mockResolvedValue({ data: { user }, error: null })
  service.auth.admin.getUserById.mockResolvedValue({ data: { user }, error: null })
  caller.rpc.mockResolvedValue({ data: { id: 'invitation', claim: 'claim', user_id: null }, error: null })
  caller.auth.resetPasswordForEmail.mockResolvedValue({ error: null })
  caller.auth.updateUser.mockResolvedValue({ error: null })
  authFetch.mockImplementation(async () => new Response('{}', { status: 200 }))
})

describe('account Edge handlers', () => {
  it('denies unapproved origins without creating a privileged client', async () => {
    expect((await handler()(request({ action: 'settings' }, { origin: 'https://evil.test' }))).status).toBe(403)
    expect(factory).not.toHaveBeenCalled()
  })
  it('handles preflight without authentication', async () => {
    expect((await handler()(new Request(origin, { method: 'OPTIONS', headers: { Origin: origin } }))).status).toBe(204)
    expect(service.auth.getUser).not.toHaveBeenCalled()
  })
  it.each(['invite','recover','migrate'])('keeps %s disabled before SMTP readiness', async action => {
    service.rpc.mockResolvedValue({ data: { email_enabled: false }, error: null })
    expect((await handler(action === 'invite' ? 'invite' : 'access')(request({ action, email: user.email }))).status).toBe(503)
    expect(service.auth.admin.inviteUserByEmail).not.toHaveBeenCalled()
    expect(caller.auth.resetPasswordForEmail).not.toHaveBeenCalled()
    expect(authFetch).not.toHaveBeenCalled()
  })
  it('validates real Auth identity rather than trusting JWT text', async () => {
    service.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } })
    expect((await handler('invite')(request({ email: user.email }))).status).toBe(401)
    expect(caller.rpc).not.toHaveBeenCalled()
  })
  it('delegates Admin authorization to the guarded caller RPC before sending', async () => {
    caller.rpc.mockResolvedValue({ error: { message: 'Only active Admin accounts may manage configuration.' } })
    expect((await handler('invite')(request({ email: user.email }))).status).toBe(400)
    expect(service.auth.admin.inviteUserByEmail).not.toHaveBeenCalled()
  })
  it('reserves before email delivery and records success using the claim', async () => {
    expect((await handler('invite')(request({ email: ' NEW@LBSCEK.AC.IN ', full_name: 'New', account_type: 'FACULTY', redirectTo: 'https://evil.test' }))).status).toBe(200)
    expect(caller.rpc).toHaveBeenCalledWith('admin_reserve_invitation', expect.objectContaining({ p_email: user.email }))
    expect(service.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(user.email, { redirectTo: `${origin}/auth/invite` })
    expect(service.rpc).toHaveBeenCalledWith('account_delivery_result', { p_id: 'invitation', p_claim: 'claim', p_success: true })
    expect(caller.rpc.mock.invocationCallOrder[0]).toBeLessThan(service.auth.admin.inviteUserByEmail.mock.invocationCallOrder[0])
  })
  it('records a failed send without exposing provider internals', async () => {
    service.auth.admin.inviteUserByEmail.mockRejectedValue(new Error('secret-token smtp-password'))
    const result = await handler('invite')(request({ email: user.email }))
    expect(result.status).toBe(502)
    expect(await result.text()).not.toContain('secret-token')
    expect(service.rpc).toHaveBeenCalledWith('account_delivery_result', expect.objectContaining({ p_success: false }))
  })
  it('does not report full success when delivery-result persistence fails', async () => {
    service.rpc.mockImplementation(name => name === 'account_delivery_result' ? { error: {} } : { data: { email_enabled: true }, error: null })
    expect((await handler('invite')(request({ email: user.email }))).status).toBe(503)
  })
  it('resends a confirmed pending user through recovery without recreating identity', async () => {
    caller.rpc.mockResolvedValue({ data: { id: 'invitation', claim: 'claim', user_id: user.id }, error: null })
    expect((await handler('invite')(request({ email: user.email }))).status).toBe(200)
    expect(service.auth.admin.inviteUserByEmail).not.toHaveBeenCalled()
    expect(caller.auth.resetPasswordForEmail).toHaveBeenCalledWith(user.email, { redirectTo: `${origin}/auth/invite` })
  })
  it('keeps recovery responses independent of account existence', async () => {
    caller.auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'no account' } })
    const result = await handler()(request({ action: 'recover', email: user.email }))
    expect(result.status).toBe(200)
    expect(await result.text()).toContain('If this address has an account')
  })
  it('requires a verified pending invitation before updating a password', async () => {
    service.rpc.mockImplementation(name => name === 'account_onboarding_target' ? { error: {} } : { data: { email_enabled: true }, error: null })
    expect((await handler()(request({ action: 'onboard', password: 'long-password-example' }))).status).toBe(403)
    expect(authFetch).not.toHaveBeenCalled()
  })
  it('does not activate a profile when password setup fails', async () => {
    authFetch.mockResolvedValue(new Response('{}', { status: 400 }))
    expect((await handler()(request({ action: 'onboard', password: 'long-password-example' }))).status).toBe(400)
    expect(service.rpc.mock.calls.some(([name]) => name === 'account_complete_onboarding')).toBe(false)
  })
  it('finalizes onboarding only after the authenticated password update succeeds', async () => {
    expect((await handler()(request({ action: 'onboard', password: 'long-password-example', user_id: 'another-user' }))).status).toBe(200)
    expect(service.rpc).toHaveBeenCalledWith('account_complete_onboarding', { p_user_id: user.id })
    const completeIndex = service.rpc.mock.calls.findIndex(([name]) => name === 'account_complete_onboarding')
    expect(authFetch.mock.invocationCallOrder[0]).toBeLessThan(service.rpc.mock.invocationCallOrder[completeIndex])
    const headers = authFetch.mock.calls[0][1]?.headers as Record<string,string>
    expect(headers.Authorization).toBe('Bearer token')
    expect(headers.apikey).toBe('public')
  })
  it('uses only owner-approved migration targets and fixed callback destinations', async () => {
    service.rpc.mockImplementation(name => name === 'account_migration_target' ? { data: 'approved@lbscek.ac.in', error: null } : { data: { email_enabled: true }, error: null })
    expect((await handler()(request({ action: 'migrate', email: 'attacker@lbscek.ac.in' }))).status).toBe(200)
    expect(String(authFetch.mock.calls[0][0])).toBe(`https://example.supabase.co/auth/v1/user?redirect_to=${encodeURIComponent(`${origin}/auth/email-change`)}`)
    expect(authFetch.mock.calls[0][1]?.body).toBe(JSON.stringify({ email: 'approved@lbscek.ac.in' }))
  })
})
