// hormoneSync.js — shared algorithm module
// All phase logic lives here. Import getTodayStatus into every screen.

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
function calcConfidence(phase, recentLogs, mucusLogs) {
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
function detectAnomalies(recentLogs, phase) {
  const anomalies = []
  if (!recentLogs?.length) return anomalies

  const latest = recentLogs[0]
  if (!latest) return anomalies

  if (latest.energy === 'Very low' && phase === 'Follicular') {
    anomalies.push({ type: 'energy_mismatch', text: 'Very low energy in follicular phase is unexpected. This may reflect incomplete recovery, under-fuelling, or a later start to your energy rise. Worth monitoring.' })
  }
  if (latest.energy === 'High' && phase === 'Menstrual') {
    anomalies.push({ type: 'energy_high_menstrual', text: 'High energy during menstruation is worth noting. Some women feel a surge of energy on day 1 or 2 before cramps set in. Log how your training feels.' })
  }

  const rhr = parseFloat(latest.resting_hr)
  if (!isNaN(rhr) && rhr > 75 && (phase === 'Follicular' || phase === 'Ovulatory')) {
    anomalies.push({ type: 'rhr_elevated', text: 'Elevated resting heart rate in follicular or ovulatory phase. This may indicate poor recovery, illness, or stress. Consider reducing training intensity today. If persistent, consult your doctor.' })
  }

  const cortisol = parseFloat(latest.hormone_cortisol)
  if (!isNaN(cortisol) && cortisol > 30) {
    anomalies.push({ type: 'cortisol_elevated', text: 'Cortisol elevated above normal morning range (above 30 nmol/L per LifeLabs/EORLA). Consider reducing training intensity today. High cortisol competes with progesterone and increases protein catabolism.' })
  }

  return anomalies
}

// ── Immediate feedback from latest log ──────────────────────────────────────
function getImmediateFeedback(latestLog, phase, confidence) {
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
      confidence = calcConfidence(phase, recentLogs, mucusLogs)
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
    confidenceLabel: confidence > 0.75 ? 'High confidence' : confidence > 0.45 ? 'Moderate confidence' : 'Building your data',
    confidencePct: Math.round(confidence * 100),
    intensityModifier,
    intensityLabel: getIntensityLabel(intensityModifier),
    nutritionTargets: getNutritionTargets(phase, bodyWeight),
    immediateFeedback: getImmediateFeedback(recentLogs[0], phase, confidence),
    anomalies: detectAnomalies(recentLogs, phase),
    predictions: getPredictions(phase, cycleDay, cycleLen),
    bodyWeight,
    profile: profile || {}
  }
}
