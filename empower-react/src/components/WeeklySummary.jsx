// Weekly summary modal + dashboard card — shown once per week on first open
// Utility functions are intentionally exported alongside components here.
/* eslint-disable react-refresh/only-export-components */

import { getPhase, getLutealSubPhase } from '../lib/hormoneSync'

function getWeekKey() {
  const d = new Date()
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return `weekly-${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`
}

function scoreEnergy(e) {
  return { 'Very low':1, 'Low':2, 'Normal':3, 'Good':3, 'High':4 }[e] ?? null
}
function scoreSleep(s) {
  return { 'Poor':1, 'Fair':2, 'Good':3, 'Great':4, 'Excellent':4 }[s] ?? null
}

const MOOD_COLORS = {
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
const PHASE_BULLETS = {
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
const PHASE_EXPERIMENTS = {
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

const sLabel = { fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:10, display:'block' }

export function WeeklySummaryModal({ summary, onDismiss }) {
  const {
    daysLogged, workouts, currentPhase,
    goodEnergyPct, goodSleepPct, workoutRate, topMoods,
    nextLabel, nextBullets, experiment,
    isLowerEnergyPhase, sleepEnergyCorrelation, paired,
  } = summary

  const consistencyNote = daysLogged === 7
    ? 'Perfect week. You gave us everything we need to learn your pattern.'
    : daysLogged >= 5
    ? `${daysLogged} days is strong consistency. Each entry makes your recommendations more personal.`
    : daysLogged >= 3
    ? `${daysLogged} days gives us enough to begin identifying patterns.`
    : `${daysLogged} days this week. Every log teaches the algorithm something about your baseline.`

  const activityNote = workouts === 0
    ? `No workouts logged during your ${currentPhase} phase${isLowerEnergyPhase ? '. Rest is a valid choice in this phase' : ''}.`
    : workouts === 1
    ? `${workouts} workout during your ${currentPhase} phase${isLowerEnergyPhase ? ', which takes real effort when energy is lower' : ''}.`
    : `${workouts} workouts during your ${currentPhase} phase${isLowerEnergyPhase ? ', showing strong consistency despite lower-energy days' : ''}.`

  const sleepNote = paired.length === 0
    ? 'Log sleep quality and energy together to see how closely they track each other for you.'
    : sleepEnergyCorrelation
    ? 'On days when sleep scores were higher, energy levels were also reported as higher. Your sleep is one of your strongest signals.'
    : 'Sleep and energy did not track closely this week. Worth watching. Disrupted sleep often shows up in energy within 24 hours.'

  // Color the stat pct
  function pctColor(pct) {
    if (pct === null) return '#9a9590'
    if (pct >= 70) return '#3a7a3a'
    if (pct >= 40) return '#8a6a1a'
    return '#8a2a2a'
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(44,40,32,0.65)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#faf8f5', borderRadius:'20px 20px 0 0', padding:'20px 20px 44px', maxWidth:420, width:'100%', maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ width:36, height:4, background:'#c8b89a', borderRadius:2, margin:'0 auto 20px' }} />

        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:22, marginBottom:16, color:'#2c2820' }}>Weekly Insights</div>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
          {[
            { label:'Good energy', value: goodEnergyPct !== null ? `${goodEnergyPct}%` : 'No data', color: pctColor(goodEnergyPct) },
            { label:'Good sleep', value: goodSleepPct !== null ? `${goodSleepPct}%` : 'No data', color: pctColor(goodSleepPct) },
            { label:'Active days', value: workoutRate !== null ? `${workoutRate}%` : 'No data', color: pctColor(workoutRate) },
          ].map(s => (
            <div key={s.label} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:10, padding:'12px 10px', textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:700, color:s.color, marginBottom:2 }}>{s.value}</div>
              <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#9a9590', lineHeight:1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Mood this week */}
        {topMoods.length > 0 && (
          <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:16, marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:10 }}>HOW YOU FELT THIS WEEK</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {topMoods.map(([mood, count]) => {
                const c = MOOD_COLORS[mood] || { bg:'#f0ece8', text:'#5a4030' }
                return (
                  <div key={mood} style={{ display:'flex', alignItems:'center', gap:5, background:c.bg, borderRadius:20, padding:'5px 12px' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:c.text }}>{mood}</span>
                    <span style={{ fontSize:11, color:c.text, opacity:0.7 }}>{count}x</span>
                  </div>
                )
              })}
            </div>
            {topMoods.length === 0 && (
              <div style={{ fontSize:13, color:'#9a9590' }}>Log your mood each day to see your emotional patterns here.</div>
            )}
          </div>
        )}

        {/* Consistency */}
        <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:16, marginBottom:10 }}>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
            <span>✅</span> Your consistency this week
          </div>
          <div style={{ fontSize:13, color:'#5a5048', lineHeight:1.7 }}>{consistencyNote}</div>
        </div>

        {/* Activity */}
        <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:16, marginBottom:10 }}>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
            <span>💪</span> Movement
          </div>
          <div style={{ fontSize:13, color:'#5a5048', lineHeight:1.7 }}>{activityNote}</div>
        </div>

        {/* Sleep */}
        <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:16, marginBottom:20 }}>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
            <span>💤</span> Sleep as a signal
          </div>
          <div style={{ fontSize:13, color:'#5a5048', lineHeight:1.7 }}>{sleepNote}</div>
        </div>

        {/* Divider */}
        <div style={{ borderTop:'1px solid #ede8e0', marginBottom:20 }} />

        {/* Trend to watch */}
        {nextLabel && nextBullets && (
          <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:16, marginBottom:14 }}>
            <span style={sLabel}>TREND TO WATCH</span>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ fontSize:16 }}>🌱</span>
              <div style={{ fontSize:14, fontWeight:600, color:'#2c2820' }}>{nextLabel} starts next week</div>
            </div>
            <div style={{ fontSize:12, color:'#9a9590', marginBottom:10 }}>Many women notice:</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
              {nextBullets.map((b,i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'#3a3530', lineHeight:1.6 }}>
                  <span style={{ color:'#c8b89a', flexShrink:0, marginTop:2 }}>•</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:'#7a7268', lineHeight:1.6 }}>Watch for changes in how you feel over the next 7 days.</div>
          </div>
        )}

        {/* Experiment */}
        <div style={{ background:'#2c2820', borderRadius:12, padding:16, marginBottom:24 }}>
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#c8b89a', marginBottom:12, display:'block' }}>YOUR EXPERIMENT THIS WEEK</span>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:'#9a9590', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.05em' }}>Instead of</div>
            <div style={{ fontSize:13, color:'#c8b89a', lineHeight:1.6 }}>{experiment.instead}</div>
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:'#9a9590', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.05em' }}>Try</div>
            <div style={{ fontSize:13, color:'#f5f0e8', lineHeight:1.6, fontWeight:500 }}>{experiment.tryThis}</div>
          </div>
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:12 }}>
            <div style={{ fontSize:11, color:'#9a9590', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.05em' }}>Test this next week</div>
            <div style={{ fontSize:13, color:'#c8b89a', lineHeight:1.6 }}>Track: {experiment.track}</div>
          </div>
        </div>

        <button className="btn-primary" onClick={onDismiss} style={{ fontSize:15 }}>Got it</button>
      </div>
    </div>
  )
}

export function WeeklySummaryCard({ summary, onClick }) {
  const { daysLogged, goodEnergyPct, goodSleepPct, topMoods } = summary
  const topMood = topMoods?.[0]?.[0]

  return (
    <div onClick={onClick} style={{ background:'#fff', border:'1px solid #c8b89a', borderRadius:12, padding:14, marginBottom:12, cursor:'pointer' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590' }}>WEEKLY INSIGHTS</div>
        <i className="ti ti-chevron-right" style={{ color:'#c8b89a', fontSize:14 }} />
      </div>
      <div style={{ display:'flex', gap:12, marginBottom:8 }}>
        {goodEnergyPct !== null && (
          <div style={{ fontSize:13, color:'#3a3530' }}>
            <span style={{ fontWeight:700, color: goodEnergyPct >= 70 ? '#3a7a3a' : goodEnergyPct >= 40 ? '#8a6a1a' : '#8a2a2a' }}>{goodEnergyPct}%</span>
            {' '}good energy
          </div>
        )}
        {goodSleepPct !== null && (
          <div style={{ fontSize:13, color:'#3a3530' }}>
            <span style={{ fontWeight:700, color: goodSleepPct >= 70 ? '#3a7a3a' : goodSleepPct >= 40 ? '#8a6a1a' : '#8a2a2a' }}>{goodSleepPct}%</span>
            {' '}good sleep
          </div>
        )}
      </div>
      <div style={{ fontSize:12, color:'#7a7268', lineHeight:1.6 }}>
        {daysLogged} days logged{topMood ? `, most felt ${topMood.toLowerCase()}` : ''}. Tap for full insights.
      </div>
    </div>
  )
}
