// route /calendar, colour-coded cycle calendar with past logs and future day planning bottom sheets
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus, getPhase, getLutealSubPhase, parsePeriodStarts, getOvulationDay } from '../lib/hormoneSync'
import { diffCalendarDays } from '../lib/dateUtils.js'
import { getMovementToday } from '../lib/movementToday'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'

const PC = {
  Menstrual:          { dot:'#e09898', bg:'rgba(224,152,152,0.24)', text:'#5a2a28' },
  Follicular:         { dot:'#88c088', bg:'rgba(136,192,136,0.24)', text:'#1a4a1a' },
  'Early follicular': { dot:'#88c088', bg:'rgba(136,192,136,0.24)', text:'#1a4a1a' },
  Ovulatory:          { dot:'#88c0e0', bg:'rgba(136,192,224,0.24)', text:'#1a3a5a' },
  // Luteal is a light-to-dark YELLOW gradient (early = lightest, late = deepest gold), staying
  // entirely in the yellow family so none of it reads as menstrual red. Early luteal is a pale
  // yellow, mid is a warmer gold, late is a deep gold — then menstrual is clearly red/pink. No
  // salmon or brown anywhere (that old late-luteal shade looked like a period).
  'Early luteal':     { dot:'#f2df85', bg:'rgba(242,223,133,0.20)', text:'#5a4a10' },
  'Mid luteal':       { dot:'#e6c447', bg:'rgba(230,196,71,0.22)',  text:'#5a3f08' },
  'Late luteal':      { dot:'#cf9e18', bg:'rgba(207,158,24,0.24)',  text:'#4a3200' },
  Luteal:             { dot:'#e6c447', bg:'rgba(230,196,71,0.22)',  text:'#5a3f08' },
  observation:        { dot:'#c8b89a', bg:'rgba(200,184,154,0.20)', text:'#4a4540' },
}

const MOOD_COLORS = {
  // Check-in moods
  Energised:{ bg:'#e8f5e8', text:'#1a4a1a' }, Happy:{ bg:'#fff4e0', text:'#6a3a00' },
  Calm:{ bg:'#e8f0f8', text:'#1a3a5a' }, Focused:{ bg:'#f0e8f8', text:'#3a1a5a' },
  Tired:{ bg:'#f0ece4', text:'#4a4030' }, Anxious:{ bg:'#fce8e8', text:'#6a2020' },
  Irritable:{ bg:'#fce8f0', text:'#6a2040' }, Low:{ bg:'#e8e8f0', text:'#2a2a5a' },
  // Full-log moods (positive)
  Energetic:{ bg:'#e8f5e8', text:'#1a4a1a' }, Motivated:{ bg:'#e8f5e8', text:'#1a4a1a' },
  Confident:{ bg:'#fff4e0', text:'#6a3a00' }, Social:{ bg:'#e8f0f8', text:'#1a3a5a' },
  // Full-log moods (challenging)
  Sad:{ bg:'#e8e8f0', text:'#2a2a5a' }, 'Brain fog':{ bg:'#f0ece4', text:'#4a4030' },
  'Low mood':{ bg:'#e8e8f0', text:'#2a2a5a' },
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Anchor each date to the most recent RECORDED period start on or before it, so every
// past period the user logged shows on the calendar and irregular cycles are drawn from
// their real dates, not extrapolated backward from a single date (which blanked months).
export function getPhaseForDate(date, periodStarts, cycleLen, periodLength, allowProjection = true, today = new Date()) {
  if (!periodStarts || !periodStarts.length) return null
  // Find the cycle this date belongs to: the most recent recorded start on or before it
  // (anchor), and the next recorded start after it (nextStart), if any.
  let anchor = null
  let nextStart = null
  for (const ps of periodStarts) {
    const d = new Date(ps + 'T00:00:00')
    if (d <= date) anchor = d
    else { nextStart = d; break }  // periodStarts is sorted ascending
  }
  // Before the first recorded period there is no personal anchor. Leave it unclassified.
  if (!anchor) return null

  const diff = diffCalendarDays(date, anchor)
  let cycleDay, effLen
  if (nextStart) {
    // This date sits BETWEEN two logged periods, so the real cycle length is the actual gap.
    // Use it and do NOT wrap with modulo — otherwise a rigid 28-day projection paints a
    // predicted period before the real (logged) next period, which is exactly wrong for
    // irregular cycles (e.g. a late period logged on the 6th still showing menstrual on the 1st).
    effLen = Math.max(1, diffCalendarDays(nextStart, anchor))
    cycleDay = Math.min(diff + 1, effLen)
  } else {
    // Without a later recorded period, past/today dates never wrap into a fabricated new cycle.
    // Future cycles may still be forecast while the current period is not late, clearly marked
    // as predictions so period and ovulation planning remain useful.
    const isFuture = diffCalendarDays(date, today) > 0
    if (diff >= cycleLen && (!isFuture || !allowProjection || diff >= cycleLen * 3)) return null
    effLen = cycleLen
    cycleDay = (((diff % cycleLen) + cycleLen) % cycleLen) + 1
  }
  const phase = getPhase(cycleDay, effLen, periodLength)
  const sub = phase === 'Luteal' ? getLutealSubPhase(cycleDay, effLen) : phase
  return { phase, sub, cycleDay, estimated: !nextStart, projectedCycle: !nextStart && diff >= cycleLen }
}

// Calendar context never creates a required food change. These prompts keep useful
// period preparation while avoiding a phase-only prescription.
const PLAN_NUTRITION = {
  Menstrual:          'If bleeding is heavy or prolonged, include iron-rich foods with vitamin C and discuss possible iron deficiency with a clinician. No special diet is required for a normal period.',
  'Early follicular': 'Keep your usual balanced meals. Cycle timing alone does not create a different calorie, carbohydrate or protein requirement.',
  Follicular:         'Keep your usual balanced meals and fuel the activity you actually plan to do. Empower does not raise or lower nutrition targets from this phase alone.',
  'Late follicular':  'Fuel from your planned activity, appetite and health needs rather than an estimated phase.',
  Ovulatory:          'An estimated ovulation window does not require a special diet. Hydration and adequate overall intake remain the priorities.',
  'Early luteal':     'Keep protein and carbohydrates consistent. If appetite or recovery shifts, log it so Empower can see whether it repeats for you.',
  'Mid luteal':       'Use your normal nutrition range. Appetite, training, recovery and health matter more than the calendar alone.',
  'Late luteal':      'If you notice repeat premenstrual appetite or digestive changes, plan foods that are satisfying and comfortable for you without treating cravings as a failure.',
  Luteal:             'Use the nutrition range calculated from your own weight and activity rather than a phase-only target.',
  Perimenopause:      'Protein-rich meals and calcium-containing foods can support muscle and bone. Exact needs depend on activity, health and your care plan.',
  observation:        'Regular, adequate meals and enough protein, fibre and carbohydrates support general health and training while Empower learns your patterns.',
}

// Phase-specific movement notes, sources: Kissow 2022, Hackney 2006, De Martin Topranin 2023, Kohrt 2004
const PLAN_MOVEMENT = {
  Menstrual:          'Training is safe for most people if they feel well. Keep your planned session, choose a lighter option for pain, heavy bleeding or low readiness, or rest if that is what you need. (McNulty et al. 2020)',
  'Early follicular': 'Keep your planned session and use your warm-up to choose the load. Some people feel energy returning here; others notice no phase effect.',
  Follicular:         'Many women find this a strong training window, a good time to push weights or try a faster run, though this varies between individuals. If you feel good, lean in. Large reviews find phase effects are small and inconsistent, so your own response matters most. (Kissow et al. 2022; McNulty et al. 2020)',
  'Late follicular':  'Some studies report strength advantages here, while pooled findings vary. Progress only if your recent sessions and warm-up support it. (Niering et al. 2024; McNulty et al. 2020)',
  Ovulatory:          'Keep your planned session. A thorough sport-specific warm-up is useful in every phase; adjust from your own readiness rather than an assumed performance peak.',
  'Early luteal':     'Steady strength training remains effective. Keep the plan unless your symptoms, sleep or warm-up point toward another option.',
  'Mid luteal':       'Some people report higher perceived effort here, while others do not. Begin as planned, then adapt volume or load only if today feels different for you.',
  'Late luteal':      'Choose from the planned, lighter or recovery option based on symptoms and readiness. The calendar alone does not require a deload.',
  Luteal:             'Train from your own readiness and recent performance. Cycle phase is context, not a required intensity reduction.',
  Perimenopause:      'Resistance training is your most important tool. Even one strength session per week protects bone density and muscle mass long-term. (Kohrt et al. 2004)',
  observation:        'Any movement logged teaches the algorithm your capacity baseline. Walk, stretch, or train. All of it counts.',
}

// Expanded brain explanations for the tap-to-expand detail, sources: Backstrom 2008, Bäckström 2014, Lokuge 2011
const BRAIN_DETAIL = {
  Menstrual:          'Estrogen directly drives serotonin production. When estrogen drops to its lowest point at menstruation, serotonin drops with it. Serotonin is your primary mood-stabilising neurotransmitter. It regulates emotional responses, pain sensitivity, and motivation. Its absence during menstruation has a measurable neurochemical cause. Any low mood, emotional sensitivity, or difficulty concentrating right now is a direct result of this drop. (Lokuge et al. 2011, Journal of Psychiatry and Neuroscience)',
  'Early follicular': 'Estrogen is beginning to rise after its menstrual low. As estrogen climbs, it triggers serotonin production and increases receptor sensitivity. The brain is coming back online after the hormonal low. This is why energy and mood start to lift within a few days of the period ending, even before the body has physically recovered. (Lokuge et al. 2011)',
  Follicular:         'Rising estrogen drives rising serotonin and dopamine simultaneously. Dopamine is your motivation and reward neurotransmitter. It creates drive, optimism, and the capacity to plan ahead. Serotonin stabilises mood and reduces anxiety. When both are rising together, the brain is in one of its most capable states. (Backstrom et al. 2008, Archives of Women\'s Mental Health)',
  'Late follicular':  'Dopamine and serotonin tend to be near their cycle high, so focus, creative problem-solving, and social confidence often feel elevated. How strongly this shows up varies from person to person. (Backstrom et al. 2008)',
  Ovulatory:          'Estrogen peaks just before ovulation, and testosterone briefly rises alongside it. For many women this tends to bring higher confidence, social energy, and physical performance, though it is not universal and how you feel varies from cycle to cycle. (Backstrom et al. 2008)',
  'Early luteal':     'Progesterone converts in the brain into a calming compound that works on the same receptors as anti-anxiety medication. This creates the calm, settled feeling many women notice in the early luteal phase. It comes directly from your hormones. (Bäckström et al. 2014, Psychoneuroendocrinology)',
  'Mid luteal':       'Estrogen is declining and serotonin stability drops with it. Progesterone remains high. As serotonin becomes less stable, mood can feel more variable day to day. The brain is balancing the calming effect of progesterone alongside the less stable mood environment from declining estrogen. (Backstrom et al. 2008)',
  'Late luteal':      'Both estrogen and progesterone are now dropping sharply. When progesterone drops, the calming effect it was providing disappears. At the same time, serotonin is at its lowest point since your period began. Anxiety, irritability, and low mood here are a direct result of these hormonal changes. They will resolve when menstruation begins. (Bäckström et al. 2014)',
  Luteal:             'Serotonin stability is decreasing through this phase as estrogen declines. Mood may feel less predictable than in follicular. The progesterone calming effect partially offsets this but cannot fully compensate as both hormones fluctuate. (Backstrom et al. 2008)',
  Perimenopause:      'Estrogen fluctuates unpredictably in perimenopause, and serotonin fluctuates with it. Unlike the regular monthly pattern of the reproductive years, the variability is less predictable. Sleep disruption also directly reduces serotonin production, compounding the effect. (Freeman et al. 2004, Archives of General Psychiatry)',
}
void BRAIN_DETAIL

export default function Calendar() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [periodStarts, setPeriodStarts] = useState([])  // every recorded period-start date
  const [now] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }) // midnight, so day-diff math is clean integers
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [sheet, setSheet] = useState(null) // { dateStr, isFuture }
  const [brainExpanded, setBrainExpanded] = useState(false)
  const [futureExpanded, setFutureExpanded] = useState(false)

  useEffect(() => { setBrainExpanded(false); setFutureExpanded(false) }, [sheet])

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    try {
      const [s, { data: logData }, { data: cycleData }] = await Promise.all([
        getTodayStatus(supabase, user.id),
        supabase.from('daily_logs')
          .select('log_date,energy,mood,symptoms,sleep_quality,workout_feel,resting_hr,libido,hormonal_context')
          .eq('user_id', user.id)
          .gte('log_date', localDateStr(new Date(now.getFullYear(), now.getMonth() - 2, 1))),
        supabase.from('cycle_data')
          .select('notes,last_period_date')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      setPeriodStarts(parsePeriodStarts(cycleData))
      // Derive lastPeriodDate from getTodayStatus cycleDay, avoids maybeSingle() failing
      // when user has multiple cycle_data rows (getTodayStatus already picks the most recent)
      if (s?.cycleDay > 0 && s.cycleLen) {
        const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
        const lastP = new Date(todayDate)
        lastP.setDate(lastP.getDate() - (s.cycleDay - 1))
        s.lastPeriodDate = localDateStr(lastP)
      }
      setStatus(s)
      const contextKey = s?.contextKey || 'natural-cycle'
      setLogs((logData || []).filter(log => log.hormonal_context ? log.hormonal_context === contextKey : contextKey === 'natural-cycle'))
    } catch(e) { console.error('Calendar init error:', e) }
    setLoading(false)
  }

  if (loading) return <div style={{ paddingTop:60 }}><Spinner /></div>

  const profile = status?.profile
  const isPath4 = profile?.user_path === '4'
  // Hormonal BC (path 5, not copper IUD) suppresses ovulation, there is no natural
  // cycle phase, so never colour the calendar by phase even if a bleed date exists.
  const isHormonalBC = profile?.user_path === '5' && profile?.bc_type !== 'copper-iud'
  const lastPeriod = status?.lastPeriodDate
  // Use cycleLen from getTodayStatus (sourced from cycle_data), more accurate than profile table
  const cycleLen = status?.cycleLen || profile?.cycle_length || 28
  const hasPhaseData = !!lastPeriod && !isPath4 && !isHormonalBC
  // Every period start we can anchor phases to: the recorded history in cycle_data plus the
  // most recent derived start. Sorted ascending and deduped so getPhaseForDate can pick the
  // nearest anchor and colour every month, not just the one after the newest period.
  const phaseAnchors = [...new Set([...periodStarts, lastPeriod].filter(Boolean))].sort()
  const periodLength = status?.periodLength
  const allowProjection = !status?.latePeriod

  const year = month.getFullYear()
  const mon = month.getMonth()
  const firstDay = new Date(year, mon, 1).getDay()
  const daysInMonth = new Date(year, mon + 1, 0).getDate()
  const todayStr = localDateStr(now)

  const logMap = {}
  logs.forEach(l => { logMap[l.log_date] = l })

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function getCellInfo(day) {
    if (!day) return null
    const date = new Date(year, mon, day)
    const dateStr = localDateStr(date)
    const isToday = dateStr === todayStr
    const isFuture = date > now
    const phaseInfo = hasPhaseData ? getPhaseForDate(date, phaseAnchors, cycleLen, periodLength, allowProjection, now) : null
    const log = logMap[dateStr]
    const sub = phaseInfo?.sub || phaseInfo?.phase || null
    const pc = sub ? (PC[sub] || PC.Luteal) : PC.observation
    return { day, dateStr, isToday, isFuture, phaseInfo, log, pc, sub }
  }

  function openSheet(info) {
    setSheet({ dateStr: info.dateStr, isFuture: info.isFuture })
  }

  const sheetInfo = (() => {
    if (!sheet) return null
    const parts = sheet.dateStr.split('-')
    const sy = parseInt(parts[0])
    const sm = parseInt(parts[1]) - 1
    const sd = parseInt(parts[2])
    const date = new Date(sy, sm, sd)
    const isToday = sheet.dateStr === todayStr
    const isFuture = date > now
    const phaseInfo = hasPhaseData ? getPhaseForDate(date, phaseAnchors, cycleLen, periodLength, allowProjection, now) : null
    const log = logMap[sheet.dateStr]
    const sub = phaseInfo?.sub || phaseInfo?.phase || null
    const pc = sub ? (PC[sub] || PC.Luteal) : PC.observation
    return { day: sd, dateStr: sheet.dateStr, isToday, isFuture, phaseInfo, log, pc, sub }
  })()
  const sheetLog = sheet ? logMap[sheet.dateStr] : null
  const sheetDate = sheet ? new Date(sheet.dateStr + 'T00:00:00') : null

  return (
    <div style={{ paddingBottom:100 }}>
      {/* Top bar */}
      <div style={{ background:'#f5f0e8', padding:'calc(16px + var(--sat)) 20px 16px', borderBottom:'1px solid #ede8e0', display:'flex', alignItems:'center' }}>
        <button type="button" aria-label="Go back" onClick={() => navigate('/dashboard')} style={{ background:'none', border:'none', cursor:'pointer', padding:0, marginRight:12 }}>
          <i className="ti ti-chevron-left" aria-hidden="true" style={{ fontSize:20, color:'#2c2820' }} />
        </button>
        <div style={{ flex:1, textAlign:'center' }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase' }}>Em~power</div>
          <div style={{ fontSize:11, color:'#9a9590', marginTop:2 }}>
            {status?.cycleDay ? `Day ${status.cycleDay} of ${cycleLen}` : isHormonalBC ? (status?.subPhase || 'On birth control') : 'Cycle calendar'}
          </div>
        </div>
        <div style={{ width:28 }} />
      </div>

      {isHormonalBC && (
        <div style={{ margin:'12px 16px 0', padding:'12px 14px', background:'#f0f0f8', border:'1px solid #d8d8ec', borderRadius:12, fontSize:13, color:'#3a3550', lineHeight:1.55 }}>
          <strong>Your method changes how cycle tracking works.</strong> Some methods usually suppress ovulation, while ovulation can continue with others. Empower does not assign a natural cycle phase when it cannot verify one, but symptom, sleep, bleeding and workout tracking remain useful.
        </div>
      )}

      <div style={{ padding:'16px 16px 0' }}>
        {/* Month nav */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(year, mon - 1, 1))} style={{ background:'#f5f0e8', border:'1px solid #ede8e0', borderRadius:10, padding:'7px 10px', cursor:'pointer' }}>
            <i className="ti ti-chevron-left" aria-hidden="true" style={{ fontSize:16, color:'#2c2820' }} />
          </button>
          <div style={{ fontSize:18, fontWeight:600, letterSpacing:'-0.01em' }}>{MONTHS[mon]} {year}</div>
          <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(year, mon + 1, 1))} style={{ background:'#f5f0e8', border:'1px solid #ede8e0', borderRadius:10, padding:'7px 10px', cursor:'pointer' }}>
            <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize:16, color:'#2c2820' }} />
          </button>
        </div>

        {/* Day labels */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
          {DAYS.map(d => <div key={d} style={{ textAlign:'center', fontSize:9, color:'#b0a89a', fontWeight:600 }}>{d}</div>)}
        </div>

        {/* Grid */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #ede8e0', boxShadow:'0 2px 12px rgba(44,40,32,0.06)', overflow:'hidden', marginBottom:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {cells.map((day, i) => {
              const info = day ? getCellInfo(day) : null
              if (!day) return <div key={i} style={{ minHeight:54 }} />

              const hasLog = !!info.log
              const cellBg = info.isToday
                ? (info.sub ? info.pc.bg : 'rgba(44,40,32,0.06)')
                : hasLog && !info.sub
                  ? 'rgba(200,184,154,0.18)'  // logged but no phase, warm tint
                  : info.isFuture
                    ? (info.sub ? info.pc.bg.replace('0.24','0.14') : 'transparent')
                    : (info.sub ? info.pc.bg : hasLog ? 'rgba(200,184,154,0.18)' : 'transparent')

              return (
                <button type="button" key={i} onClick={() => openSheet(info)}
                  aria-label={`${info.dateStr}${info.sub ? `, ${info.sub} phase` : ''}${hasLog ? ', logged' : ''}`}
                  style={{
                    minHeight:54, padding:'7px 2px 10px', textAlign:'center',
                    cursor:'pointer', position:'relative', border:'none', font:'inherit',
                    background: cellBg,
                    opacity: info.isFuture ? 0.75 : 1,
                  }}>
                  {/* Day number circle */}
                  <div style={{
                    width:26, height:26, borderRadius:13, margin:'0 auto',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background: info.isToday ? '#2c2820' : 'transparent',
                    color: info.isToday ? '#f5f0e8' : '#2c2820',
                    fontSize:12, fontWeight: info.isToday ? 700 : 400,
                  }}>{day}</div>

                  {/* Phase bar */}
                  {info.sub && (
                    <div style={{
                      position:'absolute', bottom:5, left:6, right:6, height:5, borderRadius:2.5,
                      background: info.pc.dot, opacity: info.isFuture ? 0.5 : 1,
                    }} />
                  )}

                  {/* Log dot, green if mood logged, amber if no mood */}
                  {hasLog && (
                    <div style={{
                      position:'absolute', top:5, right:4, width:5, height:5, borderRadius:'50%',
                      background: info.log.mood?.length > 0 ? '#88c088' : '#c8b89a',
                    }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:16 }}>
          {hasPhaseData ? (
            [['Menstrual','#e09898'],['Follicular','#88c088'],['Ovulatory','#88c0e0'],['Luteal','#e6c447'],['Logged','#c8b89a']].map(([l,c]) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:c }} />
                <span style={{ fontSize:10, color:'#7a7268' }}>{l}</span>
              </div>
            ))
          ) : (
            [['Logged','#c8b89a'],['Positive mood','#88c088']].map(([l,c]) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:c }} />
                <span style={{ fontSize:10, color:'#7a7268' }}>{l}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav />

      {/* Bottom sheet overlay */}
      {sheet && (
        <>
          <button type="button" aria-label="Close" onClick={() => setSheet(null)} style={{ position:'fixed', inset:0, background:'rgba(44,40,32,0.4)', zIndex:100, border:'none', padding:0, cursor:'pointer' }} />
          <div role="dialog" aria-modal="true" aria-label={`Details for ${sheetDate?.toLocaleDateString('en-CA', { weekday:'long', month:'long', day:'numeric' })}`} style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:420, background:'#faf8f5', borderRadius:'20px 20px 0 0', zIndex:101, padding:'16px 20px 48px', maxHeight:'80vh', overflowY:'auto' }}>
            {/* Handle */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ width:36, height:4, background:'#c8b89a', borderRadius:2, margin:'6px auto 6px' }} />
              <button type="button" aria-label="Close" onClick={() => setSheet(null)} style={{ position:'absolute', right:16, top:12, background:'none', border:'none', cursor:'pointer', color:'#9a9590', fontSize:20, padding:4, lineHeight:1 }}>
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            {/* Date + phase pill */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              <div style={{ fontSize:15, fontWeight:600 }}>
                {sheetDate?.toLocaleDateString('en-CA', { weekday:'long', month:'long', day:'numeric' })}
              </div>
              {sheetInfo?.sub && (
                <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:sheetInfo.pc.bg, color:sheetInfo.pc.text, border:`1px solid ${sheetInfo.pc.dot}` }}>
                  {sheetInfo.sub}
                </span>
              )}
            </div>

            {sheet.isFuture ? (
              /* Future day */
              <div>
                {(() => {
                  const sub = sheetInfo?.sub
                  const daysAway = sheetDate ? diffCalendarDays(sheetDate, now) : null

                  // Period prediction
                  let periodPredCard = null
                  const pred = status?.nextPeriodPrediction
                  if (hasPhaseData && pred && daysAway !== null) {
                    const nextPeriod = new Date(pred.predictedDate)
                    const windowStart = new Date(pred.windowStart); windowStart.setHours(0, 0, 0, 0)
                    const windowEnd = new Date(pred.windowEnd); windowEnd.setHours(0, 0, 0, 0)
                    if (sheetDate >= windowStart && sheetDate <= windowEnd) {
                      const fmt = d => new Date(d).toLocaleDateString('en-CA', { month:'long', day:'numeric' })
                      periodPredCard = (
                        <div style={{ background:'linear-gradient(135deg,#fce8e0,#fad8d0)', border:'1px solid #f0c0b0', borderRadius:12, padding:16, marginBottom:12 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                            <i className="ti ti-droplet-filled" style={{ color:'#c05858', fontSize:18 }}/>
                            <div style={{ fontSize:14, fontWeight:600, color:'#5a2020' }}>Your period may start around this day</div>
                          </div>
                          <div style={{ fontSize:13, color:'#6a3030', lineHeight:1.7, marginBottom:8 }}>
                            {pred.confidence === 'none' ? 'Using the cycle length you entered, ' : 'Using your recorded cycle starts, '}your next period is estimated around {fmt(nextPeriod)}. {pred.irregular ? 'Your cycles vary, so the broad estimate is' : 'The estimate window is'} {fmt(windowStart)} to {fmt(windowEnd)}.
                          </div>
                          <div style={{ fontSize:13, color:'#6a3030', lineHeight:1.7, marginBottom:8 }}>
                            What to have ready: period products, a heat pad, iron-rich foods, and magnesium.
                          </div>
                          <div style={{ fontSize:13, color:'#6a3030', lineHeight:1.7, marginBottom:8 }}>
                            No special food or training change is required. Use the symptoms you actually experience and your usual care plan.
                          </div>
                          <div style={{ fontSize:11, color:'#9a6060', fontStyle:'italic' }}>
                            {pred.confidence === 'moderate' ? 'Moderate-confidence estimate from repeated cycle history.' : pred.confidence === 'low' ? 'Low-confidence estimate from limited or variable history.' : 'Population fallback from the cycle length you entered; not yet personalised.'}
                          </div>
                        </div>
                      )
                    }
                  }

                  // Estimated fertile window. AWARENESS ONLY, never contraceptive guidance.
                  // The fertile window spans ~5 days before ovulation through ~1 day after
                  // (sperm survive up to 5 days; the egg ~24h). Ovulation ≈ cycleLen − 14.
                  // FDA line: we may show fertility *information* but must never tell anyone it
                  // is "safe" to have unprotected sex, that is a contraceptive claim requiring
                  // FDA clearance. Every rendering carries the "not birth control" disclaimer and
                  // uses no safe/unsafe-day language.
                  let fertileCard = null
                  const cd = sheetInfo?.phaseInfo?.cycleDay
                  if (hasPhaseData && cd) {
                    const ovDay = getOvulationDay(cycleLen, status?.learnedLutealLength)
                    if (cd >= ovDay - 5 && cd <= ovDay + 1) {
                      const isOvulation = cd >= ovDay - 1 && cd <= ovDay + 1
                      fertileCard = (
                        <div style={{ background:'linear-gradient(135deg,#e6f0ec,#dcebf0)', border:'1px solid #bcd8cc', borderRadius:12, padding:16, marginBottom:12 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                            <i className="ti ti-flower" style={{ color:'#3a8a6a', fontSize:18 }}/>
                            <div style={{ fontSize:14, fontWeight:600, color:'#1f4a3a' }}>{isOvulation ? 'Ovulation estimated around this day' : 'Estimated fertile window'}</div>
                          </div>
                          <div style={{ fontSize:13, color:'#2a4a40', lineHeight:1.7, marginBottom:8 }}>
                            Based on your recorded cycle timing, this date falls inside an estimated fertile window. Wetter or egg-white cervical fluid and a positive home LH test can add context; a later sustained temperature shift can provide a retrospective estimate.
                          </div>
                          <div style={{ fontSize:12, fontWeight:600, color:'#b0402a', lineHeight:1.55, marginTop:4 }}>
                            Not birth control, an estimate only. If you&apos;re avoiding pregnancy, use protection and talk to your doctor; predictions can be wrong.
                          </div>
                        </div>
                      )
                    }
                  }

                  const BRAIN_STATE = {
                    Menstrual:          { state:'Possible lower-mood window', bg:'#ede0f0', text:'#5a3a6a', sentence:'Some people notice mood, pain or concentration changes during bleeding; others do not. Track what happens for you and do not assume persistent symptoms are only hormonal.' },
                    'Early follicular': { state:'Possible transition window', bg:'#d8edd8', text:'#2a5a2a', sentence:'Some people notice energy or mood shift after bleeding ends. Your own repeated observations are more useful than a population expectation.' },
                    Follicular:         { state:'Possible higher-readiness window', bg:'#d8edd8', text:'#2a5a2a', sentence:'Some studies and self-reports find improved readiness here, but the size and direction vary considerably between individuals.' },
                    'Late follicular':  { state:'Possible higher-readiness window', bg:'#f5e898', text:'#4a3a00', sentence:'Some people report stronger focus or training here. Empower will only call it your pattern after it repeats in your own data.' },
                    Ovulatory:          { state:'Estimated ovulation window', bg:'#f5d88a', text:'#4a2a00', sentence:'Hormones change around ovulation, but calendar timing cannot predict your mood, cognition or performance with certainty.' },
                    'Early luteal':     { state:'Possible transition window', bg:'#d5e0f0', text:'#2a3a5a', sentence:'Some people feel steady here and others notice no change. Treat this as context, not a prediction of how you will feel.' },
                    'Mid luteal':       { state:'Possible symptom window', bg:'#f5e0c0', text:'#5a3800', sentence:'Sleep, temperature or perceived effort may shift for some people. Persistent mood or cognitive symptoms deserve attention beyond cycle timing.' },
                    'Late luteal':      { state:'Possible pre-period window', bg:'#f0d0c0', text:'#5a2a10', sentence:'Premenstrual symptoms can occur here, but their presence and severity vary. Empower learns whether this is actually a pattern for you.' },
                    Luteal:             { state:'Possible symptom window', bg:'#f5e0c0', text:'#5a3800', sentence:'Some people notice changes in sleep, appetite, mood or effort here, while others remain stable.' },
                  }

                  // Sex drive is deliberately not predicted from phase; it varies within and
                  // between people and can be influenced by many non-cycle factors.
                  const LIBIDO_LABEL = Object.fromEntries(
                    ['Menstrual','Early follicular','Follicular','Late follicular','Ovulatory','Early luteal','Mid luteal','Late luteal','Luteal']
                      .map(label => [label, 'Sex drive varies'])
                  )

                  const brainData = BRAIN_STATE[sub] || null
                  const brainDetail = null
                  const libidoLabel = LIBIDO_LABEL[sub] || null

                  const energyLabels = {
                    Menstrual: 'Energy may vary', 'Early follicular': 'Energy may shift', Follicular: 'Possible higher readiness',
                    'Late follicular': 'Possible higher readiness', Ovulatory: 'Energy may vary', 'Early luteal': 'Energy may vary',
                    'Mid luteal': 'Effort may shift', 'Late luteal': 'Symptoms may affect energy', Luteal: 'Energy may vary',
                  }
                  const energyLabel = energyLabels[sub] || null

                  return <>
                    {periodPredCard}
                    {fertileCard}

                    {daysAway !== null && (
                      <div style={{ fontSize:12, color:'#9a9590', marginBottom:12 }}>
                        {daysAway === 0 ? 'Today' : daysAway === 1 ? 'In 1 day' : `In ${daysAway} days`}
                        {sub ? `, estimated ${sub} phase` : ''}
                        {hasPhaseData ? '' : '. Log your period date to see phase predictions'}
                      </div>
                    )}

                    {/* Chips: energy / phase / intensity */}
                    {sub && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                        {energyLabel && <span style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, background:'#f5f0e8', border:'1px solid #ede8e0', color:'#5a4a3a' }}>
                          <i className="ti ti-bolt" style={{ fontSize:11, marginRight:4 }} />{energyLabel}
                        </span>}
                        <span style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, background:'#f5f0e8', border:'1px solid #ede8e0', color:'#5a4a3a' }}>{sub}</span>
                        <span style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, background:'#f5f0e8', border:'1px solid #ede8e0', color:'#5a4a3a' }}>
                          <i className="ti ti-barbell" style={{ fontSize:11, marginRight:4 }} />{getMovementToday(sub).title}
                        </span>
                        {libidoLabel && <span style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, background:'#f5f0e8', border:'1px solid #ede8e0', color:'#5a4a3a' }}>
                          <i className="ti ti-heart" style={{ fontSize:11, marginRight:4 }} />{libidoLabel}
                        </span>}
                      </div>
                    )}

                    {sheetInfo?.phaseInfo?.estimated && sub && (
                      <div style={{ fontSize:11, color:'#8a8178', lineHeight:1.5, marginBottom:12 }}>
                        Calendar estimate, not a recorded or confirmed phase. Your cycle timing and body signals may differ.
                      </div>
                    )}

                    {/* Collapse the deeper detail so the sheet leads with the key info and
                        stays clean; user expands "more about this day" if they want it. */}
                    {(brainData || (sub && (PLAN_NUTRITION[sub] || PLAN_MOVEMENT[sub]))) && (
                      <button type="button" aria-expanded={futureExpanded} onClick={() => setFutureExpanded(x => !x)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:'12px 14px', marginBottom:12, cursor:'pointer', fontFamily:'inherit' }}>
                        <span style={{ fontSize:13, fontWeight:600, color:'#2c2820' }}>More about this day</span>
                        <i className={`ti ti-chevron-${futureExpanded ? 'up' : 'down'}`} aria-hidden="true" style={{ fontSize:15, color:'#9a9590' }} />
                      </button>
                    )}

                    {/* YOUR BRAIN THIS DAY */}
                    {futureExpanded && brainData && (
                      <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:14, marginBottom:12 }}>
                        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:10 }}>RESEARCH CONTEXT</div>
                        <span style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, background:brainData.bg, color:brainData.text, display:'inline-block', marginBottom:10 }}>{brainData.state}</span>
                        <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6, marginBottom: brainDetail ? 10 : 0 }}>{brainData.sentence}</div>
                        {brainDetail && (
                          <>
                            <button type="button" aria-expanded={brainExpanded}
                              onClick={() => setBrainExpanded(x => !x)}
                              style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', alignItems:'center', gap:4, color:'#7a7268', fontSize:12, fontFamily:'inherit' }}
                            >
                              <span>{brainExpanded ? 'Less' : 'Full explanation'}</span>
                              <i className={`ti ti-chevron-${brainExpanded ? 'up' : 'down'}`} aria-hidden="true" style={{ fontSize:12 }} />
                            </button>
                            {brainExpanded && (
                              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #ede8e0', fontSize:13, color:'#5a5048', lineHeight:1.7 }}>
                                {brainDetail}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* PLAN AHEAD */}
                    {futureExpanded && sub && (PLAN_NUTRITION[sub] || PLAN_MOVEMENT[sub]) && (
                      <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:14, marginBottom:12 }}>
                        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:12 }}>PLAN AHEAD</div>
                        {PLAN_NUTRITION[sub] && (
                          <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:10, background:'#f5f0e8', borderRadius:10, padding:12 }}>
                            <span style={{ fontSize:22, flexShrink:0, lineHeight:1 }}>🥗</span>
                            <div>
                              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9a9590', marginBottom:4 }}>NUTRITION</div>
                              <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6 }}>{PLAN_NUTRITION[sub]}</div>
                            </div>
                          </div>
                        )}
                        {PLAN_MOVEMENT[sub] && (
                          <div style={{ display:'flex', alignItems:'flex-start', gap:12, background:'#f0f5f0', borderRadius:10, padding:12 }}>
                            <span style={{ fontSize:22, flexShrink:0, lineHeight:1 }}>🚶‍♀️</span>
                            <div>
                              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9a9590', marginBottom:4 }}>MOVEMENT</div>
                              <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6 }}>{PLAN_MOVEMENT[sub]}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!hasPhaseData && (
                      <div style={{ background:'#f5f0e8', borderRadius:12, padding:14, marginBottom:12 }}>
                        <div style={{ fontSize:13, color:'#7a7268', lineHeight:1.6 }}>
                          Log your period start date to see phase predictions and personalised guidance for future days.
                        </div>
                      </div>
                    )}

                    <button onClick={() => { setSheet(null); navigate('/log') }} style={{ width:'100%', padding:'12px', borderRadius:10, background:'#f5f0e8', border:'1px solid #ede8e0', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                      Log today
                    </button>
                  </>
                })()}
              </div>
            ) : sheetLog ? (
              /* Past day with data */
              <div>
                {/* Energy */}
                {sheetLog.energy && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>ENERGY</div>
                    <span style={{ padding:'4px 12px', borderRadius:20, fontSize:13, background:'#f5f0e8', border:'1px solid #ede8e0' }}>{sheetLog.energy}</span>
                  </div>
                )}

                {/* Sex drive, a genuine cycle signal (libido often rises near ovulation as
                    estrogen and testosterone peak). Shown back so the user sees the pattern. */}
                {sheetLog.libido && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>SEX DRIVE</div>
                    <span style={{ padding:'4px 12px', borderRadius:20, fontSize:13, background:'#f5f0e8', border:'1px solid #ede8e0' }}>{sheetLog.libido}</span>
                  </div>
                )}

                {/* Mood */}
                {sheetLog.mood?.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>MOOD</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {sheetLog.mood.map(m => {
                        const mc = MOOD_COLORS[m] || { bg:'#f5f0e8', text:'#3a3530' }
                        return <span key={m} style={{ padding:'4px 10px', borderRadius:20, fontSize:12, background:mc.bg, color:mc.text }}>{m}</span>
                      })}
                    </div>
                  </div>
                )}

                {/* Symptoms */}
                {sheetLog.symptoms?.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>SYMPTOMS</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {sheetLog.symptoms.map(s => <span key={s} style={{ padding:'4px 10px', borderRadius:20, fontSize:12, background:'#f0ece4', color:'#4a4030' }}>{s}</span>)}
                    </div>
                  </div>
                )}

                {/* Sleep + Workout */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                  {sheetLog.sleep_quality && (
                    <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:10, padding:10 }}>
                      <div style={{ fontSize:10, color:'#9a9590', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:3 }}>SLEEP</div>
                      <div style={{ fontSize:13, fontWeight:500 }}>{sheetLog.sleep_quality}</div>
                    </div>
                  )}
                  {sheetLog.workout_feel && (
                    <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:10, padding:10 }}>
                      <div style={{ fontSize:10, color:'#9a9590', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:3 }}>WORKOUT</div>
                      <div style={{ fontSize:13, fontWeight:500 }}>{sheetLog.workout_feel}</div>
                    </div>
                  )}
                </div>

                <button onClick={() => { setSheet(null); navigate('/log?date=' + sheet.dateStr) }} style={{ width:'100%', padding:'12px', borderRadius:10, background:'#f5f0e8', border:'1px solid #ede8e0', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                  Edit this log
                </button>
              </div>
            ) : (
              /* Past day, no data */
              <div>
                <div style={{ fontSize:13, color:'#9a9590', marginBottom:16, lineHeight:1.6 }}>No data logged for this day.</div>
                <button onClick={() => { setSheet(null); navigate('/log?date=' + sheet.dateStr) }} style={{ width:'100%', padding:'12px', borderRadius:10, background:'#f5f0e8', border:'1px solid #ede8e0', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                  Log this day
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
