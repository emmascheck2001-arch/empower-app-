import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isNative, readRecentWorkouts, healthStoreName } from '../lib/healthkit'

// Shows the user's recent Apple Watch / wearable workouts (pulled from Apple Health / Health
// Connect) and lets them log one into their Em~power day with a tap. Native only, and only after
// the user has connected the health store. Renders nothing on web or when there are no workouts.
const ICONS = {
  Run: 'ti-run', Walk: 'ti-walk', Cycle: 'ti-bike', Swim: 'ti-swimming',
  Gym: 'ti-barbell', Yoga: 'ti-leaf', Pilates: 'ti-accessible', HIIT: 'ti-flame',
}
function icon(a) { return ICONS[a] || 'ti-activity' }

function label(w) {
  const bits = [`${w.minutes || 0} min`]
  if (w.calories) bits.push(`${w.calories} cal`)
  if (w.km) bits.push(`${w.km} km`)
  return bits.join(' · ')
}
function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0)
  const diff = Math.round((t - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function WearableWorkouts() {
  const [workouts, setWorkouts] = useState([])
  const [loggedDates, setLoggedDates] = useState({})   // date -> workout_feel already logged
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    if (!isNative()) return
    let connected = false
    try { connected = !!localStorage.getItem('healthConnected') } catch { /* ignore */ }
    if (!connected) return
    readRecentWorkouts(14).then(async ws => {
      if (!ws?.length) return
      setWorkouts(ws.slice(0, 8))
      // Which of those days already have a workout logged (so we show "Logged" not "Log").
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const dates = [...new Set(ws.map(w => w.date))]
        const { data } = await supabase.from('daily_logs')
          .select('log_date,workout_feel').eq('user_id', user.id).in('log_date', dates)
        const map = {}
        for (const r of data || []) if (r.workout_feel) map[r.log_date] = r.workout_feel
        setLoggedDates(map)
      } catch { /* non-fatal */ }
    }).catch(() => {})
  }, [])

  async function logIt(w) {
    setBusy(w.start)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Mark the day as a completed workout without overriding a feel the user already set.
        await supabase.from('daily_logs').upsert(
          { user_id: user.id, log_date: w.date, workout_feel: 'Average' },
          { onConflict: 'user_id,log_date' })
        setLoggedDates(prev => ({ ...prev, [w.date]: 'Average' }))
      }
    } catch { /* non-fatal */ }
    setBusy(null)
  }

  if (!isNative() || !workouts.length) return null

  return (
    <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16, marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <i className="ti ti-heartbeat" style={{ fontSize:18, color:'#3a8a6a' }} />
        <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9a9590' }}>From {healthStoreName()}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {workouts.map(w => {
          const already = loggedDates[w.date]
          return (
            <div key={w.start} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 4px' }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'#f2ede4', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`ti ${icon(w.activity)}`} style={{ fontSize:18, color:'#8a6a4a' }} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#2c2820' }}>{w.activity}</div>
                <div style={{ fontSize:12, color:'#9a9590' }}>{dayLabel(w.date)} · {label(w)}</div>
              </div>
              {already ? (
                <span style={{ fontSize:12, color:'#3a8a6a', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}><i className="ti ti-check" style={{ fontSize:14 }} />Logged</span>
              ) : (
                <button onClick={() => logIt(w)} disabled={busy === w.start} style={{ fontSize:13, fontWeight:600, color:'#2c2820', background:'#f2ede4', border:'none', borderRadius:16, padding:'6px 14px', cursor:'pointer', fontFamily:'inherit' }}>
                  {busy === w.start ? '…' : 'Log'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
