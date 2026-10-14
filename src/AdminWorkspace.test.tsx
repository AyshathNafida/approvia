// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminWorkspace from './AdminWorkspace'
import type { AdminData } from './lib/admin'

const api = vi.hoisted(() => ({ loadAdminData: vi.fn(), saveDepartment: vi.fn(), saveClass: vi.fn(), provisionProfile: vi.fn(), updateProfile: vi.fn(), assignResponsibility: vi.fn() }))
vi.mock('./lib/admin', () => api)
const admin = { id: 'admin', full_name: 'Admin User', account_type: 'ADMIN' as const, active: true, class_id: null }
const data: AdminData = {
  departments: [{ id: 'department', name: 'Computer Science', active: true }],
  classes: [{ id: 'class', department_id: 'department', name: 'CS-A', tutor_id: 'tutor', active: true, batch_start_year: 2026, batch_end_year: 2030 }],
  profiles: [admin, { id: 'tutor', full_name: 'Original Tutor', account_type: 'FACULTY', active: true, class_id: null }, { id: 'replacement', full_name: 'Replacement Tutor', account_type: 'FACULTY', active: true, class_id: null }, { id: 'student', full_name: 'Student', account_type: 'STUDENT', active: true, class_id: 'class' }],
  assignments: [], changes: [], unresolved_pending_classes: 0,
}
beforeEach(() => {
  vi.resetAllMocks()
  api.loadAdminData.mockResolvedValue(structuredClone(data))
  api.saveDepartment.mockResolvedValue('department')
  api.saveClass.mockResolvedValue({ id: 'class', reassigned_count: 0 })
  api.provisionProfile.mockResolvedValue('new-faculty')
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

  it('provisions an existing login without offering Admin type or password input', async () => {
    render(<AdminWorkspace profile={admin} />)
    const user = userEvent.setup()
    await screen.findByText('Setup checks')
    await user.click(screen.getByRole('button', { name: 'Accounts' }))
    await user.type(screen.getByLabelText('Existing login email'), 'faculty@example.test')
    await user.type(screen.getByLabelText('Full name'), 'New Faculty')
    expect(screen.queryByRole('option', { name: 'Admin' })).toBeNull()
    expect(screen.queryByLabelText('Password')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit Admin User' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Create profile' }))
    expect(api.provisionProfile).toHaveBeenCalledWith('faculty@example.test', 'New Faculty', 'FACULTY', null)
    expect(await screen.findByText('Profile created for the existing login.')).toBeTruthy()
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

  it('retains entered account details when server provisioning fails', async () => {
    api.provisionProfile.mockRejectedValue(new Error('No confirmed existing login matches this email.'))
    render(<AdminWorkspace profile={admin} />)
    const user = userEvent.setup()
    await screen.findByText('Setup checks')
    await user.click(screen.getByRole('button', { name: 'Accounts' }))
    await user.type(screen.getByLabelText('Existing login email'), 'missing@example.test')
    await user.type(screen.getByLabelText('Full name'), 'Missing Faculty')
    await user.click(screen.getByRole('button', { name: 'Create profile' }))
    expect((await screen.findByRole('alert')).textContent).toContain('No confirmed existing login')
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Missing Faculty')
  })

  it('assigns HOD to a department and indicates higher-level processing is deferred', async () => {
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
    expect(screen.getByText(/Requests currently use Tutor review only/)).toBeTruthy()
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
})
