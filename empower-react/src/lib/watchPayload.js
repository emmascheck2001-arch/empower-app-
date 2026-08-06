// Builds the phone→watch payload from the app's OWN computed status — it invents nothing.
// The shape here is the wire contract decoded by the watch (PlanStore / TodayPlan in
// ios/App/Empower Watch Watch App). See WATCH_APP_SPEC.md. Pure and unit-tested; safe to call
// anywhere getTodayStatus output is available.
import { getMovementToday } from './movementToday'

// Pick the watch activity bucket that best matches the day's movement guidance. We only read
// the (already phase-adapted) title/detail text — no new prescription is created here.
function inferActivity(text) {
  const t = (text || '').toLowerCase()
  // Strength is checked first: when guidance offers "strength session OR a run", the headline
  // intent is the lift, so it shouldn't be misread as cardio.
  if (t.includes('strength') || t.includes('lift') || t.includes('resistance') ||
      t.includes('build day') || t.includes('compound') || t.includes('heavy')) return 'Gym'
  if (t.includes('yoga') || t.includes('stretch') || t.includes('mobility')) return 'Yoga'
  if (t.includes('walk')) return 'Walk'
  if (t.includes('run')) return 'Run'
  if (t.includes('cycl') || t.includes('bike') || t.includes('spin')) return 'Cycle'
  if (t.includes('swim')) return 'Swim'
  if (t.includes('rest') || t.includes('recover')) return 'Rest'
  if (t.includes('tempo') || t.includes('cardio')) return 'Walk'
  return 'Gym' // strength-leaning guidance (steady strength, priority, etc.)
}

// status: the object returned by getTodayStatus. dateISO: yyyy-MM-dd the plan is for.
// Returns { phase, date, workouts:[{ activity, title, detail, exercises:[] }] }.
export function buildWatchPayload(status, dateISO) {
  if (!status) return null

  // Pregnancy is never auto-prescribed a workout (permanent app rule) — send guidance only.
  if (status.phase === 'Pregnancy') {
    return {
      phase: status.subPhase || 'Pregnancy',
      date: dateISO || null,
      workouts: [{
        activity: 'Walk',
        title: 'Move as your provider advised',
        detail: 'Gentle, cleared-by-your-provider movement. Stop and call your provider if anything feels off.',
        exercises: [],
      }],
    }
  }

  const move = getMovementToday(status.phase, status.subPhase)
  const phaseLabel = status.subPhase || status.phase || 'Today'

  const workouts = [{
    activity: inferActivity(`${move.title} ${move.detail}`),
    title: move.title,
    detail: move.detail,
    exercises: [], // exercise-level detail (weights/reps) is added when the guided player syncs
  }]

  return { phase: phaseLabel, date: dateISO || null, workouts }
}
