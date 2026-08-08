// Thin JS→native wrapper over the WatchBridge Capacitor plugin (ios/App/App/WatchBridge.swift).
// Sends today's plan to the paired Apple Watch. No-ops safely on web and Android — the watch
// integration is iOS-only — so callers can fire it unconditionally. See WATCH_APP_SPEC.md.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { buildWorkoutPayload } from './watchPayload'
import { buildWatchWorkouts } from './watchWorkouts'

// registerPlugin returns a proxy even when the native side is absent; we gate on platform so we
// never call into a plugin that isn't there.
const WatchBridge = registerPlugin('WatchBridge')

function isIOSNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

// Local yyyy-MM-dd (the plan is "today" in the user's own timezone, not UTC).
function todayISO() {
  const d = new Date()
  const off = d.getTimezoneOffset() * 60000
  return new Date(d - off).toISOString().slice(0, 10)
}

// Build from getTodayStatus output and push to the watch. Returns true if a send was attempted.
export async function syncPlanToWatch(status) {
  if (!isIOSNative()) return false
  const plan = buildWatchWorkouts(status, todayISO())
  if (!plan) return false
  try {
    await WatchBridge.sendPlan({ plan })
    return true
  } catch (e) {
    // A missing/unpaired watch is expected and harmless — never surface it to the user.
    console.debug('Watch sync skipped:', e?.message || e)
    return false
  }
}

// True only on an iOS native build (used to show/hide the manual "Sync watch" button).
export function watchSyncAvailable() {
  return isIOSNative()
}

// Manual sync for the dashboard button. Unlike syncPlanToWatch (fire-and-forget), this returns a
// short, user-facing result so the button can tell her exactly what happened.
export async function syncWatchWithFeedback(status) {
  if (!isIOSNative()) return { ok: false, message: 'Apple Watch sync is only available in the iOS app.' }
  const plan = buildWatchWorkouts(status, todayISO())
  if (!plan) return { ok: false, message: 'No plan to send yet — try again in a moment.' }
  try {
    const res = await WatchBridge.sendPlan({ plan })
    if (res?.sent) return { ok: true, message: `Sent ${plan.phase} to your watch. Open the watch app to see it.` }
    if (res?.queued) return { ok: true, message: 'Connecting to your watch… it will update shortly. Open the watch app.' }
    if (res?.reason === 'no paired watch') return { ok: false, message: 'No Apple Watch is paired with this iPhone.' }
    if (res?.reason === 'watch app not installed') return { ok: false, message: 'Install Em~power on your Apple Watch first (Watch app → Em~power → Install).' }
    return { ok: false, message: 'Could not reach your watch. Make sure it is nearby and unlocked.' }
  } catch (e) {
    return { ok: false, message: 'Watch sync failed: ' + (e?.message || 'unknown error') }
  }
}

// Push a CONCRETE generated workout (real exercises + weights) to the watch — call this when a
// gym plan is on screen so the watch shows the user's actual session, not movement guidance.
export async function syncWorkoutToWatch(status, workout) {
  if (!isIOSNative()) return false
  const plan = buildWorkoutPayload(status, workout, todayISO())
  if (!plan) return false
  try {
    await WatchBridge.sendPlan({ plan })
    return true
  } catch (e) {
    console.debug('Watch workout sync skipped:', e?.message || e)
    return false
  }
}
