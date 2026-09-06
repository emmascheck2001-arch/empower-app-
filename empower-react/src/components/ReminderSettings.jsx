// The opt-in surface for reminders. Renders on native only — the web/PWA build has no local
// notification support, so showing the control there would promise something it cannot deliver.
//
// Used in two places: as a dashboard card (for users who are already in), and inside onboarding
// (where intent is highest and the ask is cheapest).
import { useEffect, useState } from 'react'
import {
  notificationsSupported, getNotificationPermission, requestNotificationPermission,
  refreshNotifications, cancelAllNotifications,
} from '../lib/notifications'
import { supabase } from '../lib/supabase'
import { getUserLocal, setUserLocal } from '../lib/userLocalState'
import { track } from '../lib/analytics'
import { notificationPrefs } from '../lib/reminderSettings'
import { saveUserSettings } from '../lib/userSettings'

const pad = n => String(n).padStart(2, '0')

export default function ReminderSettings({ userId, status, variant = 'card' }) {
  const [supported] = useState(() => notificationsSupported())
  const [prefs, setPrefs] = useState(() => notificationPrefs(userId))
  const [perm, setPerm] = useState('prompt')
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(() => getUserLocal(userId, 'notifyPromptDismissed') === '1')

  useEffect(() => {
    if (!supported) return
    getNotificationPermission().then(setPerm)
  }, [supported])

  if (!supported) return null
  // Once she has said no at the OS level there is nothing more to ask for; don't nag.
  if (perm === 'denied' && !prefs.enabled) return null
  if (variant === 'card' && !prefs.enabled && dismissed) return null

  const on = prefs.enabled && perm === 'granted'

  async function enable() {
    setBusy(true)
    try {
      const granted = perm === 'granted' ? true : await requestNotificationPermission()
      setPerm(granted ? 'granted' : 'denied')
      if (!granted) { track('reminders_denied', {}); return }
      const next = { ...prefs, enabled: true }
      setUserLocal(userId, 'notifyEnabled', '1')
      setUserLocal(userId, 'notifyHour', next.hour)
      setUserLocal(userId, 'notifyMinute', next.minute)
      setPrefs(next)
      await saveUserSettings(supabase, userId, {
        notifyEnabled: true,
        notifyHour: next.hour,
        notifyMinute: next.minute,
        notifyPromptDismissed: false,
      })
      await refreshNotifications(next, status)
      track('reminders_enabled', { hour: next.hour })
    } finally { setBusy(false) }
  }

  async function disable() {
    setBusy(true)
    try {
      setUserLocal(userId, 'notifyEnabled', '0')
      setPrefs(p => ({ ...p, enabled: false }))
      await saveUserSettings(supabase, userId, { notifyEnabled: false })
      await cancelAllNotifications()
      track('reminders_disabled', {})
    } finally { setBusy(false) }
  }

  async function changeTime(value) {
    const [h, m] = value.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return
    const next = { ...prefs, hour: h, minute: m }
    setUserLocal(userId, 'notifyHour', h)
    setUserLocal(userId, 'notifyMinute', m)
    setPrefs(next)
    await saveUserSettings(supabase, userId, { notifyHour: h, notifyMinute: m })
    if (next.enabled && perm === 'granted') await refreshNotifications(next, status)
  }

  function dismiss() {
    setUserLocal(userId, 'notifyPromptDismissed', '1')
    saveUserSettings(supabase, userId, { notifyPromptDismissed: true })
    setDismissed(true)
    track('reminders_dismissed', {})
  }

  const wrap = variant === 'onboarding'
    ? { background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16, marginBottom:16 }
    : { background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16, marginBottom:12 }

  return (
    <div style={wrap}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <i className="ti ti-bell" aria-hidden="true" style={{ fontSize:20, color:'#c8b89a', marginTop:2 }} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:600, color:'#2c2820', marginBottom:4 }}>
            {on ? 'Reminders are on' : 'Get a nudge to check in'}
          </div>
          <div style={{ fontSize:13, color:'#7a7268', lineHeight:1.55 }}>
            {on
              ? 'A daily check-in nudge, plus a heads-up when your period is estimated to be close.'
              : 'One quiet daily nudge, and a heads-up two days before your period is estimated to start. You can turn this off any time.'}
          </div>

          {on && (
            <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:10 }}>
              <label htmlFor="reminderTime" style={{ fontSize:12, color:'#9a9590' }}>Daily at</label>
              <input id="reminderTime" type="time" value={`${pad(prefs.hour)}:${pad(prefs.minute)}`}
                onChange={e => changeTime(e.target.value)}
                style={{ padding:'8px 10px', borderRadius:10, border:'1px solid #ede8e0', fontSize:14, fontFamily:'inherit', background:'#fff', color:'#2c2820' }} />
            </div>
          )}

          <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
            {!on && (
              <button type="button" onClick={enable} disabled={busy}
                style={{ padding:'11px 16px', borderRadius:12, border:'none', background:'#2c2820', color:'#f5f0e8', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
                {busy ? 'Just a moment...' : 'Turn on reminders'}
              </button>
            )}
            {!on && variant === 'card' && (
              <button type="button" onClick={dismiss}
                style={{ padding:'11px 14px', borderRadius:12, border:'1px solid #ede8e0', background:'#fff', color:'#7a7268', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Not now
              </button>
            )}
            {on && (
              <button type="button" onClick={disable} disabled={busy}
                style={{ padding:'9px 14px', borderRadius:12, border:'1px solid #ede8e0', background:'#fff', color:'#7a7268', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Turn off
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
