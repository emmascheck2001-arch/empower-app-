// weeklyHighlights.js, the "your week in review" recap lines for the Sunday Weekly Insights.
// PERMANENT RULE: every line is a factual statement about what the user ACTUALLY logged this
// week (or a comparison to last week, only when both weeks have data). No predictions, no
// population claims, nothing invented. A peak day is named ONLY when there is a single clear
// maximum, never when several days tie, which would imply a peak that isn't there.
// Pure computation only (no supabase) so it is unit-tested.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ENERGY = { 'Very low': 1, 'Low': 2, 'Normal': 3, 'Good': 3, 'High': 4 }

const isWorkout = (l) => l.workout_feel && l.workout_feel !== 'Rest day' && l.workout_feel !== 'Skipped'
const weekdayOf = (dateStr) => WEEKDAYS[new Date(dateStr + 'T00:00:00').getDay()]
const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null)

// Returns the weekday name of the single day with the unique maximum of `valueFn`, or null
// if there is no data or the maximum is tied across days (no clear peak to honestly name).
function uniquePeakDay(logs, valueFn, minValue) {
  const scored = logs.map(l => ({ l, v: valueFn(l) })).filter(x => x.v != null)
  if (scored.length < 3) return null
  const max = Math.max(...scored.map(x => x.v))
  if (max < minValue) return null
  const atMax = scored.filter(x => x.v === max)
  return atMax.length === 1 ? weekdayOf(atMax[0].l.log_date) : null
}

export function buildWeeklyHighlights(thisWeek = [], lastWeek = []) {
  const h = []

  // Days trained this week.
  const workouts = thisWeek.filter(isWorkout).length
  if (workouts > 0) h.push(`You trained ${workouts} day${workouts === 1 ? '' : 's'} this week.`)

  // …and how that compares to last week (only if last week has enough data to compare).
  if (workouts > 0 && lastWeek.length >= 3) {
    const lastWorkouts = lastWeek.filter(isWorkout).length
    const d = workouts - lastWorkouts
    if (d !== 0) h.push(`That is ${Math.abs(d)} ${Math.abs(d) === 1 ? 'session' : 'sessions'} ${d > 0 ? 'more' : 'fewer'} than last week.`)
  }

  // Energy peak day, only when one day clearly stands out and it was a good-energy day.
  const energyPeak = uniquePeakDay(thisWeek, l => ENERGY[l.energy] ?? null, 3)
  if (energyPeak) h.push(`Your energy was highest on ${energyPeak}.`)

  // Stress peak day, only when one day clearly stands out and stress was elevated.
  const stressPeak = uniquePeakDay(thisWeek, l => (typeof l.stress_level === 'number' ? l.stress_level : null), 4)
  if (stressPeak) h.push(`Your stress was highest on ${stressPeak}.`)

  // Sleep hours vs last week, only when BOTH weeks have logged hours.
  const tHours = thisWeek.map(l => l.sleep_hours).filter(n => typeof n === 'number' && n > 0)
  const lHours = lastWeek.map(l => l.sleep_hours).filter(n => typeof n === 'number' && n > 0)
  if (tHours.length >= 3 && lHours.length >= 3) {
    const diffMin = Math.round((avg(tHours) - avg(lHours)) * 60)
    if (Math.abs(diffMin) >= 10) h.push(`You slept about ${Math.abs(diffMin)} minutes ${diffMin > 0 ? 'more' : 'less'} per night than last week.`)
  }

  return h
}
