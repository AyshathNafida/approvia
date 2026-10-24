import type { SupabaseClient } from '@supabase/supabase-js'

type Factory = (url: string, key: string, options?: object) => SupabaseClient
type Environment = (name: string) => string | undefined
export const isCollegeEmail = (email: string) => /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@lbscek\.ac\.in$/i.test(email.trim())
const unavailable = 'Email services are disabled until SMTP setup is verified.'

// No request bodies, credentials, passwords, tokens or raw provider errors are logged.
export function accountHandler(createClient: Factory, env: Environment, endpoint: 'invite' | 'access', authFetch: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin') ?? ''
    const appUrl = env('APP_URL')?.replace(/\/$/, '') ?? ''
    const origins = (env('ALLOWED_ORIGINS') ?? '').split(',').map(value => value.trim()).filter(Boolean)
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' }
    const respond = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers })
    if (!origin || !origins.includes(origin)) return new Response('Origin not permitted', { status: 403 })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return respond(405, { error: 'Use POST.' })
    try {
      if (!appUrl || new URL(appUrl).origin !== appUrl || (!appUrl.startsWith('https://') && !/^http:\/\/localhost(:\d+)?$/.test(appUrl))) throw new Error('Account service is not configured.')
      const url = env('SUPABASE_URL')!
      const publicKey = env('SUPABASE_ANON_KEY') ?? env('SUPABASE_PUBLISHABLE_KEY')!
      const secret = env('SUPABASE_SERVICE_ROLE_KEY')!
      if (!url || !publicKey || !secret) throw new Error('Account service is not configured.')
      const raw = await request.text()
      if (raw.length > 8192) return respond(413, { error: 'Request is too large.' })
      const input = JSON.parse(raw) as Record<string, unknown>
      if (!input || Array.isArray(input) || typeof input !== 'object') return respond(400, { error: 'Invalid request.' })
      const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
      const settings = await service.rpc('account_email_settings')
      if (settings.error) return respond(503, { error: 'Account service is not configured.' })
      const emailEnabled = settings.data?.email_enabled === true
      const action = endpoint === 'invite' ? 'invite' : input.action
      if (action === 'settings') return respond(200, { email_enabled: emailEnabled })
      if (['invite', 'recover', 'migrate'].includes(String(action)) && !emailEnabled) return respond(503, { error: unavailable })
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
      if (action === 'recover') {
        if (!isCollegeEmail(email)) return respond(400, { error: 'Use your @lbscek.ac.in college email address.' })
        const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } })
        // Provider errors must not disclose whether this address is registered.
        await client.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/auth/recovery` })
        return respond(200, { message: 'If this address has an account, a password reset email will arrive shortly.' })
      }
      const authorization = request.headers.get('Authorization') ?? ''
      if (!authorization.startsWith('Bearer ')) return respond(401, { error: 'Please sign in again.' })
      const token = authorization.slice(7)
      const identity = await service.auth.getUser(token)
      if (identity.error || !identity.data.user) return respond(401, { error: 'Please sign in again.' })
      const user = identity.data.user
      const caller = createClient(url, publicKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
      // A stateless SDK client with an Authorization header has no persisted Auth
      // session for updateUser(). Call the same user endpoint with the verified
      // bearer token, never the service credential, for password/email updates.
      async function updateIdentity(attributes: object, redirect?: string) {
        const endpoint = new URL('/auth/v1/user', url)
        if (redirect) endpoint.searchParams.set('redirect_to', redirect)
        return authFetch(endpoint, { method: 'PUT', headers: { Authorization: authorization, apikey: publicKey, 'Content-Type': 'application/json' }, body: JSON.stringify(attributes), signal: AbortSignal.timeout(15000) })
      }
      if (action === 'invite') {
        if (!isCollegeEmail(email)) return respond(400, { error: 'Use an @lbscek.ac.in college email address.' })
        const reserved = await caller.rpc('admin_reserve_invitation', { p_email: email, p_full_name: input.full_name, p_account_type: input.account_type, p_class_id: input.class_id ?? null })
        if (reserved.error) return respond(400, { error: reserved.error.message })
        const invitation = reserved.data as { id: string; claim: string; user_id: string | null }
        let success = false
        try {
          if (invitation.user_id) {
            const existing = await service.auth.admin.getUserById(invitation.user_id)
            if (existing.error || existing.data.user?.email?.toLowerCase() !== email) throw new Error('Identity mismatch')
            if (existing.data.user.email_confirmed_at) {
              // A confirmed invitee may have closed the initial setup page. A
              // recovery link returns them to the same guarded onboarding page.
              const sent = await caller.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/auth/invite` })
              success = !sent.error
            } else {
              const sent = await service.auth.admin.inviteUserByEmail(email, { redirectTo: `${appUrl}/auth/invite` })
              success = !sent.error && sent.data.user?.id === invitation.user_id
            }
          } else {
            const sent = await service.auth.admin.inviteUserByEmail(email, { redirectTo: `${appUrl}/auth/invite` })
            success = !sent.error && !!sent.data.user
          }
        } catch { /* Retain the reservation for reconciliation and retry. */ }
        const recorded = await service.rpc('account_delivery_result', { p_id: invitation.id, p_claim: invitation.claim, p_success: success })
        if (recorded.error) return respond(503, { error: 'Delivery result could not be recorded. Refresh Accounts before retrying.' })
        return success ? respond(200, { message: 'Invitation sent. The account remains pending until setup is complete.' }) : respond(502, { error: 'Invitation could not be delivered. Check email configuration, then retry from Accounts.' })
      }
      if (action === 'onboard') {
        if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128) return respond(400, { error: 'Use a password between 12 and 128 characters.' })
        const target = await service.rpc('account_onboarding_target', { p_user_id: user.id })
        if (target.error) return respond(403, { error: 'This invitation is invalid, already completed, or its email is not verified.' })
        const updated = await updateIdentity({ password: input.password })
        if (!updated.ok) return respond(400, { error: 'Password setup failed. Use a different password or request a fresh link.' })
        const completed = await service.rpc('account_complete_onboarding', { p_user_id: user.id })
        if (completed.error) return respond(409, { error: 'Your password was saved, but account setup could not finish. Retry setup or contact your administrator about the invited class.' })
        return respond(200, { message: 'Account setup complete. Sign in with your college email and password.' })
      }
      if (action === 'migrate') {
        const target = await service.rpc('account_migration_target', { p_user_id: user.id })
        if (target.error) return respond(403, { error: 'Ask the owner to approve your college email mapping first.' })
        const updated = await updateIdentity({ email: target.data }, `${appUrl}/auth/email-change`)
        if (!updated.ok) return respond(400, { error: 'Email change could not be started. Contact the owner or try again later.' })
        return respond(200, { message: 'Check your current and college email inboxes and complete the confirmation links.' })
      }
      return respond(400, { error: 'Unknown account operation.' })
    } catch {
      return respond(400, { error: 'Account operation failed. Check the service configuration or try again.' })
    }
  }
}
