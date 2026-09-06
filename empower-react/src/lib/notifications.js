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

// Fixed ids so re-scheduling replaces rather than stacks. Notifications are rebuilt on every app
// open because the prediction they are based on moves as the user logs. We pre-schedule a horizon
// of one-off daily nudges rather than a repeating reminder so phase alerts can replace the daily
// nudge on overlapping dates and the user never gets more than one notification in a day.
const DAILY_REMINDER_START_ID = 1001
const DAILY_REMINDER_HORIZON_DAYS = 45
const DAILY_REMINDER_IDS = Array.from({ length: DAILY_REMINDER_HORIZON_DAYS }, (_, i) => DAILY_REMINDER_START_ID + i)
const PHASE_IDS = [2001, 2002, 2003]

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

function inferOvulationDay(status) {
  const cycleLen = status?.cycleLen || 28
  const learnedLutealLength = status?.learnedLutealLength || 14
  if (status?.phaseCorrection?.estimatedOvulationDay != null) return status.phaseCorrection.estimatedOvulationDay
  if (status?.learnedBaselines?.avgOvulationDay != null) return status.learnedBaselines.avgOvulationDay
  return Math.max(8, Math.round(cycleLen - learnedLutealLength))
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

// Builds the one-off, prediction-driven alerts. These are the notifications with a real reason to
// exist: a woman who will not open an app to log symptoms will open one that tells her when her
// period is coming. Recomputed on every app open because daysUntilPeriod moves as she logs.
//
// Deliberately NOT included: any "safe day" or contraceptive framing. The fertile-window alert is
// awareness-only wording and carries no instruction to act on, per the permanent FDA rule in
// CLAUDE.md. It is also gated to users with real cycle phase data, so hormonal-BC, perimenopause,
// and pregnancy users never receive it.
export function buildPhaseNotifications(status, today = todayStr(), hour = DEFAULT_REMINDER_HOUR, minute = DEFAULT_REMINDER_MINUTE, now = new Date()) {
  const out = []
  if (!status) return out

  const { daysUntilPeriod, cycleDay, cycleLen, phase } = status
  // Only natural-cycle users get cycle-timed alerts. Path 4, hormonal BC, and pregnancy return
  // null cycleDay / daysUntilPeriod from getTodayStatus, so this check covers all three.
  const hasCycle = cycleDay != null && cycleLen != null && daysUntilPeriod != null
  if (!hasCycle) return out

  // 1. Two days before the predicted period — the single most-opened notification in any cycle app.
  if (daysUntilPeriod >= 2) {
    out.push({
      id: PHASE_IDS[0],
      title: 'Em~power',
      body: 'Your period is estimated to start in about 2 days. A good moment to get ahead of it.',
      date: atLocalTime(addDays(today, daysUntilPeriod - 2), hour, minute),
      route: '/calendar',
      dateKey: addDays(today, daysUntilPeriod - 2),
      priority: 3,
    })
  }

  // 2. The predicted day itself, framed as a question so it doubles as a logging prompt.
  if (daysUntilPeriod >= 1) {
    out.push({
      id: PHASE_IDS[1],
      title: 'Em~power',
      body: 'Your period is estimated for today. Did it arrive? Logging it sharpens your next prediction.',
      date: atLocalTime(addDays(today, daysUntilPeriod), hour, minute),
      route: '/log',
      dateKey: addDays(today, daysUntilPeriod),
      priority: 4,
    })
  }

  // 3. Estimated fertile window opening. Awareness only, never actionable.
  const ovulationDay = inferOvulationDay(status)
  const fertileStart = ovulationDay - 5
  if (phase && cycleDay < fertileStart) {
    out.push({
      id: PHASE_IDS[2],
      title: 'Em~power',
      body: 'Your estimated fertile window opens today. This is an estimate for awareness, not birth control.',
      date: atLocalTime(addDays(today, fertileStart - cycleDay), hour, minute),
      route: '/calendar',
      dateKey: addDays(today, fertileStart - cycleDay),
      priority: 2,
    })
  }

  // The OS silently drops anything in the past; filter so we never schedule a no-op.
  return out.filter(n => n.date > now)
}

export function buildNotificationSchedule(status, {
  today = todayStr(),
  hour = DEFAULT_REMINDER_HOUR,
  minute = DEFAULT_REMINDER_MINUTE,
  now = new Date(),
} = {}) {
  const byDate = new Map()
  const candidates = [
    ...buildDailyNotifications(today, hour, minute, now),
    ...buildPhaseNotifications(status, today, hour, minute, now),
  ]
  for (const item of candidates) {
    const current = byDate.get(item.dateKey)
    if (!current || item.priority > current.priority) byDate.set(item.dateKey, item)
  }
  return [...byDate.values()]
    .sort((a, b) => a.date - b.date)
    .map(({ dateKey, priority, ...item }) => item)
}

export async function schedulePhaseAlerts(status, hour = DEFAULT_REMINDER_HOUR, minute = DEFAULT_REMINDER_MINUTE) {
  if (!notificationsSupported()) return 0
  try {
    await LocalNotifications.cancel({ notifications: PHASE_IDS.map(id => ({ id })) })
    const items = buildPhaseNotifications(status, todayStr(), hour, minute)
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
    console.error('Failed to schedule phase alerts', e)
    return 0
  }
}

export async function cancelAllNotifications() {
  if (!notificationsSupported()) return
  try {
    await LocalNotifications.cancel({
      notifications: [...DAILY_REMINDER_IDS.map(id => ({ id })), ...PHASE_IDS.map(id => ({ id }))],
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

// Called on every dashboard load: keeps the daily reminder alive and rebuilds phase alerts against
// the newest prediction. Safe to call repeatedly.
export async function refreshNotifications({ enabled, hour, minute }, status) {
  if (!notificationsSupported()) return
  if (!enabled) { await cancelAllNotifications(); return }
  const perm = await getNotificationPermission()
  if (perm !== 'granted') return
  await scheduleNotificationPlan(status, hour ?? DEFAULT_REMINDER_HOUR, minute ?? DEFAULT_REMINDER_MINUTE)
}
