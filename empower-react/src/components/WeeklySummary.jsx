// Weekly summary modal + dashboard card — shown once per week on first open

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
