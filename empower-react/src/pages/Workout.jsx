import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus } from '../lib/hormoneSync'
import BottomNav from '../components/BottomNav'
import TopBar from '../components/TopBar'
import Spinner from '../components/Spinner'

const ACTIVITIES = [
  { id:'walk', label:'Walk', icon:'ti-walk' },
  { id:'run', label:'Run', icon:'ti-run' },
  { id:'cycle', label:'Cycle', icon:'ti-bike' },
  { id:'swim', label:'Swim', icon:'ti-swimming' },
  { id:'gym', label:'Gym', icon:'ti-barbell' },
  { id:'yoga', label:'Yoga', icon:'ti-leaf' },
  { id:'pilates', label:'Pilates', icon:'ti-accessible' },
  { id:'hiit', label:'HIIT', icon:'ti-flame' },
  { id:'rest', label:'Rest day', icon:'ti-zzz' },
]

const PHASE_COLORS = {
  Menstrual:     { bg:'#3d2830', text:'#f5e8e8' },
  Follicular:    { bg:'#2c3828', text:'#e8f5e8' },
  Ovulatory:     { bg:'#2c3035', text:'#e8f0f8' },
  Luteal:        { bg:'#352c20', text:'#f5ede0' },
  Perimenopause: { bg:'#2c2820', text:'#f5f0e8' },
  Observation:   { bg:'#2c2820', text:'#f5f0e8' },
}

export default function Workout() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    try {
      const s = await getTodayStatus(supabase, user.id)
      setStatus(s)
    } catch(e) {}
    setLoading(false)
  }

  async function logActivity() {
    if (!selected) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
    await supabase.from('daily_logs').upsert({
      user_id: user.id, log_date: today, workout_feel: selected
    }, { onConflict: 'user_id,log_date' })
    setSaved(true)
    setTimeout(() => navigate('/dashboard'), 1500)
  }

  if (loading) return <div style={{ paddingTop:60 }}><Spinner /></div>

  const phase = status?.phase || 'Observation'
  const subPhase = status?.subPhase || phase
  const intensity = status?.intensityModifier ?? 1.0
  const intensityLabel = status?.intensityLabel || 'Moderate'
  const pColors = PHASE_COLORS[phase] || PHASE_COLORS.Observation

  const isAcl = (phase === 'Ovulatory') && (selected === 'gym' || selected === 'hiit')
  const isHiitWarning = (subPhase === 'Mid luteal' || subPhase === 'Late luteal') && selected === 'hiit'

  return (
    <div style={{ paddingBottom:100 }}>
      <TopBar title="WORKOUT" subtitle={`${subPhase} — ${Math.round(intensity * 100)}% intensity`} />

      {/* Phase banner */}
      <div style={{ background:`linear-gradient(135deg, ${pColors.bg}, ${pColors.bg}dd)`, padding:'20px 16px', marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:pColors.text, opacity:0.7, marginBottom:4 }}>TODAY</div>
        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:22, color:pColors.text, marginBottom:6 }}>{subPhase}</div>
        <div style={{ fontSize:13, color:pColors.text, opacity:0.85, lineHeight:1.6 }}>
          {intensityLabel} effort day. Intensity modifier {Math.round(intensity * 100)}%.
        </div>
      </div>

      <div style={{ padding:'0 16px' }}>
        {/* ACL warning */}
        {isAcl && (
          <div style={{ background:'#fff8e6', border:'1px solid #f0c040', borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:4, color:'#6a4a00' }}>Your warmup matters more today</div>
            <div style={{ fontSize:12, color:'#7a6020', lineHeight:1.6 }}>Peak estrogen increases ligament laxity. Complete all warmup exercises before loading any weight.</div>
          </div>
        )}

        {/* HIIT warning */}
        {isHiitWarning && (
          <div style={{ background:'#fdf3f0', border:'1px solid #e8a080', borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:4, color:'#6a2800' }}>HIIT is more stressful in this phase</div>
            <div style={{ fontSize:12, color:'#7a4020', lineHeight:1.6 }}>Progesterone competes with cortisol receptors. High intensity creates a larger net stress response in the luteal phase (Hackney 2006).</div>
          </div>
        )}

        <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:12, display:'block' }}>Choose your activity</span>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:20 }}>
          {ACTIVITIES.map(a => (
            <div key={a.id} onClick={() => setSelected(a.id)} style={{
              padding:'14px 8px', borderRadius:12, border:`1px solid ${selected===a.id?'#c8b89a':'#ede8e0'}`,
              background:selected===a.id?'#e8dfd0':'#fff', cursor:'pointer', textAlign:'center'
            }}>
              <i className={`ti ${a.icon}`} style={{ fontSize:22, display:'block', marginBottom:4, color:selected===a.id?'#5a4a3a':'#c8b89a' }} />
              <div style={{ fontSize:11, fontWeight:selected===a.id?600:400, color:selected===a.id?'#5a4a3a':'#2c2820' }}>{a.label}</div>
            </div>
          ))}
        </div>

        {/* Post-workout nutrition */}
        {status?.nutritionTargets && (
          <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:8 }}>Post-workout nutrition</div>
            <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>{status.nutritionTargets.proteinG}g protein today</div>
            <div style={{ fontSize:12, color:'#7a7268', lineHeight:1.6 }}>{status.nutritionTargets.headline}</div>
          </div>
        )}

        {saved ? (
          <div style={{ textAlign:'center', padding:16, fontSize:15, color:'#2c2820', fontWeight:500 }}>Logged. Taking you back...</div>
        ) : (
          <button className="btn-primary" onClick={logActivity} disabled={!selected || saving}>
            {saving ? 'Saving...' : selected ? `Log ${ACTIVITIES.find(a=>a.id===selected)?.label}` : 'Select an activity above'}
          </button>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
