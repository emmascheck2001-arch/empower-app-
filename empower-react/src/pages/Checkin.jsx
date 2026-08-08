// route /checkin, quick 5-question morning check-in: energy, cervical fluid, sleep, RHR, mood, symptoms
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
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [saved, setSaved] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [saveError, setSaveError] = useState('')

  const [log, setLog] = useState({
    energy: null, mucus: null, sleep_quality: null, resting_hr: null,
    mood: [], symptoms: [], flow_volume:null, pain_rating:null
  })

  useEffect(() => { init() }, [])

  async function init() {
    setLoadError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    try {
      const s = await getTodayStatus(supabase, user.id)
      setStatus(s)
    } catch(e) { console.error(e); setLoadError('We could not load your health data. Check-in guidance is paused until it reloads.') }
    setLoading(false)
  }

  const set = (f, v) => setLog(p => ({ ...p, [f]: v }))
  const toggleMood = (v) => setLog(p => ({ ...p, mood: p.mood.includes(v) ? p.mood.filter(x => x !== v) : [...p.mood, v] }))
  const toggleSymptom = (v) => setLog(p => ({ ...p, symptoms: p.symptoms.includes(v) ? p.symptoms.filter(x => x !== v) : [...p.symptoms, v] }))

  async function save() {
    setSaving(true)
    setSaveError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login', { replace: true }); return }
      const today = localDateStr()
      const { error:logError } = await supabase.from('daily_logs').upsert({
        user_id: user.id, log_date: today,
        hormonal_context: status?.contextKey || 'natural-cycle',
        energy: log.energy, sleep_quality: log.sleep_quality,
        resting_hr: log.resting_hr, mood: log.mood, symptoms: log.symptoms,
        flow_volume:log.flow_volume, pain_rating:log.pain_rating,
      }, { onConflict: 'user_id,log_date' })
      if (logError) throw logError
      if (log.mucus && log.mucus !== 'Nothing') {
        const { error:mucusError } = await supabase.from('mucus_logs').upsert({
          user_id: user.id, log_date: today, discharge_type: log.mucus
        }, { onConflict: 'user_id,log_date' })
        if (mucusError) throw mucusError
      } else if (log.mucus === 'Nothing') {
        // Explicitly "Nothing" clears any earlier mucus entry for today
        const { error:mucusDeleteError } = await supabase.from('mucus_logs').delete().eq('user_id', user.id).eq('log_date', today)
        if (mucusDeleteError) throw mucusDeleteError
      }
      const newStatus = await getTodayStatus(supabase, user.id)
      const pct = newStatus.personalisationPct ?? 0
      setFeedbackMsg(`Check-in saved. Your personal data coverage is now ${pct}%.`)
      setSaved(true)
      setTimeout(() => navigate('/dashboard'), 2500)
    } catch(e) {
      console.error(e)
      setSaveError('Your check-in could not be saved. Please try again.')
      setSaving(false)
    }
  }

  if (loading) return <div style={{ paddingTop: 60 }}><Spinner /></div>
  if (loadError || !status) return <div style={{ padding:'80px 24px', textAlign:'center' }}><div style={{ fontSize:14, color:'#7a7268', lineHeight:1.6, marginBottom:16 }}>{loadError || 'We could not load your check-in.'}</div><button className="btn-primary" onClick={() => { setLoading(true); init() }}>Try again</button></div>

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
  const isPregnant = status?.profile?.user_path === '6'

  return (
    <div>
      {/* Top bar */}
      <div style={{ background:'#f5f0e8', padding:'calc(16px + var(--sat)) 20px 16px', borderBottom:'1px solid #ede8e0', textAlign:'center' }}>
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
        {!isPath4 && !isPregnant && <div style={{ marginBottom:20 }}>
          <span style={sLabel}>Mucus this morning?</span>
          <div style={{ fontSize:11, color:'#9a9590', marginBottom:8, fontStyle:'italic' }}>Cervical fluid can add context to an estimated fertile window, but it is not reliable contraception and can be affected by infection, medicines and arousal.</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {['Nothing','Creamy','Watery','Egg white','Spotting'].map(o => (
              <button key={o} style={pill(log.mucus===o)} onClick={() => set('mucus', o)}>{o}</button>
            ))}
          </div>
        </div>}

        {(isPath4 || isPregnant) && <div style={{ marginBottom:20 }}>
          <span style={sLabel}>{isPregnant ? 'Vaginal bleeding today?' : 'Bleeding today?'}</span>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>{['None','Spotting','Light','Heavy','Very heavy'].map(o=><button key={o} style={pill(log.flow_volume===o)} onClick={()=>set('flow_volume',o)}>{o}</button>)}</div>
          <span style={sLabel}>Pain level?</span>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>{[0,1,2,3,4,5].map(o=><button key={o} style={pill(log.pain_rating===o)} onClick={()=>set('pain_rating',o)}>{o}</button>)}</div>
          {isPregnant && ((log.flow_volume && log.flow_volume!=='None') || log.pain_rating>=4) && <div style={{marginTop:10,fontSize:12,color:'#9a3f2c',lineHeight:1.6}}>Stop exercise and contact your pregnancy care provider now; seek urgent care for heavy bleeding, severe or one-sided pain, shoulder pain, fainting or feeling very unwell.</div>}
        </div>}

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
          <div style={{ fontSize:11, color:'#9a9590', marginBottom:8, fontStyle:'italic' }}>Compare with your own resting-heart-rate baseline; a single reading does not identify cycle phase.</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {['Under 55','55 to 65','65 to 75','Over 75'].map(o => (
              <button key={o} style={pill(log.resting_hr===o)} onClick={() => set('resting_hr', o)}>{o}</button>
            ))}
          </div>
        </div>

        {/* 5. Mood */}
        <div style={{ marginBottom:20 }}>
          <span style={sLabel}>How are you feeling mentally?</span>
          <div style={{ fontSize:11, color:'#9a9590', marginBottom:8, fontStyle:'italic' }}>Mood may vary with cycle timing for some people, but it is not used to identify ovulation or a phase.</div>
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

        {saveError && <div role="alert" style={{fontSize:12,color:'#9a3f2c',marginBottom:10}}>{saveError}</div>}
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save check-in'}</button>
      </div>
    </div>
  )
}
