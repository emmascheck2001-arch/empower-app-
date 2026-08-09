import { describe, expect, it } from 'vitest'
import { mergePeriodStartsNotes, parsePeriodLengths, parsePeriodStarts, removePeriodStartNotes } from './hormoneSync.js'

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

  it('removing one start preserves every other saved period length', () => {
    const notes = JSON.stringify({
      periodStarts:['2026-05-02','2026-06-01','2026-07-01'],
      periodLengths:{ '2026-05-02':4, '2026-06-01':5, '2026-07-01':3 },
    })
    const result = removePeriodStartNotes(notes, '2026-07-01', '2026-06-01')
    expect(result.periodStarts).toEqual(['2026-05-02','2026-07-01'])
    expect(parsePeriodLengths({ notes: result.notes })).toEqual({ '2026-05-02':4, '2026-07-01':3 })
    expect(result.periodLength).toBe(3)
  })

  it('removing the latest start clears its length and falls back to the previous latest length', () => {
    const notes = JSON.stringify({
      periodStarts:['2026-05-02','2026-06-01','2026-07-01'],
      periodLengths:{ '2026-05-02':4, '2026-06-01':5, '2026-07-01':3 },
    })
    const result = removePeriodStartNotes(notes, '2026-07-01', '2026-07-01')
    expect(result.periodStarts).toEqual(['2026-05-02','2026-06-01'])
    expect(result.lastPeriodDate).toBe('2026-06-01')
    expect(parsePeriodLengths({ notes: result.notes })).toEqual({ '2026-05-02':4, '2026-06-01':5 })
    expect(result.periodLength).toBe(5)
  })

  it('allows all starts to be removed without fabricating an anchor', () => {
    const result = removePeriodStartNotes(null, '2026-07-01', '2026-07-01')
    expect(result.periodStarts).toEqual([])
    expect(result.lastPeriodDate).toBeNull()
    expect(result.periodLength).toBeNull()
  })
})
