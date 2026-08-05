// route /sleep, phase-aware sleep guidance and evidence-based tips
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus } from '../lib/hormoneSync'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'

const SLEEP_GUIDE = {
  Menstrual: {
    headline: 'Low estrogen and progesterone can make sleep lighter',
    tips: [
      'Keep your room cool. Your body temperature regulation is already stressed',
      'Avoid alcohol, which fragments sleep and worsens cramps overnight',
      'Magnesium glycinate (around 400mg) before bed may improve sleep quality and how quickly you fall asleep (Abbasi et al. 2012). Check with your doctor first if you have kidney problems',
      'A warm bath 1 to 2 hours before bed lowers core temperature as you get out, signalling sleep onset',
    ],
    avoid: 'Caffeine after 2pm, alcohol, late heavy meals, screens without night mode',
    science: 'Source: Charkoudian and Stachenfeld. Comprehensive Physiology. 2014.',
  },
  Follicular: {
    headline: 'Rising estrogen generally improves sleep quality',
    tips: [
      'This is your best sleep window of the cycle, so take advantage of it',
      'Consistent wake times reinforce your circadian rhythm while hormones are cooperative',
      'Morning light exposure (10 minutes outside) anchors your sleep drive for the night',
      'Higher intensity training is well-tolerated this phase and can improve sleep pressure',
    ],
    avoid: 'Late training sessions close to bed, which can delay sleep onset even when you feel good',
    science: 'Source: Lokuge et al. Journal of Psychiatry and Neuroscience. 2011.',
  },
  Ovulatory: {
    headline: 'Peak estrogen, generally your best sleep window',
    tips: [
      'Sleep quality is typically at its highest right now',
      'Use this window to build consistent sleep habits that carry into the luteal phase',
      'Avoid the temptation to cut sleep short with high energy. Your hormones are doing the work',
      'LH surge and slight core temperature rise may cause a brief sleep disruption around ovulation day',
    ],
    avoid: 'Overtraining in this window which can raise cortisol and disrupt the following nights',
    science: 'Source: De Martin Topranin et al. IJSPP. 2023.',
  },
  'Early luteal': {
    headline: 'Progesterone has a calming effect on sleep',
    tips: [
      'Progesterone converts in your brain into a calming compound that acts like a natural sleep aid',
      'You may fall asleep more easily than usual, which is real physiology',
      'Core temperature begins to rise slightly, so keep your room cool (18 to 20 degrees Celsius)',
      'Protein-rich meals support progesterone production and stable blood sugar overnight',
    ],
    avoid: 'Alcohol, which blocks the natural calming effect progesterone is currently providing',
    science: 'Source: Backstrom et al. Archives of Women\'s Mental Health. 2008.',
  },
  'Mid luteal': {
    headline: 'Elevated core temperature and RHR make sleep harder to maintain',
    tips: [
      'Your resting heart rate is measurably higher right now, so a cool room matters more than usual',
      'Hold a consistent room temperature around 18 to 20 degrees Celsius to help you stay asleep',
      'Avoid eating within 2 hours of bed, since digestion raises core temperature further',
      'Sleep may feel lighter or less restorative, which is expected physiology, not a problem with you',
    ],
    avoid: 'Caffeine after noon, alcohol, hot baths close to bedtime, screens in bed',
    science: 'Source: De Martin Topranin et al. IJSPP. 2023. RHR 1.7 bpm higher in mid-luteal phase (P=.006). Sleep quality measurably impaired.',
  },
  'Late luteal': {
    headline: 'Sleep gets harder as progesterone drops in late luteal',
    tips: [
      'As progesterone falls, the calming effect it was providing disappears, which is why sleep becomes lighter and anxiety increases',
      'Anxiety and lighter sleep in late luteal are biological changes, not psychological ones',
      'Chamomile tea, magnesium glycinate, and consistent sleep times all reduce the impact',
      'Avoid anything that raises cortisol in the evening, including arguments and stressful content',
    ],
    avoid: 'Alcohol is particularly harmful now, since it removes the calming effect progesterone was providing and increases night waking',
    science: 'Source: Backstrom et al. Psychoneuroendocrinology. 2014.',
  },
  Luteal: {
    headline: 'Progesterone elevates core temperature and affects sleep depth',
    tips: [
      'Keep your room cool. 18 to 20 degrees Celsius is the target',
      'Finish eating about 2 hours before bed so digestion does not raise your core temperature',
      'Consistent sleep and wake times matter more in the luteal phase',
      'Protein at dinner stabilises blood sugar and reduces night waking',
    ],
    avoid: 'Caffeine after noon, alcohol, late heavy meals',
    science: 'Source: De Martin Topranin et al. IJSPP. 2023.',
  },
  Perimenopause: {
    headline: 'Hot flashes and hormonal fluctuations disrupt sleep differently each night',
    tips: [
      'Layer light breathable bedding so you can shed it quickly during a hot flash',
      'Keep a cool damp cloth nearby, as evaporative cooling drops skin temperature fast',
      'Dim the lights and put screens away an hour before bed to ease into sleep',
      'Consistent sleep and wake times anchor circadian rhythms when hormones are unpredictable',
    ],
    avoid: 'Alcohol, spicy food within 3 hours of bed, hot showers right before sleep, and warm rooms',
    science: 'Source: Freeman EW et al. Archives of General Psychiatry. 2004 and 2006. Harlow 2012 STRAW+10.',
  },
  observation: {
    headline: 'Evidence-based sleep foundations for any hormonal phase',
    tips: [
      'Cool room between 18 and 20 degrees Celsius supports faster sleep onset and deeper stages',
      'Morning light within 30 minutes of waking anchors your circadian rhythm',
      'Consistent sleep and wake times, even on weekends, matter more than duration alone',
      'Avoid caffeine after early afternoon, since it lingers and delays deep sleep',
    ],
    avoid: 'Caffeine after 2pm, alcohol within 3 hours of bed, screens without night mode, hot rooms',
    science: 'Aim for 7 to 9 hours. Reproductive hormones are produced and regulated during sleep.',
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
  if (['Mid luteal','Late luteal','Luteal'].includes(key)) return 'keep your room cool, around 18°C, and take 400mg magnesium glycinate before bed. Your body runs hotter this phase, so cooling matters more.'
  if (key === 'Menstrual') return 'try a warm bath and 400mg magnesium glycinate before bed. It lowers your core temperature and eases cramps.'
  if (key === 'Early luteal') return 'lean into the calm with a steady wind-down and a cool, dark room.'
  if (['Follicular','Early follicular','Late follicular','Ovulatory'].includes(key)) return 'lock in a consistent bedtime and get morning light within 30 minutes of waking to anchor your rhythm.'
  if (['Perimenopause','Early perimenopause','Late perimenopause','Postmenopause'].includes(key)) return 'layer light bedding you can shed, keep the room cool, and take 400mg magnesium glycinate at night.'
  return 'cool the room to around 18°C, cut caffeine after 2pm, and put screens away an hour before bed.'
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
  const [phase, setPhase] = useState('observation')
  const [subPhase, setSubPhase] = useState(null)
  const [userId, setUserId] = useState(null)
  const [hours, setHours] = useState('')
  const [quality, setQuality] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [whyOpen, setWhyOpen] = useState(false)
  const [name, setName] = useState('')
  const [recentSleep, setRecentSleep] = useState([])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login', { replace: true }); return }
      setUserId(user.id)
      try {
        const s = await getTodayStatus(supabase, user.id)
        setPhase(s.phase || 'observation')
        setSubPhase(s.subPhase || null)
        setName(s?.profile?.name || '')
        // Pre-fill if already logged today
        const { data: existing } = await supabase.from('daily_logs')
          .select('sleep_quality,sleep_hours').eq('user_id', user.id).eq('log_date', localDateStr()).maybeSingle()
        if (existing?.sleep_quality) setQuality(existing.sleep_quality)
        if (existing?.sleep_hours != null) setHours(String(existing.sleep_hours))
        // Her recent sleep, to make tonight's guidance personal
        const { data: recent } = await supabase.from('daily_logs')
          .select('sleep_quality,log_date').eq('user_id', user.id)
          .not('sleep_quality', 'is', null).order('log_date', { ascending: false }).limit(5)
        setRecentSleep(recent || [])
      } catch { /* ignore */ }
      setLoading(false)
    }
    init()
  }, [navigate])

  async function saveSleep() {
    if (!quality) return
    setSaving(true)
    // Only write the sleep fields. Hours live in their own column, never in `notes`,
    // so saving sleep can never overwrite notes the user wrote on the Log screen.
    const record = { user_id: userId, log_date: localDateStr(), sleep_quality: quality, sleep_hours: hours ? parseFloat(hours) : null }
    await supabase.from('daily_logs').upsert(record, { onConflict: 'user_id,log_date' })
    setSaved(true)
    setSaving(false)
  }

  if (loading) return <div style={{ paddingTop:60 }}><Spinner /></div>

  const key = subPhase || phase
  const guide = SLEEP_GUIDE[key] || SLEEP_GUIDE.observation
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
            : <button className="btn-primary" onClick={saveSleep} disabled={!quality || saving}>
                {saving ? 'Saving...' : 'Save sleep log'}
              </button>
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
                Sleep is not passive recovery. Estrogen and progesterone are produced and regulated during sleep. Consistently poor sleep disrupts the hormonal cascade that controls your cycle, metabolism, and mood. (Haver MC. 2025)
              </div>
              <div style={{ fontSize:11, color:'#9a9590', fontStyle:'italic' }}>{guide.science}</div>
            </div>
          )}
        </div>

      </div>
      <div style={{ fontSize:10, color:'#b0a89a', textAlign:'center', padding:'10px 24px 0', lineHeight:1.5 }}>Supplement doses shown are from research, not a personal recommendation. Ask your doctor before starting any supplement.</div>
      <BottomNav />
    </div>
  )
}
