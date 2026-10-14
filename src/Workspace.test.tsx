// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Workspace from './Workspace'

const api = vi.hoisted(() => ({ loadProfile: vi.fn(), loadRequests: vi.fn(), loadRequestTypes: vi.fn(), submitRequest: vi.fn(), decideRequest: vi.fn() }))
vi.mock('./lib/requests', () => api)
vi.mock('./AdminWorkspace', () => ({ default: () => <section><h1>Administration</h1></section> }))

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
  const forms = [
    { kind: 'leave', name: 'Leave', fields: { 'From date': '2026-10-16', 'To date': '2026-10-18' }, route: 'TUTOR → HOD' },
    { kind: 'duty_leave', name: 'Duty Leave', fields: { 'Activity name': 'Sports', Organizer: 'College', 'From date': '2026-10-16', 'To date': '2026-10-18' }, route: 'TUTOR → HOD → DEAN' },
    { kind: 'event', name: 'Event Permission', fields: { 'Event scope': 'college', 'Event name': 'Festival', Venue: 'Hall', 'Start date and time': '2026-10-16T09:00', 'End date and time': '2026-10-16T12:00' }, route: 'DEAN → PRINCIPAL' },
    { kind: 'facility', name: 'Facility Permission', fields: { 'Facility scope': 'department', 'Room or equipment requested': 'Projector', 'Start date and time': '2026-10-16T09:00', 'End date and time': '2026-10-16T12:00' }, route: 'TUTOR → HOD' },
    { kind: 'internship', name: 'Internship Permission', fields: { 'Permission for': 'industrial_visit', Organization: 'Company', Location: 'Kasaragod', 'From date': '2026-10-16', 'To date': '2026-10-18' }, route: 'TUTOR → HOD → DEAN → PRINCIPAL' },
  ]
  for (const form of forms) it(`submits the structured ${form.kind} form and shows its route`, async () => {
    api.loadRequestTypes.mockResolvedValue([{ id: 'typed', code: form.kind, name: form.name, form_kind: form.kind }])
    render(<Workspace userId="student-1" />)
    await screen.findByLabelText('Title')
    for (const [label, value] of Object.entries(form.fields)) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    expect(screen.getByText(new RegExp(`Approval route: ${form.route}`))).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Request' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Reason' } })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Submit request' }))
    expect(api.submitRequest).toHaveBeenCalledWith('Request', 'Reason', 'typed', expect.any(Object))
    expect(Object.values(api.submitRequest.mock.calls[0][3])).toEqual(Object.values(form.fields))
    expect(await screen.findByText(`Your request was submitted for ${form.route} review.`)).toBeTruthy()
  })

  it('retains structured fields on failure and blocks reversed date ranges', async () => {
    api.loadRequestTypes.mockResolvedValue([{ id: 'leave', code: 'leave', name: 'Leave', form_kind: 'leave' }])
    api.submitRequest.mockRejectedValue(new Error('An active HOD is required.'))
    render(<Workspace userId="student-1" />)
    await screen.findByLabelText('From date')
    for (const [label,value] of Object.entries({ Title: 'Leave', Description: 'Reason', 'From date': '2026-10-18', 'To date': '2026-10-16' })) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Submit request' }))
    expect(api.submitRequest).not.toHaveBeenCalled()
    expect((await screen.findByRole('alert')).textContent).toContain('must not precede')
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-20' } })
    await user.click(screen.getByRole('button', { name: 'Submit request' }))
    expect((await screen.findByRole('alert')).textContent).toContain('active HOD')
    expect((screen.getByLabelText('From date') as HTMLInputElement).value).toBe('2026-10-18')
  })

  it('shows intermediate approval and does not allow a future reviewer to decide', async () => {
    const multi = { ...request, current_position: 1, approval_steps: [...request.approval_steps, { id: 'hod-step', approver_id: 'hod-1', responsibility: 'HOD', position: 2, status: 'PENDING' }] }
    api.loadProfile.mockResolvedValue({ id: 'hod-1', full_name: 'HOD', account_type: 'FACULTY', active: true })
    api.loadRequests.mockResolvedValue([multi])
    const rendered = render(<Workspace userId="hod-1" />)
    await userEvent.setup().click(await screen.findByRole('button', { name: /Library access/ }))
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    rendered.unmount()
    api.loadProfile.mockResolvedValue({ id: 'tutor-1', full_name: 'Tutor', account_type: 'FACULTY', active: true })
    render(<Workspace userId="tutor-1" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Library access/ }))
    await user.type(screen.getByLabelText('Decision comment'), 'Granted')
    api.loadRequests.mockResolvedValue([{ ...multi, current_position: 2, approval_steps: [{ ...multi.approval_steps[0], status: 'APPROVED' }, multi.approval_steps[1]] }])
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('Your approval was saved. The request now awaits HOD review.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
  })

  it('orders tied submission, reassignment, and final decision history correctly', async () => {
    const time = '2026-10-14T10:00:00Z'
    api.loadRequests.mockResolvedValue([{ ...request, status: 'APPROVED', request_actions: [
      { ...request.request_actions[0], id: 'final', action: 'APPROVED', created_at: time },
      { ...request.request_actions[0], id: 'transfer', action: 'REASSIGNED', responsibility: 'TUTOR', created_at: time },
      { ...request.request_actions[0], id: 'submission', action: 'SUBMITTED', created_at: time },
    ] }])
    render(<Workspace userId="student-1" />)
    await userEvent.setup().click(await screen.findByRole('button', { name: /Library access/ }))
    const items = within(screen.getByRole('list', { name: 'Activity history' })).getAllByRole('listitem')
    expect(items[0].textContent).toMatch(/^Submitted/)
    expect(items[1].textContent).toMatch(/^Tutor reassigned/)
    expect(items[2].textContent).toMatch(/^Approved/)
  })

  it('submits a student request without accepting an approver from the browser', async () => {
    render(<Workspace userId="student-1" />)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Title'), 'Library access')
    await user.type(screen.getByLabelText('Description'), 'I need library access this weekend.')
    api.loadRequests.mockResolvedValue([request])
    await user.click(screen.getByRole('button', { name: 'Submit request' }))
    expect(api.submitRequest).toHaveBeenCalledWith('Library access', 'I need library access this weekend.', 'type-1', {})
    expect(await screen.findByText('Your request was submitted for TUTOR review.')).toBeTruthy()
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
