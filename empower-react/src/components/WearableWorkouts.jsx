import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isNative, readRecentWorkouts, healthStoreName } from '../lib/healthkit'
import { getUserLocal } from '../lib/userLocalState'
import { diffCalendarDays } from '../lib/dateUtils.js'

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
  const diff = diffCalendarDays(t, d)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function WearableWorkouts({ contextKey = 'natural-cycle' }) {
  const [workouts, setWorkouts] = useState([])
  const [loggedDates, setLoggedDates] = useState({})   // date -> workout_feel already logged
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    if (!isNative()) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || !getUserLocal(user.id, 'healthConnected')) return
      const ws = await readRecentWorkouts(14)
      if (!ws?.length) return
      setWorkouts(ws.slice(0, 8))
      // Which of those days already have a workout logged (so we show "Logged" not "Log").
      try {
        const dates = [...new Set(ws.map(w => w.date))]
        const { data } = await supabase.from('daily_logs')
          .select('log_date,workout_feel,workout_imported,hormonal_context').eq('user_id', user.id).in('log_date', dates)
        const map = {}
        for (const r of data || []) {
          const sameContext = r.hormonal_context ? r.hormonal_context === contextKey : contextKey === 'natural-cycle'
          if (sameContext && (r.workout_feel || r.workout_imported)) map[r.log_date] = r.workout_feel || 'Imported'
        }
        setLoggedDates(map)
      } catch { /* non-fatal */ }
    }).catch(() => {})
  }, [contextKey])

  async function logIt(w) {
    setBusy(w.start)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Mark the activity as imported without inventing how it felt.
        const { error } = await supabase.from('daily_logs').upsert(
          { user_id: user.id, log_date: w.date, hormonal_context:contextKey, workout_imported: true, workout_feel_reported: false },
          { onConflict: 'user_id,log_date' })
        if (error) throw error
        setLoggedDates(prev => ({ ...prev, [w.date]: 'Imported' }))
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
