// Shared save helper. Supabase returns `{ data, error }` and does NOT throw on a failed write —
// so `await supabase.from(...).insert(...)` "succeeding" tells you nothing unless you check `.error`.
// Screens that ignore it show a success screen while the data never persisted. `runSave` normalizes
// every write into `{ ok, error, message }` so callers can show retryable feedback consistently.
//
// Usage:
//   const res = await runSave(supabase.from('daily_logs').upsert(row, { onConflict: 'user_id,log_date' }))
//   if (!res.ok) { setSaveError(res.message); setSaving(false); return }
//   // ...success path

// A human, non-technical, retry-oriented message. Distinguishes "you're offline" from other errors
// where we can tell, but never leaks raw Postgres/PostgREST detail into the UI.
export function friendlySaveMessage(error) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  if (offline) return 'You appear to be offline. Your changes were not saved — reconnect and try again.'
  const msg = (error && (error.message || String(error))) || ''
  if (/network|fetch|timeout|Failed to fetch/i.test(msg)) {
    return 'We could not reach the server. Check your connection and try again.'
  }
  return 'Something went wrong saving your changes. Please try again.'
}

// Run a single Supabase write (or any promise resolving to `{ error }`) and normalize the result.
// Never throws — always resolves to a plain result object.
export async function runSave(promise) {
  try {
    const res = await promise
    const error = res && res.error
    if (error) return { ok: false, error, message: friendlySaveMessage(error) }
    return { ok: true, error: null, message: null, data: res && res.data }
  } catch (e) {
    // Genuine exceptions (auth token refresh failure, thrown fetch, etc.)
    return { ok: false, error: e, message: friendlySaveMessage(e) }
  }
}
