// First-party analytics: events go to our own Supabase `analytics_events` table.
// No third party, no cost, we own the data. Fire-and-forget, analytics must NEVER
// break the app, so every call is wrapped and failures are swallowed silently.
import { supabase } from './supabase'

export async function track(event, props = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('analytics_events').insert({ user_id: user.id, event, props })
  } catch { /* never let analytics throw */ }
}
