import { readFileSync } from 'node:fs'

const settings = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=')
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
    }),
)

const response = await fetch(new URL('/auth/v1/settings', settings.VITE_SUPABASE_URL), {
  headers: { apikey: settings.VITE_SUPABASE_PUBLISHABLE_KEY },
  signal: AbortSignal.timeout(15000),
})

if (!response.ok) {
  throw new Error(`Supabase connection check failed: HTTP ${response.status}`)
}

console.log('Supabase Auth settings responded successfully (HTTP 200). No account or data changes made.')
