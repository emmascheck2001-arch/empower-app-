import { useState, useEffect } from 'react'
import { isNative, isHealthAvailable, connectHealth, readWearableData, healthStoreName } from '../lib/healthkit'
import { wearableCycleSignals } from '../lib/wearableCycle'
import { getUserLocal, setUserLocal } from '../lib/userLocalState'

// The one-time "connect your wearable" prompt. Native only (renders nothing on web). Once
// connected it disappears — the live temperature and heart-rate readings then live inside
// Today's Focus on the dashboard, and the confirmed-ovulation signal drives the cycle phase
// everywhere (see cycleGuardian.js). Works on iOS (Apple Health) and Android (Health Connect).
export default function HealthConnect({ userId }) {
  const [available, setAvailable] = useState(false)
  const [connected] = useState(() => !!getUserLocal(userId, 'healthConnected'))
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(() => !!getUserLocal(userId, 'healthPromptDismissed'))
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!isNative()) return
    isHealthAvailable().then(setAvailable)
  }, [])

  async function connect() {
    setLoading(true)
    const ok = await connectHealth()
    if (ok) {
      try {
        const data = await readWearableData()
        if (data?.hasAnyData) {
          setUserLocal(userId, 'healthConnected', '1')
          setUserLocal(userId, 'wearableSignals', JSON.stringify(wearableCycleSignals(data)))
          window.location.reload()
          return
        }
      } catch { /* ignore */ }
      setMessage(`No readable data was found. Check that Em~power has permission in ${healthStoreName()} and that your device has recorded health data, then try again.`)
    } else {
      setMessage(`Could not connect to ${healthStoreName()}. Please try again.`)
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
        Connect {storeName} and Em~power can read overnight temperature and heart rate from a supported wearable. It refreshes when you open the app and uses available readings to support cycle estimates.
      </div>
      {message && <div style={{ fontSize:12, color:'#8a4a32', lineHeight:1.5, marginBottom:10 }}>{message}</div>}
      <button onClick={connect} disabled={loading} style={{ width:'100%', padding:'12px', borderRadius:12, background:'#2c2820', color:'#f5f0e8', border:'none', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', marginBottom:8 }}>
        {loading ? 'Connecting…' : `Connect ${storeName}`}
      </button>
      <button onClick={() => { setUserLocal(userId, 'healthPromptDismissed', '1'); setDismissed(true) }} style={{ width:'100%', background:'none', border:'none', fontSize:12, color:'#6a7a70', cursor:'pointer', fontFamily:'inherit' }}>Maybe later</button>
    </div>
  )
}
