// The cycle guardian. Wearable temperature CONFIRMS ovulation directly from the body (see
// wearableCycle.js). This module feeds that confirmation back into the day-to-day cycle status
// so the phase everyone sees is anchored to what actually happened, not to a calendar estimate.
// This is what makes tracking work when a cycle is irregular, when there is no period date, or
// when the calendar has simply drifted: the body's own signal wins.
//
// It is deliberately conservative:
//  - It only acts on a CONFIRMED temperature shift (3-over-6 coverline), never a guess.
//  - It never touches hormonal-BC, pregnancy, or perimenopause status (those have no natural
//    ovulatory cycle to correct — matching the app's permanent medical rules).
//  - It is pure and native-only in practice: with no wearable data it returns the status
//    untouched, so the web app and non-connected users are completely unaffected.
import { getOvulationDay, getLutealSubPhase } from './hormoneSync'

const NATURAL_PHASES = ['Menstrual', 'Follicular', 'Ovulatory', 'Luteal', 'observation', null, undefined]

function daysSinceISO(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d)) return null
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.floor((now - d) / 86400000)
}

function prettyDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return isNaN(d) ? dateStr : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

// status: getTodayStatus() output. signals: wearableCycleSignals() output.
// Returns a (possibly corrected) copy of status. Always safe to call.
export function applyWearableOvulation(status, signals) {
  if (!status || !signals?.ovulationConfirmed || !signals.ovulationDate) return status
  // Never override non-cycling states (hormonal BC / pregnancy / perimenopause).
  if (!NATURAL_PHASES.includes(status.phase)) return status

  const cycleLen = status.cycleLen || 28
  const daysSinceOv = daysSinceISO(signals.ovulationDate)
  // Ignore a shift that is in the future, or too old to belong to the current cycle.
  if (daysSinceOv == null || daysSinceOv < 0 || daysSinceOv > cycleLen + 3) return status

  const ovDay = getOvulationDay(cycleLen)          // where ovulation sits in a cycle of this length
  const correctedCycleDay = ovDay + daysSinceOv    // anchor "today" to the confirmed ovulation

  let phase, subPhase = null
  if (daysSinceOv <= 1) { phase = 'Ovulatory' }
  else { phase = 'Luteal'; subPhase = getLutealSubPhase(correctedCycleDay, cycleLen) }

  const corrected = phase !== status.phase || (subPhase && subPhase !== status.subPhase)
  const when = prettyDate(signals.ovulationDate)

  return {
    ...status,
    cycleDay: correctedCycleDay,
    phase,
    subPhase,
    daysUntilPeriod: Math.max(0, cycleLen - correctedCycleDay),
    ovulationConfirmed: true,
    ovulationSource: 'wearable',
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
export function applyWearableOvulationFromStorage(status) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return status
    const raw = window.localStorage.getItem('wearableSignals')
    if (!raw) return status
    return applyWearableOvulation(status, JSON.parse(raw))
  } catch { return status }
}
