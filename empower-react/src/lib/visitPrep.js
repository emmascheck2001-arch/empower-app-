// visitPrep.js, turns a user's own tracked data into a plain-language summary she can
// hand to a doctor. Em~power exists because women get dismissed; the antidote is walking
// in with data. Pure computation only (no supabase import) so it can be unit-tested.
//
// PERMANENT RULES (mirror the app's clinical-safety rules):
//  - Never name a condition (PCOS, endometriosis, etc.), describe the pattern only.
//  - Everything is framed as "worth discussing", never a diagnosis.
//  - Conservative: if the data does not support a pattern, do not invent one.
// Sources for the questions/tests lists: ACOG (heavy bleeding, pelvic pain); Burden 2015
// BJSM (ferritin <30); Harlow 2012 STRAW+10; Manson 2013 NEJM (HRT); Teede 2018 (PCOS mgmt
// language); Nnoaham 2011 (diagnostic delay). Same sources cited elsewhere in the app.

const NEG_MOODS = ['Irritable', 'Anxious', 'Low mood', 'Sad', 'Overwhelmed']

function sortByDateDesc(logs = []) {
  return [...logs].filter(l => l && l.log_date).sort((a, b) => (a.log_date < b.log_date ? 1 : -1))
}
function daysBetween(aStr, bStr) {
  return Math.round((new Date(bStr + 'T00:00:00') - new Date(aStr + 'T00:00:00')) / 86400000)
}
function lifeStageLabel(profile) {
  switch (profile?.user_path) {
    case '6': return 'Pregnancy'
    case '4': return 'Perimenopause / menopause transition'
    case '5': return 'On hormonal contraception'
    case '2': return 'Recently stopped hormonal contraception'
    default:  return 'Tracking natural cycle'
  }
}

// buildVisitSummary, the core. Returns a structured summary object (never throws on
// missing/empty data; sections that have no data are simply omitted or empty).
export function buildVisitSummary({ profile = {}, cycleData = null, logs = [], baselines = null, todayStr } = {}) {
  const sorted = sortByDateDesc(logs)
  const today = todayStr || (sorted[0]?.log_date) || null
  const path = profile?.user_path
  const isPeri = path === '4'

  // ── snapshot ────────────────────────────────────────────────────────────────
  let trackingSpanText = 'Just getting started'
  if (sorted.length >= 2 && today) {
    const span = daysBetween(sorted[sorted.length - 1].log_date, today)
    trackingSpanText = `${sorted.length} days logged over ${span >= 0 ? span : 0} days`
  } else if (sorted.length === 1) {
    trackingSpanText = '1 day logged'
  }
  let ageText = null
  if (profile?.birth_year && today) {
    const age = new Date(today + 'T00:00:00').getFullYear() - profile.birth_year
    if (age > 0 && age < 120) ageText = `${age} years old`
  }
  const snapshot = { lifeStage: lifeStageLabel(profile), ageText, trackingSpanText, logCount: sorted.length }

  // ── cycle ───────────────────────────────────────────────────────────────────
  let cycle = null
  if (path !== '4' && path !== '6') {
    const typical = baselines?.avg_cycle_length || cycleData?.cycle_length || null
    cycle = {
      typicalLength: typical,
      lastPeriod: cycleData?.last_period_date || null,
      cyclesTracked: baselines?.cycles_tracked || 0,
    }
  }

  // ── aggregate symptoms across the logged window ──────────────────────────────
  const painDays = sorted.filter(l => (l.pain_rating || 0) >= 4)
  const maxPain = sorted.reduce((m, l) => Math.max(m, l.pain_rating || 0), 0)
  const heavyDays = sorted.filter(l => l.flow_volume === 'Heavy' || l.flow_volume === 'Very heavy')
  const lowEnergyDays = sorted.filter(l => l.energy === 'Low' || l.energy === 'Very low')
  const negMoodDays = sorted.filter(l => Array.isArray(l.mood) && l.mood.some(m => NEG_MOODS.includes(m)))
  const poorSleepDays = sorted.filter(l => l.sleep_quality === 'Poor')

  const symptomTally = {}
  for (const l of sorted) {
    for (const s of (l.symptoms || [])) { if (s && s !== 'None') symptomTally[s] = (symptomTally[s] || 0) + 1 }
  }
  const topSymptoms = Object.entries(symptomTally).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([name, n]) => ({ name, days: n }))

  // perimenopause-specific tallies
  const hotFlashTotal = sorted.reduce((s, l) => s + (l.hot_flash_count || 0), 0)
  const nightSweatDays = sorted.filter(l => l.night_sweats_severity === 'Moderate' || l.night_sweats_severity === 'Severe')
  const brainFogDays = sorted.filter(l => (l.brain_fog_rating || 0) >= 3)
  const jointPainDays = sorted.filter(l => (l.joint_pain_rating || 0) >= 3)

  const symptoms = []
  if (topSymptoms.length) symptoms.push({ label: 'Most-logged symptoms', detail: topSymptoms.map(s => `${s.name} (${s.days}d)`).join(', ') })
  if (painDays.length)    symptoms.push({ label: 'Severe period pain (4+/5)', detail: `${painDays.length} day${painDays.length === 1 ? '' : 's'} logged (peak ${maxPain}/5)` })
  if (heavyDays.length)   symptoms.push({ label: 'Heavy / very heavy flow', detail: `${heavyDays.length} day${heavyDays.length === 1 ? '' : 's'} logged` })
  if (lowEnergyDays.length >= 3) symptoms.push({ label: 'Low energy', detail: `${lowEnergyDays.length} days logged low or very low` })
  if (negMoodDays.length >= 3)   symptoms.push({ label: 'Low / anxious mood', detail: `${negMoodDays.length} days logged` })
  if (poorSleepDays.length >= 3) symptoms.push({ label: 'Poor sleep', detail: `${poorSleepDays.length} nights logged poor` })
  if (isPeri && hotFlashTotal)   symptoms.push({ label: 'Hot flashes', detail: `${hotFlashTotal} logged across the window` })
  if (isPeri && nightSweatDays.length) symptoms.push({ label: 'Night sweats', detail: `${nightSweatDays.length} days moderate or severe` })
  if (isPeri && brainFogDays.length)   symptoms.push({ label: 'Brain fog', detail: `${brainFogDays.length} days rated 3+/5` })
  if (isPeri && jointPainDays.length)  symptoms.push({ label: 'Joint pain', detail: `${jointPainDays.length} days rated 3+/5` })

  // ── patterns worth raising (neutral, never a diagnosis, never names a condition) ──
  const patternsToRaise = []
  if (painDays.length >= 2)
    patternsToRaise.push('Period pain rated severe on multiple days. Pain that disrupts daily life is worth taking seriously and is useful context for a clinician.')
  if (heavyDays.length >= 2)
    patternsToRaise.push('Heavy or very heavy flow logged on multiple days, which is worth mentioning, especially alongside any fatigue.')
  if (lowEnergyDays.length >= 3 && (heavyDays.length >= 1 || path === '1' || path === '3'))
    patternsToRaise.push('Recurrent low energy. With any heavy bleeding this is worth checking iron status for.')
  if (negMoodDays.length >= 4)
    patternsToRaise.push('Low or anxious mood logged across several days. Worth raising, including how it relates to the timing of your cycle.')
  if (cycle && cycle.typicalLength && cycle.typicalLength > 35)
    patternsToRaise.push('Longer-than-typical cycle length. Worth discussing, tracking data like this is useful context for that conversation.')
  if (isPeri && (hotFlashTotal || nightSweatDays.length || brainFogDays.length))
    patternsToRaise.push('A cluster of perimenopause-type symptoms over time. Worth a proper hormonal assessment rather than being attributed to stress alone.')

  // ── questions + tests, tailored to life stage and what showed up ─────────────
  const questions = []
  const tests = []
  if (isPeri) {
    questions.push('Are my symptoms consistent with perimenopause?', 'Am I a candidate for hormone therapy, and if not, why not?', 'What should I monitor for bone health at this stage?')
    tests.push('FSH, LH, estradiol', 'Thyroid panel (TSH, free T3, free T4)', 'Vitamin D (25-OH)', 'Full iron panel including ferritin')
  } else if (path === '6') {
    questions.push('Are there any of my symptoms I should be watching closely?', 'What screening or bloodwork is due at this stage?')
  } else {
    if (painDays.length >= 2) questions.push('My period pain is severe on some days, what could be causing it and how is it assessed?')
    if (heavyDays.length >= 2) questions.push('My flow is heavy on some days, should this be investigated?')
    if (cycle && cycle.typicalLength && cycle.typicalLength > 35) questions.push('My cycles run long/irregular, what could be behind that?')
    questions.push('Based on this pattern, is any bloodwork or imaging worth doing?')
  }
  // Iron is the most common miss for active / heavy-bleeding women, surface it.
  if (!tests.includes('Full iron panel including ferritin') && (heavyDays.length >= 1 || lowEnergyDays.length >= 3))
    tests.push('Full iron panel including ferritin (below 30 µg/L is low for active women even if haemoglobin is normal. Burden 2015)')

  return { snapshot, cycle, symptoms, patternsToRaise, questions, tests, hasData: sorted.length > 0 }
}

// summaryToText, flatten the summary into copy/paste-able plain text for sharing or printing.
export function summaryToText(summary, profile = {}) {
  if (!summary) return ''
  const L = []
  L.push('EM~POWER. VISIT SUMMARY')
  if (profile?.name) L.push(`For: ${profile.name}`)
  const s = summary.snapshot
  L.push(`Life stage: ${s.lifeStage}${s.ageText ? ` · ${s.ageText}` : ''}`)
  L.push(`Tracking: ${s.trackingSpanText}`)
  if (summary.cycle?.typicalLength) L.push(`Typical cycle length: ${summary.cycle.typicalLength} days${summary.cycle.lastPeriod ? ` · last period started ${summary.cycle.lastPeriod}` : ''}`)
  if (summary.symptoms.length) {
    L.push('', 'WHAT I HAVE BEEN TRACKING')
    summary.symptoms.forEach(x => L.push(`- ${x.label}: ${x.detail}`))
  }
  if (summary.patternsToRaise.length) {
    L.push('', 'PATTERNS WORTH DISCUSSING (not a diagnosis)')
    summary.patternsToRaise.forEach(p => L.push(`- ${p}`))
  }
  if (summary.questions.length) {
    L.push('', 'QUESTIONS TO ASK')
    summary.questions.forEach(q => L.push(`- ${q}`))
  }
  if (summary.tests.length) {
    L.push('', 'TESTS WORTH ASKING ABOUT')
    summary.tests.forEach(t => L.push(`- ${t}`))
  }
  L.push('', 'Generated by Em~power from my own tracked data. This is a wellness summary, not medical advice.')
  return L.join('\n')
}
