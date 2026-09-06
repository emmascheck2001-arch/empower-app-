const PREFIX = 'empower:pending'

function storageKey(userId) {
  return userId ? `${PREFIX}:${userId}` : null
}

function safeRead(userId) {
  const key = storageKey(userId)
  if (!key || typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function safeWrite(userId, items) {
  const key = storageKey(userId)
  if (!key || typeof localStorage === 'undefined') return
  try {
    if (!items.length) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(items))
  } catch {
    /* best effort only */
  }
}

export function listPendingWrites(userId) {
  return safeRead(userId)
}

export function queuePendingWrite(userId, item) {
  const queue = safeRead(userId)
  const next = {
    id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: item.createdAt || new Date().toISOString(),
    ...item,
  }
  const deduped = queue.filter(existing => !(existing.kind === next.kind && existing.dedupeKey && existing.dedupeKey === next.dedupeKey))
  deduped.push(next)
  safeWrite(userId, deduped)
  return next
}

export function removePendingWrite(userId, id) {
  safeWrite(userId, safeRead(userId).filter(item => item.id !== id))
}

async function replayItem(supabase, item) {
  if (item.kind === 'daily_log') {
    const dailyRes = await supabase.from('daily_logs').upsert(item.payload.dailyLog, { onConflict: 'user_id,log_date' })
    if (dailyRes?.error) throw dailyRes.error
    if (item.payload.mucus?.action === 'upsert') {
      const mucusRes = await supabase.from('mucus_logs').upsert(item.payload.mucus.row, { onConflict: 'user_id,log_date' })
      if (mucusRes?.error) throw mucusRes.error
    }
    if (item.payload.mucus?.action === 'delete') {
      const mucusRes = await supabase.from('mucus_logs').delete().eq('user_id', item.payload.mucus.userId).eq('log_date', item.payload.mucus.logDate)
      if (mucusRes?.error) throw mucusRes.error
    }
    return
  }

  if (item.kind === 'period_start') {
    const res = await supabase.from('cycle_data').upsert(item.payload.row, { onConflict: 'user_id' })
    if (res?.error) throw res.error
    return
  }

  if (item.kind === 'profile_settings') {
    const res = await supabase.from('profiles').upsert(item.payload.row, { onConflict: 'id' })
    if (res?.error) throw res.error
    return
  }
}

export async function replayPendingWrites(supabase, userId) {
  const queue = safeRead(userId)
  if (!queue.length) return { attempted: 0, synced: 0, remaining: 0 }
  let synced = 0
  const remaining = []
  for (const item of queue) {
    try {
      await replayItem(supabase, item)
      synced += 1
    } catch {
      remaining.push(item)
    }
  }
  safeWrite(userId, remaining)
  return { attempted: queue.length, synced, remaining: remaining.length }
}
