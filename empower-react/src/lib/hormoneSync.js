// hormoneSync.js, shared algorithm module
// All phase logic lives here. Import getTodayStatus into every screen.
import { interpretMoodSignal, getMoodContextFeedback, checkFlag, getPersonalisedNutritionFocus, getPersonalisedWorkoutReadiness } from './algorithm_v3.js'
import { applyWearableOvulationFromStorage } from './cycleGuardian.js'
import { diffCalendarDays } from './dateUtils.js'

// Thrown by getTodayStatus when a critical Supabase read fails. Callers should catch this and show
// an explicit "couldn't load your data — try again" state, NEVER fall back to fabricated defaults.
export class HealthDataError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'HealthDataError'
    this.cause = cause
  }
}

// User-facing "how personalised is your guidance" — deliberately DISTINCT from the internal
// `confidence` value that gates pattern observations. It is NOT a statistically-calibrated probability, so it
// must never be shown to the user as "algorithm confidence". This progress number instead starts
// at 0 with no data and grows ONLY from the user's own logged data (breadth) and completed cycles
// (the real personalisation signal). It is presented as progress toward personalisation, never as
// confidence in the prediction being correct.
export function personalisationProgress(meaningfulLogs = 0, cyclesTracked = 0) {
  // This is data coverage, not a probability that a prediction is correct. Subjective or
  // biometric observations and repeated cycles both matter; imported placeholder rows do not.
  const fromLogs = Math.min(0.35, (meaningfulLogs || 0) * 0.012)
  const fromCycles = Math.min(0.50, (cyclesTracked || 0) * 0.10)
  const pct = Math.round(Math.min(0.85, fromLogs + fromCycles) * 100)
  const label = pct >= 70 ? 'Strong personal data coverage'
    : pct >= 45 ? 'Your personal pattern is developing'
    : pct >= 20 ? 'Early personal pattern'
    : pct >= 5 ? 'Starting to learn your baseline'
    : 'Using research-informed general guidance'
  return { personalisationPct: pct, personalisationLabel: label }
}

export function isMeaningfulHealthLog(log) {
  if (!log) return false
  const symptoms = (log.symptoms || []).filter(s => s && s !== 'None')
  const moods = (log.mood || []).filter(Boolean)
  const disruptors = (log.disruptors || []).filter(d => d && d !== 'None of these')
  return Boolean(
    log.energy || log.sleep_quality || log.resting_hr || log.resting_hr_exact ||
    log.wrist_temp || log.flow_volume || log.pain_rating || log.lh_result ||
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
export function getPhase(cycleDay, cycleLen, periodLength) {
  const ovulation = getOvulationDay(cycleLen)
  const menstrualEnd = Math.min(Math.max(periodLength || 5, 1), ovulation - 3)
  if (cycleDay <= menstrualEnd) return 'Menstrual'
  if (cycleDay <= ovulation - 2) return 'Follicular'
  if (cycleDay <= ovulation + 1) return 'Ovulatory'
  return 'Luteal'
}

export function getLutealSubPhase(cycleDay, cycleLen) {
  const ovulation = getOvulationDay(cycleLen)
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

export const predictNextPeriod = (lastPeriodDate, avgCycleLength, cyclesTracked, gaps) => {
  const lastPeriod = new Date(lastPeriodDate + 'T00:00:00')
  const addDays = n => { const d = new Date(lastPeriod); d.setDate(d.getDate() + n); return d }
  // Research-backed prediction (Bull 2019; Li 2020/2023; Munro/FIGO 2018; Symul 2019; Broad 2022):
  //  - Point estimate = the median recorded gap. Atypical long cycles stay visible rather than
  //    being deleted; they also force a low-confidence/irregular label.
  //  - Window scales to the user's OWN dispersion, not a fake ±2 days, and widens when the cycle
  //    is irregular or history is thin — honesty over false precision.
  //  - Gaps under 15 days are likely duplicate/intermenstrual starts. Very long gaps up to a year
  //    remain as health history, though missing intermediate entries are also possible.
  const plausible = (gaps || []).filter(g => g >= 15 && g <= 365)
  const sorted = [...plausible].sort((a, b) => a - b)
  // A single observed cycle is a data point, not a pattern — one atypical cycle would otherwise
  // become the forecast outright. Population/onboarding cycle length carries the estimate until
  // there are at least two completed cycles to compare against each other. The cycle is still
  // used for the window and the irregular flag, so nothing she logged is ignored.
  const middle = plausible.length >= MIN_CYCLES_FOR_PERSONAL_ESTIMATE ? medianOf(sorted) : null
  const point = Math.max(15, Math.round(middle || avgCycleLength) || 28)
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

// Reconstruct how many real cycles the user has tracked, from the recorded period-start
// history (cycle_data.notes + last_period_date). A "cycle" is the gap between two
// consecutive recorded starts. Gaps under 15 days are excluded so duplicate/intermenstrual
// entries do not inflate the number; long gaps remain visible rather than being normalised away.
// confidence score should grow with accumulated cycles, the real measure of how much the app
// has learned about YOU, not just how many days you've logged. Recorded period starts stay
// authoritative here: prediction should not silently decide a logged start "didn't count".
export function computeCycleHistory(cycleData, profileCycleLen) {
  const starts = parsePeriodStarts(cycleData)
  const gaps = []
  for (let i = 1; i < starts.length; i++) {
    const g = diffCalendarDays(starts[i] + 'T00:00:00', starts[i - 1] + 'T00:00:00')
    if (g >= 15 && g <= 365) gaps.push(g)
  }
  const cyclesTracked = gaps.length
  // Keep atypical cycles visible. A median is resistant to a single mistaken start while still
  // preserving clinically meaningful short and long cycles instead of deleting them.
  const sorted = [...gaps].sort((a, b) => a - b)
  // Her own median only once two cycles exist to compare; before that the entered/population
  // length carries it, so a single long or short cycle cannot masquerade as her normal.
  const avgCycleLength = sorted.length >= MIN_CYCLES_FOR_PERSONAL_ESTIMATE
    ? Math.round(medianOf(sorted))
    : (cycleData?.cycle_length || profileCycleLen || 28)
  const variabilityDays = sorted.length >= 2 ? sorted[sorted.length - 1] - sorted[0] : null
  return { cyclesTracked, avgCycleLength, periodStarts: starts, gaps, variabilityDays }
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
    Luteal:       { range: [1.4, 2.0], headline: 'Aim for more protein now, around 1.8 to 2.2g per kg, as your body breaks down protein faster. (ISSN 2023)', keyFoods: ['Sweet potato', 'Oats', 'Dark chocolate', 'Salmon', 'Eggs', 'Pumpkin seeds'], avoid: 'If alcohol or highly processed foods worsen your symptoms or sleep, reduce them.', source: 'ISSN 2023 suggests the upper end for active women in the luteal phase; individual needs still vary.' },
    observation:  { range: [1.2, 1.6], headline: 'Aim for consistent nutrition and 1.2 to 1.6g of protein per kg while Empower builds your baseline. (ISSN 2023)', keyFoods: ['Protein source each meal', 'Complex carbohydrates', 'Healthy fats', 'Leafy greens'], avoid: null, source: 'General adult range. Training, age, goals and health change individual needs.' },
    'bc-combined': { range: [1.4, 1.8], headline: 'Aim for steady protein around 1.4 to 1.8g per kg to fuel training and recovery. (ISSN 2023)', keyFoods: ['Chicken', 'Eggs', 'Greek yogurt', 'Lentils', 'Oats', 'Leafy greens'], avoid: null, source: 'ISSN 2023 female-athlete guidance; needs depend on activity rather than a presumed natural-cycle phase.' },
    'bc-progestin': { range: [1.4, 1.8], headline: 'Aim for 1.4 to 1.8g of protein per kg plus calcium and vitamin D for bone support. (ISSN 2023)', keyFoods: ['Salmon', 'Eggs', 'Chicken', 'Sardines', 'Almonds', 'Dark leafy greens'], avoid: null, source: 'ISSN 2023 female-athlete guidance. Contraceptive methods and individual responses differ.' },
    Perimenopause: { range: [1.4, 2.0], headline: 'Aim higher on protein now, around 1.8 to 2.0g per kg, to protect muscle and bone as anabolic signalling declines. (ISSN 2023)', keyFoods: ['Salmon', 'Chicken', 'Eggs', 'Sardines', 'Dark leafy greens', 'Almonds'], avoid: 'Notice whether alcohol worsens hot flashes or sleep, and adjust to your own response.', source: 'ISSN 2023 and resistance-training guidance; individual needs vary with activity and health.' }
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

// ── Confidence calculation ───────────────────────────────────────────────────
// totalLogs is meaningful data coverage in the current hormonal context. It contributes
// modestly; repeated cycle starts, variability and contradictory objective observations matter too.
function calcConfidence(phase, subPhase, recentLogs, mucusLogs, meaningfulLogs = 0, cyclesTracked = 0, variabilityDays = null) {
  void subPhase
  // Forecast confidence is intentionally separate from data coverage. Calendar anchoring starts
  // modestly, repeat cycles improve it, and conflicting/stale signals can lower it again.
  let confidence = 0.34 + Math.min(0.24, cyclesTracked * 0.08) + Math.min(0.08, meaningfulLogs * 0.004)
  if (variabilityDays != null) confidence -= Math.min(0.18, variabilityDays * 0.01)

  const latest = recentLogs?.[0]
  if (latest) {
    const age = latest.log_date ? diffCalendarDays(new Date(), latest.log_date + 'T00:00:00') : 99
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

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const recentMucus = (mucusLogs || []).filter(m => {
    const age = diffCalendarDays(today, m.log_date + 'T00:00:00')
    return age >= 0 && age <= 2
  })
  if (recentMucus.some(m => m.discharge_type === 'Egg white')) {
    confidence += phase === 'Ovulatory' ? 0.08 : -0.04
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

function detectAnomalies(recentLogs, phase, cycleLen, flagStats, historyLogs = []) {
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
  const rhrBaseline = priorRhr.length >= 3 ? priorRhr.reduce((a, b) => a + b, 0) / priorRhr.length : null
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
function getPredictions(phase, cycleDay, cycleLen) {
  if (!cycleDay || !cycleLen) return []
  const predictions = []
  const ovulation = getOvulationDay(cycleLen)

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
export function inferPhaseFromSymptoms(recentLogs, mucusLogs = []) {
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
  const tempBaseline = priorTemps.length >= 3 ? priorTemps.reduce((a, b) => a + b, 0) / priorTemps.length : null
  if (!acuteBiometricConfounders && latestTemps.length >= 2 && tempBaseline != null &&
      latestTemps.every(t => t >= tempBaseline + 0.2)) {
    scores.Luteal += 3; signals.push('sustained temperature rise')
  }

  const latestRhrs = logs.slice(0, 2).map(logRhrToNum).filter(n => !isNaN(n))
  const priorRhrs = logs.slice(2).map(logRhrToNum).filter(n => !isNaN(n))
  const rhrBaseline = priorRhrs.length >= 3 ? priorRhrs.reduce((a, b) => a + b, 0) / priorRhrs.length : null
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
function buildPath5Status(profile, recentLogs, totalLogs = 0) {
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
    ...personalisationProgress(totalLogs, 0),
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
    bodyWeight,
    profile: profile || {},
    recentLogs,
    personalisedFocus: getPersonalisedNutritionFocus(recentLogs),
    workoutReadiness: getPersonalisedWorkoutReadiness(recentLogs),
  }
}

// Path 4: perimenopause/menopause, skip all cycle phase calculations.
// Cycle data may exist from before they chose Path 4 but must not drive phase logic.
function buildPath4Status(profile, recentLogs, totalLogs = 0) {
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
    ...personalisationProgress(totalLogs, 0),
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
function buildPregnancyStatus(profile, recentLogs, totalLogs = 0) {
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
    ...personalisationProgress(totalLogs, 0),
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
      avoid: 'Alcohol (none), high-mercury fish, unpasteurised dairy and soft cheeses, deli meats unless steaming hot, raw or undercooked meat/eggs/fish, and caffeine over about 200mg a day.',
      source: 'Health Canada Prenatal Nutrition Guidelines; ACOG. Confirm all amounts with your doctor, midwife, or dietitian.'
    },
    immediateFeedback: [],
    anomalies: detectAnomalies(recentLogs, 'Pregnancy', null, { daysLogged:recentLogs.length, confidence:0, cyclesTracked:0, userPath:'6' }),
    predictions: [],
    symptomInference: null,
    phaseEvidence: { status: 'not_applicable', source: 'pregnancy', label: 'Cycle predictions are paused during pregnancy.' },
    moodInsight: null,
    bodyWeight,
    profile: profile || {},
    recentLogs,
    personalisedFocus: null,
    workoutReadiness: null,
  }
}

// All other paths: calculate phase from period date, or infer from symptoms.
// Copper IUD users (path 5, isCopper) also route here, no hormones, natural cycle intact.
function buildCycleStatus(profile, cycleData, recentLogs, mucusLogs, today, totalLogs = 0, historyLogs = []) {
  let phase = 'observation'
  let subPhase = null
  let cycleDay = null
  let cycleLen = 28
  let daysUntilPeriod = null
  let confidence = 0.05
  let symptomInference = null
  let estimated = false   // true when phase is inferred from symptoms, not a logged period

  const cycleHistory = computeCycleHistory(cycleData, profile?.cycle_length)
  const { cyclesTracked, avgCycleLength } = cycleHistory

  if (cycleData?.last_period_date) {
    const diffDays = diffCalendarDays(today, cycleData.last_period_date + 'T00:00:00')
    cycleDay = diffDays + 1
    // Use the LEARNED average cycle length once we have real history — a user's personal average
    // beats the value they set at onboarding (Bull 2019; Li 2020/2023). avgCycleLength already
    // falls back to their set cycle_length (then 28) when there aren't enough tracked cycles, so
    // this only ever makes the phase, day counter, and prediction more accurate and consistent.
    cycleLen = avgCycleLength || cycleData.cycle_length || 28
    daysUntilPeriod = Math.max(0, cycleLen - cycleDay + 1)

    if (cycleDay > 0 && cycleDay <= cycleLen + 7) {
      phase = getPhase(cycleDay, cycleLen, cycleData.period_length)
      if (phase === 'Luteal') subPhase = getLutealSubPhase(cycleDay, cycleLen)
      if (phase === 'Follicular') subPhase = getFollicularSubPhase(cycleDay)
      confidence = calcConfidence(phase, subPhase, recentLogs, mucusLogs, totalLogs, cyclesTracked, cycleHistory.variabilityDays)
      // Run inference alongside as supporting context even when a calendar phase is available.
      symptomInference = inferPhaseFromSymptoms(recentLogs, mucusLogs)
    }
  } else {
    // No period date logged. Reading the body's signals when there's no anchor is the
    // core job of the app, so we promote the symptom inference to the working phase, // but flagged as `estimated` and carrying the inference's (lower) confidence, never
    // the certainty of a calculated phase. Every screen reads this same value, so they
    // stay consistent (an earlier version inferred per-screen and they disagreed).
    // When there aren't enough signals (<3) to call it, we stay in honest observation.
    // NOTE: estimated confidence stays below a logged-cycle's, see confidencePct.
    symptomInference = inferPhaseFromSymptoms(recentLogs, mucusLogs)
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

  // Late / missed period: past the expected start (day cycleLen+1) the app must not keep
  // showing "PMS, period in 0 days", it should acknowledge the period is late and, because
  // this is a fertility-aware app, prompt a pregnancy test if relevant. Surfaced on the dashboard.
  const latePeriod = cycleDay != null && cycleDay > cycleLen + 1
  const daysLate = latePeriod ? cycleDay - cycleLen - 1 : 0
  const latePeriodInsights = latePeriod ? getLatePeriodInsights(recentLogs, profile, cycleHistory) : []

  // Concrete next-period prediction from the user's own logged history (most-likely date + a
  // window that reflects her real cycle variability). Null until a period has been logged.
  const nextPeriodPrediction = cycleData?.last_period_date
    ? predictNextPeriod(cycleData.last_period_date, avgCycleLength, cyclesTracked, cycleHistory.gaps)
    : null

  const intensityModifier = getIntensityModifier(phase, subPhase)
  const bodyWeight = profile?.body_weight_kg || null
  // Lab values are stored and displayed with context, but never change the phase or plan.
  const hormoneSignals = interpretHormones(recentLogs[0])
  const phaseEvidence = estimated
    ? { status: 'estimated', source: 'body_observations', label: 'Estimated from cycle-specific body observations; no period anchor is available.' }
    : cycleDay
      ? { status: 'predicted', source: cyclesTracked ? 'recorded_periods_and_cycle_history' : 'recorded_period_and_population_fallback', label: cyclesTracked ? 'Estimated from your recorded period starts.' : 'Estimated from your period start and the cycle length you entered.' }
      : { status: 'insufficient', source: 'insufficient_data', label: 'Not enough cycle-specific information to estimate a phase.' }

  return {
    phase,
    subPhase,
    cycleDay,
    cycleLen,
    periodLength: cycleData?.period_length || null,
    // Per-cycle bleeding lengths keyed by period start. Screens drawing history must use this,
    // not the single periodLength above, or the newest period rewrites every earlier cycle.
    periodLengths: parsePeriodLengths(cycleData),
    cyclesTracked,
    avgCycleLength,
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
    ...personalisationProgress(totalLogs, cyclesTracked),
    confidenceLabel: confidence > 0.70 ? 'Moderate estimate confidence'
      : confidence > 0.45 ? 'Developing estimate confidence'
      : 'Low estimate confidence',
    confidencePct: Math.round(confidence * 100),
    intensityModifier,
    intensityLabel: getIntensityLabel(intensityModifier),
    nutritionTargets: getNutritionTargets(phase, bodyWeight, profile?.diet_preference),
    immediateFeedback: getImmediateFeedback(recentLogs[0], phase, subPhase),
    anomalies: detectAnomalies(recentLogs, phase, cycleLen, {
      daysLogged: recentLogs.length,
      confidence,
      cycleDay,
      cyclesTracked,
      userPath: profile?.user_path,
      bcType: profile?.bc_type,
      periodStarts: cycleHistory.periodStarts,
      profile
    }, historyLogs),
    predictions: getPredictions(phase, cycleDay, cycleLen),
    symptomInference,
    moodInsight: interpretMoodSignal(recentLogs[0], recentLogs, phase, subPhase).insight,
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
  const [cycleResult, profileResult, logsResult, mucusResult, historyLogsResult] = await Promise.all([
    supabase.from('cycle_data').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('daily_logs').select('*').eq('user_id', userId).gte('log_date', cutoffStr).order('log_date', { ascending: false }),
    supabase.from('mucus_logs').select('*').eq('user_id', userId).gte('log_date', cutoffStr).order('log_date', { ascending: false }),
    // A bounded history lets us count actual health observations rather than database rows.
    // Auto-imported workout shells therefore do not inflate personalisation.
    supabase.from('daily_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(365)
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
  const meaningfulLogs = historyLogs.filter(isMeaningfulHealthLog).length
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // Path 5: on hormonal BC. Combined pills/patch/ring (and Depo/implant/hormonal IUD)
  // suppress ovulation and hold the body's own hormones low and steady, so there are no
  // follicular/ovulatory/luteal phases to track, we never fake a cycle for them, even if
  // a withdrawal-bleed date exists. They get the steady BC baseline instead. Copper IUD is
  // non-hormonal and keeps a natural cycle, so it always uses the normal cycle path.
  if (profile?.user_path === '5' && profile?.bc_type !== 'copper-iud') {
    return { ...buildPath5Status(profile, recentLogs, meaningfulLogs), contextKey }
  }

  // Path 6: pregnancy, cycle tracking pauses; provider-led supportive/educational mode.
  if (profile?.user_path === '6') {
    return { ...buildPregnancyStatus(profile, recentLogs, meaningfulLogs), contextKey }
  }

  // Path 4: perimenopause/menopause, skip all cycle phase calculations
  if (profile?.user_path === '4') {
    return { ...buildPath4Status(profile, recentLogs, meaningfulLogs), contextKey }
  }

  // All other paths (1, 2, 3) + copper IUD users: phase from cycle data or symptom inference
  let status = buildCycleStatus(profile, cycleData, recentLogs, mucusLogs, today, meaningfulLogs, historyLogs)

  // A connected wearable can provide a retrospective temperature-based ovulation estimate.
  // Use it as a stronger timing anchor than a calendar-only estimate, while keeping it labelled
  // as an estimate rather than clinical confirmation. No-op on web / for non-connected
  // users (no stored signal), and it never touches BC/pregnancy/perimenopause states.
  status = applyWearableOvulationFromStorage(status, cycleData?.last_period_date, userId)
  status.contextKey = contextKey

  // Persist the accumulated learning so it survives across sessions and feeds VisitPrep and
  // the personal-baseline card (these tables were previously read but NEVER written, the
  // learning engine simply didn't exist). Best-effort: never let a baseline write break the
  // dashboard, and RLS keeps it scoped to the user's own row.
  try {
    await supabase.from('user_baselines').upsert({
      id: userId,
      cycles_tracked: status.cyclesTracked || 0,
      avg_cycle_length: status.avgCycleLength || null,
      avg_luteal_length: status.learnedLutealLength || null,
      model_confidence: status.confidence != null ? Math.round(status.confidence * 100) / 100 : null,
    }, { onConflict: 'id' })
  } catch { /* non-fatal, confidence is computed live regardless of this write */ }

  return status
}
