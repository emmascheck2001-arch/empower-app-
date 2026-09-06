import { describe, it, expect } from 'vitest'
import { buildLogDelta, confirmationLine } from './logDelta'

const status = (o = {}) => ({
  confidence: 0.5, phase: 'Luteal', estimated: false,
  nextPeriodPrediction: { predictedDate: new Date('2026-09-14T00:00:00'),
    windowStart: new Date('2026-09-12T00:00:00'), windowEnd: new Date('2026-09-16T00:00:00') },
  ...o,
})

describe('buildLogDelta', () => {
  it('is honest when nothing changed', () => {
    const d = buildLogDelta(status(), status())
    expect(d.confirmed).toBe(true)
    expect(d.changes).toHaveLength(0)
    expect(d.headline).toMatch(/matched/i)
  })

  it('reports the real before and after confidence, not a flattering one', () => {
    const d = buildLogDelta(status({ confidence: 0.62 }), status({ confidence: 0.71 }))
    expect(d.changes.find(c => c.kind === 'confidence').text).toContain('62% → 71%')
  })

  it('never fabricates a rise when confidence did not move', () => {
    const d = buildLogDelta(status({ confidence: 0.7 }), status({ confidence: 0.7 }))
    expect(d.changes.find(c => c.kind === 'confidence')).toBeUndefined()
  })

  it('names a moved period prediction with both dates', () => {
    const after = status({ nextPeriodPrediction: { predictedDate: new Date('2026-09-13T00:00:00'),
      windowStart: new Date('2026-09-11T00:00:00'), windowEnd: new Date('2026-09-15T00:00:00') } })
    const d = buildLogDelta(status(), after)
    const c = d.changes.find(x => x.kind === 'prediction')
    expect(c.text).toMatch(/Sep 14/); expect(c.text).toMatch(/Sep 13/)
  })

  it('celebrates a narrowing window, and only when it genuinely narrowed', () => {
    const tighter = status({ nextPeriodPrediction: { predictedDate: new Date('2026-09-14T00:00:00'),
      windowStart: new Date('2026-09-13T00:00:00'), windowEnd: new Date('2026-09-15T00:00:00') } })
    expect(buildLogDelta(status(), tighter).changes.some(c => c.kind === 'window')).toBe(true)
    const wider = status({ nextPeriodPrediction: { predictedDate: new Date('2026-09-14T00:00:00'),
      windowStart: new Date('2026-09-10T00:00:00'), windowEnd: new Date('2026-09-18T00:00:00') } })
    expect(buildLogDelta(status(), wider).changes.some(c => c.kind === 'window')).toBe(false)
  })

  it('announces a first-ever prediction', () => {
    const d = buildLogDelta(status({ nextPeriodPrediction: null }), status())
    expect(d.changes.some(c => c.kind === 'prediction')).toBe(true)
  })

  it('names a phase change and an estimate becoming confirmed', () => {
    expect(buildLogDelta(status({ phase: 'Follicular' }), status({ phase: 'Ovulatory' }))
      .changes.some(c => c.kind === 'phase')).toBe(true)
    expect(buildLogDelta(status({ estimated: true }), status({ estimated: false }))
      .changes.some(c => c.text.match(/anchored/))).toBe(true)
  })

  it('grades its own energy prediction both ways', () => {
    const hit = buildLogDelta(status(), status(), { energyPrediction: { word: 'Low' }, loggedEnergy: 'Low' })
    expect(hit.changes.find(c => c.kind === 'score').text).toMatch(/called it/i)
    const miss = buildLogDelta(status(), status(), { energyPrediction: { word: 'High' }, loggedEnergy: 'Low' })
    expect(miss.changes.find(c => c.kind === 'score').text).toMatch(/improves the next guess/i)
  })

  it('lists newly unlocked insights', () => {
    const d = buildLogDelta(status(), status(), { newlyUnlocked: ['Your cycle story'] })
    expect(d.changes.some(c => c.kind === 'unlock' && c.text.includes('Your cycle story'))).toBe(true)
  })

  it('never throws on missing input', () => {
    expect(() => buildLogDelta(null, null)).not.toThrow()
    expect(buildLogDelta(null, status()).changes.length).toBeGreaterThanOrEqual(0)
  })

  it('treats a confirmation as a real outcome, not an apology', () => {
    expect(confirmationLine(0)).toMatch(/steady|holding/i)
    expect(confirmationLine(3)).toMatch(/three days/i)
  })
})
