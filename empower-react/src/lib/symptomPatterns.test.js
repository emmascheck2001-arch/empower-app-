import { describe, it, expect } from 'vitest'
import { analyzeLogPattern, analyzeMoodPatterns, analyzeSymptomPatterns } from './symptomPatterns.js'

const LP = '2026-01-01'
// analyzeSymptomPatterns now anchors each log to the user's recorded period-start HISTORY
// (via cycleInfoForDate), not a single last_period_date projected forward. So the test cycle
// data carries the real starts for cycles 0..3 (every 28 days from LP) in notes.periodStarts.
const PERIOD_STARTS = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26']
const cycleData = { last_period_date: LP, cycle_length: 28, notes: JSON.stringify({ periodStarts: PERIOD_STARTS }) }

function fmt(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
// A log placed at a specific cycle number + cycle day from the anchor period.
function at(cycleN, cd, symptoms) {
  const d = new Date(LP + 'T00:00:00'); d.setDate(d.getDate() + cycleN * 28 + (cd - 1))
  return { log_date: fmt(d), symptoms }
}
// Filler logs with no notable symptoms, to satisfy the "enough logging overall" gate.
function filler(n) {
  const out = []
  for (let i = 0; i < n; i++) out.push(at(Math.floor(i / 6), (i % 6) * 4 + 2, []))
  return out
}

describe('analyzeSymptomPatterns — honesty gates', () => {
  it('returns no_cycle when there is no period anchor', () => {
    expect(analyzeSymptomPatterns({ logs: [], cycleData: null }).status).toBe('no_cycle')
    expect(analyzeSymptomPatterns({ logs: [at(0, 14, ['Headache'])], cycleData: {} }).status).toBe('no_cycle')
  })

  it('returns insufficient when there is not enough logging yet', () => {
    const logs = [at(0, 14, ['Headache']), at(1, 14, ['Headache'])]
    expect(analyzeSymptomPatterns({ logs, cycleData }).status).toBe('insufficient')
  })

  it('returns insufficient when many logs span less than ~2 cycles of calendar time', () => {
    // 16 logs but all inside a single cycle -> not enough calendar span to claim timing.
    const logs = []
    for (let i = 0; i < 16; i++) logs.push(at(0, i + 1, i % 3 === 0 ? ['Headache'] : []))
    expect(analyzeSymptomPatterns({ logs, cycleData }).status).toBe('insufficient')
  })

  it('merges old label "Cramps" with current "Cramping"', () => {
    const logs = [
      at(0, 2, ['Cramps']), at(1, 2, ['Cramping']), at(2, 3, ['Cramps']), at(0, 3, ['Cramping']),
      ...filler(12),
    ]
    const r = analyzeSymptomPatterns({ logs, cycleData })
    // Combined they reach the 4-occurrence bar under one name.
    expect(r.patterns.find(p => p.symptom === 'Cramping')).toBeTruthy()
    expect(r.patterns.find(p => p.symptom === 'Cramps')).toBeUndefined()
  })

  it('does NOT report a symptom logged fewer than 4 times', () => {
    const logs = [at(0, 14, ['Headache']), at(1, 14, ['Headache']), at(2, 14, ['Headache']), ...filler(14)]
    const r = analyzeSymptomPatterns({ logs, cycleData })
    expect(r.patterns.find(p => p.symptom === 'Headache')).toBeUndefined()
  })

  it('does NOT report a symptom that only spans a single cycle', () => {
    // 4 headaches, all in cycle 0
    const logs = [at(0, 12, ['Headache']), at(0, 13, ['Headache']), at(0, 14, ['Headache']), at(0, 15, ['Headache']), ...filler(14)]
    const r = analyzeSymptomPatterns({ logs, cycleData })
    expect(r.patterns.find(p => p.symptom === 'Headache')).toBeUndefined()
  })
})

describe('analyzeSymptomPatterns — real patterns', () => {
  it('detects a cyclical pattern clustered around ovulation', () => {
    const logs = [
      at(0, 14, ['Headache']), at(1, 14, ['Headache']), at(2, 14, ['Headache']),
      at(0, 13, ['Headache']), at(1, 15, ['Headache']),
      ...filler(12),
    ]
    const r = analyzeSymptomPatterns({ logs, cycleData })
    const p = r.patterns.find(x => x.symptom === 'Headache')
    expect(p.kind).toBe('cyclical')
    expect(p.windowPhrase).toMatch(/ovulation/i)
    expect(p.cyclesSpanned).toBeGreaterThanOrEqual(2)
    expect(r.summary.join(' ')).toMatch(/tended to show up/i)
    expect(r.summary.join(' ')).toMatch(/not a diagnosis/i)
    expect(r.summary.join(' ')).not.toMatch(/causes/i)  // never causal
  })

  it('calls a scattered symptom "unrelated" and points to a provider', () => {
    const logs = [
      at(0, 3, ['Headache']), at(0, 10, ['Headache']), at(1, 14, ['Headache']),
      at(1, 20, ['Headache']), at(2, 26, ['Headache']), at(2, 8, ['Headache']),
      ...filler(12),
    ]
    const r = analyzeSymptomPatterns({ logs, cycleData })
    const p = r.patterns.find(x => x.symptom === 'Headache')
    expect(p.kind).toBe('unrelated')
    expect(r.summary.join(' ')).toMatch(/mentioning to your provider/i)
    expect(r.summary.join(' ')).not.toMatch(/tended to show up/i)
  })

  it('detects a period-clustered symptom as "during your period"', () => {
    const logs = [
      at(0, 1, ['Cramping']), at(0, 2, ['Cramping']), at(1, 1, ['Cramping']),
      at(1, 2, ['Cramping']), at(2, 3, ['Cramping']),
      ...filler(12),
    ]
    const r = analyzeSymptomPatterns({ logs, cycleData })
    const p = r.patterns.find(x => x.symptom === 'Cramping')
    expect(p.kind).toBe('cyclical')
    expect(p.windowPhrase).toMatch(/during your period/i)
  })

  it('labels a repeated but not yet conclusive symptom trend as emerging', () => {
    const logs = [
      at(0, 8, ['Headache']), at(1, 9, ['Headache']), at(2, 10, ['Headache']), at(3, 11, ['Headache']),
      at(0, 19, ['Headache']), at(1, 20, ['Headache']), at(2, 21, ['Headache']), at(3, 22, ['Headache']),
      ...filler(14),
    ]
    const r = analyzeSymptomPatterns({ logs, cycleData })
    const p = r.patterns.find(x => x.symptom === 'Headache')
    expect(p.kind).toBe('emerging')
    expect(p.dominantPct).toBe(50)
  })

  it('returns no_pattern when there is enough data but nothing qualifies', () => {
    const r = analyzeSymptomPatterns({ logs: filler(16), cycleData })
    expect(r.status).toBe('no_pattern')
    expect(r.patterns).toEqual([])
  })

  it('ignores "None" and does not throw on messy logs', () => {
    const logs = [{ log_date: '2026-01-05', symptoms: ['None'] }, { log_date: '2026-01-06', symptoms: null }, {}, ...filler(14)]
    expect(() => analyzeSymptomPatterns({ logs, cycleData })).not.toThrow()
  })
})

describe('analyzeMoodPatterns', () => {
  it('finds a repeated mood pattern using the same conservative evidence gates', () => {
    const logs = [
      at(0, 26, []), at(1, 27, []), at(2, 26, []), at(3, 27, []),
      at(0, 10, []), at(1, 10, []), at(2, 10, []), at(3, 10, []),
      ...filler(14),
    ]
    logs.slice(0, 4).forEach(log => { log.mood = ['Irritable'] })
    logs.slice(4, 8).forEach(log => { log.mood = ['Calm'] })
    const r = analyzeMoodPatterns({ logs, cycleData })
    const irritable = r.patterns.find(x => x.mood === 'Irritable')
    expect(irritable.kind).toBe('cyclical')
    expect(irritable.windowPhrase).toMatch(/before your period/i)
  })
})

describe('analyzeLogPattern', () => {
  it('finds a repeated low-energy pattern using the same evidence rules as symptoms', () => {
    const logs = [
      at(0, 26, ['None']), at(1, 27, ['None']), at(2, 26, ['None']), at(2, 27, ['None']),
      ...filler(12),
    ].map((log, index) => index < 4 ? { ...log, energy: 'Low' } : { ...log, energy: 'Normal' })

    const result = analyzeLogPattern({ logs, cycleData, predicate: log => log.energy === 'Low' })
    expect(result.status).toBe('cyclical')
    expect(result.windowPhrase).toMatch(/before your period/i)
    expect(result.occurrences).toBe(4)
  })

  it('reports a scattered result rather than inventing a phase', () => {
    const logs = [
      at(0, 3, ['None']), at(0, 10, ['None']), at(1, 15, ['None']), at(1, 20, ['None']),
      at(2, 8, ['None']), at(2, 24, ['None']), ...filler(12),
    ].map((log, index) => index < 6 ? { ...log, sleep_quality: 'Poor' } : { ...log, sleep_quality: 'Good' })

    const result = analyzeLogPattern({ logs, cycleData, predicate: log => log.sleep_quality === 'Poor' })
    expect(result.status).toBe('scattered')
    expect(result.windowPhrase).toBeUndefined()
  })
})
