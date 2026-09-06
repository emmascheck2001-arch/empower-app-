import { describe, it, expect, beforeEach } from 'vitest'
import { enqueue, flushQueue, readQueue, queueCount, clearQueue } from './pendingWrites'

// Minimal localStorage stand-in for the node test environment.
beforeEach(() => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  }
  clearQueue()
})

const USER = 'user-a'
const OTHER = 'user-b'

// Fake Supabase: records what was written and can be told to fail.
function fakeSupabase({ user = { id: USER }, failTables = [], cycleRow = null } = {}) {
  const writes = []
  return {
    writes,
    auth: { getUser: async () => ({ data: { user } }) },
    from(table) {
      return {
        upsert: async (payload, opts) => {
          if (failTables.includes(table)) return { error: new Error('network') }
          writes.push({ table, payload, opts })
          return { error: null }
        },
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({ maybeSingle: async () => ({ data: cycleRow, error: null }) }),
            }),
          }),
        }),
      }
    },
  }
}

describe('pendingWrites', () => {
  it('queues a failed daily log and replays it', async () => {
    enqueue({ kind: 'daily_log', userId: USER, dedupeKey: '2026-08-20', payload: { user_id: USER, log_date: '2026-08-20', energy: 'Low' } })
    expect(queueCount()).toBe(1)

    const sb = fakeSupabase()
    const res = await flushQueue(sb)
    expect(res.flushed).toBe(1)
    expect(queueCount()).toBe(0)
    expect(sb.writes[0].table).toBe('daily_logs')
    expect(sb.writes[0].payload.energy).toBe('Low')
  })

  it('keeps the entry queued when the replay also fails', async () => {
    enqueue({ kind: 'daily_log', userId: USER, dedupeKey: '2026-08-20', payload: { user_id: USER, log_date: '2026-08-20' } })
    const res = await flushQueue(fakeSupabase({ failTables: ['daily_logs'] }))
    expect(res.flushed).toBe(0)
    expect(res.remaining).toBe(1)
    expect(queueCount()).toBe(1)
  })

  it('replaces rather than stacks when the same day is re-queued', () => {
    enqueue({ kind: 'daily_log', userId: USER, dedupeKey: '2026-08-20', payload: { energy: 'Low' } })
    enqueue({ kind: 'daily_log', userId: USER, dedupeKey: '2026-08-20', payload: { energy: 'High' } })
    expect(queueCount()).toBe(1)
    expect(readQueue()[0].payload.energy).toBe('High')
  })

  it('never replays another account\'s entry', async () => {
    enqueue({ kind: 'daily_log', userId: OTHER, dedupeKey: 'x', payload: { user_id: OTHER } })
    const sb = fakeSupabase({ user: { id: USER } })
    const res = await flushQueue(sb)
    expect(res.flushed).toBe(0)
    expect(res.skipped).toBe(1)
    expect(sb.writes).toHaveLength(0)
    expect(queueCount()).toBe(0)   // dropped, not written
  })

  it('re-merges period history at replay instead of writing a stale row', async () => {
    // Queued offline on the 1st; by the time it replays, a later period was recorded.
    enqueue({ kind: 'period_start', userId: USER, dedupeKey: '2026-07-01', periodDate: '2026-07-01', cycleLen: 28 })
    const sb = fakeSupabase({ cycleRow: { notes: 'period_starts: 2026-08-01', last_period_date: '2026-08-01' } })
    const res = await flushQueue(sb)

    expect(res.flushed).toBe(1)
    const row = sb.writes[0].payload
    expect(sb.writes[0].table).toBe('cycle_data')
    // The newer period survives and stays the anchor; the backfilled one is merged in.
    expect(row.last_period_date).toBe('2026-08-01')
    expect(row.notes).toContain('2026-07-01')
    expect(row.notes).toContain('2026-08-01')
  })

  it('holds everything when nobody is signed in', async () => {
    enqueue({ kind: 'daily_log', userId: USER, dedupeKey: 'd', payload: {} })
    const res = await flushQueue(fakeSupabase({ user: null }))
    expect(res.remaining).toBe(1)
    expect(queueCount()).toBe(1)
  })

  it('drops an unrecognised kind rather than retrying it forever', async () => {
    enqueue({ kind: 'from_a_future_build', userId: USER, dedupeKey: 'z', payload: {} })
    const res = await flushQueue(fakeSupabase())
    expect(res.flushed).toBe(1)
    expect(queueCount()).toBe(0)
  })

  it('keeps a sleep entry and a check-in entry for the same day separate', async () => {
    // Both are daily_logs upserts on (user_id, log_date). They are namespaced so one
    // does not evict the other via the dedupe key, and each only carries its own columns.
    enqueue({ kind: 'daily_log', userId: USER, dedupeKey: 'sleep:2026-08-20', payload: { user_id: USER, log_date: '2026-08-20', sleep_quality: 'Good' } })
    enqueue({ kind: 'daily_log', userId: USER, dedupeKey: '2026-08-20', payload: { user_id: USER, log_date: '2026-08-20', energy: 'Low' } })
    enqueue({ kind: 'daily_log', userId: USER, dedupeKey: 'workout:2026-08-20', payload: { user_id: USER, log_date: '2026-08-20', workout_feel: 'Felt strong' } })
    expect(queueCount()).toBe(3)

    const sb = fakeSupabase()
    const res = await flushQueue(sb)
    expect(res.flushed).toBe(3)
    const cols = sb.writes.map(w => Object.keys(w.payload).filter(k => !['user_id', 'log_date'].includes(k))[0])
    expect(cols.sort()).toEqual(['energy', 'sleep_quality', 'workout_feel'])
  })

  it('is a no-op on an empty queue and never throws', async () => {
    await expect(flushQueue(fakeSupabase())).resolves.toEqual({ flushed: 0, remaining: 0, skipped: 0 })
  })

  it('ignores an entry with no user, rather than queueing something unreplayable', () => {
    expect(enqueue({ kind: 'daily_log', payload: {} })).toBe(false)
    expect(queueCount()).toBe(0)
  })
})
