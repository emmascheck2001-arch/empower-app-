// notificationPlan.js — decides WHAT to notify and WHEN. Pure, no Capacitor, unit-tested.
// The Capacitor side lives in notifications.js; this file holds all the judgement so it can
// be tested without a device.
//
// WHY THIS EXISTS: `@capacitor/push-notifications` was in package.json with ZERO lines of code
// using it. The app never spoke first. For a cycle app that is the whole advantage thrown
// away — it can predict when you will want it and it stayed silent. Retention data is
// consistent that behaviourally-triggered notifications convert far better than a broadcast
// schedule, so every notification here is triggered by HER data, never by a calendar blast.
//
// RULES (permanent, never loosen):
//  1. NEVER MORE THAN MAX_PER_WEEK. This app is about a woman's body; nagging her about it is
//     worse than saying nothing. Three triggers, no marketing, no streak-shaming.
//  2. NEVER GUILT. A missed day is never "you broke your streak". If the copy would make her
//     feel bad about her own body or her own consistency, it does not ship.
//  3. NEVER STATE A PREDICTION AS FACT. Period reminders say "around", and are only scheduled
//     when the model's confidence is better than 'none'.
//  4. NOTHING MEDICAL IN A NOTIFICATION. No symptom claims, no advice, no diagnosis — a
//     notification can be read by anyone who picks up her phone.
//  5. NOTHING PRIVATE ON THE LOCK SCREEN. Copy must be vague enough to be safe if someone
//     else sees it. No "your period", no symptom names in the title.

export const MAX_PER_WEEK = 3

// Stable ids so a reschedule replaces rather than duplicates.
export const IDS = { PERIOD: 1001, NUDGE: 1002, WEEKLY: 1003 }

const at = (date, hour, minute = 0) => {
  const d = new Date(date); d.setHours(hour, minute, 0, 0); return d
}

// status: a getTodayStatus() result. now: injectable for tests.
// opts: { streak, loggedToday, enabled }
// Returns [{ id, title, body, at: Date }] — always in the future, never more than MAX_PER_WEEK.
export function buildNotificationPlan(status, opts = {}, now = new Date()) {
  if (!opts.enabled) return []
  const out = []
  const { streak = 0, loggedToday = false } = opts

  // ── 1. Period approaching ───────────────────────────────────────────────
  // Two days out, at 9am. Deliberately hedged ("around") because it IS a prediction, and
  // deliberately vague on the lock screen — "a heads up from Em~power", not "your period".
  const pred = status?.nextPeriodPrediction
  if (pred?.predictedDate && pred.confidence && pred.confidence !== 'none') {
    const fire = at(new Date(new Date(pred.predictedDate).getTime() - 2 * 86400000), 9)
    if (fire > now) {
      out.push({
        id: IDS.PERIOD,
        title: 'A heads up from Em~power',
        // "Day 1" rather than naming it: clear to her, discreet if anyone else sees her lock
        // screen. Rule 5 exists because a period-tracking notification is not neutral for
        // everyone — a partner, a parent, a colleague glancing at a phone.
        body: pred.confidence === 'high'
          ? 'Day 1 is likely in about two days, going on your own cycles.'
          : 'Day 1 may fall in the next few days, going on your own cycles.',
        at: fire,
      })
    }
  }

  // ── 2. The gentle nudge ─────────────────────────────────────────────────
  // Only for someone who has ALREADY built a habit (3+ days), only if she has not logged
  // today, and worded so a missed day costs her nothing. Evening, so it catches the day.
  // Rescheduled on every app open and cancelled the moment she logs.
  if (streak >= 3 && !loggedToday) {
    const fire = at(now, 19)
    if (fire > now) {
      out.push({
        id: IDS.NUDGE,
        title: 'Em~power',
        body: `You have checked in ${streak} days running. Thirty seconds keeps the picture going.`,
        at: fire,
      })
    }
  }

  // ── 3. The weekly review ────────────────────────────────────────────────
  // Sunday morning, the once-a-week moment the app already builds.
  const sunday = at(now, 10)
  sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7))
  if (sunday <= now) sunday.setDate(sunday.getDate() + 7)
  out.push({
    id: IDS.WEEKLY,
    title: 'Your week, in review',
    body: 'Your weekly recap is ready whenever you are.',
    at: sunday,
  })

  return out.slice(0, MAX_PER_WEEK)
}

// Guardrail used by the test suite AND by notifications.js before anything is scheduled:
// nothing shipped may guilt, diagnose, or expose anything private on a lock screen.
const BANNED = [
  /broke your streak/i, /you lost/i, /don't forget/i, /you failed/i, /you missed/i,
  /diagnos/i, /symptom/i, /cramp/i, /pain/i, /fertil/i, /ovulat/i, /pregnan/i, /your period/i,
]
export function copyIsSafe(text) {
  return !BANNED.some(re => re.test(text || ''))
}
