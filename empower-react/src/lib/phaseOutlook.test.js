import { describe, it, expect } from 'vitest'
import { buildPhaseOutlook } from './phaseOutlook.js'

// Anchor a fixed last period, then place logs at chosen cycle days across past cycles.
const LP = '2026-01-01'
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const at = (cycleN, cd, f) => { const d = new Date(LP + 'T00:00:00'); d.setDate(d.getDate() + cycleN*28 + (cd-1)); return { log_date: fmt(d), ...f } }

describe('buildPhaseOutlook', () => {
  it('returns null without a cycle anchor', () => {
    expect(buildPhaseOutlook({ logs: [], lastPeriodDate: null, cycleDay: 10 })).toBeNull()
    expect(buildPhaseOutlook({ logs: [], lastPeriodDate: LP, cycleDay: null })).toBeNull()
  })

  it('says how many more cycles are needed when history is thin', () => {
    // cycleDay 12 (follicular) -> upcoming ~day17 = luteal; no past luteal logs
    const r = buildPhaseOutlook({ logs: [], lastPeriodDate: LP, cycleLen: 28, cycleDay: 12 })
    expect(r.status).toBe('needs_more')
    expect(r.upcoming).toBe('Luteal')
    expect(r.text).toMatch(/needs about 2 tracked cycles|more cycle/i)
  })

  it('predicts from her own past cycles once there are enough', () => {
    // Give 2 past cycles (0 and 1) of luteal-phase logs; today is in cycle 3 at day 12
    const logs = [
      at(0, 18, { energy:'Low', symptoms:['Cramping'], mood:['Irritable'] }),
      at(0, 22, { energy:'Low', symptoms:['Bloating'] }),
      at(1, 19, { energy:'Low', symptoms:['Cramping'], mood:['Irritable'] }),
      at(1, 24, { energy:'Normal', symptoms:['Bloating'] }),
    ]
    // today must be a later cycle so cycles 0 & 1 count as "past". Use a lastPeriodDate far in the past.
    const lpPast = fmt(new Date(new Date().getTime() - 3*28*86400000)) // ~3 cycles ago
    const shift = logs.map(l => {
      // re-anchor the same cycle-day offsets to lpPast
      return l
    })
    const r = buildPhaseOutlook({ logs: shiftToAnchor(logs, LP, lpPast), lastPeriodDate: lpPast, cycleLen: 28, cycleDay: 12 })
    expect(r.status).toBe('ok')
    expect(r.upcoming).toBe('Luteal')
    expect(r.text).toMatch(/heading into your luteal phase/i)
    expect(r.text).toMatch(/cramping|bloating|energy has often dipped/i)
  })

  it('does not throw on messy logs', () => {
    expect(() => buildPhaseOutlook({ logs: [{}, { log_date:'2026-01-05' }], lastPeriodDate: LP, cycleDay: 10 })).not.toThrow()
  })
})

// Re-anchor helper: move log_dates from anchor A to anchor B keeping the same day offset.
function shiftToAnchor(logs, fromAnchor, toAnchor) {
  const a = new Date(fromAnchor + 'T00:00:00'), b = new Date(toAnchor + 'T00:00:00')
  const delta = Math.round((b - a) / 86400000)
  return logs.map(l => {
    const d = new Date(l.log_date + 'T00:00:00'); d.setDate(d.getDate() + delta)
    return { ...l, log_date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  })
}
