import { describe, it, expect } from 'vitest'
import { buildWeeklyObservation } from './weeklyObservation.js'

const D = { sun:'2026-06-28', mon:'2026-06-29', tue:'2026-06-30', wed:'2026-07-01', thu:'2026-07-02', fri:'2026-07-03', sat:'2026-07-04' }
const log = (date, f) => ({ log_date: date, ...f })
const phaseAt = (cd) => (cd <= 5 ? 'Menstrual' : cd <= 12 ? 'Follicular' : cd <= 15 ? 'Ovulatory' : 'Luteal')

describe('buildWeeklyObservation', () => {
  it('surfaces the sleep→energy lever when the gap is real', () => {
    const thisWeek = [
      log(D.mon, { sleep_quality:'Good', energy:'High' }),
      log(D.tue, { sleep_quality:'Great', energy:'High' }),
      log(D.wed, { sleep_quality:'Poor', energy:'Low' }),
    ]
    expect(buildWeeklyObservation({ thisWeek })).toMatch(/slept well|sleep is one of your strongest/i)
  })

  it('surfaces training→mood when training days are clearly more positive', () => {
    const thisWeek = [
      log(D.mon, { workout_feel:'Felt strong', mood:['Happy'] }),
      log(D.tue, { workout_feel:'Felt average', mood:['Motivated'] }),
      log(D.wed, { workout_feel:'Rest day', mood:['Tired'] }),
      log(D.thu, { workout_feel:'Rest day', mood:['Irritable'] }),
    ]
    // no strong sleep/energy signal here, so training→mood should win
    expect(buildWeeklyObservation({ thisWeek })).toMatch(/trained|movement is genuinely lifting/i)
  })

  it('aligns an energy peak to the cycle phase (hormones-at-work moment)', () => {
    // Dates relative to real today (the function measures "days ago" from now).
    const ago = (n) => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
    const thisWeek = [ log(ago(4), { energy:'Low' }), log(ago(2), { energy:'High' }), log(ago(0), { energy:'Normal' }) ]
    // today cd 15 (ovulatory); the peak 2 days ago = cd 13 = still ovulatory
    const r = buildWeeklyObservation({ thisWeek, cycleDayToday: 15, cycleLen: 28, phaseAt })
    expect(r).toMatch(/highest logged energy was on/i)
    expect(r).toMatch(/ovulatory/i)
  })

  it('notes stress↔sleep tracking together', () => {
    const thisWeek = [
      log(D.mon, { stress_level:2, sleep_quality:'Good' }),
      log(D.wed, { stress_level:5, sleep_quality:'Poor' }),
      log(D.fri, { stress_level:3, sleep_quality:'Fair' }),
    ]
    expect(buildWeeklyObservation({ thisWeek })).toMatch(/most stressful day.*Wednesday|stress and sleep track/i)
  })

  it('never makes the observation about how many days were logged', () => {
    const thisWeek = [D.sun,D.mon,D.tue,D.wed,D.thu].map(d => log(d, { energy:'Normal' }))
    const r = buildWeeklyObservation({ thisWeek })
    expect(r).not.toMatch(/logged \d+ of 7|most consistent|days in a row/i)
    expect(r).toMatch(/steady|feeling you logged most/i)
  })

  it('surfaces a flat day tied to poor sleep', () => {
    const thisWeek = [
      log(D.mon, { energy:'Normal', sleep_quality:'Good' }),
      log(D.wed, { energy:'Low', sleep_quality:'Poor' }),
      log(D.fri, { energy:'Normal', sleep_quality:'Fair' }),
    ]
    expect(buildWeeklyObservation({ thisWeek })).toMatch(/flattest day.*Wednesday|sleep and energy move together/i)
  })

  it('gives an honest keep-logging line with thin data', () => {
    expect(buildWeeklyObservation({ thisWeek: [log(D.mon, { energy:'Good' })] })).toMatch(/keep logging/i)
  })

  it('does not throw on messy logs', () => {
    expect(() => buildWeeklyObservation({ thisWeek: [{}, { mood:null }, log(D.mon,{}) ] })).not.toThrow()
  })
})
