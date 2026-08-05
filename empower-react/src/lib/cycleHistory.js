// Map a date to the cycle day it fell on, using the user's recorded period-start history.
// Anchors to the most recent start on/before the date; extrapolates for dates before the
// earliest start. Mirrors the calendar's phase-anchoring so notes line up with the calendar.
export function cycleDayForDate(dateStr, periodStarts, cycleLen) {
  if (!dateStr || !periodStarts?.length || !cycleLen) return null
  const date = new Date(dateStr + 'T00:00:00')
  let anchor = new Date(periodStarts[0] + 'T00:00:00')
  for (const ps of periodStarts) {
    const d = new Date(ps + 'T00:00:00')
    if (d <= date) anchor = d
    else break
  }
  const diff = Math.floor((date - anchor) / 86400000)
  return (((diff % cycleLen) + cycleLen) % cycleLen) + 1
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
    if (a.low >= 1 && a.low >= a.high) {
      byDay[cd] = { text: `you logged lower energy around here ${a.low > 1 ? 'in past cycles' : 'last cycle'}`, lighter: true, count: a.low }
    } else if (a.high >= 1) {
      byDay[cd] = { text: `you felt strong around here ${a.high > 1 ? 'before' : 'last cycle'}`, lighter: false, count: a.high }
    }
  }
  return byDay
}
