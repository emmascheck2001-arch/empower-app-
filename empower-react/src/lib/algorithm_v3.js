// algorithm_v3.js — Mood signal weights, phase brain states, PMDD detection
// Imported by hormoneSync.js. Do not import supabase here — pure computation only.
//
// Source: Backstrom et al. Archives of Women's Mental Health 2008
// Source: Backstrom et al. Psychoneuroendocrinology 2014
// Source: Lokuge et al. Journal of Psychiatry and Neuroscience 2011
// Source: Osborn et al. Frontiers in Pharmacology 2025

// ── Flag confidence thresholds ───────────────────────────────────────────────
// Before any insight card, flag, or pattern observation appears, the algorithm
// must meet these minimum conditions. If not met, return nothing — no placeholder.
// Source: principle of minimal harm — do not flag patterns that may be statistical noise
export const FLAG_THRESHOLDS = {
  basic_phase_insight:       { minDaysLogged: 1,  minConfidence: 0.05 },
  nutrition_suggestion:      { minDaysLogged: 3,  minConfidence: 0.10 },
  pattern_observation:       { minDaysLogged: 7,  minConfidence: 0.20 },
  cycle_return_signal:       { minDaysLogged: 14, minSignalCount: 2 },
  health_pattern_flag:       { minCycles: 2, minConfidence: 0.55, minConsecutiveDaysMatching: 3 },
  pcos_pattern_flag:         { minCycles: 2, minConsecutiveLongCycles: 2, minConfidence: 0.60 },
  endometriosis_pain_flag:   { minCycles: 2, minHighPainDaysPerCycle: 2, minConfidence: 0.60 },
  pmdd_pattern_flag:         { minCycles: 3, minConfidence: 0.65, minConsecutiveDaysMatching: 3, requiresCyclicalContrast: true },
  doctor_referral:           { minCycles: 2, minConfidence: 0.65 },
  bone_density_education:    { minDaysLogged: 30, requiresDepoPath: true }
}

// checkFlag — returns true only if the given threshold type is met
// stats: { daysLogged, confidence, cyclesTracked, userPath, bcType }
export function checkFlag(type, stats = {}) {
  const t = FLAG_THRESHOLDS[type]
  if (!t) return false
  const days = stats.daysLogged || 0
  const conf = stats.confidence || 0
  const cycles = stats.cyclesTracked || 0
  if (t.minDaysLogged && days < t.minDaysLogged) return false
  if (t.minConfidence && conf < t.minConfidence) return false
  if (t.minCycles && cycles < t.minCycles) return false
  if (t.requiresDepoPath && stats.bcType !== 'depo' && stats.userPath !== '2') return false
  return true
}

// ── Mood phase signal weights ─────────────────────────────────────────────────
// These are probability modifiers not certainties.
// They adjust calendar confidence when mood data is present.
// Source: Backstrom 2008 phase-specific neurotransmitter fingerprints; Lokuge 2011
export const MOOD_PHASE_SIGNALS = {
  late_luteal: {
    moods: ['Irritable', 'Anxious', 'Low', 'Overwhelmed', 'Sad'],
    requires: 2,
    energy: ['Very low', 'Low'],
    phaseSignal: 'Late luteal',
    confidenceBonus: 0.08,
    note: 'Irritability and anxiety often peak in the days before a period as both estrogen and progesterone drop sharply. This has a specific hormonal cause and will ease when your period begins.'
  },
  early_luteal: {
    moods: ['Calm', 'Focused'],
    requires: 1,
    energy: ['Good', 'Low', null],
    phaseSignal: 'Early luteal',
    confidenceBonus: 0.06,
    note: 'The calmer, more settled feeling in the first half of the luteal phase comes from rising progesterone — it has a mild calming effect via the brain\'s GABA receptors.'
  },
  follicular: {
    moods: ['Energised', 'Energetic', 'Happy', 'Motivated', 'Social'],
    requires: 2,
    energy: ['Good', 'High'],
    phaseSignal: 'Follicular',
    confidenceBonus: 0.07,
    note: 'Rising estrogen tends to bring better mood, motivation, and energy. This is one of the stronger mood signals in the cycle.'
  },
  ovulatory: {
    moods: ['Energised', 'Energetic', 'Happy', 'Confident', 'Focused', 'Social'],
    requires: 2,
    energy: ['High'],
    phaseSignal: 'Ovulatory',
    confidenceBonus: 0.09,
    note: 'Peak estrogen and a brief testosterone rise together tend to drive the highest energy, confidence, and social drive of the cycle.'
  },
  menstrual: {
    moods: ['Low', 'Tired', 'Anxious', 'Sad'],
    requires: 1,
    energy: ['Very low', 'Low'],
    phaseSignal: 'Menstrual',
    confidenceBonus: 0.05,
    note: 'Lower mood and energy during menstruation are driven by estrogen and progesterone being at their lowest. This typically lifts within a few days as estrogen begins to rise again.'
  },
  mid_luteal: {
    moods: ['Irritable', 'Anxious', 'Tired'],
    requires: 1,
    energy: ['Low', 'Good', null],
    phaseSignal: 'Mid luteal',
    confidenceBonus: 0.05,
    note: 'Mixed mood in the mid-luteal phase is common as estrogen begins to fall while progesterone remains high. Energy and mood stability tend to feel less predictable than follicular.'
  }
}

// ── Brain state per phase ─────────────────────────────────────────────────────
// Pill colour: background and text for each state
// Matches app palette — warm, never clinical
export const BRAIN_STATE_STYLES = {
  'Low serotonin':       { bg: '#ede0f0', text: '#5a3a6a' },
  'Rising serotonin':    { bg: '#d8edd8', text: '#2a5a2a' },
  'Peak dopamine':       { bg: '#f5e898', text: '#4a3a00' },
  'Neurochemical peak':  { bg: '#f5d88a', text: '#4a2a00' },
  'GABA calm':           { bg: '#d5e0f0', text: '#2a3a5a' },
  'Serotonin dropping':  { bg: '#f5e0c0', text: '#5a3800' },
  'Serotonin crash':     { bg: '#f0d0c0', text: '#5a2a10' },
  'Low estrogen':        { bg: '#e8e5e0', text: '#4a4540' }
}

// ── Phase predictions with brain state and neurotransmitter why ───────────────
// Source: Backstrom 2008, Lokuge 2011, Backstrom 2014, Osborn 2025
export const PHASE_PREDICTIONS = {
  Menstrual: {
    label: 'Menstrual',
    brain_state: 'Low serotonin',
    intensity: 0.70,
    why: 'Estrogen is at its lowest point. Estrogen directly drives serotonin production — so when estrogen drops, serotonin drops with it. Serotonin is your mood-stabilising neurotransmitter. Its absence is why low mood, emotional sensitivity, and difficulty concentrating are so common right now. This is a measurable neurochemical change — not a personal failing. Source: Lokuge et al. 2011. Backstrom et al. 2008.',
    training: 'Light movement is genuinely optimal right now. Walking, yoga, and gentle stretching help reduce period pain without adding stress to your system.',
    nutrition: 'Prioritise iron (lost through bleeding), omega-3s (help reduce cramping), and complex carbohydrates. Your body needs more nutrient-dense food right now, not less.'
  },
  'Early follicular': {
    label: 'Early follicular',
    brain_state: 'Rising serotonin',
    intensity: 0.95,
    why: 'Estrogen is beginning to rise and serotonin is rising with it. Dopamine — your motivation and reward neurotransmitter — is also starting to increase. The brain is coming back online after the hormonal low of menstruation. You may notice a gradual lift in mood and energy over the next several days. Source: Lokuge et al. 2011. Backstrom et al. 2008.',
    training: 'Energy returning. Good time to ease back into structured training. Strength work will feel more manageable over the coming days.',
    nutrition: 'Rising estrogen improves carbohydrate utilisation. Fuel your returning energy with quality whole foods and adequate protein.'
  },
  'Late follicular': {
    label: 'Late follicular',
    brain_state: 'Peak dopamine',
    intensity: 1.05,
    why: 'Estrogen is near its peak and so are serotonin and dopamine. Dopamine drives motivation, focus, creativity, and reward-seeking. Norepinephrine — your alertness neurotransmitter — is also elevated. This is why late follicular feels mentally sharp, creative, and socially energised. The brain during this phase is measurably different to the brain during late luteal — same person, different neurochemistry. Source: Backstrom et al. 2008. Osborn et al. 2025.',
    training: 'Peak training window. Your neuromuscular coordination, motivation, and pain tolerance are all elevated. Aim for your hardest sessions this week.',
    nutrition: 'Your body is efficient at using carbohydrates now. Fuel hard sessions well and support muscle protein synthesis with adequate protein at every meal.'
  },
  Ovulatory: {
    label: 'Ovulatory',
    brain_state: 'Neurochemical peak',
    intensity: 1.05,
    why: 'Peak estrogen means peak serotonin, dopamine, and norepinephrine all together. The brief testosterone surge adds to this. Every mood, motivation, and clarity brain chemical is at or near its highest point simultaneously. This is why ovulation often feels like the best version of yourself — in measurable brain chemistry terms, it genuinely is. Source: Backstrom et al. 2008. Lokuge et al. 2011.',
    training: 'Your highest performance window. Warm up thoroughly — peak estrogen increases ligament laxity slightly. Attempt load increases on key lifts.',
    nutrition: 'Peak energy demand. Fuel generously with whole foods, quality protein, and complex carbohydrates. Your body is primed to use nutrients effectively right now.'
  },
  'Early luteal': {
    label: 'Early luteal',
    brain_state: 'GABA calm',
    intensity: 0.92,
    why: 'Progesterone is rising and converts in the brain into a calming compound that works on the same receptors as anti-anxiety medication. This is why early luteal often feels more settled and peaceful than the week before. It is progesterone directly affecting your brain chemistry. Source: Backstrom et al. Psychoneuroendocrinology 2014.',
    training: 'Slightly reduced intensity but still strong. Your body temperature is rising slightly — take a little longer to warm up and stay well hydrated.',
    nutrition: 'Protein needs are rising as progesterone causes your body to break down muscle protein faster. Aim for the higher end of your protein range. Progesterone drives real hunger — fuel it with whole foods.'
  },
  'Mid luteal': {
    label: 'Mid luteal',
    brain_state: 'Serotonin dropping',
    intensity: 0.82,
    why: 'Estrogen is declining and serotonin stability is reducing with it. Progesterone is at its peak which continues the GABA-calming effect, but dropping estrogen means less serotonin support. This creates a mixed neurochemical environment — some calming from progesterone, less mood stability from falling serotonin. The mildly unpredictable mood that characterises mid-luteal has this specific chemical cause. Source: Backstrom et al. 2008. Osborn et al. 2025.',
    training: 'Perceived effort may feel higher at the same load. This is physiological — resting heart rate rises about 1.7 bpm in this phase (De Martin Topranin 2023). Adjust expectations, not effort.',
    nutrition: 'Energy intake naturally increases by 200 to 300 kcal in this phase (ISSN 2023). This is biological — not a failure of willpower. Honour it with nutrient-dense food.'
  },
  'Late luteal': {
    label: 'Late luteal',
    brain_state: 'Serotonin crash',
    intensity: 0.72,
    why: 'Both estrogen and progesterone are dropping sharply. Serotonin drops with estrogen. When progesterone drops, the calming effect it was providing disappears, which for some women triggers rebound anxiety and irritability. The combination of low serotonin and this withdrawal is the biological reason PMS feels so different from ordinary low mood. It has a specific chemical cause, and it resolves the moment your period starts and hormones reset. Source: Backstrom et al. Psychoneuroendocrinology 2014. Osborn et al. 2025.',
    training: 'Low intensity movement is most appropriate. Walking, gentle yoga, and light resistance work. Avoid high-intensity training, which adds stress to an already loaded system.',
    nutrition: 'For period pain, many women find magnesium (around 400mg daily in studies), omega-3s, and anti-inflammatory foods help, alongside less ultra-processed food, alcohol, and excess caffeine. Check with your doctor before starting a supplement.'
  },
  Luteal: {
    label: 'Luteal',
    brain_state: 'Serotonin dropping',
    intensity: 0.82,
    why: 'Progesterone is rising and estrogen is beginning to decline. Progesterone has a calming effect while falling estrogen means less serotonin support. This creates the mixed feeling of the luteal phase — some calm, some mood unpredictability. Source: Backstrom et al. 2008.',
    training: 'Moderate intensity. Perceived effort may feel higher at the same load as resting heart rate rises slightly in this phase.',
    nutrition: 'Protein needs are higher in the luteal phase because progesterone causes your body to break down muscle protein faster (ISSN 2023). Eat at the higher end of your protein range and add 200 to 300 extra calories from whole foods.'
  },
  Follicular: {
    label: 'Follicular',
    brain_state: 'Rising serotonin',
    intensity: 1.00,
    why: 'Estrogen is rising and taking serotonin and dopamine with it. The brain is shifting into its high-performance window. Mood, motivation, and mental clarity all improve measurably as estrogen climbs. Source: Lokuge et al. 2011. Backstrom et al. 2008.',
    training: 'Good to strong training window. Energy returning. Build intensity gradually toward ovulation.',
    nutrition: 'Rising estrogen improves carbohydrate metabolism and insulin sensitivity. Fuel well with quality carbohydrates and adequate protein.'
  },
  observation: {
    label: 'Observation mode',
    brain_state: 'Low estrogen',
    intensity: 0.72,
    why: 'Without a confirmed cycle the low-estrogen environment of Depo recovery or hypothalamic amenorrhea means reduced serotonin and dopamine support. The brain chemistry in this state is similar to the menstrual phase — the mood effects of low estrogen are present without the cyclical relief of a returning follicular phase. This is temporary. When your cycle returns your neurochemistry will cycle with it. Source: Sims ST. ROAR 2024.',
    training: 'Low to moderate intensity. Prioritise recovery. Resistance training actively supports hormonal recovery in this phase.',
    nutrition: 'Consistent, adequate nutrition is the foundation. Do not under-eat. Your body is working to restore hormonal function and needs consistent energy and protein.'
  },
  'bc-combined': {
    label: 'On combined hormonal contraception',
    brain_state: 'Stable synthetic hormones',
    intensity: 0.90,
    why: 'Combined hormonal contraception (pill, patch, or ring) delivers synthetic estrogen and progestin at steady levels throughout the month. Your natural cycle is suppressed — there is no LH surge, no ovulation, no natural progesterone rise. The result is a more consistent hormonal environment with no PMS, no luteal phase fatigue, and no cycle-driven dips. Research suggests training adaptation may be slightly different on OCs. Natural testosterone is reduced, which can affect strength progress, and the muscle-building boost from peak natural estrogen in the follicular phase is absent. This does not mean you cannot build strength — you can, and consistently. It just means the dramatic week-to-week variability that naturally cycling women experience does not apply to you in the same way. Source: Elliott-Sale KJ et al. Sports Medicine 2020. Wikstrom-Frisen L et al. JSCR 2017.',
    training: 'Your energy and recovery are more consistent than naturally cycling women. You can train at good intensity year-round without phase-based adjustments. Focus on progressive overload across weeks rather than cycle-based periodisation. Strength training remains the most important thing you can do for long-term hormonal health.',
    nutrition: 'Consistent protein intake is the priority. No luteal phase protein increase is needed because there is no natural progesterone surge causing your body to break down muscle protein faster. A standard 1.6g per kg of body weight supports muscle maintenance and performance. Eating enough total calories matters more than timing.'
  },
  'bc-progestin': {
    label: 'On progestin-only contraception',
    brain_state: 'Progestin dominant',
    intensity: 0.85,
    why: 'Progestin-only methods (mini pill, implant, Depo-Provera, hormonal IUD) have minimal systemic estrogen. Natural estrogen and testosterone are suppressed to varying degrees. Some women on progestin-only methods still ovulate — particularly those on the hormonal IUD — and may notice residual cyclical patterns. If you do, trust those signals. Progestin without the counterbalancing effect of natural estrogen can affect mood in some women. This is well documented and not psychological. If you notice consistent low mood, fatigue, or reduced libido, it is worth discussing with your doctor. You deserve to feel well. Source: Skovlund CW et al. JAMA Psychiatry 2016.',
    training: 'Train at moderate to good intensity. Your energy may be somewhat flatter than a naturally cycling woman in her follicular phase. Pay attention to how you feel day to day and adjust accordingly. Resistance training is especially valuable for maintaining muscle mass and bone density when estrogen is low.',
    nutrition: 'Protein 1.6 to 1.8g per kg bodyweight supports muscle and bone maintenance. Calcium and vitamin D are particularly important when estrogen is low, as estrogen plays a direct role in bone protection. Adequate iron intake matters if you are still having periods.'
  },
  Perimenopause: {
    label: 'Perimenopause',
    brain_state: 'Fluctuating estrogen',
    intensity: 0.82,
    why: 'Estrogen is no longer cycling predictably. Estrogen directly drives serotonin production and receptor sensitivity — when estrogen fluctuates unpredictably, so does the neurochemistry that depends on it. Hot flashes, sleep disruption, brain fog, and mood changes are neurological effects of estrogen variability, not just hormonal inconvenience. The days that feel harder have a measurable chemical cause. Source: Osborn et al. Frontiers in Pharmacology 2025. Backstrom et al. Archives of Women\'s Mental Health 2008.',
    training: 'Train to how you feel. Strength training 2 to 3 times per week is the single most protective thing you can do for bone density, muscle mass, and insulin sensitivity through this transition. Every resistance session stimulates bone formation. (Kohrt et al. MSSE 2004)',
    nutrition: 'Protein 1.8g per kg per day supports muscle maintenance as anabolic signalling declines. Calcium and vitamin D every day for bone protection. Limit alcohol — it worsens hot flashes and disrupts sleep independently. Source: ISSN 2023; Kohrt et al. 2004.'
  }
}

// ── Mood signal interpreter ───────────────────────────────────────────────────
// Returns phase signal, confidence adjustment, and insight message
// Source: Backstrom 2008; Lokuge 2011
export function interpretMoodSignal(todayLog, recentLogs, calendarPhase, calendarSubPhase) {
  const mood = todayLog?.mood || []
  const energy = todayLog?.energy
  const result = { phaseSignal: null, confidenceAdjustment: 0, insight: null, mismatch: false }

  if (!mood.length && !energy) return result

  // Check each pattern against today's log
  for (const [, pattern] of Object.entries(MOOD_PHASE_SIGNALS)) {
    const moodMatches = mood.filter(m => pattern.moods.includes(m)).length
    const energyMatches = !pattern.energy || pattern.energy.includes(energy) || pattern.energy.includes(null)

    if (moodMatches >= pattern.requires && energyMatches) {
      result.phaseSignal = pattern.phaseSignal

      // Determine if mood confirms or contradicts calendar phase
      const calendarKey = (calendarSubPhase || calendarPhase || '').toLowerCase()
      const signalKey = pattern.phaseSignal.toLowerCase()
      const confirms = calendarKey.includes(signalKey.split(' ')[0]) ||
                       signalKey.includes((calendarPhase || '').toLowerCase().split(' ')[0])

      if (confirms) {
        result.confidenceAdjustment = pattern.confidenceBonus
        result.insight = {
          type: 'mood_phase_confirmation',
          priority: 'low',
          message: pattern.note,
          science: 'Source: Backstrom et al. Archives of Women\'s Mental Health 2008.'
        }
      } else if (calendarPhase) {
        result.mismatch = true
        result.confidenceAdjustment = -0.05
        result.insight = {
          type: 'mood_phase_mismatch',
          priority: 'medium',
          message: 'How you feel today looks more like ' + pattern.phaseSignal + ' than ' + calendarPhase + '. Your cycle may be running slightly ahead of or behind the calendar estimate. Keep logging — the algorithm will update as the pattern becomes clearer.',
          science: 'Source: Backstrom et al. 2008.'
        }
      }
      break
    }
  }

  // Check for persistent late-luteal mood across 3 consecutive days
  if (recentLogs && recentLogs.length >= 3) {
    const recentMoods = recentLogs.slice(0, 3).flatMap(l => l.mood || [])
    const negativeMoodCount = recentMoods.filter(m =>
      ['Irritable', 'Anxious', 'Low', 'Overwhelmed', 'Sad'].includes(m)
    ).length

    if (negativeMoodCount >= 4 &&
        calendarPhase !== 'Luteal' && calendarPhase !== 'Menstrual') {
      result.mismatch = true
      result.confidenceAdjustment = Math.min(result.confidenceAdjustment, -0.08)
      result.insight = {
        type: 'persistent_negative_mood_signal',
        priority: 'high',
        message: 'You have logged lower mood for a few days in a row. This kind of pattern often appears in the days before a period as hormones drop. If your period arrives soon this will confirm the pattern — and it will ease once it does.',
        science: 'Source: Backstrom et al. Archives of Women\'s Mental Health 2008.'
      }
    }
  }

  return result
}

// ── PMDD pattern detection ───────────────────────────────────────────────────
// Looks for the cyclical contrast pattern: severe negative mood in luteal,
// absent in follicular — the DSM-5 diagnostic criterion for PMDD
// Source: DSM-5 PMDD criteria. Osborn et al. Frontiers in Pharmacology 2025.
export function detectPMDDPattern(logs, cycleLen) {
  if (!logs || logs.length < 14) return null

  const cl = cycleLen || 28
  // Ovulation ~14 days before next period (luteal phase is near-fixed), not mid-cycle.
  // Mirrors getOvulationDay() in hormoneSync.js (kept inline to avoid a circular import).
  const ovulation = Math.max(8, Math.round(cl - 14))
  const NEGATIVE_MOODS = new Set(['Irritable', 'Anxious', 'Low', 'Overwhelmed', 'Sad'])
  const POSITIVE_MOODS = new Set(['Energised', 'Energetic', 'Happy', 'Motivated', 'Confident', 'Social'])

  // Score luteal days vs follicular days
  let lutealNegativeCount = 0
  let lutealDayCount = 0
  let follicularPositiveCount = 0
  let follicularDayCount = 0

  for (const log of logs) {
    if (!log.log_date || !log.mood?.length) continue
    // Estimate cycle day from log date — rough approximation
    const logDate = new Date(log.log_date + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const daysAgo = Math.floor((today - logDate) / 86400000)
    // Map to approximate cycle position using modular arithmetic
    const approxCycleDay = ((cl - daysAgo % cl) % cl) + 1
    const isLuteal = approxCycleDay > ovulation + 1
    const isFollicular = approxCycleDay > 5 && approxCycleDay <= ovulation - 2

    if (isLuteal) {
      lutealDayCount++
      if (log.mood.some(m => NEGATIVE_MOODS.has(m))) lutealNegativeCount++
    }
    if (isFollicular) {
      follicularDayCount++
      if (log.mood.some(m => POSITIVE_MOODS.has(m))) follicularPositiveCount++
    }
  }

  if (lutealDayCount < 3 || follicularDayCount < 3) return null

  const lutealNegativeRate = lutealNegativeCount / lutealDayCount
  const follicularPositiveRate = follicularPositiveCount / follicularDayCount

  // Cyclical contrast: high negative in luteal AND positive in follicular
  if (lutealNegativeRate >= 0.6 && follicularPositiveRate >= 0.5) {
    return {
      type: 'possible_pmdd_pattern',
      severity: 'informational',
      message: 'Over your recent logs we have detected a consistent pattern of significant mood changes in the luteal phase that resolve around menstruation. This cyclical pattern — difficult in luteal, more positive in follicular — is associated with PMDD, Premenstrual Dysphoric Disorder. PMDD affects approximately 3 to 8% of women and is frequently misdiagnosed as general anxiety or depression because doctors do not ask about cycle timing. If this pattern is disrupting your daily life please discuss it with a doctor and specifically mention the cyclical timing. Effective treatments exist. This is a pattern observation — not a diagnosis.',
      science: 'PMDD requires cyclical symptoms in luteal phase with remission in follicular phase (DSM-5). Source: Osborn et al. Frontiers in Pharmacology 2025.'
    }
  }

  return null
}

// ── Mood context immediate feedback ──────────────────────────────────────────
// Called from getImmediateFeedback in hormoneSync.js
// Returns a feedback item connecting mood to neurotransmitter cause
// Source: Backstrom 2008; Lokuge 2011; Backstrom 2014
export function getMoodContextFeedback(latestLog, phase, subPhase) {
  if (!latestLog?.mood?.length) return null
  const mood = latestLog.mood
  const energy = latestLog.energy
  const effectivePhase = subPhase || phase

  const isLow = ['Irritable', 'Anxious', 'Low', 'Overwhelmed'].some(m => mood.includes(m))
  const isVeryLow = energy === 'Very low' || energy === 'Low'
  const isHighEnergy = ['Energised', 'Energetic', 'Happy', 'Motivated'].some(m => mood.includes(m))

  // BC-active: mood affected by synthetic hormones, not natural cycle
  const isBCActive = phase === 'bc-combined' || phase === 'bc-progestin'
  if (isBCActive) {
    const isProgestin = phase === 'bc-progestin'
    if (isLow || isVeryLow) {
      return {
        type: 'mood_context',
        icon: 'brain',
        headline: isProgestin ? 'Progestin can affect mood in some women' : 'Mood changes on the pill are real',
        body: isProgestin
          ? 'Low mood, fatigue, or reduced motivation on progestin-only contraception is well documented and not psychological. Progestin without the counterbalancing effect of natural estrogen can suppress serotonin and dopamine activity in some women. If this is consistent, it is worth discussing with your doctor. A different method or formulation may feel very different. You deserve to feel well. Source: Skovlund CW et al. JAMA Psychiatry 2016.'
          : 'Some women experience mood changes on combined hormonal contraception. The synthetic progestin component in particular can affect serotonin receptor sensitivity in a way that differs from natural progesterone. If low mood is consistent month to month rather than occasional, it is worth mentioning to your doctor. Different pill formulations and progestin types can have meaningfully different effects. Source: Skovlund CW et al. JAMA Psychiatry 2016.'
      }
    }
    return null
  }

  // Perimenopause: estrogen variability drives mood, not cycle phases
  const isPeri = phase === 'Perimenopause'
  if (isPeri) {
    if (isLow || isVeryLow) {
      return {
        type: 'mood_context',
        icon: 'brain',
        headline: 'This is estrogen variability, not you',
        body: 'The irritability, anxiety, or low mood you are feeling right now has a direct neurological cause. Estrogen drives serotonin production and receptor sensitivity. When estrogen fluctuates unpredictably in perimenopause, serotonin stability goes with it. This is a measurable neurochemical effect of estrogen variability — not anxiety, not weakness, not ageing. It has a biological explanation and there are effective approaches. Source: Osborn et al. Frontiers in Pharmacology 2025. Backstrom et al. 2008.'
      }
    }
    if (isHighEnergy) {
      return {
        type: 'mood_context',
        icon: 'brain',
        headline: 'Estrogen surge — make the most of it',
        body: 'Good mood and high energy in perimenopause often signal an estrogen surge. Estrogen drives dopamine and serotonin — when it peaks, mood, motivation, and mental clarity peak with it. These windows are worth planning around for training and demanding work. Source: Backstrom et al. Archives of Women\'s Mental Health 2008.'
      }
    }
    return null
  }

  const isLateLuteal = effectivePhase === 'Late luteal' || effectivePhase === 'Mid luteal'

  if (isLateLuteal && isLow && isVeryLow) {
    return {
      type: 'mood_context',
      icon: 'brain',
      headline: 'This is neurochemistry, not you',
      body: 'The irritability and anxiety right now have a specific biological cause. Estrogen is dropping and serotonin drops with it. Progesterone is also declining which removes its GABA-calming effect. This combination is the neurochemical mechanism behind PMS. It resolves when menstruation begins and hormones reset. Source: Backstrom et al. 2008.'
    }
  }

  const isPositivePhase = phase === 'Follicular' || phase === 'Ovulatory'

  if (isHighEnergy && isPositivePhase) {
    return {
      type: 'mood_context',
      icon: 'brain',
      headline: 'This energy is real and biological',
      body: 'The motivation and positive mood right now are driven by rising estrogen and dopamine. This is not luck — it is measurable neurochemistry. Make the most of this window. Your brain is genuinely performing at a higher level right now. Source: Backstrom et al. 2008. Lokuge et al. 2011.'
    }
  }

  if (mood.includes('Calm') && effectivePhase === 'Early luteal') {
    return {
      type: 'mood_context',
      icon: 'brain',
      headline: 'Progesterone is your natural calm',
      body: 'The settled feeling right now is progesterone converting in your brain into a calming compound — the same type targeted by anti-anxiety medications. This is your body\'s own calming mechanism. Source: Backstrom et al. Psychoneuroendocrinology 2014.'
    }
  }

  if (phase === 'Menstrual' && (isLow || isVeryLow)) {
    return {
      type: 'mood_context',
      icon: 'brain',
      headline: 'The lowest point of the cycle — hormonally',
      body: 'Both estrogen and progesterone are at their lowest right now and serotonin is at its lowest with them. This is the measurable neurochemical reason for low mood and low energy during menstruation. It is not a reflection of your character or your health. Source: Lokuge et al. 2011.'
    }
  }

  return null
}

// Returns the symptom area most relevant to what the user has actually logged recently.
// Drives auto-open accordion in Nutrition and personalised note in targets card.
// Source: symptom-nutrition links from Facchinetti 1991, Rahbar 2012, Angeli 2016, ISSN 2023
export function getPersonalisedNutritionFocus(recentLogs) {
  if (!recentLogs?.length) return null
  const recent = recentLogs.slice(0, 7)
  const allSymptoms = recent.flatMap(l => l.symptoms || [])
  const allMoods = recent.flatMap(l => l.mood || [])
  const energyValues = recent.map(l => l.energy).filter(Boolean)
  const sleepValues = recent.map(l => l.sleep_quality).filter(Boolean)

  const hasCramps = allSymptoms.some(s => ['Cramps','Cramping','Back pain'].includes(s))
  const bloatingCount = allSymptoms.filter(s => s === 'Bloating').length
  const lowEnergyCount = energyValues.filter(e => ['Low','Very low'].includes(e)).length
  const poorSleepCount = sleepValues.filter(s => s === 'Poor').length
  const negMoodCount = allMoods.filter(m => ['Anxious','Irritable','Low','Sad'].includes(m)).length
  const hasBrainFog = allMoods.some(m => m === 'Brain fog') || recent.some(l => (l.brain_fog_rating || 0) >= 3)

  if (hasCramps) return { focus: 'cramping', reason: 'You logged cramps recently — anti-inflammatory foods are your priority right now.' }
  if (bloatingCount >= 2) return { focus: 'bloating', reason: 'You logged bloating recently — probiotic and gut-settling foods help most here.' }
  if (negMoodCount >= 2) return { focus: 'pms', reason: 'You logged low or anxious mood recently — magnesium and complex carbohydrates support this directly.' }
  if (hasBrainFog) return { focus: 'brainfog', reason: 'You logged brain fog recently — iron, omega-3, and eggs and leafy greens support focus.' }
  if (lowEnergyCount >= 2) return { focus: 'fatigue', reason: 'You logged low energy recently — iron and B12 are your focus right now.' }
  if (poorSleepCount >= 2) return { focus: 'fatigue', reason: 'You logged poor sleep recently — magnesium glycinate and stable blood sugar through the day help most.' }
  return null
}

// Returns a personalised readiness note based on recent workout feel, energy, and sleep logs.
// Used to replace or supplement the generic intensity guide in Workout.jsx.
export function getPersonalisedWorkoutReadiness(recentLogs) {
  if (!recentLogs?.length) return null
  const recent = recentLogs.slice(0, 7)
  const todayLog = recent[0]
  const workoutFeels = recent.slice(0, 5).map(l => l.workout_feel).filter(Boolean)
  const recentDisruptors = recent.flatMap(l => l.disruptors || [])

  const hardCount = workoutFeels.filter(f => ['Felt hard','Hard'].includes(f)).length
  const strongCount = workoutFeels.filter(f => ['Felt strong','Strong','Stronger than usual'].includes(f)).length

  if (todayLog?.energy === 'Very low') return 'You logged very low energy today. Start at 80% and adjust from there — your body is telling you something real.'
  if (todayLog?.sleep_quality === 'Poor') return 'You logged poor sleep last night. Trust how you feel over your targets today.'
  if (hardCount >= 3) return `Your last ${hardCount} sessions have felt hard. A lighter session today actively supports recovery.`
  if (strongCount >= 2) return 'Your recent sessions have felt strong. This is a good window to work toward the top of your ranges.'
  if (recentDisruptors.some(d => ['High stress','Very poor sleep','Illness'].includes(d))) return 'Recent stressors logged. Stress adds hormonal load — factor that into your effort today.'
  return null
}
