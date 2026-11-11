import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isNative, isHealthAvailable, connectHealth, readWearableData, healthStoreName } from '../lib/healthkit'
import { wearableCycleSignals } from '../lib/wearableCycle'
import { getUserSetting, saveUserSettings } from '../lib/userSettings'

// The one-time "connect your wearable" prompt. Native only (renders nothing on web). Once
// connected it disappears — the live temperature and heart-rate readings then live inside
// Today's Focus on the dashboard, and the confirmed-ovulation signal drives the cycle phase
// everywhere (see cycleGuardian.js). Works on iOS (Apple Health) and Android (Health Connect).
export default function HealthConnect({ userId }) {
  const [available, setAvailable] = useState(false)
  const [connected] = useState(() => !!getUserSetting(userId, 'healthConnected'))
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(() => !!getUserSetting(userId, 'healthPromptDismissed'))
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
          await saveUserSettings(supabase, userId, {
            healthConnected: true,
            wearableSignals: wearableCycleSignals(data),
          })
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
    <div style={{ background:'#f2f7f4', border:'1px solid #cfe1d8', borderRadius:14, padding:'13px 14px', marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:4 }}>
        <i className="ti ti-heartbeat" style={{ fontSize:20, color:'#3a8a6a' }} />
        <div style={{ fontSize:14, fontWeight:700, color:'#1f4a3a' }}>Automatic cycle tracking</div>
      </div>
      <div style={{ fontSize:12.5, color:'#2a4a40', lineHeight:1.5, marginBottom:10 }}>
        Optionally connect {storeName} to use overnight temperature and heart-rate readings in your cycle estimates.
      </div>
      {message && <div style={{ fontSize:12, color:'#8a4a32', lineHeight:1.5, marginBottom:10 }}>{message}</div>}
      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <button onClick={connect} disabled={loading} style={{ padding:'9px 12px', borderRadius:10, background:'#2c2820', color:'#f5f0e8', border:'none', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          {loading ? 'Connecting…' : `Connect ${storeName}`}
        </button>
        <button onClick={() => { saveUserSettings(supabase, userId, { healthPromptDismissed: true }); setDismissed(true) }} style={{ background:'none', border:'none', fontSize:12, color:'#6a7a70', cursor:'pointer', fontFamily:'inherit' }}>Not now</button>
      </div>
    </div>
  )
}
