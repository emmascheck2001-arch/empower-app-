import { describe, it, expect } from 'vitest'
import { interpretHormones, HORMONE_REFERENCE_RANGES } from './hormoneSync'

// Regulatory boundary tests. interpretHormones reports logged values against published
// population ranges and must not draw a clinical conclusion or infer ovulation.
// If these fail, interpretation was reintroduced — see the note on the function.
describe('interpretHormones', () => {
  it('returns null when nothing is logged', () => {
    expect(interpretHormones(null)).toBeNull()
    expect(interpretHormones({})).toBeNull()
    expect(interpretHormones({ hormone_progesterone: '' })).toBeNull()
  })

  it('returns the logged value with its unit and reference bands', () => {
    const r = interpretHormones({ hormone_progesterone: '28.5' })
    expect(r.values).toHaveLength(1)
    expect(r.values[0]).toMatchObject({ key: 'progesterone', label: 'Progesterone', value: 28.5, unit: 'nmol/L' })
    expect(r.values[0].bands.length).toBeGreaterThan(0)
  })

  it('handles several hormones at once, in a stable order', () => {
    const r = interpretHormones({ hormone_lh: '12', hormone_progesterone: '3', hormone_estradiol: '450' })
    expect(r.values.map(v => v.key)).toEqual(['progesterone', 'lh', 'estradiol'])
  })

  it('ignores unparseable values rather than throwing', () => {
    expect(() => interpretHormones({ hormone_lh: 'abc', hormone_progesterone: null })).not.toThrow()
    expect(interpretHormones({ hormone_lh: 'abc' })).toBeNull()
  })

  it('draws no clinical conclusion and infers no ovulation', () => {
    // A mid-luteal-range progesterone is the value that previously produced
    // "supports that ovulation happened this cycle" and set ovulationConfirmed.
    const r = interpretHormones({ hormone_progesterone: '28.5', hormone_lh: '12', hormone_estradiol: '900' })
    expect(r.ovulationConfirmed).toBeUndefined()
    expect(r.lhSurge).toBeUndefined()
    const surfaced = JSON.stringify(r).toLowerCase()
    for (const term of ['ovulation happened', 'confirms', 'surge is', 'no surge detected', 'consistent with']) {
      expect(surfaced).not.toContain(term)
    }
  })

  it('tells the user to check units, since US labs use different scales', () => {
    const r = interpretHormones({ hormone_progesterone: '10' })
    expect(r.unitNote).toMatch(/ng\/mL/)
    expect(r.unitNote).toMatch(/pg\/mL/)
  })

  it('every reference range declares a unit and at least one band', () => {
    for (const [key, ref] of Object.entries(HORMONE_REFERENCE_RANGES)) {
      expect(ref.unit, key).toBeTruthy()
      expect(ref.field, key).toMatch(/^hormone_/)
      expect(ref.bands.length, key).toBeGreaterThan(0)
    }
  })
})
