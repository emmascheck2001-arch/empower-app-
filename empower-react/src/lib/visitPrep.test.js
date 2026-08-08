import { describe, it, expect } from 'vitest'
import { buildVisitSummary, summaryToText } from './visitPrep.js'

// Helper: a day-N-ago log
function log(dateStr, fields) { return { log_date: dateStr, ...fields } }

describe('buildVisitSummary', () => {
  it('handles no data without throwing and reports hasData=false', () => {
    const r = buildVisitSummary({ profile: {}, logs: [] })
    expect(r.hasData).toBe(false)
    expect(r.symptoms).toEqual([])
    expect(r.patternsToRaise).toEqual([])
  })

  it('labels life stage by user_path', () => {
    expect(buildVisitSummary({ profile: { user_path: '4' } }).snapshot.lifeStage).toMatch(/perimenopause/i)
    expect(buildVisitSummary({ profile: { user_path: '6' } }).snapshot.lifeStage).toMatch(/pregnancy/i)
    expect(buildVisitSummary({ profile: { user_path: '1' } }).snapshot.lifeStage).toMatch(/natural cycle/i)
  })

  it('surfaces severe pain as a symptom and a pattern to raise', () => {
    const logs = [
      log('2026-06-01', { pain_rating: 5, flow_volume: 'Heavy' }),
      log('2026-06-02', { pain_rating: 4 }),
    ]
    const r = buildVisitSummary({ profile: { user_path: '1' }, logs, todayStr: '2026-06-02' })
    // Wording softened (no longer labels it "severe"), but 4+/5 pain must still surface.
    expect(r.symptoms.some(s => /pain affecting daily life|pain.*4\+/i.test(s.label))).toBe(true)
    expect(r.patternsToRaise.some(p => /pain/i.test(p))).toBe(true)
  })

  it('never names a condition in patternsToRaise', () => {
    const logs = Array.from({ length: 6 }, (_, i) => log(`2026-06-0${i + 1}`, { pain_rating: 5, flow_volume: 'Very heavy', energy: 'Very low' }))
    const r = buildVisitSummary({ profile: { user_path: '1' }, logs, todayStr: '2026-06-06', cycleData: { cycle_length: 40 } })
    const text = r.patternsToRaise.join(' ').toLowerCase()
    for (const banned of ['pcos', 'endometriosis', 'adenomyosis', 'fibroid', 'cancer'])
      expect(text).not.toContain(banned)
  })

  it('recommends an iron panel when heavy flow or persistent low energy is present', () => {
    const logs = [
      log('2026-06-01', { flow_volume: 'Heavy' }),
      log('2026-06-02', { energy: 'Low' }),
      log('2026-06-03', { energy: 'Very low' }),
    ]
    const r = buildVisitSummary({ profile: { user_path: '3' }, logs, todayStr: '2026-06-03' })
    // Softened from "Full iron panel including ferritin" to a non-prescriptive iron-studies prompt.
    expect(r.tests.some(t => /iron/i.test(t))).toBe(true)
  })

  it('gives perimenopause-specific questions and tests for path 4', () => {
    const r = buildVisitSummary({ profile: { user_path: '4' }, logs: [log('2026-06-01', { hot_flash_count: 5 })], todayStr: '2026-06-01' })
    // Questions/tests reworded to be non-prescriptive (no directive "hormone therapy"/"FSH"),
    // but must still be perimenopause-specific for path 4.
    expect(r.questions.some(q => /perimenopause|treatment options|bone/i.test(q))).toBe(true)
    expect(r.tests.some(t => /perimenopause|testing|iron/i.test(t))).toBe(true)
  })

  it('computes age from birth_year', () => {
    const r = buildVisitSummary({ profile: { user_path: '1', birth_year: 1990 }, logs: [log('2026-06-01', {})], todayStr: '2026-06-01' })
    expect(r.snapshot.ageText).toBe('36 years old')
  })

  it('is order-independent (sorts logs internally)', () => {
    const a = buildVisitSummary({ profile: { user_path: '1' }, logs: [log('2026-06-01', { pain_rating: 5 }), log('2026-06-05', { pain_rating: 4 })], todayStr: '2026-06-05' })
    const b = buildVisitSummary({ profile: { user_path: '1' }, logs: [log('2026-06-05', { pain_rating: 4 }), log('2026-06-01', { pain_rating: 5 })], todayStr: '2026-06-05' })
    expect(a.snapshot.trackingSpanText).toBe(b.snapshot.trackingSpanText)
  })
})

describe('summaryToText', () => {
  it('produces shareable text with the key headings', () => {
    const r = buildVisitSummary({ profile: { user_path: '4', name: 'Sam' }, logs: [log('2026-06-01', { hot_flash_count: 3, brain_fog_rating: 4 })], todayStr: '2026-06-01' })
    const text = summaryToText(r, { name: 'Sam', user_path: '4' })
    expect(text).toMatch(/VISIT SUMMARY/)
    expect(text).toMatch(/QUESTIONS TO ASK/)
    expect(text).toMatch(/not medical advice/i)
  })
  it('returns empty string for null summary', () => {
    expect(summaryToText(null)).toBe('')
  })
})
