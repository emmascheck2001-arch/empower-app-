// Unit tests for algorithm_v3.js — the pure logic that drives every insight, flag,
// and recommendation shown to users. These functions are the highest-leverage place
// to catch a regression, so the suite covers happy paths, priority ordering, the
// gating thresholds, and the easy-to-forget edge cases (null inputs, missing fields,
// unexpected strings, duplicate moods, log order).
//
// Run: npm test   (watch: npm run test:watch)
import { describe, it, expect } from 'vitest'
import {
  checkFlag,
  interpretMoodSignal,
  detectPMDDPattern,
  getMoodContextFeedback,
  getPersonalisedNutritionFocus,
  getPersonalisedWorkoutReadiness,
  BRAIN_STATE_STYLES,
  PHASE_PREDICTIONS,
} from './algorithm_v3.js'

// ─── helpers ──────────────────────────────────────────────────────────────────
// Build a YYYY-MM-DD string `n` days before today, matching how the app stores log_date.
function daysAgoStr(n) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Mirror detectPMDDPattern's internal cycle-day mapping so tests can deterministically
// place a log in the luteal or follicular window regardless of the exact formula.
function approxCycleDay(daysAgo, cl, cycleDayToday) {
  return (((cycleDayToday - 1 - daysAgo) % cl) + cl) % cl + 1
}
function ovulationFor(cl) { return Math.max(8, Math.round(cl - 14)) }

// ─── checkFlag ──────────────────────────────────────────────────────────────────
describe('checkFlag', () => {
  it('returns false for an unknown flag type', () => {
    expect(checkFlag('not_a_real_flag', { daysLogged: 999, confidence: 1 })).toBe(false)
  })
  it('returns false with no stats at all', () => {
    expect(checkFlag('basic_phase_insight')).toBe(false)
    expect(checkFlag('basic_phase_insight', {})).toBe(false)
  })
  it('returns false when daysLogged is too low', () => {
    expect(checkFlag('nutrition_suggestion', { daysLogged: 2, confidence: 0.9 })).toBe(false)
  })
  it('returns false when confidence is too low', () => {
    expect(checkFlag('pattern_observation', { daysLogged: 30, confidence: 0.1 })).toBe(false)
  })
  it('returns false when cyclesTracked is too low', () => {
    expect(checkFlag('doctor_referral', { cyclesTracked: 1, confidence: 0.9 })).toBe(false)
  })
  it('returns true when the simple conditions are all met', () => {
    expect(checkFlag('basic_phase_insight', { daysLogged: 1, confidence: 0.05 })).toBe(true)
    expect(checkFlag('pattern_observation', { daysLogged: 7, confidence: 0.2 })).toBe(true)
  })

  describe('requiresDepoPath', () => {
    it('returns false when bcType is not depo and userPath is not "2"', () => {
      expect(checkFlag('bone_density_education', { daysLogged: 40, bcType: 'pill', userPath: '5' })).toBe(false)
    })
    it('returns true when bcType is depo', () => {
      expect(checkFlag('bone_density_education', { daysLogged: 40, bcType: 'depo' })).toBe(true)
    })
    it('returns true when userPath is "2" (just came off BC)', () => {
      expect(checkFlag('bone_density_education', { daysLogged: 40, userPath: '2' })).toBe(true)
    })
    it('still requires the day count even when the depo path matches', () => {
      expect(checkFlag('bone_density_education', { daysLogged: 10, bcType: 'depo' })).toBe(false)
    })
  })

  // The stricter gating added so a flag declaring richer thresholds cannot pass on
  // day-count + confidence alone. Each missing stat keeps the gate closed (safe direction).
  describe('full-threshold gating', () => {
    it('cycle_return_signal needs minSignalCount', () => {
      expect(checkFlag('cycle_return_signal', { daysLogged: 14 })).toBe(false)
      expect(checkFlag('cycle_return_signal', { daysLogged: 14, signalCount: 2 })).toBe(true)
    })
    it('health_pattern_flag needs minConsecutiveDaysMatching', () => {
      expect(checkFlag('health_pattern_flag', { cyclesTracked: 3, confidence: 0.6 })).toBe(false)
      expect(checkFlag('health_pattern_flag', { cyclesTracked: 3, confidence: 0.6, consecutiveDaysMatching: 3 })).toBe(true)
    })
    it('pcos_pattern_flag needs minConsecutiveLongCycles', () => {
      expect(checkFlag('pcos_pattern_flag', { cyclesTracked: 2, confidence: 0.6 })).toBe(false)
      expect(checkFlag('pcos_pattern_flag', { cyclesTracked: 2, confidence: 0.6, consecutiveLongCycles: 2 })).toBe(true)
    })
    it('endometriosis_pain_flag needs minHighPainDaysPerCycle', () => {
      expect(checkFlag('endometriosis_pain_flag', { cyclesTracked: 2, confidence: 0.6 })).toBe(false)
      expect(checkFlag('endometriosis_pain_flag', { cyclesTracked: 2, confidence: 0.6, highPainDaysPerCycle: 2 })).toBe(true)
    })
    it('pmdd_pattern_flag needs both consecutive days and cyclical contrast', () => {
      expect(checkFlag('pmdd_pattern_flag', { cyclesTracked: 3, confidence: 0.7 })).toBe(false)
      expect(checkFlag('pmdd_pattern_flag', { cyclesTracked: 3, confidence: 0.7, consecutiveDaysMatching: 3 })).toBe(false)
      expect(checkFlag('pmdd_pattern_flag', {
        cyclesTracked: 3, confidence: 0.7, consecutiveDaysMatching: 3, hasCyclicalContrast: true,
      })).toBe(true)
    })
  })
})

// ─── interpretMoodSignal ──────────────────────────────────────────────────────
describe('interpretMoodSignal', () => {
  it('returns an empty result when there is no mood and no energy', () => {
    const r = interpretMoodSignal({ mood: [], energy: null }, [], 'Follicular', null)
    expect(r).toEqual({ phaseSignal: null, confidenceAdjustment: 0, insight: null, mismatch: false })
  })
  it('does not throw on null / missing inputs', () => {
    expect(() => interpretMoodSignal(null, null, null, null)).not.toThrow()
    expect(() => interpretMoodSignal({}, undefined, undefined, undefined)).not.toThrow()
    expect(interpretMoodSignal(null, null, null, null).insight).toBeNull()
  })
  it('detects a matching mood/energy pattern and confirms the calendar phase', () => {
    const r = interpretMoodSignal({ mood: ['Happy', 'Motivated'], energy: 'High' }, [], 'Follicular', null)
    expect(r.phaseSignal).toBe('Follicular')
    expect(r.mismatch).toBe(false)
    expect(r.confidenceAdjustment).toBeGreaterThan(0)
    expect(r.insight.type).toBe('mood_phase_confirmation')
  })
  it('flags a mismatch with a negative adjustment when mood conflicts with the calendar', () => {
    const r = interpretMoodSignal({ mood: ['Happy', 'Motivated'], energy: 'High' }, [], 'Luteal', null)
    expect(r.phaseSignal).toBe('Follicular')
    expect(r.mismatch).toBe(true)
    expect(r.confidenceAdjustment).toBe(-0.05)
    expect(r.insight.type).toBe('mood_phase_mismatch')
  })
  it('detects persistent negative mood across 3+ recent logs', () => {
    const neg = { mood: ['Irritable', 'Anxious'], energy: 'Low', log_date: daysAgoStr(0) }
    const recent = [neg, { ...neg }, { ...neg }]
    const r = interpretMoodSignal(neg, recent, 'Follicular', null)
    expect(r.insight.type).toBe('persistent_negative_mood_signal')
    expect(r.confidenceAdjustment).toBeLessThanOrEqual(-0.08)
    expect(r.mismatch).toBe(true)
  })
  it('does NOT trigger the persistent signal with fewer than 3 recent logs', () => {
    const neg = { mood: ['Irritable', 'Anxious'], energy: 'Low' }
    const r = interpretMoodSignal(neg, [neg, { ...neg }], 'Follicular', null)
    expect(r.insight?.type).not.toBe('persistent_negative_mood_signal')
  })
  it('ignores unrecognised mood/energy strings without matching or throwing', () => {
    // Unknown values match no MOOD_PHASE_SIGNALS pattern, so no signal is produced.
    const r = interpretMoodSignal({ mood: ['Whimsical', 'Peckish'], energy: 'Quite good' }, [], 'Follicular', null)
    expect(r.phaseSignal).toBeNull()
    expect(r.insight).toBeNull()
  })
})

// ─── detectPMDDPattern ──────────────────────────────────────────────────────────
describe('detectPMDDPattern', () => {
  // Build a full set of daily logs across `span` days, assigning mood by the SAME cycle-day
  // mapping the function uses: negative in luteal, positive in follicular (clear remission).
  function buildCyclicalLogs(span, cl, cycleDayToday, { lutealMood, follicularMood, otherMood }) {
    const logs = []
    const ov = ovulationFor(cl)
    for (let d = 0; d < span; d++) {
      const acd = approxCycleDay(d, cl, cycleDayToday)
      const isLuteal = acd > ov + 1
      const isFollicular = acd > 5 && acd <= ov - 2
      const mood = isLuteal ? lutealMood : isFollicular ? follicularMood : otherMood
      logs.push({ log_date: daysAgoStr(d), mood })
    }
    return logs
  }

  it('returns null with fewer than 14 logs', () => {
    const logs = Array.from({ length: 13 }, (_, d) => ({ log_date: daysAgoStr(d), mood: ['Irritable'] }))
    expect(detectPMDDPattern(logs, 28, 28)).toBeNull()
  })
  it('returns null when cycleDayToday is missing', () => {
    const logs = buildCyclicalLogs(30, 28, 28, { lutealMood: ['Irritable'], follicularMood: ['Happy'], otherMood: ['Focused'] })
    expect(detectPMDDPattern(logs, 28, null)).toBeNull()
    expect(detectPMDDPattern(logs, 28, 0)).toBeNull()
  })
  it('detects the cyclical pattern: negative luteal, remission in follicular', () => {
    const logs = buildCyclicalLogs(30, 28, 28, { lutealMood: ['Irritable', 'Anxious'], follicularMood: ['Happy'], otherMood: ['Focused'] })
    const r = detectPMDDPattern(logs, 28, 28)
    expect(r).not.toBeNull()
    expect(r.type).toBe('possible_pmdd_pattern')
    expect(r.severity).toBe('informational')
  })
  it('does NOT false-positive when mood is non-negative throughout', () => {
    const logs = buildCyclicalLogs(30, 28, 28, { lutealMood: ['Happy'], follicularMood: ['Happy'], otherMood: ['Focused'] })
    expect(detectPMDDPattern(logs, 28, 28)).toBeNull()
  })
  it('does NOT fire when the negativity is not cyclical (negative in follicular too)', () => {
    // Remission requires LOW follicular negativity — negative everywhere should not flag PMDD.
    const logs = buildCyclicalLogs(30, 28, 28, { lutealMood: ['Irritable'], follicularMood: ['Anxious'], otherMood: ['Sad'] })
    expect(detectPMDDPattern(logs, 28, 28)).toBeNull()
  })
  it('ignores logs missing log_date or mood without throwing', () => {
    const valid = buildCyclicalLogs(30, 28, 28, { lutealMood: ['Irritable', 'Anxious'], follicularMood: ['Happy'], otherMood: ['Focused'] })
    const messy = [...valid, { mood: ['Irritable'] }, { log_date: daysAgoStr(2) }, { log_date: daysAgoStr(3), mood: [] }, null].filter(Boolean)
    expect(() => detectPMDDPattern(messy, 28, 28)).not.toThrow()
  })
  it('returns null when there are too few luteal/follicular days (all neutral)', () => {
    const logs = Array.from({ length: 20 }, (_, d) => ({ log_date: daysAgoStr(d), mood: ['Focused'] }))
    // Focused is neither negative nor counted — luteal-negative rate is 0
    expect(detectPMDDPattern(logs, 28, 28)).toBeNull()
  })
  it('handles a longer cycle length (35 days)', () => {
    const logs = buildCyclicalLogs(38, 35, 35, { lutealMood: ['Irritable', 'Anxious'], follicularMood: ['Happy'], otherMood: ['Focused'] })
    expect(detectPMDDPattern(logs, 35, 35)).not.toBeNull()
  })
})

// ─── getMoodContextFeedback ──────────────────────────────────────────────────
describe('getMoodContextFeedback', () => {
  it('returns null when there is no mood', () => {
    expect(getMoodContextFeedback({ mood: [] }, 'Follicular')).toBeNull()
    expect(getMoodContextFeedback(null, 'Follicular')).toBeNull()
    expect(getMoodContextFeedback(undefined, 'Menstrual')).toBeNull()
  })
  it('returns pill-specific feedback for bc-combined low mood', () => {
    const r = getMoodContextFeedback({ mood: ['Low'], energy: 'Low' }, 'bc-combined')
    expect(r.type).toBe('mood_context')
    expect(r.headline).toMatch(/pill/i)
  })
  it('returns progestin-specific feedback for bc-progestin low mood', () => {
    const r = getMoodContextFeedback({ mood: ['Low'] }, 'bc-progestin')
    expect(r.headline).toMatch(/progestin/i)
  })
  it('returns nothing for BC when mood is neither low nor high-energy', () => {
    expect(getMoodContextFeedback({ mood: ['Calm'] }, 'bc-combined')).toBeNull()
  })
  it('returns perimenopause feedback for low mood', () => {
    const r = getMoodContextFeedback({ mood: ['Anxious'], energy: 'Low' }, 'Perimenopause')
    expect(r.headline).toMatch(/estrogen variability/i)
  })
  it('returns perimenopause feedback for high energy', () => {
    const r = getMoodContextFeedback({ mood: ['Happy'] }, 'Perimenopause')
    expect(r.headline).toMatch(/surge/i)
  })
  it('returns late-luteal context for low mood + very low energy', () => {
    const r = getMoodContextFeedback({ mood: ['Irritable'], energy: 'Very low' }, 'Luteal', 'Late luteal')
    expect(r.headline).toMatch(/neurochemistry/i)
  })
  it('returns positive-phase feedback for follicular high energy', () => {
    const r = getMoodContextFeedback({ mood: ['Motivated'] }, 'Follicular')
    expect(r.headline).toMatch(/real and biological/i)
  })
  it('returns menstrual feedback for low mood + low energy', () => {
    const r = getMoodContextFeedback({ mood: ['Low'], energy: 'Low' }, 'Menstrual')
    expect(r.headline).toMatch(/lowest point/i)
  })
  it('returns early-luteal calm feedback for Calm', () => {
    const r = getMoodContextFeedback({ mood: ['Calm'] }, 'Luteal', 'Early luteal')
    expect(r.headline).toMatch(/calm/i)
  })
  it('returns null when no condition matches', () => {
    expect(getMoodContextFeedback({ mood: ['Focused'] }, 'Follicular')).toBeNull()
  })
})

// ─── getPersonalisedNutritionFocus ──────────────────────────────────────────
// The focus is time-bounded to the last ~4 days by log_date, so tests must give logs
// recent dates (a symptom logged long ago must NOT drive the focus).
describe('getPersonalisedNutritionFocus', () => {
  const d0 = daysAgoStr(0), d1 = daysAgoStr(1)
  it('returns null with no logs', () => {
    expect(getPersonalisedNutritionFocus([])).toBeNull()
    expect(getPersonalisedNutritionFocus(undefined)).toBeNull()
  })
  it('detects cramping', () => {
    expect(getPersonalisedNutritionFocus([{ log_date: d0, symptoms: ['Cramping'] }]).focus).toBe('cramping')
  })
  it('detects bloating (needs 2+ days)', () => {
    expect(getPersonalisedNutritionFocus([{ log_date: d0, symptoms: ['Bloating'] }, { log_date: d1, symptoms: ['Bloating'] }]).focus).toBe('bloating')
  })
  it('detects PMS/mood focus', () => {
    expect(getPersonalisedNutritionFocus([{ log_date: d0, mood: ['Anxious'] }, { log_date: d1, mood: ['Irritable'] }]).focus).toBe('pms')
  })
  it('detects brain fog (from rating)', () => {
    expect(getPersonalisedNutritionFocus([{ log_date: d0, brain_fog_rating: 4 }]).focus).toBe('brainfog')
  })
  it('detects fatigue from low energy', () => {
    expect(getPersonalisedNutritionFocus([{ log_date: d0, energy: 'Low' }, { log_date: d1, energy: 'Very low' }]).focus).toBe('fatigue')
  })
  it('detects fatigue from poor sleep', () => {
    expect(getPersonalisedNutritionFocus([{ log_date: d0, sleep_quality: 'Poor' }, { log_date: d1, sleep_quality: 'Poor' }]).focus).toBe('fatigue')
  })
  it('prioritises cramping over bloating and fatigue', () => {
    const logs = [
      { log_date: d0, symptoms: ['Cramping', 'Bloating'], energy: 'Very low' },
      { log_date: d1, symptoms: ['Bloating'], energy: 'Low' },
    ]
    expect(getPersonalisedNutritionFocus(logs).focus).toBe('cramping')
  })
  it('does NOT keep showing a symptom logged weeks ago (the stale-focus bug)', () => {
    // Cramps logged 14 days ago should no longer drive the focus.
    expect(getPersonalisedNutritionFocus([{ log_date: daysAgoStr(14), symptoms: ['Cramping'] }])).toBeNull()
  })
  it('ignores logs with no log_date (cannot place them in time)', () => {
    expect(getPersonalisedNutritionFocus([{ symptoms: ['Cramping'] }])).toBeNull()
  })
  it('does not throw on logs missing fields', () => {
    expect(() => getPersonalisedNutritionFocus([{}, { symptoms: null }, { mood: undefined }])).not.toThrow()
  })
})

// ─── getPersonalisedWorkoutReadiness ─────────────────────────────────────────
describe('getPersonalisedWorkoutReadiness', () => {
  const d0 = daysAgoStr(0), d1 = daysAgoStr(1), d2 = daysAgoStr(2)
  it('returns null with no logs', () => {
    expect(getPersonalisedWorkoutReadiness([])).toBeNull()
    expect(getPersonalisedWorkoutReadiness(undefined)).toBeNull()
  })
  it('returns the very-low-energy message for today', () => {
    expect(getPersonalisedWorkoutReadiness([{ log_date: d0, energy: 'Very low' }])).toMatch(/very low energy/i)
  })
  it('returns the poor-sleep message', () => {
    expect(getPersonalisedWorkoutReadiness([{ log_date: d0, energy: 'Normal', sleep_quality: 'Poor' }])).toMatch(/poor sleep/i)
  })
  it('returns the lighter-session message after several hard sessions', () => {
    const logs = [
      { log_date: d0, energy: 'Normal', sleep_quality: 'Good', workout_feel: 'Felt hard' },
      { log_date: d1, workout_feel: 'Felt hard' },
      { log_date: d2, workout_feel: 'Felt hard' },
    ]
    expect(getPersonalisedWorkoutReadiness(logs)).toMatch(/lighter session|felt hard/i)
  })
  it('returns the stronger-window message after strong sessions', () => {
    const logs = [
      { log_date: d0, energy: 'Normal', sleep_quality: 'Good', workout_feel: 'Felt strong' },
      { log_date: d1, workout_feel: 'Stronger than usual' },
    ]
    expect(getPersonalisedWorkoutReadiness(logs)).toMatch(/strong/i)
  })
  it('returns the stressor message when recent disruptors are present', () => {
    const logs = [{ log_date: d0, energy: 'Normal', sleep_quality: 'Good', disruptors: ['High stress'] }]
    expect(getPersonalisedWorkoutReadiness(logs)).toMatch(/stress/i)
  })
  it('prioritises very-low energy over session history', () => {
    const logs = [
      { log_date: d0, energy: 'Very low', sleep_quality: 'Good', workout_feel: 'Felt hard' },
      { log_date: d1, workout_feel: 'Felt hard' },
      { log_date: d2, workout_feel: 'Felt hard' },
    ]
    expect(getPersonalisedWorkoutReadiness(logs)).toMatch(/very low energy/i)
  })
  it('does NOT call a weeks-old log "today" (stale-window guard)', () => {
    // Latest log is 14 days old → no "today/last night" claim.
    expect(getPersonalisedWorkoutReadiness([{ log_date: daysAgoStr(14), energy: 'Very low' }])).toBeNull()
  })
})

// ─── exported data integrity ─────────────────────────────────────────────────
describe('exported data integrity', () => {
  it('every PHASE_PREDICTIONS brain_state has a matching BRAIN_STATE_STYLES entry', () => {
    for (const pred of Object.values(PHASE_PREDICTIONS)) {
      expect(BRAIN_STATE_STYLES[pred.brain_state], `missing style for "${pred.brain_state}"`).toBeTruthy()
    }
  })
})
