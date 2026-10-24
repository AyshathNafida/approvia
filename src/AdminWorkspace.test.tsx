// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminWorkspace from './AdminWorkspace'
import type { AdminData } from './lib/admin'

const api = vi.hoisted(() => ({ loadAdminData: vi.fn(), saveDepartment: vi.fn(), saveClass: vi.fn(), inviteAccount: vi.fn(), updateProfile: vi.fn(), assignResponsibility: vi.fn() }))
vi.mock('./lib/admin', () => api)
const admin = { id: 'admin', full_name: 'Admin User', account_type: 'ADMIN' as const, active: true, class_id: null }
const data: AdminData = {
  departments: [{ id: 'department', name: 'Computer Science', active: true }],
  classes: [{ id: 'class', department_id: 'department', name: 'CS-A', tutor_id: 'tutor', active: true, batch_start_year: 2026, batch_end_year: 2030 }],
  profiles: [admin, { id: 'tutor', full_name: 'Original Tutor', account_type: 'FACULTY', active: true, onboarding_complete: true, eligible: true, class_id: null }, { id: 'replacement', full_name: 'Replacement Tutor', account_type: 'FACULTY', active: true, onboarding_complete: true, eligible: true, class_id: null }, { id: 'student', full_name: 'Student', account_type: 'STUDENT', active: true, class_id: 'class' }],
  assignments: [], changes: [], unresolved_pending_classes: 0, invitations: [], email_enabled: true,
}
beforeEach(() => {
  vi.resetAllMocks()
  api.loadAdminData.mockResolvedValue(structuredClone(data))
  api.saveDepartment.mockResolvedValue('department')
  api.saveClass.mockResolvedValue({ id: 'class', reassigned_count: 0 })
  api.inviteAccount.mockResolvedValue('new-faculty')
  api.updateProfile.mockResolvedValue(undefined)
  api.assignResponsibility.mockResolvedValue(2)
})
afterEach(cleanup)

describe('Admin workspace', () => {
  it('shows setup gaps, searches departments, and saves explicit edits', async () => {
    render(<AdminWorkspace profile={admin} />)
    const user = userEvent.setup()
    expect(await screen.findByText(/active departments need an active HOD/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Edit Computer Science' }))
    await user.clear(screen.getByLabelText('Department name'))
    await user.type(screen.getByLabelText('Department name'), 'Computing')
    await user.click(screen.getByRole('button', { name: 'Save department' }))
    expect(api.saveDepartment).toHaveBeenCalledWith('department', 'Computing', true)
    expect(await screen.findByText('Department saved.')).toBeTruthy()
    await user.type(screen.getByLabelText('Search departments'), 'missing')
    expect(screen.queryByRole('button', { name: 'Edit Computer Science' })).toBeNull()
  })

  it('invites college Faculty without offering Admin type or password input', async () => {
    render(<AdminWorkspace profile={admin} />)
    const user = userEvent.setup()
    await screen.findByText('Setup checks')
    await user.click(screen.getByRole('button', { name: 'Accounts' }))
    await user.type(screen.getByLabelText('College email'), 'faculty@lbscek.ac.in')
    await user.type(screen.getByLabelText('Full name'), 'New Faculty')
    expect(screen.queryByRole('option', { name: 'Admin' })).toBeNull()
    expect(screen.queryByLabelText('Password')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit Admin User' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect(api.inviteAccount).toHaveBeenCalledWith('faculty@lbscek.ac.in', 'New Faculty', 'FACULTY', null)
    expect(await screen.findByText('Invitation sent. Account setup is pending.')).toBeTruthy()
  })

  it('requires a replacement reason and shows the transferred count', async () => {
    render(<AdminWorkspace profile={admin} />)
    const user = userEvent.setup()
    await screen.findByText('Setup checks')
    await user.click(screen.getByRole('button', { name: 'Class batches' }))
    await user.click(screen.getByRole('button', { name: 'Edit CS-A' }))
    await user.selectOptions(screen.getByLabelText('Tutor'), 'replacement')
    await user.click(screen.getByRole('button', { name: 'Save class batch' }))
    expect(api.saveClass).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Tutor assignment reason'), 'Original Tutor leaving this class')
    api.saveClass.mockResolvedValue({ id: 'class', reassigned_count: 2 })
    await user.click(screen.getByRole('button', { name: 'Save class batch' }))
    expect(api.saveClass).toHaveBeenCalledWith(expect.objectContaining({ id: 'class', tutor_id: 'replacement', batch_start_year: 2026, batch_end_year: 2030, reason: 'Original Tutor leaving this class' }))
    expect(await screen.findByText('Class saved. 2 pending requests transferred.')).toBeTruthy()
  })

  it('retains entered account details when invitation delivery fails', async () => {
    api.inviteAccount.mockRejectedValue(new Error('Invitation could not be delivered.'))
    render(<AdminWorkspace profile={admin} />)
    const user = userEvent.setup()
    await screen.findByText('Setup checks')
    await user.click(screen.getByRole('button', { name: 'Accounts' }))
    await user.type(screen.getByLabelText('College email'), 'missing@lbscek.ac.in')
    await user.type(screen.getByLabelText('Full name'), 'Missing Faculty')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Invitation could not')
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Missing Faculty')
  })

  it('assigns HOD to a department and explains distinct route reviewers', async () => {
    render(<AdminWorkspace profile={admin} />)
    const user = userEvent.setup()
    await screen.findByText('Setup checks')
    await user.click(screen.getByRole('button', { name: 'Assignments' }))
    await user.selectOptions(screen.getByLabelText('Responsibility'), 'HOD')
    await user.selectOptions(screen.getByLabelText('Department scope'), 'department')
    await user.selectOptions(screen.getByLabelText('Faculty account'), 'replacement')
    await user.type(screen.getByLabelText('Change reason'), 'New HOD appointment')
    await user.click(screen.getByRole('button', { name: 'Save assignment' }))
    expect(api.assignResponsibility).toHaveBeenCalledWith('HOD', 'department', 'replacement', 'New HOD appointment')
    expect(await screen.findByText('Assignment saved. 2 pending requests transferred.')).toBeTruthy()
    expect(screen.getByText(/Each required role on a route needs a different Faculty member/)).toBeTruthy()
  })

  it('discards configuration on a failed authorization refresh', async () => {
    render(<AdminWorkspace profile={admin} />)
    const user = userEvent.setup()
    await screen.findByRole('button', { name: 'Edit Computer Science' })
    api.loadAdminData.mockRejectedValue(new Error('Only active Admin accounts may manage configuration.'))
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Only active Admin')
    expect(screen.queryByRole('button', { name: 'Edit Computer Science' })).toBeNull()
  })

  it('clears the directory if an Admin mutation discovers lost authorization', async () => {
    api.saveDepartment.mockRejectedValue(new Error('Only active Admin accounts may manage configuration.'))
    render(<AdminWorkspace profile={admin} />)
    const user = userEvent.setup()
    await screen.findByRole('button', { name: 'Edit Computer Science' })
    await user.type(screen.getByLabelText('Department name'), 'New department')
    await user.click(screen.getByRole('button', { name: 'Save department' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Only active Admin')
    expect(screen.queryByRole('button', { name: 'Edit Computer Science' })).toBeNull()
  })
  it('keeps invitations and resends disabled until email setup is verified', async () => {
    api.loadAdminData.mockResolvedValue({ ...structuredClone(data), email_enabled: false, invitations: [{ id: 'invitation', email: 'pending@lbscek.ac.in', full_name: 'Pending Faculty', account_type: 'FACULTY', class_id: null, status: 'failed', sent_at: null, completed_at: null, error_code: 'delivery_failed' }] })
    render(<AdminWorkspace profile={admin} />)
    const user = userEvent.setup()
    await screen.findByText('Setup checks')
    await user.click(screen.getByRole('button', { name: 'Accounts' }))
    expect((screen.getByRole('button', { name: 'Send invitation' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Resend invitation for pending@lbscek.ac.in' }) as HTMLButtonElement).disabled).toBe(true)
    expect(api.inviteAccount).not.toHaveBeenCalled()
  })
  it('excludes ineligible Faculty from assignments', async () => {
    const next = structuredClone(data)
    next.profiles.find(p => p.id === 'replacement')!.eligible = false
    api.loadAdminData.mockResolvedValue(next)
    render(<AdminWorkspace profile={admin} />)
    const user = userEvent.setup()
    await screen.findByText('Setup checks')
    await user.click(screen.getByRole('button', { name: 'Assignments' }))
    expect(screen.queryByRole('option', { name: 'Replacement Tutor' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Original Tutor' })).toBeTruthy()
  })
})
