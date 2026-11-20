import { describe, expect, it } from 'vitest'
import { getLoggedSymptomRelief } from './loggedSymptomRelief.js'

describe('getLoggedSymptomRelief', () => {
  it('uses the most recent logged symptom focus first', () => {
    expect(getLoggedSymptomRelief({
      personalisedFocus: { focus: 'cramping', reason: 'You logged cramps recently.' },
      symptomPatterns: { patterns: [{ symptom: 'Headache', kind: 'cyclical', occurrences: 8, cyclesSpanned: 3, windowPhrase: 'around ovulation' }] },
    })).toEqual({ focus: 'cramping', reason: 'You logged cramps recently.', source: 'recent' })
  })

  it('uses a repeated logged symptom pattern when there is no current symptom', () => {
    const result = getLoggedSymptomRelief({
      symptomPatterns: { patterns: [{ symptom: 'Headache', kind: 'emerging', occurrences: 5, cyclesSpanned: 3, windowPhrase: 'in the second half of your cycle' }] },
    })
    expect(result.focus).toBe('headache')
    expect(result.source).toBe('pattern')
    expect(result.reason).toContain('5 times across 3 cycles')
  })

  it('does not invent a food-relief target for an unmapped symptom', () => {
    expect(getLoggedSymptomRelief({
      symptomPatterns: { patterns: [{ symptom: 'Dizziness', kind: 'cyclical', occurrences: 5, cyclesSpanned: 3, windowPhrase: 'around ovulation' }] },
    })).toBeNull()
  })
})
