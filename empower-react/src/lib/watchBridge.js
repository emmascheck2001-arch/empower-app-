// Thin JS→native wrapper over the WatchBridge Capacitor plugin (ios/App/App/WatchBridge.swift).
// Sends today's plan to the paired Apple Watch. No-ops safely on web and Android — the watch
// integration is iOS-only — so callers can fire it unconditionally. See WATCH_APP_SPEC.md.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { buildWatchPayload } from './watchPayload'

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
  const plan = buildWatchPayload(status, todayISO())
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
