import { describe, expect, it } from 'vitest'
import { calendarFocusFor } from '../lib/calendarFocus.js'
import { estimatedOvulationDayForPhase, isEstimatedFertilePhaseDay } from '../lib/calendarCycle.js'
import { getPhaseForDate } from './Calendar.jsx'

describe('Calendar question focus', () => {
  it('recognizes a headache focus and highlights only headache logs', () => {
    const focus = calendarFocusFor('headaches')
    expect(focus?.title).toBe('headache days')
    expect(focus?.matches({ symptoms:['Headache'] })).toBe(true)
    expect(focus?.matches({ symptoms:['Migraine'] })).toBe(false)
    expect(focus?.matches({ symptoms:[] })).toBe(false)
  })

  it('does not apply a focus for an ordinary calendar visit', () => {
    expect(calendarFocusFor(null)).toBeNull()
    expect(calendarFocusFor('not-a-tracked-question')).toBeNull()
  })

  it('matches the focused value for non-symptom history questions too', () => {
    expect(calendarFocusFor('poor-sleep days')?.matches({ sleep_quality:'Poor' })).toBe(true)
    expect(calendarFocusFor('poor-sleep days')?.matches({ sleep_quality:'Good' })).toBe(false)
  })

  it('keeps the fertile window aligned with a logged historical cycle, not the current average', () => {
    const firstWeek = { cycleDay:9, cycleLength:38 }
    const fertileStart = { cycleDay:19, cycleLength:38 }

    expect(isEstimatedFertilePhaseDay(firstWeek)).toBe(false)
    expect(isEstimatedFertilePhaseDay(fertileStart)).toBe(true)
  })

  it('uses a recent fertility signal only to refine the active cycle estimate', () => {
    const phaseInfo = { cycleDay:6, cycleLength:28 }
    expect(isEstimatedFertilePhaseDay(phaseInfo, 14)).toBe(false)
    expect(estimatedOvulationDayForPhase(phaseInfo, 14, 11)).toBe(11)
    expect(isEstimatedFertilePhaseDay(phaseInfo, 14, 11)).toBe(true)
  })

  it('uses learned timing again after a current-cycle signal, without reusing that signal', () => {
    const starts = ['2026-09-29']
    const today = new Date('2026-10-26T00:00:00')
    const signal = { cycleStart:'2026-09-29', ovulationDay:25, cycleLength:42, forecastCycleLength:30 }

    expect(getPhaseForDate(new Date('2026-10-22T00:00:00'), starts, 42, 5, true, today, 17, signal)?.phase).toBe('Ovulatory')
    expect(getPhaseForDate(new Date('2026-10-25T00:00:00'), starts, 42, 5, true, today, 17, signal)?.phase).toBe('Luteal')
    expect(getPhaseForDate(new Date('2026-11-10T00:00:00'), starts, 42, 5, true, today, 17, signal)).toMatchObject({ phase:'Menstrual', cycleStart:'2026-11-10', projectedCycle:true })
    expect(getPhaseForDate(new Date('2026-12-01T00:00:00'), starts, 42, 5, true, today, 17, signal)).toMatchObject({ phase:'Luteal', cycleLength:30, cycleStart:'2026-11-10', projectedCycle:true })
  })

  it('uses the established 27-day history for the November forecast when timing override is disabled', () => {
    const starts = ['2026-09-29']
    const today = new Date('2026-10-26T00:00:00')

    // September 29 + 27 days is October 26; continuing the same established interval places
    // the following projected November start on the 22nd, not the 10th from a 42-day override.
    expect(getPhaseForDate(new Date('2026-11-22T00:00:00'), starts, 27, 5, true, today, 14)).toMatchObject({
      phase: 'Menstrual',
      cycleDay: 1,
      cycleLength: 27,
      projectedCycle: true,
    })
  })
})
