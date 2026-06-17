// Shared medical/liability disclaimer. Default copy covers the general wellness-app
// position; pass children to tailor it for a specific screen (e.g. supplements, exercise).
export default function Disclaimer({ children }) {
  return (
    <div style={{ fontSize: 11, color: '#9a9590', lineHeight: 1.6, padding: '16px 18px 8px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
      {children || 'Em~power is a wellness app, not a medical device, and nothing here is medical advice. Always consult a qualified healthcare professional before changing your exercise, nutrition, supplements, or medication. Em~power does not prevent pregnancy and is not a method of contraception.'}
    </div>
  )
}
