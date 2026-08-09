import { describe, it, expect } from 'vitest'
import { derivePeriodLengthsFromFlow, getPhase, mergePeriodLengthNotes, mergePeriodStartsNotes, parsePeriodLengths, parsePeriodStarts, resolvePeriodLengths } from './hormoneSync'

// Regression: cycle_data holds ONE period_length for the whole user, so marking a 3-day period
// ended redrew every earlier cycle on the calendar as 3 days. Lengths are now per cycle.
describe('per-cycle period lengths', () => {
  const starts = ['2026-06-18', '2026-07-05', '2026-08-06']

  it('rebuilds each cycle its own length from logged flow', () => {
    const logs = [
      { log_date: '2026-06-18', flow_volume: 'Moderate' },
      // 06-19 not logged: a single skipped day is bridged, not treated as the period ending
      { log_date: '2026-06-20', flow_volume: 'Light' },
      { log_date: '2026-06-21', flow_volume: 'Light' },
      { log_date: '2026-06-22', flow_volume: 'Light' },
      { log_date: '2026-07-05', flow_volume: 'Light' },
      { log_date: '2026-07-06', flow_volume: 'Light' },
      { log_date: '2026-08-06', flow_volume: 'Moderate' },
      { log_date: '2026-08-07', flow_volume: 'Heavy' },
      { log_date: '2026-08-08', flow_volume: 'Light' },
    ]
    expect(derivePeriodLengthsFromFlow(logs, starts)).toEqual({
      '2026-06-18': 5,
      '2026-07-05': 2,
      '2026-08-06': 3,
    })
  })

  it('never attributes one cycle\'s bleed days to another', () => {
    const logs = [
      { log_date: '2026-07-05', flow_volume: 'Light' },
      { log_date: '2026-08-06', flow_volume: 'Heavy' },
    ]
    expect(derivePeriodLengthsFromFlow(logs, starts)).toEqual({
      '2026-07-05': 1,
      '2026-08-06': 1,
    })
  })

  it('ignores days flow was explicitly "None"', () => {
    const logs = [
      { log_date: '2026-08-06', flow_volume: 'Moderate' },
      { log_date: '2026-08-07', flow_volume: 'None' },
    ]
    expect(derivePeriodLengthsFromFlow(logs, ['2026-08-06'])).toEqual({ '2026-08-06': 1 })
  })

  it('recording a new period length leaves every earlier cycle untouched', () => {
    let notes = JSON.stringify({ periodStarts: starts, periodLengths: { '2026-06-18': 5, '2026-07-05': 2 } })
    notes = mergePeriodLengthNotes(notes, '2026-08-06', '2026-08-06', 3)
    expect(parsePeriodLengths({ notes })).toEqual({
      '2026-06-18': 5,
      '2026-07-05': 2,
      '2026-08-06': 3,
    })
  })

  it('keeps period starts and lengths intact through either merge helper', () => {
    let notes = JSON.stringify({ periodStarts: ['2026-06-18'], periodLengths: { '2026-06-18': 5 } })
    notes = mergePeriodStartsNotes(notes, '2026-06-18', '2026-07-05')
    expect(parsePeriodLengths({ notes })).toEqual({ '2026-06-18': 5 })
    notes = mergePeriodLengthNotes(notes, '2026-07-05', '2026-07-05', 2)
    expect(parsePeriodStarts({ notes })).toEqual(['2026-06-18', '2026-07-05'])
    expect(parsePeriodLengths({ notes })).toEqual({ '2026-06-18': 5, '2026-07-05': 2 })
  })

  it('keeps the active cycle menstrual when live flow has extended past the stale scalar length', () => {
    const cycleData = {
      last_period_date: '2026-08-06',
      period_length: 3,
      notes: JSON.stringify({ periodStarts: starts, periodLengths: { '2026-06-18': 5, '2026-07-05': 2 } }),
    }
    const logs = [
      { log_date: '2026-08-06', flow_volume: 'Moderate' },
      { log_date: '2026-08-07', flow_volume: 'Heavy' },
      { log_date: '2026-08-08', flow_volume: 'Light' },
      { log_date: '2026-08-09', flow_volume: 'Light' },
    ]
    const { periodLengths, current } = resolvePeriodLengths(cycleData, logs)
    expect(periodLengths['2026-08-06']).toBe(4)
    expect(current).toBe(4)
    expect(getPhase(4, 25, current)).toBe('Menstrual')
  })

  it('tolerates rows with no notes or non-JSON notes', () => {
    expect(parsePeriodLengths(null)).toEqual({})
    expect(parsePeriodLengths({ notes: 'just a note' })).toEqual({})
    expect(derivePeriodLengthsFromFlow([], starts)).toEqual({})
    expect(derivePeriodLengthsFromFlow([{ log_date: '2026-08-06', flow_volume: 'Light' }], [])).toEqual({})
  })
})
