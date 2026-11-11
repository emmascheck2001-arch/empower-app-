// hormoneSync.js, shared algorithm module
// All phase logic lives here. Import getTodayStatus into every screen.
import { interpretMoodSignal, getMoodContextFeedback, checkFlag, getPersonalisedNutritionFocus, getPersonalisedWorkoutReadiness } from './algorithm_v3.js'
import { analyzePersonalPatterns } from './personalPatterns.js'
import { analyzeMoodPatterns, analyzeSymptomPatterns } from './symptomPatterns.js'
import { applyWearableOvulationFromStorage } from './cycleGuardian.js'
import { diffCalendarDays, toDateStr } from './dateUtils.js'
import { detectOvulationFromTemp } from './wearableCycle.js'

// Thrown by getTodayStatus when a critical Supabase read fails. Callers should catch this and show
// an explicit "couldn't load your data — try again" state, NEVER fall back to fabricated defaults.
export class HealthDataError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'HealthDataError'
    this.cause = cause
  }
}

// User-facing personalisation is deliberately DISTINCT from forecast confidence. It answers
// "how much of my own data shapes the guidance?", not "how likely is this date prediction to be
// right?" The old count-only formula saturated every daily-log contribution at 64 entries; a
// person could log every day and remain at 70% until another period started. That is both
// discouraging and false to the amount of individual information available for guidance.
//
// This score is evidence coverage, not a probability. It rewards five things that materially make
// advice more individual: repeated daily observations, time observed, signal breadth, period
// anchors, and a pattern that has actually repeated. It reaches 100 only for broad, sustained
// data; it never changes the separately calculated cycle-timing estimate.
const PERSONALISATION_WINDOW_DAYS = 90
const PERSONALISATION_SIGNAL_DOMAINS = 5

function validLogDates(logs) {
  return [...new Set((logs || []).map(log => log?.log_date).filter(date => ISO_DATE.test(date || '')))].sort()
}

function observationSpanDays(dates) {
  if (!dates.length) return 0
  return diffCalendarDays(dates[dates.length - 1] + 'T00:00:00', dates[0] + 'T00:00:00') + 1
}

function signalDomainCount(logs, mucusLogs) {
  const has = predicate => (logs || []).some(predicate)
  const nonNone = value => value && value !== 'None' && value !== 'None of these'
  const domains = [
    has(log => Boolean(log.energy)),
    has(log => Boolean(log.sleep_quality || log.sleep_hours || log.workout_feel_reported)),
    has(log => (log.mood || []).length > 0 || log.stress_level != null),
    has(log => (log.symptoms || []).some(nonNone) || nonNone(log.flow_volume) || log.pain_rating != null || Boolean(log.libido)),
    has(log => log.resting_hr != null || log.resting_hr_exact != null || log.wrist_temp != null || Boolean(log.lh_result))
      || (mucusLogs || []).some(log => nonNone(log.discharge_type)),
  ]
  return domains.filter(Boolean).length
}

export function personalisationProgress({ logs = [], mucusLogs = [], cyclesTracked = 0, hasRepeatedPattern = false } = {}) {
  const meaningfulLogs = (logs || []).filter(isMeaningfulHealthLog)
  const dates = validLogDates(meaningfulLogs)
  const meaningfulLogDays = dates.length
  const spanDays = observationSpanDays(dates)
  const domains = signalDomainCount(meaningfulLogs, mucusLogs)
  const cycles = Math.max(0, cyclesTracked || 0)

  // 40 points for continued daily observation through 90 days, 15 for longitudinal time (so
  // backfilled entries from one date cannot imitate a real history), 15 for useful breadth, 20
  // for two independent cycle anchors, and 10 only once a pattern has repeated.
  const fromDailyCoverage = Math.min(0.40, meaningfulLogDays / PERSONALISATION_WINDOW_DAYS * 0.40)
  const fromTimeObserved = Math.min(0.15, spanDays / PERSONALISATION_WINDOW_DAYS * 0.15)
  const fromSignalBreadth = domains / PERSONALISATION_SIGNAL_DOMAINS * 0.15
  const fromCycleAnchors = Math.min(0.20, cycles * 0.10)
  const fromRepeatedPattern = hasRepeatedPattern ? 0.10 : 0
  const pct = Math.round(Math.min(1, fromDailyCoverage + fromTimeObserved + fromSignalBreadth + fromCycleAnchors + fromRepeatedPattern) * 100)
  const personalisationEvidence = {
    meaningfulLogDays,
    spanDays,
    signalDomains: domains,
    cyclesTracked: cycles,
    hasRepeatedPattern,
  }
  const label = pct >= 85 ? 'Strongly personalised guidance'
    : pct >= 65 ? 'Your guidance is becoming personalised'
    : pct >= 35 ? 'Early personal pattern'
    : pct >= 5 ? 'Starting to learn your baseline'
    : 'Using research-informed general guidance'
  return {
    personalisationPct: pct,
    personalisationLabel: label,
    personalisationEvidence,
    nextMilestone: nextPersonalisationMilestone(personalisationEvidence),
  }
}

// The next step describes guidance coverage only. Period-date reliability is intentionally
// reported separately below, because a long run of symptom logs is not proof of future timing.
export function nextPersonalisationMilestone({ meaningfulLogDays = 0, spanDays = 0, signalDomains = 0, cyclesTracked = 0, hasRepeatedPattern = false } = {}) {
  if (meaningfulLogDays < 3) {
    const remaining = 3 - meaningfulLogDays
    return { remaining, text: `${remaining} more check-${remaining === 1 ? 'in' : 'ins'} and Em~power can start learning from your own observations.` }
  }
  if (signalDomains < 3) {
    return { remaining: 1, text: 'Adding sleep, mood, symptoms, or body signals gives Em~power a fuller picture of your day-to-day pattern.' }
  }
  if (spanDays < PERSONALISATION_WINDOW_DAYS) {
    const remaining = PERSONALISATION_WINDOW_DAYS - spanDays
    return { remaining, text: `You have ${meaningfulLogDays} meaningful daily observations. Continued check-ins over the next ${remaining} day${remaining === 1 ? '' : 's'} deepen how personal your guidance becomes.` }
  }
  if (cyclesTracked < 2) {
    return { remaining: 2 - cyclesTracked, text: 'Recording period starts across two cycles helps connect your day-to-day observations to your cycle history.' }
  }
  if (!hasRepeatedPattern) {
    return { remaining: 1, text: 'Your guidance already uses your own data. Repeated observations across cycles will unlock individual pattern insights when the evidence is consistent.' }
  }
  return { remaining: 0, text: 'Your guidance is built from broad, repeated observations in your own history.' }
}

function predictionOutcomes(predictionSnapshots = [], periodStarts = []) {
  const starts = [...new Set((periodStarts || []).filter(date => ISO_DATE.test(date || '')))].sort()
  return (predictionSnapshots || []).map(snapshot => {
    if (!ISO_DATE.test(snapshot?.cycle_start_date || '') || !ISO_DATE.test(snapshot?.predicted_period_date || '') || !ISO_DATE.test(snapshot?.window_start || '') || !ISO_DATE.test(snapshot?.window_end || '')) return null
    const actualPeriodDate = starts.find(date => date > snapshot.cycle_start_date)
    if (!actualPeriodDate) return null
    return {
      actualPeriodDate,
      absoluteErrorDays: Math.abs(diffCalendarDays(actualPeriodDate + 'T00:00:00', snapshot.predicted_period_date + 'T00:00:00')),
      insideWindow: actualPeriodDate >= snapshot.window_start && actualPeriodDate <= snapshot.window_end,
    }
  }).filter(Boolean)
}

// This is a timing-reliability label, not a probability. It cannot be improved merely by more
// daily check-ins: a new period start is required to test the date estimate against what occurred.
// Three outcome-checked predictions are the minimum for the app to call its own timing history
// validated; before then it must say only that the history is developing.
export function cycleTimingReliability(cyclesTracked = 0, predictionSnapshots = [], periodStarts = []) {
  const cycles = Math.max(0, cyclesTracked || 0)
  const outcomes = predictionOutcomes(predictionSnapshots, periodStarts)
  const scoredPredictions = outcomes.length
  if (scoredPredictions >= 3) {
    const inWindowRate = Math.round(outcomes.filter(outcome => outcome.insideWindow).length / scoredPredictions * 100)
    const medianErrorDays = medianOf(outcomes.map(outcome => outcome.absoluteErrorDays))
    if (inWindowRate >= 80 && medianErrorDays <= 2) {
      return {
        level: 'validated', label: 'Cycle timing: validated history',
        detail: `${scoredPredictions} previous estimates were checked against recorded starts; ${inWindowRate}% landed inside their prediction windows.`,
        scoredPredictions, inWindowRate, medianErrorDays,
      }
    }
    return {
      level: 'variable', label: 'Cycle timing: variable history',
      detail: `${scoredPredictions} previous estimates were checked against recorded starts. Your timing varies, so Em~power will keep a broader estimate window.`,
      scoredPredictions, inWindowRate, medianErrorDays,
    }
  }
  if (cycles < 1) return { level: 'initial', label: 'Cycle timing: initial estimate', detail: 'Log the start of your next period to begin building a personal timing history.', scoredPredictions }
  const stillNeeded = 3 - scoredPredictions
  return {
    level: 'developing', label: 'Cycle timing: developing',
    detail: `Based on ${cycles} completed cycle${cycles === 1 ? '' : 's'}. ${stillNeeded} more checked estimate${stillNeeded === 1 ? '' : 's'} are needed before Em~power can validate timing reliability.`,
    scoredPredictions,
  }
}

export function isMeaningfulHealthLog(log) {
  if (!log) return false
  const symptoms = (log.symptoms || []).filter(s => s && s !== 'None')
  const moods = (log.mood || []).filter(Boolean)
  const disruptors = (log.disruptors || []).filter(d => d && d !== 'None of these')
  return Boolean(
    log.energy || log.sleep_quality || log.resting_hr || log.resting_hr_exact ||
    log.wrist_temp || log.flow_volume || log.pain_rating || log.lh_result ||
    log.stress_level || log.libido || log.hot_flash_count || log.night_sweats_severity ||
    log.joint_pain_rating || log.brain_fog_rating ||
    symptoms.length || moods.length || disruptors.length || log.workout_feel_reported === true
  )
}

export function getHormonalContext(profile) {
  if (profile?.user_path === '6') return 'pregnancy'
  if (profile?.user_path === '4') return String(profile?.bc_type || '').startsWith('Menopause') ? 'postmenopause' : 'perimenopause'
  if (profile?.user_path === '5' && profile?.bc_type !== 'copper-iud') {
    const method = ['pill','minipill','patch','ring','hormonal-iud','implant','depo'].includes(profile?.bc_type) ? profile.bc_type : 'unknown'
    return `contraception-${method}`
  }
  if (profile?.user_path === '2') return 'post-contraception'
  return 'natural-cycle'
}

function belongsToCurrentContext(log, contextKey) {
  if (log?.hormonal_context) return log.hormonal_context === contextKey
  // Legacy rows predate provenance (no context tag). They are the user's real history, so ALWAYS
  // count them in the current context. Only logs with an EXPLICIT different context are separated.
  return true
}

// ── Phase calculation (canonical, never duplicate this elsewhere) ──────────
// Ovulation timing fallback: when no personal luteal length is available, use the common
// 14-day population estimate, so ovulation falls roughly cycleLen − 14 rather than mid-cycle.
// A mid-cycle (cycleLen/2) assumption is only correct for a 28-day cycle and misplaces
// the fertile window for everyone else (e.g. a 35-day cycle ovulates ~day 21, not 18).
// Clamped to a sensible floor for very short cycles. (Luteal length: Münster 2021.)
export const POPULATION_LUTEAL_LENGTH = 14
export const LUTEAL_LENGTH = POPULATION_LUTEAL_LENGTH
export function getOvulationDay(cycleLen, lutealLength = POPULATION_LUTEAL_LENGTH) {
  return Math.max(8, Math.round((cycleLen || 28) - (lutealLength || POPULATION_LUTEAL_LENGTH)))
}

// periodLength (optional) is the user's actual/recorded bleeding length. When they mark a
// period ended, days past it must move to Follicular instead of staying "Menstrual" through
// a hardcoded day 5. Defaults to 5 when unknown, so existing 2-arg callers are unchanged.
export function getPhase(cycleDay, cycleLen, periodLength, lutealLength = POPULATION_LUTEAL_LENGTH, ovulationDay = null) {
  // A current-cycle LH or cervical-fluid signal can refine the ovulation estimate. Keep this
  // optional so historical cycles and callers without a signal continue to use the learned
  // luteal-length estimate.
  const signalledOvulationDay = Number(ovulationDay)
  const ovulation = Number.isInteger(signalledOvulationDay) && signalledOvulationDay >= 8 && signalledOvulationDay < cycleLen
    ? signalledOvulationDay
    : getOvulationDay(cycleLen, lutealLength)
  const menstrualEnd = Math.min(Math.max(periodLength || 5, 1), ovulation - 3)
  if (cycleDay <= menstrualEnd) return 'Menstrual'
  if (cycleDay <= ovulation - 2) return 'Follicular'
  if (cycleDay <= ovulation + 1) return 'Ovulatory'
  return 'Luteal'
}

export function getLutealSubPhase(cycleDay, cycleLen, lutealLength = POPULATION_LUTEAL_LENGTH, ovulationDay = null) {
  const signalledOvulationDay = Number(ovulationDay)
  const ovulation = Number.isInteger(signalledOvulationDay) && signalledOvulationDay >= 8 && signalledOvulationDay < cycleLen
    ? signalledOvulationDay
    : getOvulationDay(cycleLen, lutealLength)
  const lutealDay = cycleDay - ovulation - 1
  if (lutealDay <= 4) return 'Early luteal'
  if (lutealDay <= 9) return 'Mid luteal'
  return 'Late luteal'
}

// Source: CLAUDE.md canonical period prediction, export so all screens use same logic
// Two completed cycles is the point at which the app trusts a user's own history over
// population norms — one cycle cannot show whether it is typical for her or a one-off.
export const MIN_CYCLES_FOR_PERSONAL_ESTIMATE = 2

// True median. With an EVEN number of cycles, taking sorted[n/2] returned the upper of the two
// middle gaps, which pushed the prediction to the long end of the user's own range and left the
// predicted day sitting on the window's outer edge (gaps [17,32] predicted 32, not 24.5).
// Averaging the two middle values keeps the estimate inside the window it is drawn from.
export function medianOf(values) {
  const sorted = [...(values || [])].sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// With only two completed cycles, a much longer earlier gap can mean a period was not recorded.
// Do not erase that history: it still widens the forecast window and keeps confidence low. But a
// recent, substantially shorter cycle is a better point estimate than the midpoint between the
// two dates. Once three or more cycles are available, the normal median is robust to one outlier.
function estimateCycleLength(gaps, fallbackCycleLength) {
  const plausible = (gaps || []).filter(g => g >= 15 && g <= 365)
  if (plausible.length < MIN_CYCLES_FOR_PERSONAL_ESTIMATE) {
    return Math.max(15, Math.round(fallbackCycleLength) || 28)
  }

  const [earlierGap, latestGap] = plausible
  const sparseHistoryHasLongEarlierGap = plausible.length === 2 &&
    earlierGap > 45 &&
    latestGap < earlierGap &&
    earlierGap - latestGap >= 8

  if (sparseHistoryHasLongEarlierGap) return latestGap
  return Math.max(15, Math.round(medianOf(plausible)) || 28)
}

export const predictNextPeriod = (lastPeriodDate, avgCycleLength, cyclesTracked, gaps) => {
  const lastPeriod = new Date(lastPeriodDate + 'T00:00:00')
  const addDays = n => { const d = new Date(lastPeriod); d.setDate(d.getDate() + n); return d }
  // Research-backed prediction (Bull 2019; Li 2020/2023; Munro/FIGO 2018; Symul 2019; Broad 2022):
  //  - Point estimate = the median recorded gap, except for a sparse two-cycle history where an
  //    earlier long gap is followed by a substantially shorter recent cycle. The older gap stays
  //    visible rather than being deleted; it still forces a low-confidence/irregular label.
  //  - Window scales to the user's OWN dispersion, not a fake ±2 days, and widens when the cycle
  //    is irregular or history is thin — honesty over false precision.
  //  - Gaps under 15 days are likely duplicate/intermenstrual starts. Very long gaps up to a year
  //    remain as health history, though missing intermediate entries are also possible.
  const plausible = (gaps || []).filter(g => g >= 15 && g <= 365)
  // A single observed cycle is a data point, not a pattern — one atypical cycle would otherwise
  // become the forecast outright. Population/onboarding cycle length carries the estimate until
  // there are at least two completed cycles to compare against each other. The cycle is still
  // used for the window and the irregular flag, so nothing she logged is ignored.
  const point = estimateCycleLength(plausible, avgCycleLength)
  const predictedDate = addDays(point)

  const irregular = plausible.some(g => g < 21 || g > 45) || (plausible.length >= 2 && (Math.max(...plausible) - Math.min(...plausible)) >= 8)
  let startOff, endOff
  if (plausible.length >= 2) {
    startOff = Math.min(...plausible); endOff = Math.max(...plausible)
  } else {
    const half = irregular ? 14 : (cyclesTracked >= 1 ? 4 : 5)
    startOff = point - half; endOff = point + half
  }
  startOff = Math.max(15, Math.min(startOff, point))
  endOff = Math.max(endOff, point)                     // window must include the predicted day
  if (endOff <= startOff) { startOff = Math.max(15, point - 1); endOff = point + 1 }
  const windowStart = addDays(startOff)
  const windowEnd = addDays(endOff)

  const confidence = cyclesTracked >= 3 && !irregular ? 'moderate'
    : cyclesTracked >= 2 ? 'low'
    : cyclesTracked === 1 ? 'low'
    : 'none'
  return { predictedDate, windowStart, windowEnd, confidence, irregular, provenance: 'cycle_history_prediction' }
}

// ── Period-start history ────────────────────────────────────────────────────
// cycle_data has a unique constraint on user_id (one row per user), so it can only
// hold ONE last_period_date. Logging a new period used to OVERWRITE that single
// date, erasing every earlier period from the calendar. To keep a real history
// without a schema change, we stash every logged period-start date as JSON in the
// otherwise-unused cycle_data.notes column: {"periodStarts":["YYYY-MM-DD",...]}.
// last_period_date still holds the most recent start (everything else reads that).
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Read the full list of recorded period starts (ascending). Falls back to
// last_period_date for older rows that predate the notes-history format.
export function parsePeriodStarts(cycleData) {
  if (!cycleData) return []
  const set = new Set()
  if (cycleData.notes) {
    try {
      const parsed = JSON.parse(cycleData.notes)
      if (parsed && Array.isArray(parsed.periodStarts)) {
        parsed.periodStarts.forEach(d => { if (ISO_DATE.test(d)) set.add(d) })
      }
    } catch { /* notes isn't our JSON, ignore and fall back to last_period_date */ }
  }
  if (cycleData.last_period_date && ISO_DATE.test(cycleData.last_period_date)) set.add(cycleData.last_period_date)
  return [...set].sort()
}

// Bleeding length has the same single-column problem period starts had: cycle_data holds
// ONE period_length for the whole user, so marking a 3-day period ended retroactively redrew
// every earlier cycle as 3 days. Lengths are therefore stored per cycle, keyed by that
// cycle's start date: {"periodStarts":[...],"periodLengths":{"2026-06-18":5,...}}.
export function parsePeriodLengths(cycleData) {
  if (!cycleData?.notes) return {}
  try {
    const parsed = JSON.parse(cycleData.notes)
    const raw = parsed?.periodLengths
    if (!raw || typeof raw !== 'object') return {}
    const out = {}
    for (const [start, len] of Object.entries(raw)) {
      const n = Number(len)
      if (ISO_DATE.test(start) && Number.isFinite(n) && n >= 1 && n <= 14) out[start] = n
    }
    return out
  } catch { return {} }
}

// Read whatever we already have in notes so no merge helper silently drops the other key.
function parseNotesPayload(existingNotes) {
  const starts = new Set()
  let lengths = {}
  if (existingNotes) {
    try {
      const parsed = JSON.parse(existingNotes)
      if (parsed && Array.isArray(parsed.periodStarts)) parsed.periodStarts.forEach(d => starts.add(d))
      lengths = parsePeriodLengths({ notes: existingNotes })
    } catch { /* ignore non-JSON notes */ }
  }
  return { starts, lengths }
}

function serialiseNotes(starts, lengths) {
  const periodStarts = [...starts].filter(d => ISO_DATE.test(d)).sort()
  return Object.keys(lengths).length
    ? JSON.stringify({ periodStarts, periodLengths: lengths })
    : JSON.stringify({ periodStarts })
}

// Merge a newly logged period start into the existing history and return the JSON
// string to store in cycle_data.notes. Never drops a previously recorded start.
export function mergePeriodStartsNotes(existingNotes, existingLastDate, newDate) {
  const { starts, lengths } = parseNotesPayload(existingNotes)
  if (existingLastDate) starts.add(existingLastDate)
  if (newDate) starts.add(newDate)
  return serialiseNotes(starts, lengths)
}

// Record how long ONE period lasted, against the cycle it belongs to. Every other cycle's
// recorded length is preserved untouched — logging today's period can never rewrite history.
export function mergePeriodLengthNotes(existingNotes, existingLastDate, startDate, length) {
  const { starts, lengths } = parseNotesPayload(existingNotes)
  if (existingLastDate) starts.add(existingLastDate)
  const n = Number(length)
  if (ISO_DATE.test(startDate || '') && Number.isFinite(n)) {
    starts.add(startDate)
    lengths[startDate] = Math.min(Math.max(Math.round(n), 1), 14)
  }
  return serialiseNotes(starts, lengths)
}

// Rebuild each cycle's bleeding length from the days flow was actually logged. This is how
// cycles recorded before per-cycle lengths existed get their real value back, with no
// migration. A single missing day mid-period is bridged: a one-day hole is far more often a
// skipped log than a genuine stop-start, and breaking the run there would under-count.
const MAX_LOG_GAP_DAYS = 2   // consecutive = 1; a single skipped day = 2
export function derivePeriodLengthsFromFlow(logs, periodStarts) {
  if (!logs?.length || !periodStarts?.length) return {}
  const bleedDays = logs
    .filter(l => l.flow_volume && l.flow_volume !== 'None')
    .map(l => l.log_date)
    .filter(d => ISO_DATE.test(d))
    .sort()
  if (!bleedDays.length) return {}
  const starts = [...periodStarts].sort()
  const out = {}
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]
    const nextStart = starts[i + 1] || null
    // Only days belonging to THIS cycle: on/after its start, before the next one begins.
    const own = bleedDays.filter(d => d >= start && (!nextStart || d < nextStart))
    if (!own.length) continue
    let last = own[0]
    for (const d of own.slice(1)) {
      if (diffCalendarDays(d + 'T00:00:00', last + 'T00:00:00') > MAX_LOG_GAP_DAYS) break
      last = d
    }
    out[start] = Math.min(diffCalendarDays(last + 'T00:00:00', start + 'T00:00:00') + 1, 14)
  }
  return out
}

// Resolve the bleeding length for the cycle a date falls in. Falls back to the user's most
// recent recorded length ONLY for the newest cycle, never for history.
export function periodLengthForStart(startStr, periodLengths, latestStart, fallbackLength) {
  if (periodLengths && periodLengths[startStr] != null) return periodLengths[startStr]
  if (startStr && startStr === latestStart && fallbackLength) return fallbackLength
  return null
}

// Resolve per-cycle bleeding lengths for status screens. Stored values remain authoritative for
// completed past cycles, while the CURRENT cycle is allowed to extend from live flow logs so
// today's phase cannot jump to Follicular mid-bleed just because the old scalar period_length
// still says "3". That keeps Home aligned with Calendar for the active cycle.
export function resolvePeriodLengths(cycleData, logs = []) {
  const starts = parsePeriodStarts(cycleData)
  const latestStart = starts.length ? starts[starts.length - 1] : null
  const derived = derivePeriodLengthsFromFlow(logs, starts)
  const recorded = parsePeriodLengths(cycleData)
  const periodLengths = { ...derived, ...recorded }
  if (latestStart && derived[latestStart] != null) {
    periodLengths[latestStart] = Math.max(periodLengths[latestStart] || 0, derived[latestStart])
  }
  const currentStart = cycleData?.last_period_date || latestStart
  const current = periodLengthForStart(currentStart, periodLengths, latestStart, cycleData?.period_length || null)
  return { periodLengths, current }
}

// Remove a mistaken period-start entry without touching that day's symptom or bleeding log.
// Returns the new most-recent anchor so every prediction can move back consistently.
export function removePeriodStartNotes(existingNotes, existingLastDate, removeDate) {
  const { starts, lengths } = parseNotesPayload(existingNotes)
  if (existingLastDate) starts.add(existingLastDate)
  starts.delete(removeDate)
  delete lengths[removeDate]
  const periodStarts = [...starts].filter(date => date !== removeDate && ISO_DATE.test(date)).sort()
  const nextLatest = periodStarts.length ? periodStarts[periodStarts.length - 1] : null
  return {
    notes:serialiseNotes(new Set(periodStarts), lengths),
    periodStarts,
    lastPeriodDate:nextLatest,
    periodLength:lengths[nextLatest] ?? null,
  }
}

function getFollicularSubPhase(cycleDay) {
  // Early follicular: days 6-9, late follicular: day 10+
  return cycleDay <= 9 ? 'Early follicular' : 'Late follicular'
}

// Breakthrough / intermenstrual bleeding is not a new cycle, but it is often logged as a period
// start. When the pattern is clearly a short, light bleed too soon after the previous start, keep
// it on the calendar but leave it out of cycle-length maths so one breakthrough bleed does not
// teach the app a false 17-day "normal".
const HEAVIER_THAN_LIGHT = ['moderate', 'heavy', 'very heavy']
export function classifyPeriodStarts(periodStarts, logs = [], periodLengths = {}) {
  const starts = [...(periodStarts || [])].sort()
  if (!starts.length) return []
  const byDate = {}
  for (const l of logs || []) if (l?.log_date) byDate[l.log_date] = l
  const derived = derivePeriodLengthsFromFlow(logs, starts)
  return starts.map((start, i) => {
    const prev = i > 0 ? starts[i - 1] : null
    const gapFromPrev = prev ? diffCalendarDays(start + 'T00:00:00', prev + 'T00:00:00') : null
    const days = periodLengths?.[start] ?? derived[start] ?? null
    let heaviest = null
    for (let d = 0; d < (days || 1); d++) {
      const dt = new Date(start + 'T00:00:00')
      dt.setDate(dt.getDate() + d)
      const flow = byDate[dt.toISOString().slice(0, 10)]?.flow_volume
      if (flow && HEAVIER_THAN_LIGHT.includes(String(flow).toLowerCase())) heaviest = flow
    }
    const likelyBreakthrough = gapFromPrev != null && gapFromPrev < 21 &&
      days != null && days <= 2 && !heaviest
    return { start, gapFromPrev, days, heaviest, likelyBreakthrough }
  })
}

// Reconstruct how many real cycles the user has tracked, from the recorded period-start
// history (cycle_data.notes + last_period_date). A "cycle" is the gap between two
// consecutive recorded starts. Gaps under 15 days are excluded so duplicate/intermenstrual
// entries do not inflate the number; long gaps remain visible rather than being normalised away.
// confidence score should grow with accumulated cycles, the real measure of how much the app
// has learned about YOU, not just how many days you've logged. Recorded period starts remain on
// the calendar; a likely breakthrough bleed is only excluded from cycle-length maths.
export function computeCycleHistory(cycleData, profileCycleLen, logs = []) {
  const starts = parsePeriodStarts(cycleData)
  const classified = classifyPeriodStarts(starts, logs, parsePeriodLengths(cycleData))
  const breakthroughStarts = classified.filter(c => c.likelyBreakthrough).map(c => c.start)
  const realStarts = starts.filter(s => !breakthroughStarts.includes(s))
  const gaps = []
  for (let i = 1; i < realStarts.length; i++) {
    const g = diffCalendarDays(realStarts[i] + 'T00:00:00', realStarts[i - 1] + 'T00:00:00')
    if (g >= 15 && g <= 365) gaps.push(g)
  }
  const cyclesTracked = gaps.length
  // Keep atypical cycles visible. A long earlier gap remains part of the history and widens the
  // prediction window, while the point estimate can favour a clearly newer, shorter interval in
  // sparse history where the long gap may contain an unrecorded period.
  const sorted = [...gaps].sort((a, b) => a - b)
  // Her own median only once two cycles exist to compare; before that the entered/population
  // length carries it, so a single long or short cycle cannot masquerade as her normal. Prefer
  // the profile/onboarding length here; cycle_data.cycle_length may itself be a stale learned
  // value from before a mistaken start was corrected.
  const avgCycleLength = estimateCycleLength(gaps, profileCycleLen || cycleData?.cycle_length || 28)
  const variabilityDays = sorted.length >= 2 ? sorted[sorted.length - 1] - sorted[0] : null
  return { cyclesTracked, avgCycleLength, periodStarts: starts, gaps, variabilityDays, breakthroughStarts, classifiedStarts: classified }
}

function averageOf(values = []) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function medianRounded(values = []) {
  const mid = medianOf(values)
  return mid == null ? null : Math.round(mid)
}

function normalizeStoredBaselines(baselines) {
  if (!baselines) return {}
  const num = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const int = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.round(parsed) : null
  }
  return {
    avgCycleLength: num(baselines.avg_cycle_length),
    avgLutealLength: num(baselines.avg_luteal_length),
    avgOvulationDay: int(baselines.avg_ovulation_day),
    ovulationVariationDays: int(baselines.ovulation_variation_days),
    avgPeakMucusDay: int(baselines.avg_peak_mucus_day),
    mucusPeakLeadDays: int(baselines.mucus_peak_lead_days),
    tempFollicularBaseline: num(baselines.temp_follicular_baseline),
    rhrFollicularBaseline: num(baselines.rhr_follicular_baseline),
    pmsDaysBefore: int(baselines.pms_days_before),
    peakEnergyDay: int(baselines.peak_energy_day),
    confirmedOvulationCycles: int(baselines.confirmed_ovulation_cycles),
    cyclesTracked: int(baselines.cycles_tracked),
    modelConfidence: num(baselines.model_confidence),
  }
}

function cycleDayFromTodayDate(today, cycleDayToday, dateStr) {
  if (!cycleDayToday || !dateStr) return null
  const age = diffCalendarDays(today, dateStr + 'T00:00:00')
  if (!Number.isFinite(age)) return null
  return cycleDayToday - age
}

function peakMucusForCycle(mucusLogs = []) {
  const fertile = (mucusLogs || []).filter(m => FERTILE_MUCUS_TYPES.has(m?.discharge_type))
  if (!fertile.length) return null
  const byDateDesc = fertile.slice().sort((a, b) => a.log_date < b.log_date ? 1 : -1)
  return byDateDesc.find(m => m.discharge_type === 'Egg white') || byDateDesc[0]
}

function detectCycleMucusTransition(cycleMucus = [], cycleStart, cycleLength) {
  if (!cycleStart || !cycleLength) return null
  const peak = peakMucusForCycle(cycleMucus)
  if (!peak?.log_date) return null
  const peakDay = diffCalendarDays(peak.log_date + 'T00:00:00', cycleStart + 'T00:00:00') + 1
  if (peakDay < 1 || peakDay > cycleLength) return null
  const dryingAfterPeak = (cycleMucus || [])
    .filter(m => m?.log_date && m.log_date > peak.log_date && DRYING_MUCUS_TYPES.has(m.discharge_type))
    .sort((a, b) => a.log_date > b.log_date ? 1 : -1)[0] || null
  if (!dryingAfterPeak?.log_date) return { peakDay, dryingDay: null, provisionalOvulationDay: null }
  const dryingDay = diffCalendarDays(dryingAfterPeak.log_date + 'T00:00:00', cycleStart + 'T00:00:00') + 1
  if (dryingDay <= peakDay || dryingDay > peakDay + 4) {
    return { peakDay, dryingDay: null, provisionalOvulationDay: null }
  }
  const provisionalOvulationDay = Math.max(peakDay, Math.min(peakDay + 1, dryingDay - 1))
  if (provisionalOvulationDay < 8 || provisionalOvulationDay > cycleLength - 7) {
    return { peakDay, dryingDay, provisionalOvulationDay: null }
  }
  return { peakDay, dryingDay, provisionalOvulationDay }
}

function detectCycleOvulationDay(cycleLogs = [], cycleStart) {
  const temps = (cycleLogs || [])
    .map(log => ({ date: log?.log_date, value: logTempToNum(log) }))
    .filter(sample => sample.date && !isNaN(sample.value))
  const detected = detectOvulationFromTemp(temps)
  if (!detected?.ovulationDate || !cycleStart) return null
  return diffCalendarDays(detected.ovulationDate + 'T00:00:00', cycleStart + 'T00:00:00') + 1
}

export function deriveLearnedBaselines(historyLogs = [], cycleData, historyMucusLogs = []) {
  if (!historyLogs.length || !cycleData) return {}
  const starts = parsePeriodStarts(cycleData)
  if (!starts.length) return {}
  const { periodLengths } = resolvePeriodLengths(cycleData, historyLogs)
  const latestStart = starts[starts.length - 1] || null
  const entries = []
  const confirmedOvulationDays = []
  const confirmedLutealLengths = []
  const mucusInferredOvulationDays = []
  const mucusInferredLutealLengths = []
  const mucusPeakDays = []
  const mucusPeakLeadDays = []

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]
    const nextStart = starts[i + 1] || null
    const cycleLength = nextStart
      ? diffCalendarDays(nextStart + 'T00:00:00', start + 'T00:00:00')
      : (cycleData?.cycle_length || 28)
    const cycleLogs = historyLogs.filter(log => log?.log_date && log.log_date >= start && (!nextStart || log.log_date < nextStart))
    const cycleMucus = (historyMucusLogs || []).filter(log => log?.log_date && log.log_date >= start && (!nextStart || log.log_date < nextStart))
    const ovulationDay = nextStart ? detectCycleOvulationDay(cycleLogs, start) : null
    const mucusTransition = nextStart ? detectCycleMucusTransition(cycleMucus, start, cycleLength) : null
    if (mucusTransition?.peakDay != null) mucusPeakDays.push(mucusTransition.peakDay)
    if (ovulationDay != null && ovulationDay >= 8 && ovulationDay <= cycleLength - 7) {
      confirmedOvulationDays.push(ovulationDay)
      confirmedLutealLengths.push(cycleLength - ovulationDay)
      if (mucusTransition?.peakDay != null) {
        const lead = ovulationDay - mucusTransition.peakDay
        if (lead >= 0 && lead <= 5) mucusPeakLeadDays.push(lead)
      }
    } else if (mucusTransition?.provisionalOvulationDay != null) {
      mucusInferredOvulationDays.push(mucusTransition.provisionalOvulationDay)
      mucusInferredLutealLengths.push(cycleLength - mucusTransition.provisionalOvulationDay)
    }

    const learnedLutealLengthsForCycle = confirmedLutealLengths.length >= 2
      ? confirmedLutealLengths
      : [...confirmedLutealLengths, ...mucusInferredLutealLengths]
    for (const log of historyLogs) {
      if (!log?.log_date || log.log_date < start || (nextStart && log.log_date >= nextStart)) continue
      const cycleDay = diffCalendarDays(log.log_date + 'T00:00:00', start + 'T00:00:00') + 1
      if (cycleDay < 1 || cycleDay > cycleLength + 7) continue
      const learnedLutealLength = medianOf(learnedLutealLengthsForCycle) || POPULATION_LUTEAL_LENGTH
      const phase = getPhase(cycleDay, cycleLength, periodLengthForStart(start, periodLengths, latestStart, cycleData?.period_length || null), learnedLutealLength)
      entries.push({
        cycleDay,
        cycleLength,
        phase,
        energy: log.energy || null,
        mood: log.mood || [],
        symptoms: log.symptoms || [],
        rhr: logRhrToNum(log),
        temp: logTempToNum(log),
        daysBeforeNext: nextStart ? diffCalendarDays(nextStart + 'T00:00:00', log.log_date + 'T00:00:00') : null,
      })
    }
  }

  const follicularRhrs = entries.filter(e => e.phase === 'Follicular' && !isNaN(e.rhr)).map(e => e.rhr)
  const follicularTemps = entries.filter(e => e.phase === 'Follicular' && !isNaN(e.temp)).map(e => e.temp)
  const peakEnergyDays = entries.filter(e => e.energy === 'High').map(e => e.cycleDay)
  const premenstrualOffsets = entries
    .filter(e => e.daysBeforeNext != null && e.daysBeforeNext >= 1 && e.daysBeforeNext <= 10)
    .filter(e =>
      e.energy === 'Very low' ||
      e.mood.some(m => ['Irritable', 'Anxious', 'Sad', 'Low mood', 'Overwhelmed'].includes(m)) ||
      e.symptoms.some(s => ['Cramping', 'Bloating', 'Cravings', 'Mood swings', 'Breast tenderness'].includes(s))
    )
    .map(e => e.daysBeforeNext)

  const ovulationDays = confirmedOvulationDays.length >= 2
    ? confirmedOvulationDays
    : [...confirmedOvulationDays, ...mucusInferredOvulationDays]
  const lutealLengths = confirmedLutealLengths.length >= 2
    ? confirmedLutealLengths
    : [...confirmedLutealLengths, ...mucusInferredLutealLengths]

  return {
    rhrFollicularBaseline: follicularRhrs.length >= 3 ? Math.round(averageOf(follicularRhrs) * 10) / 10 : null,
    tempFollicularBaseline: follicularTemps.length >= 3 ? Math.round(averageOf(follicularTemps) * 100) / 100 : null,
    peakEnergyDay: peakEnergyDays.length >= 2 ? medianRounded(peakEnergyDays) : null,
    pmsDaysBefore: premenstrualOffsets.length >= 3 ? medianRounded(premenstrualOffsets) : null,
    avgLutealLength: lutealLengths.length >= 2 ? Math.round(medianOf(lutealLengths)) : null,
    avgOvulationDay: ovulationDays.length >= 2 ? Math.round(medianOf(ovulationDays)) : null,
    ovulationVariationDays: ovulationDays.length >= 2 ? Math.max(...ovulationDays) - Math.min(...ovulationDays) : null,
    avgPeakMucusDay: mucusPeakDays.length >= 2 ? Math.round(medianOf(mucusPeakDays)) : null,
    mucusPeakLeadDays: mucusPeakLeadDays.length >= 2 ? Math.round(medianOf(mucusPeakLeadDays)) : null,
    confirmedOvulationCycles: confirmedOvulationDays.length,
    mucusInferredOvulationCycles: mucusInferredOvulationDays.length,
  }
}

// When a period is late, look at the user's OWN recent logs and name the likely
// contributors. Pregnancy is the obvious thought, but a late period is far more often
// driven by stress, illness, travel, poor sleep, heavy training / under-fuelling, or simply
// coming off birth control. Everything here is derived from what the user logged and is
// framed as a possible contributor. NEVER a diagnosis, always defer to a doctor if it
// persists. Language rules: no "GnRH" (say "the hormone signal that tells your ovaries to
// release an egg"), never name PCOS/endometriosis.
export function getLatePeriodInsights(recentLogs, profile, cycleInfo) {
  const logs = Array.isArray(recentLogs) ? recentLogs : []
  const out = []
  const disruptors = logs.flatMap(l => Array.isArray(l.disruptors) ? l.disruptors : [])
  const hasDisruptor = d => disruptors.includes(d)

  if (hasDisruptor('High stress') || logs.some(l => l.stress_level >= 4)) {
    out.push('You have logged high stress recently. Stress is one possible contributor to later ovulation and a later period, but the log cannot establish the cause.')
  }
  if (hasDisruptor('Illness')) {
    out.push('You logged being unwell recently. Illness and fever can push ovulation later, which delays your period.')
  }
  if (hasDisruptor('Travel')) {
    out.push('You logged travel recently. A change in time zone or routine can shift your cycle timing by several days.')
  }
  if (hasDisruptor('Very poor sleep') || logs.filter(l => l.sleep_quality === 'Poor').length >= 3) {
    out.push('Your sleep has been poor on several recent days. Consistently disrupted sleep can unsettle the hormonal rhythm that regulates your cycle.')
  }
  const veryLow = logs.filter(l => l.energy === 'Very low').length
  const trained = logs.filter(l => l.workout_feel && !['Rest day', 'Skipped'].includes(l.workout_feel)).length
  if (veryLow >= 3 || (trained >= 4 && veryLow >= 1)) {
    out.push('You have logged very low energy repeatedly. If you are training hard or eating less than your body is using, it can delay a period to conserve energy. Eating enough, especially around training, supports a regular cycle. (IOC RED-S 2023)')
  }
  if (hasDisruptor('Alcohol') && disruptors.filter(d => d === 'Alcohol').length >= 2) {
    out.push('You logged alcohol on multiple recent days. Heavier drinking can temporarily disrupt the hormones that time your cycle.')
  }
  if (profile?.user_path === '2') {
    out.push('You recently came off hormonal birth control. Late, irregular, or skipped cycles are very common for several months while your natural hormone rhythm returns, this usually settles on its own.')
  }
  const gaps = cycleInfo?.gaps || []
  if (gaps.length >= 2 && (Math.max(...gaps) - Math.min(...gaps) >= 7)) {
    out.push('Your own tracked cycles have varied by more than a week in length, so this may be part of your natural variation rather than a truly missed period.')
  }
  return out
}

// Robustly turn a logged resting HR into a number. The log stores either an exact bpm
// or a range label, so map ranges to their midpoint instead of losing the signal.
function rhrToNum(v) {
  if (v == null || v === '' || v === 'No data') return NaN
  const map = { 'Under 55': 52, '55 to 65': 60, '65 to 75': 70, 'Over 75': 78 }
  if (map[v] != null) return map[v]
  const n = parseFloat(v)
  return isNaN(n) ? NaN : n
}

function logRhrToNum(log) {
  return rhrToNum(log?.resting_hr_exact ?? log?.resting_hr)
}

function logTempToNum(log) {
  const n = parseFloat(log?.wrist_temp)
  return isNaN(n) ? NaN : n
}

// Store-facing summary only. A numeric result cannot be safely interpreted without the sample
// type, collection time, assay and laboratory reference interval, so lab values never alter phase,
// confidence, workout load or nutrition here.
export function interpretHormones(log) {
  if (!log) return null
  const prog = parseFloat(log.hormone_progesterone)
  const lh = parseFloat(log.hormone_lh)
  const e2 = parseFloat(log.hormone_estradiol)
  const cortisol = parseFloat(log.hormone_cortisol)
  const notes = []
  if (!isNaN(prog)) notes.push(`Progesterone ${prog} nmol/L recorded.`)
  if (!isNaN(lh)) notes.push(`LH ${lh} IU/L recorded.`)
  if (!isNaN(e2)) notes.push(`Estradiol ${e2} pmol/L recorded.`)
  if (!isNaN(cortisol)) notes.push(`Cortisol ${cortisol} nmol/L recorded.`)
  if (!notes.length) return null
  return {
    ovulationConfirmed: false,
    lhSurge: false,
    progesterone: isNaN(prog) ? null : prog,
    lh: isNaN(lh) ? null : lh,
    estradiol: isNaN(e2) ? null : e2,
    cortisol: isNaN(cortisol) ? null : cortisol,
    notes,
    caveat: 'Use the reference interval printed by the laboratory that performed the test. Sample type, collection time, medicines, assay and cycle timing can all change what a result means. Empower stores these values but does not diagnose or change your plan from them.'
  }
}

// ── Intensity modifiers ─────────────────────────────────────────────────────
// Source: CLAUDE.md canonical intensity values
export function getIntensityModifier(phase, subPhase) {
  void phase
  void subPhase
  // Phase remains useful context, but the population evidence does not support silently scaling
  // every user's load. Readiness and completed performance decide adaptations downstream.
  return 1
}

// Phase-based intensity is a STARTING SUGGESTION, not a rule. Large reviews find cycle-phase
// effects on performance are small and vary a lot between individuals (McNulty et al. 2020;
// Colenso-Semple et al. 2023), so the copy leads with how you feel, not a mandate to push.
function getIntensityLabel(modifier) {
  void modifier
  return 'Start with your planned session. If your warm-up feels good, aim to progress the load; if energy, sleep or recovery are low, hold steady or take the lighter option.'
}

// ── Nutrition targets ────────────────────────────────────────────────────────
// Source: ISSN 2023 position stand
export function getNutritionTargets(phase, bodyWeight, dietPreference) {
  const bw = Number(bodyWeight) > 0 ? Number(bodyWeight) : null
  const targets = {
    Menstrual:    { range: [1.4, 1.8], headline: 'Aim to replace iron lost through bleeding and keep protein around 1.4 to 1.8g per kg. (ISSN 2023)', keyFoods: ['Red meat', 'Spinach', 'Lentils', 'Pumpkin seeds', 'Citrus'], avoid: 'If caffeine worsens your cramps or sleep, consider reducing it.', source: 'ISSN 2023; iron-rich foods are useful during bleeding. Individual needs depend on training and health.' },
    Follicular:   { range: [1.4, 1.8], headline: 'Fuel your rising energy well: aim for 1.4 to 1.8g of protein per kg and quality carbohydrates. (ISSN 2023)', keyFoods: ['Eggs', 'Chicken', 'Oats', 'Whole grains', 'Leafy greens'], avoid: null, source: 'ISSN 2023 female-athlete guidance. Phase effects and individual needs vary.' },
    Ovulatory:    { range: [1.4, 1.8], headline: 'Fuel your peak-energy window: aim for 1.4 to 1.8g of protein per kg and enough carbohydrate for hard sessions. (ISSN 2023)', keyFoods: ['Beef', 'Chickpeas', 'Berries', 'Dark leafy greens', 'Salmon'], avoid: null, source: 'ISSN 2023 female-athlete guidance. Phase alone does not set an exact requirement.' },
    Luteal:       { range: [1.4, 2.0], headline: 'Aim for steady protein around 1.4 to 2.0g per kg, adjusting within the range for your activity, recovery, and appetite. (ISSN 2023)', keyFoods: ['Sweet potato', 'Oats', 'Dark chocolate', 'Salmon', 'Eggs', 'Pumpkin seeds'], avoid: 'If alcohol or highly processed foods worsen your symptoms or sleep, reduce them.', source: 'ISSN 2023 suggests the upper end for active women; individual needs still vary.' },
    observation:  { range: [1.2, 1.6], headline: 'Aim for consistent nutrition and 1.2 to 1.6g of protein per kg while Empower builds your baseline. (ISSN 2023)', keyFoods: ['Protein source each meal', 'Complex carbohydrates', 'Healthy fats', 'Leafy greens'], avoid: null, source: 'General adult range. Training, age, goals and health change individual needs.' },
    'bc-combined': { range: [1.4, 1.8], headline: 'Aim for steady protein around 1.4 to 1.8g per kg to fuel training and recovery. (ISSN 2023)', keyFoods: ['Chicken', 'Eggs', 'Greek yogurt', 'Lentils', 'Oats', 'Leafy greens'], avoid: null, source: 'ISSN 2023 female-athlete guidance; needs depend on activity rather than a presumed natural-cycle phase.' },
    'bc-progestin': { range: [1.4, 1.8], headline: 'Aim for 1.4 to 1.8g of protein per kg plus calcium and vitamin D for bone support. (ISSN 2023)', keyFoods: ['Salmon', 'Eggs', 'Chicken', 'Sardines', 'Almonds', 'Dark leafy greens'], avoid: null, source: 'ISSN 2023 female-athlete guidance. Contraceptive methods and individual responses differ.' },
    Perimenopause: { range: [1.4, 2.0], headline: 'Use a protein range of about 1.4 to 2.0g per kg as a planning guide, adjusting for activity, appetite, health, and goals. (ISSN 2023)', keyFoods: ['Salmon', 'Chicken', 'Eggs', 'Sardines', 'Dark leafy greens', 'Almonds'], avoid: 'Notice whether alcohol worsens hot flashes or sleep, and adjust to your own response.', source: 'ISSN 2023 and resistance-training guidance; individual needs vary with activity and health.' }
  }
  const t = targets[phase] || targets.observation
  let vegan = false
  try { vegan = JSON.parse(dietPreference || '[]').includes('vegan') } catch { /* not vegan */ }
  const low = Math.min(t.range[0] * (vegan ? 1.05 : 1), 2.2)
  const high = Math.min(t.range[1] * (vegan ? 1.05 : 1), 2.2)
  return {
    proteinG: null,
    proteinRangeG: bw ? [Math.round(bw * low), Math.round(bw * high)] : null,
    proteinRangePerKg: [Math.round(low * 10) / 10, Math.round(high * 10) / 10],
    extraCalories: null,
    exactTargetsAvailable: Boolean(bw),
    headline: t.headline,
    keyFoods: t.keyFoods,
    avoid: t.avoid,
    source: t.source
  }
}

function recentMucusLogsWithinDays(mucusLogs = [], today = new Date(), maxAgeDays = 2) {
  const cursor = new Date(today)
  cursor.setHours(0, 0, 0, 0)
  return (mucusLogs || []).filter(m => {
    if (!m?.log_date) return false
    const age = diffCalendarDays(cursor, m.log_date + 'T00:00:00')
    return age >= 0 && age <= maxAgeDays
  })
}

const FERTILE_MUCUS_TYPES = new Set(['Egg white', 'Watery', 'Creamy or lotion-like'])
const DRYING_MUCUS_TYPES = new Set(['Sticky or crumbly', 'None or dry'])

function detectRecentTempShift(recentLogs = [], learnedBaselines = {}) {
  const logs = (recentLogs || []).slice(0, 7)
  const acuteBiometricConfounders = logs.slice(0, 2).some(l =>
    l?.sleep_quality === 'Poor' ||
    Number(l?.stress_level) >= 4 ||
    (l?.disruptors || []).some(d => ['Alcohol', 'Illness', 'Very poor sleep'].includes(d))
  )
  const latestTemps = logs.slice(0, 2).map(logTempToNum).filter(n => !isNaN(n))
  const priorTemps = logs.slice(2).map(logTempToNum).filter(n => !isNaN(n))
  const tempBaseline = priorTemps.length >= 3
    ? priorTemps.reduce((a, b) => a + b, 0) / priorTemps.length
    : learnedBaselines?.tempFollicularBaseline ?? null

  const sustained = !acuteBiometricConfounders && latestTemps.length >= 2 && tempBaseline != null &&
    latestTemps.every(t => t >= tempBaseline + 0.2)

  const firstHighDate = sustained
    ? logs.slice(0, 2).filter(l => !isNaN(logTempToNum(l))).at(-1)?.log_date || null
    : null

  return { sustained, tempBaseline, firstHighDate }
}

function effectiveCycleLengthFromPhase(cycleLen, cycleDay, phase, subPhase, lutealLength = POPULATION_LUTEAL_LENGTH) {
  const base = cycleLen || 28
  if (!cycleDay) return base
  const learned = lutealLength || POPULATION_LUTEAL_LENGTH
  if (phase === 'Ovulatory') return Math.max(base, cycleDay + learned - 1)
  if (phase === 'Follicular' && subPhase === 'Late follicular') return Math.max(base, cycleDay + learned)
  if (phase === 'Luteal' && subPhase === 'Early luteal') return Math.max(base, cycleDay + Math.max(learned - 4, 1))
  return base
}

export function applyBodySignalPhaseCorrection({
  phase,
  subPhase,
  cycleDay,
  cycleLen,
  daysUntilPeriod,
  confidence,
  recentLogs = [],
  mucusLogs = [],
  learnedBaselines = {},
  today = new Date(),
}) {
  const current = {
    phase,
    subPhase,
    cycleLen: cycleLen || 28,
    daysUntilPeriod,
    confidence,
    corrected: false,
    source: null,
    label: null,
  }
  if (!cycleDay) return current

  const learnedLutealLength = learnedBaselines?.avgLutealLength || POPULATION_LUTEAL_LENGTH
  const typicalOvulationDay = learnedBaselines?.avgOvulationDay || getOvulationDay(cycleLen || 28, learnedLutealLength)
  const ovulationVariationDays = Math.max(1, Math.min(5, learnedBaselines?.ovulationVariationDays ?? 2))
  const mucusPeakLeadDays = Math.max(0, Math.min(3, learnedBaselines?.mucusPeakLeadDays ?? 1))
  const recentMucus2 = recentMucusLogsWithinDays(mucusLogs, today, 2)
  const recentMucus4 = recentMucusLogsWithinDays(mucusLogs, today, 4 + ovulationVariationDays)
  const eggWhiteRecent = recentMucus2.filter(m => m.discharge_type === 'Egg white')
  const fertileRecent = recentMucus4.filter(m => FERTILE_MUCUS_TYPES.has(m.discharge_type))
  const mostRecentByDate = logs => logs
    .slice()
    .sort((a, b) => a.log_date < b.log_date ? 1 : -1)[0] || null
  const recentPositiveLh = mostRecentByDate((recentLogs || []).filter(log => {
    if ((log?.lh_result || '').toLowerCase() !== 'positive' || !log?.log_date) return false
    const age = diffCalendarDays(today, log.log_date + 'T00:00:00')
    return age >= 0 && age <= 2
  }))
  const positiveLhCycleDay = recentPositiveLh?.log_date
    ? cycleDayFromTodayDate(today, cycleDay, recentPositiveLh.log_date)
    : null
  const recentPeak = mostRecentByDate(fertileRecent.filter(m => m.discharge_type === 'Egg white')) || mostRecentByDate(fertileRecent)
  const recentPeakCycleDay = recentPeak?.log_date ? cycleDayFromTodayDate(today, cycleDay, recentPeak.log_date) : null
  const recentPeakAge = recentPeak?.log_date ? diffCalendarDays(today, recentPeak.log_date + 'T00:00:00') : null
  const dryingAfterPeak = recentPeak
    ? recentMucus4.some(m => m.log_date > recentPeak.log_date && DRYING_MUCUS_TYPES.has(m.discharge_type))
    : false
  const tempShift = detectRecentTempShift(recentLogs, learnedBaselines)
  const hasPostPeakConfirmation = tempShift.sustained || dryingAfterPeak
  const hasRecentTemperature = (recentLogs || []).slice(0, 4).some(l => !isNaN(logTempToNum(l)))
  const fertileLockWindow = Math.max(2, Math.min(5, mucusPeakLeadDays + ovulationVariationDays))
  const shouldHoldFertileWindow = recentPeakAge != null && recentPeakAge <= fertileLockWindow && !hasPostPeakConfirmation
  const estimatedOvulationDay = positiveLhCycleDay != null
    ? positiveLhCycleDay + 1
    : recentPeakCycleDay != null
    ? Math.max(typicalOvulationDay, recentPeakCycleDay + mucusPeakLeadDays)
    : Math.max(typicalOvulationDay, cycleDay - 1)

  let nextPhase = phase
  let nextSubPhase = subPhase
  let nextConfidence = confidence ?? 0.34
  let source = null
  let label = null

  if (tempShift.sustained && dryingAfterPeak) {
    nextPhase = 'Luteal'
    nextSubPhase = 'Early luteal'
    nextConfidence = Math.max(confidence ?? 0.12, 0.5)
    source = 'post_peak_temp_shift'
    label = 'Adjusted from your recorded period start using a post-peak drying pattern and a sustained temperature rise.'
  } else if (positiveLhCycleDay != null && !hasPostPeakConfirmation) {
    nextPhase = 'Ovulatory'
    nextSubPhase = null
    nextConfidence = Math.min(confidence ?? 0.4, hasRecentTemperature ? 0.46 : 0.40)
    source = 'positive_lh_test'
    label = 'Adjusted from your recorded period start using a recent positive LH test. An LH surge can precede ovulation by 1 to 2 days, but does not confirm it occurred.'
  } else if ((eggWhiteRecent.length || shouldHoldFertileWindow) && !hasPostPeakConfirmation) {
    nextPhase = 'Ovulatory'
    nextSubPhase = null
    nextConfidence = Math.min(confidence ?? 0.4, hasRecentTemperature ? 0.44 : 0.36)
    source = 'cervical_fluid_peak'
    label = shouldHoldFertileWindow
      ? 'Adjusted from your recorded period start by holding the fertile window open until post-ovulation confirmation appears.'
      : 'Adjusted from your recorded period start using recent egg white cervical fluid.'
  } else if (fertileRecent.length && phase === 'Luteal' && !hasPostPeakConfirmation) {
    nextPhase = 'Follicular'
    nextSubPhase = 'Late follicular'
    nextConfidence = Math.min(confidence ?? 0.38, hasRecentTemperature ? 0.40 : 0.33)
    source = 'fertile_cervical_fluid'
    label = 'Adjusted from your recorded period start using recent fertile-type cervical fluid.'
  } else if (!hasPostPeakConfirmation && cycleDay > typicalOvulationDay + ovulationVariationDays) {
    nextConfidence = Math.min(nextConfidence, hasRecentTemperature ? 0.34 : 0.28)
  }

  const timingAdjusted = estimatedOvulationDay !== typicalOvulationDay && (positiveLhCycleDay != null || recentPeakCycleDay != null)
  const corrected = nextPhase !== phase || nextSubPhase !== subPhase || timingAdjusted
  const nextCycleLen = corrected
      ? Math.max(
      effectiveCycleLengthFromPhase(cycleLen, cycleDay, nextPhase, nextSubPhase, learnedLutealLength),
      estimatedOvulationDay + learnedLutealLength
    )
    : (cycleLen || 28)
  const nextDaysUntilPeriod = corrected
    ? Math.max(0, nextCycleLen - cycleDay + 1)
    : daysUntilPeriod

  return {
    phase: nextPhase,
    subPhase: nextSubPhase,
    cycleLen: nextCycleLen,
    daysUntilPeriod: nextDaysUntilPeriod,
    confidence: nextConfidence,
    corrected,
    source,
    label,
    estimatedOvulationDay: corrected ? estimatedOvulationDay : typicalOvulationDay,
    fertileLockWindow,
  }
}

export function detectPhaseTimingConflict({ phase, subPhase, cycleDay, cycleLen, mucusLogs = [], today = new Date(), symptomInference = null }) {
  if (phase !== 'Luteal' || !cycleDay) return null
  const daysPastExpectedOvulation = cycleDay - getOvulationDay(cycleLen || 28)
  const lateEnoughForConflict = ['Mid luteal', 'Late luteal'].includes(subPhase) || daysPastExpectedOvulation >= 5
  if (!lateEnoughForConflict) return null

  const recentEggWhite = recentMucusLogsWithinDays(mucusLogs, today).filter(m => m.discharge_type === 'Egg white')
  if (!recentEggWhite.length) return null

  const label = (subPhase || 'luteal').toLowerCase()
  const lead = recentEggWhite.length >= 2
    ? 'Recent egg white cervical fluid logged on multiple days'
    : 'Recent egg white cervical fluid'
  const ovulatoryLean = symptomInference?.inferredPhase === 'Ovulatory'

  return {
    type: 'phase_timing_conflict',
    severity: 'informational',
    text: ovulatoryLean
      ? `${lead} and your other recent body observations lean more toward an ovulatory window than a ${label} timing label. Empower is still showing your calendar phase because your recorded period start anchors this cycle, but that timing may be off this month.`
      : `${lead} does not line up neatly with a ${label} timing label. Empower is still showing your calendar phase because your recorded period start anchors this cycle, but that timing may be off this month.`,
  }
}

// ── Confidence calculation ───────────────────────────────────────────────────
// totalLogs is meaningful data coverage in the current hormonal context. It contributes
// modestly; repeated cycle starts, variability and contradictory objective observations matter too.
function calcConfidence(phase, subPhase, recentLogs, mucusLogs, meaningfulLogs = 0, cyclesTracked = 0, variabilityDays = null, cycleLen = 28, learnedBaselines = {}, today = new Date()) {
  void subPhase
  // Forecast confidence is intentionally separate from data coverage. Calendar anchoring starts
  // modestly, repeat cycles improve it, and conflicting/stale signals can lower it again.
  let confidence = 0.34 + Math.min(0.24, cyclesTracked * 0.08) + Math.min(0.08, meaningfulLogs * 0.004)
  if (variabilityDays != null) confidence -= Math.min(0.18, variabilityDays * 0.01)

  const latest = recentLogs?.[0]
  const cursor = new Date(today)
  cursor.setHours(0, 0, 0, 0)
  if (latest) {
    const age = latest.log_date ? diffCalendarDays(cursor, latest.log_date + 'T00:00:00') : 99
    if (age > 7) confidence -= 0.08
    if (latest.flow_volume && latest.flow_volume !== 'None') {
      confidence += phase === 'Menstrual' ? 0.18 : -0.18
    }
    if ((latest.lh_result || '').toLowerCase() === 'positive') {
      confidence += phase === 'Ovulatory' ? 0.12 : -0.08
    }
    const activeDisruptors = (latest.disruptors || []).filter(d => d !== 'None of these')
    if (activeDisruptors.length >= 2) confidence -= 0.05
  }

  const recentMucus = recentMucusLogsWithinDays(mucusLogs, cursor)
  if (recentMucus.some(m => m.discharge_type === 'Egg white')) {
    confidence += phase === 'Ovulatory' ? 0.08 : -0.04
  }
  const fertileRecent = recentMucusLogsWithinDays(mucusLogs, cursor, 4).filter(m => FERTILE_MUCUS_TYPES.has(m.discharge_type))
  const hasTempData = (recentLogs || []).slice(0, 4).some(l => !isNaN(logTempToNum(l)))
  const learnedLutealLength = learnedBaselines?.avgLutealLength || POPULATION_LUTEAL_LENGTH
  const learnedOvulationDay = learnedBaselines?.avgOvulationDay || getOvulationDay(cycleLen || 28, learnedLutealLength)
  const variation = Math.max(1, Math.min(5, learnedBaselines?.ovulationVariationDays ?? 2))
  if (fertileRecent.length && phase === 'Luteal') confidence -= 0.08
  if (!hasTempData && recentLogs?.[0]?.log_date) {
    const cycleDayToday = recentLogs[0].cycleDayForConfidence
    if (cycleDayToday != null && cycleDayToday > learnedOvulationDay + variation) confidence -= 0.08
  }

  return Math.min(0.82, Math.max(0.12, confidence))
}

// ── Anomaly detection ────────────────────────────────────────────────────────
// Language rules: start with what the woman is experiencing, never use diagnostic headers,
// always warm and curious, never alarming or clinical. (Per CLAUDE.md tone rules.)
function recurringCycleObservations(historyLogs, periodStarts, profile) {
  const observations = []
  const starts = (periodStarts || []).filter(d => ISO_DATE.test(d)).sort()
  if (starts.length < 3 || !historyLogs?.length) return observations

  const completedCycles = []
  for (let i = 0; i < starts.length - 1; i++) {
    const length = diffCalendarDays(starts[i + 1] + 'T00:00:00', starts[i] + 'T00:00:00')
    if (length < 15 || length > 365) continue
    const logs = historyLogs.filter(log => log.log_date >= starts[i] && log.log_date < starts[i + 1])
      .map(log => ({ ...log, cycleDay: diffCalendarDays(log.log_date + 'T00:00:00', starts[i] + 'T00:00:00') + 1 }))
    completedCycles.push({ start: starts[i], length, logs })
  }
  if (completedCycles.length < 2) return observations

  let consecutiveLong = 0
  let maxConsecutiveLong = 0
  for (const cycle of completedCycles) {
    consecutiveLong = cycle.length > 35 ? consecutiveLong + 1 : 0
    maxConsecutiveLong = Math.max(maxConsecutiveLong, consecutiveLong)
  }
  if (maxConsecutiveLong >= 2) {
    observations.push({ type:'recurring_long_cycles', severity:'informational', text:'Several recorded cycles in a row were longer than 35 days. Long cycles can have many causes and are not a diagnosis. If this is new, persistent, or important for pregnancy planning, consider sharing your dates with a healthcare professional.' })
  }

  const currentYear = new Date().getFullYear()
  const age = Number(profile?.birth_year) ? currentYear - Number(profile.birth_year) : null
  const yearsSinceMenarche = Number(profile?.menarche_year) ? currentYear - Number(profile.menarche_year) : null
  if ((yearsSinceMenarche == null ? age != null && age < 20 : yearsSinceMenarche <= 3) && completedCycles.some(c => c.length >= 90)) {
    observations.push({ type:'adolescent_cycle_gap', severity:'prompt', text:'One recorded gap between periods was about 90 days. Cycles can be irregular in the first years after a first period, but a gap this long is worth discussing with a healthcare professional, especially if it happens again.' })
  }

  const painCycles = completedCycles.filter(c => c.logs.filter(l => l.cycleDay <= 7 && Number(l.pain_rating) >= 4).length >= 2)
  if (painCycles.length >= 2) {
    observations.push({ type:'recurring_period_pain', severity:'informational', text:'Pain affecting daily activities was recorded on multiple period days across more than one cycle. Recurring severe period pain deserves assessment; this record can help you describe the timing and impact. This is a pattern observation, not a diagnosis.' })
  }

  const negative = new Set(['Irritable', 'Anxious', 'Low', 'Overwhelmed', 'Sad'])
  const contrastedCycles = completedCycles.filter(c => {
    const pre = c.logs.filter(l => l.cycleDay > c.length - 7 && l.mood?.length)
    const earlier = c.logs.filter(l => l.cycleDay >= 6 && l.cycleDay <= Math.max(7, c.length - 16) && l.mood?.length)
    if (pre.length < 3 || earlier.length < 3) return false
    const preRate = pre.filter(l => l.mood.some(m => negative.has(m))).length / pre.length
    const earlierRate = earlier.filter(l => l.mood.some(m => negative.has(m))).length / earlier.length
    return preRate >= 0.6 && earlierRate <= 0.25
  })
  if (completedCycles.length >= 3 && contrastedCycles.length >= 2) {
    observations.push({ type:'recurring_premenstrual_mood', severity:'informational', text:'Your logs show a repeated increase in difficult mood symptoms before a period, with fewer of those symptoms earlier in the cycle. That timing is worth sharing with a healthcare professional if it disrupts daily life. Formal assessment usually requires prospective daily ratings; this is not a diagnosis.' })
  }

  return observations
}

function detectAnomalies(recentLogs, phase, cycleLen, flagStats, historyLogs = [], learnedBaselines = {}) {
  void cycleLen
  const anomalies = []
  if (!recentLogs?.length) {
    if (flagStats?.cycleDay >= 90) anomalies.push({ type:'long_current_cycle', severity:'prompt', text:'It has been about 90 days since the recorded period start without another period logged. Missing entries are possible, and long gaps have several causes. If the date is accurate, take a pregnancy test if relevant and arrange a healthcare discussion.' })
    if (flagStats?.userPath !== '4') anomalies.push(...recurringCycleObservations(historyLogs, flagStats?.periodStarts, flagStats?.profile))
    return anomalies
  }

  const latest = recentLogs[0]
  if (!latest) return anomalies

  // Acute safety observations never wait for a week of history.
  if ((latest.pain_rating || 0) >= 4) {
    anomalies.push({ type: 'pain_high', severity: 'prompt', text: 'You logged pain that affects daily activities. You do not need to push through it. Seek urgent care now if the pain is sudden or severe, you feel faint, you may be pregnant, or you are soaking through protection hourly. Otherwise, consider contacting a healthcare professional and keep this record for the conversation.' })
  }
  if (flagStats?.userPath === '6' && latest.flow_volume && latest.flow_volume !== 'None') {
    anomalies.push({ type:'pregnancy_bleeding', severity:'urgent', text:'You logged vaginal bleeding during pregnancy. Stop exercise and contact your pregnancy care provider now for advice; seek urgent care for heavy bleeding, severe or one-sided pain, shoulder pain, fainting or feeling very unwell.' })
  } else if (latest.flow_volume === 'Very heavy') {
    anomalies.push({ type: 'flow_very_heavy', severity: 'prompt', text: 'You logged very heavy bleeding. Seek urgent care if you are soaking through a pad or tampon every hour for more than two hours, feel faint or short of breath, or may be pregnant. Heavy bleeding that recurs is worth discussing with a healthcare professional.' })
  }
  if (flagStats?.cycleDay > 7 && latest.flow_volume && latest.flow_volume !== 'None') {
    anomalies.push({ type:'prolonged_bleeding', severity:'informational', text:'Bleeding is still logged after day 7. If this is accurate, especially if it is heavy, new or recurring, consider discussing it with a healthcare professional. Seek urgent care for hourly soaking, faintness or shortness of breath.' })
  }
  if (flagStats?.cycleDay >= 90 && (!latest.flow_volume || latest.flow_volume === 'None')) {
    anomalies.push({ type:'long_current_cycle', severity:'prompt', text:'It has been about 90 days since the recorded period start without another period logged. Missing entries are possible, and long gaps have several causes. If the date is accurate, take a pregnancy test if relevant and arrange a healthcare discussion.' })
  }

  // Path 4 perimenopause: skip cycle-based anomaly detection entirely, run peri-specific checks
  if (flagStats?.userPath === '4') {
    const lowEnergyDays = recentLogs.filter(l => l.energy === 'Very low' || l.energy === 'Low').length
    if (recentLogs.length >= 5 && lowEnergyDays >= 4) {
      anomalies.push({ type: 'peri_fatigue', text: 'You have logged low energy for most of the past week. Hormonal transition is one possible contributor, but fatigue can have many causes. If this is new or persistent, consider discussing iron, thyroid, sleep and other possible causes with a healthcare professional.' })
    }
    const poorSleepDays = recentLogs.filter(l => l.sleep_quality === 'Poor').length
    if (recentLogs.length >= 5 && poorSleepDays >= 3) {
      anomalies.push({ type: 'peri_sleep', text: 'Sleep quality has been poor over several nights. Night sweats may contribute, but stress, illness, medicines and sleep conditions can also matter. A cooler room and noticing personal triggers may help; persistent sleep disruption is worth discussing with a healthcare professional.' })
    }
    // Hot flash and night sweat burden
    // Source: Harlow et al. Climacteric 2012 STRAW+10; Freeman et al. Archives of General Psychiatry 2004
    const totalHotFlashes = recentLogs.reduce((sum, l) => sum + (l.hot_flash_count || 0), 0)
    if (recentLogs.length >= 3 && totalHotFlashes >= 15) {
      anomalies.push({ type: 'peri_hotflash', text: 'You have been logging frequent hot flashes this week. Evidence-based hormonal and non-hormonal treatments exist, with suitability depending on your health history. If they disrupt sleep or daily life, consider a healthcare discussion.' })
    }
    const severeNightSweats = recentLogs.filter(l => Number(l.night_sweats_severity) >= 2).length
    if (recentLogs.length >= 3 && severeNightSweats >= 2) {
      anomalies.push({ type: 'peri_nightsweats', text: 'Night sweats were logged several times this week. Perimenopause can contribute, while infection, medicines, thyroid conditions and other causes can also matter. A cooler room and noticing personal triggers may help; new, severe or persistent night sweats deserve assessment.' })
    }
    // Joint pain tracking for perimenopause
    const highJointPain = recentLogs.filter(l => (l.joint_pain_rating || 0) >= 3).length
    if (recentLogs.length >= 3 && highJointPain >= 2) {
      anomalies.push({ type: 'peri_joint', text: 'Joint pain was logged over several days. Hormonal transition may contribute for some people, but injury and other health conditions can feel similar. Avoid painful movements and consider professional assessment if it persists or limits activity.' })
    }
    // Brain fog tracking
    const highBrainFog = recentLogs.filter(l => (l.brain_fog_rating || 0) >= 3).length
    if (recentLogs.length >= 3 && highBrainFog >= 2) {
      anomalies.push({ type: 'peri_brainfog', text: 'Brain fog was logged over several days. Hormonal transition is one possible contributor, while sleep, stress, medicines, thyroid health and mood can also affect concentration. If it is persistent or worsening, consider discussing it with a healthcare professional.' })
    }
    return anomalies
  }

  // pattern_observation threshold required for most anomaly observations
  const canObserve = checkFlag('pattern_observation', flagStats)

  if (canObserve && latest.energy === 'Very low' && phase === 'Follicular') {
    anomalies.push({ type: 'energy_mismatch', text: 'Your energy today is lower than expected for this phase. This sometimes happens when recovery is incomplete, when you have been under-fuelling, or when your energy rise is simply starting a little later than usual. Worth keeping an eye on over the next few days.' })
  }
  if (canObserve && latest.energy === 'High' && phase === 'Menstrual') {
    anomalies.push({ type: 'energy_high_menstrual', text: 'Interesting, high energy during your period. Some women notice a brief energy surge on day 1 or 2 before cramps set in, as the drop in hormones briefly lifts mood. Log how your training feels today.' })
  }

  const rhr = logRhrToNum(latest)
  const priorRhr = recentLogs.slice(1).map(logRhrToNum).filter(n => !isNaN(n))
  const rhrBaseline = priorRhr.length >= 3
    ? priorRhr.reduce((a, b) => a + b, 0) / priorRhr.length
    : learnedBaselines?.rhrFollicularBaseline ?? null
  if (canObserve && !isNaN(rhr) && rhrBaseline != null && rhr >= rhrBaseline + 8) {
    anomalies.push({ type: 'rhr_elevated', text: `Your resting heart rate is about ${Math.round(rhr - rhrBaseline)} bpm above your recent baseline. Illness, stress, heat, alcohol and incomplete recovery can all contribute. Consider a lighter option if your warm-up also feels unusually hard.` })
  }

  // Severe period pain, potential flag for investigation
  // Source: Nnoaham et al. Fertility and Sterility 2011 (diagnostic delay)
  // High disruptors in luteal phase amplify stress response
  // Source: Hackney 2006, cortisol competes with progesterone in luteal phase
  const activeDisruptors = (latest.disruptors || []).filter(d => d !== 'None of these')
  if (canObserve && activeDisruptors.length >= 2 && (phase === 'Luteal' || phase === 'Late luteal')) {
    anomalies.push({ type: 'recovery_load', text: 'You logged several stressors today. Illness, poor sleep, alcohol and high stress can raise perceived effort in any phase. Use your warm-up to decide whether to keep the planned session, reduce volume, or recover.' })
  }

  anomalies.push(...recurringCycleObservations(historyLogs, flagStats?.periodStarts, flagStats?.profile))

  return anomalies
}

// ── Immediate feedback from latest log ──────────────────────────────────────
function getImmediateFeedback(latestLog, phase, subPhase) {
  if (!latestLog) return []
  const feedback = []

  if (latestLog.energy) {
    feedback.push({ signal: 'Energy', text: 'Energy signal logged. Helps tailor your phase guidance to how you actually feel.' })
  }
  if (!isNaN(logRhrToNum(latestLog))) {
    feedback.push({ signal: 'Resting HR', text: 'Resting heart rate logged. A personal baseline can help identify unusual recovery, illness or heat responses; this value does not identify a cycle phase by itself.' })
  }
  if (latestLog.sleep_quality) {
    feedback.push({ signal: 'Sleep', text: 'Sleep quality logged. Repeated timing may reveal a personal cycle-related pattern, while stress, illness, environment and many other factors can also affect sleep.' })
  }
  if (latestLog.wrist_temp) {
    feedback.push({ signal: 'Temperature', text: 'Temperature logged. A sustained shift measured consistently can retrospectively support an ovulation estimate, but a single value cannot confirm ovulation and device methods are not interchangeable.' })
  }
  if (latestLog.flow_volume) {
    feedback.push({ signal: 'Flow', text: 'Flow logged. This helps record period timing and changes in your own pattern; flow alone does not identify a hormone level or diagnosis.' })
  }
  const activeDisruptors = (latestLog.disruptors || []).filter(d => d !== 'None of these')
  if (activeDisruptors.length > 0) {
    feedback.push({ signal: 'Disruptors', text: 'Disruptors noted. Alcohol, illness, and poor sleep create noise in the hormonal signal. The algorithm accounts for these when they are logged.' })
  }

  // Mood context feedback, connects logged mood to neurotransmitter explanation
  // Source: Backstrom et al. 2008; Lokuge et al. 2011; algorithm_v3.js
  const moodFeedback = getMoodContextFeedback(latestLog, phase, subPhase)
  if (moodFeedback) feedback.push(moodFeedback)

  return feedback
}

// ── Predictions ──────────────────────────────────────────────────────────────
function getPredictions(phase, cycleDay, cycleLen, learnedLutealLength = POPULATION_LUTEAL_LENGTH) {
  if (!cycleDay || !cycleLen) return []
  const predictions = []
  const ovulation = getOvulationDay(cycleLen, learnedLutealLength)

  if (phase === 'Follicular') {
    const daysToOvulation = ovulation - cycleDay
    if (daysToOvulation >= 0 && daysToOvulation <= 5) {
      predictions.push({ label: 'Estimated ovulation window', text: 'Calendar timing places ovulation roughly ' + daysToOvulation + ' day' + (daysToOvulation !== 1 ? 's' : '') + ' away. This is an estimate, especially if your cycles vary. Cervical fluid, a home LH test and a later sustained temperature shift can add context.' })
    }
  }

  if (phase === 'Luteal') {
    const daysUntilPeriod = Math.max(0, cycleLen - cycleDay + 1)
    if (daysUntilPeriod <= 5) {
      predictions.push({ label: 'Estimated period window approaching', text: 'Your predicted period is about ' + daysUntilPeriod + ' day' + (daysUntilPeriod !== 1 ? 's' : '') + ' away. Some people notice symptom or readiness changes here; keep your planned activity unless your own symptoms or warm-up suggest a different option.' })
    }
  }

  return predictions
}

// ── Symptom inference engine ─────────────────────────────────────────────────
// Estimates only from cycle-specific body observations when no period date is available.
// Mood, stress, energy, sleep and workout quality are deliberately excluded from DIRECT phase
// assignment: they matter for readiness and recurring pattern-learning, but on their own they are
// too non-specific to tell follicular from ovulatory from luteal. More phase-specific signals
// (flow, cervical fluid, LH, temperature shift, a recent RHR rise, and a few timing-linked
// symptoms) can support an estimate when they appear together.
// Source: Janse de Jonge 2003 Sports Medicine, personal tracking improves prediction accuracy.
// Source: Bigelow et al. 2004 Human Reproduction, egg white fluid 80% sensitivity for fertile window.
// Source: De Martin Topranin et al. 2023 IJSPP. RHR 1.7 bpm higher mid-luteal vs early follicular.
export function inferPhaseFromSymptoms(recentLogs, mucusLogs = [], learnedBaselines = {}) {
  if (!recentLogs?.length) {
    return { inferredPhase: null, confidence: 'insufficient', source: 'symptom_inference' }
  }

  const logs = recentLogs.slice(0, 7)
  const latestLog = logs[0] || {}
  const mucus = (mucusLogs || []).slice(0, 7)

  const allFluid = mucus.map(m => m.discharge_type).filter(Boolean)
  const symptomSet = new Set(logs.flatMap(l => l.symptoms || []).filter(Boolean))

  const scores = { Menstrual: 0, Follicular: 0, Ovulatory: 0, Luteal: 0 }
  const signals = []

  // ── MENSTRUAL signals (2 points each) ──────────────────────────────────────
  if (latestLog.flow_volume && latestLog.flow_volume !== 'None') {
    scores.Menstrual += 3; signals.push('menstrual flow logged')
  }
  if (allFluid.some(f => f === 'Spotting')) {
    scores.Menstrual += 1; signals.push('spotting logged')
  }

  // Cervical fluid can identify an estrogen-influenced fertile window, but not an exact phase.
  if (allFluid.some(f => f === 'Creamy or lotion-like' || f === 'Watery')) {
    scores.Follicular += 1; scores.Ovulatory += 1; signals.push('creamy or watery cervical fluid')
  }

  // ── OVULATORY signals (3 points each, stronger specificity) ───────────────
  if (allFluid.some(f => f === 'Egg white')) {
    scores.Ovulatory += 3; signals.push('egg white cervical fluid')
    if (mucus[0]?.discharge_type === 'Egg white') scores.Ovulatory += 1   // recency: today's reading weighs more
  }
  if (logs.some(l => l.lh_result && l.lh_result.toLowerCase() === 'positive')) {
    scores.Ovulatory += 3; signals.push('positive LH test')
  }
  if (symptomSet.has('Ovulation pain')) {
    scores.Ovulatory += 1; signals.push('ovulation pain logged')
  }
  // Dry/sticky fluid can follow the fertile window but is weak evidence by itself.
  if (allFluid.some(f => f === 'Sticky or crumbly' || f === 'None or dry')) {
    scores.Luteal += 1; signals.push('dry or sticky cervical fluid')
  }
  if (symptomSet.has('Breast tenderness')) {
    scores.Luteal += 1; signals.push('breast tenderness logged')
  }
  if (symptomSet.has('Bloating') || symptomSet.has('Cravings') || symptomSet.has('Mood swings')) {
    scores.Luteal += 1; signals.push('late-cycle symptoms logged')
  }

  const acuteBiometricConfounders = logs.slice(0, 2).some(l =>
    l?.sleep_quality === 'Poor' ||
    Number(l?.stress_level) >= 4 ||
    (l?.disruptors || []).some(d => ['Alcohol', 'Illness', 'Very poor sleep'].includes(d))
  )
  const latestTemps = logs.slice(0, 2).map(logTempToNum).filter(n => !isNaN(n))
  const priorTemps = logs.slice(2).map(logTempToNum).filter(n => !isNaN(n))
  const tempBaseline = priorTemps.length >= 3
    ? priorTemps.reduce((a, b) => a + b, 0) / priorTemps.length
    : learnedBaselines?.tempFollicularBaseline ?? null
  if (!acuteBiometricConfounders && latestTemps.length >= 2 && tempBaseline != null &&
      latestTemps.every(t => t >= tempBaseline + 0.2)) {
    scores.Luteal += 3; signals.push('sustained temperature rise')
  }

  const latestRhrs = logs.slice(0, 2).map(logRhrToNum).filter(n => !isNaN(n))
  const priorRhrs = logs.slice(2).map(logRhrToNum).filter(n => !isNaN(n))
  const rhrBaseline = priorRhrs.length >= 3
    ? priorRhrs.reduce((a, b) => a + b, 0) / priorRhrs.length
    : learnedBaselines?.rhrFollicularBaseline ?? null
  if (!acuteBiometricConfounders && latestRhrs.length && rhrBaseline != null &&
      latestRhrs[0] >= rhrBaseline + 3) {
    scores.Luteal += 1; signals.push('resting heart rate above recent baseline')
  }

  const uniqueSignals = [...new Set(signals)]

  if (uniqueSignals.length < 2) {
    return { inferredPhase: null, confidence: 'insufficient', source: 'symptom_inference' }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  if (sorted[0][1] < 4 || sorted[0][1] - sorted[1][1] < 2) {
    return { inferredPhase: null, confidence: 'insufficient', signals: uniqueSignals, source: 'symptom_inference' }
  }
  const inferredPhase = sorted[0][0]

  return {
    inferredPhase,
    confidence: 'low',
    confidencePct: 35,
    signals: uniqueSignals.slice(0, 5),
    source: 'symptom_inference'
  }
}

// ── Path-specific status builders ────────────────────────────────────────────
// Each returns the same shape as getTodayStatus(). Logic is unchanged, these
// are extractions only so getTodayStatus() stays readable as an orchestrator.

// Path 5: currently on hormonal birth control (not copper IUD)
// Hormonal environment depends on method, do not treat all BC the same.
// Combined pill/patch/ring: stable synthetic estrogen, no cycle-based targets.
// Progestin-only (mini pill, implant, Depo, hormonal IUD): lower estrogen influence.
function buildPath5Status(profile, recentLogs, historyLogs = [], historyMucusLogs = []) {
  const bcType = profile?.bc_type
  const isCombined = ['pill', 'patch', 'ring'].includes(bcType)
  const bcPhase = isCombined ? 'bc-combined' : 'bc-progestin'
  const bodyWeight = profile?.body_weight_kg || null
  const intensity = 1
  const intensityLabel = 'Your energy tends to be steadier day to day on contraception, so aim for consistent progressive overload week to week. Use your warm-up and recovery to fine-tune the load.'
  const subPhase = isCombined ? 'Combined pill'
    : bcType === 'minipill' ? 'Mini pill'
    : bcType === 'implant' ? 'Implant'
    : bcType === 'depo' ? 'Depo-Provera'
    : bcType === 'hormonal-iud' ? 'Hormonal IUD'
    : 'Progestin-only'
  const ovulationStatus = isCombined || bcType === 'depo'
    ? 'usually_suppressed'
    : ['hormonal-iud', 'minipill', 'implant'].includes(bcType)
      ? 'may_continue'
      : 'unknown'
  return {
    phase: bcPhase,
    subPhase,
    cycleDay: null,
    cycleLen: null,
    daysUntilPeriod: null,
    confidence: null,
    ...personalisationProgress({ logs: historyLogs, mucusLogs: historyMucusLogs }),
    confidenceLabel: 'Method-aware symptom and training tracking',
    confidencePct: null,
    intensityModifier: intensity,
    intensityLabel,
    nutritionTargets: getNutritionTargets(bcPhase, bodyWeight, profile?.diet_preference),
    immediateFeedback: [],
    anomalies: detectAnomalies(recentLogs, bcPhase, null, { daysLogged:recentLogs.length, confidence:0, cyclesTracked:0, userPath:'5', bcType }),
    predictions: [],
    symptomInference: null,
    ovulationStatus,
    phaseEvidence: { status: 'not_applicable', source: 'contraceptive_method', label: 'Natural cycle phase is not assigned while using this method.' },
    moodInsight: null,
    personalPatterns: { status: 'not_applicable', insights: [], featured: null },
    bodyWeight,
    profile: profile || {},
    recentLogs,
    personalisedFocus: getPersonalisedNutritionFocus(recentLogs),
    workoutReadiness: getPersonalisedWorkoutReadiness(recentLogs),
  }
}

// Path 4: perimenopause/menopause, skip all cycle phase calculations.
// Cycle data may exist from before they chose Path 4 but must not drive phase logic.
function buildPath4Status(profile, recentLogs, historyLogs = [], historyMucusLogs = []) {
  // Setup saves bc_type as the display string the user picked
  // ('Early perimenopause' / 'Late perimenopause' / 'Menopause 12+ months').
  // Map those to the subPhase label. Missing stage remains unknown rather than inventing one.
  const stage = profile?.bc_type || ''
  const subPhase = stage.startsWith('Menopause') ? 'Postmenopause'
    : stage.startsWith('Late') ? 'Late perimenopause'
    : stage.startsWith('Early') ? 'Early perimenopause'
    : 'Stage not set'
  const confidence = null
  const bodyWeight = profile?.body_weight_kg || null
  const anomalies = detectAnomalies(recentLogs, 'Perimenopause', null, {
    daysLogged: recentLogs.length,
    confidence: 0,
    cyclesTracked: 0,
    userPath: '4',
    bcType: profile?.bc_type
  })
  return {
    phase: 'Perimenopause',
    subPhase,
    cycleDay: null,
    cycleLen: null,
    daysUntilPeriod: null,
    confidence,
    ...personalisationProgress({ logs: historyLogs, mucusLogs: historyMucusLogs }),
    confidenceLabel: 'Symptom tracking for your selected life stage',
    confidencePct: null,
    intensityModifier: getIntensityModifier('Perimenopause', null),
    intensityLabel: 'Aim for resistance training 2 to 3 times a week to protect muscle and bone through this transition. Push when you feel well and adjust for symptoms, sleep and pain.',
    nutritionTargets: getNutritionTargets('Perimenopause', bodyWeight, profile?.diet_preference),
    immediateFeedback: getImmediateFeedback(recentLogs[0], 'Perimenopause', subPhase),
    anomalies,
    predictions: [],
    symptomInference: null,
    phaseEvidence: { status: 'not_applicable', source: 'life_stage', label: 'Cycle-phase training is not assigned in this mode.' },
    moodInsight: interpretMoodSignal(recentLogs[0], recentLogs, 'Perimenopause', subPhase).insight,
    personalPatterns: { status: 'not_applicable', insights: [], featured: null },
    bodyWeight,
    profile: profile || {},
    recentLogs,
    personalisedFocus: getPersonalisedNutritionFocus(recentLogs),
    workoutReadiness: getPersonalisedWorkoutReadiness(recentLogs),
  }
}

// ── Pregnancy (path 6) ───────────────────────────────────────────────────────
// Gestational week + trimester from the due date (pregnancy ~40 weeks; week = 40 − weeks-to-due).
export function getPregnancyWeek(dueDate) {
  if (!dueDate) return null
  const daysToDue = diffCalendarDays(dueDate + 'T00:00:00', new Date())
  if (!Number.isFinite(daysToDue) || daysToDue < -14 || daysToDue > 294) return null
  const week = 40 - Math.round(daysToDue / 7)
  return week >= 1 && week <= 42 ? week : null
}
export function getTrimester(week) {
  if (week == null) return null
  if (week <= 13) return 'First trimester'
  if (week <= 27) return 'Second trimester'
  return 'Third trimester'
}

// Pregnancy mode: cycle tracking pauses entirely. Guidance is provider-led, supportive, and
// educational, never prescriptive prenatal exercise/medical advice. Nutrition targets follow
// Health Canada / ACOG (protein ~1.1 g/kg; +0/+340/+450 kcal by trimester). Sources for content:
// SOGC 2019 prenatal activity guideline; ACOG Committee Opinion 804; Health Canada prenatal nutrition.
function buildPregnancyStatus(profile, recentLogs, historyLogs = [], historyMucusLogs = []) {
  const bodyWeight = profile?.body_weight_kg || null
  const week = getPregnancyWeek(profile?.pregnancy_due_date)
  const tri = getTrimester(week) || 'Pregnancy'
  const proteinRange = bodyWeight ? [Math.round(bodyWeight * 1.0), Math.round(bodyWeight * 1.2)] : null
  return {
    phase: 'Pregnancy',
    subPhase: tri,
    pregnancyWeek: week,
    cycleDay: null,
    cycleLen: null,
    daysUntilPeriod: null,
    confidence: null,
    ...personalisationProgress({ logs: historyLogs, mucusLogs: historyMucusLogs }),
    confidenceLabel: 'Pregnancy mode',
    confidencePct: null,
    intensityModifier: 1,
    intensityLabel: 'Follow your pregnancy care plan and use symptoms and your warm-up to guide effort. Stop and seek care for warning symptoms.',
    nutritionTargets: {
      proteinG: null,
      proteinRangeG: proteinRange,
      proteinRangePerKg: [1.0, 1.2],
      extraCalories: null,
      headline: 'Pregnancy nutrition is individual. Focus on regular meals, prenatal nutrients and advice from your care team.',
      keyFoods: ['Prenatal vitamin (folate + iron)', 'Iron-rich foods with vitamin C', 'Calcium sources', 'Low-mercury fish or a DHA source', 'Plenty of water'],
      avoid: 'Alcohol (none), high-mercury fish, unpasteurised dairy or cheese, deli meats unless steaming hot, raw or undercooked meat/eggs/fish, and caffeine over about 200mg a day.',
      source: 'Health Canada Prenatal Nutrition Guidelines; ACOG. Confirm all amounts with your doctor, midwife, or dietitian.'
    },
    immediateFeedback: [],
    anomalies: detectAnomalies(recentLogs, 'Pregnancy', null, { daysLogged:recentLogs.length, confidence:0, cyclesTracked:0, userPath:'6' }),
    predictions: [],
    symptomInference: null,
    phaseEvidence: { status: 'not_applicable', source: 'pregnancy', label: 'Cycle predictions are paused during pregnancy.' },
    moodInsight: null,
    personalPatterns: { status: 'not_applicable', insights: [], featured: null },
    bodyWeight,
    profile: profile || {},
    recentLogs,
    personalisedFocus: null,
    workoutReadiness: null,
  }
}

// All other paths: calculate phase from period date, or infer from symptoms.
// Copper IUD users (path 5, isCopper) also route here, no hormones, natural cycle intact.
function buildCycleStatus(profile, cycleData, recentLogs, mucusLogs, today, totalLogs = 0, historyLogs = [], storedBaselines = {}, historyMucusLogs = []) {
  let phase = 'observation'
  let subPhase = null
  let cycleDay = null
  let cycleLen = 28
  let daysUntilPeriod = null
  let confidence = 0.05
  let symptomInference = null
  let estimated = false   // true when phase is inferred from symptoms, not a logged period
  const { periodLengths, current: currentPeriodLength } = resolvePeriodLengths(cycleData, historyLogs)

  const cycleHistory = computeCycleHistory(cycleData, profile?.cycle_length, historyLogs)
  const { cyclesTracked, avgCycleLength } = cycleHistory
  const learnedBaselines = {
    ...storedBaselines,
    ...deriveLearnedBaselines(historyLogs, cycleData, historyMucusLogs),
    avgCycleLength: avgCycleLength || storedBaselines?.avgCycleLength || null,
  }
  let phaseCorrection = null
  const learnedLutealLength = learnedBaselines?.avgLutealLength || storedBaselines?.avgLutealLength || POPULATION_LUTEAL_LENGTH

  if (cycleData?.last_period_date) {
    const diffDays = diffCalendarDays(today, cycleData.last_period_date + 'T00:00:00')
    cycleDay = diffDays + 1
    // Use the LEARNED average cycle length once we have real history — a user's personal average
    // beats the value they set at onboarding (Bull 2019; Li 2020/2023). avgCycleLength already
    // falls back to their set cycle_length (then 28) when there aren't enough tracked cycles, so
    // this only ever makes the phase, day counter, and prediction more accurate and consistent.
    cycleLen = avgCycleLength || storedBaselines?.avgCycleLength || cycleData.cycle_length || 28
    daysUntilPeriod = Math.max(0, cycleLen - cycleDay + 1)

    if (cycleDay > 0 && cycleDay <= cycleLen + 7) {
      phase = getPhase(cycleDay, cycleLen, currentPeriodLength, learnedLutealLength)
      if (phase === 'Luteal') subPhase = getLutealSubPhase(cycleDay, cycleLen, learnedLutealLength)
      if (phase === 'Follicular') subPhase = getFollicularSubPhase(cycleDay)
      const recentLogsForConfidence = (recentLogs || []).map(log => ({ ...log, cycleDayForConfidence: cycleDayFromTodayDate(today, cycleDay, log.log_date) }))
      confidence = calcConfidence(phase, subPhase, recentLogsForConfidence, mucusLogs, totalLogs, cyclesTracked, cycleHistory.variabilityDays, cycleLen, learnedBaselines, today)
      // Run inference alongside as supporting context even when a calendar phase is available.
      symptomInference = inferPhaseFromSymptoms(recentLogs, mucusLogs, learnedBaselines)
      phaseCorrection = applyBodySignalPhaseCorrection({
        phase,
        subPhase,
        cycleDay,
        cycleLen,
        daysUntilPeriod,
        confidence,
        recentLogs,
        mucusLogs,
        learnedBaselines,
        today,
      })
      if (phaseCorrection.corrected) {
        // A current LH/mucus signal can usefully refine the *current phase*, but it must not
        // turn a well-established personal period pattern into a much longer cycle. Once we
        // have the minimum number of completed cycles needed for a personal estimate, recorded
        // period starts remain the source of truth for the next-period forecast. This prevents a
        // late fertile-fluid observation from, for example, converting a 27-day history into a
        // 42-day predicted cycle.
        const hasPersonalPeriodTiming = cyclesTracked >= MIN_CYCLES_FOR_PERSONAL_ESTIMATE
        const wouldMovePeriodForecast = phaseCorrection.cycleLen !== cycleLen
        if (hasPersonalPeriodTiming && wouldMovePeriodForecast) {
          phase = phaseCorrection.phase
          subPhase = phaseCorrection.subPhase
          confidence = phaseCorrection.confidence
          phaseCorrection = {
            ...phaseCorrection,
            cycleLen,
            daysUntilPeriod,
            timingOverride: false,
            label: `${phaseCorrection.label} Your next-period estimate continues to use your recorded cycle-start history.`,
          }
        } else {
          phase = phaseCorrection.phase
          subPhase = phaseCorrection.subPhase
          cycleLen = phaseCorrection.cycleLen
          daysUntilPeriod = phaseCorrection.daysUntilPeriod
          confidence = phaseCorrection.confidence
        }
      }
    }
  } else {
    // No period date logged. Reading the body's signals when there's no anchor is the
    // core job of the app, so we promote the symptom inference to the working phase, // but flagged as `estimated` and carrying the inference's (lower) confidence, never
    // the certainty of a calculated phase. Every screen reads this same value, so they
    // stay consistent (an earlier version inferred per-screen and they disagreed).
    // When there aren't enough signals (<3) to call it, we stay in honest observation.
    // NOTE: estimated confidence stays below a logged-cycle's, see confidencePct.
    symptomInference = inferPhaseFromSymptoms(recentLogs, mucusLogs, learnedBaselines)
    if (symptomInference?.inferredPhase) {
      phase = symptomInference.inferredPhase
      estimated = true
      confidence = (symptomInference.confidencePct || 30) / 100
    } else {
      // Not enough signal yet, grow confidence slowly so observation does not sit at
      // 5% forever, but keep it modest (capped) since there is no cycle to anchor to.
      confidence = Math.min(0.45, 0.05 + totalLogs * 0.03)
    }
  }

  // Concrete next-period prediction from the user's own logged history (most-likely date + a
  // window that reflects her real cycle variability). Null until a period has been logged.
  const nextPeriodPrediction = cycleData?.last_period_date
    ? predictNextPeriod(cycleData.last_period_date, avgCycleLength || storedBaselines?.avgCycleLength, cyclesTracked, cycleHistory.gaps)
    : null

  // A prediction is a *window*, not a single deadline. Treating the day after its centre point
  // as late hid every future calendar estimate while the user's own forecast still said the
  // period could arrive normally. Once the full window has passed, pause projections rather
  // than fabricating the next cycle; that keeps the late-period guidance and calendar honest.
  const predictionWindowEnd = nextPeriodPrediction?.windowEnd
  const latePeriod = predictionWindowEnd
    ? diffCalendarDays(today, predictionWindowEnd) > 0
    : cycleDay != null && cycleDay > cycleLen + 1
  const daysLate = latePeriod
    ? predictionWindowEnd
      ? diffCalendarDays(today, predictionWindowEnd)
      : cycleDay - cycleLen - 1
    : 0
  const latePeriodInsights = latePeriod ? getLatePeriodInsights(recentLogs, profile, cycleHistory) : []

  const intensityModifier = getIntensityModifier(phase, subPhase)
  const bodyWeight = profile?.body_weight_kg || null
  // Lab values are stored and displayed with context, but never change the phase or plan.
  const hormoneSignals = interpretHormones(recentLogs[0])
  const personalPatterns = analyzePersonalPatterns({ logs: historyLogs, cycleData, phase, subPhase })
  const symptomPatterns = analyzeSymptomPatterns({ logs: historyLogs, cycleData })
  const moodPatterns = analyzeMoodPatterns({ logs: historyLogs, cycleData })
  const guidanceProgress = personalisationProgress({
    logs: historyLogs,
    mucusLogs: historyMucusLogs,
    cyclesTracked,
    hasRepeatedPattern: (personalPatterns?.insights?.length || 0) > 0,
  })
  const timingReliability = cycleTimingReliability(cyclesTracked)
  const phaseConflict = detectPhaseTimingConflict({ phase, subPhase, cycleDay, cycleLen, mucusLogs, today, symptomInference })
  const anomalies = detectAnomalies(recentLogs, phase, cycleLen, {
    daysLogged: recentLogs.length,
    confidence,
    cycleDay,
    cyclesTracked,
    userPath: profile?.user_path,
    bcType: profile?.bc_type,
    periodStarts: cycleHistory.periodStarts,
    profile
  }, historyLogs, learnedBaselines)
  if (phaseConflict) anomalies.unshift(phaseConflict)
  const phaseEvidence = estimated
    ? { status: 'estimated', source: 'body_observations', label: 'Estimated from cycle-specific body observations; no period anchor is available.' }
    : phaseCorrection?.corrected
      ? { status: 'estimated', source: phaseCorrection.source || 'recorded_period_plus_body_signals', label: phaseCorrection.label || 'Adjusted from your recorded period start using recent body signals.' }
    : cycleDay
      ? { status: 'predicted', source: cyclesTracked ? 'recorded_periods_and_cycle_history' : 'recorded_period_and_population_fallback', label: cyclesTracked ? 'Estimated from your recorded period starts.' : 'Estimated from your period start and the cycle length you entered.' }
      : { status: 'insufficient', source: 'insufficient_data', label: 'Not enough cycle-specific information to estimate a phase.' }

  return {
    phase,
    subPhase,
    cycleDay,
    cycleLen,
    periodLength: currentPeriodLength,
    // Per-cycle bleeding lengths keyed by period start. Screens drawing history must use this,
    // not the single periodLength above, or the newest period rewrites every earlier cycle.
    periodLengths,
    cyclesTracked,
    avgCycleLength,
    learnedLutealLength,
    daysUntilPeriod,
    latePeriod,
    daysLate,
    latePeriodInsights,
    nextPeriodPrediction,
    estimated,
    ovulationConfirmed: hormoneSignals?.ovulationConfirmed || false,
    hormoneSignals,
    phaseEvidence,
    confidence,
    ...guidanceProgress,
    cycleTimingReliability: timingReliability,
    confidenceLabel: confidence > 0.70 ? 'Moderate estimate confidence'
      : confidence > 0.45 ? 'Developing estimate confidence'
      : 'Low estimate confidence',
    confidencePct: Math.round(confidence * 100),
    intensityModifier,
    intensityLabel: getIntensityLabel(intensityModifier),
    nutritionTargets: getNutritionTargets(phase, bodyWeight, profile?.diet_preference),
    immediateFeedback: getImmediateFeedback(recentLogs[0], phase, subPhase),
    anomalies,
    predictions: getPredictions(phase, cycleDay, cycleLen, learnedLutealLength),
    phaseCorrection,
    phaseConflict,
    symptomInference,
    moodInsight: interpretMoodSignal(recentLogs[0], recentLogs, phase, subPhase).insight,
    personalPatterns,
    symptomPatterns,
    moodPatterns,
    learnedBaselines,
    bodyWeight,
    profile: profile || {},
    recentLogs,
    personalisedFocus: getPersonalisedNutritionFocus(recentLogs),
    workoutReadiness: getPersonalisedWorkoutReadiness(recentLogs),
  }
}

// ── Main exported function ───────────────────────────────────────────────────
// Fetches all data in parallel, then dispatches to the appropriate builder
// based on user path. Return shape is identical across all paths.
export async function getTodayStatus(supabase, userId) {
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - 6)
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
  const [cycleResult, profileResult, logsResult, mucusResult, historyLogsResult, historyMucusResult, baselinesResult, predictionSnapshotsResult] = await Promise.all([
    supabase.from('cycle_data').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('daily_logs').select('*').eq('user_id', userId).gte('log_date', cutoffStr).order('log_date', { ascending: false }),
    supabase.from('mucus_logs').select('*').eq('user_id', userId).gte('log_date', cutoffStr).order('log_date', { ascending: false }),
    // A bounded history lets us count actual health observations rather than database rows.
    // Auto-imported workout shells therefore do not inflate personalisation.
    supabase.from('daily_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(365),
    supabase.from('mucus_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(365),
    supabase.from('user_baselines').select('*').eq('id', userId).maybeSingle(),
    // This is deliberately non-critical: accounts created before the migration still receive
    // their normal guidance while their first prediction snapshots begin accumulating.
    supabase.from('cycle_prediction_snapshots').select('cycle_start_date,predicted_period_date,window_start,window_end').eq('user_id', userId).order('cycle_start_date', { ascending: false }).limit(12)
  ])

  // NEVER turn a data-loading failure into fabricated advice. Supabase returns { data, error }
  // and does not throw on its own; if a critical read errored (auth expired, network, RLS, outage)
  // the `.data` would be null and we'd otherwise look like a brand-new user and hand back a made-up
  // 65 kg-default plan. Fail loud instead so the UI can show an explicit "couldn't load" state.
  // NOTE: maybeSingle() returns { data:null, error:null } when a row is simply absent, so a genuine
  // new user (no profile/cycle row yet) does NOT trip this — only a real query error does.
  const criticalErr = profileResult.error || cycleResult.error || logsResult.error || historyLogsResult.error
  if (criticalErr) {
    throw new HealthDataError('Could not load your health data.', criticalErr)
  }

  const cycleData = cycleResult.data
  const profile = profileResult.data
  const contextKey = getHormonalContext(profile)
  const recentLogs = (logsResult.data || []).filter(log => belongsToCurrentContext(log, contextKey))
  // Mucus is supplementary (enriches inference); a mucus-only read failure degrades gracefully.
  const mucusLogs = mucusResult.data || []
  const historyLogs = (historyLogsResult.data || recentLogs).filter(log => belongsToCurrentContext(log, contextKey))
  const historyMucusLogs = historyMucusResult.data || mucusLogs
  const storedBaselines = normalizeStoredBaselines(baselinesResult?.data)
  const meaningfulLogs = historyLogs.filter(isMeaningfulHealthLog).length
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // Path 5: on hormonal BC. Combined pills/patch/ring (and Depo/implant/hormonal IUD)
  // suppress ovulation and hold the body's own hormones low and steady, so there are no
  // follicular/ovulatory/luteal phases to track, we never fake a cycle for them, even if
  // a withdrawal-bleed date exists. They get the steady BC baseline instead. Copper IUD is
  // non-hormonal and keeps a natural cycle, so it always uses the normal cycle path.
  if (profile?.user_path === '5' && profile?.bc_type !== 'copper-iud') {
    return { ...buildPath5Status(profile, recentLogs, historyLogs, historyMucusLogs), contextKey }
  }

  // Path 6: pregnancy, cycle tracking pauses; provider-led supportive/educational mode.
  if (profile?.user_path === '6') {
    return { ...buildPregnancyStatus(profile, recentLogs, historyLogs, historyMucusLogs), contextKey }
  }

  // Path 4: perimenopause/menopause, skip all cycle phase calculations
  if (profile?.user_path === '4') {
    return { ...buildPath4Status(profile, recentLogs, historyLogs, historyMucusLogs), contextKey }
  }

  // All other paths (1, 2, 3) + copper IUD users: phase from cycle data or symptom inference
  let status = buildCycleStatus(profile, cycleData, recentLogs, mucusLogs, today, meaningfulLogs, historyLogs, storedBaselines, historyMucusLogs)

  // A connected wearable can provide a retrospective temperature-based ovulation estimate.
  // Use it as a stronger timing anchor than a calendar-only estimate, while keeping it labelled
  // as an estimate rather than clinical confirmation. No-op on web / for non-connected
  // users (no stored signal), and it never touches BC/pregnancy/perimenopause states.
  status = applyWearableOvulationFromStorage(status, cycleData?.last_period_date, userId)
  status.contextKey = contextKey
  const predictionSnapshots = predictionSnapshotsResult?.data || []
  const periodStarts = parsePeriodStarts(cycleData)
  status.cycleTimingReliability = cycleTimingReliability(status.cyclesTracked, predictionSnapshots, periodStarts)

  // Keep the first estimate made for each cycle. We never overwrite it with a later, more informed
  // estimate, otherwise the app would be grading rewritten history instead of its original call.
  if (!predictionSnapshotsResult?.error && status.nextPeriodPrediction && ISO_DATE.test(cycleData?.last_period_date || '')) {
    try {
      await supabase.from('cycle_prediction_snapshots').upsert({
        user_id: userId,
        cycle_start_date: cycleData.last_period_date,
        predicted_period_date: toDateStr(status.nextPeriodPrediction.predictedDate),
        window_start: toDateStr(status.nextPeriodPrediction.windowStart),
        window_end: toDateStr(status.nextPeriodPrediction.windowEnd),
      }, { onConflict: 'user_id,cycle_start_date', ignoreDuplicates: true })
    } catch { /* prediction tracking must never block health guidance */ }
  }

  // Persist the accumulated learning so it survives across sessions and feeds VisitPrep and
  // the personal-baseline card (these tables were previously read but NEVER written, the
  // learning engine simply didn't exist). Best-effort: never let a baseline write break the
  // dashboard, and RLS keeps it scoped to the user's own row.
  try {
    await supabase.from('user_baselines').upsert({
      id: userId,
      cycles_tracked: status.cyclesTracked ?? storedBaselines.cyclesTracked ?? 0,
      avg_cycle_length: status.avgCycleLength ?? status.learnedBaselines?.avgCycleLength ?? storedBaselines.avgCycleLength ?? null,
      avg_luteal_length: status.learnedLutealLength ?? storedBaselines.avgLutealLength ?? null,
      avg_ovulation_day: status.learnedBaselines?.avgOvulationDay ?? storedBaselines.avgOvulationDay ?? null,
      ovulation_variation_days: status.learnedBaselines?.ovulationVariationDays ?? storedBaselines.ovulationVariationDays ?? null,
      avg_peak_mucus_day: status.learnedBaselines?.avgPeakMucusDay ?? storedBaselines.avgPeakMucusDay ?? null,
      mucus_peak_lead_days: status.learnedBaselines?.mucusPeakLeadDays ?? storedBaselines.mucusPeakLeadDays ?? null,
      temp_follicular_baseline: status.learnedBaselines?.tempFollicularBaseline ?? storedBaselines.tempFollicularBaseline ?? null,
      rhr_follicular_baseline: status.learnedBaselines?.rhrFollicularBaseline ?? storedBaselines.rhrFollicularBaseline ?? null,
      pms_days_before: status.learnedBaselines?.pmsDaysBefore ?? storedBaselines.pmsDaysBefore ?? null,
      peak_energy_day: status.learnedBaselines?.peakEnergyDay ?? storedBaselines.peakEnergyDay ?? null,
      confirmed_ovulation_cycles: status.learnedBaselines?.confirmedOvulationCycles ?? storedBaselines.confirmedOvulationCycles ?? null,
      model_confidence: status.confidence != null ? Math.round(status.confidence * 100) / 100 : null,
    }, { onConflict: 'id' })
  } catch { /* non-fatal, confidence is computed live regardless of this write */ }

  return status
}
