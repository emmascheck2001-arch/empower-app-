import { describe, expect, it } from 'vitest'
import {
  getHormonalContext,
  getIntensityModifier,
  getNutritionTargets,
  getOvulationDay,
  inferPhaseFromSymptoms,
  interpretHormones,
  predictNextPeriod,
} from './hormoneSync.js'

describe('algorithm safety invariants', () => {
  it('retains calendar ovulation estimates with a documented population fallback', () => {
    expect(getOvulationDay(28)).toBe(14)
    expect(getOvulationDay(35)).toBe(21)
    expect(getOvulationDay(35, 12)).toBe(23)
  })

  it('never changes workout intensity from phase alone', () => {
    for (const phase of ['Menstrual','Follicular','Ovulatory','Luteal','Late luteal','Perimenopause','bc']) {
      expect(getIntensityModifier(phase, phase)).toBe(1)
    }
  })

  it('does not invent body weight or an exact nutrition target', () => {
    const unknownWeight = getNutritionTargets('Luteal', null, null)
    expect(unknownWeight.proteinRangeG).toBeNull()
    expect(unknownWeight.proteinRangePerKg).toBeTruthy()
    expect(unknownWeight.proteinG).toBeNull()
    expect(unknownWeight.extraCalories).toBeNull()
  })

  it('does not use mood, energy, workout feel or serum labs to infer phase', () => {
    const result = inferPhaseFromSymptoms([{
      mood:['Irritable','Anxious'], energy:'Very low', workout_feel:'Felt hard',
      hormone_progesterone:45, symptoms:['Cramps'],
    }], [])
    expect(result?.inferredPhase).toBeNull()
  })

  it('requires more than one objective observation for an unanchored phase estimate', () => {
    expect(inferPhaseFromSymptoms([{ lh_result:'Positive' }], [])?.inferredPhase).toBeNull()
    const result = inferPhaseFromSymptoms([{ lh_result:'Positive' }], [{ discharge_type:'Egg white', log_date:'2026-08-08' }])
    expect(result?.inferredPhase).toBe('Ovulatory')
    expect(result?.confidencePct).toBeLessThanOrEqual(35)
  })

  it('stores lab numbers without interpreting or confirming ovulation', () => {
    const result = interpretHormones({ hormone_progesterone:35, hormone_lh:20, hormone_cortisol:500 })
    expect(result.ovulationConfirmed).toBe(false)
    expect(result.notes.join(' ')).toMatch(/recorded/i)
    expect(result.caveat).toMatch(/laboratory|reference interval/i)
  })

  it('separates learning when contraceptive methods or life stages change', () => {
    expect(getHormonalContext({ user_path:'5', bc_type:'pill' })).toBe('contraception-pill')
    expect(getHormonalContext({ user_path:'5', bc_type:'hormonal-iud' })).toBe('contraception-hormonal-iud')
    expect(getHormonalContext({ user_path:'6' })).toBe('pregnancy')
    expect(getHormonalContext({ user_path:'1' })).toBe('natural-cycle')
  })

  it('keeps variable and very long recorded cycles visible in a broad low-confidence forecast', () => {
    const result = predictNextPeriod('2026-07-01', 28, 3, [29, 64, 31])
    expect(result.irregular).toBe(true)
    expect(result.confidence).toBe('low')
    expect(result.predictedDate.toISOString().slice(0, 10)).toBe('2026-08-01')
    expect(result.windowStart.toISOString().slice(0, 10)).toBe('2026-07-30')
    expect(result.windowEnd.toISOString().slice(0, 10)).toBe('2026-09-03')
  })

  it('never labels a period forecast as high confidence', () => {
    expect(predictNextPeriod('2026-07-01', 28, 20, [28, 28, 29, 28]).confidence).toBe('moderate')
  })
})
