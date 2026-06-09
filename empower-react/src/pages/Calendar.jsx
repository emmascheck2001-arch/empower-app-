import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus, getPhase, getLutealSubPhase } from '../lib/hormoneSync'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'

const PC = {
  Menstrual:      { dot:'#e09898', bg:'rgba(224,152,152,0.10)', text:'#5a2a28' },
  Follicular:     { dot:'#88c088', bg:'rgba(136,192,136,0.10)', text:'#1a4a1a' },
  'Early follicular': { dot:'#88c088', bg:'rgba(136,192,136,0.10)', text:'#1a4a1a' },
  Ovulatory:      { dot:'#88c0e0', bg:'rgba(136,192,224,0.10)', text:'#1a3a5a' },
  'Early luteal': { dot:'#e0c070', bg:'rgba(224,192,112,0.10)', text:'#6a3a10' },
  'Mid luteal':   { dot:'#d0a040', bg:'rgba(208,160,64,0.10)', text:'#5a3008' },
  'Late luteal':  { dot:'#c88878', bg:'rgba(200,136,120,0.10)', text:'#5a2818' },
  Luteal:         { dot:'#d0a040', bg:'rgba(208,160,64,0.10)', text:'#5a3008' },
  observation:    { dot:null, bg:'rgba(200,192,180,0.10)', text:'#4a4540' },
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

export default function Calendar() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [now] = useState(new Date())
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    try {
      const s = await getTodayStatus(supabase, user.id)
      setStatus(s)
      const { data } = await supabase.from('daily_logs')
        .select('log_date,energy,mood,symptoms')
        .eq('user_id', user.id)
        .gte('log_date', localDateStr(new Date(now.getFullYear(), now.getMonth() - 2, 1)))
      setLogs(data || [])
    } catch(e) {}
    setLoading(false)
  }

  if (loading) return <div style={{ paddingTop:60 }}><Spinner /></div>

  const profile = status?.profile
  const isPath4 = profile?.user_path === '4'
  const lastPeriod = status?.lastPeriodDate
  const cycleLen = profile?.cycle_length || 28

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
    const phaseInfo = !isPath4 ? getPhaseForDate(date, lastPeriod, cycleLen) : null
    const log = logMap[dateStr]
    const sub = phaseInfo?.sub || phaseInfo?.phase || null
    const pc = sub ? (PC[sub] || PC.Luteal) : PC.observation
    return { day, dateStr, isToday, isFuture, phaseInfo, log, pc, sub }
  }

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
            {status?.cycleDay ? `Day ${status.cycleDay} of ${cycleLen}` : 'Cycle calendar'}
          </div>
        </div>
        <div style={{ width:28 }} />
      </div>

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
              const isSelected = selectedDay === info.dateStr
              return (
                <div key={i} onClick={() => setSelectedDay(isSelected ? null : info.dateStr)}
                  style={{
                    minHeight:54, padding:'7px 2px 10px', textAlign:'center', cursor:'pointer', position:'relative',
                    background:isSelected ? '#e8dfd0' : info.isFuture ? info.pc.bg.replace('0.10','0.04') : info.pc.bg,
                    opacity: info.isFuture ? 0.7 : 1
                  }}>
                  {/* Day number */}
                  <div style={{
                    width:26, height:26, borderRadius:13, margin:'0 auto',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background: info.isToday ? '#2c2820' : 'transparent',
                    color: info.isToday ? '#f5f0e8' : '#2c2820',
                    fontSize:12, fontWeight: info.isToday ? 700 : 400
                  }}>{day}</div>
                  {/* Phase bar */}
                  {info.sub && (
                    <div style={{
                      position:'absolute', bottom:5, left:6, right:6, height:3, borderRadius:2,
                      background: info.pc.dot || '#c8b89a', opacity: info.isFuture ? 0.35 : 0.8
                    }} />
                  )}
                  {/* Log dot */}
                  {info.log && (
                    <div style={{
                      position:'absolute', top:5, right:4, width:5, height:5, borderRadius:'50%',
                      background: info.log.mood?.length > 0 ? '#88c088' : '#c8b89a'
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected day detail */}
        {selectedDay && (() => {
          const info = getCellInfo(parseInt(selectedDay.split('-')[2]))
          const log = logMap[selectedDay]
          return (
            <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-CA', { weekday:'long', month:'long', day:'numeric' })}</div>
                {info.sub && (
                  <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500, background:info.pc.bg, color:info.pc.text, border:`1px solid ${info.pc.dot}` }}>{info.sub}</span>
                )}
              </div>
              {log ? (
                <div>
                  {log.energy && <div style={{ fontSize:13, marginBottom:4 }}>Energy: <strong>{log.energy}</strong></div>}
                  {log.mood?.length > 0 && <div style={{ fontSize:13, marginBottom:4 }}>Mood: {log.mood.join(', ')}</div>}
                  {log.symptoms?.length > 0 && <div style={{ fontSize:13, marginBottom:8 }}>Symptoms: {log.symptoms.join(', ')}</div>}
                </div>
              ) : (
                <div style={{ fontSize:13, color:'#9a9590' }}>{info.isFuture ? 'Future day — no data yet' : 'No data logged for this day'}</div>
              )}
              {!info.isFuture && (
                <button onClick={() => navigate('/log')} style={{ marginTop:8, padding:'8px 16px', borderRadius:10, background:'#f5f0e8', border:'1px solid #ede8e0', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                  {log ? 'Edit log' : 'Log this day'}
                </button>
              )}
            </div>
          )
        })()}

        {/* Legend */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:16 }}>
          {isPath4 ? (
            [['Low burden','#b8e0b8'],['Moderate','#e0c060'],['High burden','#e09090'],['Not logged','#d8d0c8']].map(([l,c]) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:c }} />
                <span style={{ fontSize:11, color:'#7a7268' }}>{l}</span>
              </div>
            ))
          ) : (
            [['Menstrual','#e09898'],['Follicular','#88c088'],['Ovulatory','#88c0e0'],['Luteal','#d0a040']].map(([l,c]) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:c }} />
                <span style={{ fontSize:11, color:'#7a7268' }}>{l}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
