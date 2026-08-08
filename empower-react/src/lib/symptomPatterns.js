// symptomPatterns.js, the "Symptom Coach". Looks at a user's OWN logged symptoms and works
// out whether each one clusters in a consistent part of her cycle, e.g. "your headaches have
// tended to show up around ovulation", or, just as importantly, "this doesn't line up with
// your cycle, worth mentioning to your provider."
//
// PERMANENT HONESTY RULES (never loosen, this makes a claim about her body):
//  1. Never claim a pattern until there is enough of it: a symptom must be logged on
//     >= MIN_OCCURRENCES days across >= MIN_CYCLES cycles.
//  2. Require real clustering: >= DOMINANT_FRACTION of those occurrences must fall in one
//     phase window before we call it cyclical.
//  3. Always hedged ("has tended to", "often"), NEVER causal ("causes").
//  4. Never name a condition. Always add "a pattern in your own data, not a diagnosis."
//  5. The null result IS a feature: if it doesn't cluster, say so and suggest raising it with
//     a provider if it persists.
//  6. If there isn't enough data yet, say "keep logging", do not guess.
// Pure computation only (no supabase) so it is unit-tested.
//
// Caveat baked into the wording: cycle day for each past log is projected forward from the
// last period date at the average cycle length, so it is approximate for irregular cycles, // which is exactly why the language stays hedged and requires strong clustering.

import { diffCalendarDays } from './dateUtils.js'
import { parsePeriodStarts } from './hormoneSync.js'
import { cycleInfoForDate } from './cycleHistory.js'

const MIN_OCCURRENCES = 4     // times a symptom must be logged before we look for a pattern
const MIN_CYCLES = 2          // and it must span at least this many cycles
const MIN_PLACED_LOGS = 14    // overall logging needed before we say anything at all
const MIN_SPAN_CYCLES = 2     // data must cover at least this many cycles of calendar time
const DOMINANT_FRACTION = 0.6 // share of occurrences in one phase to call it a pattern

// Old label -> current label, so historical logs (e.g. "Cramps") aren't counted separately
// from the current option ("Cramping") and split a real pattern in two.
const SYMPTOM_ALIASES = { Cramps: 'Cramping', 'Sore breasts': 'Breast tenderness' }

function ovulationDay(cl) { return Math.max(8, Math.round((cl || 28) - 14)) }

// Coarse phase window for a cycle day → human-readable phrase.
function phaseWindowKey(cd, cl) {
  const ov = ovulationDay(cl)
  if (cd <= 5) return 'menstrual'
  if (cd <= ov - 2) return 'follicular'
  if (cd <= ov + 1) return 'ovulatory'
  if (cd >= (cl || 28) - 2) return 'late_luteal'
  return 'luteal'
}
const WINDOW_PHRASE = {
  menstrual: 'during your period',
  follicular: 'in the first half of your cycle, after your period',
  ovulatory: 'around ovulation',
  luteal: 'in the second half of your cycle',
  late_luteal: 'in the few days before your period',
}

// analyzeSymptomPatterns, returns { status, patterns[], summary[] }.
//   status: 'no_cycle' (no period anchor) | 'insufficient' (not enough logging yet)
//         | 'no_pattern' (enough data, nothing clusters) | 'ok' (has findings)
export function analyzeSymptomPatterns({ logs = [], cycleData = null } = {}) {
  const lp = cycleData?.last_period_date
  const cl = cycleData?.cycle_length || 28
  if (!lp) return { status: 'no_cycle', patterns: [], summary: [] }

  const periodStarts = parsePeriodStarts(cycleData)
  const occ = {}          // symptom -> [{ cd, cycleNum }]
  const placedTimes = []  // timestamps of every placed log, to measure calendar span
  for (const l of logs) {
    if (!l.log_date) continue
    const ld = new Date(l.log_date + 'T00:00:00')
    const cycleInfo = cycleInfoForDate(l.log_date, periodStarts, cl)
    if (!cycleInfo) continue
    placedTimes.push(ld.getTime())
    const syms = Array.isArray(l.symptoms) ? l.symptoms.filter(s => s && s !== 'None') : []
    for (const raw of syms) { const s = SYMPTOM_ALIASES[raw] || raw; (occ[s] = occ[s] || []).push({ cd: cycleInfo.cycleDay, cycleLen: cycleInfo.cycleLength, cycleNum: cycleInfo.anchor }) }
  }

  const spanDays = placedTimes.length ? diffCalendarDays(new Date(Math.max(...placedTimes)), new Date(Math.min(...placedTimes))) : 0
  if (placedTimes.length < MIN_PLACED_LOGS || spanDays < MIN_SPAN_CYCLES * cl) {
    return {
      status: 'insufficient', patterns: [],
      summary: ['Keep logging for a few more weeks. Symptom-timing patterns need at least a couple of full cycles of data before they can be shown reliably.'],
    }
  }

  const patterns = []
  for (const [symptom, list] of Object.entries(occ)) {
    if (list.length < MIN_OCCURRENCES) continue
    const cyclesSpanned = new Set(list.map(o => o.cycleNum)).size
    if (cyclesSpanned < MIN_CYCLES) continue

    const buckets = {}
    for (const o of list) { const k = phaseWindowKey(o.cd, o.cycleLen); buckets[k] = (buckets[k] || 0) + 1 }
    const [topKey, topCount] = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]
    const frac = topCount / list.length

    if (frac >= DOMINANT_FRACTION) {
      patterns.push({ symptom, kind: 'cyclical', windowKey: topKey, windowPhrase: WINDOW_PHRASE[topKey], occurrences: list.length, cyclesSpanned, dominantPct: Math.round(frac * 100) })
    } else {
      patterns.push({ symptom, kind: 'unrelated', occurrences: list.length, cyclesSpanned })
    }
  }

  const summary = patterns.map(p => p.kind === 'cyclical'
    ? `Your ${p.symptom.toLowerCase()} has tended to show up ${p.windowPhrase}, about ${p.dominantPct}% of the ${p.occurrences} times you logged it, across ${p.cyclesSpanned} cycles. This is a pattern in your own data, not a diagnosis.`
    : `Your ${p.symptom.toLowerCase()} did not line up with any one part of your cycle across ${p.cyclesSpanned} cycles. If it keeps happening, it is worth mentioning to your provider.`)

  return { status: patterns.length ? 'ok' : 'no_pattern', patterns, summary }
}
