// route /friends — social feature: friend requests, friend phase cards, pending invites
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPhase, getLutealSubPhase } from '../lib/hormoneSync'
import TopBar from '../components/TopBar'
import Spinner from '../components/Spinner'

const sLabel = { fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', display:'block', marginBottom:10 }

const PHASE_COLORS = {
  Menstrual:      { dot:'#e09898', bg:'#f0d8d8', text:'#5a2a28' },
  Follicular:     { dot:'#88c088', bg:'#d8f0d8', text:'#1a4a1a' },
  Ovulatory:      { dot:'#88c0e0', bg:'#d0e8f8', text:'#1a3a5a' },
  'Early luteal': { dot:'#e0c070', bg:'#f8e8c8', text:'#6a3a10' },
  'Mid luteal':   { dot:'#d0a040', bg:'#f0d098', text:'#5a3008' },
  'Late luteal':  { dot:'#c88878', bg:'#f0c8b8', text:'#5a2818' },
  Luteal:         { dot:'#d0a040', bg:'#f0d098', text:'#5a3008' },
  Perimenopause:  { dot:'#b090d0', bg:'#ece0f8', text:'#4a2870' },
  observation:    { dot:'#b0a898', bg:'#e8e5e0', text:'#4a4540' },
}

const SLEEP_LABELS = { Poor:'😴 Poor sleep', Fair:'😴 Fair sleep', Good:'😴 Good sleep', Excellent:'😴 Great sleep', Great:'😴 Great sleep' }
const WORKOUT_LABELS = { 'Rest day':'🏃 Rest day', 'Felt strong':'💪 Felt strong', 'Felt average':'🏃 Felt average', 'Felt hard':'😓 Felt hard', Skipped:'⏭ Skipped' }

function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width:44, height:26, borderRadius:13, background:on?'#2c2820':'#d8d0c8', position:'relative', cursor:'pointer', transition:'background 0.2s', flexShrink:0 }}>
      <div style={{ width:20, height:20, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:3, transition:'transform 0.2s', transform:on?'translateX(18px)':'none', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  )
}

function phaseForCard(card) {
  if (!card.last_period_date || !card.cycle_length) return null
  const last = new Date(card.last_period_date + 'T00:00:00')
  const now = new Date(); now.setHours(0,0,0,0)
  const cd = Math.floor((now - last) / 86400000) + 1
  if (cd < 1 || cd > card.cycle_length + 14) return null
  if (card.user_path === '4') return 'Perimenopause'
  const phase = getPhase(cd, card.cycle_length)
  return phase === 'Luteal' ? getLutealSubPhase(cd, card.cycle_length) : phase
}

export default function Friends() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [vis, setVis] = useState({ show_phase:true, show_streak:true, show_sleep:false, show_workout:false })
  const [pendingIn, setPendingIn] = useState([])
  const [pendingOut, setPendingOut] = useState([])
  const [friends, setFriends] = useState([]) // [{ friendship_id, friend_id, card }]
  const [email, setEmail] = useState('')
  const [addStatus, setAddStatus] = useState('') // '' | sending | sent | not_found | already | error
  const [savingVis, setSavingVis] = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { navigate('/login', { replace:true }); return }
      setUser(u)

      const [{ data: visData }, { data: fships }] = await Promise.all([
        supabase.from('friend_visibility').select('*').eq('user_id', u.id).maybeSingle(),
        supabase.from('friendships').select('*').or(`requester_id.eq.${u.id},addressee_id.eq.${u.id}`),
      ])

      if (visData) setVis({ show_phase: visData.show_phase, show_streak: visData.show_streak, show_sleep: visData.show_sleep, show_workout: visData.show_workout })

      const incoming = (fships || []).filter(f => f.status === 'pending' && f.addressee_id === u.id)
      const outgoing = (fships || []).filter(f => f.status === 'pending' && f.requester_id === u.id)
      const accepted = (fships || []).filter(f => f.status === 'accepted')

      setPendingIn(incoming)
      setPendingOut(outgoing)

      const friendCards = await Promise.all(accepted.map(async f => {
        const friendId = f.requester_id === u.id ? f.addressee_id : f.requester_id
        const { data: card } = await supabase.rpc('get_friend_card', { target_user_id: friendId })
        return { friendship_id: f.id, friend_id: friendId, card: card || { name: f.requester_id === u.id ? f.addressee_name : f.requester_name } }
      }))
      setFriends(friendCards)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function saveVis(newVis) {
    setVis(newVis)
    setSavingVis(true)
    await supabase.from('friend_visibility').upsert({ user_id: user.id, ...newVis }, { onConflict: 'user_id' })
    setSavingVis(false)
  }

  async function sendRequest() {
    if (!email.trim() || !user) return
    setAddStatus('sending')
    try {
      const { data: targetId } = await supabase.rpc('find_user_by_email', { search_email: email.trim().toLowerCase() })
      if (!targetId) { setAddStatus('not_found'); return }
      if (targetId === user.id) { setAddStatus('error'); return }

      const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle()
      const { data: inserted, error } = await supabase.from('friendships').insert({
        requester_id: user.id,
        addressee_id: targetId,
        requester_email: email.trim().toLowerCase(),
        requester_name: prof?.name || email.split('@')[0],
      }).select('id')
      if (error?.code === '23505') { setAddStatus('already'); return }
      if (error || !inserted?.length) { setAddStatus('error'); return }
      setAddStatus('sent')
      setEmail('')
      load()
    } catch { setAddStatus('error') }
  }

  async function respond(friendshipId, accept) {
    await supabase.from('friendships').update({ status: accept ? 'accepted' : 'declined' }).eq('id', friendshipId)
    load()
  }

  async function removeFriend(friendshipId) {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    load()
  }

  if (loading) return <><TopBar title="FRIENDS" backTo="/dashboard" /><div style={{ paddingTop:60 }}><Spinner /></div></>

  const VIS_OPTIONS = [
    { key:'show_phase',   label:'Cycle phase',   desc:'Your current phase of cycle' },
    { key:'show_streak',  label:'Log streak',    desc:'How many days in a row you have logged' },
    { key:'show_sleep',   label:'Sleep quality', desc:'Last night\'s sleep rating' },
    { key:'show_workout', label:'Workout feel',  desc:'How your last workout felt' },
  ]

  return (
    <>
      <TopBar title="FRIENDS" backTo="/dashboard" />
      <div style={{ padding:'16px 16px 100px' }}>

        {/* Visibility settings */}
        <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16, marginBottom:12 }}>
          <span style={sLabel}>What you share with friends {savingVis && <span style={{ color:'#c8b89a', fontWeight:400, fontSize:10 }}>Saving...</span>}</span>
          {VIS_OPTIONS.map((opt, i) => (
            <div key={opt.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:i>0?12:0, marginTop:i>0?12:0, borderTop:i>0?'1px solid #f5f0e8':'none' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:500, color:'#2c2820', marginBottom:2 }}>{opt.label}</div>
                <div style={{ fontSize:12, color:'#9a9590' }}>{opt.desc}</div>
              </div>
              <Toggle on={vis[opt.key]} onChange={v => saveVis({ ...vis, [opt.key]: v })} />
            </div>
          ))}
        </div>

        {/* Add a friend */}
        <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16, marginBottom:12 }}>
          <span style={sLabel}>Add a friend</span>
          <div style={{ display:'flex', gap:8 }}>
            <input
              type="email"
              placeholder="Enter their email address"
              value={email}
              onChange={e => { setEmail(e.target.value); setAddStatus('') }}
              onKeyDown={e => e.key === 'Enter' && sendRequest()}
              style={{ flex:1, padding:'11px 14px', borderRadius:10, border:'1px solid #ede8e0', fontSize:14, fontFamily:'inherit', outline:'none' }}
            />
            <button onClick={sendRequest} disabled={!email.trim() || addStatus === 'sending'}
              style={{ padding:'0 16px', borderRadius:10, background:'#2c2820', color:'#f5f0e8', border:'none', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', flexShrink:0, opacity:(!email.trim() || addStatus==='sending')?0.5:1 }}>
              {addStatus === 'sending' ? '...' : 'Add'}
            </button>
          </div>
          {addStatus === 'sent'      && <div style={{ marginTop:8, fontSize:13, color:'#50a050' }}>Request sent.</div>}
          {addStatus === 'not_found' && <div style={{ marginTop:8, fontSize:13, color:'#c05858' }}>No Em~power account found with that email.</div>}
          {addStatus === 'already'   && <div style={{ marginTop:8, fontSize:13, color:'#9a9590' }}>You are already connected or a request is pending.</div>}
          {addStatus === 'error'     && <div style={{ marginTop:8, fontSize:13, color:'#c05858' }}>Something went wrong. Try again.</div>}

          {pendingOut.length > 0 && (
            <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #f5f0e8' }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9a9590', marginBottom:8 }}>Pending — waiting for them</div>
              {pendingOut.map(f => (
                <div key={f.id} style={{ fontSize:13, color:'#7a7268', marginBottom:4 }}>
                  <i className="ti ti-clock" style={{ marginRight:6, color:'#c8b89a' }} />
                  {f.addressee_email || 'Friend request sent'}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incoming requests */}
        {pendingIn.length > 0 && (
          <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16, marginBottom:12 }}>
            <span style={sLabel}>Friend requests ({pendingIn.length})</span>
            {pendingIn.map(f => (
              <div key={f.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:pendingIn.indexOf(f)<pendingIn.length-1?12:0 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:500, color:'#2c2820' }}>{f.requester_name || 'Someone'}</div>
                  <div style={{ fontSize:12, color:'#9a9590' }}>{f.requester_email}</div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => respond(f.id, false)} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #ede8e0', background:'#fff', fontSize:12, cursor:'pointer', fontFamily:'inherit', color:'#7a7268' }}>Decline</button>
                  <button onClick={() => respond(f.id, true)} style={{ padding:'7px 12px', borderRadius:8, border:'none', background:'#2c2820', fontSize:12, cursor:'pointer', fontFamily:'inherit', color:'#f5f0e8', fontWeight:500 }}>Accept</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Friends list */}
        {friends.length === 0 && pendingIn.length === 0 && pendingOut.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 16px', color:'#9a9590' }}>
            <i className="ti ti-users" style={{ fontSize:36, color:'#ede8e0', display:'block', marginBottom:12 }} />
            <div style={{ fontSize:14, marginBottom:6 }}>No friends yet</div>
            <div style={{ fontSize:12 }}>Add a friend above using their email address.</div>
          </div>
        ) : friends.length > 0 && (
          <>
            <span style={{ ...sLabel, marginBottom:8 }}>Your friends</span>
            {friends.map(({ friendship_id, card }) => {
              if (!card) return null
              const phase = card.last_period_date ? phaseForCard(card) : null
              const pc = phase ? (PHASE_COLORS[phase] || PHASE_COLORS.observation) : null
              return (
                <div key={friendship_id} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16, marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom: (card.show_phase || card.show_streak || card.show_sleep || card.show_workout) ? 12 : 0 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:600, color:'#2c2820' }}>{card.name || 'Friend'}</div>
                    </div>
                    <button onClick={() => removeFriend(friendship_id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#c8c0b8', padding:'2px 4px', fontSize:14 }}>
                      <i className="ti ti-x" />
                    </button>
                  </div>

                  {/* Shared data pills */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {card.show_phase && phase && pc && (
                      <div style={{ background:pc.bg, color:pc.text, padding:'5px 10px', borderRadius:20, fontSize:12, fontWeight:500 }}>
                        <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:pc.dot, marginRight:5 }} />
                        {phase}
                      </div>
                    )}
                    {card.show_phase && !phase && card.last_period_date && (
                      <div style={{ background:'#f5f0e8', color:'#9a9590', padding:'5px 10px', borderRadius:20, fontSize:12 }}>Phase unknown</div>
                    )}
                    {card.show_streak && typeof card.streak === 'number' && (
                      <div style={{ background:'#fff8e6', color:'#7a5010', padding:'5px 10px', borderRadius:20, fontSize:12 }}>
                        🔥 {card.streak} day{card.streak !== 1 ? 's' : ''}
                      </div>
                    )}
                    {card.show_sleep && card.sleep_quality && (
                      <div style={{ background:'#f0f0f8', color:'#3a3560', padding:'5px 10px', borderRadius:20, fontSize:12 }}>
                        {SLEEP_LABELS[card.sleep_quality] || `😴 ${card.sleep_quality}`}
                      </div>
                    )}
                    {card.show_workout && card.workout_feel && (
                      <div style={{ background:'#f0f8f0', color:'#2a5a2a', padding:'5px 10px', borderRadius:20, fontSize:12 }}>
                        {WORKOUT_LABELS[card.workout_feel] || `🏃 ${card.workout_feel}`}
                      </div>
                    )}
                    {!card.show_phase && !card.show_streak && !card.show_sleep && !card.show_workout && (
                      <div style={{ fontSize:12, color:'#9a9590' }}>Sharing privately</div>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </>
  )
}
