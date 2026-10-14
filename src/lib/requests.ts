import { supabase } from './supabase'

export type AccountType = 'STUDENT' | 'FACULTY' | 'ADMIN'
export type RequestStatus = 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
export interface Profile { id: string; full_name: string; account_type: AccountType; active: boolean; class_id: string | null }
export interface RequestType { id: string; name: string; approval_route: string[] }
export interface ApprovalStep { id: string; approver_id: string; responsibility: string; position: number; status: string }
export interface RequestAction { id: string; actor_name: string; responsibility: string | null; action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REASSIGNED'; comment: string | null; created_at: string }
export interface ApprovalRequest {
  id: string; title: string; description: string; status: RequestStatus; student_name: string;
  class_name: string; department_name: string; created_at: string; decided_at: string | null;
  approval_steps: ApprovalStep[]; request_actions: RequestAction[]
}

function client() {
  if (!supabase) throw new Error('Sign-in is currently unavailable.')
  return supabase
}

function check(error: { message: string; code?: string } | null) {
  if (!error) return
  if (error.code === 'PGRST205' || error.code === '42P01') {
    throw new Error('The request workspace is not set up yet. Please contact your administrator.')
  }
  throw new Error(error.message)
}

export async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await client().from('profiles').select('id,full_name,account_type,active,class_id').eq('id', userId).maybeSingle()
  check(error)
  return data as Profile | null
}

export async function loadRequests(): Promise<ApprovalRequest[]> {
  const { data, error } = await client().from('requests').select('id,title,description,status,student_name,class_name,department_name,created_at,decided_at,approval_steps(id,approver_id,responsibility,position,status),request_actions(id,actor_name,responsibility,action,comment,created_at)').order('created_at', { ascending: false })
  check(error)
  return (data ?? []) as ApprovalRequest[]
}

export async function loadRequestTypes(): Promise<RequestType[]> {
  const { data, error } = await client().from('request_types').select('id,name,approval_route').eq('active', true).order('name')
  check(error)
  return (data ?? []) as RequestType[]
}

export async function submitRequest(title: string, description: string, typeId: string): Promise<string> {
  const { data, error } = await client().rpc('submit_request', { p_title: title, p_description: description, p_request_type_id: typeId })
  check(error)
  return data as string
}

export async function decideRequest(requestId: string, decision: 'APPROVED' | 'REJECTED', comment: string): Promise<void> {
  const { error } = await client().rpc('decide_request', { p_request_id: requestId, p_decision: decision, p_comment: comment })
  check(error)
}
