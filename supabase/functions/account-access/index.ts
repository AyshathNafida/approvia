import { createClient } from '@supabase/supabase-js'
import { accountHandler } from '../_shared/accounts.ts'

Deno.serve(accountHandler(createClient, name => Deno.env.get(name), 'access'))
