// route /checkin — quick 5-question morning check-in: energy, cervical fluid, sleep, RHR, mood, symptoms
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus } from '../lib/hormoneSync'
import Spinner from '../components/Spinner'

function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const pill = (a) => ({
  padding:'7px 14px', borderRadius:20, border:`1px solid ${a?'#c8b89a':'#ede8e0'}`,
  background:a?'#e8dfd0':'#fff', color:a?'#5a4a3a':'#2c2820',
  fontWeight:a?500:400, fontSize:13, cursor:'pointer', fontFamily:'inherit'
})
const grid4 = (a) => ({
  padding:'12px 8px', borderRadius:10, border:`1px solid ${a?'#c8b89a':'#ede8e0'}`,
  background:a?'#e8dfd0':'#fff', color:a?'#5a4a3a':'#2c2820',
  fontWeight:a?500:400, fontSize:13, cursor:'pointer', textAlign:'center', fontFamily:'inherit'
})
const sLabel = { fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:8, display:'block' }

export default function Checkin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [saved, setSaved] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState('')

  const [log, setLog] = useState({
    energy: null, mucus: null, sleep_quality: null, resting_hr: null,
    mood: [], symptoms: []
  })

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    try {
      const s = await getTodayStatus(supabase, user.id)
      setStatus(s)
    } catch { /* non-critical — page still works without status */ }
    setLoading(false)
  }

  const set = (f, v) => setLog(p => ({ ...p, [f]: v }))
  const toggleMood = (v) => setLog(p => ({ ...p, mood: p.mood.includes(v) ? p.mood.filter(x => x !== v) : [...p.mood, v] }))
  const toggleSymptom = (v) => setLog(p => ({ ...p, symptoms: p.symptoms.includes(v) ? p.symptoms.filter(x => x !== v) : [...p.symptoms, v] }))

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    const today = localDateStr()
    try {
      await supabase.from('daily_logs').upsert({
        user_id: user.id, log_date: today,
        energy: log.energy, sleep_quality: log.sleep_quality,
        resting_hr: log.resting_hr, mood: log.mood, symptoms: log.symptoms,
      }, { onConflict: 'user_id,log_date' })
      if (log.mucus && log.mucus !== 'Nothing') {
        await supabase.from('mucus_logs').upsert({
          user_id: user.id, log_date: today, discharge_type: log.mucus
        }, { onConflict: 'user_id,log_date' })
      }
      const newStatus = await getTodayStatus(supabase, user.id)
      const pct = Math.round((newStatus.confidence || 0) * 100)
      setFeedbackMsg(`Check-in saved. Algorithm confidence now ${pct}%.`)
      setSaved(true)
      setTimeout(() => navigate('/dashboard'), 2500)
    } catch(e) {
      console.error(e)
      setSaving(false)
    }
  }

  if (loading) return <div style={{ paddingTop: 60 }}><Spinner /></div>

  if (saved) {
    return (
      <div onClick={() => navigate('/dashboard')} style={{ padding: 24, textAlign: 'center', cursor: 'pointer', minHeight: '70vh' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Check-in saved</div>
        <div style={{ fontSize: 14, color: '#7a7268', lineHeight: 1.6 }}>{feedbackMsg}</div>
        <div style={{ fontSize: 12, color: '#9a9590', marginTop: 16 }}>Tap anywhere to go to dashboard</div>
      </div>
    )
  }

  const phase = status?.subPhase || status?.phase || 'Observation mode'
  const isPath4 = status?.profile?.user_path === '4'

  return (
    <div>
      {/* Top bar */}
      <div style={{ background:'#f5f0e8', padding:'16px 20px', borderBottom:'1px solid #ede8e0', textAlign:'center' }}>
        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20 }}>{phase}</div>
        <div style={{ fontSize:12, color:'#9a9590', marginTop:4 }}>
          {status?.cycleDay ? `Day ${status.cycleDay}` : 'Building baseline'}
        </div>
      </div>

      <div style={{ padding:'16px 16px 100px' }}>
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>Morning check-in</div>
          <div style={{ fontSize:13, color:'#7a7268' }}>5 questions, under 30 seconds</div>
        </div>

        {/* 1. Energy */}
        <div style={{ marginBottom:20 }}>
          <span style={sLabel}>How is your energy today?</span>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {['Very low','Low','Good','High'].map(o => (
              <button key={o} style={grid4(log.energy===o)} onClick={() => set('energy', o)}>{o}</button>
            ))}
          </div>
        </div>

        {/* 2. Mucus */}
        <div style={{ marginBottom:20 }}>
          <span style={sLabel}>Mucus this morning?</span>
          {!isPath4 && <div style={{ fontSize:11, color:'#9a9590', marginBottom:8, fontStyle:'italic' }}>80% sensitivity for detecting your fertile window (Bigelow et al. 2004)</div>}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {['Nothing','Creamy','Watery','Egg white','Spotting'].map(o => (
              <button key={o} style={pill(log.mucus===o)} onClick={() => set('mucus', o)}>{o}</button>
            ))}
          </div>
        </div>

        {/* 3. Sleep */}
        <div style={{ marginBottom:20 }}>
          <span style={sLabel}>Sleep last night?</span>
          {isPath4 && <div style={{ fontSize:11, color:'#9a9590', marginBottom:8, fontStyle:'italic' }}>Sleep disruption is one of the earliest and most consistent perimenopause symptoms.</div>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {['Poor','Fair','Good','Great'].map(o => (
              <button key={o} style={grid4(log.sleep_quality===o)} onClick={() => set('sleep_quality', o)}>{o}</button>
            ))}
          </div>
        </div>

        {/* 4. RHR */}
        <div style={{ marginBottom:20 }}>
          <span style={sLabel}>Resting heart rate this morning?</span>
          <div style={{ fontSize:11, color:'#9a9590', marginBottom:8, fontStyle:'italic' }}>RHR rises 1.7 bpm in mid-luteal phase (De Martin Topranin et al. 2023)</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {['Under 55','55 to 65','65 to 75','Over 75'].map(o => (
              <button key={o} style={pill(log.resting_hr===o)} onClick={() => set('resting_hr', o)}>{o}</button>
            ))}
          </div>
        </div>

        {/* 5. Mood */}
        <div style={{ marginBottom:20 }}>
          <span style={sLabel}>How are you feeling mentally?</span>
          <div style={{ fontSize:11, color:'#9a9590', marginBottom:8, fontStyle:'italic' }}>Mood patterns are a genuine phase signal (Backstrom et al. 2008)</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {['Energised','Happy','Calm','Focused','Tired','Anxious','Irritable','Low'].map(o => (
              <button key={o} style={pill(log.mood.includes(o))} onClick={() => toggleMood(o)}>{o}</button>
            ))}
          </div>
        </div>

        {/* 6. Physical symptoms (optional) */}
        <div style={{ marginBottom:24 }}>
          <span style={sLabel}>Any physical symptoms? (optional)</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {['Cramps','Bloating','Headache','Fatigue','Breast tenderness'].map(o => (
              <button key={o} style={pill(log.symptoms.includes(o))} onClick={() => toggleSymptom(o)}>{o}</button>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save check-in'}</button>
      </div>
    </div>
  )
}
