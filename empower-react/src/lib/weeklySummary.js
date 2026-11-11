import { buildWeeklyHighlights } from './weeklyHighlights'
import { buildWeeklyObservation } from './weeklyObservation'
import { getPhase, isMeaningfulHealthLog } from './hormoneSync'
import { getUserLocal, setUserLocal } from './userLocalState'
import { diffCalendarDays, toDateStr } from './dateUtils'

const LAST_SHOWN_KEY = 'weekly-last-shown'
const DISMISSED_KEY = 'weekly-last-dismissed'
const NUDGE_SHOWN_KEY = 'weekly-nudge-last-shown'

function scoreEnergy(e) {
  return { 'Very low':1, 'Low':2, 'Normal':3, 'Good':3, 'High':4 }[e] ?? null
}

function scoreSleep(s) {
  return { 'Poor':1, 'Fair':2, 'Good':3, 'Great':4, 'Excellent':4 }[s] ?? null
}

export const WEEKLY_MIN_LOGS = 4

export function shouldShowWeeklySummary(logs, userId) {
  const last = getUserLocal(userId, LAST_SHOWN_KEY)
  if (last && diffCalendarDays(new Date(), last + 'T00:00:00') < 7) return false
  const thisWeek = (logs || []).filter((l) => {
    const diff = diffCalendarDays(new Date(), l.log_date + 'T00:00:00')
    return diff >= 0 && diff < 7 && isMeaningfulHealthLog(l)
  })
  return thisWeek.length >= WEEKLY_MIN_LOGS
}

export function weeklyLogProgress(logs) {
  const count = (logs || []).filter((l) => {
    const diff = diffCalendarDays(new Date(), l.log_date + 'T00:00:00')
    return diff >= 0 && diff < 7 && isMeaningfulHealthLog(l)
  }).length
  return { count, needed: Math.max(0, WEEKLY_MIN_LOGS - count) }
}

export function shouldShowWeeklyNudge(logs, userId) {
  const last = getUserLocal(userId, NUDGE_SHOWN_KEY)
  if (last && diffCalendarDays(new Date(), last + 'T00:00:00') < 7) return false
  const { count } = weeklyLogProgress(logs)
  return count >= 1 && count < WEEKLY_MIN_LOGS
}

export function markWeeklyNudgeShown(userId) {
  setUserLocal(userId, NUDGE_SHOWN_KEY, toDateStr())
}

export function markWeeklySummaryShown(userId) {
  setUserLocal(userId, LAST_SHOWN_KEY, toDateStr())
}

export function markWeeklySummaryDismissed(userId) {
  setUserLocal(userId, DISMISSED_KEY, toDateStr())
  setUserLocal(userId, LAST_SHOWN_KEY, toDateStr())
}

export function wasDismissedToday(userId) {
  const d = getUserLocal(userId, DISMISSED_KEY)
  return !!d && diffCalendarDays(new Date(), d + 'T00:00:00') === 0
}

export function buildWeeklySummary(logs, phase, subPhase, confidence, daysUntilPeriod, cycleDay, cycleLen) {
  const now = new Date()
  const thisWeek = logs.filter((l) => {
    const diff = diffCalendarDays(now, new Date(l.log_date + 'T00:00:00'))
    return diff >= 0 && diff < 7 && isMeaningfulHealthLog(l)
  })
  const lastWeek = logs.filter((l) => {
    const diff = diffCalendarDays(now, new Date(l.log_date + 'T00:00:00'))
    return diff >= 7 && diff < 14
  })
  const highlights = buildWeeklyHighlights(thisWeek, lastWeek)
  const daysLogged = thisWeek.length
  const workouts = thisWeek.filter((l) => l.workout_feel && l.workout_feel !== 'Rest day' && l.workout_feel !== 'Skipped').length

  const energyDays = thisWeek.filter((l) => scoreEnergy(l.energy) !== null)
  const goodEnergyPct = energyDays.length
    ? Math.round(energyDays.filter((l) => scoreEnergy(l.energy) >= 3).length / energyDays.length * 100)
    : null

  const sleepDays = thisWeek.filter((l) => scoreSleep(l.sleep_quality) !== null)
  const goodSleepPct = sleepDays.length
    ? Math.round(sleepDays.filter((l) => scoreSleep(l.sleep_quality) >= 3).length / sleepDays.length * 100)
    : null

  const workoutRate = daysLogged > 0 ? Math.round(workouts / daysLogged * 100) : null

  const moodTally = {}
  thisWeek.forEach((l) => {
    if (l.mood?.length) l.mood.forEach((m) => { moodTally[m] = (moodTally[m] || 0) + 1 })
  })
  const topMoods = Object.entries(moodTally).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const paired = thisWeek.filter((l) => scoreSleep(l.sleep_quality) !== null && scoreEnergy(l.energy) !== null)
  const goodSleepDays = paired.filter((l) => scoreSleep(l.sleep_quality) >= 3)
  const avgEnergyOnGoodSleep = goodSleepDays.length
    ? goodSleepDays.reduce((a, l) => a + scoreEnergy(l.energy), 0) / goodSleepDays.length
    : null
  const sleepEnergyCorrelation = avgEnergyOnGoodSleep !== null && avgEnergyOnGoodSleep >= 3

  const currentPhase = subPhase || phase || 'Observation'
  const confPct = Math.round((confidence || 0) * 100)
  const isLowerEnergyPhase = ['Menstrual', 'Late luteal', 'Mid luteal'].includes(currentPhase)
  const consistencyPct = Math.round(daysLogged / 7 * 100)
  const dominant = (field) => {
    const tally = {}
    thisWeek.forEach((l) => { if (l[field]) tally[l[field]] = (tally[l[field]] || 0) + 1 })
    return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  }
  const sleepWord = dominant('sleep_quality')
  const energyWord = dominant('energy')
  const moodWord = topMoods[0]?.[0] || null
  const observation = buildWeeklyObservation({ thisWeek, lastWeek, cycleDayToday: cycleDay, cycleLen: cycleLen || 28, phaseAt: getPhase })

  let nextPhaseLabel = null
  if (cycleDay && cycleLen && !['Perimenopause', 'observation', 'bc'].includes(phase)) {
    const futureCd = ((cycleDay + 5 - 1) % cycleLen) + 1
    const np = getPhase(futureCd, cycleLen)
    if (np && np !== phase) nextPhaseLabel = np
  }

  return {
    daysLogged,
    workouts,
    currentPhase,
    confPct,
    daysUntilPeriod,
    goodEnergyPct,
    goodSleepPct,
    workoutRate,
    topMoods,
    highlights,
    isLowerEnergyPhase,
    sleepEnergyCorrelation,
    paired,
    consistencyPct,
    sleepWord,
    energyWord,
    moodWord,
    observation,
    nextPhaseLabel,
  }
}
