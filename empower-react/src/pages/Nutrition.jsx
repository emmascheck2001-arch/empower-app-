import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus } from '../lib/hormoneSync'
import BottomNav from '../components/BottomNav'
import TopBar from '../components/TopBar'
import Spinner from '../components/Spinner'

const PHASE_DATA = {
  Menstrual: {
    desc: 'Iron and anti-inflammatory focus',
    science: 'Iron lost through bleeding impacts performance. Vitamin C improves iron absorption by up to 67% (Angeli et al. 2016)',
    sectionLabel: 'Foods to prioritise this week',
    foods: [
      { icon:'🥩', name:'Red meat', why:'Haem iron — highest bioavailability for blood loss replacement' },
      { icon:'🥬', name:'Leafy greens', why:'Non-haem iron plus folate for cellular repair' },
      { icon:'🐟', name:'Oily fish', why:'Omega-3 reduces prostaglandin-driven cramping (Rahbar 2012)' },
      { icon:'🟤', name:'Dark chocolate', why:'Magnesium relaxes smooth muscle including uterus (Facchinetti 1991)' },
      { icon:'🎃', name:'Pumpkin seeds', why:'Zinc and magnesium — both depleted during menstruation' },
      { icon:'🍊', name:'Citrus fruit', why:'Vitamin C paired with iron meals improves absorption by up to 67%' },
    ],
    avoid: ['Black tea and coffee with iron meals — tannins reduce absorption', 'Trans fats — increase prostaglandin activity', 'High sodium — worsens bloating'],
  },
  Follicular: {
    desc: 'Lean protein and complex carbohydrates',
    science: 'Rising estrogen improves insulin sensitivity and muscle protein synthesis (Mauvais-Jarvis et al. JCI 2013)',
    sectionLabel: 'Foods to build on this week',
    foods: [
      { icon:'🥚', name:'Eggs', why:'Complete protein with all essential amino acids — follicular phase is peak anabolic window' },
      { icon:'🐔', name:'Chicken breast', why:'Lean protein to support rising estrogen-driven muscle synthesis' },
      { icon:'🫐', name:'Berries', why:'Antioxidants support recovery from increasing training load' },
      { icon:'🥑', name:'Avocado', why:'Healthy fats support estrogen production and absorption' },
      { icon:'🌾', name:'Oats', why:'Complex carbohydrates sustain energy with improving insulin sensitivity' },
      { icon:'🥦', name:'Broccoli', why:'DIM compound supports healthy estrogen metabolism' },
    ],
    avoid: ['Ultra-processed foods — blunt rising insulin sensitivity', 'Excess alcohol — disrupts estrogen metabolism'],
  },
  Ovulatory: {
    desc: 'Light and energising foods',
    science: 'Peak estrogen and testosterone create the highest energy and performance window of the cycle (Sarwar et al. 1996)',
    sectionLabel: 'Foods that match your energy',
    foods: [
      { icon:'🐟', name:'Salmon', why:'Omega-3 and complete protein to support peak training performance' },
      { icon:'🍓', name:'Berries', why:'Antioxidants protect against oxidative stress at peak intensity' },
      { icon:'🥗', name:'Quinoa salad', why:'Complete protein with complex carbs — light but sustaining' },
      { icon:'🥜', name:'Walnuts', why:'ALA omega-3 and healthy fats to support hormonal peak' },
      { icon:'🥝', name:'Kiwi', why:'Vitamin C and potassium for electrolyte balance at high intensity' },
      { icon:'🥒', name:'Cucumber', why:'Hydration and micronutrients without adding digestive load' },
    ],
    avoid: ['Very heavy meals before peak training — reduce exercise performance', 'Excess caffeine — may amplify existing peak cortisol'],
  },
  Luteal: {
    desc: 'Protein-forward with complex carbohydrates',
    science: 'Progesterone increases protein catabolism. Luteal phase requires 1.8 to 2.2g per kg bodyweight (ISSN 2023)',
    sectionLabel: 'Foods to prioritise this phase',
    foods: [
      { icon:'🥩', name:'Red meat or tofu', why:'Protein requirements are highest in the luteal phase — progesterone increases breakdown rate' },
      { icon:'🍠', name:'Sweet potato', why:'Complex carbohydrates help stabilise serotonin which drops in late luteal' },
      { icon:'🥬', name:'Leafy greens with eggs', why:'Calcium and B6 support serotonin production (Backstrom et al. 2008)' },
      { icon:'🍫', name:'Dark chocolate', why:'Magnesium for mood and muscle relaxation. Carbohydrate cravings are driven by serotonin demand' },
      { icon:'🐟', name:'Oily fish', why:'Reduces luteal-phase inflammation and supports mood via omega-3' },
      { icon:'🫘', name:'Lentils', why:'Iron, fibre, and protein — supports stable blood sugar and energy' },
    ],
    avoid: ['Alcohol — amplifies mood instability and disrupts sleep quality', 'Refined sugar — worsens blood sugar swings and inflammation', 'High sodium — worsens luteal-phase bloating', 'Excess caffeine — elevates cortisol already elevated by progesterone competition (Hackney 2006)'],
  },
  Perimenopause: {
    desc: 'Protein and bone-protective nutrition',
    science: 'Estrogen loss drives visceral fat redistribution and insulin resistance (Carr JCE 2003). Protein needs increase with hormonal fluctuation.',
    sectionLabel: 'Foods that support your transition',
    foods: [
      { icon:'🥛', name:'Dairy or fortified alternatives', why:'Calcium 1000mg daily plus vitamin D supports bone density as estrogen falls' },
      { icon:'🥩', name:'Lean protein', why:'1.8g per kg daily — muscle mass is one of the strongest protective factors in menopause transition' },
      { icon:'🐟', name:'Oily fish', why:'Omega-3 supports cardiovascular and cognitive health during perimenopause' },
      { icon:'🫘', name:'Soy foods', why:'Phytoestrogens may modestly support symptom management — evidence emerging' },
      { icon:'🥬', name:'Leafy greens', why:'Magnesium and folate support mood and sleep — both commonly disrupted in perimenopause' },
      { icon:'🟤', name:'Dark chocolate', why:'Magnesium for sleep quality and mood regulation' },
    ],
    avoid: ['Alcohol — worsens hot flashes and disrupts sleep architecture', 'Excess caffeine — triggers hot flashes in many women', 'High sodium — worsens cardiovascular risk rising with estrogen fall'],
  },
}

export default function Nutrition() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [tab, setTab] = useState('foods')
  const [openSymptom, setOpenSymptom] = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    try {
      const s = await getTodayStatus(supabase, user.id)
      setStatus(s)
    } catch(e) {}
    setLoading(false)
  }

  if (loading) return <div style={{ paddingTop:60 }}><Spinner /></div>

  const phase = status?.phase || 'Follicular'
  const targets = status?.nutritionTargets
  const phaseData = PHASE_DATA[phase] || PHASE_DATA.Follicular

  const SYMPTOMS = [
    { id:'cramping', emoji:'🦵', title:'Cramping', sub:'Dysmenorrhea and pelvic pain', remedies:[
      { name:'Fatty fish', why:'Omega-3 competes with arachidonic acid to reduce prostaglandin production (Rahbar 2012)' },
      { name:'Pumpkin seeds and dark chocolate', why:'Magnesium reduces dysmenorrhea severity (Facchinetti et al. 1991)' },
      { name:'Fresh ginger', why:'Anti-inflammatory compounds reduce prostaglandin synthesis' },
      { name:'Walnuts and flaxseed', why:'ALA omega-3 — plant-based prostaglandin reduction' },
    ], avoid:['Trans fats','Excess alcohol','Tea and coffee with iron meals','High sodium'] },
    { id:'bloating', emoji:'🫧', title:'Bloating', sub:'Luteal-phase GI changes', remedies:[
      { name:'Probiotic foods', why:'Yogurt, kefir, kimchi support gut microbiome shifted by progesterone' },
      { name:'Cooked vegetables', why:'Easier to digest than raw — reduces fermentation and gas' },
      { name:'Fennel', why:'Natural antispasmodic that reduces intestinal gas and cramping' },
      { name:'Increased water intake', why:'Counterintuitively reduces water retention by improving kidney function' },
    ], avoid:['High-sodium foods','Carbonated drinks','Alcohol','Raw brassicas','Sugar alcohols'] },
    { id:'brainfog', emoji:'🧠', title:'Brain fog', sub:'Focus, concentration and energy', remedies:[
      { name:'Iron-rich foods', why:'Functional iron deficiency impairs cognitive performance even before anaemia (Burden 2015 BJSM)' },
      { name:'Oily fish and walnuts', why:'DHA omega-3 supports neural function and neurotransmitter production' },
      { name:'Complex carbohydrates', why:'Stable blood glucose protects working memory and executive function' },
      { name:'Eggs and leafy greens', why:'Choline and B vitamins support acetylcholine synthesis for focus' },
    ], avoid:['Ultra-processed foods','Excess alcohol','Skipping meals'] },
    { id:'pms', emoji:'💙', title:'PMS and mood', sub:'Late luteal phase support', remedies:[
      { name:'Calcium and vitamin D', why:'Low calcium is associated with more severe PMS symptoms — 1000mg daily from food sources' },
      { name:'Magnesium-rich foods', why:'Modulates GABA-A receptors which are sensitive to falling progesterone (Backstrom et al. 2008)' },
      { name:'Vitamin B6', why:'Cofactor for serotonin and dopamine synthesis — declining in late luteal phase' },
      { name:'Complex carbohydrates', why:'Carbohydrate cravings are driven by serotonin demand — complex carbs satisfy this without blood sugar spike' },
    ], avoid:['Alcohol','Refined sugar','High-sodium foods','Excess caffeine'] },
    { id:'fatigue', emoji:'⚡', title:'Fatigue and low energy', sub:'Especially during and after menstruation', remedies:[
      { name:'Red meat or lentils', why:'Haem and non-haem iron replenishment for blood loss during menstruation (Angeli et al. 2016)' },
      { name:'Lentils and spinach with vitamin C', why:'Non-haem iron with vitamin C increases absorption by up to 67%' },
      { name:'B12 sources', why:'Eggs, fish, dairy or supplements — B12 deficiency causes fatigue and brain fog' },
    ], avoid:['Black tea and coffee within 1 hour of iron-rich meals','Large dairy servings with iron meals'] },
  ]

  return (
    <div style={{ paddingBottom:100 }}>
      <TopBar title="NUTRITION" subtitle={phase.toUpperCase()} subtitleColor="#c8b89a" />

      {/* Phase banner */}
      <div style={{ background:'linear-gradient(135deg, #2c2820, #352c20)', padding:'20px 16px', marginBottom:16 }}>
        <div style={{ fontSize:11, color:'#c8b89a', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>THIS PHASE</div>
        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20, color:'#f5f0e8', marginBottom:6 }}>{phaseData.desc}</div>
        <div style={{ fontSize:12, color:'#c8b89a', lineHeight:1.6, fontStyle:'italic' }}>{phaseData.science}</div>
      </div>

      {/* Targets */}
      {targets && (
        <div style={{ margin:'0 16px 16px', background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:28, fontWeight:700, color:'#2c2820' }}>{targets.proteinG}g</div>
              <div style={{ fontSize:11, color:'#9a9590', textTransform:'uppercase', letterSpacing:'0.08em' }}>Protein today</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:28, fontWeight:700, color:'#2c2820' }}>{targets.extraCalories > 0 ? '+' : ''}{targets.extraCalories}</div>
              <div style={{ fontSize:11, color:'#9a9590', textTransform:'uppercase', letterSpacing:'0.08em' }}>Extra kcal</div>
            </div>
          </div>
          <div style={{ fontSize:11, color:'#9a9590', textAlign:'center', marginTop:8 }}>Source: ISSN 2023 position stand</div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', margin:'0 16px 16px', background:'#f5f0e8', borderRadius:10, padding:3 }}>
        {[['foods','Phase foods'],['symptoms','Symptom relief']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:13,
            background:tab===id?'#fff':'transparent', fontWeight:tab===id?500:400,
            color:tab===id?'#2c2820':'#7a7268', fontFamily:'inherit',
            boxShadow:tab===id?'0 1px 4px rgba(44,40,32,0.08)':'none'
          }}>{label}</button>
        ))}
      </div>

      {tab === 'foods' ? (
        <div style={{ padding:'0 16px' }}>
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:12, display:'block' }}>{phaseData.sectionLabel}</span>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {phaseData.foods.map(f => (
              <div key={f.name} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:12 }}>
                <div style={{ fontSize:24, marginBottom:6 }}>{f.icon}</div>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{f.name}</div>
                <div style={{ fontSize:11, color:'#7a7268', lineHeight:1.5 }}>{f.why}</div>
              </div>
            ))}
          </div>
          {phaseData.avoid.length > 0 && (
            <div style={{ background:'#fdf5f0', border:'1px solid #f0d8cc', borderRadius:12, padding:14, marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a6a50', marginBottom:8 }}>Limit this phase</div>
              {phaseData.avoid.map(a => (
                <div key={a} style={{ fontSize:12, color:'#7a4a30', marginBottom:4, paddingLeft:8, borderLeft:'2px solid #e8c0a8' }}>{a}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding:'0 16px' }}>
          {SYMPTOMS.map(s => (
            <div key={s.id} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, marginBottom:10, overflow:'hidden' }}>
              <div onClick={() => setOpenSymptom(openSymptom===s.id ? null : s.id)}
                style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
                <span style={{ fontSize:20 }}>{s.emoji}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>{s.title}</div>
                  <div style={{ fontSize:11, color:'#9a9590' }}>{s.sub}</div>
                </div>
                <i className={`ti ti-chevron-${openSymptom===s.id?'up':'down'}`} style={{ color:'#9a9590' }} />
              </div>
              {openSymptom===s.id && (
                <div style={{ padding:'0 16px 14px', borderTop:'1px solid #f0ece4' }}>
                  {s.remedies.map(r => (
                    <div key={r.name} style={{ marginBottom:8 }}>
                      <div style={{ fontSize:13, fontWeight:500, marginBottom:2 }}>{r.name}</div>
                      <div style={{ fontSize:11, color:'#7a7268', lineHeight:1.5 }}>{r.why}</div>
                    </div>
                  ))}
                  {s.avoid.length > 0 && (
                    <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #f0ece4' }}>
                      <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>Limit</div>
                      <div style={{ fontSize:11, color:'#7a4a30' }}>{s.avoid.join(' / ')}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
