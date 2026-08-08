import { describe, expect, it } from 'vitest'
import { mergePeriodStartsNotes, parsePeriodStarts, removePeriodStartNotes } from './hormoneSync.js'

describe('period start history', () => {
  it('preserves prior starts when a new or older start is added', () => {
    const notes = mergePeriodStartsNotes(JSON.stringify({ periodStarts:['2026-06-01'] }), '2026-07-01', '2026-05-02')
    expect(parsePeriodStarts({ notes, last_period_date:'2026-07-01' })).toEqual(['2026-05-02','2026-06-01','2026-07-01'])
  })

  it('removes a mistaken start and moves the latest anchor back', () => {
    const result = removePeriodStartNotes(JSON.stringify({ periodStarts:['2026-05-02','2026-06-01','2026-07-01'] }), '2026-07-01', '2026-07-01')
    expect(result.periodStarts).toEqual(['2026-05-02','2026-06-01'])
    expect(result.lastPeriodDate).toBe('2026-06-01')
  })

  it('allows all starts to be removed without fabricating an anchor', () => {
    const result = removePeriodStartNotes(null, '2026-07-01', '2026-07-01')
    expect(result.periodStarts).toEqual([])
    expect(result.lastPeriodDate).toBeNull()
  })
})
