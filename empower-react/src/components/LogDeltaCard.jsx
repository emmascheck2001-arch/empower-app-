// LogDeltaCard — "here is what your log just changed", shown the moment she saves.
//
// This is the reward for logging. Before it existed, saving showed a single confidence
// percentage that on most days had not moved, which quietly taught her that logging did
// nothing. Now every save either names something that changed or says plainly that today
// confirmed the existing pattern — which is a real outcome, not a consolation prize.
//
// The card renders ONLY what buildLogDelta produced. It must never add a change of its own,
// and it must never dress a no-change day up as a change. (See logDelta.js honesty rules.)
import { confirmationLine } from '../lib/logDelta'

export default function LogDeltaCard({ delta, savedPct }) {
  if (!delta) {
    return (
      <div style={{ fontSize: 14, color: '#5a5248', lineHeight: 1.6, textAlign: 'center' }}>
        {savedPct != null
          ? `Your algorithm is now ${savedPct}% personalised to you.`
          : 'Your data is helping the algorithm learn your pattern.'}
      </div>
    )
  }

  if (delta.confirmed) {
    return (
      <div style={{ fontSize: 13.5, color: '#5a5248', lineHeight: 1.65, textAlign: 'center' }}>
        {confirmationLine()}
        {savedPct != null && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#9a9590' }}>
            Still {savedPct}% personalised to you.
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#7a7268', marginBottom: 10, textAlign: 'center' }}>
        What that changed
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {delta.changes.map((c, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '11px 13px', borderRadius: 11,
            background: c.kind === 'unlock' ? '#f0f6ef' : c.kind === 'score' ? '#f4f0f8' : '#f5f0e8',
            border: `1px solid ${c.kind === 'unlock' ? '#d6e6d4' : c.kind === 'score' ? '#e2d8ee' : '#ece5d8'}`,
          }}>
            <i className={`ti ${c.icon}`} style={{ fontSize: 15, color: '#7a7268', marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: '#3a352c', lineHeight: 1.5 }}>{c.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
