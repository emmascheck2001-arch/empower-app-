// FriendsActivity — the Friends feature, surfaced.
//
// The friendships table, the visibility flags and the get_friend_card function all already
// existed, but Friends lived entirely on its own screen, so in practice it did nothing. This
// brings the accepted friends onto the home screen as a quiet row: where each of them is in
// her cycle, nothing more.
//
// PRIVACY: this renders ONLY what get_friend_card returns, which is already gated on an
// accepted friendship in both directions and on that friend's own visibility flags. Never
// query another user's daily_logs directly from here, and never add a field the card does
// not already return.
const DOT = {
  Menstrual: '#c05858', Follicular: '#6a9a5a', Ovulatory: '#5a8aaa',
  Luteal: '#c8a05a', Perimenopause: '#9a6aaa', bc: '#7a8a9a',
}

export default function FriendsActivity({ friends, pending, onOpen }) {
  const list = (friends || []).filter(Boolean)
  if (!list.length && !pending) return null

  return (
    <div onClick={onOpen} style={{
      cursor: 'pointer', marginBottom: 12,
      border: '1px solid #e0dcd2', background: '#fff', borderRadius: 16, padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: list.length ? 12 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-users" style={{ fontSize: 16, color: '#7a7268' }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7268' }}>
            Your people
          </span>
        </div>
        {pending > 0 && (
          <span style={{ fontSize: 11.5, color: '#c05858', fontWeight: 600 }}>{pending} request{pending === 1 ? '' : 's'}</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.slice(0, 4).map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: DOT[f.phase] || '#c8b89a', flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, color: '#2c2820', fontWeight: 500 }}>{f.name || 'Friend'}</span>
            <span style={{ fontSize: 12.5, color: '#7a7268' }}>{f.phase === 'bc' ? 'on birth control' : `${String(f.phase || '').toLowerCase()} phase`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
