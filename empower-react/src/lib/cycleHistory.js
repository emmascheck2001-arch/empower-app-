// Map a date to the cycle day it fell on, using the user's recorded period-start history.
// Anchors to the most recent start on/before the date. Dates before the earliest recorded
// start remain unclassified; the app does not paint fictional history backward.
import { diffCalendarDays } from './dateUtils.js'

export function cycleInfoForDate(dateStr, periodStarts, cycleLen) {
  if (!dateStr || !periodStarts?.length || !cycleLen) return null
  const date = new Date(dateStr + 'T00:00:00')
  let anchor = null
  let nextAnchor = null
  for (const ps of [...periodStarts].sort()) {
    if (new Date(ps + 'T00:00:00') <= date) anchor = ps
    else { nextAnchor = ps; break }
  }
  if (!anchor) return null
  const diff = diffCalendarDays(date, anchor + 'T00:00:00')
  const actualLength = nextAnchor ? diffCalendarDays(nextAnchor + 'T00:00:00', anchor + 'T00:00:00') : cycleLen
  if (diff < 0 || (!nextAnchor && diff >= cycleLen)) return null
  return { cycleDay: Math.min(diff + 1, actualLength), cycleLength: actualLength, anchor }
}

export function cycleDayForDate(dateStr, periodStarts, cycleLen) {
  return cycleInfoForDate(dateStr, periodStarts, cycleLen)?.cycleDay || null
}

// Summarise, per cycle day, what the user logged on that day across past cycles, so the plan
// can show a personal note ("you've logged lower energy around here"). Energy-based only for
// now (the clearest, least noisy signal). The user chooses whether to adapt; we never force it.
// Returns { [cycleDay]: { text, lighter, count } }, only days that have a real signal.
export function buildCycleDayHistory(logs, periodStarts, cycleLen) {
  const byDay = {}
  if (!logs || !periodStarts?.length || !cycleLen) return byDay
  const agg = {}
  for (const l of logs) {
    const cd = cycleDayForDate(l.log_date, periodStarts, cycleLen)
    if (!cd) continue
    agg[cd] = agg[cd] || { low: 0, high: 0 }
    if (l.energy === 'Very low' || l.energy === 'Low') agg[cd].low++
    else if (l.energy === 'High') agg[cd].high++
  }
  for (const cd in agg) {
    const a = agg[cd]
    if (a.low >= 3 && a.low >= a.high * 2) {
      byDay[cd] = { text: `you logged lower energy around here on ${a.low} tracked days`, lighter: true, count: a.low }
    } else if (a.high >= 3 && a.high >= a.low * 2) {
      byDay[cd] = { text: `you logged high energy around here on ${a.high} tracked days`, lighter: false, count: a.high }
    }
  }
  return byDay
}
