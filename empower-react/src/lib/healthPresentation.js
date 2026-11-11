import { diffCalendarDays } from './dateUtils'

function startOfWorkoutWeek(now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const weekday = start.getDay()
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1
  start.setDate(start.getDate() - daysSinceMonday)
  return start
}

export function visibleWearableWorkouts(workouts, now = new Date()) {
  const weekStart = startOfWorkoutWeek(now)
  return (workouts || []).filter(w => {
    if (!w?.date) return false
    const activity = (w.activity || '').trim()
    const minutes = Number.isFinite(w.minutes) ? w.minutes : 0
    const calories = Number.isFinite(w.calories) ? w.calories : 0
    const km = Number.isFinite(w.km) ? w.km : 0
    const hasMeaningfulEffort = minutes >= 2 || calories > 0 || km > 0
    if (!hasMeaningfulEffort) return false
    if (activity === 'Other' && minutes < 10 && calories === 0 && km === 0) return false
    return diffCalendarDays(w.date, weekStart) >= 0
  }).slice(0, 4)
}
