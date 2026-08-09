import { describe, expect, it } from 'vitest'
import { inferPhaseFromSymptoms } from './hormoneSync.js'

describe('phase inference supporting signals', () => {
  it('uses temperature, resting heart rate, and dry fluid as luteal support signals', () => {
    const logs = [
      { log_date:'2026-08-09', wrist_temp:36.8, resting_hr_exact:64 },
      { log_date:'2026-08-08', wrist_temp:36.7, resting_hr_exact:63 },
      { log_date:'2026-08-07', wrist_temp:36.4, resting_hr_exact:59 },
      { log_date:'2026-08-06', wrist_temp:36.4, resting_hr_exact:60 },
      { log_date:'2026-08-05', wrist_temp:36.3, resting_hr_exact:60 },
    ]
    const mucus = [
      { log_date:'2026-08-09', discharge_type:'None or dry' },
    ]
    const result = inferPhaseFromSymptoms(logs, mucus)
    expect(result?.inferredPhase).toBe('Luteal')
    expect(result?.signals).toContain('sustained temperature rise')
  })

  it('lets a phase-specific symptom support ovulatory inference when paired with fertile mucus', () => {
    const logs = [
      { log_date:'2026-08-09', symptoms:['Ovulation pain'] },
    ]
    const mucus = [
      { log_date:'2026-08-09', discharge_type:'Egg white' },
    ]
    const result = inferPhaseFromSymptoms(logs, mucus)
    expect(result?.inferredPhase).toBe('Ovulatory')
    expect(result?.signals).toContain('ovulation pain logged')
  })

  it('does not trust temperature or resting heart rate when acute confounders are logged', () => {
    const logs = [
      { log_date:'2026-08-09', wrist_temp:36.8, resting_hr_exact:65, stress_level:4, disruptors:['High stress'] },
      { log_date:'2026-08-08', wrist_temp:36.7, resting_hr_exact:64, sleep_quality:'Poor' },
      { log_date:'2026-08-07', wrist_temp:36.4, resting_hr_exact:60 },
      { log_date:'2026-08-06', wrist_temp:36.3, resting_hr_exact:59 },
      { log_date:'2026-08-05', wrist_temp:36.3, resting_hr_exact:60 },
    ]
    const mucus = [
      { log_date:'2026-08-09', discharge_type:'None or dry' },
    ]
    const result = inferPhaseFromSymptoms(logs, mucus)
    expect(result?.inferredPhase).toBeNull()
  })
})
