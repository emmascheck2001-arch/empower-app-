import { describe, it, expect } from 'vitest'
import { applyWearableOvulation } from './cycleGuardian'

// Build an ISO date N days before today.
function daysAgo(n) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const confirmed = (ovDaysAgo) => ({ ovulationConfirmed: true, ovulationDate: daysAgo(ovDaysAgo), cardiovascularLutealSupport: 1 })

describe('applyWearableOvulation', () => {
  it('returns status untouched when there is no confirmed ovulation', () => {
    const status = { phase: 'Follicular', subPhase: null, cycleDay: 8, cycleLen: 28 }
    expect(applyWearableOvulation(status, { ovulationConfirmed: false })).toBe(status)
    expect(applyWearableOvulation(status, null)).toBe(status)
  })

  it('moves a mis-calendared user into the luteal phase after a confirmed shift', () => {
    // Calendar thinks she is still follicular, but the wearable confirmed ovulation 6 days ago.
    const status = { phase: 'Follicular', subPhase: null, cycleDay: 10, cycleLen: 28 }
    const out = applyWearableOvulation(status, confirmed(6))
    expect(out.phase).toBe('Luteal')
    expect(out.ovulationSource).toBe('wearable')
    expect(out.guardian.corrected).toBe(true)
    expect(out.cycleDay).toBe(14 + 6) // ovulation day (28-14) anchored + 6 days
  })

  it('reports Ovulatory on the day of / day after the shift', () => {
    const status = { phase: 'Follicular', subPhase: null, cycleDay: 13, cycleLen: 28 }
    expect(applyWearableOvulation(status, confirmed(0)).phase).toBe('Ovulatory')
    expect(applyWearableOvulation(status, confirmed(1)).phase).toBe('Ovulatory')
  })

  it('confirms without "correcting" when the calendar already agrees', () => {
    const status = { phase: 'Luteal', subPhase: 'Mid luteal', cycleDay: 20, cycleLen: 28 }
    const out = applyWearableOvulation(status, confirmed(6))
    expect(out.phase).toBe('Luteal')
    expect(out.guardian.corrected).toBe(false)
    expect(out.guardian.note).toMatch(/matches your tracked cycle/)
  })

  it('never overrides hormonal BC, pregnancy, or perimenopause', () => {
    for (const phase of ['bc-combined', 'Pregnancy', 'Perimenopause']) {
      const status = { phase, cycleLen: 28 }
      expect(applyWearableOvulation(status, confirmed(6))).toBe(status)
    }
  })

  it('ignores a stale ovulation from a previous cycle', () => {
    const status = { phase: 'Follicular', subPhase: null, cycleDay: 10, cycleLen: 28 }
    expect(applyWearableOvulation(status, confirmed(40))).toBe(status)
  })

  it('works for an irregular / no-period-date user (observation)', () => {
    const status = { phase: 'observation', subPhase: null, cycleDay: null, cycleLen: 28 }
    const out = applyWearableOvulation(status, confirmed(4))
    expect(out.phase).toBe('Luteal')
    expect(out.guardian.corrected).toBe(true)
  })
})
