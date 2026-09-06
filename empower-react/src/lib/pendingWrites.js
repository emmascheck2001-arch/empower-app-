// A durable local queue for writes that failed to reach Supabase.
//
// Why this exists: a health log that silently fails to save is worse than one that
// errors, because she believes it is recorded and finds out weeks later when the
// prediction is wrong. Every failed write is kept here and replayed when the app next
// has connectivity, so nothing she typed is lost to a dropped connection.
//
// Two rules this module exists to enforce:
//  1. Entries are scoped to the user who created them. On a shared device a queued
//     entry must never replay into a different account, so a mismatched userId is
//     dropped rather than written.
//  2. A period start replays as INTENT, not as a finished row. cycle_data.notes holds
//     the full period history and is merged at write time; replaying a stale merged
//     payload could erase a period logged in the meantime. So the queue stores the date
//     and re-runs the merge at flush.

import { mergePeriodStartsNotes } from './hormoneSync'

const KEY = 'empower.pendingWrites.v1'
const MAX_ENTRIES = 200

function readRaw() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function writeRaw(entries) {
  try { localStorage.setItem(KEY, JSON.stringify(entries)); return true } catch { return false }
}

export function readQueue() { return readRaw() }
export function queueCount() { return readRaw().length }
export function clearQueue() { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }

// Add a failed write. `kind` is one of 'daily_log' | 'mucus_log' | 'period_start'.
// Re-queuing the same logical write (same kind + same key) replaces the older entry
// rather than stacking duplicates, so repeated failed retries stay at one entry.
export function enqueue(entry) {
  if (!entry?.kind || !entry?.userId) return false
  const stamped = { id: `${entry.kind}:${entry.dedupeKey || Date.now()}`, createdAt: new Date().toISOString(), ...entry }
  const next = readRaw().filter(e => e.id !== stamped.id)
  next.push(stamped)
  // Oldest-first eviction; the cap only exists so a long offline stretch cannot
  // exhaust localStorage and start failing the writes it is meant to protect.
  return writeRaw(next.slice(-MAX_ENTRIES))
}

export function removeById(id) {
  writeRaw(readRaw().filter(e => e.id !== id))
}

// Replay one entry. Returns true when it is safe to drop from the queue.
async function replay(supabase, entry) {
  if (entry.kind === 'daily_log') {
    const { error } = await supabase.from('daily_logs')
      .upsert(entry.payload, { onConflict: 'user_id,log_date' })
    return !error
  }

  if (entry.kind === 'mucus_log') {
    const { error } = await supabase.from('mucus_logs')
      .upsert(entry.payload, { onConflict: 'user_id,log_date' })
    return !error
  }

  if (entry.kind === 'period_start') {
    // Re-read and re-merge, never replay a stale merged payload. See the header note.
    const { data: existing, error: readErr } = await supabase.from('cycle_data')
      .select('notes,last_period_date').eq('user_id', entry.userId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (readErr) return false
    const notes = mergePeriodStartsNotes(existing?.notes, existing?.last_period_date, entry.periodDate)
    const latestStart = [existing?.last_period_date, entry.periodDate].filter(Boolean).sort().slice(-1)[0]
    const row = { user_id: entry.userId, last_period_date: latestStart, notes }
    if (entry.cycleLen) row.cycle_length = entry.cycleLen
    const { error } = await supabase.from('cycle_data').upsert(row, { onConflict: 'user_id' })
    return !error
  }

  // Unknown kind from a future or older build: drop it rather than retry forever.
  return true
}

// Replay everything queued for the signed-in user. Safe to call often; it is a no-op
// with an empty queue, and it never throws into the caller.
export async function flushQueue(supabase) {
  const entries = readRaw()
  if (!entries.length) return { flushed: 0, remaining: 0, skipped: 0 }

  let user = null
  try { user = (await supabase.auth.getUser()).data.user } catch { /* offline or signed out */ }
  if (!user) return { flushed: 0, remaining: entries.length, skipped: 0 }

  const keep = []
  let flushed = 0, skipped = 0

  for (const entry of entries) {
    if (entry.userId !== user.id) { skipped++; continue }   // rule 1: never cross accounts
    let ok
    try { ok = await replay(supabase, entry) } catch { ok = false }
    if (ok) flushed++
    else keep.push(entry)
  }

  writeRaw(keep)
  return { flushed, remaining: keep.length, skipped }
}
