// AccuracyScorecard — the app grading its own predictions, in the open.
//
// The confidence number on this app measures how personalised the model is; it only ever
// climbs, so it can never tell her whether the predictions are actually GOOD. This card can,
// because predictionAccuracy.js backtests every past cycle: predict it using only the cycles
// before it, then compare to what really happened.
//
// It is also the honest version of a "score": the app is not asking her to trust it, it is
// showing its record — including the misses. If the record is bad, this card says so.
export default function AccuracyScorecard({ backtest, summary, onOpen }) {
  if (!backtest || !summary) return null

  const insufficient = backtest.status !== 'ok'
  return (
    <div onClick={onOpen} style={{
      cursor: onOpen ? 'pointer' : 'default', marginBottom: 12,
      border: '1px solid #e0dcd2', background: '#fff', borderRadius: 16, padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <i className="ti ti-target-arrow" style={{ fontSize: 16, color: '#7a6a5a' }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a6a5a' }}>
          How I am doing
        </span>
      </div>

      <div style={{ fontSize: 17, fontWeight: 600, color: '#2c2820', marginBottom: 6 }}>
        {summary.headline}
      </div>
      <div style={{ fontSize: 13, color: '#5a5248', lineHeight: 1.6 }}>
        {summary.detail}
      </div>

      {!insufficient && (
        <>
          {/* Every scored cycle as a dot: filled = landed within 2 days, hollow = a miss.
              Showing the misses is the point — a scorecard that only showed hits would be
              marketing, not a scorecard. */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {backtest.scored.slice(-12).map((s, i) => {
              const hit = Math.abs(s.errorDays) <= 2
              return (
                <span key={i} title={`${s.date}: ${s.errorDays === 0 ? 'exact' : `${Math.abs(s.errorDays)} day${Math.abs(s.errorDays) === 1 ? '' : 's'} ${s.errorDays > 0 ? 'late' : 'early'}`}`}
                  style={{
                    width: 11, height: 11, borderRadius: '50%',
                    background: hit ? '#7a9a6a' : 'transparent',
                    border: `1.5px solid ${hit ? '#7a9a6a' : '#c8b89a'}`,
                  }} />
              )
            })}
            <span style={{ fontSize: 11.5, color: '#9a9590', marginLeft: 4 }}>{summary.scoreLine}</span>
          </div>
        </>
      )}
    </div>
  )
}
