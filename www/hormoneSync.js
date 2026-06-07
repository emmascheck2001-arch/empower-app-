// hormoneSync.js — shared algorithm module
// All phase logic lives here. Import getTodayStatus into every screen.
import { interpretMoodSignal, detectPMDDPattern, getMoodContextFeedback, checkFlag } from './algorithm_v3.js'

// ── Phase calculation (canonical — never duplicate this elsewhere) ──────────
export function getPhase(cycleDay, cycleLen) {
  const ovulation = Math.round(cycleLen / 2)
  if (cycleDay <= 5) return 'Menstrual'
  if (cycleDay <= ovulation - 2) return 'Follicular'
  if (cycleDay <= ovulation + 1) return 'Ovulatory'
  return 'Luteal'
}

export function getLutealSubPhase(cycleDay, cycleLen) {
  const ovulation = Math.round(cycleLen / 2)
  const lutealDay = cycleDay - ovulation - 1
  if (lutealDay <= 4) return 'Early luteal'
  if (lutealDay <= 9) return 'Mid luteal'
  return 'Late luteal'
}

function getFollicularSubPhase(cycleDay) {
  // Early follicular: days 6-9, late follicular: day 10+
  return cycleDay <= 9 ? 'Early follicular' : 'Late follicular'
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
  return 0.72 // observation — mirrors menstrual/low-estrogen environment
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
export function getNutritionTargets(phase, bodyWeight) {
  const bw = bodyWeight || 65
  const targets = {
    Menstrual:    { multiplier: 1.5, extra: 0,   headline: 'Iron day. Your body is replenishing.', keyFoods: ['Red meat', 'Spinach', 'Lentils', 'Pumpkin seeds', 'Citrus'], avoid: 'Limit caffeine above 200mg as it may worsen prostaglandin-driven cramps.', source: 'ISSN 2023; Angeli et al. 2016. Iron loss during menstruation impacts performance.' },
    Follicular:   { multiplier: 1.7, extra: 0,   headline: 'Build phase. Fuel hard training.', keyFoods: ['Eggs', 'Chicken', 'Oats', 'Whole grains', 'Leafy greens'], avoid: null, source: 'ISSN 2023. Estrogen improves carbohydrate metabolism in the follicular phase.' },
    Ovulatory:    { multiplier: 1.8, extra: 0,   headline: 'Peak output needs peak fuel.', keyFoods: ['Beef', 'Chickpeas', 'Berries', 'Dark leafy greens', 'Salmon'], avoid: null, source: 'ISSN 2023; Larivière et al. 2006. Zinc supports the LH surge.' },
    Luteal:       { multiplier: 2.0, extra: 250, headline: 'Your body needs more today. That is biology.', keyFoods: ['Sweet potato', 'Oats', 'Dark chocolate', 'Salmon', 'Eggs', 'Pumpkin seeds'], avoid: 'Avoid alcohol and high-sugar processed foods which worsen luteal phase inflammation.', source: 'ISSN 2023. Luteal phase protein 1.8 to 2.2g per kg due to progesterone catabolism. Add 200 to 300 kcal above follicular phase intake.' },
    observation:  { multiplier: 1.6, extra: 0,   headline: 'Consistent nutrition builds your baseline', keyFoods: ['Protein source each meal', 'Complex carbohydrates', 'Healthy fats', 'Leafy greens'], avoid: null, source: null }
  }
  const t = targets[phase] || targets.observation
  return {
    proteinG: Math.round(bw * t.multiplier),
    extraCalories: t.extra,
    headline: t.headline,
    keyFoods: t.keyFoods,
    avoid: t.avoid,
    source: t.source
  }
}

// ── Confidence calculation ───────────────────────────────────────────────────
function calcConfidence(phase, subPhase, recentLogs, mucusLogs) {
  let confidence = 0.45

  if (recentLogs?.length) {
    confidence += Math.min(0.25, recentLogs.length * 0.04)
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
    confidence += moodResult.confidenceAdjustment
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

  return Math.min(0.92, Math.max(0.05, confidence))
}

// ── Anomaly detection ────────────────────────────────────────────────────────
// Language rules: start with what the woman is experiencing, never use diagnostic headers,
// always warm and curious — never alarming or clinical. (Per CLAUDE.md tone rules.)
function detectAnomalies(recentLogs, phase, cycleLen, flagStats) {
  const anomalies = []
  if (!recentLogs?.length) return anomalies

  const latest = recentLogs[0]
  if (!latest) return anomalies

  // pattern_observation threshold required for most anomaly observations
  const canObserve = checkFlag('pattern_observation', flagStats)
  const canFlag = checkFlag('health_pattern_flag', flagStats)

  if (canObserve && latest.energy === 'Very low' && phase === 'Follicular') {
    anomalies.push({ type: 'energy_mismatch', text: 'Your energy today is lower than expected for this phase. This sometimes happens when recovery is incomplete, when you have been under-fuelling, or when your energy rise is simply starting a little later than usual. Worth keeping an eye on over the next few days.' })
  }
  if (canObserve && latest.energy === 'High' && phase === 'Menstrual') {
    anomalies.push({ type: 'energy_high_menstrual', text: 'Interesting — high energy during your period. Some women notice a brief energy surge on day 1 or 2 before cramps set in, as the drop in hormones briefly lifts mood. Log how your training feels today.' })
  }

  const rhr = parseFloat(latest.resting_hr)
  if (canObserve && !isNaN(rhr) && rhr > 75 && (phase === 'Follicular' || phase === 'Ovulatory')) {
    anomalies.push({ type: 'rhr_elevated', text: 'Your resting heart rate is on the higher side for this phase. This can reflect poor recovery, early illness, or a stressful few days. Consider dialling back intensity today and prioritising sleep. If it stays elevated for a week, worth mentioning to your doctor.' })
  }

  const cortisol = parseFloat(latest.hormone_cortisol)
  if (canObserve && !isNaN(cortisol) && cortisol > 30) {
    anomalies.push({ type: 'cortisol_elevated', text: 'Your cortisol reading this morning is above the typical range (above 30 nmol/L, LifeLabs/EORLA). High cortisol and progesterone compete directly in the body, which can affect how well you recover from training. Consider a lighter session today. (Source: Hackney 2006.)' })
  }

  // PMDD pattern: requires 3 cycles of data before flagging
  // Source: DSM-5 PMDD criteria; Osborn et al. Frontiers in Pharmacology 2025
  if (canFlag && checkFlag('pmdd_pattern_flag', flagStats)) {
    const pmddResult = detectPMDDPattern(recentLogs, cycleLen)
    if (pmddResult) {
      // Rewrite with warm non-diagnostic framing
      anomalies.push({
        ...pmddResult,
        message: 'We have noticed a consistent mood pattern across your last few cycles — you tend to feel significantly more low or anxious in the week before your period, and noticeably better once it begins. This kind of cyclical pattern is worth knowing about. It has a specific biological explanation and there are effective approaches to managing it. If it is disrupting your life, it is worth raising with your doctor and specifically mentioning the cyclical timing — that detail matters for how it is assessed. This is a pattern observation, not a diagnosis.'
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

  // Mood context feedback — connects logged mood to neurotransmitter explanation
  // Source: Backstrom et al. 2008; Lokuge et al. 2011; algorithm_v3.js
  const moodFeedback = getMoodContextFeedback(latestLog, phase, subPhase)
  if (moodFeedback) feedback.push(moodFeedback)

  return feedback
}

// ── Predictions ──────────────────────────────────────────────────────────────
function getPredictions(phase, cycleDay, cycleLen) {
  if (!cycleDay || !cycleLen) return []
  const predictions = []
  const ovulation = Math.round(cycleLen / 2)

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
// Source: Janse de Jonge 2003 Sports Medicine — personal tracking improves prediction accuracy.
// Source: Bigelow et al. 2004 Human Reproduction — egg white fluid 80% sensitivity for fertile window.
// Source: De Martin Topranin et al. 2023 IJSPP — RHR 1.7 bpm higher mid-luteal vs early follicular.
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
  const rhrValues = logs.map(l => parseFloat(l.resting_hr)).filter(n => !isNaN(n))
  const latestRHR = parseFloat(latestLog.resting_hr)
  // Baseline = average of all logged RHR except the most recent (Zhu et al. 2021)
  const rhrBaseline = rhrValues.length > 1
    ? rhrValues.slice(1).reduce((a, b) => a + b, 0) / (rhrValues.length - 1)
    : null

  const scores = { Menstrual: 0, Follicular: 0, Ovulatory: 0, Luteal: 0 }
  const signals = []

  // ── MENSTRUAL signals (2 points each) ──────────────────────────────────────
  if (allSymptoms.some(s => ['Cramps', 'Bloating', 'Fatigue', 'Back pain'].includes(s))) {
    scores.Menstrual += 2; signals.push('cramping or fatigue symptoms')
  }
  if (energyValues.some(e => e === 'Very low')) {
    scores.Menstrual += 2; signals.push('very low energy')
  }
  if (allMoods.some(m => ['Low', 'Irritable', 'Sad'].includes(m))) {
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
  if (allFluid.some(f => f === 'Creamy' || f === 'Watery')) {
    scores.Follicular += 2; signals.push('creamy or watery cervical fluid')
  }
  if (logs.some(l => ['Strong', 'Great', 'Felt strong'].includes(l.workout_feel))) {
    scores.Follicular += 2; signals.push('strong workout feel')
  }
  if (allSymptoms.length > 0 && !allSymptoms.some(s => ['Cramps', 'Fatigue'].includes(s))) {
    scores.Follicular += 2; signals.push('no pain or fatigue logged')
  }

  // ── OVULATORY signals (3 points each — stronger specificity) ───────────────
  if (allFluid.some(f => f === 'Egg white')) {
    scores.Ovulatory += 3; signals.push('egg white cervical fluid')
  }
  if (logs.some(l => l.lh_result && l.lh_result.toLowerCase() === 'positive')) {
    scores.Ovulatory += 3; signals.push('positive LH test')
  }
  if (energyValues.some(e => e === 'High') && allMoods.some(m => ['Confident', 'Energetic'].includes(m))) {
    scores.Ovulatory += 3; signals.push('peak energy and confidence')
  }
  if (!isNaN(latestRHR) && rhrBaseline && latestRHR > rhrBaseline + 1.5) {
    scores.Ovulatory += 3; signals.push('heart rate elevated above baseline')
    // Also counts for Luteal — RHR elevated in both phases
    scores.Luteal += 2
  }

  // ── LUTEAL signals (2 points each) ─────────────────────────────────────────
  if (allSymptoms.some(s => ['Bloating', 'Sore breasts', 'Cravings', 'Mood swings'].includes(s))) {
    scores.Luteal += 2; signals.push('luteal symptoms (bloating, breast tenderness, cravings)')
  }
  if (energyValues.some(e => e === 'Low' || e === 'Very low')) {
    scores.Luteal += 2; signals.push('low energy')
  }
  if (allFluid.some(f => f === 'Sticky' || f === 'None')) {
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

// ── Main exported function ───────────────────────────────────────────────────
export async function getTodayStatus(supabase, userId) {
  const [
    cycleResult,
    profileResult,
    logsResult,
    mucusResult
  ] = await Promise.all([
    supabase.from('cycle_data').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('daily_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(7),
    supabase.from('mucus_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(7)
  ])

  const cycleData = cycleResult.data
  const profile = profileResult.data
  const recentLogs = logsResult.data || []
  const mucusLogs = mucusResult.data || []

  const today = new Date(); today.setHours(0, 0, 0, 0)

  let phase = 'observation'
  let subPhase = null
  let cycleDay = null
  let cycleLen = 28
  let daysUntilPeriod = null
  let confidence = 0.05

  let symptomInference = null

  if (cycleData?.last_period_date) {
    const lastPeriod = new Date(cycleData.last_period_date + 'T00:00:00')
    const diffDays = Math.floor((today - lastPeriod) / 86400000)
    cycleDay = diffDays + 1
    cycleLen = cycleData.cycle_length || 28
    daysUntilPeriod = Math.max(0, cycleLen - cycleDay + 1)

    if (cycleDay > 0 && cycleDay <= cycleLen + 7) {
      phase = getPhase(cycleDay, cycleLen)
      if (phase === 'Luteal') subPhase = getLutealSubPhase(cycleDay, cycleLen)
      if (phase === 'Follicular') subPhase = getFollicularSubPhase(cycleDay)
      confidence = calcConfidence(phase, subPhase, recentLogs, mucusLogs)
      // Run inference alongside as supporting evidence even when phase is confirmed
      symptomInference = inferPhaseFromSymptoms(recentLogs, mucusLogs)
    }
  } else {
    // No cycle data — use symptom inference as the working phase estimate
    symptomInference = inferPhaseFromSymptoms(recentLogs, mucusLogs)
    if (symptomInference?.inferredPhase) {
      phase = symptomInference.inferredPhase
      confidence = symptomInference.confidencePct / 100
    }
  }

  const intensityModifier = getIntensityModifier(phase, subPhase)
  const bodyWeight = profile?.body_weight_kg || 65

  return {
    phase,
    subPhase,
    cycleDay,
    cycleLen,
    daysUntilPeriod,
    confidence,
    confidenceLabel: confidence > 0.90 ? 'Fully personalised'
      : confidence > 0.75 ? 'Your personal baseline established'
      : confidence > 0.55 ? 'Mostly your data now'
      : confidence > 0.30 ? 'Your personal pattern is emerging'
      : 'Learning your baseline',
    confidencePct: Math.round(confidence * 100),
    intensityModifier,
    intensityLabel: getIntensityLabel(intensityModifier),
    nutritionTargets: getNutritionTargets(phase, bodyWeight),
    immediateFeedback: getImmediateFeedback(recentLogs[0], phase, subPhase, confidence),
    anomalies: detectAnomalies(recentLogs, phase, cycleLen, {
      daysLogged: recentLogs.length,
      confidence,
      cyclesTracked: profile?.cycles_tracked || 0,
      userPath: profile?.user_path,
      bcType: profile?.bc_type
    }),
    predictions: getPredictions(phase, cycleDay, cycleLen),
    symptomInference,
    moodInsight: interpretMoodSignal(recentLogs[0], recentLogs, phase, subPhase).insight,
    bodyWeight,
    profile: profile || {}
  }
}
