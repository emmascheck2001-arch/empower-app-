// ProgressLedger — what she is actually working toward, instead of a bare streak number.
//
// Every real payoff in this app is gated behind a threshold (8 energy logs for the cycle
// story, 2 tracked cycles for Looking Ahead, and so on) and NONE of them were ever shown.
// She was logging into a locked door with no sign on it. A streak counts days; it does not
// tell you what the days are for — and it punishes a missed day, which this never does.
//
// Everything here comes from unlocks.js, which mirrors the engines' real thresholds.
export default function ProgressLedger({ unlocks, next, streak }) {
  if (!unlocks?.length) return null
  const locked = unlocks.filter(u => !u.unlocked).slice(0, 3)
  const unlockedCount = unlocks.filter(u => u.unlocked).length

  return (
    <div style={{ marginBottom: 12, border: '1px solid #e0dcd2', background: '#fff', borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-lock-open" style={{ fontSize: 16, color: '#6a8a5a' }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6a8a5a' }}>
            What you are building
          </span>
        </div>
        {streak > 0 && (
          <span style={{ fontSize: 11.5, color: '#9a9590' }}>{streak} day{streak === 1 ? '' : 's'} in a row</span>
        )}
      </div>

      {next && (
        <div style={{ fontSize: 15, fontWeight: 600, color: '#2c2820', marginBottom: 12, lineHeight: 1.45 }}>
          {next.line}.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {locked.map(u => (
          <div key={u.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: '#3a352c', fontWeight: 500 }}>{u.title}</span>
              <span style={{ fontSize: 11.5, color: '#9a9590', flexShrink: 0 }}>{u.have} of {u.need}</span>
            </div>
            <div style={{ height: 5, background: '#f0ece4', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(u.progress * 100)}%`, background: '#a8bd98', borderRadius: 3, transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: 11.5, color: '#9a9590', marginTop: 4, lineHeight: 1.45 }}>{u.what}</div>
          </div>
        ))}
      </div>

      {unlockedCount > 0 && (
        <div style={{ fontSize: 11.5, color: '#6a8a5a', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-check" style={{ fontSize: 13 }} />
          {unlockedCount} already unlocked
        </div>
      )}
    </div>
  )
}
