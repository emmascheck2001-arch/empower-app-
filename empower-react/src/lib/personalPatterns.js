// personalPatterns.js, a second-layer learner for repeated PERSONAL patterns that sit
// alongside the core cycle engine. It does NOT infer ovulation or override phase timing.
// Instead it looks for repeated cycle-relative patterns in libido, mood, and sleep/recovery,
// then surfaces them as user-specific guidance.
//
// Permanent honesty rules:
//  1. Never learn from a single cycle. Require repeated observations across >= 2 cycles.
//  2. Never let subjective signals assign a phase or confirm ovulation.
//  3. Always hedge the wording and explicitly frame results as patterns in the user's own data.
//  4. If the data is thin or inconsistent, return nothing instead of stretching.

import { cycleInfoForDate } from './cycleHistory.js'

const NEGATIVE_MOODS = new Set(['Irritable', 'Anxious', 'Low', 'Low mood', 'Overwhelmed', 'Sad'])
const LOW_SLEEP = new Set(['Poor', 'Fair'])
const LOW_ENERGY = new Set(['Very low', 'Low'])

const MIN_PLACED_LOGS = 12
const MIN_CYCLES = 2
const MIN_OCCURRENCES = 4
const MIN_COMPARE_DAYS = 4
const MIN_DOMINANT_FRACTION = 0.6
const MIN_RATE_GAP = 0.25

const WINDOW_PHRASE = {
  menstrual: 'during your period',
  follicular: 'in the first half of your cycle',
  ovulatory: 'around ovulation',
  luteal: 'in the second half of your cycle',
  late_luteal: 'in the few days before your period',
}

function parsePeriodStartsLocal(cycleData) {
  if (!cycleData) return []
  const set = new Set()
  if (cycleData.notes) {
    try {
      const parsed = JSON.parse(cycleData.notes)
      if (parsed && Array.isArray(parsed.periodStarts)) {
        for (const d of parsed.periodStarts) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set.add(d)
        }
      }
    } catch { /* ignore malformed legacy notes */ }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(cycleData.last_period_date || '')) set.add(cycleData.last_period_date)
  return [...set].sort()
}

function ovulationDay(cl) {
  return Math.max(8, Math.round((cl || 28) - 14))
}

function phaseWindowKey(cycleDay, cycleLen) {
  const ov = ovulationDay(cycleLen)
  if (cycleDay <= 5) return 'menstrual'
  if (cycleDay <= ov - 2) return 'follicular'
  if (cycleDay <= ov + 1) return 'ovulatory'
  if (cycleDay >= cycleLen - 4) return 'late_luteal'
  return 'luteal'
}

function currentWindowKey(phase, subPhase) {
  const eff = subPhase || phase
  switch (eff) {
    case 'Menstrual': return 'menstrual'
    case 'Early follicular': return 'follicular'
    case 'Follicular': return 'follicular'
    case 'Late follicular': return 'ovulatory'
    case 'Ovulatory': return 'ovulatory'
    case 'Early luteal': return 'luteal'
    case 'Mid luteal': return 'luteal'
    case 'Luteal': return 'luteal'
    case 'Late luteal': return 'late_luteal'
    default: return null
  }
}

function pct(num, den) {
  return den ? Math.round((num / den) * 100) : 0
}

function detectLibidoPattern(entries, currentWindow) {
  const candidates = ['High', 'Low'].map(level => {
    const list = entries.filter(e => e.libido === level)
    if (list.length < MIN_OCCURRENCES) return null
    const cyclesSpanned = new Set(list.map(e => e.anchor)).size
    if (cyclesSpanned < MIN_CYCLES) return null
    const buckets = {}
    for (const item of list) buckets[item.windowKey] = (buckets[item.windowKey] || 0) + 1
    const top = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]
    if (!top) return null
    const [topKey, topCount] = top
    const dominantFraction = topCount / list.length
    if (dominantFraction < MIN_DOMINANT_FRACTION) return null
    const higher = level === 'High'
    return {
      id: 'libido_pattern',
      domain: 'libido',
      score: Math.round(dominantFraction * 100) + list.length + cyclesSpanned * 4,
      appliesNow: currentWindow != null && currentWindow === topKey,
      headline: higher
        ? `Your sex drive has tended to run higher ${WINDOW_PHRASE[topKey]}`
        : `Your sex drive has tended to run lower ${WINDOW_PHRASE[topKey]}`,
      body: `Across ${cyclesSpanned} cycles, ${topCount} of your ${list.length} "${level.toLowerCase()}" libido logs fell ${WINDOW_PHRASE[topKey]}. This is a repeated pattern in your own data, not a fertility confirmation on its own.`,
      short: `Your past logs suggest libido often runs ${higher ? 'higher' : 'lower'} ${WINDOW_PHRASE[topKey]}.`,
    }
  }).filter(Boolean)

  return candidates.sort((a, b) => b.score - a.score)[0] || null
}

function detectLateLutealMoodPattern(entries, currentWindow) {
  const late = entries.filter(e => e.windowKey === 'late_luteal' && e.hasMood)
  const earlier = entries.filter(e => (e.windowKey === 'follicular' || e.windowKey === 'ovulatory') && e.hasMood)
  if (late.length < MIN_COMPARE_DAYS || earlier.length < MIN_COMPARE_DAYS) return null
  const lateCycles = new Set(late.map(e => e.anchor)).size
  if (lateCycles < MIN_CYCLES) return null

  const lateNeg = late.filter(e => e.negativeMood).length
  const earlyNeg = earlier.filter(e => e.negativeMood).length
  const lateRate = lateNeg / late.length
  const earlyRate = earlyNeg / earlier.length
  if (lateRate < 0.55 || (lateRate - earlyRate) < MIN_RATE_GAP) return null

  return {
    id: 'late_luteal_mood_pattern',
    domain: 'mood',
    score: Math.round((lateRate - earlyRate) * 100) + late.length + lateCycles * 5,
    appliesNow: currentWindow === 'late_luteal',
    headline: 'Harder mood days have tended to cluster before your period',
    body: `Across ${lateCycles} cycles, difficult mood was logged on ${lateNeg} of ${late.length} late-luteal days versus ${earlyNeg} of ${earlier.length} earlier-cycle days. That repeated timing is useful context from your own data, not a diagnosis.`,
    short: 'Your past logs suggest mood tends to be harder in the few days before your period.',
  }
}

function detectSleepRecoveryPattern(entries, currentWindow) {
  const secondHalf = entries.filter(e => (e.windowKey === 'luteal' || e.windowKey === 'late_luteal'))
  const firstHalf = entries.filter(e => (e.windowKey === 'follicular' || e.windowKey === 'ovulatory'))
  if (secondHalf.length < MIN_COMPARE_DAYS || firstHalf.length < MIN_COMPARE_DAYS) return null
  const cyclesSpanned = new Set(secondHalf.map(e => e.anchor)).size
  if (cyclesSpanned < MIN_CYCLES) return null

  const secondSleep = secondHalf.filter(e => e.hasSleep)
  const firstSleep = firstHalf.filter(e => e.hasSleep)
  const secondRecovery = secondHalf.filter(e => e.hasRecoverySignal)
  const firstRecovery = firstHalf.filter(e => e.hasRecoverySignal)

  let best = null

  if (secondSleep.length >= MIN_COMPARE_DAYS && firstSleep.length >= MIN_COMPARE_DAYS) {
    const secondPoor = secondSleep.filter(e => e.poorSleep).length
    const firstPoor = firstSleep.filter(e => e.poorSleep).length
    const secondRate = secondPoor / secondSleep.length
    const firstRate = firstPoor / firstSleep.length
    if (secondRate >= 0.45 && (secondRate - firstRate) >= MIN_RATE_GAP) {
      best = {
        id: 'sleep_pattern',
        domain: 'sleep_recovery',
        score: Math.round((secondRate - firstRate) * 100) + secondSleep.length + cyclesSpanned * 4,
        appliesNow: currentWindow === 'luteal' || currentWindow === 'late_luteal',
        headline: 'Your sleep has tended to be rougher in the second half of your cycle',
        body: `Poor or fair sleep was logged on ${pct(secondPoor, secondSleep.length)}% of your second-half cycle days versus ${pct(firstPoor, firstSleep.length)}% earlier in the cycle, across ${cyclesSpanned} cycles. Use that as your own context, not as a rule for every month.`,
        short: 'Your past logs suggest sleep is often rougher in the second half of your cycle.',
      }
    }
  }

  if (secondRecovery.length >= MIN_COMPARE_DAYS && firstRecovery.length >= MIN_COMPARE_DAYS) {
    const secondLow = secondRecovery.filter(e => e.lowRecovery).length
    const firstLow = firstRecovery.filter(e => e.lowRecovery).length
    const secondRate = secondLow / secondRecovery.length
    const firstRate = firstLow / firstRecovery.length
    if (secondRate >= 0.45 && (secondRate - firstRate) >= MIN_RATE_GAP) {
      const recoveryInsight = {
        id: 'recovery_pattern',
        domain: 'sleep_recovery',
        score: Math.round((secondRate - firstRate) * 100) + secondRecovery.length + cyclesSpanned * 4,
        appliesNow: currentWindow === 'luteal' || currentWindow === 'late_luteal',
        headline: 'Your recovery signals tend to dip in the second half of your cycle',
        body: `Low-energy or hard-session logs were recorded on ${pct(secondLow, secondRecovery.length)}% of your second-half cycle days versus ${pct(firstLow, firstRecovery.length)}% earlier in the cycle, across ${cyclesSpanned} cycles. That is a repeated pattern in your own logs, not a rule you must follow.`,
        short: 'Your past logs suggest workouts or energy feel flatter in the second half of your cycle.',
      }
      if (!best || recoveryInsight.score > best.score) best = recoveryInsight
    }
  }

  return best
}

export function analyzePersonalPatterns({ logs = [], cycleData = null, phase = null, subPhase = null } = {}) {
  if (!cycleData?.last_period_date) return { status: 'no_cycle', insights: [], featured: null }
  const periodStarts = parsePeriodStartsLocal(cycleData)
  const cycleLen = cycleData?.cycle_length || 28
  const currentWindow = currentWindowKey(phase, subPhase)

  const entries = []
  for (const log of logs || []) {
    if (!log?.log_date) continue
    const info = cycleInfoForDate(log.log_date, periodStarts, cycleLen)
    if (!info) continue
    entries.push({
      anchor: info.anchor,
      windowKey: phaseWindowKey(info.cycleDay, info.cycleLength),
      libido: log.libido || null,
      hasMood: Array.isArray(log.mood) && log.mood.length > 0,
      negativeMood: Array.isArray(log.mood) && log.mood.some(m => NEGATIVE_MOODS.has(m)),
      hasSleep: Boolean(log.sleep_quality),
      poorSleep: LOW_SLEEP.has(log.sleep_quality),
      hasRecoverySignal: Boolean(log.energy || log.workout_feel),
      lowRecovery: LOW_ENERGY.has(log.energy) || log.workout_feel === 'Felt hard',
    })
  }

  if (entries.length < MIN_PLACED_LOGS || new Set(entries.map(e => e.anchor)).size < MIN_CYCLES) {
    return { status: 'insufficient', insights: [], featured: null }
  }

  const insights = [
    detectLibidoPattern(entries, currentWindow),
    detectLateLutealMoodPattern(entries, currentWindow),
    detectSleepRecoveryPattern(entries, currentWindow),
  ].filter(Boolean).sort((a, b) => b.score - a.score)

  const featured = insights.find(i => i.appliesNow) || insights[0] || null
  return {
    status: insights.length ? 'ok' : 'no_pattern',
    insights,
    featured,
  }
}
