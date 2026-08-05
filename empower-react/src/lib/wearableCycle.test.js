import { describe, it, expect } from 'vitest'
import { detectOvulationFromTemp, wearableCycleSignals } from './wearableCycle'

// Helper: build a temp series from an array of °C values on consecutive days.
function series(values, start = '2026-08-01') {
  const d0 = new Date(start + 'T00:00:00')
  return values.map((value, i) => {
    const d = new Date(d0); d.setDate(d0.getDate() + i)
    return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, value }
  })
}

describe('detectOvulationFromTemp (3-over-6 coverline)', () => {
  it('confirms ovulation on a clean temperature shift', () => {
    // 6 low days ~36.4, then 3 high days ~36.7 (>= coverline 36.4+0.2 = 36.6)
    const temps = series([36.4, 36.4, 36.35, 36.45, 36.4, 36.4, 36.7, 36.75, 36.7])
    const ov = detectOvulationFromTemp(temps)
    expect(ov).toBeTruthy()
    expect(ov.confirmedDate).toBe(temps[8].date)
    expect(ov.ovulationDate).toBe(temps[5].date) // day before the first high
    expect(ov.coverline).toBeCloseTo(36.65, 2)   // max(baseline 36.45)+0.2
  })

  it('does not confirm without a sustained 3-day rise', () => {
    // only 2 high days, then back down
    const temps = series([36.4, 36.4, 36.4, 36.4, 36.4, 36.4, 36.7, 36.7, 36.4])
    expect(detectOvulationFromTemp(temps)).toBe(null)
  })

  it('needs at least 9 days of data', () => {
    expect(detectOvulationFromTemp(series([36.4, 36.7, 36.7, 36.7]))).toBe(null)
    expect(detectOvulationFromTemp([])).toBe(null)
    expect(detectOvulationFromTemp(null)).toBe(null)
  })

  it('returns the most recent shift when several exist', () => {
    const temps = series([
      36.3, 36.3, 36.3, 36.3, 36.3, 36.3, 36.6, 36.6, 36.6, // shift 1
      36.3, 36.3, 36.3, 36.3, 36.3, 36.3, 36.6, 36.6, 36.6, // shift 2 (later)
    ])
    const ov = detectOvulationFromTemp(temps)
    expect(ov.confirmedDate).toBe(temps[17].date)
  })
})

describe('wearableCycleSignals', () => {
  it('reports confirmed ovulation from temperature', () => {
    const temps = series([36.4, 36.4, 36.35, 36.45, 36.4, 36.4, 36.7, 36.75, 36.7])
    const s = wearableCycleSignals({ temps })
    expect(s.ovulationConfirmed).toBe(true)
    expect(s.hasTemperatureData).toBe(true)
    expect(s.method).toMatch(/temperature/)
  })

  it('adds luteal support from elevated RHR and dropped HRV', () => {
    const temps = series([36.4, 36.4, 36.35, 36.45, 36.4, 36.4, 36.7, 36.75, 36.7])
    // restingHR most-recent-first: 62 now vs ~59 baseline (up ~3)
    const s = wearableCycleSignals({ temps, restingHR: [62, 59, 59, 58], hrv: [40, 48, 47, 49] })
    expect(s.cardiovascularLutealSupport).toBe(2)
  })

  it('is safe with no data', () => {
    const s = wearableCycleSignals({})
    expect(s.ovulationConfirmed).toBe(false)
    expect(s.hasTemperatureData).toBe(false)
  })
})
