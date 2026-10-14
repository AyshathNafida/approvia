import { supabase } from './supabase'
import type { Profile } from './requests'

export interface Department { id: string; name: string; active: boolean }
export interface ClassBatch { id: string; department_id: string; name: string; tutor_id: string | null; active: boolean; batch_start_year: number | null; batch_end_year: number | null }
export type Responsibility = 'TUTOR' | 'HOD' | 'DEAN' | 'PRINCIPAL'
export interface AuthorityAssignment { id: string; responsibility: Exclude<Responsibility, 'TUTOR'>; department_id: string | null; faculty_id: string }
export interface ResponsibilityChange { id: string; responsibility: Responsibility; class_id: string | null; department_id: string | null; previous_faculty_id: string | null; faculty_id: string | null; actor_id: string | null; reason: string; created_at: string }
export interface AdminData { departments: Department[]; classes: ClassBatch[]; profiles: Profile[]; assignments: AuthorityAssignment[]; changes: ResponsibilityChange[]; unresolved_pending_classes: number }

function client() {
  if (!supabase) throw new Error('Sign-in is currently unavailable.')
  return supabase
}
function check(error: { message: string; code?: string } | null) {
  if (!error) return
  if (['PGRST202', 'PGRST205', '42P01', '42703'].includes(error.code ?? '')) throw new Error('Administration is not set up yet. Ask the system owner to apply the Admin migration.')
  if (error.code === '23505') throw new Error('This class name and batch already exist in that department.')
  throw new Error(error.message)
}
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(name, args)
  check(error)
  return data as T
}
export async function loadAdminData(): Promise<AdminData> {
  // The guard runs before reading configuration. Missing/inactive/non-Admin
  // identities cannot turn this loader into an institution-wide directory.
  const summary = await rpc<{ unresolved_pending_classes: number }>('admin_setup_summary')
  const results = await Promise.all([
    client().from('departments').select('id,name,active').order('name'),
    client().from('classes').select('id,department_id,name,tutor_id,active,batch_start_year,batch_end_year').order('name'),
    client().from('profiles').select('id,full_name,account_type,active,class_id').order('full_name'),
    client().from('authority_assignments').select('id,responsibility,department_id,faculty_id'),
    client().from('responsibility_changes').select('id,responsibility,class_id,department_id,previous_faculty_id,faculty_id,actor_id,reason,created_at').order('created_at', { ascending: false }).limit(100),
  ])
  for (const result of results) check(result.error)
  await rpc('admin_setup_summary')
  return { departments: results[0].data as Department[], classes: results[1].data as ClassBatch[], profiles: results[2].data as Profile[], assignments: results[3].data as AuthorityAssignment[], changes: results[4].data as ResponsibilityChange[], ...summary }
}
export const saveDepartment = (id: string | null, name: string, active: boolean) => rpc<string>('admin_save_department', { p_id: id, p_name: name, p_active: active })
export const saveClass = (value: { id: string | null; department_id: string; name: string; batch_start_year: number; batch_end_year: number; active: boolean; tutor_id: string; reason: string }) => rpc<{ id: string; reassigned_count: number }>('admin_save_class', { p_id: value.id, p_department_id: value.department_id, p_name: value.name, p_batch_start_year: value.batch_start_year, p_batch_end_year: value.batch_end_year, p_active: value.active, p_tutor_id: value.tutor_id, p_reason: value.reason })
export const provisionProfile = (email: string, name: string, type: 'STUDENT' | 'FACULTY', classId: string | null) => rpc<string>('admin_provision_profile', { p_email: email, p_full_name: name, p_account_type: type, p_class_id: classId })
export const updateProfile = (id: string, name: string, classId: string | null, active: boolean) => rpc<void>('admin_update_profile', { p_id: id, p_full_name: name, p_class_id: classId, p_active: active })
export const assignResponsibility = (responsibility: Responsibility, scopeId: string | null, facultyId: string | null, reason: string) => rpc<number>('admin_assign_responsibility', { p_responsibility: responsibility, p_scope_id: scopeId, p_faculty_id: facultyId, p_reason: reason })
