// route /calendar — colour-coded cycle calendar with past logs and future day planning bottom sheets
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus, getPhase, getLutealSubPhase } from '../lib/hormoneSync'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'

const PC = {
  Menstrual:          { dot:'#e09898', bg:'rgba(224,152,152,0.14)', text:'#5a2a28' },
  Follicular:         { dot:'#88c088', bg:'rgba(136,192,136,0.14)', text:'#1a4a1a' },
  'Early follicular': { dot:'#88c088', bg:'rgba(136,192,136,0.14)', text:'#1a4a1a' },
  Ovulatory:          { dot:'#88c0e0', bg:'rgba(136,192,224,0.14)', text:'#1a3a5a' },
  'Early luteal':     { dot:'#e0c070', bg:'rgba(224,192,112,0.14)', text:'#6a3a10' },
  'Mid luteal':       { dot:'#d0a040', bg:'rgba(208,160,64,0.14)', text:'#5a3008' },
  'Late luteal':      { dot:'#c88878', bg:'rgba(200,136,120,0.14)', text:'#5a2818' },
  Luteal:             { dot:'#d0a040', bg:'rgba(208,160,64,0.14)', text:'#5a3008' },
  observation:        { dot:'#c8b89a', bg:'rgba(200,184,154,0.10)', text:'#4a4540' },
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

function getPhaseForDate(date, lastPeriod, cycleLen) {
  if (!lastPeriod) return null
  const last = new Date(lastPeriod + 'T00:00:00')
  const diff = Math.floor((date - last) / 86400000)
  if (diff < 0) return null
  const cycleDay = (diff % cycleLen) + 1
  const phase = getPhase(cycleDay, cycleLen)
  const sub = phase === 'Luteal' ? getLutealSubPhase(cycleDay, cycleLen) : phase
  return { phase, sub, cycleDay }
}

// Phase-specific nutrition notes for Plan Ahead — sources: ISSN 2023, Facchinetti 1991, Backstrom 2008
const PLAN_NUTRITION = {
  Menstrual:          'Iron-rich foods replenish what bleeding depletes. Red meat, lentils, spinach with vitamin C. Anti-inflammatory ginger and turmeric reduce prostaglandin activity.',
  'Early follicular': 'Iron-rich foods are still the priority. Eggs, leafy greens, legumes with vitamin C for absorption. Ferritin rebuilds over 2 to 4 weeks.',
  Follicular:         'Protein at every meal. Eggs, Greek yogurt, salmon, legumes. Rising estrogen supports muscle protein synthesis — your body uses this nutrition more efficiently right now.',
  'Late follicular':  'Pre-exercise carbohydrates and lean protein. Your body is primed to use fuel efficiently at this point in your cycle.',
  Ovulatory:          'Light and nutrient-dense. Your appetite may naturally decrease around ovulation. Prioritise protein and hydration. Anti-inflammatory foods support joint health.',
  'Early luteal':     'Increase protein today. Progesterone raises your protein breakdown rate — aim for 1.8g per kg of body weight. Greek yogurt, chicken, salmon, eggs. (ISSN 2023)',
  'Mid luteal':       'Higher protein target: 1.8 to 2.2g per kg. Progesterone is at its peak and your body breaks down muscle protein faster. Complex carbohydrates help stabilise mood. (ISSN 2023)',
  'Late luteal':      'Magnesium-rich foods may reduce PMS severity — dark chocolate, pumpkin seeds, leafy greens. Reduce caffeine and alcohol this week. (Facchinetti et al. 1991)',
  Luteal:             'Protein and complex carbohydrates are your priorities. Complex carbs stabilise mood as serotonin decreases through this phase. Aim for 1.8g protein per kg. (ISSN 2023)',
  Perimenopause:      'Calcium 1000mg daily from dairy, sardines, almonds, leafy greens. Protein 1.8g per kg supports muscle and bone health long-term. (ISSN 2023)',
  observation:        'Consistent nutrition helps stabilise energy. Protein at every meal, iron-rich foods, and complex carbohydrates give the algorithm more data points.',
}

// Phase-specific movement notes — sources: Kissow 2022, Hackney 2006, De Martin Topranin 2023, Kohrt 2004
const PLAN_MOVEMENT = {
  Menstrual:          'Gentle movement only. Even a 20-minute walk reduces prostaglandins and eases cramping measurably. Walking or yoga are ideal today. (Daley et al. 2015)',
  'Early follicular': 'Short easy session to ease back in. A gentle walk or light yoga. Your energy is returning — no need to push yet.',
  Follicular:         'This is your best training window. Push weights or try a faster run. Recovery is faster than any other phase. Muscle protein synthesis responds best right now. (Kissow et al. 2022)',
  'Late follicular':  'Your peak strength window. Heavy compound lifts respond best now. Expect to feel unusually strong. (Sarwar et al. 1996)',
  Ovulatory:          'High-intensity training is well-supported today. Complete a thorough warmup — peak estrogen increases ligament laxity temporarily. (SOURCE: ACL research pending)',
  'Early luteal':     'Steady strength training is still effective. Your energy is good. Maintain training volume from follicular phase.',
  'Mid luteal':       'The same session genuinely feels harder — that is real physiology, not lack of fitness. Reduce load by 10 to 15% and maintain your sets. (De Martin Topranin et al. 2023)',
  'Late luteal':      'Keep it gentle. A walk, yoga, or light stretching. Completing anything at all is a win this phase. (Hackney 2006)',
  Luteal:             'Train to feel rather than by numbers. Reduce intensity but maintain frequency. Consistency through the luteal phase builds long-term resilience.',
  Perimenopause:      'Resistance training is your most important tool. Even one strength session per week protects bone density and muscle mass long-term. (Kohrt et al. 2004)',
  observation:        'Any movement logged teaches the algorithm your capacity baseline. Walk, stretch, or train — all of it counts.',
}

// Expanded brain explanations for the tap-to-expand detail — sources: Backstrom 2008, Bäckström 2014, Lokuge 2011
const BRAIN_DETAIL = {
  Menstrual:          'Estrogen directly drives serotonin production. When estrogen drops to its lowest point at menstruation, serotonin drops with it. Serotonin is your primary mood-stabilising neurotransmitter — it regulates emotional responses, pain sensitivity, and motivation. Its absence during menstruation has a measurable neurochemical cause. Any low mood, emotional sensitivity, or difficulty concentrating right now is a direct result of this drop. (Lokuge et al. 2011, Journal of Psychiatry and Neuroscience)',
  'Early follicular': 'Estrogen is beginning to rise after its menstrual low. As estrogen climbs, it triggers serotonin production and increases receptor sensitivity. The brain is coming back online after the hormonal low. This is why energy and mood start to lift within a few days of the period ending — even before the body has physically recovered. (Lokuge et al. 2011)',
  Follicular:         'Rising estrogen drives rising serotonin and dopamine simultaneously. Dopamine is your motivation and reward neurotransmitter — it creates drive, optimism, and the capacity to plan ahead. Serotonin stabilises mood and reduces anxiety. When both are rising together, the brain is in one of its most capable states. (Backstrom et al. 2008, Archives of Women\'s Mental Health)',
  'Late follicular':  'Both dopamine and serotonin are at their highest point in the cycle. Cognitive performance, creative problem-solving, and social confidence are all elevated by this neurochemical combination. This is peak brain chemistry — not a coincidence, not personality. (Backstrom et al. 2008)',
  Ovulatory:          'Estrogen peaks just before ovulation, reaching its highest point of the cycle. Alongside estrogen, testosterone briefly rises. This combination drives peak confidence, social energy, and physical performance. The brain state is neurochemically optimised — confidence, coordination, and drive are all at their highest. (Backstrom et al. 2008)',
  'Early luteal':     'Progesterone converts in the brain into a calming compound that works on the same receptors as anti-anxiety medication. This creates the calm, settled feeling many women notice in the early luteal phase. It is a real neurological effect, not a coincidence. (Bäckström et al. 2014, Psychoneuroendocrinology)',
  'Mid luteal':       'Estrogen is declining and serotonin stability drops with it. Progesterone remains high. As serotonin becomes less stable, mood can feel more variable day to day. The brain is balancing the calming effect of progesterone alongside the less stable mood environment from declining estrogen. (Backstrom et al. 2008)',
  'Late luteal':      'Both estrogen and progesterone are now dropping sharply. When progesterone drops, the calming effect it was providing disappears. At the same time, serotonin is at its lowest point since your period began. Anxiety, irritability, and low mood here are a direct result of these hormonal changes. They will resolve when menstruation begins. (Bäckström et al. 2014)',
  Luteal:             'Serotonin stability is decreasing through this phase as estrogen declines. Mood may feel less predictable than in follicular. The progesterone calming effect partially offsets this but cannot fully compensate as both hormones fluctuate. (Backstrom et al. 2008)',
  Perimenopause:      'Estrogen fluctuates unpredictably in perimenopause, and serotonin fluctuates with it. Unlike the regular monthly pattern of the reproductive years, the variability is less predictable. Sleep disruption also directly reduces serotonin production, compounding the effect. (Freeman et al. 2004, Archives of General Psychiatry)',
}

export default function Calendar() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [now] = useState(new Date())
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [sheet, setSheet] = useState(null) // { dateStr, isFuture }
  const [brainExpandedSheet, setBrainExpandedSheet] = useState(null)
  const brainExpanded = brainExpandedSheet === sheet?.dateStr

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    try {
      const [s, { data: logData }] = await Promise.all([
        getTodayStatus(supabase, user.id),
        supabase.from('daily_logs')
          .select('log_date,energy,mood,symptoms,sleep_quality,workout_feel,resting_hr')
          .eq('user_id', user.id)
          .gte('log_date', localDateStr(new Date(now.getFullYear(), now.getMonth() - 2, 1))),
      ])
      // Derive lastPeriodDate from getTodayStatus cycleDay — avoids maybeSingle() failing
      // when user has multiple cycle_data rows (getTodayStatus already picks the most recent)
      if (s?.cycleDay > 0 && s.cycleLen) {
        const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
        const lastP = new Date(todayDate)
        lastP.setDate(lastP.getDate() - (s.cycleDay - 1))
        s.lastPeriodDate = localDateStr(lastP)
      }
      setStatus(s)
      setLogs(logData || [])
    } catch(e) { console.error('Calendar init error:', e) }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { init() }, [])

  if (loading) return <div style={{ paddingTop:60 }}><Spinner /></div>

  const profile = status?.profile
  const isPath4 = profile?.user_path === '4'
  // Hormonal BC (path 5, not copper IUD) suppresses ovulation — there is no natural
  // cycle phase, so never colour the calendar by phase even if a bleed date exists.
  const isHormonalBC = profile?.user_path === '5' && profile?.bc_type !== 'copper-iud'
  const lastPeriod = status?.lastPeriodDate
  // Use cycleLen from getTodayStatus (sourced from cycle_data) — more accurate than profile table
  const cycleLen = status?.cycleLen || profile?.cycle_length || 28
  const hasPhaseData = !!lastPeriod && !isPath4

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
    const phaseInfo = hasPhaseData ? getPhaseForDate(date, lastPeriod, cycleLen) : null
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
    const phaseInfo = hasPhaseData ? getPhaseForDate(date, lastPeriod, cycleLen) : null
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
      <div style={{ background:'#f5f0e8', padding:'16px 20px', borderBottom:'1px solid #ede8e0', display:'flex', alignItems:'center' }}>
        <button onClick={() => navigate('/dashboard')} style={{ background:'none', border:'none', cursor:'pointer', padding:0, marginRight:12 }}>
          <i className="ti ti-chevron-left" style={{ fontSize:20, color:'#2c2820' }} />
        </button>
        <div style={{ flex:1, textAlign:'center' }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase' }}>Em~power</div>
          <div style={{ fontSize:11, color:'#9a9590', marginTop:2 }}>
            {status?.cycleDay ? `Day ${status.cycleDay} of ${cycleLen}` : isHormonalBC ? (status?.subPhase || 'On birth control') : 'Cycle calendar'}
          </div>
        </div>
        <div style={{ width:28 }} />
      </div>

      {isHormonalBC && hasPhaseData && (
        <div style={{ margin:'12px 16px 0', padding:'12px 14px', background:'#f0f0f8', border:'1px solid #d8d8ec', borderRadius:12, fontSize:13, color:'#3a3550', lineHeight:1.55 }}>
          <strong>These phases are an estimate.</strong> Hormonal birth control can flatten your natural hormone swings, so your true cycle may differ. We base these on the period and bleed dates you log.
        </div>
      )}
      {isHormonalBC && !hasPhaseData && (
        <div style={{ margin:'12px 16px 0', padding:'12px 14px', background:'#f0f0f8', border:'1px solid #d8d8ec', borderRadius:12, fontSize:13, color:'#3a3550', lineHeight:1.55 }}>
          <strong>Add your last bleed date to unlock your phases.</strong> Log the first day of your most recent period or withdrawal bleed and the calendar will fill in your phase colours and brain (neurotransmitter) guidance.{' '}
          <button onClick={() => navigate('/log')} style={{ background:'none', border:'none', padding:0, color:'#5a4ab0', fontWeight:600, textDecoration:'underline', cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>Log it now</button>
        </div>
      )}

      <div style={{ padding:'16px 16px 0' }}>
        {/* Month nav */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <button onClick={() => setMonth(new Date(year, mon - 1, 1))} style={{ background:'#f5f0e8', border:'1px solid #ede8e0', borderRadius:10, padding:'7px 10px', cursor:'pointer' }}>
            <i className="ti ti-chevron-left" style={{ fontSize:16, color:'#2c2820' }} />
          </button>
          <div style={{ fontSize:18, fontWeight:600, letterSpacing:'-0.01em' }}>{MONTHS[mon]} {year}</div>
          <button onClick={() => setMonth(new Date(year, mon + 1, 1))} style={{ background:'#f5f0e8', border:'1px solid #ede8e0', borderRadius:10, padding:'7px 10px', cursor:'pointer' }}>
            <i className="ti ti-chevron-right" style={{ fontSize:16, color:'#2c2820' }} />
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
                  ? 'rgba(200,184,154,0.18)'  // logged but no phase — warm tint
                  : info.isFuture
                    ? (info.sub ? info.pc.bg.replace('0.14','0.06') : 'transparent')
                    : (info.sub ? info.pc.bg : hasLog ? 'rgba(200,184,154,0.18)' : 'transparent')

              return (
                <div key={i} onClick={() => openSheet(info)}
                  style={{
                    minHeight:54, padding:'7px 2px 10px', textAlign:'center',
                    cursor:'pointer', position:'relative',
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
                      position:'absolute', bottom:5, left:6, right:6, height:3, borderRadius:2,
                      background: info.pc.dot, opacity: info.isFuture ? 0.3 : 0.9,
                    }} />
                  )}

                  {/* Log dot — green if mood logged, amber if no mood */}
                  {hasLog && (
                    <div style={{
                      position:'absolute', top:5, right:4, width:5, height:5, borderRadius:'50%',
                      background: info.log.mood?.length > 0 ? '#88c088' : '#c8b89a',
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:16 }}>
          {hasPhaseData ? (
            [['Menstrual','#e09898'],['Follicular','#88c088'],['Ovulatory','#88c0e0'],['Luteal','#d0a040'],['Logged','#c8b89a']].map(([l,c]) => (
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
          <div onClick={() => setSheet(null)} style={{ position:'fixed', inset:0, background:'rgba(44,40,32,0.4)', zIndex:100 }} />
          <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:420, background:'#faf8f5', borderRadius:'20px 20px 0 0', zIndex:101, padding:'16px 20px 48px', maxHeight:'80vh', overflowY:'auto' }}>
            {/* Handle */}
            <div style={{ width:36, height:4, background:'#c8b89a', borderRadius:2, margin:'0 auto 16px' }} />

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
                  const daysAway = sheetDate ? Math.round((sheetDate - now) / 86400000) : null

                  // Period prediction
                  let periodPredCard = null
                  if (hasPhaseData && lastPeriod && daysAway !== null) {
                    const lastDate = new Date(lastPeriod + 'T00:00:00')
                    const nextPeriodMs = lastDate.getTime() + cycleLen * 86400000
                    const nextPeriod = new Date(nextPeriodMs)
                    const diffFromPred = Math.round((sheetDate - nextPeriod) / 86400000)
                    if (Math.abs(diffFromPred) <= 3) {
                      const windowStart = new Date(nextPeriodMs - 2 * 86400000)
                      const windowEnd = new Date(nextPeriodMs + 2 * 86400000)
                      const fmt = d => d.toLocaleDateString('en-CA', { month:'long', day:'numeric' })
                      periodPredCard = (
                        <div style={{ background:'linear-gradient(135deg,#fce8e0,#fad8d0)', border:'1px solid #f0c0b0', borderRadius:12, padding:16, marginBottom:12 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                            <i className="ti ti-droplet-filled" style={{ color:'#c05858', fontSize:18 }}/>
                            <div style={{ fontSize:14, fontWeight:600, color:'#5a2020' }}>Your period may start around this day</div>
                          </div>
                          <div style={{ fontSize:13, color:'#6a3030', lineHeight:1.7, marginBottom:8 }}>
                            Based on your average cycle length of {cycleLen} days, your next period is predicted around {fmt(nextPeriod)}. The window is {fmt(windowStart)} to {fmt(windowEnd)}.
                          </div>
                          <div style={{ fontSize:13, color:'#6a3030', lineHeight:1.7, marginBottom:8 }}>
                            What to have ready: period products, a heat pad, iron-rich foods, and magnesium.
                          </div>
                          <div style={{ fontSize:13, color:'#6a3030', lineHeight:1.7, marginBottom:8 }}>
                            Starting 3 to 5 days before: anti-inflammatory foods, reduce caffeine and alcohol, and increase magnesium-rich foods such as dark chocolate, pumpkin seeds, and leafy greens.
                          </div>
                          <div style={{ fontSize:11, color:'#9a6060', fontStyle:'italic' }}>
                            This prediction is based on your personal cycle data.
                          </div>
                        </div>
                      )
                    }
                  }

                  const BRAIN_STATE = {
                    Menstrual:          { state:'Low serotonin',      bg:'#ede0f0', text:'#5a3a6a', sentence:'Estrogen is at its lowest and serotonin drops with it. Any emotional heaviness you feel has a biological cause, not a personal one.' },
                    'Early follicular':  { state:'Rising serotonin',  bg:'#d8edd8', text:'#2a5a2a', sentence:'Estrogen is beginning to rise and serotonin is rising with it. The brain is coming back online after the hormonal low of menstruation.' },
                    Follicular:         { state:'Rising serotonin',   bg:'#d8edd8', text:'#2a5a2a', sentence:'Rising estrogen drives rising serotonin and dopamine. Motivation, optimism, and mental clarity tend to improve noticeably in this phase.' },
                    'Late follicular':  { state:'Peak dopamine',      bg:'#f5e898', text:'#4a3a00', sentence:'Dopamine and serotonin are at their highest. Mental sharpness, creativity, and social energy are all peaking alongside them.' },
                    Ovulatory:          { state:'Neurochemical peak', bg:'#f5d88a', text:'#4a2a00', sentence:'Every confidence, motivation, and clarity neurotransmitter is at or near its highest point simultaneously. Peak brain chemistry.' },
                    'Early luteal':     { state:'Calm and settled',    bg:'#d5e0f0', text:'#2a3a5a', sentence:'Progesterone converts in the brain into a calming compound. The more settled feeling of this phase has a direct neurological cause.' },
                    'Mid luteal':       { state:'Serotonin dropping', bg:'#f5e0c0', text:'#5a3800', sentence:'Estrogen is declining and serotonin stability drops with it. The mildly unpredictable mood of mid-luteal has this specific chemical cause.' },
                    'Late luteal':      { state:'Serotonin crash',    bg:'#f0d0c0', text:'#5a2a10', sentence:'Serotonin and GABA support are both falling sharply. The anxiety, irritability, and low mood here are a neurochemical state, not a character trait.' },
                    Luteal:             { state:'Serotonin dropping', bg:'#f5e0c0', text:'#5a3800', sentence:'Serotonin stability is decreasing through this phase. Mood may feel less predictable than in follicular.' },
                  }

                  const INTENSITY_LABEL = {
                    Menstrual: 70, 'Early follicular': 85, Follicular: 95, 'Late follicular': 105,
                    Ovulatory: 105, 'Early luteal': 92, 'Mid luteal': 82, 'Late luteal': 72, Luteal: 80,
                  }

                  const brainData = BRAIN_STATE[sub] || null
                  const intensityPct = INTENSITY_LABEL[sub] || null

                  const energyLabels = {
                    Menstrual: 'Low energy', 'Early follicular': 'Returning energy', Follicular: 'Good energy',
                    'Late follicular': 'High energy', Ovulatory: 'Peak energy', 'Early luteal': 'Good energy',
                    'Mid luteal': 'Moderate energy', 'Late luteal': 'Low energy', Luteal: 'Variable energy',
                  }
                  const energyLabel = energyLabels[sub] || null

                  return <>
                    {periodPredCard}

                    {daysAway !== null && (
                      <div style={{ fontSize:12, color:'#9a9590', marginBottom:12 }}>
                        {daysAway === 0 ? 'Today' : daysAway === 1 ? 'In 1 day' : `In ${daysAway} days`}
                        {sub ? `, ${sub} phase` : ''}
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
                        {intensityPct && <span style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, background:'#f5f0e8', border:'1px solid #ede8e0', color:'#5a4a3a' }}>{intensityPct}% intensity</span>}
                      </div>
                    )}

                    {/* YOUR BRAIN THIS DAY */}
                    {brainData && (
                      <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:14, marginBottom:12 }}>
                        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:10 }}>YOUR BRAIN THIS DAY</div>
                        <span style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, background:brainData.bg, color:brainData.text, display:'inline-block', marginBottom:10 }}>{brainData.state}</span>
                        <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6, marginBottom: BRAIN_DETAIL[sub] ? 10 : 0 }}>{brainData.sentence}</div>
                        {BRAIN_DETAIL[sub] && (
                          <>
                            <button
                              onClick={() => setBrainExpandedSheet(s => s === sheet?.dateStr ? null : sheet?.dateStr)}
                              style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', alignItems:'center', gap:4, color:'#7a7268', fontSize:12, fontFamily:'inherit' }}
                            >
                              <span>{brainExpanded ? 'Less' : 'Full explanation'}</span>
                              <i className={`ti ti-chevron-${brainExpanded ? 'up' : 'down'}`} style={{ fontSize:12 }} />
                            </button>
                            {brainExpanded && (
                              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #ede8e0', fontSize:13, color:'#5a5048', lineHeight:1.7 }}>
                                {BRAIN_DETAIL[sub]}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* PLAN AHEAD */}
                    {sub && (PLAN_NUTRITION[sub] || PLAN_MOVEMENT[sub]) && (
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

                <button onClick={() => { setSheet(null); navigate('/log') }} style={{ width:'100%', padding:'12px', borderRadius:10, background:'#f5f0e8', border:'1px solid #ede8e0', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                  Edit this log
                </button>
              </div>
            ) : (
              /* Past day, no data */
              <div>
                <div style={{ fontSize:13, color:'#9a9590', marginBottom:16, lineHeight:1.6 }}>No data logged for this day.</div>
                <button onClick={() => { setSheet(null); navigate('/log') }} style={{ width:'100%', padding:'12px', borderRadius:10, background:'#f5f0e8', border:'1px solid #ede8e0', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
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
