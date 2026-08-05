import { useState, useEffect } from 'react'
import { isNative, isHealthAvailable, connectHealth, readWearableData, healthStoreName } from '../lib/healthkit'
import { wearableCycleSignals } from '../lib/wearableCycle'

// The one-time "connect your wearable" prompt. Native only (renders nothing on web). Once
// connected it disappears — the live temperature and heart-rate readings then live inside
// Today's Focus on the dashboard, and the confirmed-ovulation signal drives the cycle phase
// everywhere (see cycleGuardian.js). Works on iOS (Apple Health) and Android (Health Connect).
export default function HealthConnect() {
  const [available, setAvailable] = useState(false)
  const [connected] = useState(() => { try { return !!localStorage.getItem('healthConnected') } catch { return false } })
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(() => { try { return !!localStorage.getItem('healthPromptDismissed') } catch { return false } })

  useEffect(() => {
    if (!isNative()) return
    isHealthAvailable().then(setAvailable)
  }, [])

  async function connect() {
    setLoading(true)
    const ok = await connectHealth()
    if (ok) {
      try { localStorage.setItem('healthConnected', '1') } catch { /* ignore */ }
      // Read once so the cycle guardian has data on the next load, then reload so the dashboard
      // re-reads and surfaces the numbers in Today's Focus.
      try {
        const data = await readWearableData()
        if (data) localStorage.setItem('wearableSignals', JSON.stringify(wearableCycleSignals(data)))
      } catch { /* ignore */ }
      window.location.reload()
      return
    }
    setLoading(false)
  }

  if (!isNative() || !available || connected || dismissed) return null
  const storeName = healthStoreName()

  return (
    <div style={{ background:'linear-gradient(135deg,#e6f0ec,#dcebf0)', border:'1px solid #bcd8cc', borderRadius:16, padding:'16px 18px', marginBottom:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:6 }}>
        <i className="ti ti-heartbeat" style={{ fontSize:20, color:'#3a8a6a' }} />
        <div style={{ fontSize:14, fontWeight:700, color:'#1f4a3a' }}>Automatic cycle tracking</div>
      </div>
      <div style={{ fontSize:13, color:'#2a4a40', lineHeight:1.6, marginBottom:12 }}>
        Connect {storeName} and Em~power reads your overnight temperature and heart rate from your Apple Watch, Oura, or other wearable to <strong>track your cycle automatically</strong>, no daily logging needed. Set it up once and it keeps syncing every day.
      </div>
      <button onClick={connect} disabled={loading} style={{ width:'100%', padding:'12px', borderRadius:12, background:'#2c2820', color:'#f5f0e8', border:'none', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', marginBottom:8 }}>
        {loading ? 'Connecting…' : `Connect ${storeName}`}
      </button>
      <button onClick={() => { try { localStorage.setItem('healthPromptDismissed', '1') } catch { /* ignore */ } ; setDismissed(true) }} style={{ width:'100%', background:'none', border:'none', fontSize:12, color:'#6a7a70', cursor:'pointer', fontFamily:'inherit' }}>Maybe later</button>
    </div>
  )
}
