// route /privacy — privacy policy. Accessible without auth.
import TopBar from '../components/TopBar'

export default function Privacy() {
  return (
    <>
      <TopBar title="Em~power" backTo={-1} />
      <div className="page">
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ fontSize: 12, color: '#9a9590', marginBottom: 24 }}>Last updated June 2026</p>

        <div style={{ background: '#f5f0e8', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>Your health data is yours. Em~power does not sell it, share it, or use it for advertising. Ever.</p>
        </div>

        {[
          { title: 'Who we are', body: 'Em~power is a women\'s hormone-based fitness and wellness app developed by Emma Scheck, based in Canada.' },
          { title: 'What we collect', body: 'Cycle data, daily logs, mood, symptoms, biometrics, and workout data you enter manually. We do not collect location data or contacts.' },
          { title: 'How we use your data', body: 'Only to power your personal recommendations inside the app. Never sold. Never used for advertising. Never used to train external AI models.' },
          { title: 'Where it is stored', body: 'Supabase (AWS infrastructure). Row-level security means only you can see your data.' },
          { title: 'Your rights', body: 'You can access, correct, or delete your data at any time. Email us to request this. We respond within 30 days.' },
          { title: 'Health data', body: 'Em~power is a wellness tracking app, not a medical device. Nothing here is medical advice. Always consult a healthcare provider for medical decisions.' },
          { title: 'Contact', body: 'Emma Scheck — emmascheck2001@gmail.com' },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 24 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>{s.title}</div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: '#3a3530' }}>{s.body}</p>
          </div>
        ))}
      </div>
    </>
  )
}
