// hormoneSync.js — shared algorithm module
// All phase logic lives here. Import getTodayStatus into every screen.
import { interpretMoodSignal, detectPMDDPattern, getMoodContextFeedback, checkFlag, getPersonalisedNutritionFocus, getPersonalisedWorkoutReadiness } from './algorithm_v3.js'

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

// Source: CLAUDE.md canonical period prediction — export so all screens use same logic
export const predictNextPeriod = (lastPeriodDate, avgCycleLength, cyclesTracked) => {
  const lastPeriod = new Date(lastPeriodDate + 'T00:00:00')
  const predictedDate = new Date(lastPeriod)
  predictedDate.setDate(predictedDate.getDate() + Math.round(avgCycleLength))
  const windowStart = new Date(predictedDate)
  windowStart.setDate(windowStart.getDate() - 2)
  const windowEnd = new Date(predictedDate)
  windowEnd.setDate(windowEnd.getDate() + 2)
  const confidence = cyclesTracked >= 3 ? 'high'
    : cyclesTracked === 2 ? 'moderate'
    : cyclesTracked === 1 ? 'low'
    : 'none'
  return { predictedDate, windowStart, windowEnd, confidence }
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
  if (phase === 'Perimenopause') return 0.82 // moderate — train to how you feel, symptom-driven
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
    Ovulatory:    { multiplier: 1.8, extra: 0,   headline: 'Peak output needs peak fuel.', keyFoods: ['Beef', 'Chickpeas', 'Berries', 'Dark leafy greens', 'Salmon'], avoid: null, source: 'ISSN 2023. Peak training output requires peak protein intake. Zinc from beef and seeds supports enzymatic processes around ovulation.' },
    Luteal:       { multiplier: 1.8, extra: 250, headline: 'Your body needs more today. That is biology.', keyFoods: ['Sweet potato', 'Oats', 'Dark chocolate', 'Salmon', 'Eggs', 'Pumpkin seeds'], avoid: 'Avoid alcohol and high-sugar processed foods which worsen luteal phase inflammation.', source: 'ISSN 2023. Luteal phase protein 1.8 to 2.2g per kg due to progesterone catabolism. Add 200 to 300 kcal above follicular phase intake.' },
    observation:  { multiplier: 1.6, extra: 0,   headline: 'Consistent nutrition builds your baseline', keyFoods: ['Protein source each meal', 'Complex carbohydrates', 'Healthy fats', 'Leafy greens'], avoid: null, source: null },
    'bc-combined': { multiplier: 1.6, extra: 0, headline: 'Consistent protein. No cycle-based adjustments needed.', keyFoods: ['Chicken', 'Eggs', 'Greek yogurt', 'Lentils', 'Oats', 'Leafy greens'], avoid: null, source: 'ISSN 2023. Standard 1.6g per kg supports muscle maintenance. No luteal phase protein increase needed as natural progesterone catabolism is absent.' },
    'bc-progestin': { multiplier: 1.7, extra: 0, headline: 'Protein and bone support are the priority.', keyFoods: ['Salmon', 'Eggs', 'Chicken', 'Sardines', 'Almonds', 'Dark leafy greens'], avoid: null, source: 'ISSN 2023. Calcium and vitamin D especially important when estrogen is low. Protein 1.6 to 1.8g per kg for muscle and bone maintenance.' },
    Perimenopause: { multiplier: 1.8, extra: 0, headline: 'Protein first. Bone protection second.', keyFoods: ['Salmon', 'Chicken', 'Eggs', 'Sardines', 'Dark leafy greens', 'Almonds'], avoid: 'Limit alcohol — worsens hot flashes, disrupts sleep, and increases breast cancer risk. Limit ultra-processed foods which worsen insulin resistance.', source: 'ISSN 2023. Protein 1.6 to 2.0g per kg for women in hormonal transition. Kohrt et al. MSSE 2004 for calcium and vitamin D in bone protection.' }
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
      anomalies.push({ type: 'peri_joint', text: 'Joint pain flagged over several days this week. Estrogen has anti-inflammatory effects — its decline in perimenopause can cause or worsen joint symptoms. Resistance training, omega-3 fatty acids, and maintaining a healthy weight are all supported by evidence. Worth mentioning to your doctor if it is limiting your activity.' })
    }
    // Brain fog tracking
    const highBrainFog = recentLogs.filter(l => (l.brain_fog_rating || 0) >= 3).length
    if (recentLogs.length >= 3 && highBrainFog >= 2) {
      anomalies.push({ type: 'peri_brainfog', text: 'Brain fog noted over several days. Cognitive changes during perimenopause are real and driven by fluctuating estrogen — estrogen directly supports serotonin and dopamine activity in the brain. Strength training, sleep, and omega-3 fatty acids are among the most evidence-backed interventions. (Osborn et al. Frontiers in Pharmacology 2025)' })
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

  // Severe period pain — potential flag for investigation
  // Source: Nnoaham et al. Fertility and Sterility 2011 (diagnostic delay)
  if (canObserve && (latest.pain_rating >= 4) && phase === 'Menstrual') {
    anomalies.push({ type: 'pain_high', text: 'You logged significant pain today. Severe period pain is not something you have to simply push through — it is worth taking seriously. Some women find that tracking this pattern over time gives them useful information to bring to a healthcare provider. If pain like this happens regularly, it may be worth discussing with your doctor. (Nnoaham et al. Fertility and Sterility 2011)' })
  }

  // High disruptors in luteal phase amplify stress response
  // Source: Hackney 2006 — cortisol competes with progesterone in luteal phase
  const activeDisruptors = (latest.disruptors || []).filter(d => d !== 'None of these')
  if (canObserve && activeDisruptors.length >= 2 && (phase === 'Luteal' || phase === 'Late luteal')) {
    anomalies.push({ type: 'luteal_load', text: 'You have logged multiple stressors today in your luteal phase. Alcohol, poor sleep, illness, and high stress all compound the cortisol load that is already elevated in the luteal phase. Your body is working harder than usual right now. Rest, eat enough protein, and consider dropping training intensity by 20% today. (Hackney 2006)' })
  }

  // PMDD pattern: requires 3 cycles of data before flagging
  // Source: DSM-5 PMDD criteria; Osborn et al. Frontiers in Pharmacology 2025
  if (canFlag && checkFlag('pmdd_pattern_flag', flagStats)) {
    const pmddResult = detectPMDDPattern(recentLogs, cycleLen)
    if (pmddResult) {
      // Rewrite with warm non-diagnostic framing
      anomalies.push({
        ...pmddResult,
        message: 'We have noticed a consistent mood pattern across your last few cycles — you tend to feel significantly more low or anxious in the week before your period, and noticeably better once it begins. This kind of cyclical pattern is worth knowing about. It has a specific biological explanation and there are effective approaches to managing it. If it is disrupting your life, it is worth raising with your doctor and specifically mentioning the cyclical timing — that detail matters for how it is assessed.'
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

  // ── TEMPERATURE signals — wrist temp elevation confirms luteal ──────────────
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

// ── Path-specific status builders ────────────────────────────────────────────
// Each returns the same shape as getTodayStatus(). Logic is unchanged — these
// are extractions only so getTodayStatus() stays readable as an orchestrator.

// Path 5: currently on hormonal birth control (not copper IUD)
// Hormonal environment depends on method — do not treat all BC the same.
// Combined pill/patch/ring: stable synthetic estrogen, no cycle-based targets.
// Progestin-only (mini pill, implant, Depo, hormonal IUD): lower estrogen influence.
function buildPath5Status(profile, recentLogs) {
  const bcType = profile?.bc_type
  const isCombined = ['pill', 'patch', 'ring'].includes(bcType)
  const bcPhase = isCombined ? 'bc-combined' : 'bc-progestin'
  const bcConfidence = Math.min(0.65, 0.25 + (recentLogs.length * 0.04))
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
    nutritionTargets: getNutritionTargets(bcPhase, bodyWeight),
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

// Path 4: perimenopause/menopause — skip all cycle phase calculations.
// Cycle data may exist from before they chose Path 4 but must not drive phase logic.
function buildPath4Status(profile, recentLogs) {
  const stage = profile?.bc_type || 'peri-early'
  const subPhase = stage === 'menopause' ? 'Postmenopause'
    : stage === 'peri-late' ? 'Late perimenopause' : 'Early perimenopause'
  const confidence = Math.min(0.75, 0.30 + (recentLogs.length * 0.05))
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
    intensityLabel: 'Train to how you feel — listen to your body above all else.',
    nutritionTargets: getNutritionTargets('Perimenopause', bodyWeight),
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

// All other paths: calculate phase from period date, or infer from symptoms.
// Copper IUD users (path 5, isCopper) also route here — no hormones, natural cycle intact.
function buildCycleStatus(profile, cycleData, recentLogs, mucusLogs, today) {
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
    // No cycle data — keep symptom inference as a SUPPORTING signal only; do NOT
    // promote it to the headline phase. Showing an inferred phase (e.g. "Luteal")
    // with a confidence % contradicted the "observation" mode shown on the dashboard
    // and overstated certainty — for a no-cycle-data user (e.g. Depo recovery) the
    // honest state is observation. (CLAUDE.md: never show an inferred phase with the
    // same confidence as a calculated one.) The inference is still returned below so
    // screens can surface it as a clearly-labelled soft hint.
    symptomInference = inferPhaseFromSymptoms(recentLogs, mucusLogs)
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
  const [cycleResult, profileResult, logsResult, mucusResult] = await Promise.all([
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

  // Path 5: on hormonal BC — skip cycle logic (unless copper IUD, which is non-hormonal)
  if (profile?.user_path === '5' && profile?.bc_type !== 'copper-iud') {
    return buildPath5Status(profile, recentLogs)
  }

  // Path 4: perimenopause/menopause — skip all cycle phase calculations
  if (profile?.user_path === '4') {
    return buildPath4Status(profile, recentLogs)
  }

  // All other paths (1, 2, 3) + copper IUD users: phase from cycle data or symptom inference
  return buildCycleStatus(profile, cycleData, recentLogs, mucusLogs, today)
}
