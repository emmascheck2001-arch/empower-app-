// predictionAccuracy.js — the app grades its own homework.
//
// WHY: "confidence" in this app is a learning/personalisation score that only ever climbs.
// That is deliberate (the app must not appear to forget), but it means the user has never
// been shown a number that reflects whether the predictions are actually any GOOD. This
// module supplies that, honestly, and it works from day one because it BACKTESTS: for each
// past period, it re-runs the estimator using ONLY the cycles that came before it, then
// compares that prediction to what actually happened. No new tables, no waiting months.
//
// HONESTY RULES (never loosen):
//  1. A backtest may only ever see data from BEFORE the event it is predicting. No leakage.
//  2. Never report an accuracy score built on fewer than MIN_SCORED events — say "not enough
//     cycles yet" instead of publishing a number built on one guess.
//  3. Report the error in plain days ("typically within 2 days"), never a percentage that
//     implies more precision than a day-level prediction can carry.
//  4. Everything here describes the USER'S OWN data. No population claims.
// Pure functions only, unit-tested.

import { estimateCycleLength, gapsFromStarts, daysBetween, MIN_PREDICT_GAP } from './cycleStats.js'

export const MIN_SCORED = 2   // scored predictions needed before a number is shown

// ── period-date accuracy ────────────────────────────────────────────────────
// starts: ISO period-start dates (any order). priorLength: her stated cycle length.
// Returns { status, scored[], n, medianAbsError, meanAbsError, withinWindow, hitRate, last }
//   status: 'ok' | 'insufficient'
//   scored[i] = { date, predicted, errorDays, inWindow }  (errorDays > 0 = period came LATE)
export function backtestPeriodPredictions(starts, priorLength = 28) {
  const s = (starts || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice().sort()
  const scored = []
  // Need at least one prior gap to predict from, so scoring begins at the 3rd start.
  for (let i = 2; i < s.length; i++) {
    const history = s.slice(0, i)                 // strictly before the event — no leakage
    const gaps = gapsFromStarts(history)
    if (!gaps.length) continue
    const est = estimateCycleLength(gaps, priorLength)
    const point = Math.max(MIN_PREDICT_GAP, Math.round(est.centre))
    const actual = daysBetween(s[i - 1], s[i])
    if (actual == null || actual < 5) continue    // ignore an obviously mis-logged double-entry
    const errorDays = actual - point              // + = later than predicted
    const inWindow = actual >= Math.floor(est.low) && actual <= Math.ceil(est.high)
    scored.push({ date: s[i], predictedGap: point, actualGap: actual, errorDays, inWindow })
  }

  if (scored.length < MIN_SCORED) {
    return {
      status: 'insufficient', scored, n: scored.length,
      needed: MIN_SCORED - scored.length,
      medianAbsError: null, meanAbsError: null, withinWindow: null, hitRate: null, last: scored[scored.length - 1] || null,
    }
  }
  const abs = scored.map(x => Math.abs(x.errorDays)).sort((a, b) => a - b)
  const m = Math.floor(abs.length / 2)
  const medianAbsError = abs.length % 2 ? abs[m] : (abs[m - 1] + abs[m]) / 2
  const meanAbsError = abs.reduce((a, b) => a + b, 0) / abs.length
  const withinWindow = scored.filter(x => x.inWindow).length
  // "Hit" = within 2 days, the tolerance that actually matters for planning a life around it.
  const hits = scored.filter(x => Math.abs(x.errorDays) <= 2).length
  return {
    status: 'ok',
    scored, n: scored.length,
    medianAbsError: Math.round(medianAbsError * 10) / 10,
    meanAbsError: Math.round(meanAbsError * 10) / 10,
    withinWindow, windowRate: withinWindow / scored.length,
    hits, hitRate: hits / scored.length,
    last: scored[scored.length - 1],
  }
}

// One plain-English line for the dashboard scoreboard. Never invents a number.
export function accuracySummary(bt) {
  if (!bt || bt.status !== 'ok') {
    const needed = bt?.needed || MIN_SCORED
    return { headline: 'Not enough cycles to score yet',
      detail: `Log ${needed} more period${needed === 1 ? '' : 's'} and I can start showing you how close my predictions actually land.` }
  }
  const e = bt.medianAbsError
  const within = e <= 1 ? 'within a day' : `within about ${Math.round(e)} day${Math.round(e) === 1 ? '' : 's'}`
  const last = bt.last
  const lastLine = last
    ? (last.errorDays === 0 ? 'Last time I called it exactly.'
      : `Last time I was ${Math.abs(last.errorDays)} day${Math.abs(last.errorDays) === 1 ? '' : 's'} ${last.errorDays > 0 ? 'early' : 'late'}.`)
    : ''
  return {
    headline: `Usually ${within}`,
    detail: `Across your last ${bt.n} cycle${bt.n === 1 ? '' : 's'} my period prediction landed ${within}. ${lastLine}`.trim(),
    hitRate: bt.hitRate,
    scoreLine: `${bt.hits} of ${bt.n} within 2 days`,
  }
}

// ── tomorrow's-energy prediction (the "play against the model" loop) ────────
// Predicts a day's energy from HER OWN past logs at the same point in the cycle, then scores
// itself the next day. This is the feature that makes logging feel like checking the app's
// homework rather than filling in a form.
const ENERGY_SCALE = { 'Very low': 1, 'Low': 2, 'Normal': 3, 'Good': 3, 'High': 4 }
const ENERGY_WORD = { 1: 'Very low', 2: 'Low', 3: 'Normal', 4: 'High' }
export const MIN_ENERGY_SAMPLES = 3   // past observations near that cycle day before predicting
const NEAR_DAYS = 2                   // +/- window around the target cycle day

// logs: [{ log_date, energy }] any order. Predicts the energy for `targetCycleDay`.
// Returns { value, word, n, spread } or null when there isn't enough of her own data.
export function predictEnergyForCycleDay(logs, targetCycleDay, lastPeriodDate, cycleLen = 28) {
  if (targetCycleDay == null || !lastPeriodDate) return null
  const samples = []
  for (const l of logs || []) {
    const score = ENERGY_SCALE[l?.energy]
    if (!score) continue
    const d = daysBetween(lastPeriodDate, l.log_date)
    if (d == null) continue
    // Fold this log onto a cycle day. Logs from previous cycles land at their own cycle day.
    let cd = (d % (cycleLen || 28)) + 1
    if (cd <= 0) cd += (cycleLen || 28)
    // Circular distance, so cycle day 1 sits next to the last day of the cycle.
    const raw = Math.abs(cd - targetCycleDay)
    const dist = Math.min(raw, (cycleLen || 28) - raw)
    if (dist <= NEAR_DAYS) samples.push(score)
  }
  if (samples.length < MIN_ENERGY_SAMPLES) return null
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length
  const value = Math.max(1, Math.min(4, Math.round(mean)))
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length
  return { value, word: ENERGY_WORD[value], n: samples.length, spread: Math.sqrt(variance), mean }
}

// Score a prediction against what she actually logged. "Close" = within one step on the
// 4-point scale, which is the honest resolution of a 4-option question.
export function scoreEnergyPrediction(predictedWord, actualWord) {
  const p = ENERGY_SCALE[predictedWord], a = ENERGY_SCALE[actualWord]
  if (!p || !a) return null
  const diff = Math.abs(p - a)
  return { exact: diff === 0, close: diff <= 1, diff }
}

// Backtest the energy predictor over her own history, same no-leakage rule: each day is
// predicted using only logs from strictly EARLIER dates.
export function backtestEnergy(logs, lastPeriodDate, cycleLen = 28) {
  const ls = (logs || []).filter(l => l?.log_date && ENERGY_SCALE[l.energy])
    .slice().sort((a, b) => (a.log_date < b.log_date ? -1 : 1))
  let exact = 0, close = 0, n = 0
  for (let i = 0; i < ls.length; i++) {
    const past = ls.slice(0, i)
    const d = daysBetween(lastPeriodDate, ls[i].log_date)
    if (d == null) continue
    let cd = (d % (cycleLen || 28)) + 1
    if (cd <= 0) cd += (cycleLen || 28)
    const pred = predictEnergyForCycleDay(past, cd, lastPeriodDate, cycleLen)
    if (!pred) continue
    const s = scoreEnergyPrediction(pred.word, ls[i].energy)
    if (!s) continue
    n++; if (s.exact) exact++; if (s.close) close++
  }
  if (n < MIN_SCORED) return { status: 'insufficient', n, exact: 0, close: 0 }
  return { status: 'ok', n, exact, close, exactRate: exact / n, closeRate: close / n }
}
