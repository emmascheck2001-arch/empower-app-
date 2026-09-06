// cycleStats.js — the statistical core of cycle prediction.
//
// WHY THIS EXISTS: the previous window came from min/max of every past cycle, so a single
// unusual month permanently widened the window and MORE data made the prediction VAGUER.
// That is backwards. Real cycle-length distributions are right-skewed with occasional long
// outliers (stress, illness, travel, a delayed ovulation), so the right tools are robust
// ones — median, MAD, percentiles — not mean and range.
//
// Design rules (never loosen):
//  1. ROBUST CENTRE. Median-based, outliers fenced off by MAD, never a raw mean.
//  2. RECENCY MATTERS. Cycle length drifts with age, stress, training. Recent cycles are
//     weighted more heavily than cycles from a year ago.
//  3. SHRINK WHEN THIN. With 1-2 cycles the estimate is pulled toward the user's own stated
//     cycle length instead of over-fitting to one observation.
//  4. THE WINDOW NARROWS AS DATA GROWS. More cycles -> tighter, better-earned interval.
//  5. NEVER FAKE PRECISION. Every output carries how many cycles it is built on.
// Pure functions only (no supabase, no dates from the environment) so all of it is unit-tested.
//
// References: Bull 2019 (real-world cycle variability, n=600k); Li 2020/2023 (predictive
// modelling of cycle length); Symul 2019; Munro/FIGO 2018 (normal range 24-38d, "regular"
// = variation under ~8-9 days); Munster 2021 (luteal phase ~14d and near-fixed).

// ── plausibility limits ─────────────────────────────────────────────────────
// A gap under 15 days is almost certainly breakthrough/intermenstrual bleeding logged as a
// period, not a real cycle. Over 60 days is a skipped cycle, not a cycle length. Both are
// excluded from the MODEL but never deleted from the user's history.
export const MIN_PLAUSIBLE_GAP = 15
export const MAX_PLAUSIBLE_GAP = 60
// FIGO's normal range, used as the "typical" band for averaging and for calling regularity.
export const MIN_TYPICAL_GAP = 21
export const MAX_TYPICAL_GAP = 45
// Physiological floor: we never predict a period sooner than this after the last one.
export const MIN_PREDICT_GAP = 21
export const RECENCY_DECAY = 0.85   // weight of each older cycle relative to the next newer one

export function median(xs) {
  const a = (xs || []).filter(n => typeof n === 'number' && !isNaN(n)).slice().sort((x, y) => x - y)
  if (!a.length) return null
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

// Median absolute deviation, scaled to be comparable to a standard deviation for normal data.
// Robust: unaffected by up to half the values being outliers, unlike a standard deviation.
export function mad(xs, centre = null) {
  const a = (xs || []).filter(n => typeof n === 'number' && !isNaN(n))
  if (a.length < 2) return 0
  const c = centre == null ? median(a) : centre
  return median(a.map(v => Math.abs(v - c))) * 1.4826
}

// Linear-interpolated percentile (p in 0..1). Used for the prediction window once there is
// enough history to read the user's real spread off her own cycles.
export function percentile(xs, p) {
  const a = (xs || []).filter(n => typeof n === 'number' && !isNaN(n)).slice().sort((x, y) => x - y)
  if (!a.length) return null
  if (a.length === 1) return a[0]
  const idx = (a.length - 1) * Math.min(1, Math.max(0, p))
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (idx - lo)
}

// Fence off outliers around the robust centre. Keeps everything within `k` MADs; when the
// MAD is 0 (very regular cycles, or too few points) it falls back to a fixed +/- 7 day fence
// so one 45-day month can't drag a steady 28-day cycle.
export function rejectOutliers(gaps, k = 3) {
  const a = (gaps || []).filter(n => typeof n === 'number' && !isNaN(n))
  if (a.length < 3) return a.slice()
  const c = median(a)
  const d = mad(a, c)
  const fence = d > 0 ? k * d : 7
  const kept = a.filter(g => Math.abs(g - c) <= fence)
  return kept.length ? kept : a.slice()
}

// Exponentially recency-weighted mean. `gaps` must be OLDEST-FIRST; the last entry is the
// most recent cycle and carries the most weight.
export function recencyWeightedMean(gaps, decay = RECENCY_DECAY) {
  const a = (gaps || []).filter(n => typeof n === 'number' && !isNaN(n))
  if (!a.length) return null
  let num = 0, den = 0
  for (let i = 0; i < a.length; i++) {
    const w = Math.pow(decay, a.length - 1 - i)
    num += a[i] * w; den += w
  }
  return num / den
}

// ── the estimator ───────────────────────────────────────────────────────────
// Turns a list of past cycle gaps (OLDEST-FIRST) into a centre + interval.
// Returns { centre, low, high, nUsed, spread, regular, method }.
//  - centre: most likely cycle length, in days (not yet rounded)
//  - low/high: the 80% interval, in days from the last period start
//  - spread: robust standard deviation of her cycles (days), 0 when unknown
//  - regular: FIGO-style regularity call (variation under 8 days), null when unknown
export function estimateCycleLength(gaps, priorLength = 28) {
  const plausible = (gaps || []).filter(g => g >= MIN_PLAUSIBLE_GAP && g <= MAX_PLAUSIBLE_GAP)
  const typical = plausible.filter(g => g >= MIN_TYPICAL_GAP && g <= MAX_TYPICAL_GAP)
  const prior = Math.min(MAX_TYPICAL_GAP, Math.max(MIN_TYPICAL_GAP, priorLength || 28))
  const base = typical.length ? typical : plausible

  if (!base.length) {
    // No usable history at all: the prior IS the estimate, with an honest wide window.
    return { centre: prior, low: prior - 5, high: prior + 5, nUsed: 0, spread: 0, regular: null, method: 'prior' }
  }

  const kept = rejectOutliers(base)
  const n = kept.length
  const obs = recencyWeightedMean(kept)
  const med = median(kept)
  // Blend the recency-weighted mean with the robust median: the weighted mean tracks drift,
  // the median resists a weird month. Half and half is stable in backtests and neither
  // estimator can run away on its own.
  const observed = (obs + med) / 2

  // Shrink toward the prior when history is thin (James-Stein style). k=1.5 means a single
  // observed cycle counts for about 40% of the estimate; by 4 cycles the prior is ~27%.
  const k = 1.5
  const centre = (n * observed + k * prior) / (n + k)

  const spread = n >= 3 ? mad(kept, med) : 0
  // FIGO calls a cycle regular when it varies by less than ~8 days across the year.
  const regular = n >= 3 ? (Math.max(...kept) - Math.min(...kept)) < 8 : null

  // ── the window ────────────────────────────────────────────────────────────
  // n>=5: read her real 10th-90th percentiles straight off her own cycles.
  // n 3-4: percentiles are too jumpy, use the robust spread (+/-1.28 sd = 80%), floored at 2d.
  // n 1-2: not enough to measure spread, use a prior half-width that shrinks as n grows.
  let low, high, method
  if (n >= 5) {
    method = 'empirical'
    low = percentile(kept, 0.10); high = percentile(kept, 0.90)
    // Keep the interval honest: it must contain the centre and never collapse below +/-1 day.
    low = Math.min(low, centre - 1); high = Math.max(high, centre + 1)
  } else if (n >= 3) {
    method = 'robust-sd'
    const half = Math.max(2, 1.2816 * (spread || 2))
    low = centre - half; high = centre + half
  } else {
    method = 'prior-width'
    const half = n === 2 ? 4.5 : n === 1 ? 5.5 : 6.5
    low = centre - half; high = centre + half
  }

  // A very irregular history must never be squeezed into a falsely tight window.
  if (n >= 3) {
    const observedHalf = (Math.max(...kept) - Math.min(...kept)) / 2
    if (observedHalf > 6) { low = Math.min(low, centre - 4); high = Math.max(high, centre + 4) }
  }

  return {
    centre,
    low: Math.max(MIN_PREDICT_GAP, low),
    high: Math.max(high, centre + 1),
    nUsed: n,
    spread,
    regular,
    method,
  }
}

// ── date helpers (pure, local-noon safe) ────────────────────────────────────
const ISO = /^\d{4}-\d{2}-\d{2}$/
export function parseISO(s) {
  return ISO.test(s || '') ? new Date(s + 'T00:00:00') : null
}
export function toISO(d) {
  if (!d || isNaN(d)) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function addDays(dateOrISO, n) {
  const d = typeof dateOrISO === 'string' ? parseISO(dateOrISO) : new Date(dateOrISO)
  if (!d || isNaN(d)) return null
  d.setDate(d.getDate() + n)
  return d
}
export function daysBetween(aISO, bISO) {
  const a = parseISO(aISO), b = parseISO(bISO)
  if (!a || !b) return null
  return Math.round((b - a) / 86400000)
}

// Gaps between consecutive period starts, OLDEST-FIRST. Implausible gaps are dropped here
// so every consumer sees the same filtered series.
export function gapsFromStarts(starts) {
  const s = (starts || []).filter(d => ISO.test(d)).slice().sort()
  const out = []
  for (let i = 1; i < s.length; i++) {
    const g = daysBetween(s[i - 1], s[i])
    if (g >= MIN_PLAUSIBLE_GAP && g <= MAX_PLAUSIBLE_GAP) out.push(g)
  }
  return out
}
