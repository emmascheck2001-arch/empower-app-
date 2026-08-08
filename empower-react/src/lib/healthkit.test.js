import { describe, expect, it } from 'vitest'
import { sleepHoursLastNight } from './healthkit'

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
