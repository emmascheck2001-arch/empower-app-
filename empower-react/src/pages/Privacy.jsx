// route /privacy, privacy policy + self-serve account/data deletion. Accessible without auth;
// the delete control only appears for signed-in users.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SUPPORT_EMAIL, APP_OWNER } from '../lib/appConfig'
import TopBar from '../components/TopBar'
import { clearUserLocalState } from '../lib/userLocalState'
import { clearWatchPlan } from '../lib/watchBridge'

export default function Privacy() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null)).catch(() => {})
  }, [])

  async function deleteEverything() {
    setDeleting(true); setErr(null)
    try {
      const { error } = await supabase.rpc('delete_my_account')
      if (error) throw error
      clearUserLocalState(user.id)
      await clearWatchPlan()
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } catch {
      setErr(`Something went wrong. Please email ${SUPPORT_EMAIL} and we will delete it for you right away.`)
      setDeleting(false)
    }
  }

  return (
    <>
      <TopBar title="Em~power" backTo={-1} />
      <div className="page">
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ fontSize: 12, color: '#9a9590', marginBottom: 24 }}>Last updated June 2026</p>

        <div style={{ background: '#f5f0e8', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>Your health data is yours. Em~power does not sell it or use it for advertising. You can choose to share specific friend-card fields with an accepted friend, and those fields are off by default. You can turn sharing off or delete your data at any time.</p>
        </div>

        {[
          { title: 'Who we are', body: `Em~power is a women's hormone-based fitness and wellness app developed and operated by ${APP_OWNER}, based in Canada.` },
          { title: 'What we collect', body: 'Cycle data, daily logs, mood, symptoms, biometrics, and workout data you enter manually. Optionally, your birth year and ethnicity, used only to show you the health information most relevant to you. Ethnicity is sensitive and entirely optional. We also record basic in-app usage events (for example, that a workout was logged or a screen was opened) so we can improve the app. We do not collect location data or contacts.' },
          { title: 'Health and fitness data from Apple Health / Health Connect', body: 'If you choose to connect Apple Health (iPhone) or Health Connect (Android), Em~power reads a limited set of health data to track your cycle automatically: resting heart rate, heart rate variability, overnight wrist or body temperature, sleep, and workouts. Access is read-only — we never write anything back to Apple Health or Health Connect. This is optional, you control it in your phone settings, and today’s readings are saved to your account (on our Supabase database) alongside your other health data so the app can use them. Health data is never sold, never used for advertising, and never used to train AI models.' },
          { title: 'How we use your data', body: 'Your health data is used only to power your personal recommendations inside the app. Usage events are used only to understand how the app is used and to fix and improve it. Never sold. Never used for advertising. Never used to train external AI models.' },
          { title: 'Sharing with friends and our team', body: 'Other users cannot see your health logs. If you accept a friend request, you may separately opt in to sharing selected friend-card fields such as an estimated phase, streak, sleep rating, or workout feel; all sharing toggles start off and can be withdrawn. Inside the app, the team can see feedback you choose to send. Usage events are linked to your account so we can support you and fix problems; we review them in aggregate and do not use them to browse individual health entries. All of it is deleted when you delete your account.' },
          { title: 'Where it is stored', body: 'Supabase (AWS infrastructure). Row-level security means only you can access your own data.' },
          { title: 'Security', body: 'Your data is encrypted in transit and at rest, and row-level security ensures no other user can read it. No system is perfectly secure, but if a breach ever affected your data we would act promptly and notify you as required by law.' },
          { title: 'What we keep and for how long', body: 'We collect only what the app needs to work, keep it only while your account is active, and delete it when you delete your account. Sensitive fields such as ethnicity are always optional. We do not sell your data, and we would only ever disclose it if strictly required by a valid legal order.' },
          { title: 'Your rights', body: 'You can access, correct, or delete your data at any time. You can permanently delete your entire account and all your data yourself using the button below, or email us and we will respond within 30 days.' },
          { title: 'Medical disclaimer', body: 'Em~power is a wellness and education app, not a medical device, and nothing in it is medical advice, diagnosis, treatment, or contraception. Always consult a qualified healthcare professional before changing your exercise, nutrition, supplements, or medication, and before starting or changing an exercise program, especially if you are pregnant, postpartum, injured, or managing a health condition. Stop and seek care if you feel unwell. Any fertility or ovulation information is an estimate for awareness only and must never be used to prevent or plan a pregnancy.' },
          { title: 'Contact', body: `Questions or requests about your data? Email us at ${SUPPORT_EMAIL}.` },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 24 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>{s.title}</div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: '#3a3530' }}>{s.body}</p>
          </div>
        ))}

        <button onClick={() => navigate('/terms')} style={{ background: 'none', border: 'none', fontSize: 13, color: '#c8b89a', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 24 }}>
          Read the Terms of Use →
        </button>

        {user && (
          <div style={{ marginTop: 8, marginBottom: 40, padding: 16, background: '#fdf0f0', border: '1px solid #f0d8d8', borderRadius: 12 }}>
            <div className="section-label" style={{ marginBottom: 8, color: '#8a3020' }}>Delete everything</div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: '#5a2a28', marginBottom: 12 }}>
              Permanently delete your account and every piece of data you have ever logged. This happens immediately and cannot be undone.
            </p>
            {err && <p style={{ fontSize: 13, color: '#c05858', marginBottom: 10, lineHeight: 1.6 }}>{err}</p>}
            {!confirming ? (
              <button onClick={() => setConfirming(true)}
                style={{ width: '100%', padding: 13, borderRadius: 10, border: '1px solid #c05858', background: '#fff', color: '#c05858', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Delete my account and all my data
              </button>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: '#5a2a28', marginBottom: 10, fontWeight: 600, lineHeight: 1.6 }}>Are you sure? This erases your account and everything in it, permanently.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={deleteEverything} disabled={deleting}
                    style={{ flex: 1, padding: 13, borderRadius: 10, border: 'none', background: '#c05858', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {deleting ? 'Deleting...' : 'Yes, delete everything'}
                  </button>
                  <button onClick={() => setConfirming(false)} disabled={deleting}
                    style={{ flex: 1, padding: 13, borderRadius: 10, border: '1px solid #ede8e0', background: '#fff', color: '#7a7268', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
