import { describe, it, expect } from 'vitest'
import { backtestPeriodPredictions, accuracySummary, predictEnergyForCycleDay,
         scoreEnergyPrediction, backtestEnergy, MIN_SCORED } from './predictionAccuracy'

// Build a run of period starts `len` days apart (with optional per-cycle jitter).
function starts(n, len = 28, jitter = []) {
  const out = ['2026-01-01']
  for (let i = 1; i < n; i++) {
    const d = new Date(out[i - 1] + 'T00:00:00')
    d.setDate(d.getDate() + len + (jitter[i - 1] || 0))
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

describe('backtestPeriodPredictions', () => {
  it('says so honestly when there are not enough cycles to score', () => {
    const bt = backtestPeriodPredictions(starts(2), 28)
    expect(bt.status).toBe('insufficient')
    expect(bt.n).toBeLessThan(MIN_SCORED)
    expect(accuracySummary(bt).headline).toMatch(/not enough/i)
  })

  it('scores a perfectly regular cycle as zero error', () => {
    const bt = backtestPeriodPredictions(starts(6, 28), 28)
    expect(bt.status).toBe('ok')
    expect(bt.medianAbsError).toBe(0)
    expect(bt.hitRate).toBe(1)
    expect(bt.windowRate).toBe(1)
  })

  it('reports real error for an irregular cycle instead of flattering itself', () => {
    const bt = backtestPeriodPredictions(starts(7, 28, [6, -5, 7, -6, 5, -4]), 28)
    expect(bt.status).toBe('ok')
    expect(bt.medianAbsError).toBeGreaterThan(1)
  })

  it('NEVER leaks future data: a prediction only ever sees earlier cycles', () => {
    // Cycles are 28 days until a sudden run of 35s. The first 35-day cycle must be scored as a
    // miss — a leaking implementation would already "know" about the change and score it right.
    const s = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-04-02', '2026-05-07']
    const bt = backtestPeriodPredictions(s, 28)
    const firstLong = bt.scored.find(x => x.date === '2026-04-02')
    expect(Math.abs(firstLong.errorDays)).toBeGreaterThanOrEqual(5)
  })

  it('adapts: after a sustained change the later predictions get better', () => {
    const s = starts(9, 35)
    const bt = backtestPeriodPredictions(s, 28)   // stated length 28, reality 35
    const early = Math.abs(bt.scored[0].errorDays)
    const late = Math.abs(bt.scored[bt.scored.length - 1].errorDays)
    expect(late).toBeLessThan(early)
  })

  it('ignores a mis-logged double entry rather than scoring itself against it', () => {
    const bt = backtestPeriodPredictions(['2026-01-01','2026-01-29','2026-01-30','2026-02-26','2026-03-26'], 28)
    expect(bt.scored.every(x => x.actualGap >= 5)).toBe(true)
  })

  it('handles empty, null and single-entry input without throwing', () => {
    for (const input of [null, [], ['2026-01-01'], ['bad-date']]) {
      expect(() => backtestPeriodPredictions(input, 28)).not.toThrow()
      expect(backtestPeriodPredictions(input, 28).status).toBe('insufficient')
    }
  })
})

describe('accuracySummary', () => {
  it('states the typical error in days, never a fake percentage', () => {
    const s = accuracySummary(backtestPeriodPredictions(starts(6, 28), 28))
    expect(s.headline).toMatch(/within/i)
    expect(s.detail).not.toMatch(/%/)
  })
})

describe('energy prediction', () => {
  const log = (date, energy) => ({ log_date: date, energy })

  it('stays silent until it has enough of her own data', () => {
    expect(predictEnergyForCycleDay([log('2026-01-10', 'Low')], 10, '2026-01-01', 28)).toBe(null)
  })

  it('predicts from her own logs at the same point in the cycle', () => {
    const logs = [log('2026-01-10','Low'), log('2026-02-07','Low'), log('2026-03-07','Low')]
    const p = predictEnergyForCycleDay(logs, 10, '2026-01-01', 28)
    expect(p.word).toBe('Low')
    expect(p.n).toBeGreaterThanOrEqual(3)
  })

  it('treats cycle day 1 as adjacent to the end of the cycle (circular)', () => {
    const logs = [log('2026-01-27','Very low'), log('2026-01-28','Very low'), log('2026-02-24','Very low')]
    const p = predictEnergyForCycleDay(logs, 1, '2026-01-01', 28)
    expect(p).not.toBe(null)
    expect(p.word).toBe('Very low')
  })

  it('scores itself exactly and generously-but-honestly', () => {
    expect(scoreEnergyPrediction('Low', 'Low')).toEqual({ exact: true, close: true, diff: 0 })
    expect(scoreEnergyPrediction('Low', 'Normal').close).toBe(true)
    expect(scoreEnergyPrediction('Very low', 'High').close).toBe(false)
    expect(scoreEnergyPrediction('Low', null)).toBe(null)
  })

  it('backtests energy without leaking the day it is predicting', () => {
    const logs = []
    for (let c = 0; c < 4; c++) for (let d = 0; d < 28; d++) {
      const day = new Date('2026-01-01T00:00:00'); day.setDate(day.getDate() + c * 28 + d)
      logs.push(log(day.toISOString().slice(0, 10), d < 5 ? 'Low' : d < 18 ? 'High' : 'Low'))
    }
    const bt = backtestEnergy(logs, '2026-01-01', 28)
    expect(bt.status).toBe('ok')
    expect(bt.closeRate).toBeGreaterThan(0.8)   // a stable pattern should be learnable
    expect(bt.n).toBeGreaterThan(20)
  })

  it('does not crash on empty or malformed input', () => {
    expect(backtestEnergy([], '2026-01-01', 28).status).toBe('insufficient')
    expect(predictEnergyForCycleDay(null, 10, null, 28)).toBe(null)
  })
})
