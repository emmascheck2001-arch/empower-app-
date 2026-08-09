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
    case 'Menstrual':      return { label: 'Ease in and refuel', sub: 'Energy is often lowest now, gentle movement and iron-rich food help' }
    case 'Early follicular':
    case 'Follicular':
    case 'Late follicular':return { label: 'Building energy', sub: 'Many women feel stronger now, a good window to progress your lifts' }
    case 'Ovulatory':      return { label: 'Peak energy window', sub: 'Many women feel strongest now, a good day to push if you feel good' }
    case 'Early luteal':
    case 'Mid luteal':
    case 'Late luteal':
    case 'Luteal':         return { label: 'Steady and recover', sub: 'Recovery can feel slower now, aim to maintain and keep protein high' }
    case 'Perimenopause':  return { label: 'Strength and protect', sub: 'Prioritise resistance training for muscle and bone' }
    case 'Pregnancy':      return { label: 'Move gently', sub: 'Stay active as your provider advises' }
    case 'bc-combined':
    case 'bc-progestin':   return { label: 'Steady progress', sub: 'Energy is more consistent, focus on week to week progress' }
    default:               return { label: 'Tune in', sub: 'Log how you feel today so Empower learns your pattern' }
  }
}

function trainingLine(phase, intensityModifier, readiness) {
  void intensityModifier
  if (phase === 'Pregnancy')
    return 'Movement is encouraged in pregnancy once your provider has cleared you, walking, swimming, or prenatal strength. Stop and call them if anything feels wrong. We do not prescribe a set workout here.'
  if (phase === 'Perimenopause')
    return readiness || 'Resistance training protects muscle and bone now more than ever. Aim for your planned session and let your warm-up, symptoms and sleep guide the load.'
  return readiness || 'Start with your planned session. If your warm-up feels good, aim to progress; if energy or recovery are low, hold steady or take the lighter option.'
}

function nutritionLines(phase, targets) {
  const lines = []
  const proteinRange = targets?.proteinRangeG
  if (phase === 'Pregnancy') {
    if (proteinRange) lines.push(`Your general protein range is ${proteinRange[0]} to ${proteinRange[1]}g, spread across the day.`)
    lines.push('Keep up your prenatal vitamin and stay well hydrated.')
    return lines
  }
  if (proteinRange) lines.push(`Aim for around ${proteinRange[0]} to ${proteinRange[1]}g of protein today, spread across your meals. (ISSN 2023)`)
  else lines.push('Aim for a protein source at every meal; add your weight in settings for a personalised gram target.')
  if (phase === 'Menstrual') lines.push('Prioritise iron-rich foods like red meat, lentils and spinach while you are bleeding to replace what is lost.')
  lines.push('Keep well hydrated across the day.')
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
    case 'Late luteal':   return 'As hormones drop before your period, many women notice lower mood or irritability. Be kind to yourself and lean on calming routines; seek support for symptoms that persist or disrupt your life.'
    case 'Mid luteal':    return 'With progesterone high, many women feel calmer but a little flatter. A steady routine and enough sleep help smooth the shift.'
    case 'Early luteal':  return 'Rising progesterone often brings a settled, calm feeling now. A good window for focused, steady work.'
    case 'Menstrual':     return 'Many women feel more inward and tired at the start of the cycle. Keep your plan if you feel good, and give yourself permission to rest.'
    case 'Late follicular':
    case 'Follicular':
    case 'Early follicular': return 'As estrogen rises, many women notice sharper focus and brighter mood. A good time to take on demanding tasks.'
    case 'Ovulatory':     return 'Around ovulation many women feel most confident and social. A great day for connection and things that need energy.'
    case 'Perimenopause': return 'Fluctuating hormones can bring mood ups and downs. Protecting sleep, movement and stress support goes a long way; reach out for help if low mood lingers.'
    case 'bc-combined':
    case 'bc-progestin':  return 'On contraception your mood tends to be steadier day to day. If you notice persistent low mood, it is worth raising with your doctor.'
    case 'Pregnancy':     return 'Energy and mood shift a lot in pregnancy. Be patient with yourself and rest when your body asks.'
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
