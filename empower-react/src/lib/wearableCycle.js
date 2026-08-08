// Turn wearable data (temperature, resting heart rate, HRV — from Apple Health / Oura / Watch)
// into cycle + ovulation signals, using validated fertility-awareness science. This is the
// engine that adds a retrospective body-based estimate when enough readings are available.
//
// Science:
//  - Ovulation can be estimated RETROSPECTIVELY from a sustained temperature rise: after ovulation,
//    progesterone raises core/skin temperature ~0.3°C and holds it up through the luteal phase.
//    This implementation uses a conservative "three over six"-style heuristic: an estimate is
//    returned after 3 consecutive temperatures sit
//    at least 0.2°C above the coverline, where coverline = the highest of the previous 6
//    temperatures. Ovulation itself is ~the day before the first high temperature.
//    Device-specific proprietary validation results must not be attributed to this simple rule.
//    Wrist/finger temperature and oral BBT use different collection protocols.
//  - Resting heart rate rises ~2.7 bpm from follicular to luteal, and HRV drops ~4.6 ms, both
//    driven by progesterone (J Clin Med 2020). Used only as SUPPORTING confirmation.

const round2 = n => Math.round(n * 100) / 100
const dayNumber = date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '')
  return match ? Date.UTC(+match[1], +match[2] - 1, +match[3]) / 86400000 : NaN
}

// temps: [{ date:'YYYY-MM-DD', value: <°C> }]. Returns the most recent retrospective estimate, or
// null. Needs at least 6 baseline days + 3 rise days.
export function detectOvulationFromTemp(temps, threshold = 0.2) {
  const daily = new Map()
  for (const sample of temps || []) {
    if (!sample || typeof sample.value !== 'number' || sample.value < 30 || sample.value > 43 || isNaN(dayNumber(sample.date))) continue
    const values = daily.get(sample.date) || []
    values.push(sample.value)
    daily.set(sample.date, values)
  }
  const t = [...daily.entries()]
    .map(([date, values]) => ({ date, value: values.reduce((a, b) => a + b, 0) / values.length }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  if (t.length < 9) return null

  let result = null
  // s = index of the first "high" (post-shift) day. Baseline is the 6 days before it.
  for (let s = 6; s <= t.length - 3; s++) {
    const baseline = t.slice(s - 6, s)
    const window = t.slice(s - 6, s + 3)
    // The rule is six baseline DAYS followed by three consecutive high DAYS. Adjacent
    // array entries are not enough because wearables commonly have missing nights.
    if (!window.every((entry, i) => i === 0 || dayNumber(entry.date) - dayNumber(window[i - 1].date) === 1)) continue
    const coverline = Math.max(...baseline.map(x => x.value)) + threshold
    const rise = [t[s], t[s + 1], t[s + 2]]
    if (rise.every(x => x.value >= coverline)) {
      // Ovulation ≈ the last low day (the day before the temperature shift).
      result = {
        ovulationDate: t[s - 1].date,
        estimatedAfterDate: t[s + 2].date,
        coverline: round2(coverline),
        method: 'sustained temperature-shift heuristic (three-over-six style)',
        sampleQuality: 'nine consecutive daily readings',
      }
      // keep scanning so we return the LATEST shift (this cycle's ovulation)
    }
  }
  return result
}

// Personal-baseline comparison for resting HR / HRV: is the most recent value shifted in the
// luteal direction (RHR up, HRV down) vs this person's own recent baseline? Supporting only.
function shiftedUp(values, minDelta) {
  const v = (values || []).filter(n => typeof n === 'number' && !isNaN(n))
  if (v.length < 4) return null
  const latest = v[0]
  const baseline = v.slice(1).reduce((a, b) => a + b, 0) / (v.length - 1)
  return latest - baseline >= minDelta
}

// Combine wearable streams into cycle signals. `temps` are °C; `restingHR` in bpm and `hrv` in
// ms are most-recent-first arrays. Everything degrades gracefully when a stream is missing.
export function wearableCycleSignals({ temps = [], restingHR = [], hrv = [] } = {}) {
  const ov = detectOvulationFromTemp(temps)
  const rhrLuteal = shiftedUp(restingHR, 2)          // ~2.7 bpm follicular→luteal
  const hrvLuteal = shiftedUp((hrv || []).map(n => -n), 4)  // HRV DROPS in luteal (~4.6 ms)

  // Cardiovascular streams are context only and never make the ovulation estimate by themselves.
  let lutealSupport = 0
  if (rhrLuteal) lutealSupport++
  if (hrvLuteal) lutealSupport++

  return {
    ovulationConfirmed: false,
    ovulationEstimated: !!ov,
    ovulationDate: ov?.ovulationDate || null,
    ovulationEstimatedAfterDate: ov?.estimatedAfterDate || null,
    method: ov?.method || null,
    // luteal corroboration from cardiovascular signals (used to raise confidence, not decide)
    cardiovascularLutealSupport: lutealSupport,   // 0, 1, or 2
    hasTemperatureData: (temps || []).length >= 9,
  }
}
