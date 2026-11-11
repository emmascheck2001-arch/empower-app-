// Local notifications — the only mechanism the app has ever had for bringing a user back.
//
// Why this exists: across the first ten weeks of real use, every dormant user who returned did so
// because Emma personally messaged them. Nothing in the product could ask. This module is the
// scheduled, non-manual version of that nudge.
//
// Everything here is LOCAL (scheduled on the device by the OS). There is no push server, no token,
// no payload leaving the phone, so no cycle information is ever transmitted to schedule a reminder.
// Native only; every function no-ops safely on web so the PWA build is unaffected.
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

// Fixed ids so re-scheduling replaces rather than stacks. We pre-schedule a horizon of one-off
// daily check-in reminders because that is the only reminder cadence users opt into here.
const DAILY_REMINDER_START_ID = 1001
const DAILY_REMINDER_HORIZON_DAYS = 45
const DAILY_REMINDER_IDS = Array.from({ length: DAILY_REMINDER_HORIZON_DAYS }, (_, i) => DAILY_REMINDER_START_ID + i)
// These ids belonged to cycle-prediction notifications in earlier builds. Keep them only long
// enough to cancel an already-scheduled alert when someone updates to this version.
const LEGACY_PHASE_IDS = [2001, 2002, 2003]

export const DEFAULT_REMINDER_HOUR = 9
export const DEFAULT_REMINDER_MINUTE = 0

export function notificationsSupported() {
  return Capacitor.isNativePlatform()
}

// 'granted' | 'denied' | 'prompt' | 'unsupported'
export async function getNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  try {
    const r = await LocalNotifications.checkPermissions()
    return r?.display || 'prompt'
  } catch { return 'unsupported' }
}

// Shows the OS permission sheet. Returns true only if the user allowed it.
export async function requestNotificationPermission() {
  if (!notificationsSupported()) return false
  try {
    const r = await LocalNotifications.requestPermissions()
    return r?.display === 'granted'
  } catch (e) {
    console.error('Notification permission request failed', e)
    return false
  }
}

function atLocalTime(dateStr, hour, minute) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, hour, minute, 0, 0)
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildDailyNotifications(today = todayStr(), hour = DEFAULT_REMINDER_HOUR, minute = DEFAULT_REMINDER_MINUTE, now = new Date()) {
  const out = []
  for (let offset = 0; offset < DAILY_REMINDER_HORIZON_DAYS; offset++) {
    const dateKey = addDays(today, offset)
    const date = atLocalTime(dateKey, hour, minute)
    if (date <= now) continue
    out.push({
      id: DAILY_REMINDER_START_ID + offset,
      title: 'Em~power',
      body: 'How did today feel? A few taps keeps your pattern building.',
      date,
      route: '/log',
      dateKey,
      priority: 0,
    })
  }
  return out
}

// Compatibility wrapper. Schedules only the daily horizon when called directly.
export async function scheduleDailyReminder(hour = DEFAULT_REMINDER_HOUR, minute = DEFAULT_REMINDER_MINUTE) {
  if (!notificationsSupported()) return 0
  try {
    await LocalNotifications.cancel({ notifications: DAILY_REMINDER_IDS.map(id => ({ id })) })
    const items = buildDailyNotifications(todayStr(), hour, minute)
    if (!items.length) return 0
    await LocalNotifications.schedule({
      notifications: items.map(n => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: n.date, allowWhileIdle: true },
        extra: { route: n.route },
      })),
    })
    return items.length
  } catch (e) {
    console.error('Failed to schedule daily reminders', e)
    return 0
  }
}

export async function cancelDailyReminder() {
  if (!notificationsSupported()) return
  try { await LocalNotifications.cancel({ notifications: DAILY_REMINDER_IDS.map(id => ({ id })) }) }
  catch { /* nothing scheduled */ }
}

export function buildNotificationSchedule(status, {
  today = todayStr(),
  hour = DEFAULT_REMINDER_HOUR,
  minute = DEFAULT_REMINDER_MINUTE,
  now = new Date(),
} = {}) {
  // Keep the parameter for callers that already pass live status. Prediction data deliberately
  // does not influence reminders: this is one optional daily logging reminder for everyone.
  void status
  return buildDailyNotifications(today, hour, minute, now)
    .map(({ id, title, body, date, route }) => ({ id, title, body, date, route }))
}

export async function cancelAllNotifications() {
  if (!notificationsSupported()) return
  try {
    await LocalNotifications.cancel({
      notifications: [...DAILY_REMINDER_IDS.map(id => ({ id })), ...LEGACY_PHASE_IDS.map(id => ({ id }))],
    })
  } catch { /* nothing scheduled */ }
}

async function scheduleNotificationPlan(status, hour = DEFAULT_REMINDER_HOUR, minute = DEFAULT_REMINDER_MINUTE) {
  if (!notificationsSupported()) return 0
  try {
    await cancelAllNotifications()
    const items = buildNotificationSchedule(status, { hour, minute })
    if (!items.length) return 0
    await LocalNotifications.schedule({
      notifications: items.map(n => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: n.date, allowWhileIdle: true },
        extra: { route: n.route },
      })),
    })
    return items.length
  } catch (e) {
    console.error('Failed to schedule notification plan', e)
    return 0
  }
}

// Called on every dashboard load: keeps the daily logging reminder alive. Safe to call repeatedly.
export async function refreshNotifications({ enabled, hour, minute }, status) {
  if (!notificationsSupported()) return 0
  if (!enabled) { await cancelAllNotifications(); return 0 }
  const perm = await getNotificationPermission()
  if (perm !== 'granted') return 0
  return scheduleNotificationPlan(status, hour ?? DEFAULT_REMINDER_HOUR, minute ?? DEFAULT_REMINDER_MINUTE)
}

// A visible, user-triggered proof that the OS can deliver notifications on this device. This is
// deliberately separate from the daily schedule: it makes a permission or device-settings issue
// obvious instead of leaving someone wondering whether tomorrow's reminder will arrive.
export async function scheduleNotificationTest() {
  if (!notificationsSupported()) return { ok: false, reason: 'unsupported' }
  try {
    const permission = await getNotificationPermission()
    if (permission !== 'granted') return { ok: false, reason: 'permission' }
    await LocalNotifications.schedule({
      notifications: [{
        id: 3001,
        title: 'Em~power',
        body: 'Notifications are working. Your next check-in reminder is scheduled.',
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
        extra: { route: '/log' },
      }],
    })
    return { ok: true }
  } catch (error) {
    console.error('Failed to schedule notification test', error)
    return { ok: false, reason: 'schedule' }
  }
}
