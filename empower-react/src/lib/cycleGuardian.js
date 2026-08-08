// The cycle guardian. A sustained wearable temperature shift can estimate ovulation retrospectively.
// This module feeds that estimate back into the day-to-day cycle status
// so the phase everyone sees is anchored to what actually happened, not to a calendar estimate.
// This is what makes tracking work when a cycle is irregular, when there is no period date, or
// when the calendar has simply drifted: the body's own signal wins.
//
// It is deliberately conservative:
//  - It only acts on a sustained shift (3-over-6 coverline) and keeps estimate wording.
//  - It never touches hormonal-BC, pregnancy, or perimenopause status (those have no natural
//    ovulatory cycle to correct — matching the app's permanent medical rules).
//  - It is pure and native-only in practice: with no wearable data it returns the status
//    untouched, so the web app and non-connected users are completely unaffected.
import { getOvulationDay, getLutealSubPhase } from './hormoneSync'
import { getUserLocal } from './userLocalState'
import { diffCalendarDays } from './dateUtils.js'

const NATURAL_PHASES = ['Menstrual', 'Follicular', 'Ovulatory', 'Luteal', 'observation', null, undefined]

function daysSinceISO(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d)) return null
  return diffCalendarDays(new Date(), dateStr + 'T00:00:00')
}

function prettyDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return isNaN(d) ? dateStr : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

// status: getTodayStatus() output. signals: wearableCycleSignals() output. lastPeriodDate:
// the user's most recently logged period start (YYYY-MM-DD), if any.
// Returns a (possibly corrected) copy of status. Always safe to call.
export function applyWearableOvulation(status, signals, lastPeriodDate) {
  if (!status || !(signals?.ovulationEstimated || signals?.ovulationConfirmed) || !signals.ovulationDate) return status
  // Never override non-cycling states (hormonal BC / pregnancy / perimenopause).
  if (!NATURAL_PHASES.includes(status.phase)) return status

  // A freshly logged period ALWAYS wins. If the wearable's ovulation is on or before the last
  // logged period start, it belongs to a previous cycle — that cycle is over, so ignore it.
  // Without this, a stale ovulation could override a period the user just logged.
  if (lastPeriodDate && signals.ovulationDate <= lastPeriodDate) return status

  const cycleLen = status.cycleLen || 28
  const daysSinceOv = daysSinceISO(signals.ovulationDate)
  // Ignore a shift that is in the future, or too old to belong to the current cycle.
  if (daysSinceOv == null || daysSinceOv < 0 || daysSinceOv > cycleLen + 3) return status

  const ovDay = getOvulationDay(cycleLen)
  const phaseDay = ovDay + daysSinceOv
  const daysSincePeriod = daysSinceISO(lastPeriodDate)
  const periodDay = daysSincePeriod != null ? daysSincePeriod + 1 : null

  let phase, subPhase = null
  if (daysSinceOv <= 1) { phase = 'Ovulatory' }
  else { phase = 'Luteal'; subPhase = getLutealSubPhase(phaseDay, cycleLen) }

  const corrected = phase !== status.phase || (subPhase && subPhase !== status.subPhase)
  const when = prettyDate(signals.ovulationDate)

  return {
    ...status,
    // A temperature shift establishes time since ovulation, but cannot invent a cycle day
    // when no period start was recorded.
    cycleDay: periodDay && periodDay > 0 ? periodDay : status.cycleDay ?? null,
    phase,
    subPhase,
    daysUntilPeriod: Math.max(0, cycleLen - ovDay - daysSinceOv),
    ovulationConfirmed: false,
    ovulationEstimated: true,
    ovulationSource: 'wearable',
    phaseEvidence: { status: 'estimated', source: 'wearable_temperature_shift', label: 'Retrospective estimate from a sustained wearable temperature shift.' },
    guardian: {
      corrected,
      ovulationDate: signals.ovulationDate,
      daysSinceOv,
      cardiovascularSupport: signals.cardiovascularLutealSupport || 0,
      note: corrected
        ? `Your wearable temperature suggests you likely ovulated around ${when}, so we have updated you to your ${phase.toLowerCase()} phase to match your body rather than the calendar. This is an estimate, not a medical result.`
        : `Your wearable temperature lines up with ovulation around ${when}, matching your tracked cycle.`,
    },
  }
}

// Convenience for the shared status pipeline: read the wearable signals the HealthConnect card
// persisted to localStorage and apply them. On the web (or for anyone who never connected a
// wearable) there is no stored signal, so this returns the status completely untouched.
export function applyWearableOvulationFromStorage(status, lastPeriodDate, userId) {
  try {
    const raw = getUserLocal(userId, 'wearableSignals')
    if (!raw) return status
    return applyWearableOvulation(status, JSON.parse(raw), lastPeriodDate)
  } catch { return status }
}
