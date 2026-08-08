import { describe, it, expect } from 'vitest'
import { personalisationProgress } from './hormoneSync'

describe('personalisationProgress — honest, data-driven (not confidence)', () => {
  it('is 0% with no logs and no cycles (never a misleading 50% head start)', () => {
    const p = personalisationProgress(0, 0)
    expect(p.personalisationPct).toBe(0)
    expect(p.personalisationLabel).toMatch(/general guidance/i)
  })

  it('grows with logged days', () => {
    const few = personalisationProgress(5, 0).personalisationPct
    const more = personalisationProgress(20, 0).personalisationPct
    expect(few).toBeGreaterThan(0)
    expect(more).toBeGreaterThan(few)
  })

  it('grows with completed cycles (the real personalisation signal)', () => {
    const oneCycle = personalisationProgress(0, 1).personalisationPct
    const threeCycles = personalisationProgress(0, 3).personalisationPct
    expect(threeCycles).toBeGreaterThan(oneCycle)
  })

  it('caps below 100 and is monotonic', () => {
    const maxed = personalisationProgress(999, 999).personalisationPct
    expect(maxed).toBeLessThanOrEqual(95)
    expect(maxed).toBeGreaterThanOrEqual(personalisationProgress(30, 3).personalisationPct)
  })
})
