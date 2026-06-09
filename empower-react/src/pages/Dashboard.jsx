import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus, getPhase, getLutealSubPhase } from '../lib/hormoneSync'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'

const HERO_GRADIENT = {
  Menstrual:      'linear-gradient(135deg,#3d2830,#2c1f25)',
  Follicular:     'linear-gradient(135deg,#2c3828,#1f2c20)',
  Ovulatory:      'linear-gradient(135deg,#2c3035,#1f252c)',
  Luteal:         'linear-gradient(135deg,#352c20,#2c2415)',
  'Early luteal': 'linear-gradient(135deg,#352c20,#2c2415)',
  'Mid luteal':   'linear-gradient(135deg,#352c20,#2c2415)',
  'Late luteal':  'linear-gradient(135deg,#352c20,#2c2415)',
  Perimenopause:  'linear-gradient(135deg,#2c2035,#1f1528)',
  observation:    'linear-gradient(135deg,#2c2820,#1f1e18)',
}

const PHASE_DESC = {
  Menstrual:      'Low energy is real and valid today. Gentle movement, iron-rich food, and rest are your priorities.',
  Follicular:     'Rising estrogen brings rising energy. A good time to push training and take on new challenges.',
  Ovulatory:      'Peak estrogen and testosterone. Your body is primed for high intensity and social connection.',
  'Early luteal': 'Progesterone rising with a calming GABA effect. Good energy with a steadier feel.',
  'Mid luteal':   'Core temperature and resting heart rate are measurably higher. Recovery needs more attention.',
  'Late luteal':  'Both hormones dropping. PMS symptoms most likely now. Prioritise rest and self-compassion.',
  Luteal:         'Progesterone is elevated. The same workout genuinely feels harder — this is real physiology.',
  Perimenopause:  'Your hormonal landscape is changing. Every workout and every log builds your personal picture.',
  observation:    'We are learning your baseline. Keep logging and your personalised recommendations will emerge.',
}

const PROTEIN_MULT = {
  Menstrual: 1.5, Follicular: 1.7, Ovulatory: 1.8,
  'Early luteal': 1.8, 'Mid luteal': 2.0, 'Late luteal': 2.0,
  Luteal: 2.0, Perimenopause: 1.8, observation: 1.6,
}

function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function confLabel(c) {
  if (c > 0.90) return 'Fully personalised'
  if (c > 0.75) return 'Your personal baseline established'
  if (c > 0.55) return 'Mostly your data now'
  if (c > 0.30) return 'Your personal pattern is emerging'
  return 'Learning your baseline'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [d, setD] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login', { replace: true }); return }

      const [{ data: profile }, { data: cycleData }, { data: recentLogs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('cycle_data').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('daily_logs').select('energy,resting_hr,wrist_temp,log_date,sleep_quality,disruptors').eq('user_id', user.id).order('log_date', { ascending: false }).limit(7),
      ])

      if (profile && !profile.onboarding_complete) { navigate('/setup', { replace: true }); return }

      const bw = profile?.body_weight_kg || 65
      const isPath4 = profile?.user_path === '4'
      let phase = 'observation', subPhase = null, cycleDay = null, cycleLen = 28, daysLeft = null, confidence = 0.05

      if (isPath4) {
        phase = 'Perimenopause'; confidence = 0.5
      } else if (cycleData?.last_period_date) {
        const lastPeriod = new Date(cycleData.last_period_date + 'T00:00:00')
        const today = new Date(); today.setHours(0,0,0,0)
        cycleDay = Math.floor((today - lastPeriod) / 86400000) + 1
        cycleLen = cycleData.cycle_length || 28
        daysLeft = Math.max(0, cycleLen - cycleDay + 1)
        if (cycleDay > 0 && cycleDay <= cycleLen + 7) {
          phase = getPhase(cycleDay, cycleLen)
          subPhase = phase === 'Luteal' ? getLutealSubPhase(cycleDay, cycleLen) : null
          confidence = 0.45
          if (recentLogs?.length) {
            confidence += Math.min(0.25, recentLogs.length * 0.04)
            if (recentLogs[0]?.energy === 'Very low' && (phase === 'Follicular' || phase === 'Ovulatory')) confidence -= 0.12
          }
          confidence = Math.min(0.88, Math.max(0.05, confidence))
        }
      }

      const today = localDateStr()
      const { data: todayLog } = await supabase.from('daily_logs').select('id').eq('user_id', user.id).eq('log_date', today).maybeSingle()
      const alreadyLogged = !!todayLog

      let streak = 0
      if (recentLogs?.length) {
        const check = new Date(); check.setHours(0,0,0,0)
        for (const log of recentLogs) {
          const diff = Math.floor((check - new Date(log.log_date + 'T00:00:00')) / 86400000)
          if (diff === streak) { streak++; check.setDate(check.getDate() - 1) } else break
        }
      }

      let anomalyItems = []
      try {
        const status = await getTodayStatus(supabase, user.id)
        if (status.anomalies?.length) anomalyItems.push(...status.anomalies.map(a => ({ type: 'anomaly', text: a.text || a.message })))
        if (status.moodInsight?.message) anomalyItems.push({ type: 'mood', text: status.moodInsight.message })
      } catch(e) {}

      let alloLoad = 0
      if (recentLogs?.length >= 3) {
        if (phase === 'Menstrual') alloLoad++
        if (subPhase === 'Late luteal') alloLoad++
        if (recentLogs.filter(l => l.sleep_quality === 'Poor').length >= 2) alloLoad += 2
        if (recentLogs.filter(l => l.energy === 'Very low').length >= 2) alloLoad += 2
        recentLogs.forEach(l => { if (l.disruptors?.length) alloLoad += Math.min(l.disruptors.length, 2) })
        alloLoad = Math.min(10, alloLoad)
      }

      setD({ profile, phase, subPhase, cycleDay, cycleLen, daysLeft, confidence, bw, alreadyLogged, streak, recentLogs, anomalyItems, alloLoad, isPath4 })
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return <><div style={{ paddingTop: 60 }}><Spinner /></div><BottomNav /></>
  if (!d) return null

  const { phase, subPhase, cycleDay, cycleLen, daysLeft, confidence, bw, alreadyLogged, streak, recentLogs, anomalyItems, alloLoad, isPath4 } = d
  const phaseLabel = phase === 'observation' ? 'Observation mode' : phase === 'Perimenopause' ? 'Perimenopause' : `${subPhase || phase} phase`
  const heroGrad = HERO_GRADIENT[subPhase] || HERO_GRADIENT[phase] || HERO_GRADIENT.observation
  const protein = Math.round(bw * (PROTEIN_MULT[subPhase] || PROTEIN_MULT[phase] || 1.7))
  const confPct = Math.round(confidence * 100)
  const alloC = alloLoad >= 7 ? { bg:'#fce8e0', border:'#f0b8a0', text:'#8a3020', label:'High load' }
    : { bg:'#fef4e4', border:'#f0d498', text:'#6a4a10', label:'Moderate load' }

  return (
    <>
      <div style={{ background:'#f5f0e8', padding:'20px 20px 16px', borderBottom:'1px solid #ede8e0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase' }}>Em~power</div>
        <div style={{ fontSize:13, color:'#7a7268' }}>{d.profile?.name || ''}</div>
      </div>

      <div style={{ padding:'16px 16px 100px' }}>

        {/* Hero */}
        <div style={{ borderRadius:16, padding:'28px 24px', color:'#e8e0d4', background:heroGrad, marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(232,224,212,0.6)', marginBottom:6 }}>Your phase</div>
          <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:24, marginBottom:6 }}>{phaseLabel}</div>
          <div style={{ fontSize:13, color:'rgba(232,224,212,0.75)', marginBottom:14 }}>
            {cycleDay ? `Day ${cycleDay} of ${cycleLen}, ${daysLeft} days until next period` : 'Tracking your cycle patterns'}
          </div>
          <div style={{ fontSize:13, color:'rgba(232,224,212,0.8)', lineHeight:1.7, marginBottom:16 }}>
            {PHASE_DESC[subPhase] || PHASE_DESC[phase] || PHASE_DESC.observation}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: confidence > 0.55 ? '#88c088' : confidence > 0.30 ? '#e0c070' : '#c88878' }} />
            <span style={{ fontSize:12, color:'rgba(232,224,212,0.7)' }}>{confLabel(confidence)} — {confPct}%</span>
          </div>
          <button onClick={() => navigate(alreadyLogged ? '/log' : '/checkin')} style={{ background:'rgba(232,224,212,0.15)', border:'1px solid rgba(232,224,212,0.3)', borderRadius:10, padding:'11px 18px', color:'#e8e0d4', fontSize:14, fontWeight:500, cursor:'pointer', width:'100%', fontFamily:'inherit' }}>
            {alreadyLogged ? 'Update log' : 'Morning check-in'}
          </button>
          {!alreadyLogged && (
            <div style={{ textAlign:'center', marginTop:8 }}>
              <button onClick={() => navigate('/log')} style={{ background:'none', border:'none', fontSize:12, color:'rgba(232,224,212,0.5)', cursor:'pointer', textDecoration:'underline', fontFamily:'inherit' }}>Full log instead</button>
            </div>
          )}
        </div>

        {/* Streak */}
        {streak > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'#fff', border:'1px solid #ede8e0', borderRadius:10, marginBottom:12, fontSize:13, fontWeight:500 }}>
            <i className="ti ti-flame" style={{ color:'#c8b89a', fontSize:16 }} />
            {streak === 1 ? '1 day streak' : `${streak} day streak`}
          </div>
        )}

        {/* First-time card */}
        {!alreadyLogged && (!recentLogs || recentLogs.length === 0) && (
          <div className="card" style={{ marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Welcome to Em~power</div>
            <div style={{ fontSize:13, color:'#7a7268', lineHeight:1.6, marginBottom:12 }}>Your first log starts building your personal baseline. The algorithm learns from your data over time.</div>
            <button className="btn-primary" onClick={() => navigate('/checkin')}>Start your first check-in</button>
          </div>
        )}

        {/* Already logged banner */}
        {alreadyLogged && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'#f0f8f0', border:'1px solid #c8e0c8', borderRadius:12, marginBottom:12 }}>
            <i className="ti ti-circle-check" style={{ color:'#4a8a4a', fontSize:20, flexShrink:0 }} />
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#2a4a2a' }}>Logged today</div>
              <div style={{ fontSize:12, color:'#4a7a4a' }}>Your data is in. Check back tomorrow.</div>
            </div>
          </div>
        )}

        {/* Anomaly / mood */}
        {anomalyItems.map((item, i) => (
          <div key={i} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:'12px 14px', marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:4 }}>
              {item.type === 'mood' ? 'Your mood today' : 'Something worth noting'}
            </div>
            <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6 }}>{item.text}</div>
          </div>
        ))}

        {/* Nutrition card */}
        <div className="card" style={{ cursor:'pointer', marginBottom:10 }} onClick={() => navigate('/nutrition')}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'#f5f0e8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <i className="ti ti-salad" style={{ fontSize:20, color:'#c8b89a' }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600 }}>Nutrition guidance</div>
              <div style={{ fontSize:13, color:'#7a7268' }}>Aim for {protein}g protein today</div>
            </div>
            <i className="ti ti-chevron-right" style={{ color:'#c8b89a', fontSize:18, flexShrink:0 }} />
          </div>
        </div>

        {/* Stats row */}
        {cycleDay && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
            {[{ label:'Cycle day', value:`Day ${cycleDay}` },{ label:'Days left', value:daysLeft },{ label:'Day streak', value:streak }].map(s => (
              <div key={s.label} className="card" style={{ textAlign:'center', padding:'12px 8px' }}>
                <div style={{ fontSize:18, fontWeight:700 }}>{s.value}</div>
                <div style={{ fontSize:10, color:'#9a9590', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Allostatic load */}
        {alloLoad >= 4 && (
          <div style={{ background:alloC.bg, border:`1px solid ${alloC.border}`, borderRadius:12, padding:'12px 14px', marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:alloC.text, marginBottom:4 }}>Allostatic load — {alloC.label}</div>
            <div style={{ fontSize:13, color:alloC.text, lineHeight:1.6 }}>
              {alloLoad >= 7 ? 'Your combined load this week is high. When allostatic load is consistently high your body responds by down-regulating reproductive hormones. Consider rest, eat more, and prioritise sleep. (Sims ST. ROAR 2024)' : 'Your load this week is moderate. Keep recovery a priority alongside training.'}
            </div>
          </div>
        )}

        {/* Phase cards */}
        <div className="section-label" style={{ marginTop:8, marginBottom:10 }}>{isPath4 ? 'Your hormonal phases' : 'Your cycle phases'}</div>
        {['Menstrual','Follicular','Ovulatory','Luteal'].map(p => {
          const isActive = phase === p || subPhase === p
          return (
            <div key={p} className="card" style={{ marginBottom:8, cursor:'pointer', borderColor:isActive ? '#c8b89a' : '#ede8e0', background:isActive ? '#faf5ee' : '#fff' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{p}</div>
                  <div style={{ fontSize:12, color:'#9a9590', marginTop:2 }}>Hormones, training and nutrition</div>
                </div>
                {isActive ? <div style={{ fontSize:10, fontWeight:600, background:'#2c2820', color:'#f5f0e8', padding:'3px 8px', borderRadius:6 }}>Now</div>
                  : <i className="ti ti-chevron-right" style={{ color:'#c8b89a', fontSize:16 }} />}
              </div>
            </div>
          )
        })}

        <div style={{ textAlign:'center', marginTop:16 }}>
          <button onClick={() => navigate('/feedback')} style={{ background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>Share feedback</button>
        </div>
      </div>
      <BottomNav />
    </>
  )
}
