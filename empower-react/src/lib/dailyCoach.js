// dailyCoach.js, the morning "Daily Coach" briefing. PURE synthesis of data the app
// already computes in getTodayStatus (phase, intensity, nutrition targets, recent logs).
// It invents NOTHING: no wearable recovery score we don't have, no fabricated sleep numbers,
// no new claims. Every line is derived from existing, cited engine output. This keeps it
// bug-safe, it adds a view, not a new data dependency, and is fully unit-tested.
//
// Honesty rules (permanent):
//  - Never state a metric we don't have (e.g. "recovery is 62%"). Recovery is only ever
//    surfaced as a hedged "may be lower today" when the user's OWN logs support it.
//  - Pregnancy (path 6) NEVER gets an auto-prescribed workout, defer to her provider.

function greet(hour) {
  if (hour == null || Number.isNaN(hour)) return 'Hello'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// Short, calm phase descriptions (no em-dashes, no commands, so they never contradict the
// recovery note that can appear right below them).
function focusFor(effPhase) {
  switch (effPhase) {
    case 'Menstrual':      return { label: 'Restore', sub: 'Gentle movement and replenishing fuel' }
    case 'Early follicular':
    case 'Follicular':     return { label: 'Build', sub: 'Energy is returning' }
    case 'Late follicular':return { label: 'Build', sub: 'A strong training window' }
    case 'Ovulatory':      return { label: 'Peak', sub: 'Your highest-output day of the cycle' }
    case 'Early luteal':   return { label: 'Steady', sub: 'Steady, consistent energy' }
    case 'Mid luteal':     return { label: 'Recovery', sub: 'A higher-effort phase, protect recovery' }
    case 'Late luteal':    return { label: 'Recovery', sub: 'Pre-period: ease off and rest more' }
    case 'Luteal':         return { label: 'Recovery', sub: 'Progesterone is up, train to feel' }
    case 'Perimenopause':  return { label: 'Strength & protect', sub: 'Train for muscle and bone' }
    case 'Pregnancy':      return { label: 'Move gently', sub: 'Led by your provider' }
    case 'bc-combined':
    case 'bc-progestin':   return { label: 'Consistency', sub: 'Steady, week to week progress' }
    default:               return { label: 'Listen in', sub: 'Tune into how you feel and log it' }
  }
}

function trainingLine(phase, intensityModifier) {
  if (phase === 'Pregnancy')
    return 'Movement is encouraged in pregnancy once your provider has cleared you, walking, swimming, or prenatal strength. Stop and call them if anything feels wrong. We do not prescribe a set workout here.'
  if (phase === 'Perimenopause')
    return 'Strength training 2 to 3 times a week is the single best thing for muscle and bone today. Aim for 30 to 45 minutes.'
  const m = intensityModifier ?? 0.9
  if (m >= 1.0)  return 'A strong day for training. Aim for 45 to 60 minutes and push your harder sets.'
  if (m >= 0.9)  return 'Moderate strength or cardio suits today. Aim for 40 to 50 minutes.'
  if (m >= 0.8)  return 'Keep it moderate today and train to feel. Aim for 30 to 40 minutes.'
  return 'Light movement is best today, a walk, mobility, or an easy session of 20 to 30 minutes.'
}

function nutritionLines(phase, targets) {
  const lines = []
  const protein = targets?.proteinG
  const extra = targets?.extraCalories
  if (phase === 'Pregnancy') {
    if (protein) lines.push(`Aim for about ${protein}g protein, spread across the day.`)
    if (extra > 0) lines.push(`Your body needs roughly ${extra} extra calories this trimester, quality over quantity.`)
    lines.push('Keep up your prenatal vitamin and stay well hydrated.')
    return lines
  }
  if (protein) lines.push(`Aim for about ${protein}g protein today.`)
  if (extra > 0) lines.push(`Add roughly ${extra} extra calories from whole foods, your body genuinely needs more in this phase.`)
  if (phase === 'Menstrual') lines.push('Add iron-rich foods while you are bleeding.')
  lines.push('Stay hydrated.')
  return lines
}

function sleepLine(phase, subPhase, lastSleepQuality) {
  const eff = subPhase || phase
  const lutealish = eff === 'Mid luteal' || eff === 'Late luteal' || eff === 'Luteal' || eff === 'Early luteal' || phase === 'Perimenopause'
  let s = ''
  if (lastSleepQuality === 'Poor') s += 'You logged poor sleep last night, so be gentle with yourself today. '
  s += 'Aim for 7 to 9 hours and keep your wake time consistent.'
  if (lutealish) s += ' Your core temperature runs higher in this phase, so a cool room helps you sleep deeper.'
  s += ' Try to limit caffeine after about 2pm.'
  return s
}

function mindsetLine(phase, subPhase) {
  const eff = subPhase || phase
  switch (eff) {
    case 'Late luteal':   return 'You are entering a higher-stress hormonal phase. Lower mood or irritability now is hormonal, not a flaw. Plan extra recovery and self-kindness.'
    case 'Mid luteal':    return 'Mood can feel less steady mid-luteal as estrogen dips. Anticipating it takes away some of its power.'
    case 'Early luteal':  return 'Rising progesterone brings a calmer, steadier feeling today, a good day for focused, unhurried work.'
    case 'Menstrual':     return 'Energy and mood are at their hormonal low right now. Rest is productive, be kind to yourself.'
    case 'Late follicular':
    case 'Follicular':
    case 'Early follicular': return 'Rising estrogen lifts mood, focus, and motivation. A great day to take on something demanding.'
    case 'Ovulatory':     return 'Peak estrogen means peak confidence and drive. This is a great day to put yourself forward.'
    case 'Perimenopause': return 'Hormone swings can move your mood day to day. The harder days have a real cause, and they pass.'
    case 'bc-combined':
    case 'bc-progestin':  return 'Your hormones are steady on contraception, so expect fewer cycle-driven mood swings day to day.'
    case 'Pregnancy':     return 'Be patient with your energy and mood, both shift a lot in pregnancy. Rest when your body asks.'
    default:              return 'Notice how you feel today and log it, that is exactly how the app learns your personal pattern.'
  }
}

// Only surface a recovery caution when the user's OWN recent logs support it, never invented.
function recoveryNote(recentLogs = []) {
  const today = recentLogs[0]
  if (!today) return null
  const poorSleep = today.sleep_quality === 'Poor'
  const lowEnergy = today.energy === 'Very low'
  const heavyLoad = Array.isArray(today.disruptors) && today.disruptors.some(d => ['High stress', 'Illness', 'Very poor sleep'].includes(d))
  if (poorSleep || lowEnergy || heavyLoad)
    return 'Your recent logs suggest your recovery may be lower today. If you are unsure, take the lighter option.'
  return null
}

// buildDailyCoach, the morning briefing. Takes the getTodayStatus result + current hour.
// Returns null only if there is genuinely nothing to show (no status at all).
export function buildDailyCoach(status, hour, name) {
  if (!status) return null
  const phase = status.phase || 'observation'
  const subPhase = status.subPhase || null
  const eff = subPhase || phase
  const targets = status.nutritionTargets || {}
  const recentLogs = status.recentLogs || []
  const lastSleepQuality = recentLogs[0]?.sleep_quality || null

  return {
    greeting: name ? `${greet(hour)}, ${name}` : greet(hour),
    focus: focusFor(eff),
    training: trainingLine(phase, status.intensityModifier),
    nutrition: nutritionLines(phase, targets),
    sleep: sleepLine(phase, subPhase, lastSleepQuality),
    mindset: mindsetLine(phase, subPhase),
    recoveryNote: recoveryNote(recentLogs),
  }
}
