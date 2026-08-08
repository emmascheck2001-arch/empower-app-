import { describe, it, expect } from 'vitest'
import { buildPhaseOutlook } from './phaseOutlook.js'

// Anchor a fixed last period, then place logs at chosen cycle days across past cycles.
const LP = '2026-01-01'
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

describe('buildPhaseOutlook', () => {
  it('returns null without a cycle anchor', () => {
    expect(buildPhaseOutlook({ logs: [], lastPeriodDate: null, cycleDay: 10 })).toBeNull()
    expect(buildPhaseOutlook({ logs: [], lastPeriodDate: LP, cycleDay: null })).toBeNull()
  })

  it('says how many more cycles are needed when history is thin', () => {
    // cycleDay 12 (follicular) -> upcoming ~day17 = luteal; no past luteal logs.
    // MIN_CYCLES is now 3, so with zero past cycles it needs about 3.
    const r = buildPhaseOutlook({ logs: [], lastPeriodDate: LP, cycleLen: 28, cycleDay: 12 })
    expect(r.status).toBe('needs_more')
    expect(r.upcoming).toBe('Luteal')
    expect(r.text).toMatch(/needs about 3 tracked cycles|more cycles/i)
  })

  it('predicts from her own past cycles once there are enough', () => {
    // buildPhaseOutlook now requires MIN_CYCLES (3) past cycles with >= 2 luteal logs each,
    // and it anchors each log via the recorded period-start history. So give explicit starts
    // for the current cycle plus 3 fully-bracketed past cycles, and 2 luteal logs per past cycle.
    const day = (base, n) => { const d = new Date(base + 'T00:00:00'); d.setDate(d.getDate() + n); return fmt(d) }
    // Current cycle anchor (today), and 4 earlier starts so the 3 past cycles each have a next start.
    const lpPast = fmt(new Date(new Date().getTime() - 30*86400000)) // ~1 cycle ago = current anchor
    const starts = [ lpPast, day(lpPast, -28), day(lpPast, -56), day(lpPast, -84), day(lpPast, -112) ]
    // Two luteal-phase logs (cycle days 18 and 22) in each of the 3 most recent PAST cycles.
    const lutealStarts = [ day(lpPast, -28), day(lpPast, -56), day(lpPast, -84) ]
    const logs = lutealStarts.flatMap((s) => [
      { log_date: day(s, 17), energy:'Low', symptoms:['Cramping'], mood:['Irritable'] }, // cycle day 18
      { log_date: day(s, 21), energy:'Low', symptoms:['Bloating'] },                     // cycle day 22
    ])
    const r = buildPhaseOutlook({ logs, lastPeriodDate: lpPast, periodStarts: starts, cycleLen: 28, cycleDay: 12 })
    expect(r.status).toBe('ok')
    expect(r.upcoming).toBe('Luteal')
    expect(r.text).toMatch(/heading into your luteal phase/i)
    expect(r.text).toMatch(/cramping|bloating|energy has often dipped/i)
  })

  it('does not throw on messy logs', () => {
    expect(() => buildPhaseOutlook({ logs: [{}, { log_date:'2026-01-05' }], lastPeriodDate: LP, cycleDay: 10 })).not.toThrow()
  })
})
