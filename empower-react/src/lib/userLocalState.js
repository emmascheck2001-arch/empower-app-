const PREFIX = 'empower:user'

function key(userId, name) {
  return userId ? `${PREFIX}:${userId}:${name}` : null
}

export function getUserLocal(userId, name) {
  const k = key(userId, name)
  if (!k || typeof localStorage === 'undefined') return null
  try { return localStorage.getItem(k) } catch { return null }
}

export function setUserLocal(userId, name, value) {
  const k = key(userId, name)
  if (!k || typeof localStorage === 'undefined') return
  try { localStorage.setItem(k, String(value)) } catch { /* storage can be unavailable */ }
}

export function removeUserLocal(userId, name) {
  const k = key(userId, name)
  if (!k || typeof localStorage === 'undefined') return
  try { localStorage.removeItem(k) } catch { /* storage can be unavailable */ }
}

export function clearUserLocalState(userId) {
  if (!userId || typeof localStorage === 'undefined') return
  const prefix = `${PREFIX}:${userId}:`
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith(prefix)) localStorage.removeItem(k)
    }
    // Remove legacy unscoped health keys so an older build can never leak them forward.
    ;['healthConnected', 'healthPromptDismissed', 'wearableSignals', 'fitnessGoal'].forEach(k => localStorage.removeItem(k))
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith('weekly-')) localStorage.removeItem(k)
    }
  } catch { /* storage can be unavailable */ }
}
