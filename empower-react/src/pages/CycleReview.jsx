// route /cycle-review — "Your cycle in review".
//
// WHY THIS PAGE EXISTS: everything the app learned about her was scattered and gated. The
// cycle story sat inside monthlyStory.js behind an 8-log threshold with no way to see it; the
// prediction record existed nowhere; the life-context tags had no payoff screen. The end of a
// cycle is the natural moment to hand all of it back in one place — the thing that makes the
// daily logging feel like it added up to something.
//
// RULES (permanent, never loosen):
//  1. EVERY LINE ON THIS PAGE COMES FROM HER OWN LOGS. No population claims, no "women often",
//     no predictions of how she will feel that her own data does not support.
//  2. Each section is allowed to say "not enough data yet" and MUST do so rather than
//     softening a threshold to fill the page.
//  3. The scorecard shows misses as well as hits. A record that only showed hits would be
//     marketing, not a record.
//  4. Read-only. This page writes nothing.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus } from '../lib/hormoneSync'
import { buildMonthlyStory } from '../lib/monthlyStory'
import { buildPhaseOutlook } from '../lib/phaseOutlook'
import { backtestPeriodPredictions, accuracySummary, backtestEnergy } from '../lib/predictionAccuracy'
import { tagInsights, tagByPhase } from '../lib/contextInsights'
import { getPhase } from '../lib/hormoneSync'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'
import AccuracyScorecard from '../components/AccuracyScorecard'

const card = { background: '#fff', border: '1px solid #ede8e0', borderRadius: 16, padding: 18, marginBottom: 12 }
const head = { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9590', marginBottom: 10 }
const body = { fontSize: 14, color: '#3a352c', lineHeight: 1.7 }
const quiet = { fontSize: 13, color: '#9a9590', lineHeight: 1.6, fontStyle: 'italic' }

export default function CycleReview() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [r, setR] = useState(null)

  useEffect(() => {
    async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login', { replace: true }); return }

      const [{ data: cycleData }, { data: logs }, status] = await Promise.all([
        supabase.from('cycle_data').select('*').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        // 180 days ≈ six cycles: enough for the story, the tag patterns and the energy
        // backtest without pulling her whole history.
        supabase.from('daily_logs').select('*').eq('user_id', user.id)
          .order('log_date', { ascending: false }).limit(180),
        getTodayStatus(supabase, user.id).catch(() => null),
      ])

      const all = logs || []
      const cycleLen = status?.cycleLen || cycleData?.cycle_length || 28
      const lastPeriod = cycleData?.last_period_date || null
      const periodStarts = status?.periodStarts || []

      const backtest = backtestPeriodPredictions(periodStarts, cycleData?.cycle_length || 28)
      // The phase a given log fell in, so tag patterns can be compared across phases.
      const phaseOfLog = (l) => {
        if (!lastPeriod || !l?.log_date) return null
        const diff = Math.floor((new Date(l.log_date + 'T00:00:00') - new Date(lastPeriod + 'T00:00:00')) / 86400000)
        const cd = (((diff % cycleLen) + cycleLen) % cycleLen) + 1
        return getPhase(cd, cycleLen, cycleData?.period_length)
      }

      setR({
        story: buildMonthlyStory({ logs: all, cycleData }),
        outlook: buildPhaseOutlook({ logs: all, lastPeriodDate: lastPeriod, cycleLen, cycleDay: status?.cycleDay }),
        backtest, accuracy: accuracySummary(backtest),
        energyGame: backtestEnergy(all, lastPeriod, cycleLen),
        tags: tagInsights(all),
        tagsByPhase: tagByPhase(all, phaseOfLog),
        logCount: all.length,
        cyclesTracked: status?.cyclesTracked || 0,
        cycleLen, spread: status?.cycleSpread, regular: status?.cycleRegular,
      })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <><TopBar title="Your cycle in review" backTo="/dashboard" /><div style={{ paddingTop: 60 }}><Spinner /></div><BottomNav /></>
  if (!r) return <><TopBar title="Your cycle in review" backTo="/dashboard" />
    <div style={{ padding: '60px 24px', textAlign: 'center', color: '#7a7268', fontSize: 14 }}>We could not load your review. Check your connection and try again.</div>
    <BottomNav /></>

  return (
    <>
      <TopBar backTo="/dashboard">
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Cycle in review</div>
        <div style={{ fontSize: 12, color: '#7a7268' }}>Everything your logs have taught me</div>
      </TopBar>

      <div style={{ padding: '16px 16px 120px' }}>

        {/* ── the headline numbers, all counts of her own data ── */}
        <div style={{ ...card, background: '#faf6ef', border: '1px solid #e6ddd0' }}>
          <div style={head}>What you have built</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { n: r.logCount, l: r.logCount === 1 ? 'day logged' : 'days logged' },
              { n: r.cyclesTracked, l: r.cyclesTracked === 1 ? 'cycle tracked' : 'cycles tracked' },
              { n: `${r.cycleLen}d`, l: 'your cycle length' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#2c2820' }}>{s.n}</div>
                <div style={{ fontSize: 11.5, color: '#7a7268' }}>{s.l}</div>
              </div>
            ))}
          </div>
          {r.regular != null && (
            <div style={{ ...quiet, marginTop: 12 }}>
              {r.regular
                ? `Your cycles have varied by less than a week, which is what "regular" means clinically (FIGO). Your typical spread is about ${r.spread || 0} days.`
                : `Your cycles have varied by more than a week. That is common and not in itself a problem — it does mean my prediction window stays honest and wide rather than falsely precise.`}
            </div>
          )}
        </div>

        {/* ── my record, misses included ── */}
        <AccuracyScorecard backtest={r.backtest} summary={r.accuracy} />

        {/* ── the energy game's record ── */}
        {r.energyGame?.status === 'ok' && (
          <div style={card}>
            <div style={head}>Guessing your energy</div>
            <div style={body}>
              Across {r.energyGame.n} days I guessed your energy in advance from your own past cycles.
              I got it exactly right {r.energyGame.exact} time{r.energyGame.exact === 1 ? '' : 's'}, and within
              one step {r.energyGame.close} time{r.energyGame.close === 1 ? '' : 's'}
              {' '}({Math.round(r.energyGame.closeRate * 100)}%).
            </div>
          </div>
        )}

        {/* ── the cycle story (monthlyStory.js) ── */}
        <div style={card}>
          <div style={head}>Your energy across the cycle</div>
          {r.story?.status === 'ok' ? (
            <>
              {r.story.story.map((line, i) => <div key={i} style={{ ...body, marginBottom: 8 }}>{line}</div>)}
              {r.story.suggestion && (
                <div style={{ ...body, marginTop: 10, paddingTop: 12, borderTop: '1px solid #f0ece4', color: '#5a5248' }}>
                  {r.story.suggestion}
                </div>
              )}
            </>
          ) : r.story?.status === 'even' ? (
            <div style={body}>{r.story.story[0]}</div>
          ) : (
            <div style={quiet}>{r.story?.summary || 'Log your energy for a few more weeks and a picture of how it moves across your cycle will appear here.'}</div>
          )}
        </div>

        {/* ── how her real life lands on her cycle (contextInsights.js) ── */}
        {(r.tags?.length > 0 || r.tagsByPhase?.length > 0) && (
          <div style={card}>
            <div style={head}>Your life, on your cycle</div>
            {r.tagsByPhase.map((t, i) => <div key={`p${i}`} style={{ ...body, marginBottom: 10 }}>{t.line}</div>)}
            {r.tags.slice(0, 3).map((t, i) => <div key={`t${i}`} style={{ ...body, marginBottom: 10 }}>{t.line}</div>)}
          </div>
        )}
        {r.tags?.length === 0 && r.tagsByPhase?.length === 0 && (
          <div style={card}>
            <div style={head}>Your life, on your cycle</div>
            <div style={quiet}>
              Tag your days on the log screen — a class you taught, a deadline, travel — and once
              there are a few of each I can show you how those days land in different parts of
              your cycle. That is a question nothing else can answer for you.
            </div>
          </div>
        )}

        {/* ── looking ahead (phaseOutlook.js) ── */}
        {r.outlook && (
          <div style={card}>
            <div style={head}>Looking ahead</div>
            <div style={r.outlook.status === 'ok' ? body : quiet}>{r.outlook.text}</div>
          </div>
        )}

        <div style={{ ...quiet, textAlign: 'center', padding: '4px 12px 0' }}>
          Every line on this page comes from your own logs. Nothing here is a diagnosis or
          medical advice.
        </div>
      </div>
      <BottomNav />
    </>
  )
}
