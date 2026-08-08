// weeklyObservation.js, the "One Observation" in the Weekly Review. Scans a user's own week
// of logs for the single most compelling, PERSONAL pattern and states it plainly. This is the
// "the app noticed something about me" moment, so it must be true, specific, and hedged.
//
// RULES (never loosen):
//  - Only surface an observation the data actually supports (minimum counts + a real gap).
//  - Reference HER specifics (a weekday, a comparison) so it feels personal, not generic.
//  - Never causal beyond what tracking shows ("track together", "ran higher"), never a diagnosis.
//  - If nothing qualifies, return the honest "keep logging" line.
// Pure computation only, unit-tested.

import { diffCalendarDays } from './dateUtils.js'

const ENERGY = { 'Very low':1, 'Low':2, 'Normal':3, 'Good':3, 'High':4 }
const SLEEPQ = { Poor:1, Fair:2, Good:3, Great:4, Excellent:4 }
const POS = new Set(['Energised','Energetic','Happy','Motivated','Confident','Social','Calm','Focused'])
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const avg = (a) => (a.length ? a.reduce((x,y)=>x+y,0)/a.length : null)
const isWorkout = (l) => l.workout_feel && l.workout_feel !== 'Rest day' && l.workout_feel !== 'Skipped'
const weekdayOf = (s) => WEEKDAYS[new Date(s + 'T00:00:00').getDay()]
const posRate = (logs) => {
  const m = logs.filter(l => Array.isArray(l.mood) && l.mood.length)
  if (!m.length) return null
  return m.filter(l => l.mood.some(x => POS.has(x))).length / m.length
}
// weekday of the single unique maximum of valueFn (null if tied or too little data)
function uniquePeakDay(logs, valueFn, minVal) {
  const scored = logs.map(l => ({ l, v: valueFn(l) })).filter(x => x.v != null)
  if (scored.length < 3) return null
  const max = Math.max(...scored.map(x => x.v))
  if (max < minVal) return null
  const at = scored.filter(x => x.v === max)
  return at.length === 1 ? at[0].l : null
}
function uniqueMinDay(logs, valueFn, maxVal) {
  const scored = logs.map(l => ({ l, v: valueFn(l) })).filter(x => x.v != null)
  if (scored.length < 3) return null
  const min = Math.min(...scored.map(x => x.v))
  if (min > maxVal) return null
  const at = scored.filter(x => x.v === min)
  return at.length === 1 ? at[0].l : null
}

// getPhaseAt is passed in (from hormoneSync) so this file stays pure/testable.
export function buildWeeklyObservation({ thisWeek = [], cycleDayToday = null, cycleLen = 28, phaseAt = null } = {}) {
  if (thisWeek.length < 3) return 'Keep logging and Em~power will surface the patterns unique to you here.'
  const cands = []

  // 1) Sleep → energy, the strongest, most useful personal lever.
  const paired = thisWeek.filter(l => SLEEPQ[l.sleep_quality] && ENERGY[l.energy])
  const goodS = paired.filter(l => SLEEPQ[l.sleep_quality] >= 3)
  const poorS = paired.filter(l => SLEEPQ[l.sleep_quality] <= 2)
  if (goodS.length >= 2 && poorS.length >= 1) {
    const ge = avg(goodS.map(l => ENERGY[l.energy])), pe = avg(poorS.map(l => ENERGY[l.energy]))
    if (ge - pe >= 0.7) cands.push({ score: 95, text: 'On the days you slept well this week, your energy the next day ran clearly higher than on your rougher nights. Sleep is one of your strongest levers right now.' })
  }

  // 2) Training → mood.
  const wkDays = thisWeek.filter(isWorkout)
  const restDays = thisWeek.filter(l => !isWorkout(l))
  if (wkDays.length >= 2 && restDays.length >= 1) {
    const wp = posRate(wkDays), rp = posRate(restDays)
    if (wp != null && rp != null && wp - rp >= 0.3) cands.push({ score: 88, text: 'On the days you trained in this seven-day window, you also logged more positive moods than on rest days. They moved together here; this does not prove that one caused the other.' })
  }

  // 3) Energy peak day, aligned to her cycle phase, the "your hormones at work" moment.
  const peak = uniquePeakDay(thisWeek, l => ENERGY[l.energy] ?? null, 3)
  if (peak && cycleDayToday && phaseAt) {
    const now = new Date(); now.setHours(0,0,0,0)
    const daysAgo = diffCalendarDays(now, new Date(peak.log_date + 'T00:00:00'))
    const cd = (((cycleDayToday - daysAgo - 1) % cycleLen) + cycleLen) % cycleLen + 1
    const ph = phaseAt(cd, cycleLen)
    if (ph === 'Follicular' || ph === 'Ovulatory') {
      cands.push({ score: 60, text: `Your highest logged energy was on ${weekdayOf(peak.log_date)}, which fell in your estimated ${ph.toLowerCase()} window. One day is an observation, not yet a cycle pattern.` })
    } else {
      cands.push({ score: 60, text: `Your energy was highest on ${weekdayOf(peak.log_date)} this week.` })
    }
  }

  // 4) Stress → sleep tracking.
  const stressPeak = uniquePeakDay(thisWeek, l => (typeof l.stress_level === 'number' ? l.stress_level : null), 4)
  if (stressPeak && SLEEPQ[stressPeak.sleep_quality] && SLEEPQ[stressPeak.sleep_quality] <= 2) {
    cands.push({ score: 80, text: `Your most stressful day this week, ${weekdayOf(stressPeak.log_date)}, was also one of your worst nights of sleep. Stress and sleep track closely for you.` })
  }

  // 5) Lowest-energy day tied to poor sleep, a specific "sleep drives you" moment.
  const lowE = uniqueMinDay(thisWeek, l => ENERGY[l.energy] ?? null, 2)
  if (lowE && SLEEPQ[lowE.sleep_quality] && SLEEPQ[lowE.sleep_quality] <= 2) {
    cands.push({ score: 82, text: `Your flattest day this week, ${weekdayOf(lowE.log_date)}, came right after one of your poorer nights of sleep. Sleep and energy move together for you.` })
  }

  // 6) A clearly dominant mood.
  const moodTally = {}
  thisWeek.forEach(l => { if (Array.isArray(l.mood)) l.mood.forEach(m => { moodTally[m] = (moodTally[m] || 0) + 1 }) })
  const topMood = Object.entries(moodTally).sort((a,b) => b[1]-a[1])[0]
  if (topMood && topMood[1] >= 3) cands.push({ score: 55, text: `${topMood[0]} was the feeling you logged most often this week.` })

  // 7) Training volume, a body note, never a logging note.
  const trained = thisWeek.filter(isWorkout).length
  if (trained >= 3) cands.push({ score: 52, text: `You trained ${trained} days this week, a strong, consistent block of movement.` })

  // 8) Energy trend across the week.
  const byDay = [...thisWeek].filter(l => ENERGY[l.energy]).sort((a,b) => (a.log_date < b.log_date ? -1 : 1))
  if (byDay.length >= 4) {
    const half = Math.floor(byDay.length / 2)
    const early = avg(byDay.slice(0, half).map(l => ENERGY[l.energy]))
    const late = avg(byDay.slice(half).map(l => ENERGY[l.energy]))
    if (early - late >= 0.6) cands.push({ score: 50, text: 'Your energy ran higher earlier in the week and eased off toward the end.' })
    else if (late - early >= 0.6) cands.push({ score: 50, text: 'Your energy built through the week, ending stronger than it started.' })
  }

  if (cands.length) return cands.sort((a,b) => b.score - a.score)[0].text
  // Fallback, about her body, never about how much she logged.
  if (topMood) return `${topMood[0]} was the feeling you logged most this week.`
  return 'Your energy and mood held fairly steady this week, without a strong standout day. As you keep logging, patterns unique to you will surface here.'
}
