import { useState } from 'react'

// One-time goal picker shown the first time a user opens the Workout tab. Wellness-framed
// (supportive, never diet-culture shame) because this is a women's wellness app. The choice
// is stored locally and later shapes the cycle-aware plans. Persisted in localStorage for now
// (no DB migration needed to validate the feature); can move to a profiles column later.
export const FITNESS_GOALS = [
  { val:'feel_better', icon:'ti-mood-heart',    title:'Feel better day to day',  sub:'More energy, steadier mood' },
  { val:'strength',    icon:'ti-barbell',       title:'Build strength & muscle', sub:'Get stronger, feel capable' },
  { val:'consistency', icon:'ti-calendar-check', title:'Move more consistently',  sub:'Build the habit, any movement counts' },
  { val:'cycle_health', icon:'ti-heart',         title:'Support my cycle & hormones', sub:'Work with your body, not against it' },
  { val:'weight',      icon:'ti-flame',         title:'Manage my weight healthily', sub:'Sustainable, no crash diets' },
  { val:'destress',    icon:'ti-yoga',          title:'Reduce stress & feel calmer', sub:'Movement for your mind too' },
]

export function getFitnessGoal() {
  try { return localStorage.getItem('fitnessGoal') || null } catch { return null }
}

export default function GoalPicker({ onDone }) {
  const [show, setShow] = useState(() => !getFitnessGoal())
  if (!show) return null

  const pick = (v) => {
    try { localStorage.setItem('fitnessGoal', v) } catch { /* ignore */ }
    setShow(false)
    if (onDone) onDone(v)
  }

  return (
    <>
      <div style={{ position:'fixed', inset:0, background:'rgba(44,40,32,0.45)', zIndex:300 }} />
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:420, background:'#faf8f5', borderRadius:'20px 20px 0 0', zIndex:301, padding:'18px 20px 40px', maxHeight:'88vh', overflowY:'auto' }}>
        <div style={{ width:36, height:4, background:'#c8b89a', borderRadius:2, margin:'0 auto 18px' }} />
        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:22, marginBottom:6, color:'#2c2820' }}>What brings you here?</div>
        <div style={{ fontSize:13, color:'#7a7268', lineHeight:1.6, marginBottom:18 }}>
          Pick what matters most right now. We&apos;ll shape your movement around it and around your cycle, and you can change it anytime.
        </div>
        {FITNESS_GOALS.map(g => (
          <button key={g.val} onClick={() => pick(g.val)} style={{ width:'100%', display:'flex', alignItems:'center', gap:14, background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:'14px 16px', marginBottom:10, cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
            <div style={{ width:42, height:42, borderRadius:12, background:'#f0ece2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <i className={`ti ${g.icon}`} style={{ fontSize:21, color:'#8a7a5a' }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:600, color:'#2c2820' }}>{g.title}</div>
              <div style={{ fontSize:12.5, color:'#7a7268', marginTop:1 }}>{g.sub}</div>
            </div>
            <i className="ti ti-chevron-right" style={{ fontSize:18, color:'#c8b89a', flexShrink:0 }} />
          </button>
        ))}
      </div>
    </>
  )
}
