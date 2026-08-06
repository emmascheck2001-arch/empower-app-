// hormoneSync.js, shared algorithm module
// All phase logic lives here. Import getTodayStatus into every screen.
import { interpretMoodSignal, detectPMDDPattern, getMoodContextFeedback, checkFlag, getPersonalisedNutritionFocus, getPersonalisedWorkoutReadiness } from './algorithm_v3.js'
import { applyWearableOvulationFromStorage } from './cycleGuardian.js'

// ── Phase calculation (canonical, never duplicate this elsewhere) ──────────
// Ovulation timing: the luteal phase is biologically near-fixed at ~14 days, so
// ovulation falls ~14 days BEFORE the next period (cycleLen − 14), NOT at mid-cycle.
// A mid-cycle (cycleLen/2) assumption is only correct for a 28-day cycle and misplaces
// the fertile window for everyone else (e.g. a 35-day cycle ovulates ~day 21, not 18).
// Clamped to a sensible floor for very short cycles. (Luteal length: Münster 2021.)
export const LUTEAL_LENGTH = 14
export function getOvulationDay(cycleLen) {
  return Math.max(8, Math.round((cycleLen || 28) - LUTEAL_LENGTH))
}

// periodLength (optional) is the user's actual/recorded bleeding length. When they mark a
// period ended, days past it must move to Follicular instead of staying "Menstrual" through
// a hardcoded day 5. Defaults to 5 when unknown, so existing 2-arg callers are unchanged.
export function getPhase(cycleDay, cycleLen, periodLength) {
  const ovulation = getOvulationDay(cycleLen)
  const menstrualEnd = Math.min(Math.max(periodLength || 5, 1), ovulation - 3)
  if (cycleDay <= menstrualEnd) return 'Menstrual'
  if (cycleDay <= ovulation - 2) return 'Follicular'
  if (cycleDay <= ovulation + 1) return 'Ovulatory'
  return 'Luteal'
}

export function getLutealSubPhase(cycleDay, cycleLen) {
  const ovulation = getOvulationDay(cycleLen)
  const lutealDay = cycleDay - ovulation - 1
  if (lutealDay <= 4) return 'Early luteal'
  if (lutealDay <= 9) return 'Mid luteal'
  return 'Late luteal'
}

// Source: CLAUDE.md canonical period prediction, export so all screens use same logic
export const predictNextPeriod = (lastPeriodDate, avgCycleLength, cyclesTracked, gaps) => {
  const lastPeriod = new Date(lastPeriodDate + 'T00:00:00')
  // Predict from the user's OWN cycle history when we have it. For an irregular cycle the point
  // estimate is the mean of her real gaps, and the window spans her observed shortest-to-longest
  // cycle, so the range honestly reflects her variability instead of a fake ±2 days. With little
  // history we fall back to her set/average cycle length and a sensible default window.
  const plausible = (gaps || []).filter(g => g >= 15 && g <= 60)
  const mean = plausible.length
    ? plausible.reduce((s, g) => s + g, 0) / plausible.length
    : (Math.round(avgCycleLength) || 28)
  const predictedDate = new Date(lastPeriod)
  predictedDate.setDate(predictedDate.getDate() + Math.round(mean))

  let startOffset, endOffset
  if (plausible.length >= 2) {
    startOffset = Math.min(...plausible)
    endOffset = Math.max(...plausible)
  } else {
    const half = plausible.length ? 3 : 4
    startOffset = Math.round(mean) - half
    endOffset = Math.round(mean) + half
  }
  const windowStart = new Date(lastPeriod); windowStart.setDate(windowStart.getDate() + startOffset)
  const windowEnd = new Date(lastPeriod); windowEnd.setDate(windowEnd.getDate() + endOffset)
  const confidence = cyclesTracked >= 3 ? 'high'
    : cyclesTracked === 2 ? 'moderate'
    : cyclesTracked === 1 ? 'low'
    : 'none'
  const irregular = plausible.length >= 2 && (Math.max(...plausible) - Math.min(...plausible)) >= 8
  return { predictedDate, windowStart, windowEnd, confidence, irregular }
}

// ── Period-start history ────────────────────────────────────────────────────
// cycle_data has a unique constraint on user_id (one row per user), so it can only
// hold ONE last_period_date. Logging a new period used to OVERWRITE that single
// date, erasing every earlier period from the calendar. To keep a real history
// without a schema change, we stash every logged period-start date as JSON in the
// otherwise-unused cycle_data.notes column: {"periodStarts":["YYYY-MM-DD",...]}.
// last_period_date still holds the most recent start (everything else reads that).
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Read the full list of recorded period starts (ascending). Falls back to
// last_period_date for older rows that predate the notes-history format.
export function parsePeriodStarts(cycleData) {
  if (!cycleData) return []
  const set = new Set()
  if (cycleData.notes) {
    try {
      const parsed = JSON.parse(cycleData.notes)
      if (parsed && Array.isArray(parsed.periodStarts)) {
        parsed.periodStarts.forEach(d => { if (ISO_DATE.test(d)) set.add(d) })
      }
    } catch { /* notes isn't our JSON, ignore and fall back to last_period_date */ }
  }
  if (cycleData.last_period_date && ISO_DATE.test(cycleData.last_period_date)) set.add(cycleData.last_period_date)
  return [...set].sort()
}

// Merge a newly logged period start into the existing history and return the JSON
// string to store in cycle_data.notes. Never drops a previously recorded start.
export function mergePeriodStartsNotes(existingNotes, existingLastDate, newDate) {
  const set = new Set()
  if (existingNotes) {
    try {
      const parsed = JSON.parse(existingNotes)
      if (parsed && Array.isArray(parsed.periodStarts)) parsed.periodStarts.forEach(d => set.add(d))
    } catch { /* ignore non-JSON notes */ }
  }
  if (existingLastDate) set.add(existingLastDate)
  if (newDate) set.add(newDate)
  const periodStarts = [...set].filter(d => ISO_DATE.test(d)).sort()
  return JSON.stringify({ periodStarts })
}

function getFollicularSubPhase(cycleDay) {
  // Early follicular: days 6-9, late follicular: day 10+
  return cycleDay <= 9 ? 'Early follicular' : 'Late follicular'
}

// Reconstruct how many real cycles the user has tracked, from the recorded period-start
// history (cycle_data.notes + last_period_date). A "cycle" is the gap between two
// consecutive recorded starts; only physiologically plausible gaps (15 to 60 days) count, so
// breakthrough bleeding logged close together doesn't inflate the number. This is what the
// confidence score should grow with, accumulated cycles are the real measure of how much
// the app has learned about YOU, not just how many days you've logged.
export function computeCycleHistory(cycleData, profileCycleLen) {
  const starts = parsePeriodStarts(cycleData)
  const gaps = []
  for (let i = 1; i < starts.length; i++) {
    const a = new Date(starts[i - 1] + 'T00:00:00')
    const b = new Date(starts[i] + 'T00:00:00')
    const g = Math.round((b - a) / 86400000)
    if (g >= 15 && g <= 60) gaps.push(g)
  }
  const cyclesTracked = gaps.length
  // Average only from typical-length cycles (21 to 45 days). A single very short gap, e.g.
  // breakthrough bleeding logged close to a real period, would otherwise report a misleading
  // "17 day average" in the doctor summary. Fall back to the user's set cycle length.
  const typical = gaps.filter(g => g >= 21 && g <= 45)
  const avgCycleLength = typical.length
    ? Math.round(typical.reduce((s, g) => s + g, 0) / typical.length)
    : (cycleData?.cycle_length || profileCycleLen || 28)
  return { cyclesTracked, avgCycleLength, periodStarts: starts, gaps }
}

// When a period is late, look at the user's OWN recent logs and name the likely
// contributors. Pregnancy is the obvious thought, but a late period is far more often
// driven by stress, illness, travel, poor sleep, heavy training / under-fuelling, or simply
// coming off birth control. Everything here is derived from what the user logged and is
// framed as a possible contributor. NEVER a diagnosis, always defer to a doctor if it
// persists. Language rules: no "GnRH" (say "the hormone signal that tells your ovaries to
// release an egg"), never name PCOS/endometriosis.
export function getLatePeriodInsights(recentLogs, profile, cycleInfo) {
  const logs = Array.isArray(recentLogs) ? recentLogs : []
  const out = []
  const disruptors = logs.flatMap(l => Array.isArray(l.disruptors) ? l.disruptors : [])
  const hasDisruptor = d => disruptors.includes(d)

  if (hasDisruptor('High stress') || logs.some(l => l.stress_level >= 4)) {
    out.push('You have logged high stress recently. Stress raises cortisol, which can delay the hormone signal that tells your ovaries to release an egg, and a delayed ovulation means a later period.')
  }
  if (hasDisruptor('Illness')) {
    out.push('You logged being unwell recently. Illness and fever can push ovulation later, which delays your period.')
  }
  if (hasDisruptor('Travel')) {
    out.push('You logged travel recently. A change in time zone or routine can shift your cycle timing by several days.')
  }
  if (hasDisruptor('Very poor sleep') || logs.filter(l => l.sleep_quality === 'Poor').length >= 3) {
    out.push('Your sleep has been poor on several recent days. Consistently disrupted sleep can unsettle the hormonal rhythm that regulates your cycle.')
  }
  const veryLow = logs.filter(l => l.energy === 'Very low').length
  const trained = logs.filter(l => l.workout_feel && !['Rest day', 'Skipped'].includes(l.workout_feel)).length
  if (veryLow >= 3 || (trained >= 4 && veryLow >= 1)) {
    out.push('You have logged very low energy repeatedly. If you are training hard or eating less than your body is using, it can delay a period to conserve energy. Eating enough, especially around training, supports a regular cycle. (IOC RED-S 2023)')
  }
  if (hasDisruptor('Alcohol') && disruptors.filter(d => d === 'Alcohol').length >= 2) {
    out.push('You logged alcohol on multiple recent days. Heavier drinking can temporarily disrupt the hormones that time your cycle.')
  }
  if (profile?.user_path === '2') {
    out.push('You recently came off hormonal birth control. Late, irregular, or skipped cycles are very common for several months while your natural hormone rhythm returns, this usually settles on its own.')
  }
  const gaps = cycleInfo?.gaps || []
  if (gaps.length >= 2 && (Math.max(...gaps) - Math.min(...gaps) >= 7)) {
    out.push('Your own tracked cycles have varied by more than a week in length, so this may be part of your natural variation rather than a truly missed period.')
  }
  return out
}

// Robustly turn a logged resting HR into a number. The log stores either an exact bpm
// or a range label, so map ranges to their midpoint instead of losing the signal.
function rhrToNum(v) {
  if (v == null || v === '' || v === 'No data') return NaN
  const map = { 'Under 55': 52, '55 to 65': 60, '65 to 75': 70, 'Over 75': 78 }
  if (map[v] != null) return map[v]
  const n = parseFloat(v)
  return isNaN(n) ? NaN : n
}

// Interpret logged hormone lab values into ovulation signals + plain-language notes.
// Progesterone >=10 nmol/L confirms ovulation has occurred (mid-luteal); LH >=8 IU/L is a
// surge (ovulation imminent). Ranges per CLAUDE.md HORMONE_REFS / Münster 2021.
export function interpretHormones(log) {
  if (!log) return null
  const prog = parseFloat(log.hormone_progesterone)
  const lh = parseFloat(log.hormone_lh)
  const e2 = parseFloat(log.hormone_estradiol)
  const notes = []
  let ovulationConfirmed = false, lhSurge = false
  if (!isNaN(prog)) {
    // ≥10 nmol/L supports ovulation ONLY when drawn mid-luteal (~7 days post-ovulation),
    // never on a random cycle day, so we phrase it as supporting evidence, not proof.
    if (prog >= 10) { ovulationConfirmed = true; notes.push('Progesterone ' + prog + ' nmol/L. When measured about 7 days after ovulation (mid-luteal), a level this high supports that ovulation happened this cycle.') }
    else if (prog >= 2) notes.push('Progesterone ' + prog + ' nmol/L is in the early-luteal range.')
    else notes.push('Progesterone ' + prog + ' nmol/L is in the follicular range, before ovulation.')
  }
  if (!isNaN(lh)) {
    // A single LH value isn't a confirmed surge. LH is pulsatile and stays chronically
    // high in some conditions (e.g. PCOS), so we avoid promising imminent ovulation.
    if (lh >= 8) { lhSurge = true; notes.push('LH ' + lh + ' IU/L is high, consistent with an approaching LH surge, ovulation often follows within 12 to 36 hours. A single reading is not proof on its own, and LH can stay elevated without ovulation in some conditions such as PCOS.') }
    else notes.push('LH ' + lh + ' IU/L is at baseline, no surge detected.')
  }
  if (!isNaN(e2)) {
    if (e2 >= 600) notes.push('Estradiol ' + e2 + ' pmol/L is high, consistent with the pre-ovulatory peak.')
    else notes.push('Estradiol ' + e2 + ' pmol/L logged.')
  }
  if (!notes.length) return null
  return {
    ovulationConfirmed, lhSurge,
    progesterone: isNaN(prog) ? null : prog,
    lh: isNaN(lh) ? null : lh,
    estradiol: isNaN(e2) ? null : e2,
    notes,
    caveat: 'These are population reference ranges. Your personal normal may differ; what matters most is your pattern across cycles.'
  }
}

// ── Intensity modifiers ─────────────────────────────────────────────────────
// Source: CLAUDE.md canonical intensity values
export function getIntensityModifier(phase, subPhase) {
  if (phase === 'Menstrual') return 0.70
  if (phase === 'Follicular') {
    return subPhase === 'Early follicular' ? 0.95 : 1.05
  }
  if (phase === 'Ovulatory') return 1.05
  if (phase === 'Luteal') {
    if (subPhase === 'Early luteal') return 0.92
    if (subPhase === 'Mid luteal') return 0.82
    return 0.72
  }
  if (phase === 'Perimenopause') return 0.82 // moderate, train to how you feel, symptom-driven
  return 0.72 // observation, mirrors menstrual/low-estrogen environment
}

function getIntensityLabel(modifier) {
  if (modifier >= 1.05) return 'Peak intensity. Push hard today.'
  if (modifier >= 1.00) return 'High intensity. Strong training window.'
  if (modifier >= 0.92) return 'Moderate intensity. Focus on quality over load.'
  if (modifier >= 0.82) return 'Reduced intensity. Higher perceived effort is normal.'
  return 'Low intensity. Gentle movement is the priority.'
}

// ── Nutrition targets ────────────────────────────────────────────────────────
// Source: ISSN 2023 position stand
export function getNutritionTargets(phase, bodyWeight, dietPreference) {
  const bw = bodyWeight || 65
  const targets = {
    Menstrual:    { multiplier: 1.5, extra: 0,  headline: 'Iron day. Your body is replenishing.', keyFoods: ['Red meat', 'Spinach', 'Lentils', 'Pumpkin seeds', 'Citrus'], avoid: 'Limit caffeine above 200mg, which can worsen cramps.', source: 'ISSN 2023; Angeli et al. 2016. Iron loss during menstruation impacts performance.' },
    Follicular:   { multiplier: 1.7, extra: 0,  headline: 'Build phase. Fuel hard training.', keyFoods: ['Eggs', 'Chicken', 'Oats', 'Whole grains', 'Leafy greens'], avoid: null, source: 'ISSN 2023. Estrogen improves carbohydrate metabolism in the follicular phase.' },
    Ovulatory:    { multiplier: 1.8, extra: 0,  headline: 'Peak output needs peak fuel.', keyFoods: ['Beef', 'Chickpeas', 'Berries', 'Dark leafy greens', 'Salmon'], avoid: null, source: 'ISSN 2023. Peak training output requires peak protein intake. Zinc from beef and seeds supports enzymatic processes around ovulation.' },
    Luteal:       { multiplier: 2.0, extra: 250, headline: 'Your body needs more today. That is biology.', keyFoods: ['Sweet potato', 'Oats', 'Dark chocolate', 'Salmon', 'Eggs', 'Pumpkin seeds'], avoid: 'Avoid alcohol and high-sugar processed foods which worsen luteal phase inflammation.', source: 'ISSN 2023. Luteal phase protein 1.8 to 2.2g per kg, because progesterone makes your body break down protein faster. Add 200 to 300 kcal above follicular phase intake.' },
    observation:  { multiplier: 1.6, extra: 0,  headline: 'Consistent nutrition builds your baseline', keyFoods: ['Protein source each meal', 'Complex carbohydrates', 'Healthy fats', 'Leafy greens'], avoid: null, source: null },
    'bc-combined': { multiplier: 1.6, extra: 0, headline: 'Consistent protein. No cycle-based adjustments needed.', keyFoods: ['Chicken', 'Eggs', 'Greek yogurt', 'Lentils', 'Oats', 'Leafy greens'], avoid: null, source: 'ISSN 2023. Standard 1.6g per kg supports muscle maintenance. No luteal phase protein increase is needed when birth control keeps progesterone steady.' },
    'bc-progestin': { multiplier: 1.7, extra: 0, headline: 'Protein and bone support are the priority.', keyFoods: ['Salmon', 'Eggs', 'Chicken', 'Sardines', 'Almonds', 'Dark leafy greens'], avoid: null, source: 'ISSN 2023. Calcium and vitamin D especially important when estrogen is low. Protein 1.6 to 1.8g per kg for muscle and bone maintenance.' },
    Perimenopause: { multiplier: 1.8, extra: 0, headline: 'Protein first. Bone protection second.', keyFoods: ['Salmon', 'Chicken', 'Eggs', 'Sardines', 'Dark leafy greens', 'Almonds'], avoid: 'Limit alcohol, which worsens hot flashes, disrupts sleep, and increases breast cancer risk. Limit ultra-processed foods, which worsen insulin resistance.', source: 'ISSN 2023. Protein 1.6 to 2.0g per kg for women in hormonal transition. Kohrt et al. MSSE 2004 for calcium and vitamin D in bone protection.' }
  }
  const t = targets[phase] || targets.observation
  // Vegan diets need ~15% more protein for equivalent muscle protein synthesis (Rogerson 2017).
  // Applied here so every screen shows the same number, not just the nutrition page.
  let vegan = false
  try { vegan = JSON.parse(dietPreference || '[]').includes('vegan') } catch { /* not vegan */ }
  // Vegan +15% for plant-protein bioavailability (Rogerson 2017), but capped at 2.2 g/kg, // the top of the ISSN 2023 athlete range, so the luteal target (2.0) doesn't overshoot it.
  const effMultiplier = Math.min(t.multiplier * (vegan ? 1.15 : 1), 2.2)
  return {
    proteinG: Math.round(bw * effMultiplier),
    extraCalories: t.extra,
    headline: t.headline,
    keyFoods: t.keyFoods,
    avoid: t.avoid,
    source: t.source
  }
}

// ── Confidence calculation ───────────────────────────────────────────────────
// totalLogs is the user's LIFETIME log count, so the base confidence grows with
// their whole history and never drops day to day. The 7-day signal bonuses below
// refine it but can't pull it below the history-based floor.
function calcConfidence(phase, subPhase, recentLogs, mucusLogs, totalLogs = 0, cyclesTracked = 0) {
  // The floor rises from TWO sources of accumulated learning:
  //  - logging volume (data breadth), caps at +0.30 around ~30 logs
  //  - cycles actually tracked (the real personalisation signal), caps at +0.35 around 3
  //    completed cycles, when a personal pattern is genuinely established.
  // Previously only logging volume counted and it capped the base at 0.80, so a dedicated
  // user plateaued no matter how many cycles they tracked. Now sustained use across cycles
  // climbs toward "fully personalised".
  const logFloor = Math.min(0.25, totalLogs * 0.01)      // data breadth, caps ~25 logs
  const cycleFloor = Math.min(0.25, cyclesTracked * 0.09) // real personalisation, caps ~3 cycles
  const historyFloor = 0.50 + logFloor + cycleFloor       // ~3 tracked cycles → fully personalised
  let confidence = historyFloor

  if (recentLogs?.length) {
    const latestEnergy = recentLogs[0]?.energy
    if (latestEnergy === 'Very low' && (phase === 'Follicular' || phase === 'Ovulatory')) {
      confidence -= 0.12
    }
    const rhrData = recentLogs
      .filter(l => l.resting_hr)
      .map(l => parseFloat(l.resting_hr))
      .filter(n => !isNaN(n))
    if (rhrData.length >= 3 && phase === 'Luteal') {
      const avg = rhrData.slice(0, 3).reduce((a, b) => a + b, 0) / 3
      if (avg > 65) confidence += 0.08
    }

    // Mood signal adjustment
    // Source: Backstrom et al. 2008; interpretMoodSignal in algorithm_v3.js
    const moodResult = interpretMoodSignal(recentLogs[0], recentLogs, phase, subPhase)
    if (moodResult) confidence += moodResult.confidenceAdjustment

    // Wrist temperature elevation confirms luteal phase
    // Source: Charkoudian & Stachenfeld Comprehensive Physiology 2014; Zhu et al. JMIR 2021
    const tempData = recentLogs.filter(l => l.wrist_temp).map(l => parseFloat(l.wrist_temp)).filter(n => !isNaN(n))
    if (tempData.length >= 3) {
      const baseline = tempData.slice(1).reduce((a, b) => a + b, 0) / (tempData.length - 1)
      if (tempData[0] - baseline >= 0.2 && phase === 'Luteal') confidence += 0.10
      if (tempData[0] - baseline < 0.1 && phase === 'Follicular') confidence += 0.06
    }

    // Flow volume confirms menstrual phase
    if (recentLogs[0]?.flow_volume && recentLogs[0].flow_volume !== 'None' && phase === 'Menstrual') {
      confidence += 0.08
    }

    // Disruptors (alcohol, illness, travel, poor sleep) reduce signal reliability slightly
    const disruptorCount = (recentLogs[0]?.disruptors || []).filter(d => d !== 'None of these').length
    if (disruptorCount >= 2) confidence -= 0.05
  }

  if (mucusLogs?.length) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const recent = mucusLogs.filter(m => {
      const d = new Date(m.log_date + 'T00:00:00')
      return Math.abs(today - d) < 3 * 86400000
    })
    if (recent.length > 0) {
      confidence += 0.06
      const eggWhite = recent.find(m => m.discharge_type === 'Egg white')
      if (eggWhite && phase === 'Ovulatory') confidence += 0.12
    }
  }

  // Never fall below the history floor, a single off-signal day can refine the
  // reading upward but can't make the app appear to "forget" what it has learned.
  // Cap at 0.99 (not 0.92) so a fully-established personal baseline can reach
  // "fully personalised", the 0.92 cap made 100% unreachable for even the most
  // dedicated user, which read as the algorithm being permanently stuck.
  return Math.min(0.99, Math.max(historyFloor, confidence))
}

// ── Anomaly detection ────────────────────────────────────────────────────────
// Language rules: start with what the woman is experiencing, never use diagnostic headers,
// always warm and curious, never alarming or clinical. (Per CLAUDE.md tone rules.)
function detectAnomalies(recentLogs, phase, cycleLen, flagStats) {
  const anomalies = []
  if (!recentLogs?.length) return anomalies

  const latest = recentLogs[0]
  if (!latest) return anomalies

  // Path 4 perimenopause: skip cycle-based anomaly detection entirely, run peri-specific checks
  if (flagStats?.userPath === '4') {
    const lowEnergyDays = recentLogs.filter(l => l.energy === 'Very low' || l.energy === 'Low').length
    if (recentLogs.length >= 5 && lowEnergyDays >= 4) {
      anomalies.push({ type: 'peri_fatigue', text: 'You have logged low energy for most of the past week. Persistent fatigue is one of the most common perimenopause symptoms. It is worth ruling out anaemia, thyroid function, and vitamin D deficiency with your doctor if this has been ongoing. (Harlow et al. Climacteric 2012)' })
    }
    const poorSleepDays = recentLogs.filter(l => l.sleep_quality === 'Poor').length
    if (recentLogs.length >= 5 && poorSleepDays >= 3) {
      anomalies.push({ type: 'peri_sleep', text: 'Sleep quality has been poor over several nights this week. Disrupted sleep in perimenopause is often driven by night sweats and progesterone decline. Keeping your room cool, reducing alcohol, and regular exercise all have evidence behind them. If it is persistent please discuss with a doctor. (Harlow et al. 2012; Freeman et al. 2004)' })
    }
    // Hot flash and night sweat burden
    // Source: Harlow et al. Climacteric 2012 STRAW+10; Freeman et al. Archives of General Psychiatry 2004
    const totalHotFlashes = recentLogs.reduce((sum, l) => sum + (l.hot_flash_count || 0), 0)
    if (recentLogs.length >= 3 && totalHotFlashes >= 15) {
      anomalies.push({ type: 'peri_hotflash', text: 'You have been logging frequent hot flashes this week. High vasomotor symptom burden has good evidence-based treatments including HRT and CBT. If hot flashes are disrupting your sleep or daily life it is worth a conversation with a doctor who specialises in hormonal health. (Freeman et al. 2004)' })
    }
    const severeNightSweats = recentLogs.filter(l => l.night_sweats_severity === 'Severe' || l.night_sweats_severity === 'Moderate').length
    if (recentLogs.length >= 3 && severeNightSweats >= 2) {
      anomalies.push({ type: 'peri_nightsweats', text: 'Night sweats logged several times this week. These are directly driven by estrogen decline affecting the hypothalamic temperature control centre. Sleeping in a cooler room, moisture-wicking bedding, and avoiding alcohol before bed have the best evidence. (Harlow et al. 2012)' })
    }
    // Joint pain tracking for perimenopause
    const highJointPain = recentLogs.filter(l => (l.joint_pain_rating || 0) >= 3).length
    if (recentLogs.length >= 3 && highJointPain >= 2) {
      anomalies.push({ type: 'peri_joint', text: 'Joint pain flagged over several days this week. Estrogen has anti-inflammatory effects, its decline in perimenopause can cause or worsen joint symptoms. Resistance training, omega-3 fatty acids, and maintaining a healthy weight are all supported by evidence. Worth mentioning to your doctor if it is limiting your activity.' })
    }
    // Brain fog tracking
    const highBrainFog = recentLogs.filter(l => (l.brain_fog_rating || 0) >= 3).length
    if (recentLogs.length >= 3 && highBrainFog >= 2) {
      anomalies.push({ type: 'peri_brainfog', text: 'Brain fog noted over several days. Cognitive changes during perimenopause are real and driven by fluctuating estrogen, estrogen directly supports serotonin and dopamine activity in the brain. Strength training, sleep, and omega-3 fatty acids are among the most evidence-backed interventions. (Osborn et al. Frontiers in Pharmacology 2025)' })
    }
    return anomalies
  }

  // pattern_observation threshold required for most anomaly observations
  const canObserve = checkFlag('pattern_observation', flagStats)
  const canFlag = checkFlag('health_pattern_flag', flagStats)

  if (canObserve && latest.energy === 'Very low' && phase === 'Follicular') {
    anomalies.push({ type: 'energy_mismatch', text: 'Your energy today is lower than expected for this phase. This sometimes happens when recovery is incomplete, when you have been under-fuelling, or when your energy rise is simply starting a little later than usual. Worth keeping an eye on over the next few days.' })
  }
  if (canObserve && latest.energy === 'High' && phase === 'Menstrual') {
    anomalies.push({ type: 'energy_high_menstrual', text: 'Interesting, high energy during your period. Some women notice a brief energy surge on day 1 or 2 before cramps set in, as the drop in hormones briefly lifts mood. Log how your training feels today.' })
  }

  const rhr = parseFloat(latest.resting_hr)
  if (canObserve && !isNaN(rhr) && rhr > 75 && (phase === 'Follicular' || phase === 'Ovulatory')) {
    anomalies.push({ type: 'rhr_elevated', text: 'Your resting heart rate is on the higher side for this phase. This can reflect poor recovery, early illness, or a stressful few days. Consider dialling back intensity today and prioritising sleep. If it stays elevated for a week, worth mentioning to your doctor.' })
  }

  const cortisol = parseFloat(latest.hormone_cortisol)
  if (canObserve && !isNaN(cortisol) && cortisol > 30) {
    anomalies.push({ type: 'cortisol_elevated', text: 'Your cortisol reading this morning is above the typical range (above 30 nmol/L, LifeLabs/EORLA). High cortisol and progesterone compete directly in the body, which can affect how well you recover from training. Consider a lighter session today. (Source: Hackney 2006.)' })
  }

  // Severe period pain, potential flag for investigation
  // Source: Nnoaham et al. Fertility and Sterility 2011 (diagnostic delay)
  if (canObserve && (latest.pain_rating >= 4) && phase === 'Menstrual') {
    anomalies.push({ type: 'pain_high', text: 'You logged significant pain today. Severe period pain is not something you have to simply push through, it is worth taking seriously. Some women find that tracking this pattern over time gives them useful information to bring to a healthcare provider. If pain like this happens regularly, it may be worth discussing with your doctor. (Nnoaham et al. Fertility and Sterility 2011)' })
  }

  // High disruptors in luteal phase amplify stress response
  // Source: Hackney 2006, cortisol competes with progesterone in luteal phase
  const activeDisruptors = (latest.disruptors || []).filter(d => d !== 'None of these')
  if (canObserve && activeDisruptors.length >= 2 && (phase === 'Luteal' || phase === 'Late luteal')) {
    anomalies.push({ type: 'luteal_load', text: 'You have logged multiple stressors today in your luteal phase. Alcohol, poor sleep, illness, and high stress all compound the cortisol load that is already elevated in the luteal phase. Your body is working harder than usual right now. Rest, eat enough protein, and consider dropping training intensity by 20% today. (Hackney 2006)' })
  }

  // PMDD pattern, intentionally conservative. Two gates keep it dormant by design until
  // it can be enabled deliberately: (1) checkFlag('pmdd_pattern_flag') now demands the full
  // threshold incl. cyclical-contrast/consecutive-days stats the pipeline does not yet
  // supply, and (2) detectPMDDPattern needs >=14 logs but recentLogs is a 7-day window.
  // Do NOT widen the fetch or loosen the gate to make this fire without OB/clinical review, // a PMDD-adjacent auto-flag is sensitive mental-health content.
  // Source: DSM-5 PMDD criteria; Osborn et al. Frontiers in Pharmacology 2025
  if (canFlag && checkFlag('pmdd_pattern_flag', flagStats)) {
    const pmddResult = detectPMDDPattern(recentLogs, cycleLen, flagStats.cycleDay)
    if (pmddResult) {
      // Rewrite with warm non-diagnostic framing
      anomalies.push({
        ...pmddResult,
        message: 'We have noticed a consistent mood pattern across your last few cycles, you tend to feel significantly more low or anxious in the week before your period, and noticeably better once it begins. This kind of cyclical pattern is worth knowing about. It has a specific biological explanation and there are effective approaches to managing it. If it is disrupting your life, it is worth raising with your doctor and specifically mentioning the cyclical timing, that detail matters for how it is assessed.'
      })
    }
  }

  return anomalies
}

// ── Immediate feedback from latest log ──────────────────────────────────────
function getImmediateFeedback(latestLog, phase, subPhase, confidence) {
  if (!latestLog) return []
  const feedback = []
  const confPct = Math.round(confidence * 100)

  if (latestLog.energy) {
    feedback.push({ signal: 'Energy', text: 'Energy signal logged. Helps calibrate phase intensity targets. Confidence now ' + confPct + '%.' })
  }
  if (latestLog.resting_hr && latestLog.resting_hr !== 'No data') {
    feedback.push({ signal: 'Resting HR', text: 'RHR logged. Heart rate rises ~1.7 bpm in mid-luteal (De Martin Topranin 2023). Tracking this improves phase detection accuracy.' })
  }
  if (latestLog.sleep_quality) {
    feedback.push({ signal: 'Sleep', text: 'Sleep quality logged. Sleep disruption is most common in mid-luteal phase (De Martin Topranin 2023). Patterns here flag the phase boundary early.' })
  }
  if (latestLog.wrist_temp) {
    feedback.push({ signal: 'Temperature', text: 'Wrist temperature logged. Progesterone elevates core temperature by 0.3 to 0.5°C in the luteal phase. Consistent temperature data is one of the strongest phase signals available. (Charkoudian & Stachenfeld 2014; Zhu et al. 2021)' })
  }
  if (latestLog.flow_volume) {
    feedback.push({ signal: 'Flow', text: 'Flow logged. This helps calibrate your menstrual phase length and flag changes over time. Lighter than usual flow can indicate lower estrogen exposure.' })
  }
  const activeDisruptors = (latestLog.disruptors || []).filter(d => d !== 'None of these')
  if (activeDisruptors.length > 0) {
    feedback.push({ signal: 'Disruptors', text: 'Disruptors noted. Alcohol, illness, and poor sleep create noise in the hormonal signal. The algorithm accounts for these when they are logged.' })
  }

  // Mood context feedback, connects logged mood to neurotransmitter explanation
  // Source: Backstrom et al. 2008; Lokuge et al. 2011; algorithm_v3.js
  const moodFeedback = getMoodContextFeedback(latestLog, phase, subPhase)
  if (moodFeedback) feedback.push(moodFeedback)

  return feedback
}

// ── Predictions ──────────────────────────────────────────────────────────────
function getPredictions(phase, cycleDay, cycleLen) {
  if (!cycleDay || !cycleLen) return []
  const predictions = []
  const ovulation = getOvulationDay(cycleLen)

  if (phase === 'Follicular') {
    const daysToOvulation = ovulation - cycleDay
    if (daysToOvulation >= 0 && daysToOvulation <= 5) {
      predictions.push({ label: 'Ovulation window', text: 'Ovulation is approximately ' + daysToOvulation + ' day' + (daysToOvulation !== 1 ? 's' : '') + ' away. Peak energy and strength likely today or tomorrow. Consider attempting load increases.' })
    }
  }

  if (phase === 'Luteal') {
    const daysUntilPeriod = Math.max(0, cycleLen - cycleDay + 1)
    if (daysUntilPeriod <= 5) {
      predictions.push({ label: 'Period approaching', text: 'Your period is approximately ' + daysUntilPeriod + ' day' + (daysUntilPeriod !== 1 ? 's' : '') + ' away. Many women notice a shift in energy as progesterone drops. Yoga, pilates, and walking are genuinely optimal movement choices right now.' })
    }
  }

  return predictions
}

// ── Symptom inference engine ─────────────────────────────────────────────────
// Estimates cycle phase from logged symptoms when no period date is available.
// Source: Janse de Jonge 2003 Sports Medicine, personal tracking improves prediction accuracy.
// Source: Bigelow et al. 2004 Human Reproduction, egg white fluid 80% sensitivity for fertile window.
// Source: De Martin Topranin et al. 2023 IJSPP. RHR 1.7 bpm higher mid-luteal vs early follicular.
export function inferPhaseFromSymptoms(recentLogs, mucusLogs = []) {
  if (!recentLogs?.length) {
    return { inferredPhase: null, confidence: 'insufficient', source: 'symptom_inference' }
  }

  const logs = recentLogs.slice(0, 7)
  const latestLog = logs[0] || {}
  const mucus = (mucusLogs || []).slice(0, 7)

  // Flatten arrays across all recent logs for pattern detection
  const allSymptoms = logs.flatMap(l => l.symptoms || [])
  const allMoods = logs.flatMap(l => l.mood || [])
  const energyValues = logs.map(l => l.energy).filter(Boolean)
  const sleepValues = logs.map(l => l.sleep_quality).filter(Boolean)
  const allFluid = mucus.map(m => m.discharge_type).filter(Boolean)
  const rhrValues = logs.map(l => rhrToNum(l.resting_hr)).filter(n => !isNaN(n))
  const latestRHR = rhrToNum(latestLog.resting_hr)
  // Baseline = average of all logged RHR except the most recent (Zhu et al. 2021)
  const rhrBaseline = rhrValues.length > 1
    ? rhrValues.slice(1).reduce((a, b) => a + b, 0) / (rhrValues.length - 1)
    : null
  const tempValues = logs.map(l => parseFloat(l.wrist_temp)).filter(n => !isNaN(n))
  const tempBaseline = tempValues.length > 1
    ? tempValues.slice(1).reduce((a, b) => a + b, 0) / (tempValues.length - 1)
    : null

  const scores = { Menstrual: 0, Follicular: 0, Ovulatory: 0, Luteal: 0 }
  const signals = []

  // ── MENSTRUAL signals (2 points each) ──────────────────────────────────────
  if (latestLog.flow_volume && latestLog.flow_volume !== 'None') {
    scores.Menstrual += 3; signals.push('menstrual flow logged')
  }
  if (allSymptoms.some(s => ['Cramping', 'Bloating', 'Fatigue', 'Back pain'].includes(s))) {
    scores.Menstrual += 2; signals.push('cramping or fatigue symptoms')
  }
  if (logs.some(l => (l.pain_rating || 0) >= 3)) {
    scores.Menstrual += 2; signals.push('period pain logged')
  }
  if (energyValues.some(e => e === 'Very low')) {
    scores.Menstrual += 2; signals.push('very low energy')
  }
  if (allMoods.some(m => ['Low mood', 'Irritable', 'Sad'].includes(m))) {
    scores.Menstrual += 2; signals.push('low or irritable mood')
  }
  if (allFluid.some(f => f === 'Spotting')) {
    scores.Menstrual += 2; signals.push('spotting')
  }
  if (sleepValues.some(s => s === 'Poor')) {
    scores.Menstrual += 2; signals.push('poor sleep')
  }

  // ── FOLLICULAR signals (2 points each) ─────────────────────────────────────
  if (energyValues.some(e => e === 'High')) {
    scores.Follicular += 2; signals.push('high energy')
  }
  if (allMoods.some(m => ['Happy', 'Motivated', 'Social', 'Energetic'].includes(m))) {
    scores.Follicular += 2; signals.push('positive motivated mood')
  }
  if (allFluid.some(f => f === 'Creamy or lotion-like' || f === 'Watery')) {
    scores.Follicular += 2; signals.push('creamy or watery cervical fluid')
  }
  if (logs.some(l => l.workout_feel === 'Stronger than usual')) {
    scores.Follicular += 2; signals.push('strong workout feel')
  }
  if (allSymptoms.length > 0 && !allSymptoms.some(s => ['Cramping', 'Fatigue'].includes(s))) {
    scores.Follicular += 2; signals.push('no pain or fatigue logged')
  }

  // ── OVULATORY signals (3 points each, stronger specificity) ───────────────
  if (allFluid.some(f => f === 'Egg white')) {
    scores.Ovulatory += 3; signals.push('egg white cervical fluid')
    if (mucus[0]?.discharge_type === 'Egg white') scores.Ovulatory += 1   // recency: today's reading weighs more
  }
  if (logs.some(l => l.lh_result && l.lh_result.toLowerCase() === 'positive')) {
    scores.Ovulatory += 3; signals.push('positive LH test')
  }
  if (allSymptoms.includes('Ovulation pain')) {
    scores.Ovulatory += 3; signals.push('ovulation pain (mittelschmerz)')
  }
  if (logs.some(l => l.libido === 'High')) {
    scores.Ovulatory += 2; signals.push('raised sex drive')
  }
  if (energyValues.some(e => e === 'High') && allMoods.some(m => ['Confident', 'Energetic'].includes(m))) {
    scores.Ovulatory += 3; signals.push('peak energy and confidence')
  }
  if (!isNaN(latestRHR) && rhrBaseline && latestRHR > rhrBaseline + 1.5) {
    scores.Ovulatory += 3; signals.push('heart rate elevated above baseline')
    // Also counts for Luteal. RHR elevated in both phases
    scores.Luteal += 2
  }

  // ── TEMPERATURE signals, wrist temp elevation confirms luteal ──────────────
  // Source: Charkoudian & Stachenfeld Comprehensive Physiology 2014; Zhu et al. JMIR 2021
  if (tempValues.length >= 2 && tempBaseline) {
    const latestTemp = tempValues[0]
    if (latestTemp - tempBaseline >= 0.2) {
      scores.Luteal += 3; signals.push('wrist temperature elevated above baseline')
    }
    if (latestTemp - tempBaseline < 0.05 && tempBaseline > 0) {
      scores.Follicular += 2; signals.push('wrist temperature at baseline')
    }
  }

  // ── Progesterone lab confirms ovulation has occurred → strong luteal signal ──
  // (Previously this was only used when a period date existed; now it helps infer the
  // cycle for users with no period date who log a lab result.)
  if (logs.some(l => parseFloat(l.hormone_progesterone) >= 10)) {
    scores.Luteal += 3; signals.push('progesterone confirms ovulation passed')
  }

  // ── LUTEAL signals (2 points each) ─────────────────────────────────────────
  if (allSymptoms.some(s => ['Bloating', 'Breast tenderness', 'Cravings', 'Mood swings'].includes(s))) {
    scores.Luteal += 2; signals.push('luteal symptoms (bloating, breast tenderness, cravings)')
  }
  if (energyValues.some(e => e === 'Low' || e === 'Very low')) {
    scores.Luteal += 2; signals.push('low energy')
  }
  if (allFluid.some(f => f === 'Sticky or crumbly' || f === 'None or dry')) {
    scores.Luteal += 2; signals.push('low cervical fluid')
  }
  if (allMoods.some(m => ['Anxious', 'Tired', 'Sad', 'Irritable'].includes(m))) {
    scores.Luteal += 2; signals.push('anxious or low mood')
  }
  if (sleepValues.some(s => s === 'Poor' || s === 'Disrupted')) {
    scores.Luteal += 2
    if (!signals.includes('poor sleep')) signals.push('disrupted sleep')
  }

  const uniqueSignals = [...new Set(signals)]

  if (uniqueSignals.length < 3) {
    return { inferredPhase: null, confidence: 'insufficient', source: 'symptom_inference' }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const inferredPhase = sorted[0][0]

  let confidence, confidencePct
  if (uniqueSignals.length >= 5) { confidence = 'high'; confidencePct = 75 }
  else if (uniqueSignals.length >= 3) { confidence = 'medium'; confidencePct = 55 }
  else { confidence = 'low'; confidencePct = 30 }

  return {
    inferredPhase,
    confidence,
    confidencePct,
    signals: uniqueSignals.slice(0, 5),
    source: 'symptom_inference'
  }
}

// ── Path-specific status builders ────────────────────────────────────────────
// Each returns the same shape as getTodayStatus(). Logic is unchanged, these
// are extractions only so getTodayStatus() stays readable as an orchestrator.

// Path 5: currently on hormonal birth control (not copper IUD)
// Hormonal environment depends on method, do not treat all BC the same.
// Combined pill/patch/ring: stable synthetic estrogen, no cycle-based targets.
// Progestin-only (mini pill, implant, Depo, hormonal IUD): lower estrogen influence.
function buildPath5Status(profile, recentLogs, totalLogs = 0) {
  const bcType = profile?.bc_type
  const isCombined = ['pill', 'patch', 'ring'].includes(bcType)
  const bcPhase = isCombined ? 'bc-combined' : 'bc-progestin'
  // Grows with lifetime history, not just the last 7 days, so it never resets.
  const bcConfidence = Math.min(0.75, 0.25 + (totalLogs * 0.012))
  const bodyWeight = profile?.body_weight_kg || 65
  const intensity = isCombined ? 0.90 : 0.85
  const intensityLabel = isCombined
    ? 'Consistent training window. Your energy is more stable than a naturally cycling woman.'
    : 'Moderate to good intensity. Tune in to how you feel each day.'
  const subPhase = isCombined ? 'Combined pill'
    : bcType === 'minipill' ? 'Mini pill'
    : bcType === 'implant' ? 'Implant'
    : bcType === 'depo' ? 'Depo-Provera'
    : bcType === 'hormonal-iud' ? 'Hormonal IUD'
    : 'Progestin-only'
  return {
    phase: bcPhase,
    subPhase,
    cycleDay: null,
    cycleLen: null,
    daysUntilPeriod: null,
    confidence: bcConfidence,
    confidenceLabel: bcConfidence > 0.45
      ? 'Your personal pattern is emerging'
      : 'Building your baseline. Tracking energy, mood, sleep, and workouts.',
    confidencePct: Math.round(bcConfidence * 100),
    intensityModifier: intensity,
    intensityLabel,
    nutritionTargets: getNutritionTargets(bcPhase, bodyWeight, profile?.diet_preference),
    immediateFeedback: [],
    anomalies: [],
    predictions: [],
    symptomInference: null,
    moodInsight: null,
    bodyWeight,
    profile: profile || {},
    recentLogs,
    personalisedFocus: getPersonalisedNutritionFocus(recentLogs),
    workoutReadiness: getPersonalisedWorkoutReadiness(recentLogs),
  }
}

// Path 4: perimenopause/menopause, skip all cycle phase calculations.
// Cycle data may exist from before they chose Path 4 but must not drive phase logic.
function buildPath4Status(profile, recentLogs, totalLogs = 0) {
  // Setup saves bc_type as the display string the user picked
  // ('Early perimenopause' / 'Late perimenopause' / 'Menopause 12+ months').
  // Map those to the subPhase label. Null/unknown defaults to Early perimenopause.
  const stage = profile?.bc_type || ''
  const subPhase = stage.startsWith('Menopause') ? 'Postmenopause'
    : stage.startsWith('Late') ? 'Late perimenopause'
    : 'Early perimenopause'
  // Grows with lifetime history, not just the last 7 days, so it never resets.
  const confidence = Math.min(0.80, 0.30 + (totalLogs * 0.014))
  const bodyWeight = profile?.body_weight_kg || 65
  const anomalies = detectAnomalies(recentLogs, 'Perimenopause', null, {
    daysLogged: recentLogs.length,
    confidence,
    cyclesTracked: 0,
    userPath: '4',
    bcType: profile?.bc_type
  })
  return {
    phase: 'Perimenopause',
    subPhase,
    cycleDay: null,
    cycleLen: null,
    daysUntilPeriod: null,
    confidence,
    confidenceLabel: confidence > 0.55 ? 'Your symptom pattern is becoming clear'
      : 'Building your perimenopause baseline',
    confidencePct: Math.round(confidence * 100),
    intensityModifier: getIntensityModifier('Perimenopause', null),
    intensityLabel: 'Train to how you feel, listen to your body above all else.',
    nutritionTargets: getNutritionTargets('Perimenopause', bodyWeight, profile?.diet_preference),
    immediateFeedback: getImmediateFeedback(recentLogs[0], 'Perimenopause', subPhase, confidence),
    anomalies,
    predictions: [],
    symptomInference: null,
    moodInsight: interpretMoodSignal(recentLogs[0], recentLogs, 'Perimenopause', subPhase).insight,
    bodyWeight,
    profile: profile || {},
    recentLogs,
    personalisedFocus: getPersonalisedNutritionFocus(recentLogs),
    workoutReadiness: getPersonalisedWorkoutReadiness(recentLogs),
  }
}

// ── Pregnancy (path 6) ───────────────────────────────────────────────────────
// Gestational week + trimester from the due date (pregnancy ~40 weeks; week = 40 − weeks-to-due).
export function getPregnancyWeek(dueDate) {
  if (!dueDate) return null
  const due = new Date(dueDate + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const week = 40 - Math.round((due - today) / (7 * 86400000))
  return Math.max(1, Math.min(42, week))
}
export function getTrimester(week) {
  if (week == null) return null
  if (week <= 13) return 'First trimester'
  if (week <= 27) return 'Second trimester'
  return 'Third trimester'
}

// Pregnancy mode: cycle tracking pauses entirely. Guidance is provider-led, supportive, and
// educational, never prescriptive prenatal exercise/medical advice. Nutrition targets follow
// Health Canada / ACOG (protein ~1.1 g/kg; +0/+340/+450 kcal by trimester). Sources for content:
// SOGC 2019 prenatal activity guideline; ACOG Committee Opinion 804; Health Canada prenatal nutrition.
function buildPregnancyStatus(profile, recentLogs, totalLogs = 0) {
  const bodyWeight = profile?.body_weight_kg || 65
  const week = getPregnancyWeek(profile?.pregnancy_due_date)
  const tri = getTrimester(week) || 'Pregnancy'
  const extra = tri === 'First trimester' ? 0 : tri === 'Second trimester' ? 340 : 450
  return {
    phase: 'Pregnancy',
    subPhase: tri,
    pregnancyWeek: week,
    cycleDay: null,
    cycleLen: null,
    daysUntilPeriod: null,
    confidence: null,
    confidenceLabel: 'Pregnancy mode',
    confidencePct: null,
    intensityModifier: 0.6,
    intensityLabel: 'Movement in pregnancy should be guided by your doctor or midwife. Keep it gentle and stop if anything feels wrong.',
    nutritionTargets: {
      proteinG: Math.round(bodyWeight * 1.1),
      extraCalories: extra,
      headline: tri === 'First trimester'
        ? 'No extra calories needed yet. Focus on folate, iron, and steady nutrition.'
        : `About +${extra} kcal a day this trimester, and protein at every meal.`,
      keyFoods: ['Prenatal vitamin (folate + iron)', 'Iron-rich foods with vitamin C', 'Calcium sources', 'Low-mercury fish or a DHA source', 'Plenty of water'],
      avoid: 'Alcohol (none), high-mercury fish, unpasteurised dairy and soft cheeses, deli meats unless steaming hot, raw or undercooked meat/eggs/fish, and caffeine over about 200mg a day.',
      source: 'Health Canada Prenatal Nutrition Guidelines; ACOG. Confirm all amounts with your doctor, midwife, or dietitian.'
    },
    immediateFeedback: [],
    anomalies: [],
    predictions: [],
    symptomInference: null,
    moodInsight: null,
    bodyWeight,
    profile: profile || {},
    recentLogs,
    personalisedFocus: null,
    workoutReadiness: null,
  }
}

// All other paths: calculate phase from period date, or infer from symptoms.
// Copper IUD users (path 5, isCopper) also route here, no hormones, natural cycle intact.
function buildCycleStatus(profile, cycleData, recentLogs, mucusLogs, today, totalLogs = 0) {
  let phase = 'observation'
  let subPhase = null
  let cycleDay = null
  let cycleLen = 28
  let daysUntilPeriod = null
  let confidence = 0.05
  let symptomInference = null
  let estimated = false   // true when phase is inferred from symptoms, not a logged period

  const cycleHistory = computeCycleHistory(cycleData, profile?.cycle_length)
  const { cyclesTracked, avgCycleLength } = cycleHistory

  if (cycleData?.last_period_date) {
    const lastPeriod = new Date(cycleData.last_period_date + 'T00:00:00')
    const diffDays = Math.floor((today - lastPeriod) / 86400000)
    cycleDay = diffDays + 1
    cycleLen = cycleData.cycle_length || 28
    daysUntilPeriod = Math.max(0, cycleLen - cycleDay + 1)

    if (cycleDay > 0 && cycleDay <= cycleLen + 7) {
      phase = getPhase(cycleDay, cycleLen, cycleData.period_length)
      if (phase === 'Luteal') subPhase = getLutealSubPhase(cycleDay, cycleLen)
      if (phase === 'Follicular') subPhase = getFollicularSubPhase(cycleDay)
      confidence = calcConfidence(phase, subPhase, recentLogs, mucusLogs, totalLogs, cyclesTracked)
      // Run inference alongside as supporting evidence even when phase is confirmed
      symptomInference = inferPhaseFromSymptoms(recentLogs, mucusLogs)
    }
  } else {
    // No period date logged. Reading the body's signals when there's no anchor is the
    // core job of the app, so we promote the symptom inference to the working phase, // but flagged as `estimated` and carrying the inference's (lower) confidence, never
    // the certainty of a calculated phase. Every screen reads this same value, so they
    // stay consistent (an earlier version inferred per-screen and they disagreed).
    // When there aren't enough signals (<3) to call it, we stay in honest observation.
    // NOTE: estimated confidence stays below a logged-cycle's, see confidencePct.
    symptomInference = inferPhaseFromSymptoms(recentLogs, mucusLogs)
    if (symptomInference?.inferredPhase) {
      phase = symptomInference.inferredPhase
      estimated = true
      confidence = (symptomInference.confidencePct || 30) / 100
    } else {
      // Not enough signal yet, grow confidence slowly so observation does not sit at
      // 5% forever, but keep it modest (capped) since there is no cycle to anchor to.
      confidence = Math.min(0.45, 0.05 + totalLogs * 0.03)
    }
  }

  // Late / missed period: past the expected start (day cycleLen+1) the app must not keep
  // showing "PMS, period in 0 days", it should acknowledge the period is late and, because
  // this is a fertility-aware app, prompt a pregnancy test if relevant. Surfaced on the dashboard.
  const latePeriod = cycleDay != null && cycleDay > cycleLen + 1
  const daysLate = latePeriod ? cycleDay - cycleLen - 1 : 0
  const latePeriodInsights = latePeriod ? getLatePeriodInsights(recentLogs, profile, cycleHistory) : []

  // Concrete next-period prediction from the user's own logged history (most-likely date + a
  // window that reflects her real cycle variability). Null until a period has been logged.
  const nextPeriodPrediction = cycleData?.last_period_date
    ? predictNextPeriod(cycleData.last_period_date, avgCycleLength, cyclesTracked, cycleHistory.gaps)
    : null

  const intensityModifier = getIntensityModifier(phase, subPhase)
  const bodyWeight = profile?.body_weight_kg || 65
  // Logged hormone labs confirm the picture: progesterone >=10 nmol/L confirms ovulation,
  // so trust the cycle much more when a lab backs it up, and expose the confirmation for
  // the future fertility feature. (Previously these labs were captured but never used.)
  const hormoneSignals = interpretHormones(recentLogs[0])
  if (hormoneSignals?.ovulationConfirmed) confidence = Math.max(confidence, 0.85)

  return {
    phase,
    subPhase,
    cycleDay,
    cycleLen,
    periodLength: cycleData?.period_length || null,
    cyclesTracked,
    avgCycleLength,
    daysUntilPeriod,
    latePeriod,
    daysLate,
    latePeriodInsights,
    nextPeriodPrediction,
    estimated,
    ovulationConfirmed: hormoneSignals?.ovulationConfirmed || false,
    hormoneSignals,
    confidence,
    confidenceLabel: confidence > 0.90 ? 'Fully personalised'
      : confidence > 0.75 ? 'Your personal baseline established'
      : confidence > 0.55 ? 'Mostly your data now'
      : confidence > 0.30 ? 'Your personal pattern is emerging'
      : 'Learning your baseline',
    confidencePct: Math.round(confidence * 100),
    intensityModifier,
    intensityLabel: getIntensityLabel(intensityModifier),
    nutritionTargets: getNutritionTargets(phase, bodyWeight, profile?.diet_preference),
    immediateFeedback: getImmediateFeedback(recentLogs[0], phase, subPhase, confidence),
    anomalies: detectAnomalies(recentLogs, phase, cycleLen, {
      daysLogged: recentLogs.length,
      confidence,
      cycleDay,
      cyclesTracked: profile?.cycles_tracked || 0,
      userPath: profile?.user_path,
      bcType: profile?.bc_type
    }),
    predictions: getPredictions(phase, cycleDay, cycleLen),
    symptomInference,
    moodInsight: interpretMoodSignal(recentLogs[0], recentLogs, phase, subPhase).insight,
    bodyWeight,
    profile: profile || {},
    recentLogs,
    personalisedFocus: getPersonalisedNutritionFocus(recentLogs),
    workoutReadiness: getPersonalisedWorkoutReadiness(recentLogs),
  }
}

// ── Main exported function ───────────────────────────────────────────────────
// Fetches all data in parallel, then dispatches to the appropriate builder
// based on user path. Return shape is identical across all paths.
export async function getTodayStatus(supabase, userId) {
  const [cycleResult, profileResult, logsResult, mucusResult, totalLogsResult] = await Promise.all([
    supabase.from('cycle_data').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('daily_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(7),
    supabase.from('mucus_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(7),
    // Lifetime log count drives confidence growth, the algorithm learns across the
    // user's whole history, not just the last 7 days, so confidence only ever rises.
    supabase.from('daily_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId)
  ])

  const cycleData = cycleResult.data
  const profile = profileResult.data
  const recentLogs = logsResult.data || []
  const mucusLogs = mucusResult.data || []
  const totalLogs = totalLogsResult.count || recentLogs.length
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // Path 5: on hormonal BC. Combined pills/patch/ring (and Depo/implant/hormonal IUD)
  // suppress ovulation and hold the body's own hormones low and steady, so there are no
  // follicular/ovulatory/luteal phases to track, we never fake a cycle for them, even if
  // a withdrawal-bleed date exists. They get the steady BC baseline instead. Copper IUD is
  // non-hormonal and keeps a natural cycle, so it always uses the normal cycle path.
  if (profile?.user_path === '5' && profile?.bc_type !== 'copper-iud') {
    return buildPath5Status(profile, recentLogs, totalLogs)
  }

  // Path 6: pregnancy, cycle tracking pauses; provider-led supportive/educational mode.
  if (profile?.user_path === '6') {
    return buildPregnancyStatus(profile, recentLogs, totalLogs)
  }

  // Path 4: perimenopause/menopause, skip all cycle phase calculations
  if (profile?.user_path === '4') {
    return buildPath4Status(profile, recentLogs, totalLogs)
  }

  // All other paths (1, 2, 3) + copper IUD users: phase from cycle data or symptom inference
  let status = buildCycleStatus(profile, cycleData, recentLogs, mucusLogs, today, totalLogs)

  // Cycle guardian: if a connected wearable has CONFIRMED ovulation from temperature, anchor the
  // phase to the body's own signal instead of the calendar. No-op on web / for non-connected
  // users (no stored signal), and it never touches BC/pregnancy/perimenopause states.
  status = applyWearableOvulationFromStorage(status, cycleData?.last_period_date)

  // Persist the accumulated learning so it survives across sessions and feeds VisitPrep and
  // the personal-baseline card (these tables were previously read but NEVER written, the
  // learning engine simply didn't exist). Best-effort: never let a baseline write break the
  // dashboard, and RLS keeps it scoped to the user's own row.
  try {
    await supabase.from('user_baselines').upsert({
      id: userId,
      cycles_tracked: status.cyclesTracked || 0,
      avg_cycle_length: status.avgCycleLength || null,
      avg_luteal_length: 14,
      model_confidence: status.confidence != null ? Math.round(status.confidence * 100) / 100 : null,
    }, { onConflict: 'id' })
  } catch { /* non-fatal, confidence is computed live regardless of this write */ }

  return status
}
