// Utility functions and data for the weekly summary feature.
// Kept in lib/ (not components/) so they can be exported without
// triggering the react-refresh/only-export-components lint rule.

import { getPhase, getLutealSubPhase } from './hormoneSync'

export function getWeekKey() {
  const d = new Date()
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return `weekly-${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`
}

export function scoreEnergy(e) {
  return { 'Very low':1, 'Low':2, 'Normal':3, 'Good':3, 'High':4 }[e] ?? null
}
export function scoreSleep(s) {
  return { 'Poor':1, 'Fair':2, 'Good':3, 'Great':4, 'Excellent':4 }[s] ?? null
}

export const MOOD_COLORS = {
  Energised:  { bg:'#e8f8e8', text:'#2a4a2a' },
  Energetic:  { bg:'#e8f8e8', text:'#2a4a2a' },
  Happy:      { bg:'#f8f0e8', text:'#5a3010' },
  Motivated:  { bg:'#f0f8e8', text:'#3a4a1a' },
  Confident:  { bg:'#e8f0f8', text:'#1a3060' },
  Social:     { bg:'#f8e8f0', text:'#5a1040' },
  Calm:       { bg:'#e8eef8', text:'#1a3060' },
  Focused:    { bg:'#e8f8f8', text:'#1a5050' },
  Tired:      { bg:'#f0ece8', text:'#5a4030' },
  Anxious:    { bg:'#f8e8e8', text:'#6a2020' },
  Irritable:  { bg:'#f8ece0', text:'#6a3810' },
  Sad:        { bg:'#ece8f0', text:'#3a2060' },
  'Brain fog':{ bg:'#ecedf0', text:'#3a3a50' },
  'Low mood': { bg:'#ece8f0', text:'#3a2060' },
  Low:        { bg:'#ece8f0', text:'#3a2060' },
}

// Bullet points for what women typically notice in each phase — "TREND TO WATCH" section
export const PHASE_BULLETS = {
  Menstrual:      ['Lower energy is typical and normal','Gentle movement tends to help more than pushing through','Anti-inflammatory foods make a real difference','This phase passes quickly as estrogen begins to rise'],
  Follicular:     ['Higher energy returning','Better workout performance','Faster recovery between sessions','Increased motivation and drive'],
  Ovulatory:      ['Peak confidence and strength performance','Highest social energy of the cycle','Sharpest mental focus','Best window for hard sessions'],
  'Early luteal': ['Calm, settled mood from rising progesterone','Good steady energy still available','Strong training still possible','Body temperature begins to rise slightly'],
  'Mid luteal':   ['Resting heart rate and temperature measurably higher','The same workouts feel harder — this is real physiology','Recovery is slower than follicular','Mood stability decreasing'],
  'Late luteal':  ['Both hormones dropping sharply','PMS symptoms most likely this week','Energy lower than earlier phases','Will ease once your period begins'],
  Luteal:         ['Progesterone elevated and temperature rising','Same workouts feel harder','Recovery slower than follicular','Protein and sleep are most important'],
  Perimenopause:  ['Hormone levels fluctuating day to day','Sleep and energy may be unpredictable','Strength training is most protective right now','Patterns emerge over weeks, not days'],
  Observation:    ['Building your personal baseline','Each log teaches the algorithm your normal','Patterns will emerge with consistency','Recommendations will personalise as data grows'],
}

// Phase-specific experiments for "YOUR EXPERIMENT THIS WEEK"
export const PHASE_EXPERIMENTS = {
  Menstrual: {
    instead: 'Pushing through high-intensity training',
    tryThis:  'Swap one intense session for yoga or a long walk',
    track:    'How your energy and cramps compare on movement days vs rest days',
  },
  Follicular: {
    instead: 'Keeping weights the same as last week',
    tryThis:  'Add 5 to 10% to your main lifts',
    track:    'Whether you feel stronger than your last follicular phase',
  },
  Ovulatory: {
    instead: 'Training solo every session',
    tryThis:  'Try a group class or train with a friend',
    track:    'Whether social training affects your intensity or enjoyment',
  },
  'Early luteal': {
    instead: 'Skipping protein at breakfast',
    tryThis:  'Hit 1.8g per kg of bodyweight every day this week',
    track:    'Recovery and mood on high-protein vs lower-protein days',
  },
  'Mid luteal': {
    instead: 'Comparing your pace and weights to your follicular phase',
    tryThis:  'Train by feel and rate of perceived effort instead of numbers',
    track:    'Perceived exertion vs actual output and notice the gap',
  },
  'Late luteal': {
    instead: 'Pushing through disrupted sleep',
    tryThis:  'Many women find magnesium before bed helps sleep — ask your doctor if it is right for you',
    track:    'Sleep quality scores before and after to see if it makes a difference',
  },
  Luteal: {
    instead: 'Training at the same intensity as follicular phase',
    tryThis:  'Drop weights by 10% but maintain reps and form',
    track:    'How you feel after each session vs how you felt last phase',
  },
  Perimenopause: {
    instead: 'Only doing cardio sessions this week',
    tryThis:  'Add one heavy strength session',
    track:    'Energy and sleep quality the day after and note the difference',
  },
  Observation: {
    instead: 'Guessing what your body needs',
    tryThis:  'Log every day this week and include how you actually feel',
    track:    'Whether your energy and sleep scores follow any pattern across days',
  },
}

export function shouldShowWeeklySummary(logs) {
  const key = getWeekKey()
  if (localStorage.getItem(`${key}-shown`)) return false
  const thisWeek = logs.filter(l => {
    const diff = Math.floor((new Date() - new Date(l.log_date + 'T00:00:00')) / 86400000)
    return diff < 7
  })
  return thisWeek.length >= 3
}

export function markWeeklySummaryShown() {
  localStorage.setItem(`${getWeekKey()}-shown`, '1')
}

export function markWeeklySummaryDismissed() {
  localStorage.setItem(`${getWeekKey()}-dismissed`, '1')
}

export function wasDismissedToday() {
  return !!localStorage.getItem(`${getWeekKey()}-dismissed`)
}

export function buildWeeklySummary(logs, phase, subPhase, confidence, daysUntilPeriod, cycleDay, cycleLen) {
  const now = new Date()
  const thisWeek = logs.filter(l => Math.floor((now - new Date(l.log_date + 'T00:00:00')) / 86400000) < 7)

  const daysLogged = thisWeek.length
  const workouts = thisWeek.filter(l => l.workout_feel && l.workout_feel !== 'Rest day' && l.workout_feel !== 'Skipped').length

  // Percentage stats
  const energyDays = thisWeek.filter(l => scoreEnergy(l.energy) !== null)
  const goodEnergyPct = energyDays.length
    ? Math.round(energyDays.filter(l => scoreEnergy(l.energy) >= 3).length / energyDays.length * 100)
    : null

  const sleepDays = thisWeek.filter(l => scoreSleep(l.sleep_quality) !== null)
  const goodSleepPct = sleepDays.length
    ? Math.round(sleepDays.filter(l => scoreSleep(l.sleep_quality) >= 3).length / sleepDays.length * 100)
    : null

  const workoutRate = daysLogged > 0 ? Math.round(workouts / daysLogged * 100) : null

  // Mood tally — count each mood across the week, return sorted top entries
  const moodTally = {}
  thisWeek.forEach(l => {
    if (l.mood?.length) {
      l.mood.forEach(m => { moodTally[m] = (moodTally[m] || 0) + 1 })
    }
  })
  const topMoods = Object.entries(moodTally).sort((a,b) => b[1]-a[1]).slice(0,5)

  // Sleep-energy correlation
  const paired = thisWeek.filter(l => scoreSleep(l.sleep_quality) !== null && scoreEnergy(l.energy) !== null)
  const goodSleepDays = paired.filter(l => scoreSleep(l.sleep_quality) >= 3)
  const avgEnergyOnGoodSleep = goodSleepDays.length
    ? goodSleepDays.reduce((a,l) => a + scoreEnergy(l.energy), 0) / goodSleepDays.length
    : null
  const sleepEnergyCorrelation = avgEnergyOnGoodSleep !== null && avgEnergyOnGoodSleep >= 3

  const currentPhase = subPhase || phase || 'Observation'
  const confPct = Math.round((confidence || 0) * 100)
  const isLowerEnergyPhase = ['Menstrual','Late luteal','Mid luteal'].includes(currentPhase)

  // Calculate next week's phase
  let nextPhase = null
  let nextSubPhase = null
  if (cycleDay && cycleLen && phase !== 'Perimenopause' && phase !== 'observation') {
    const nextCycleDay = cycleDay + 7
    if (nextCycleDay <= cycleLen) {
      nextPhase = getPhase(nextCycleDay, cycleLen)
      nextSubPhase = nextPhase === 'Luteal' ? getLutealSubPhase(nextCycleDay, cycleLen) : null
    } else {
      const newCycleDay = nextCycleDay - cycleLen
      nextPhase = getPhase(newCycleDay, cycleLen)
      nextSubPhase = nextPhase === 'Luteal' ? getLutealSubPhase(newCycleDay, cycleLen) : null
    }
  }
  const nextLabel = nextSubPhase || nextPhase
  const nextBullets = nextLabel ? (PHASE_BULLETS[nextLabel] || PHASE_BULLETS[nextPhase] || null) : null
  const experiment = PHASE_EXPERIMENTS[currentPhase] || PHASE_EXPERIMENTS.Observation

  return {
    daysLogged, workouts, currentPhase, confPct, daysUntilPeriod,
    goodEnergyPct, goodSleepPct, workoutRate, topMoods,
    nextLabel, nextBullets, experiment,
    isLowerEnergyPhase, sleepEnergyCorrelation, paired,
  }
}
