export type FormKind = 'general' | 'leave' | 'duty_leave' | 'event' | 'facility' | 'internship'
export interface FieldDefinition { key: string; label: string; type: 'text' | 'date' | 'datetime-local' | 'select'; options?: [string, string][] }
const dates: FieldDefinition[] = [{ key: 'from_date', label: 'From date', type: 'date' }, { key: 'to_date', label: 'To date', type: 'date' }]
const times: FieldDefinition[] = [{ key: 'start_at', label: 'Start date and time', type: 'datetime-local' }, { key: 'end_at', label: 'End date and time', type: 'datetime-local' }]
export const formFields: Record<FormKind, FieldDefinition[]> = {
  general: [],
  leave: dates,
  duty_leave: [{ key: 'activity', label: 'Activity name', type: 'text' }, { key: 'organizer', label: 'Organizer', type: 'text' }, ...dates],
  event: [{ key: 'scope', label: 'Event scope', type: 'select', options: [['class', 'Class event'], ['college', 'College event']] }, { key: 'event_name', label: 'Event name', type: 'text' }, { key: 'venue', label: 'Venue', type: 'text' }, ...times],
  facility: [{ key: 'scope', label: 'Facility scope', type: 'select', options: [['department', 'Department'], ['college', 'College']] }, { key: 'resource', label: 'Room or equipment requested', type: 'text' }, ...times],
  internship: [{ key: 'visit_kind', label: 'Permission for', type: 'select', options: [['internship', 'Internship'], ['industrial_visit', 'Industrial visit']] }, { key: 'organization', label: 'Organization', type: 'text' }, { key: 'location', label: 'Location', type: 'text' }, ...dates],
}
export function routeFor(kind: FormKind, fields: Record<string, string>): string[] {
  if (kind === 'general') return ['TUTOR']
  if (kind === 'duty_leave') return ['TUTOR', 'HOD', 'DEAN']
  if (kind === 'internship') return ['TUTOR', 'HOD', 'DEAN', 'PRINCIPAL']
  if ((kind === 'event' || kind === 'facility') && !fields.scope) return []
  return fields.scope === 'college' ? ['DEAN', 'PRINCIPAL'] : ['TUTOR', 'HOD']
}
export function validateFields(kind: FormKind, fields: Record<string, string>): string | null {
  for (const field of formFields[kind]) {
    const value = fields[field.key]?.trim()
    if (!value || value.length > 200 || (field.options && !field.options.some(([key]) => key === value))) return `Enter a valid ${field.label.toLowerCase()}.`
    if (field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) return 'Enter valid dates.'
    if (field.type === 'datetime-local' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return 'Enter valid college-local dates and times.'
  }
  const start = fields.from_date ?? fields.start_at
  const end = fields.to_date ?? fields.end_at
  if (start && end && end < start) return 'End date/time must not precede the start.'
  return null
}
export function fieldDisplay(field: FieldDefinition, value: string) {
  if (field.options) return field.options.find(([key]) => key === value)?.[1] ?? value
  return field.type === 'datetime-local' ? `${value.replace('T', ' ')} (Asia/Kolkata)` : value
}
