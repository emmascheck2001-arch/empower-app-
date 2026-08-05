// route /terms. Terms of Use. Public (no auth), like /privacy. Plain-English; covers the
// not-medical-advice / not-a-medical-device position, assumption of risk, "as is" pilot status,
// limitation of liability, and Saskatchewan/Canada governing law. Not legal advice; for a public
// launch a lawyer should review. Linked from the signup form, the setup consent, and the dashboard footer.
import { useNavigate } from 'react-router-dom'
import { SUPPORT_EMAIL } from '../lib/appConfig'
import TopBar from '../components/TopBar'

export default function Terms() {
  const navigate = useNavigate()
  return (
    <>
      <TopBar title="Em~power" backTo={-1} />
      <div className="page">
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Terms of Use</h1>
        <p style={{ fontSize: 12, color: '#9a9590', marginBottom: 24 }}>Last updated June 2026</p>

        <div style={{ background: '#f5f0e8', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>Em~power is a wellness and education app, not medical care. It does not diagnose, treat, or prevent anything, and it is not a method of contraception. Always talk to a healthcare professional for medical decisions, and call your local emergency number in an emergency.</p>
        </div>

        {[
          { title: 'Agreeing to these terms', body: 'By creating an account or using Em~power, you agree to these Terms of Use and to our Privacy Policy. If you do not agree, please do not use the app.' },
          { title: 'Who can use Em~power', body: 'You must be at least 13 years old to use Em~power. If you are under 18, we ask that you use it with a parent or guardian\'s awareness.' },
          { title: 'What Em~power is', body: 'Em~power is a wellness and educational tool that helps you track and understand your cycle, hormones, training, sleep, and nutrition. Everything it shows you is for general wellness and education, and is meant to help you understand your own body and have better conversations with your healthcare providers.' },
          { title: 'What Em~power is not', body: 'Em~power is not a medical device and is not a substitute for professional medical advice, diagnosis, or treatment. Using it does not create a doctor, patient relationship. It is not a method of contraception and cannot be relied on to prevent or plan a pregnancy. Always seek the advice of a qualified healthcare professional with any questions about your health, and never disregard or delay professional advice because of something you read in the app.' },
          { title: 'Emergencies', body: 'Em~power is not for emergencies. If you think you may have a medical emergency, contact your local emergency services immediately. If you are in crisis or struggling with your mental health, call or text 988, the Suicide and Crisis Lifeline, available 24/7 in Canada and the US.' },
          { title: 'This is an early version', body: 'Em~power is an early-stage app provided on an "as is" and "as available" basis. It may contain errors or inaccuracies, may change over time, and may be unavailable at times. To the extent permitted by law, we make no warranties of any kind, whether express or implied.' },
          { title: 'Your responsibility', body: 'You use Em~power at your own risk and remain responsible for your own health and lifestyle decisions. Any action you take based on the app, including changes to exercise, nutrition, supplements, or medication, is your responsibility and should be discussed with a healthcare professional first.' },
          { title: 'Limitation of liability', body: 'To the fullest extent permitted by law, Em~power and its creator are not liable for any direct, indirect, incidental, or consequential damages arising from your use of, or inability to use, the app, including any reliance you place on the information it provides.' },
          { title: 'No guarantee of accuracy', body: 'We do not warrant that any information, prediction, phase, or recommendation in Em~power is accurate, complete, or suitable for you. Cycle predictions, fertile-window estimates, and phase calculations are estimates only and are frequently wrong for any individual. Never rely on them as fact, or for any medical, contraceptive, or family-planning decision.' },
          { title: 'Indemnity', body: 'You agree to indemnify and hold harmless Em~power and the people behind it from any claims, damages, or costs arising out of your misuse of the app, your violation of these Terms, or your reliance on the app in place of professional advice.' },
          { title: 'Your account', body: 'Keep your password secure and do not share your account with others. You are responsible for activity that happens under your account.' },
          { title: 'Your data and privacy', body: 'Your data is handled as described in our Privacy Policy. You can access, correct, or permanently delete all of your data yourself at any time from the Privacy page.' },
          { title: 'Changes', body: 'We may update these Terms or the app from time to time. If you keep using Em~power after a change, that means you accept the updated Terms.' },
          { title: 'Governing law', body: 'These Terms are governed by the laws of the Province of Saskatchewan and the federal laws of Canada that apply there.' },
          { title: 'Severability', body: 'If any part of these Terms is found unenforceable, the rest stay in full effect, and any limitation that cannot apply in full will apply to the maximum extent the law allows.' },
          { title: 'Entire agreement', body: 'These Terms, together with the Privacy Policy, are the entire agreement between you and Em~power about your use of the app.' },
          { title: 'Contact', body: `Questions about these Terms? Email us at ${SUPPORT_EMAIL}.` },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 24 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>{s.title}</div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: '#3a3530' }}>{s.body}</p>
          </div>
        ))}

        <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', fontSize: 13, color: '#c8b89a', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 32 }}>
          Read the Privacy Policy →
        </button>
      </div>
    </>
  )
}
