import { describe, expect, it } from 'vitest'
import { detectPhaseTimingConflict } from './hormoneSync.js'

describe('phase timing conflicts', () => {
  it('flags recent egg white mucus against a mid-luteal label', () => {
    const result = detectPhaseTimingConflict({
      phase: 'Luteal',
      subPhase: 'Mid luteal',
      cycleDay: 20,
      cycleLen: 28,
      mucusLogs: [
        { log_date: '2026-08-25', discharge_type: 'Egg white' },
        { log_date: '2026-08-24', discharge_type: 'Egg white' },
      ],
      today: new Date('2026-08-25T00:00:00'),
    })

    expect(result?.type).toBe('phase_timing_conflict')
    expect(result?.text).toMatch(/mid luteal timing label/i)
  })

  it('does not flag recent egg white mucus in early luteal', () => {
    const result = detectPhaseTimingConflict({
      phase: 'Luteal',
      subPhase: 'Early luteal',
      cycleDay: 17,
      cycleLen: 28,
      mucusLogs: [
        { log_date: '2026-08-25', discharge_type: 'Egg white' },
      ],
      today: new Date('2026-08-25T00:00:00'),
    })

    expect(result).toBeNull()
  })
})
