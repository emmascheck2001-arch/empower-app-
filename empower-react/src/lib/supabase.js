import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://imgujppjvffbubnsscge.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltZ3VqcHBqdmZmYnVibnNzY2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDQzNzIsImV4cCI6MjA5NjE4MDM3Mn0.TpjycdiHLl5iI1G8u07mVmStKZWU2fzEsuw1dUi6diU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce' }
})
