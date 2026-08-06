// route /privacy, privacy policy + self-serve account/data deletion. Accessible without auth;
// the delete control only appears for signed-in users.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SUPPORT_EMAIL, APP_OWNER } from '../lib/appConfig'
import TopBar from '../components/TopBar'

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
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>Your health data is yours. Em~power does not sell it, share it, or use it for advertising. Ever. And you can delete all of it yourself, any time.</p>
        </div>

        {[
          { title: 'Who we are', body: `Em~power is a women's hormone-based fitness and wellness app developed and operated by ${APP_OWNER}, based in Canada.` },
          { title: 'What we collect', body: 'Cycle data, daily logs, mood, symptoms, biometrics, and workout data you enter manually. Optionally, your birth year and ethnicity, used only to show you the health information most relevant to you. Ethnicity is sensitive and entirely optional. We do not collect location data or contacts.' },
          { title: 'How we use your data', body: 'Only to power your personal recommendations inside the app. Never sold. Never used for advertising. Never used to train external AI models.' },
          { title: 'What our team can and cannot see', body: 'Other users can never see your data. Inside the app, the team can only see the feedback you choose to send us. We do not browse your individual health logs. To improve the app we only ever look at anonymous, aggregate usage (like how many people logged a workout), never your personal data tied to your name.' },
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
