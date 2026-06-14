// route /dashboard — main home screen: phase hero card, anomaly alerts, nutrition card, streak, allostatic load, phase info sheet
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus, getPhase, getLutealSubPhase } from '../lib/hormoneSync'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'
import { WeeklySummaryModal, WeeklySummaryCard, markWeeklySummaryDismissed, buildWeeklySummary } from '../components/WeeklySummary'

const PHASE_COLORS = {
  Menstrual:      { dot:'#e09898', bg:'#f0d8d8', text:'#5a2a28' },
  Follicular:     { dot:'#88c088', bg:'#d8f0d8', text:'#1a4a1a' },
  Ovulatory:      { dot:'#88c0e0', bg:'#d0e8f8', text:'#1a3a5a' },
  'Early luteal': { dot:'#e0c070', bg:'#f8e8c8', text:'#6a3a10' },
  'Mid luteal':   { dot:'#d0a040', bg:'#f0d098', text:'#5a3008' },
  'Late luteal':  { dot:'#c88878', bg:'#f0c8b8', text:'#5a2818' },
  Luteal:         { dot:'#d0a040', bg:'#f0d098', text:'#5a3008' },
  Perimenopause:  { dot:'#b090d0', bg:'#ece0f8', text:'#4a2870' },
  observation:    { dot:'#b0a898', bg:'#e8e5e0', text:'#4a4540' },
}

function friendPhase(card) {
  if (!card.last_period_date || !card.cycle_length) return null
  if (card.user_path === '4') return 'Perimenopause'
  const last = new Date(card.last_period_date + 'T00:00:00')
  const now = new Date(); now.setHours(0,0,0,0)
  const cd = Math.floor((now - last) / 86400000) + 1
  if (cd < 1 || cd > card.cycle_length + 14) return null
  const ph = getPhase(cd, card.cycle_length)
  return ph === 'Luteal' ? getLutealSubPhase(cd, card.cycle_length) : ph
}

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
  bc:             'linear-gradient(135deg,#26303a,#1a222c)',
}

const PHASE_DESC_BASE = {
  Menstrual:      'Estrogen and progesterone are at their lowest. Iron, anti-inflammatory foods, and rest are your biological priority right now.',
  Follicular:     'Rising estrogen supports faster recovery, stronger training sessions, and better mood. A good window to push training load.',
  Ovulatory:      'Peak estrogen and testosterone together. Your body is primed for high-intensity training and your brain is performing at its sharpest.',
  'Early luteal': 'Progesterone is rising with a calming effect. Energy is typically still good this sub-phase — a steady, focused week ahead.',
  'Mid luteal':   'Your core temperature and resting heart rate are measurably higher right now. The same session costs more physiologically — this is real biology, not a fitness change.',
  'Late luteal':  'Both hormones are dropping. Mood changes, lighter sleep, and PMS symptoms have a direct hormonal cause and will ease when your period begins.',
  Luteal:         'Progesterone is elevated and your body is working harder than it appears. Recovery takes longer and training may feel heavier.',
  Perimenopause:  'Your hormonal landscape is shifting. Resistance training, adequate protein, and consistent sleep are your strongest tools for managing symptoms and protecting long-term health.',
  observation:    'We are learning your baseline. Keep logging and your personalised recommendations will emerge from your own data over time.',
  bc:             'Your contraception keeps your hormones steady, so there is no natural cycle to track. Consistent training and protein matter more than timing, and strength work is your highest-value investment for long-term hormonal health.',
}

function getPersonalisedPhaseDesc(phase, subPhase, recentLogs) {
  const key = subPhase || phase
  const base = PHASE_DESC_BASE[key] || PHASE_DESC_BASE[phase] || PHASE_DESC_BASE.observation
  if (!recentLogs?.length) return base
  const today = recentLogs[0]
  const recent = recentLogs.slice(0, 5)
  const allSymptoms = recent.flatMap(l => l.symptoms || [])
  const allMoods = recent.flatMap(l => l.mood || [])
  const energyValues = recent.map(l => l.energy).filter(Boolean)
  const sleepValues = recent.map(l => l.sleep_quality).filter(Boolean)
  const poorSleepCount = sleepValues.filter(s => s === 'Poor').length
  const lowEnergyCount = energyValues.filter(e => ['Low','Very low'].includes(e)).length
  const hasCramps = allSymptoms.some(s => ['Cramps','Cramping'].includes(s))
  const hasHighEnergy = energyValues.some(e => e === 'High')
  const hasNegMood = allMoods.some(m => ['Anxious','Irritable','Low','Sad'].includes(m))

  if (today?.energy === 'Very low' && ['Follicular','Ovulatory'].includes(phase))
    return `${base} You logged very low energy today — that is real data worth noting even in a high-energy phase. Keep logging so we can track the pattern.`
  if (hasCramps && phase === 'Menstrual')
    return `${base} You logged cramps — salmon, ginger, and magnesium are your highest-priority foods right now.`
  if (poorSleepCount >= 3)
    return `${base} You have logged poor sleep ${poorSleepCount} times recently — sleep drives hormonal recovery. Magnesium glycinate and a cool room are your evidence-based priorities tonight.`
  if (lowEnergyCount >= 3 && phase === 'Follicular')
    return `${base} Your logs show consistently low energy this follicular phase — rising estrogen usually supports energy, so this pattern is worth tracking across your next cycle.`
  if (hasHighEnergy && ['Follicular','Ovulatory'].includes(phase))
    return `${base} You logged high energy — this matches exactly what rising estrogen does. Push your training this week.`
  if (hasNegMood && ['Late luteal','Mid luteal','Luteal'].includes(key))
    return `${base} You logged anxious or low mood — this matches the hormonal pattern directly. Magnesium, protein, and stable blood sugar all help here.`
  return base
}

const SLEEP_SUBTITLES = {
  Menstrual:      'Low hormones can disrupt sleep this week',
  Follicular:     'Rising estrogen improves sleep quality now',
  Ovulatory:      'Generally your best sleep window',
  'Early luteal': 'Progesterone has a calming effect on sleep',
  'Mid luteal':   'Elevated temperature may disrupt sleep',
  'Late luteal':  'GABA withdrawal can cause lighter sleep',
  Luteal:         'Elevated temperature may disrupt sleep',
  Perimenopause:  'Hot flashes and sleep tips for tonight',
  observation:    'Evidence-based sleep habits for any phase',
  bc:             'Steady hormones support consistent sleep',
}

const PROTEIN_MULT = {
  Menstrual: 1.5, Follicular: 1.7, Ovulatory: 1.8,
  'Early luteal': 1.8, 'Mid luteal': 2.0, 'Late luteal': 2.0,
  Luteal: 2.0, Perimenopause: 1.8, observation: 1.6, bc: 1.6,
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

const PHASE_SHEET_INFO = {
  Menstrual: {
    bullets: ['Estrogen and progesterone are at their lowest','Serotonin is at its lowest point of the cycle','Prostaglandins are elevated','Iron is being lost through bleeding'],
    estrogen: { direction:'At its lowest point', patterns:['Mood, motivation, and energy are all affected by this drop','Will begin rising again as the follicular phase begins'] },
    progesterone: { direction:'At its lowest point', patterns:['Withdrawal from luteal levels triggered menstruation','No core temperature elevation or elevated RHR right now'] },
    expect: 'Low energy is real and valid. Gentle movement, iron-rich food, and rest are your priorities. Anti-inflammatory foods help with cramps.',
  },
  Follicular: {
    bullets: ['Estrogen is rising','Progesterone remains low','Energy and recovery often improve','Body temperature stays near baseline'],
    estrogen: { direction:'Rising steadily toward ovulation', patterns:['Driving improvements in mood, motivation, and insulin sensitivity','Supporting muscle protein synthesis and faster recovery'] },
    progesterone: { direction:'Low — no temperature or RHR elevation', patterns:['Core temperature and resting heart rate at your personal baseline','No progesterone-driven fatigue or elevated stress response to training'] },
    expect: 'Rising estrogen supports strength gains. A great time to push the weights. Mood and motivation often improve noticeably.',
  },
  Ovulatory: {
    bullets: ['Estrogen peaks before egg release','LH surges triggering ovulation','Brief testosterone rise alongside estrogen','Your most fertile window'],
    estrogen: { direction:'At its peak', patterns:['Triggering the LH surge that causes egg release','Peak estrogen slightly increases ligament laxity — thorough warmup before heavy loading is essential'] },
    progesterone: { direction:'Beginning to rise after ovulation', patterns:['Starting to climb as the corpus luteum forms','Calming GABA effect will build as progesterone rises'] },
    expect: 'Peak performance window. Energy, confidence, and cognitive performance all elevated. Warm up thoroughly before heavy gym sessions.',
  },
  'Early luteal': {
    bullets: ['Progesterone rising with calming GABA effect','Energy often still good','Core temperature begins to rise slightly','Good phase for focused steady work'],
    estrogen: { direction:'Beginning to drop', patterns:['Secondary estrogen peak then beginning to fall','Mood may start to feel less stable as estrogen declines'] },
    progesterone: { direction:'Rising — bringing a calming effect', patterns:['Converts in the brain into a calming compound — the settled feeling of early luteal is this directly','Core temperature begins to rise and your body breaks down protein slightly faster'] },
    expect: 'Progesterone rising. Still good energy — focus on steady progress. Protein needs are increasing.',
  },
  'Mid luteal': {
    bullets: ['Progesterone at its peak','Core temperature and RHR measurably elevated','Serotonin becoming less stable','Recovery slower than follicular'],
    estrogen: { direction:'Dropping', patterns:['Declining from its secondary peak','As estrogen drops, serotonin activity decreases'] },
    progesterone: { direction:'At its peak', patterns:['Raising core temperature 0.3 to 0.5°C above your baseline','Competing with cortisol for the same receptors — training stress hits harder'] },
    expect: 'Recovery is slower right now. The same session genuinely feels harder — this is real physiology. Protein 1.8 to 2.2g per kg. (ISSN 2023)',
  },
  'Late luteal': {
    bullets: ['Both hormones dropping sharply','Serotonin at its lowest since menstruation','PMS symptoms most likely here','Resolves when menstruation begins'],
    estrogen: { direction:'Dropping sharply', patterns:['Sharp decline driving lower serotonin and dopamine','The hormonal cause of pre-menstrual mood changes'] },
    progesterone: { direction:'Dropping sharply', patterns:['Rapid drop reduces the calming GABA effect — rebound anxiety common','Signals the uterus to shed its lining, starting menstruation'] },
    expect: 'Hormones dropping. PMS symptoms have a direct biological cause — they are not a personality trait. Be kind to yourself.',
  },
  Luteal: {
    bullets: ['Progesterone is elevated and core temperature rises slightly','Resting heart rate measurably higher than in follicular','Serotonin stability decreases through this phase','The same workout genuinely feels harder — this is real physiology'],
    estrogen: { direction:'Secondary peak then declining', patterns:['A secondary estrogen rise after ovulation, then falling toward late luteal','The late-luteal drop drives mood and sleep changes'] },
    progesterone: { direction:'Rising to peak, then dropping sharply toward period', patterns:['Raises core temperature and resting heart rate throughout the phase','Competes with cortisol in your stress hormone system — training feels harder'] },
    expect: 'Progesterone elevated. Same workout, higher effort. Track how your body responds across phases — your personal pattern matters more than population averages.',
  },
  Perimenopause: {
    bullets: ['Estrogen fluctuates unpredictably rather than following a steady cycle','Progesterone is declining overall as ovulation becomes less frequent','FSH is rising as the pituitary works harder to stimulate the ovaries','Symptoms are driven by variability, not just low levels'],
    estrogen: { direction:'Fluctuating unpredictably', patterns:['Can be higher on some days than at any point in your reproductive years, lower on others','This variability drives symptoms more than consistently low levels'] },
    progesterone: { direction:'Declining overall', patterns:['Ovulation becoming less frequent means less progesterone production','Sleep disruption, mood changes common as progesterone drops'] },
    expect: 'Every strength session protects your bone density and metabolic health. Protein, calcium, vitamin D, and resistance training are your priorities.',
  },
}


export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [d, setD] = useState(null)
  const [weeklyModal, setWeeklyModal] = useState(false)
  const [weeklyCard, setWeeklyCard] = useState(false)
  const [weeklySummary, setWeeklySummary] = useState(null)
  const [phaseSheet, setPhaseSheet] = useState(null)
  const [pendingFriends, setPendingFriends] = useState(0)
  const [communityTab, setCommunityTab] = useState('community')
  const [friendsData, setFriendsData] = useState(null) // null = not loaded yet

  useEffect(() => { load() }, [])

  async function loadFriends(userId) {
    try {
      const { data: fships } = await supabase.from('friendships').select('*').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).eq('status', 'accepted')
      if (!fships?.length) { setFriendsData([]); return }
      const cards = await Promise.all(fships.map(async f => {
        const friendId = f.requester_id === userId ? f.addressee_id : f.requester_id
        const { data: card } = await supabase.rpc('get_friend_card', { target_user_id: friendId })
        return card
      }))
      setFriendsData(cards.filter(Boolean))
    } catch { setFriendsData([]) }
  }

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login', { replace: true }); return }

      const todayStr = localDateStr()
      const [{ data: profile }, { data: cycleData }, { data: recentLogs }, { data: twoWeekLogs }, { count: todayLoggers }, { data: pendingRequests }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('cycle_data').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('daily_logs').select('energy,resting_hr,wrist_temp,log_date,sleep_quality,disruptors').eq('user_id', user.id).order('log_date', { ascending: false }).limit(7),
        supabase.from('daily_logs').select('log_date,energy,sleep_quality,mood,workout_feel').eq('user_id', user.id).order('log_date', { ascending: false }).limit(14),
        supabase.from('daily_logs').select('*', { count: 'exact', head: true }).eq('log_date', todayStr),
        supabase.from('friendships').select('id').eq('addressee_id', user.id).eq('status', 'pending'),
      ])
      setPendingFriends(pendingRequests?.length || 0)

      if (profile && !profile.onboarding_complete) { navigate('/setup', { replace: true }); return }

      const bw = profile?.body_weight_kg || 65
      const isPath4 = profile?.user_path === '4'
      // Hormonal BC (path 5, excluding the non-hormonal copper IUD) suppresses the
      // natural cycle — these users have no real cycle phase even if a last-period
      // date exists in cycle_data, so we must not compute one.
      const isHormonalBC = profile?.user_path === '5' && profile?.bc_type !== 'copper-iud'

      // Single source of truth shared with Workout/Nutrition. Fetched once here so the
      // dashboard can never disagree with those screens about the user's phase.
      let status = null
      try { status = await getTodayStatus(supabase, user.id) } catch { /* ignore */ }

      let phase = 'observation', subPhase = null, cycleDay = null, cycleLen = 28, daysLeft = null, confidence = 0.05
      let bcProteinG = null
      let bcBleedDay = null, bcInBleedWindow = false

      if (isPath4) {
        phase = 'Perimenopause'; confidence = 0.5
      } else if (isHormonalBC && status) {
        // On hormonal birth control the natural cycle is suppressed and ovulation is
        // usually paused — so we never label Follicular/Ovulatory/Luteal phases.
        // BUT these users still get a withdrawal bleed and period-like symptoms, so
        // if they gave a bleed date we still track their pill-pack cycle and predict
        // the next bleed. This is accurate (the pack repeats on a fixed schedule) and
        // keeps the screen genuinely useful for them.
        phase = 'bc'
        subPhase = status.subPhase            // e.g. "Combined pill", "Hormonal IUD"
        confidence = status.confidence || 0.3
        bcProteinG = status.nutritionTargets?.proteinG || null
        if (cycleData?.last_period_date) {
          const lastBleed = new Date(cycleData.last_period_date + 'T00:00:00')
          const today = new Date(); today.setHours(0,0,0,0)
          cycleLen = cycleData.cycle_length || 28
          let day = Math.floor((today - lastBleed) / 86400000) + 1
          if (day > cycleLen) day = ((day - 1) % cycleLen) + 1   // fold into the current pack
          bcBleedDay = day
          daysLeft = Math.max(0, cycleLen - day + 1)
          // Period-like symptoms cluster around the withdrawal bleed (pack start / end)
          bcInBleedWindow = day <= 5 || daysLeft <= 2
        }
      } else if (cycleData?.last_period_date) {
        const lastPeriod = new Date(cycleData.last_period_date + 'T00:00:00')
        const today = new Date(); today.setHours(0,0,0,0)
        cycleDay = Math.floor((today - lastPeriod) / 86400000) + 1
        cycleLen = cycleData.cycle_length || 28
        daysLeft = Math.max(0, cycleLen - cycleDay + 1)
        if (cycleDay > 0 && cycleDay <= cycleLen + 7) {
          phase = getPhase(cycleDay, cycleLen)
          subPhase = phase === 'Luteal' ? getLutealSubPhase(cycleDay, cycleLen) : null
          // Use the canonical confidence from getTodayStatus — it grows with the
          // user's whole logging history and never resets. Falling back to a small
          // base only if the shared status failed to load.
          confidence = status?.confidence ?? 0.45
        }
      } else {
        // Observation mode (no cycle data, e.g. Depo recovery): use the canonical
        // confidence from getTodayStatus, which now grows as the logging history
        // builds instead of sitting at 5% forever.
        confidence = status?.confidence ?? 0.05
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
      if (status?.anomalies?.length) anomalyItems.push(...status.anomalies.map(a => ({ type: 'anomaly', text: a.text || a.message })))
      if (status?.moodInsight?.message) anomalyItems.push({ type: 'mood', text: status.moodInsight.message })

      let alloLoad = 0
      if (recentLogs?.length >= 3) {
        if (phase === 'Menstrual') alloLoad++
        if (subPhase === 'Late luteal') alloLoad++
        if (recentLogs.filter(l => l.sleep_quality === 'Poor').length >= 2) alloLoad += 2
        if (recentLogs.filter(l => l.energy === 'Very low').length >= 2) alloLoad += 2
        recentLogs.forEach(l => { if (l.disruptors?.length) alloLoad += Math.min(l.disruptors.length, 2) })
        alloLoad = Math.min(10, alloLoad)
      }

      // Weekly summary — show as a non-intrusive card whenever there are at least 3
      // logs this calendar week. Tapping the card opens the full modal. It no longer
      // auto-opens as a modal, and no longer depends on localStorage to dedupe (which
      // some browsers clear, making the insight pop up again every day).
      if (twoWeekLogs) {
        const thisWeekCount = twoWeekLogs.filter(l => Math.floor((new Date() - new Date(l.log_date + 'T00:00:00')) / 86400000) < 7).length
        if (thisWeekCount >= 3) {
          const summary = buildWeeklySummary(twoWeekLogs, phase, subPhase, confidence, daysLeft, cycleDay, cycleData?.cycle_length || 28)
          setWeeklySummary(summary)
          setWeeklyCard(true)
        }
      }

      setD({ profile, phase, subPhase, cycleDay, cycleLen, daysLeft, confidence, bw, bcProteinG, bcBleedDay, bcInBleedWindow, alreadyLogged, streak, recentLogs, twoWeekLogs, anomalyItems, alloLoad, isPath4, userEmail: user.email, todayLoggers: todayLoggers || 0 })
      loadFriends(user.id)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return <><div style={{ paddingTop: 60 }}><Spinner /></div><BottomNav /></>
  if (!d) return null

  const { phase, subPhase, cycleDay, cycleLen, daysLeft, confidence, bw, bcProteinG, bcBleedDay, bcInBleedWindow, alreadyLogged, recentLogs, anomalyItems, alloLoad, isPath4 } = d
  const phaseLabel = phase === 'observation' ? 'Observation mode'
    : phase === 'Perimenopause' ? 'Perimenopause'
    : phase === 'bc' ? (subPhase || 'Hormonal birth control')
    : `${subPhase || phase} phase`
  const heroGrad = HERO_GRADIENT[subPhase] || HERO_GRADIENT[phase] || HERO_GRADIENT.observation
  const protein = phase === 'bc' && bcProteinG ? bcProteinG : Math.round(bw * (PROTEIN_MULT[subPhase] || PROTEIN_MULT[phase] || 1.7))
  const confPct = Math.round(confidence * 100)
  const alloC = alloLoad >= 7 ? { bg:'#fce8e0', border:'#f0b8a0', text:'#8a3020', label:'High load' }
    : { bg:'#fef4e4', border:'#f0d498', text:'#6a4a10', label:'Moderate load' }

  return (
    <>
      <div style={{ background:'#f5f0e8', padding:'20px 20px 16px', borderBottom:'1px solid #ede8e0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase' }}>Em~power</div>
        <button onClick={async () => { await supabase.auth.signOut(); navigate('/login', { replace:true }) }}
          style={{ background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>
          Sign out
        </button>
      </div>

      <div style={{ padding:'16px 16px 100px' }}>

        {/* Hero */}
        <div style={{ borderRadius:16, padding:'28px 24px', color:'#e8e0d4', background:heroGrad, marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(232,224,212,0.6)', marginBottom:6 }}>Your phase</div>
          <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:24, marginBottom:6 }}>{phaseLabel}</div>
          <div style={{ fontSize:13, color:'rgba(232,224,212,0.75)', marginBottom:14 }}>
            {phase === 'bc'
              ? (bcBleedDay
                  ? (bcInBleedWindow
                      ? `Day ${bcBleedDay} of your pill cycle · withdrawal bleed likely around now`
                      : `Day ${bcBleedDay} of your pill cycle · next bleed in about ${daysLeft} day${daysLeft === 1 ? '' : 's'}`)
                  : 'Steady hormones — tracking your symptoms')
              : cycleDay ? `Day ${cycleDay} of ${cycleLen}, ${daysLeft} days until next period` : 'Tracking your cycle patterns'}
          </div>
          <div style={{ fontSize:13, color:'rgba(232,224,212,0.8)', lineHeight:1.7, marginBottom:16 }}>
            {getPersonalisedPhaseDesc(phase, subPhase, recentLogs)}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: confidence > 0.55 ? '#88c088' : confidence > 0.30 ? '#e0c070' : '#c88878' }} />
            <span style={{ fontSize:12, color:'rgba(232,224,212,0.7)' }}>{confLabel(confidence)} — {confPct}%</span>
          </div>
          <button onClick={() => navigate('/workout')} style={{ background:'rgba(232,224,212,0.18)', border:'1px solid rgba(232,224,212,0.35)', borderRadius:10, padding:'11px 18px', color:'#e8e0d4', fontSize:14, fontWeight:500, cursor:'pointer', width:'100%', fontFamily:'inherit', marginBottom:8 }}>
            Plan my workout
          </button>
          <button onClick={() => navigate('/log')} style={{ background:'transparent', border:'1px solid rgba(232,224,212,0.2)', borderRadius:10, padding:'9px 18px', color:'rgba(232,224,212,0.7)', fontSize:13, cursor:'pointer', width:'100%', fontFamily:'inherit' }}>
            {alreadyLogged ? 'Update today\'s log' : 'Today\'s check-in'}
          </button>
        </div>


        {/* Birth control context — explains why we track a pill cycle, not a true cycle */}
        {phase === 'bc' && (
          <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16, marginBottom:12 }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <i className="ti ti-info-circle" style={{ color:'#c8b89a', fontSize:18, flexShrink:0, marginTop:1 }} />
              <div style={{ fontSize:13, color:'#5a5248', lineHeight:1.6 }}>
                Your birth control keeps your hormones steady and usually pauses ovulation, so there is no natural cycle to track. The bleed you get is a withdrawal bleed, not a true period — but cramps, mood changes, and other period-like symptoms are still real and worth logging. We track your pill cycle and flag when your next bleed is due.
              </div>
            </div>
          </div>
        )}

        {/* Weekly summary card (after modal dismissed) */}
        {weeklyCard && weeklySummary && (
          <WeeklySummaryCard summary={weeklySummary} onClick={() => { setWeeklyCard(false); setWeeklyModal(true) }} />
        )}

        {/* First-time card */}
        {!alreadyLogged && (!recentLogs || recentLogs.length === 0) && (
          <div className="card" style={{ marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Welcome to Em~power</div>
            <div style={{ fontSize:13, color:'#7a7268', lineHeight:1.6, marginBottom:12 }}>Your first log starts building your personal baseline. The algorithm learns from your data over time.</div>
            <button className="btn-primary" onClick={() => navigate('/log')}>Start your first check-in</button>
          </div>
        )}


        {/* Anomaly only — mood insight removed (shown in calendar instead) */}
        {anomalyItems.filter(i => i.type !== 'mood').map((item, i) => (
          <div key={i} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:'12px 14px', marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:4 }}>Something worth noting</div>
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

        {/* Sleep card */}
        <div className="card" style={{ cursor:'pointer', marginBottom:10 }} onClick={() => navigate('/sleep')}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'#f5f0e8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <i className="ti ti-moon" style={{ fontSize:20, color:'#c8b89a' }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600 }}>Sleep guide</div>
              <div style={{ fontSize:13, color:'#7a7268' }}>{SLEEP_SUBTITLES[subPhase] || SLEEP_SUBTITLES[phase] || 'Phase-specific tips for tonight'}</div>
            </div>
            <i className="ti ti-chevron-right" style={{ color:'#c8b89a', fontSize:18, flexShrink:0 }} />
          </div>
        </div>

        {/* Stats row */}
        {cycleDay && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            {[{ label:'Cycle day', value:`Day ${cycleDay}` },{ label:'Days until period', value:daysLeft != null ? daysLeft : '—' }].map(s => (
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

        {/* Community / Friends tabbed card */}
        {(() => {
          const PHASE_COMMUNITY = {
            Menstrual:          { energy:28, sleep:54, workout:22, logged:72 },
            'Early follicular': { energy:42, sleep:60, workout:35, logged:75 },
            Follicular:         { energy:62, sleep:66, workout:55, logged:82 },
            'Late follicular':  { energy:70, sleep:68, workout:62, logged:85 },
            Ovulatory:          { energy:74, sleep:64, workout:68, logged:88 },
            'Early luteal':     { energy:58, sleep:60, workout:52, logged:78 },
            'Mid luteal':       { energy:40, sleep:44, workout:36, logged:65 },
            'Late luteal':      { energy:32, sleep:40, workout:28, logged:60 },
            Luteal:             { energy:46, sleep:52, workout:40, logged:68 },
            Perimenopause:      { energy:44, sleep:42, workout:40, logged:70 },
            observation:        { energy:50, sleep:56, workout:44, logged:72 },
          }
          const pd = PHASE_COMMUNITY[subPhase] || PHASE_COMMUNITY[phase] || PHASE_COMMUNITY.observation
          const stats = [
            { icon:'ti-bolt',     label:'High energy',         pct: pd.energy },
            { icon:'ti-moon',     label:'Quality sleep',       pct: pd.sleep },
            { icon:'ti-barbell',  label:'Completed a workout', pct: pd.workout },
            { icon:'ti-notebook', label:'Logged their day',    pct: pd.logged },
          ]
          const tabBtn = (id, label) => (
            <button onClick={() => setCommunityTab(id)} style={{
              flex:1, padding:'7px 0', border:'none', borderRadius:8, fontFamily:'inherit',
              fontSize:12, fontWeight:communityTab===id?600:400, cursor:'pointer',
              background:communityTab===id?'#2c2820':'transparent',
              color:communityTab===id?'#f5f0e8':'#9a9590',
              transition:'all 0.15s',
            }}>{label}</button>
          )
          return (
            <div className="card" style={{ marginBottom:12 }}>
              {/* Tab switcher */}
              <div style={{ display:'flex', background:'#f5f0e8', borderRadius:10, padding:3, marginBottom:14, gap:3 }}>
                {tabBtn('community', 'Women in your phase')}
                {tabBtn('friends', `Friends${pendingFriends > 0 ? ` (${pendingFriends})` : ''}`)}
              </div>

              {communityTab === 'community' ? (
                <>
                  {stats.map(s => (
                    <div key={s.label} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <i className={`ti ${s.icon}`} style={{ fontSize:15, color:'#c8b89a', flexShrink:0, width:18, textAlign:'center' }} />
                      <div style={{ width:120, fontSize:12, color:'#5a5048', flexShrink:0 }}>{s.label}</div>
                      <div style={{ flex:1, height:6, background:'#f0ece4', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ width:`${s.pct}%`, height:'100%', background:'#c8b89a', borderRadius:3 }} />
                      </div>
                      <div style={{ width:32, fontSize:12, color:'#7a7268', textAlign:'right', flexShrink:0 }}>{s.pct}%</div>
                    </div>
                  ))}
                  <div style={{ fontSize:11, color:'#9a9590', fontStyle:'italic', marginTop:10 }}>Typical patterns for this phase based on logged data.</div>
                </>
              ) : (
                <>
                  {friendsData === null ? (
                    <div style={{ textAlign:'center', padding:'12px 0', color:'#9a9590', fontSize:13 }}>Loading...</div>
                  ) : friendsData.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'8px 0' }}>
                      <div style={{ fontSize:13, color:'#7a7268', marginBottom:10 }}>No friends added yet.</div>
                      <button onClick={() => navigate('/friends')} style={{ padding:'8px 18px', borderRadius:10, background:'#2c2820', color:'#f5f0e8', border:'none', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Add friends</button>
                    </div>
                  ) : (
                    <>
                      {friendsData.map((card, i) => {
                        const ph = card.show_phase ? friendPhase(card) : null
                        const pc = ph ? (PHASE_COLORS[ph] || PHASE_COLORS.observation) : null
                        return (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, paddingTop:i>0?10:0, marginTop:i>0?10:0, borderTop:i>0?'1px solid #f5f0e8':'none' }}>
                            <div style={{ width:32, height:32, borderRadius:16, background: pc?.bg || '#f0ece4', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              {pc ? <div style={{ width:10, height:10, borderRadius:'50%', background:pc.dot }} /> : <i className="ti ti-user" style={{ fontSize:14, color:'#c8b89a' }} />}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:500, color:'#2c2820', marginBottom:3 }}>{card.name || 'Friend'}</div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                {ph && pc && <span style={{ fontSize:11, background:pc.bg, color:pc.text, padding:'2px 8px', borderRadius:10 }}>{ph}</span>}
                                {card.show_streak && typeof card.streak === 'number' && <span style={{ fontSize:11, background:'#fff8e6', color:'#7a5010', padding:'2px 8px', borderRadius:10 }}>🔥 {card.streak}d</span>}
                                {card.show_sleep && card.sleep_quality && <span style={{ fontSize:11, background:'#f0f0f8', color:'#3a3560', padding:'2px 8px', borderRadius:10 }}>😴 {card.sleep_quality}</span>}
                                {card.show_workout && card.workout_feel && <span style={{ fontSize:11, background:'#f0f8f0', color:'#2a5a2a', padding:'2px 8px', borderRadius:10 }}>💪 {card.workout_feel}</span>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <button onClick={() => navigate('/friends')} style={{ marginTop:12, background:'none', border:'none', fontSize:11, color:'#9a9590', cursor:'pointer', fontFamily:'inherit', padding:0 }}>Manage friends</button>
                    </>
                  )}
                </>
              )}
            </div>
          )
        })()}

        {/* Phase cards — 2x2 icon grid */}
        <div className="section-label" style={{ marginTop:8, marginBottom:10 }}>{isPath4 ? 'Your hormonal phases' : 'Your cycle phases'}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          {[
            { name:'Follicular', icon:'ti-bolt', iconBg:'#f5e8c0', iconColor:'#a07820', desc:'Build strength and push hard' },
            { name:'Ovulatory',  icon:'ti-trophy', iconBg:'#d0ecd0', iconColor:'#2a6a2a', desc:'Peak power and coordination' },
            { name:'Luteal',     icon:'ti-moon-stars', iconBg:'#d0e0f0', iconColor:'#2a4a7a', desc:'Recover smart and protect energy' },
            { name:'Menstrual',  icon:'ti-moon', iconBg:'#f0d8d8', iconColor:'#8a2828', desc:'Rest, restore and replenish' },
          ].map(p => {
            const lutealActive = p.name === 'Luteal' && (subPhase === 'Early luteal' || subPhase === 'Mid luteal' || subPhase === 'Late luteal' || phase === 'Luteal')
            const active = phase === p.name || subPhase === p.name || lutealActive
            return (
              <div key={p.name} onClick={() => setPhaseSheet(p.name)} style={{
                background:'#fff', border:`1px solid ${active ? '#c8b89a' : '#ede8e0'}`,
                borderRadius:14, padding:'16px 14px', cursor:'pointer',
                boxShadow: active ? '0 2px 8px rgba(200,184,154,0.25)' : 'none',
              }}>
                <div style={{ width:44, height:44, borderRadius:12, background:p.iconBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                  <i className={`ti ${p.icon}`} style={{ fontSize:22, color:p.iconColor }} />
                </div>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:3 }}>{p.name}</div>
                <div style={{ fontSize:11, color:'#9a9590', lineHeight:1.4 }}>{p.desc}</div>
                {active && <div style={{ marginTop:8, fontSize:10, fontWeight:600, background:'#2c2820', color:'#f5f0e8', padding:'2px 8px', borderRadius:6, display:'inline-block' }}>Now</div>}
              </div>
            )
          })}
        </div>

        <div style={{ textAlign:'center', marginTop:16, display:'flex', justifyContent:'center', gap:20 }}>
          <button onClick={() => navigate('/setup')} style={{ background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>Change information</button>
          <button onClick={() => navigate('/feedback')} style={{ background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>Share feedback</button>
        </div>
      </div>
      <BottomNav />

      {phaseSheet && (() => {
        const info = PHASE_SHEET_INFO[phaseSheet] || PHASE_SHEET_INFO[subPhase] || PHASE_SHEET_INFO.Follicular
        return (
          <>
            <div onClick={() => setPhaseSheet(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200 }} />
            <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:420, maxHeight:'88vh', background:'#faf8f5', borderRadius:'20px 20px 0 0', overflow:'hidden', display:'flex', flexDirection:'column', zIndex:201 }}>
              <div style={{ padding:'12px 20px 0', textAlign:'center', flexShrink:0 }}>
                <div style={{ width:36, height:4, background:'#ddd', borderRadius:2, margin:'0 auto 12px' }} />
              </div>
              <div style={{ padding:'0 20px 12px', borderBottom:'1px solid #ede8e0', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:18, fontWeight:600 }}>{phaseSheet}</div>
                <button onClick={() => setPhaseSheet(null)} style={{ background:'none', border:'none', fontSize:20, color:'#9a9590', cursor:'pointer' }}>&#x2715;</button>
              </div>
              <div style={{ overflowY:'auto', flex:1, padding:'16px 20px 40px' }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:10 }}>What is happening</div>
                {info.bullets.map((b,i) => (
                  <div key={i} style={{ display:'flex', gap:10, marginBottom:10 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'#c8b89a', flexShrink:0, marginTop:6 }} />
                    <div style={{ fontSize:14, color:'#3a3530', lineHeight:1.6 }}>{b}</div>
                  </div>
                ))}
                <div style={{ background:'#f5f0e8', borderRadius:12, padding:'12px 14px', margin:'16px 0' }}>
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>What to expect</div>
                  <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6 }}>{info.expect}</div>
                </div>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:10, marginTop:16 }}>Hormone picture</div>
                {[{key:'estrogen',label:'Estrogen'},{key:'progesterone',label:'Progesterone'}].map(h => (
                  <div key={h.key} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:'12px 14px', marginBottom:10 }}>
                    <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{h.label}</div>
                    <div style={{ fontSize:13, color:'#7a7268', marginBottom:6 }}>{info[h.key]?.direction}</div>
                    {info[h.key]?.patterns.map((p,i) => (
                      <div key={i} style={{ display:'flex', gap:8, marginBottom:4 }}>
                        <div style={{ width:4, height:4, borderRadius:'50%', background:'#c8b89a', flexShrink:0, marginTop:7 }} />
                        <div style={{ fontSize:12, color:'#5a5048', lineHeight:1.5 }}>{p}</div>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ fontSize:11, color:'#9a9590', fontStyle:'italic', marginTop:8 }}>Sources: Munster et al. 2021 (n=97 women, 2,105 cycles). LifeLabs/EORLA Canadian reference ranges. Your personal normal may be different from population averages.</div>
              </div>
            </div>
          </>
        )
      })()}

      {weeklyModal && weeklySummary && (
        <WeeklySummaryModal
          summary={weeklySummary}
          onDismiss={() => { markWeeklySummaryDismissed(); setWeeklyModal(false); setWeeklyCard(true) }}
        />
      )}
    </>
  )
}
