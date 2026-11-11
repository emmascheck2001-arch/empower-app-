// Weekly summary modal + dashboard card, a review of ONLY what she logged in the past week.
// Permanent rule: every line here must be derived from the user's own logged data, no
// generic "many women notice" predictions, no prescribed experiments, nothing invented.
import { weeklyLogProgress } from '../lib/weeklySummary'

export function WeeklyNudgeCard({ logs, onLog }) {
  const { count, needed } = weeklyLogProgress(logs)
  return (
    <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16, marginBottom:12 }}>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:8 }}>This week</div>
      <div style={{ fontSize:15, color:'#2c2820', lineHeight:1.55, marginBottom:6 }}>
        You logged {count} day{count === 1 ? '' : 's'} this week.
      </div>
      <div style={{ fontSize:13, color:'#7a7268', lineHeight:1.55, marginBottom:12 }}>
        {needed} more and your weekly review unlocks, built only from what you logged.
      </div>
      <button type="button" onClick={onLog}
        style={{ width:'100%', padding:'12px', borderRadius:12, border:'none', background:'#2c2820', color:'#f5f0e8', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
        Log today
      </button>
    </div>
  )
}

export function WeeklySummaryModal({ summary, onDismiss, name }) {
  const {
    workouts, currentPhase, confPct,
    goodEnergyPct, energyWord, sleepWord, moodWord,
    consistencyPct, observation, nextPhaseLabel, lookingAhead, highlights,
  } = summary
  // Keep the wins list positive: the one constructive note lives in "One observation".
  const wins = (highlights || []).filter(h => !/fewer|less|stress was highest/i.test(h))
  const HDR = { fontSize:12, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9a8a6a', marginBottom:10, display:'flex', alignItems:'center', gap:8 }
  const metrics = [
    { label:'Energy', val: goodEnergyPct != null ? `${goodEnergyPct}%` : (energyWord || ', ') },
    { label:'Sleep', val: sleepWord || ', ' },
    { label:'Mood', val: moodWord || ', ' },
    { label:'Cycle', val: currentPhase },
  ]

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(44,40,32,0.65)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#faf8f5', borderRadius:'20px 20px 0 0', padding:'20px 20px 40px', maxWidth:420, width:'100%', maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ width:36, height:4, background:'#c8b89a', borderRadius:2, margin:'0 auto 18px' }} />

        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:24, color:'#2c2820' }}>7-Day Review</div>
        <div style={{ fontSize:14, color:'#7a7268', marginBottom:22 }}>{name ? `${name}, here is what your last seven days show.` : 'Here is what your last seven days show.'}</div>

        {/* Biggest win */}
        <div style={{ marginBottom:18 }}>
          <div style={HDR}><span style={{ fontSize:15 }}>⭐</span>Biggest win</div>
          <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16 }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#2c2820' }}>{workouts} workout{workouts === 1 ? '' : 's'} completed</div>
            <div style={{ fontSize:14, color:'#7a7268', marginTop:4 }}>{consistencyPct}% logging consistency</div>
          </div>
        </div>

        {/* Your wins this week, positive highlights and comparisons to last week */}
        {wins.length > 0 && (
          <div style={{ marginBottom:18 }}>
            <div style={HDR}><span style={{ fontSize:15 }}>🌿</span>Your wins this week</div>
            <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:'14px 16px' }}>
              {wins.map((h, i) => (
                <div key={i} style={{ fontSize:14, color:'#3a3530', lineHeight:1.6, display:'flex', gap:9, marginBottom: i === wins.length - 1 ? 0 : 8 }}>
                  <span style={{ color:'#88c088', fontWeight:700, flexShrink:0 }}>✓</span>{h}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your week */}
        <div style={{ marginBottom:18 }}>
          <div style={HDR}><span style={{ fontSize:15 }}>📈</span>Your week</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
            {metrics.map((m,i) => (
              <div key={i} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:'12px 6px', textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#2c2820', lineHeight:1.2 }}>{m.val}</div>
                <div style={{ fontSize:9, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', color:'#9a9590', marginTop:4 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* One observation, the star */}
        <div style={{ marginBottom:18 }}>
          <div style={HDR}><span style={{ fontSize:15 }}>🔍</span>This week's observation</div>
          <div style={{ fontSize:12, color:'#7a7268', lineHeight:1.5, marginTop:-6, marginBottom:8 }}>This is a seven-day snapshot. Repeated patterns from your full history appear on Home.</div>
          <div style={{ background:'#f3ede1', border:'1px solid #e4d8c2', borderRadius:14, padding:'16px 18px' }}>
            <div style={{ fontSize:15, color:'#3a3020', lineHeight:1.6 }}>{observation}</div>
          </div>
        </div>

        {/* Your data */}
        <div style={{ marginBottom:18 }}>
          <div style={HDR}><span style={{ fontSize:15 }}>🧠</span>Your data</div>
          <div style={{ fontSize:14, color:'#5a5048', lineHeight:1.6 }}>
            {confPct >= 65 ? 'Your daily observations are giving Em~power a strong base for personalised guidance.' : 'Every meaningful check-in makes your guidance more individual.'} Guidance personalisation is at {confPct}%. Cycle-date estimates use separate timing evidence from recorded period starts.
          </div>
        </div>

        {/* Looking ahead */}
        <div style={{ marginBottom:20 }}>
          <div style={HDR}><span style={{ fontSize:15 }}>📚</span>Looking ahead</div>
          <div style={{ fontSize:14, color:'#5a5048', lineHeight:1.6 }}>
            {lookingAhead?.text
              || (nextPhaseLabel
                ? `You're moving into your ${nextPhaseLabel.toLowerCase()} phase soon.`
                : `You'll stay in your ${(currentPhase || 'current').toLowerCase()} phase over the coming days.`)}
          </div>
        </div>

        <button className="btn-primary" onClick={onDismiss} style={{ fontSize:15 }}>Got it</button>
      </div>
    </div>
  )
}
