// notifications.js — the Capacitor side of re-engagement. All judgement lives in
// notificationPlan.js (pure + unit-tested); this file only talks to the OS.
//
// LOCAL, not push. Every trigger is computed on the device from her own data, so there is no
// server, no APNs key, no cost, and — importantly — her cycle data never leaves the phone to
// schedule a reminder about it. `@capacitor/push-notifications` was installed but unused and
// would have required sending her predictions to a backend; local notifications do not.
//
// Native only. Every function no-ops safely on web.
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { buildNotificationPlan, copyIsSafe, IDS } from './notificationPlan.js'
import { track } from './analytics.js'

const PREF_KEY = 'empower_notifications_enabled'

export function isNative() { return Capacitor.isNativePlatform() }

// Opt-in, and OFF until she says yes. A health app must never assume permission to interrupt.
export function notificationsEnabled() {
  try { return localStorage.getItem(PREF_KEY) === 'true' } catch { return false }
}
export function setNotificationsEnabled(on) {
  try { localStorage.setItem(PREF_KEY, on ? 'true' : 'false') } catch { /* ignore */ }
}

// Ask the OS. Returns true only if she actually granted it.
export async function requestPermission() {
  if (!isNative()) return false
  try {
    const r = await LocalNotifications.requestPermissions()
    return r?.display === 'granted'
  } catch (e) { console.error('notification permission failed', e); return false }
}

export async function hasPermission() {
  if (!isNative()) return false
  try { return (await LocalNotifications.checkPermissions())?.display === 'granted' }
  catch { return false }
}

async function cancelOurs() {
  try {
    const pending = await LocalNotifications.getPending()
    const ours = (pending?.notifications || []).filter(n => Object.values(IDS).includes(n.id))
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map(n => ({ id: n.id })) })
  } catch (e) { console.error('cancel failed', e) }
}

// Recompute and reschedule everything. Safe to call as often as we like — it cancels our own
// ids first, so repeated calls replace rather than pile up. Call it on dashboard load and
// after every log save (so the evening nudge disappears the moment she logs).
export async function syncNotifications(status, { streak = 0, loggedToday = false } = {}) {
  if (!isNative()) return { scheduled: 0, reason: 'web' }
  if (!notificationsEnabled()) { await cancelOurs(); return { scheduled: 0, reason: 'disabled' } }
  if (!(await hasPermission())) return { scheduled: 0, reason: 'no-permission' }

  const plan = buildNotificationPlan(status, { enabled: true, streak, loggedToday })
  // Belt and braces: the copy guard runs again here, so nothing unsafe can reach the OS even
  // if someone edits a string in notificationPlan.js without running the tests.
  const safe = plan.filter(n => copyIsSafe(n.title) && copyIsSafe(n.body))
  if (safe.length !== plan.length) console.error('notification copy blocked by safety guard')

  await cancelOurs()
  if (!safe.length) return { scheduled: 0, reason: 'nothing-to-say' }
  try {
    await LocalNotifications.schedule({
      notifications: safe.map(n => ({
        id: n.id, title: n.title, body: n.body,
        schedule: { at: n.at, allowWhileIdle: true },
      })),
    })
    return { scheduled: safe.length }
  } catch (e) { console.error('schedule failed', e); return { scheduled: 0, reason: 'error' } }
}

// Turn on: ask the OS, remember the choice, schedule immediately so she sees it work.
export async function enableNotifications(status, ctx) {
  const granted = await requestPermission()
  setNotificationsEnabled(granted)
  if (granted) await syncNotifications(status, ctx)
  return granted
}

export async function disableNotifications() {
  setNotificationsEnabled(false)
  await cancelOurs()
}


// ── did a notification actually bring her back? ─────────────────────────────
// The whole point of re-engagement is the return visit, and nothing was measuring it. This
// records a tap on one of OUR notifications (matched by id, so an unrelated app's
// notification can never be attributed to us) and routes her to the right screen.
//
// Registered once from App.jsx. Safe to call on web, where it does nothing.
const ID_NAMES = { [IDS.PERIOD]: 'period_ahead', [IDS.NUDGE]: 'nudge', [IDS.WEEKLY]: 'weekly_review' }
let listenerRegistered = false

export async function registerNotificationOpenHandler(onNavigate) {
  if (!isNative() || listenerRegistered) return
  listenerRegistered = true
  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const id = event?.notification?.id
      const which = ID_NAMES[id]
      if (!which) return           // not one of ours — never attribute someone else's tap
      track('notification_opened', { which })
      if (typeof onNavigate !== 'function') return
      if (which === 'nudge') onNavigate('/log')
      else if (which === 'weekly_review') onNavigate('/dashboard')
      else onNavigate('/calendar')
    })
  } catch (e) {
    // A failed listener must never stop the app from starting.
    console.error('notification listener failed', e)
    listenerRegistered = false
  }
}
