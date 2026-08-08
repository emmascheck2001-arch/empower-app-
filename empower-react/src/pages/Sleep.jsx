// route /sleep, phase-aware sleep guidance and evidence-based tips
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus } from '../lib/hormoneSync'
import { runSave } from '../lib/dbSave'
import { sanitize } from '../lib/validate'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'

const SLEEP_GUIDE = {
  Perimenopause: {
    headline: 'Hot flashes and hormonal fluctuations disrupt sleep differently each night',
    tips: [
      'Layer light breathable bedding so you can shed it quickly during a hot flash',
      'Keep a cool damp cloth nearby if it is comfortable and useful for you',
      'Dim the lights and put screens away an hour before bed to ease into sleep',
      'Consistent sleep and wake times anchor circadian rhythms when hormones are unpredictable',
    ],
    avoid: 'Alcohol, spicy food within 3 hours of bed, hot showers right before sleep, and warm rooms',
    science: 'Night sweats have many possible causes. Persistent or severe symptoms are worth discussing with a clinician.',
  },
  observation: {
    headline: 'Evidence-based sleep foundations for any hormonal phase',
    tips: [
      'Use a cool, dark room and adjust the temperature to what feels comfortable',
      'Morning light within 30 minutes of waking anchors your circadian rhythm',
      'Keep sleep and wake times reasonably consistent when your schedule allows',
      'Avoid caffeine after early afternoon, since it lingers and delays deep sleep',
    ],
    avoid: 'Caffeine after 2pm, alcohol within 3 hours of bed, screens without night mode, hot rooms',
    science: 'Sleep supports overall health. Cycle-related sleep changes vary and should not be assumed from a calendar phase alone.',
  },
}

const sLabel = { fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:8, display:'block' }

function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Personal touches: greet by name + time of day, read her recent sleep from her own
// logs, and connect tonight to the phase she is actually in. Makes the screen feel hers.
function timeGreeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still awake'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
// The most useful, phase-aware thing she can actually do tonight.
function topFix(key) {
  if (['Perimenopause','Early perimenopause','Late perimenopause','Postmenopause'].includes(key)) return 'try light bedding you can adjust quickly, a comfortably cool room, and a steady wind-down routine.'
  return 'keep a consistent wind-down, make the room cool and dark, and move caffeine earlier if you notice it affects your sleep.'
}
// Reads her recent sleep, then leads with what to do tonight.
function sleepInsight(recent, key) {
  const fix = topFix(key)
  const r = (recent || []).filter(x => x.sleep_quality)
  if (r.length < 2) return `Log a few nights and I'll tailor this to your patterns. Tonight, ${fix}`
  const poor = r.filter(x => ['Poor','Fair'].includes(x.sleep_quality)).length
  const good = r.filter(x => ['Good','Excellent','Great'].includes(x.sleep_quality)).length
  if (poor >= good && poor >= 2) return `Your last few nights have been rough. The biggest lever tonight: ${fix}`
  if (good > poor && good >= 2) return `You've been sleeping well lately. Keep it steady: ${fix}`
  return `Your sleep's been up and down. Tonight, ${fix}`
}

export default function Sleep() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [phase, setPhase] = useState('observation')
  const [subPhase, setSubPhase] = useState(null)
  const [userId, setUserId] = useState(null)
  const [hours, setHours] = useState('')
  const [quality, setQuality] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [whyOpen, setWhyOpen] = useState(false)
  const [name, setName] = useState('')
  const [recentSleep, setRecentSleep] = useState([])
  const [contextKey, setContextKey] = useState('natural-cycle')

  async function init() {
    setLoadError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    setUserId(user.id)
    try {
      const s = await getTodayStatus(supabase, user.id)
      setPhase(s.phase || 'observation')
      setSubPhase(s.subPhase || null)
      setName(s?.profile?.name || '')
      setContextKey(s?.contextKey || 'natural-cycle')
      // Pre-fill if already logged today
      const { data: existing } = await supabase.from('daily_logs')
        .select('sleep_quality,sleep_hours,hormonal_context').eq('user_id', user.id).eq('log_date', localDateStr()).maybeSingle()
      const existingInContext = existing && (existing.hormonal_context ? existing.hormonal_context === (s?.contextKey || 'natural-cycle') : (s?.contextKey || 'natural-cycle') === 'natural-cycle')
      if (existingInContext && existing?.sleep_quality) setQuality(existing.sleep_quality)
      if (existingInContext && existing?.sleep_hours != null) setHours(String(existing.sleep_hours))
      // Her recent sleep, to make tonight's guidance personal
      const { data: recent } = await supabase.from('daily_logs')
        .select('sleep_quality,log_date,hormonal_context').eq('user_id', user.id)
        .not('sleep_quality', 'is', null).order('log_date', { ascending: false }).limit(5)
      const context = s?.contextKey || 'natural-cycle'
      setRecentSleep((recent || []).filter(log => log.hormonal_context ? log.hormonal_context === context : context === 'natural-cycle'))
    } catch(e) { console.error(e); setLoadError('We could not load your health data, so personalised sleep guidance has been paused.') }
    setLoading(false)
  }

  useEffect(() => { init() }, [navigate])

  async function saveSleep() {
    if (!quality) return
    setSaving(true); setSaveError(null)
    // Only write the sleep fields. Hours live in their own column, never in `notes`,
    // so saving sleep can never overwrite notes the user wrote on the Log screen.
    const record = { user_id: userId, log_date: localDateStr(), hormonal_context:contextKey, sleep_quality: quality, sleep_hours: sanitize('sleep_hours', hours) }
    const res = await runSave(supabase.from('daily_logs').upsert(record, { onConflict: 'user_id,log_date' }))
    if (!res.ok) { setSaveError(res.message); setSaving(false); return }
    setSaved(true)
    setSaving(false)
  }

  if (loading) return <div style={{ paddingTop:60 }}><Spinner /></div>
  if (loadError) return <div style={{ padding:'80px 24px', textAlign:'center' }}><div style={{ fontSize:14, color:'#7a7268', lineHeight:1.6, marginBottom:16 }}>{loadError}</div><button className="btn-primary" onClick={() => { setLoading(true); init() }}>Try again</button><BottomNav /></div>

  const key = subPhase || phase
  const baseGuide = SLEEP_GUIDE[key] || SLEEP_GUIDE.observation
  const isNaturalCycleWindow = ['Menstrual','Follicular','Early follicular','Late follicular','Ovulatory','Luteal','Early luteal','Mid luteal','Late luteal'].includes(key)
  const guide = isNaturalCycleWindow ? {
    headline: `Sleep in your estimated ${key.toLowerCase()} window`,
    tips: [
      'Keep sleep and wake times as consistent as your life allows',
      'Use a cool, dark room and notice whether temperature changes help you personally',
      'Limit alcohol and late caffeine when they disrupt your sleep',
      'Track symptoms and sleep together for several cycles before calling the timing a personal pattern',
    ],
    avoid: 'Do not assume poor sleep is hormonal. Stress, illness, medicines, environment and sleep conditions can create the same pattern.',
    science: 'Cycle-related sleep effects vary between people. Your repeated observations matter more than a phase average.',
  } : baseGuide
  const phaseLabel = phase === 'observation' ? 'Observation mode' : key

  return (
    <div style={{ paddingBottom:100 }}>
      <TopBar title="SLEEP" backTo="/dashboard" />

      {/* Personalised banner, greeting, her recent sleep, and tonight in her phase */}
      <div style={{ background:'linear-gradient(135deg,#1c2030,#141825)', padding:'20px 20px 18px', marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(200,184,154,0.7)', marginBottom:4 }}>{timeGreeting()}{name ? `, ${name.split(' ')[0]}` : ''}</div>
        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20, color:'#e8e0d4', marginBottom:8 }}>{phaseLabel}</div>
        <div style={{ fontSize:13, color:'rgba(232,224,212,0.8)', lineHeight:1.65 }}>
          {sleepInsight(recentSleep, key)}
        </div>
      </div>

      <div style={{ padding:'0 16px' }}>

        {/* Sleep log form, the first thing to do */}
        <div className="card" style={{ marginBottom:12 }}>
          <span style={sLabel}>Log last night's sleep</span>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, color:'#7a7268', marginBottom:8 }}>Hours slept</div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button onClick={() => setHours(h => String(Math.max(1, (h === '' ? 7.5 : +h) - 0.5)))} style={{ width:36, height:36, borderRadius:10, border:'1px solid #ede8e0', background:'#faf8f5', cursor:'pointer', fontSize:18, color:'#7a7268', fontFamily:'inherit' }}>−</button>
              <input type="number" value={hours} onChange={e => setHours(e.target.value)} placeholder="7.5"
                min="1" max="14" step="0.5"
                style={{ flex:1, padding:'8px', border:'1px solid #ede8e0', borderRadius:10, fontSize:18, textAlign:'center', fontFamily:'inherit', color:'#2c2820' }} />
              <button onClick={() => setHours(h => String(Math.min(14, (h === '' ? 7.5 : +h) + 0.5)))} style={{ width:36, height:36, borderRadius:10, border:'1px solid #ede8e0', background:'#faf8f5', cursor:'pointer', fontSize:18, color:'#7a7268', fontFamily:'inherit' }}>+</button>
            </div>
          </div>
          <div style={{ fontSize:12, color:'#7a7268', marginBottom:8 }}>How did you sleep?</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
            {['Poor','Fair','Good','Excellent'].map(q => (
              <button key={q} onClick={() => setQuality(q)} style={{
                padding:'11px', borderRadius:10, border:`1px solid ${quality===q?'#c8b89a':'#ede8e0'}`,
                background:quality===q?'#e8dfd0':'#faf8f5', cursor:'pointer', fontSize:14,
                fontWeight:quality===q?600:400, color:quality===q?'#5a4a3a':'#2c2820', fontFamily:'inherit',
              }}>{q}</button>
            ))}
          </div>
          {saved
            ? <div style={{ textAlign:'center', fontSize:14, color:'#4a8a4a', padding:'12px 0' }}>Saved. Take your time reading tonight's tips below.</div>
            : <>
                {saveError && <div role="alert" style={{ fontSize:13, color:'#c05858', marginBottom:10, lineHeight:1.6, textAlign:'center' }}>{saveError}</div>}
                <button className="btn-primary" onClick={saveSleep} disabled={!quality || saving}>
                  {saving ? 'Saving...' : (saveError ? 'Try again' : 'Save sleep log')}
                </button>
              </>
          }
        </div>

        {/* Tips for tonight, specific to your phase */}
        <div className="card" style={{ marginBottom:12 }}>
          <span style={sLabel}>What helps tonight</span>
          {guide.tips.map((tip, i) => (
            <div key={i} style={{ display:'flex', gap:10, marginBottom: i < guide.tips.length-1 ? 12 : 0 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#c8b89a', flexShrink:0, marginTop:6 }} />
              <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6 }}>{tip}</div>
            </div>
          ))}
        </div>

        {/* Avoid */}
        <div style={{ background:'#fdf5f0', border:'1px solid #f0d8cc', borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
          <span style={{ ...sLabel, color:'#8a4030' }}>Avoid tonight</span>
          <div style={{ fontSize:13, color:'#6a3020', lineHeight:1.6 }}>{guide.avoid}</div>
        </div>

        {/* Why sleep matters, collapsible, kept at the bottom */}
        <div className="card" style={{ marginBottom:12, padding:0, overflow:'hidden' }}>
          <button onClick={() => setWhyOpen(o => !o)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'14px 16px', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
            <span style={{ ...sLabel, marginBottom:0 }}>Why sleep matters for your hormones</span>
            <i className={`ti ti-chevron-${whyOpen ? 'up' : 'down'}`} style={{ color:'#c8b89a', fontSize:16, flexShrink:0 }} />
          </button>
          {whyOpen && (
            <div style={{ padding:'0 16px 14px' }}>
              <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6, marginBottom:10 }}>
                Sleep supports recovery, mood, attention and metabolic health. Cycle changes can affect sleep for some people, while stress, illness, medicines, environment and sleep conditions can cause the same symptoms. Repeated personal observations are more informative than one estimated phase.
              </div>
              <div style={{ fontSize:11, color:'#9a9590', fontStyle:'italic' }}>{guide.science}</div>
            </div>
          )}
        </div>

      </div>
      <div style={{ fontSize:10, color:'#b0a89a', textAlign:'center', padding:'10px 24px 0', lineHeight:1.5 }}>Sleep guidance is general information, not a diagnosis or personal treatment plan.</div>
      <BottomNav />
    </div>
  )
}
