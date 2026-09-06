// NotificationSettings — the opt-in card. Native only; renders nothing on web.
//
// Deliberately states exactly what she is agreeing to, including the cap. An app that asks
// permission to interrupt someone about their own body owes them the specifics up front, and
// "at most three a week" is a promise the plan enforces in code (MAX_PER_WEEK).
import { useState } from 'react'
import { isNative, notificationsEnabled, enableNotifications, disableNotifications } from '../lib/notifications'
import { MAX_PER_WEEK } from '../lib/notificationPlan'
import { track } from '../lib/analytics'

export default function NotificationSettings({ status, streak, loggedToday }) {
  // Read the stored preference during initialisation rather than in an effect, so the toggle
  // never renders in the wrong position for a frame.
  const [on, setOn] = useState(() => notificationsEnabled())
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)

  if (!isNative()) return null

  async function toggle() {
    setBusy(true); setDenied(false)
    if (on) {
      await disableNotifications(); setOn(false)
      track('notification_disabled', {})
    } else {
      const granted = await enableNotifications(status, { streak, loggedToday })
      setOn(granted); setDenied(!granted)
      // Records the DENIAL too — a permission prompt that gets refused is a different
      // problem from one that never gets shown, and the old analytics could tell neither.
      track('notification_enabled', { granted })
    }
    setBusy(false)
  }

  return (
    <div style={{ marginBottom: 12, border: '1px solid #e0dcd2', background: '#fff', borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <i className="ti ti-bell" style={{ fontSize: 16, color: '#7a7268' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7268' }}>Reminders</span>
          </div>
          <div style={{ fontSize: 13, color: '#5a5248', lineHeight: 1.6 }}>
            {on
              ? `On. At most ${MAX_PER_WEEK} a week: a heads up before day 1, a gentle nudge only if you already have a streak going, and your Sunday recap.`
              : `A heads up before day 1, a nudge only if you already have a streak going, and your Sunday recap. At most ${MAX_PER_WEEK} a week, worded so nothing private shows on your lock screen.`}
          </div>
          {denied && (
            <div style={{ fontSize: 12, color: '#a83a20', marginTop: 8, lineHeight: 1.5 }}>
              iOS did not grant permission. You can turn it on in Settings → Notifications → Em~power.
            </div>
          )}
        </div>
        <div onClick={busy ? undefined : toggle} style={{
          width: 44, height: 26, borderRadius: 13, background: on ? '#2c2820' : '#d8d0c8',
          position: 'relative', cursor: busy ? 'default' : 'pointer', transition: 'background .2s',
          flexShrink: 0, opacity: busy ? 0.6 : 1,
        }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: 3, transition: 'transform .2s', transform: on ? 'translateX(18px)' : 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </div>
      </div>
    </div>
  )
}
