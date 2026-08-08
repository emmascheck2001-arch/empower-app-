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

import { diffCalendarDays } from './dateUtils.js'

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
    case 'Menstrual':      return { label: 'Check in', sub: 'Use bleeding, pain and energy to guide today' }
    case 'Early follicular':
    case 'Follicular':
    case 'Late follicular':return { label: 'Check in', sub: 'Use your warm-up and recent recovery' }
    case 'Ovulatory':      return { label: 'Estimated window', sub: 'Timing does not determine performance' }
    case 'Early luteal':
    case 'Mid luteal':
    case 'Late luteal':
    case 'Luteal':         return { label: 'Check in', sub: 'Use your symptoms and recent recovery' }
    case 'Perimenopause':  return { label: 'Strength & protect', sub: 'Train for muscle and bone' }
    case 'Pregnancy':      return { label: 'Move gently', sub: 'Led by your provider' }
    case 'bc-combined':
    case 'bc-progestin':   return { label: 'Consistency', sub: 'Steady, week to week progress' }
    default:               return { label: 'Listen in', sub: 'Tune into how you feel and log it' }
  }
}

function trainingLine(phase, intensityModifier, readiness) {
  void intensityModifier
  if (phase === 'Pregnancy')
    return 'Movement is encouraged in pregnancy once your provider has cleared you, walking, swimming, or prenatal strength. Stop and call them if anything feels wrong. We do not prescribe a set workout here.'
  if (phase === 'Perimenopause')
    return readiness || 'Resistance training supports muscle and bone. Keep the planned session and adapt it to symptoms, pain, sleep and your warm-up.'
  return readiness || 'Start with your planned session. Your warm-up, symptoms and recent performance decide whether to progress, maintain or choose the lighter option.'
}

function nutritionLines(phase, targets) {
  const lines = []
  const proteinRange = targets?.proteinRangeG
  if (phase === 'Pregnancy') {
    if (proteinRange) lines.push(`Your general protein range is ${proteinRange[0]} to ${proteinRange[1]}g, spread across the day.`)
    lines.push('Keep up your prenatal vitamin and stay well hydrated.')
    return lines
  }
  if (proteinRange) lines.push(`Your research-informed protein range is ${proteinRange[0]} to ${proteinRange[1]}g; training and health determine where you fit.`)
  else lines.push('Include a protein source at meals; add your weight to calculate a general range.')
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
  if (lutealish) s += ' If you personally feel warmer or sleep worse in this window, a cooler room may help.'
  s += ' Try to limit caffeine after about 2pm.'
  return s
}

function mindsetLine(phase, subPhase) {
  const eff = subPhase || phase
  switch (eff) {
    case 'Late luteal':   return 'Some people notice pre-period mood or energy changes here. Notice what is true for you, and seek support for symptoms that persist or disrupt your life.'
    case 'Mid luteal':    return 'Mood and sleep may shift for some people here, while others remain steady. Your log helps distinguish your pattern.'
    case 'Early luteal':  return 'This is a possible transition window, not a prediction of your mood. Let today’s experience lead.'
    case 'Menstrual':     return 'Bleeding, pain and energy affect people differently. Keep your plan if you feel well, and choose recovery when you need it.'
    case 'Late follicular':
    case 'Follicular':
    case 'Early follicular': return 'Some people notice better mood or focus here, but it is not universal. Empower will learn whether it repeats for you.'
    case 'Ovulatory':     return 'This is an estimated ovulation window. Calendar timing does not determine confidence, mood or performance.'
    case 'Perimenopause': return 'Hormonal transition can contribute to mood changes, while sleep, stress, health and medicines can also matter.'
    case 'bc-combined':
    case 'bc-progestin':  return 'Contraceptive effects vary by method and person. Track mood changes without assuming a single cause.'
    case 'Pregnancy':     return 'Be patient with your energy and mood, both shift a lot in pregnancy. Rest when your body asks.'
    default:              return 'Notice how you feel today and log it, that is exactly how the app learns your personal pattern.'
  }
}

// Only surface a recovery caution when the user's OWN recent logs support it, never invented.
function recoveryNote(recentLogs = []) {
  const today = recentLogs[0]
  if (!today) return null
  const age = today.log_date ? diffCalendarDays(new Date(), today.log_date + 'T00:00:00') : 99
  if (age < 0 || age > 1) return null
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
    training: trainingLine(phase, status.intensityModifier, status.workoutReadiness),
    nutrition: nutritionLines(phase, targets),
    sleep: sleepLine(phase, subPhase, lastSleepQuality),
    mindset: mindsetLine(phase, subPhase),
    recoveryNote: recoveryNote(recentLogs),
  }
}
