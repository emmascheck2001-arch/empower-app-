import { getUserLocal, removeUserLocal, setUserLocal } from './userLocalState'
import { queuePendingWrite } from './pendingWrites'

const SETTINGS = {
  fitnessGoal: { profileKey: 'fitness_goal', localKey: 'fitnessGoal' },
  healthConnected: { profileKey: 'health_connected', localKey: 'healthConnected', type: 'boolean' },
  healthPromptDismissed: { profileKey: 'health_prompt_dismissed', localKey: 'healthPromptDismissed', type: 'boolean' },
  wearableSignals: { profileKey: 'wearable_signals', localKey: 'wearableSignals', type: 'json' },
  notifyEnabled: { profileKey: 'notify_enabled', localKey: 'notifyEnabled', type: 'boolean' },
  notifyHour: { profileKey: 'notify_hour', localKey: 'notifyHour', type: 'integer' },
  notifyMinute: { profileKey: 'notify_minute', localKey: 'notifyMinute', type: 'integer' },
  notifyPromptDismissed: { profileKey: 'notify_prompt_dismissed', localKey: 'notifyPromptDismissed', type: 'boolean' },
}

function serialize(type, value) {
  if (value == null) return null
  if (type === 'boolean') return value ? '1' : '0'
  if (type === 'integer') return String(Math.round(Number(value)))
  if (type === 'json') return JSON.stringify(value)
  return String(value)
}

function parse(type, raw) {
  if (raw == null || raw === '') return null
  if (type === 'boolean') return raw === true || raw === '1'
  if (type === 'integer') {
    const n = Number(raw)
    return Number.isFinite(n) ? Math.round(n) : null
  }
  if (type === 'json') {
    if (typeof raw !== 'string') return raw
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw
}

function cacheOne(userId, name, value) {
  const meta = SETTINGS[name]
  if (!meta) return
  if (value == null || value === false || value === '') {
    removeUserLocal(userId, meta.localKey)
    return
  }
  setUserLocal(userId, meta.localKey, serialize(meta.type, value))
}

export function getUserSetting(userId, name) {
  const meta = SETTINGS[name]
  if (!meta) return null
  return parse(meta.type, getUserLocal(userId, meta.localKey))
}

export function cacheProfileSettings(userId, profile) {
  if (!userId || !profile) return
  for (const [name, meta] of Object.entries(SETTINGS)) {
    if (Object.hasOwn(profile, meta.profileKey)) cacheOne(userId, name, profile[meta.profileKey])
  }
}

export async function loadProfileSettings(supabase, userId) {
  if (!userId) return null
  const cols = Object.values(SETTINGS).map(meta => meta.profileKey).join(',')
  const { data, error } = await supabase.from('profiles').select(`id,${cols}`).eq('id', userId).maybeSingle()
  if (error) throw error
  if (data) cacheProfileSettings(userId, data)
  return data
}

export async function saveUserSettings(supabase, userId, patch) {
  if (!userId || !patch || !Object.keys(patch).length) return { ok: true }
  const row = { id: userId }
  for (const [name, value] of Object.entries(patch)) {
    const meta = SETTINGS[name]
    if (!meta) continue
    row[meta.profileKey] = meta.type === 'json' ? value : parse(meta.type, serialize(meta.type, value))
    cacheOne(userId, name, value)
  }
  try {
    const res = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
    if (res?.error) throw res.error
    return { ok: true }
  } catch (error) {
    queuePendingWrite(userId, { kind: 'profile_settings', dedupeKey: `profile-settings:${userId}`, payload: { row } })
    return { ok: false, error }
  }
}
