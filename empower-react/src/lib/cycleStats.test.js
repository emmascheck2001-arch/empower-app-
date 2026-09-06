import { describe, it, expect } from 'vitest'
import { median, mad, percentile, rejectOutliers, recencyWeightedMean,
         estimateCycleLength, gapsFromStarts, daysBetween, addDays, toISO } from './cycleStats'

describe('robust statistics', () => {
  it('median handles odd, even, empty and unsorted input', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBe(null)
    expect(median([7])).toBe(7)
  })

  it('mad is unmoved by an extreme outlier (a mean-based sd would not be)', () => {
    const clean = [28, 28, 29, 28, 28]
    expect(mad(clean)).toBeLessThan(2)
    expect(mad([...clean, 90])).toBeLessThan(2)
  })

  it('percentile interpolates and clamps', () => {
    expect(percentile([10, 20, 30], 0.5)).toBe(20)
    expect(percentile([10, 20], 0.5)).toBe(15)
    expect(percentile([10, 20, 30], 0)).toBe(10)
    expect(percentile([10, 20, 30], 1)).toBe(30)
  })

  it('rejectOutliers fences off a wild value but keeps normal spread', () => {
    expect(rejectOutliers([28, 29, 28, 30, 55])).not.toContain(55)
    expect(rejectOutliers([26, 28, 30, 32])).toHaveLength(4)
  })

  it('rejectOutliers never returns an empty set', () => {
    expect(rejectOutliers([20, 40, 60]).length).toBeGreaterThan(0)
  })

  it('recencyWeightedMean leans toward the most recent value', () => {
    // oldest-first: the trailing 20 must pull the mean below the plain mean of 25
    expect(recencyWeightedMean([30, 30, 20])).toBeLessThan(26.7)
    expect(recencyWeightedMean([28, 28, 28])).toBeCloseTo(28)
    expect(recencyWeightedMean([])).toBe(null)
  })
})

describe('estimateCycleLength', () => {
  it('with no data the prior IS the estimate', () => {
    const e = estimateCycleLength([], 30)
    expect(e.centre).toBe(30); expect(e.nUsed).toBe(0); expect(e.method).toBe('prior')
  })

  it('clamps an implausible prior into the physiological range', () => {
    expect(estimateCycleLength([], 3).centre).toBe(21)
    expect(estimateCycleLength([], 200).centre).toBe(45)
  })

  it('shrinks toward the prior when history is thin', () => {
    const e = estimateCycleLength([34], 28)
    expect(e.centre).toBeGreaterThan(28)
    expect(e.centre).toBeLessThan(34)
  })

  it('trusts the data once history is rich', () => {
    const e = estimateCycleLength([34, 34, 34, 34, 34, 34, 34, 34], 28)
    expect(e.centre).toBeGreaterThan(33)
  })

  it('switches to empirical percentiles at 5+ cycles and narrows the interval', () => {
    const few  = estimateCycleLength([28, 29, 28], 28)
    const many = estimateCycleLength([28, 29, 28, 28, 29, 28, 28], 28)
    expect(many.method).toBe('empirical')
    expect(many.high - many.low).toBeLessThan(few.high - few.low)
  })

  it('keeps an erratic history wide rather than falsely tight', () => {
    const e = estimateCycleLength([22, 38, 25, 36, 30], 28)
    expect(e.high - e.low).toBeGreaterThanOrEqual(8)
    expect(e.regular).toBe(false)
  })

  it('never returns a lower bound below the physiological minimum', () => {
    expect(estimateCycleLength([21, 21, 21, 21, 21], 21).low).toBeGreaterThanOrEqual(21)
  })

  it('the interval always contains the centre', () => {
    const cases = [[], [28], [28, 30], [24, 26, 28], [21, 45, 28, 30, 22, 44, 27]]
    for (const gaps of cases) {
      const e = estimateCycleLength(gaps, 28)
      expect(e.low).toBeLessThanOrEqual(e.centre)
      expect(e.high).toBeGreaterThanOrEqual(e.centre)
    }
  })

  it('ignores breakthrough bleeds and skipped cycles', () => {
    const e = estimateCycleLength([8, 28, 29, 28, 75], 28)
    expect(e.nUsed).toBe(3)
  })
})

describe('date helpers', () => {
  it('daysBetween is inclusive-exclusive and order-signed', () => {
    expect(daysBetween('2026-01-01', '2026-01-29')).toBe(28)
    expect(daysBetween('2026-01-29', '2026-01-01')).toBe(-28)
    expect(daysBetween('nope', '2026-01-01')).toBe(null)
  })

  it('crosses month, year and DST boundaries correctly', () => {
    expect(toISO(addDays('2026-12-25', 10))).toBe('2027-01-04')
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30)   // spans a DST change
    expect(daysBetween('2028-02-01', '2028-03-01')).toBe(29)   // leap year
  })

  it('gapsFromStarts sorts, filters and returns oldest-first', () => {
    const g = gapsFromStarts(['2026-02-26', '2026-01-01', '2026-01-29'])
    expect(g).toEqual([28, 28])
    expect(gapsFromStarts(['2026-01-01', '2026-01-05'])).toEqual([])  // 4-day gap is not a cycle
  })
})
