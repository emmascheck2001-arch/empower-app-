import { describe, expect, it } from 'vitest'
import { sleepHoursLastNight, sleepSummaryLastNight, getFreshWearableSnapshot, isFreshHealthDate } from './healthkit'

const sample = (startDate, endDate, sourceName = 'Watch', sleepState = 'asleep') => ({
  startDate, endDate, sourceName, sleepState,
})

describe('sleepHoursLastNight', () => {
  it('merges overlapping stages from one source', () => {
    const hours = sleepHoursLastNight([
      sample('2026-08-07T22:00:00Z', '2026-08-08T06:00:00Z'),
      sample('2026-08-07T23:00:00Z', '2026-08-08T01:00:00Z', 'Watch', 'deep'),
    ])
    expect(hours).toBe(8)
  })

  it('uses the most complete source instead of adding duplicate devices', () => {
    const hours = sleepHoursLastNight([
      sample('2026-08-07T22:00:00Z', '2026-08-08T06:00:00Z', 'Watch'),
      sample('2026-08-07T22:30:00Z', '2026-08-08T06:00:00Z', 'Oura'),
    ])
    expect(hours).toBe(8)
  })
})

describe('sleepSummaryLastNight', () => {
  it('returns the latest sleep date with the hours', () => {
    const summary = sleepSummaryLastNight([
      sample('2026-08-07T22:00:00Z', '2026-08-08T06:00:00Z'),
    ])
    expect(summary).toEqual({ date: '2026-08-08', hours: 8 })
  })
})

describe('isFreshHealthDate', () => {
  it('accepts today and yesterday but rejects older dates', () => {
    const now = new Date('2026-08-18T12:00:00')
    expect(isFreshHealthDate('2026-08-18', 1, now)).toBe(true)
    expect(isFreshHealthDate('2026-08-17', 1, now)).toBe(true)
    expect(isFreshHealthDate('2026-08-16', 1, now)).toBe(false)
  })
})

describe('getFreshWearableSnapshot', () => {
  it('hides stale health readings from four days ago', () => {
    const snapshot = getFreshWearableSnapshot({
      temps: [{ date: '2026-08-14', value: 36.7 }],
      restingHRDaily: [{ date: '2026-08-14', value: 71 }],
      sleep: { date: '2026-08-14', hours: 7.2 },
    }, new Date('2026-08-18T12:00:00'))

    expect(snapshot.rhr).toBe(null)
    expect(snapshot.tempC).toBe(null)
    expect(snapshot.sleepHours).toBe(null)
    expect(snapshot.hasFreshData).toBe(false)
    expect(snapshot.latestDate).toBe('2026-08-14')
  })

  it('keeps overnight signals from yesterday but requires today for heart rate', () => {
    const snapshot = getFreshWearableSnapshot({
      temps: [{ date: '2026-08-17', value: 36.63 }],
      restingHRDaily: [{ date: '2026-08-17', value: 64 }],
      sleep: { date: '2026-08-18', hours: 7.26 },
    }, new Date('2026-08-18T12:00:00'))

    expect(snapshot.rhr).toBe(null)
    expect(snapshot.rhrFresh).toBe(false)
    expect(snapshot.tempC).toBe(36.6)
    expect(snapshot.sleepHours).toBe(7.3)
    expect(snapshot.hasFreshData).toBe(true)
    expect(snapshot.freshestDate).toBe('2026-08-18')
  })

  it('shows a heart-rate value when Apple Health has a reading today', () => {
    const snapshot = getFreshWearableSnapshot({
      restingHRDaily: [{ date: '2026-08-18', value: 64 }],
    }, new Date('2026-08-18T12:00:00'))

    expect(snapshot.rhr).toBe(64)
    expect(snapshot.rhrFresh).toBe(true)
  })
})
