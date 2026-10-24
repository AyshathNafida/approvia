import { supabase } from './supabase'

export const collegeDomain = 'lbscek.ac.in'
export const isCollegeEmail = (email: string) => /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@lbscek\.ac\.in$/i.test(email.trim())
export interface AccountAccess {
  allowed: boolean
  email_enabled: boolean
  college_only: boolean
  pending_invitation: boolean
  migration_email: string | null
  needs_migration: boolean
}
export interface Invitation {
  id: string; email: string; full_name: string; account_type: 'STUDENT' | 'FACULTY'; class_id: string | null
  status: 'sending' | 'sent' | 'failed' | 'complete'; sent_at: string | null; completed_at: string | null; error_code: string | null
}
export async function accountOperation(action: string, values: Record<string, unknown> = {}): Promise<{ message: string; email_enabled?: boolean }> {
  if (!supabase) throw new Error('Sign-in is currently unavailable.')
  const { data, error } = await supabase.functions.invoke(action === 'invite' ? 'invite-account' : 'account-access', { body: { action, ...values } })
  if (error) {
    let message = 'Unable to contact account services. Please try again.'
    if (error.context instanceof Response) {
      try { const body = await error.context.json(); if (typeof body.error === 'string') message = body.error } catch { /* No usable server response. */ }
    }
    throw new Error(message)
  }
  return data
}
export async function loadAccountAccess(): Promise<AccountAccess> {
  if (!supabase) throw new Error('Sign-in is currently unavailable.')
  const { data, error } = await supabase.rpc('account_access_status')
  if (error) throw new Error('Account access could not be verified. Please try again or contact your administrator.')
  return data as AccountAccess
}
