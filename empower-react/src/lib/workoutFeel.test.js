import { describe, it, expect } from 'vitest'
import { normaliseFeel, didTrain, feelScore, isHard, isStrong, isRest,
         feelLabel, feelEmoji, CANONICAL } from './workoutFeel'

// The exact values found in the live database across 58 logged training days.
const LIVE_VALUES = ['Felt average', 'Skipped', 'Felt strong', 'Average', 'Stronger than usual',
                     'Rest day', 'Felt hard', 'Good', 'yoga', 'Weaker than usual']

describe('normaliseFeel', () => {
  it('translates BOTH legacy vocabularies onto the canonical set', () => {
    expect(normaliseFeel('Felt strong')).toBe('Stronger than usual')
    expect(normaliseFeel('Felt average')).toBe('Average')
    expect(normaliseFeel('Felt hard')).toBe('Weaker than usual')
    expect(normaliseFeel('Stronger than usual')).toBe('Stronger than usual')
  })

  it('is case- and whitespace-tolerant', () => {
    expect(normaliseFeel('  FELT STRONG ')).toBe('Stronger than usual')
    expect(normaliseFeel('rest day')).toBe('Rest day')
  })

  it('maps the ambiguous "Good" to neutral rather than inflating it', () => {
    expect(normaliseFeel('Good')).toBe('Average')
  })

  it('refuses to guess at an unrecognised value', () => {
    expect(normaliseFeel('yoga')).toBe(null)
    expect(normaliseFeel('')).toBe(null)
    expect(normaliseFeel(null)).toBe(null)
    expect(normaliseFeel(undefined)).toBe(null)
  })

  it('every canonical value maps to itself', () => {
    for (const c of CANONICAL) expect(normaliseFeel(c)).toBe(c)
  })
})

describe('didTrain', () => {
  it('counts a session however it was worded', () => {
    for (const v of ['Felt strong', 'Felt average', 'Felt hard', 'Average', 'Stronger than usual', 'Weaker than usual', 'Good']) {
      expect(didTrain(v)).toBe(true)
    }
  })

  it('does not count rest or a skipped day', () => {
    expect(didTrain('Rest day')).toBe(false)
    expect(didTrain('Skipped')).toBe(false)
    expect(didTrain('rest')).toBe(false)
  })

  it('counts an ungradeable entry as training — she still did something', () => {
    expect(didTrain('yoga')).toBe(true)
  })

  it('does not count an absent or blank entry', () => {
    expect(didTrain(null)).toBe(false)
    expect(didTrain('')).toBe(false)
    expect(didTrain('   ')).toBe(false)
  })
})

describe('feelScore and the helpers the engines use', () => {
  it('THE BUG: a hard session is now counted from EITHER vocabulary', () => {
    // algorithm_v3 previously matched ['Felt hard','Hard'] only, so a daily-log user's
    // 'Weaker than usual' never registered as a hard session.
    expect(isHard('Felt hard')).toBe(true)
    expect(isHard('Weaker than usual')).toBe(true)
  })

  it('THE BUG: a strong session is now counted from EITHER vocabulary', () => {
    // hormoneSync previously matched 'Stronger than usual' only, so nothing logged in the
    // workout player ever triggered its insight.
    expect(isStrong('Stronger than usual')).toBe(true)
    expect(isStrong('Felt strong')).toBe(true)
  })

  it('scores in a consistent direction', () => {
    expect(feelScore('Felt hard')).toBeLessThan(feelScore('Felt average'))
    expect(feelScore('Felt average')).toBeLessThan(feelScore('Felt strong'))
  })

  it('gives no score to something it cannot grade', () => {
    expect(feelScore('yoga')).toBe(null)
    expect(feelScore('Rest day')).toBe(null)
    expect(isHard('yoga')).toBe(false)
    expect(isStrong(null)).toBe(false)
  })

  it('isRest identifies rest in both vocabularies', () => {
    expect(isRest('Rest day')).toBe(true)
    expect(isRest('Skipped')).toBe(true)
    expect(isRest('Felt strong')).toBe(false)
  })
})

describe('display', () => {
  it('labels every live value without ever showing a blank', () => {
    for (const v of LIVE_VALUES) {
      expect(feelLabel(v)).toBeTruthy()
      expect(feelEmoji(v)).toBeTruthy()
    }
  })

  it('preserves what she actually wrote when we cannot grade it', () => {
    expect(feelLabel('yoga')).toBe('Yoga')
  })

  it('returns null rather than an empty label', () => {
    expect(feelLabel(null)).toBe(null)
    expect(feelLabel('  ')).toBe(null)
  })
})

describe('every value in the live database is handled', () => {
  it('does not throw, and grades or honestly declines each one', () => {
    for (const v of LIVE_VALUES) {
      expect(() => normaliseFeel(v)).not.toThrow()
      const n = normaliseFeel(v)
      expect(n === null || CANONICAL.includes(n)).toBe(true)
    }
  })
})
