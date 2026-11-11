import { describe, expect, it } from 'vitest'
import { convertHormoneUnit, normalizeHormoneEntry, normalizeHormoneInputs } from './hormoneUnits'

describe('hormoneUnits', () => {
  it('converts estradiol between SI and US lab units', () => {
    expect(convertHormoneUnit('hormone_estradiol', '200', 'pg/mL', 'pmol/L')).toBe('734')
    expect(convertHormoneUnit('hormone_estradiol', '734', 'pmol/L', 'pg/mL')).toBe('200')
  })

  it('normalizes progesterone ng/mL to nmol/L for storage', () => {
    const result = normalizeHormoneEntry('hormone_progesterone', '10', 'ng/mL')
    expect(result.error).toBeNull()
    expect(result.value).toBeCloseTo(31.8, 2)
  })

  it('rejects implausible values for the selected unit instead of silently saving them', () => {
    const result = normalizeHormoneEntry('hormone_estradiol', '20000', 'pg/mL')
    expect(result.value).toBeNull()
    expect(result.error).toMatch(/out of range/i)
  })

  it('normalizes a mixed hormone payload and preserves blanks as null', () => {
    const result = normalizeHormoneInputs(
      { hormone_estradiol: '200', hormone_progesterone: '', hormone_lh: '12', hormone_cortisol: '18' },
      {
        hormone_estradiol: 'pg/mL',
        hormone_progesterone: 'nmol/L',
        hormone_lh: 'IU/L',
        hormone_cortisol: 'ug/dL',
      },
    )
    expect(result.errors).toEqual({})
    expect(result.values.hormone_estradiol).toBeCloseTo(734.2, 1)
    expect(result.values.hormone_progesterone).toBeNull()
    expect(result.values.hormone_lh).toBe(12)
    expect(result.values.hormone_cortisol).toBeCloseTo(496.62, 2)
  })
})
