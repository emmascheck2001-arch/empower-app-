// Turn wearable data (temperature, resting heart rate, HRV — from Apple Health / Oura / Watch)
// into cycle + ovulation signals, using validated fertility-awareness science. This is the
// engine that makes cycle tracking work for EVERYONE, regular or not, because it reads the
// body directly instead of assuming from a calendar.
//
// Science:
//  - Ovulation is confirmed RETROSPECTIVELY by a sustained temperature rise: after ovulation,
//    progesterone raises core/skin temperature ~0.3°C and holds it up through the luteal phase.
//    Detection uses the classic "Three Over Six" coverline rule (Marshall 1968, still the
//    clinical/research standard): ovulation is confirmed once 3 consecutive temperatures sit
//    at least 0.2°C above the coverline, where coverline = the highest of the previous 6
//    temperatures. Ovulation itself is ~the day before the first high temperature.
//    Wrist/finger temperature (Apple Watch Series 8+/Ultra, Oura) matches BBT accuracy —
//    Oura validation: 96.4% ovulation detection, ±1.26 days; and 82% within 2 days for
//    IRREGULAR cycles vs 32.5% for the calendar method (JMIR 2025).
//  - Resting heart rate rises ~2.7 bpm from follicular to luteal, and HRV drops ~4.6 ms, both
//    driven by progesterone (J Clin Med 2020). Used only as SUPPORTING confirmation.

const round2 = n => Math.round(n * 100) / 100

// temps: [{ date:'YYYY-MM-DD', value: <°C> }]. Returns the most recent confirmed ovulation, or
// null. Needs at least 6 baseline days + 3 rise days.
export function detectOvulationFromTemp(temps, threshold = 0.2) {
  const t = (temps || [])
    .filter(x => x && typeof x.value === 'number' && x.date)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  if (t.length < 9) return null

  let result = null
  // s = index of the first "high" (post-shift) day. Baseline is the 6 days before it.
  for (let s = 6; s <= t.length - 3; s++) {
    const baseline = t.slice(s - 6, s)
    const coverline = Math.max(...baseline.map(x => x.value)) + threshold
    const rise = [t[s], t[s + 1], t[s + 2]]
    if (rise.every(x => x.value >= coverline)) {
      // Ovulation ≈ the last low day (the day before the temperature shift).
      result = {
        ovulationDate: t[s - 1].date,
        confirmedDate: t[s + 2].date,
        coverline: round2(coverline),
        method: 'temperature shift (3-over-6 coverline, Marshall 1968)',
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

  // Confidence: temperature confirmation is strong on its own; RHR/HRV corroborate.
  let lutealSupport = 0
  if (rhrLuteal) lutealSupport++
  if (hrvLuteal) lutealSupport++

  return {
    ovulationConfirmed: !!ov,
    ovulationDate: ov?.ovulationDate || null,
    ovulationConfirmedDate: ov?.confirmedDate || null,
    method: ov?.method || null,
    // luteal corroboration from cardiovascular signals (used to raise confidence, not decide)
    cardiovascularLutealSupport: lutealSupport,   // 0, 1, or 2
    hasTemperatureData: (temps || []).length >= 9,
  }
}
