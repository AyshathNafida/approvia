// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Workspace from './Workspace'

const api = vi.hoisted(() => ({ loadProfile: vi.fn(), loadRequests: vi.fn(), loadRequestTypes: vi.fn(), submitRequest: vi.fn(), decideRequest: vi.fn() }))
vi.mock('./lib/requests', () => api)

const request = {
  id: 'request-1', title: 'Library access', description: 'I need library access this weekend.', status: 'IN_REVIEW',
  student_name: 'Student', class_name: 'Test Class', department_name: 'Test Department', created_at: '2026-10-12T10:00:00Z', decided_at: null,
  approval_steps: [{ id: 'step-1', approver_id: 'tutor-1', responsibility: 'TUTOR', position: 1, status: 'PENDING' }],
  request_actions: [{ id: 'action-1', actor_name: 'Student', responsibility: null, action: 'SUBMITTED', comment: null, created_at: '2026-10-12T10:00:00Z' }],
}

beforeEach(() => {
  vi.resetAllMocks()
  api.loadProfile.mockResolvedValue({ id: 'student-1', full_name: 'Student', account_type: 'STUDENT', active: true, class_id: 'class-1' })
  api.loadRequests.mockResolvedValue([])
  api.loadRequestTypes.mockResolvedValue([{ id: 'type-1', name: 'General Request', approval_route: ['TUTOR'] }])
  api.submitRequest.mockResolvedValue('request-1')
  api.decideRequest.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('small request workspace', () => {
  it('submits a student request without accepting an approver from the browser', async () => {
    render(<Workspace userId="student-1" />)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Title'), 'Library access')
    await user.type(screen.getByLabelText('Description'), 'I need library access this weekend.')
    api.loadRequests.mockResolvedValue([request])
    await user.click(screen.getByRole('button', { name: 'Submit request' }))
    expect(api.submitRequest).toHaveBeenCalledWith('Library access', 'I need library access this weekend.', 'type-1')
    expect(await screen.findByText('Your request was submitted to your class Tutor.')).toBeTruthy()
    expect(screen.getByLabelText('Title').getAttribute('value')).toBe('')
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
  })

  it('retains entered details when server validation rejects a submission', async () => {
    api.submitRequest.mockRejectedValue(new Error('Your class needs an active Tutor.'))
    render(<Workspace userId="student-1" />)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Title'), 'Library access')
    await user.type(screen.getByLabelText('Description'), 'Details')
    await user.click(screen.getByRole('button', { name: 'Submit request' }))
    expect((await screen.findByRole('alert')).textContent).toContain('active Tutor')
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Library access')
  })

  it('requires a Tutor comment, saves a decision, and shows its history', async () => {
    api.loadProfile.mockResolvedValue({ id: 'tutor-1', full_name: 'Tutor', account_type: 'FACULTY', active: true, class_id: null })
    api.loadRequests.mockResolvedValue([request])
    render(<Workspace userId="tutor-1" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Library access/ }))
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(api.decideRequest).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('decision comment')
    await user.type(screen.getByLabelText('Decision comment'), 'Permission granted.')
    api.loadRequests.mockResolvedValue([{ ...request, status: 'APPROVED', approval_steps: [{ ...request.approval_steps[0], status: 'APPROVED' }], request_actions: [...request.request_actions, { id: 'action-2', actor_name: 'Tutor', responsibility: 'TUTOR', action: 'APPROVED', comment: 'Permission granted.', created_at: '2026-10-12T11:00:00Z' }] }])
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(api.decideRequest).toHaveBeenCalledWith('request-1', 'APPROVED', 'Permission granted.')
    expect(await screen.findByText('Permission granted.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
  })

  it('shows setup guidance for a user without a profile and makes no request queries', async () => {
    api.loadProfile.mockResolvedValue(null)
    render(<Workspace userId="unconfigured-user" />)
    expect(await screen.findByText('Your account is almost ready.')).toBeTruthy()
    expect(api.loadRequests).not.toHaveBeenCalled()
  })

  it('does not load requests for an inactive account or an Admin', async () => {
    api.loadProfile.mockResolvedValue({ id: 'inactive', full_name: 'Inactive', account_type: 'STUDENT', active: false, class_id: 'class-1' })
    const { unmount } = render(<Workspace userId="inactive" />)
    expect(await screen.findByText('Account inactive')).toBeTruthy()
    expect(api.loadRequests).not.toHaveBeenCalled()
    unmount()
    api.loadProfile.mockResolvedValue({ id: 'admin', full_name: 'Admin', account_type: 'ADMIN', active: true, class_id: null })
    render(<Workspace userId="admin" />)
    expect(await screen.findByText('Administration')).toBeTruthy()
    expect(api.loadRequests).not.toHaveBeenCalled()
  })
})
