import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import TopBar from '../components/TopBar'

const ARTICLES = [
  {
    category: 'The science',
    items: [
      { title: 'Your menstrual cycle is a vital sign', body: 'Your cycle reflects bone health, brain health, cardiovascular health, and metabolic health. When it is regular and pain-free your hormonal system is functioning well. When it is not it is sending a signal worth listening to.' },
      { title: 'Women are not small men', body: 'Almost everything taught about exercise and nutrition was researched on men and generalised to women. Women were not required to be included in research studies until 1993. Every recommendation in Em~power is based on research conducted on women.' },
      { title: 'Your hormones and your mood', body: 'Estrogen regulates serotonin and dopamine production and receptor sensitivity. Progesterone metabolises to a compound that modulates GABA receptors. Mood fluctuations across your cycle are a direct neurobiological effect, not a psychological weakness. Source: Backstrom et al. Archives of Women\'s Mental Health 2008.' },
    ]
  },
  {
    category: 'Training',
    items: [
      { title: 'Why your warmup matters in the ovulatory phase', body: 'Peak estrogen increases ligament laxity. The risk of soft tissue injury including ACL tears is elevated around ovulation. A complete warmup is not optional — it is protective physiology.' },
      { title: 'HIIT in the luteal phase', body: 'Progesterone and cortisol compete for the same receptors. High intensity exercise in the luteal phase creates a larger net stress response than the same session in the follicular phase. This is why the same workout genuinely feels harder — it is harder. Source: Hackney 2006 Journal of Sports Science and Medicine.' },
      { title: 'Your wearable may be wrong', body: 'Wearable fitness devices were calibrated on male physiology. Your elevated core temperature and resting heart rate in the luteal phase looks like poor recovery to a device that treats male physiology as the default. Your Em~power recommendations already account for this. Source: Sims ST. ROAR 2024.' },
      { title: 'Muscle mass is hormonal health', body: 'Muscle mass improves insulin sensitivity, supports healthy estrogen metabolism, and directly influences how well you transition through perimenopause and menopause. Every weighted session is an investment in your future hormonal health. Source: Wright V. Diary of a CEO October 2025. Kohrt WM et al. MSSE 2004.' },
    ]
  },
  {
    category: 'Nutrition',
    items: [
      { title: 'Iron and active women', body: 'Standard anaemia tests were developed using male data. A woman can be functionally iron deficient with depleted stores affecting performance and mood while her haemoglobin looks normal. Ask your doctor for ferritin specifically. Ferritin below 30 mcg per litre is functionally deficient for active women. Source: Burden et al. BJSM 2015.' },
      { title: 'Carbohydrate cravings in the luteal phase', body: 'Carbohydrate cravings in the late luteal phase are driven by serotonin demand. Estrogen regulates serotonin synthesis — when estrogen falls in the late luteal phase serotonin availability drops and your brain seeks quick carbohydrates to restore it. Complex carbohydrates satisfy this without a blood sugar spike.' },
      { title: 'Creatine for women', body: 'Women have lower natural creatine stores than men. 3 to 5g daily with food supports muscle strength, cognitive function, and mood. Particularly useful in the luteal phase when protein breakdown is elevated. Source: Rawson et al. JISSN 2018. Candow et al. Nutrients 2021.' },
      { title: 'Intermittent fasting and women', body: 'Research suggests intermittent fasting can suppress the HPA axis in women, raise cortisol, and disrupt the hormonal system that regulates your cycle. Eat within 30 to 60 minutes of waking. This is especially important in the luteal phase. Source: Sims ST. ROAR 2024. Hamadeh et al. Am J Physiol 2005.' },
    ]
  },
  {
    category: 'Perimenopause',
    items: [
      { title: 'Perimenopause can begin at 35', body: 'Perimenopause can begin as early as age 35 according to STRAW+10 staging. Sleep disruption, mood changes, cycle irregularity, and brain fog in your late 30s may be early hormonal shifts, not just stress. Source: Harlow et al. Climacteric 2012.' },
      { title: 'The truth about HRT', body: 'A 2002 study caused panic about hormone replacement therapy. The study was later found to have been misinterpreted. Current evidence shows HRT started within 10 years of menopause or before age 60 is associated with reduced risk of osteoporosis, heart disease, and dementia. Source: Manson et al. NEJM 2013.' },
    ]
  },
]

export default function Learn() {
  const navigate = useNavigate()

  return (
    <div style={{ paddingBottom:100 }}>
      <TopBar title="LEARN" />

      <div style={{ padding:'0 16px' }}>
        {ARTICLES.map(section => (
          <div key={section.category} style={{ marginBottom:24 }}>
            <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:12, display:'block' }}>{section.category}</span>
            {section.items.map(article => (
              <div key={article.title} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:16, marginBottom:10 }}>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:6, lineHeight:1.4 }}>{article.title}</div>
                <div style={{ fontSize:13, color:'#5a5550', lineHeight:1.7 }}>{article.body}</div>
              </div>
            ))}
          </div>
        ))}

        <div style={{ fontSize:12, color:'#9a9590', lineHeight:1.6, marginBottom:24, padding:16, background:'#f5f0e8', borderRadius:12 }}>
          Em~power is a wellness tracking app, not a medical device. Nothing here is medical advice. Every health claim is traceable to peer-reviewed research. Always consult a healthcare provider for medical decisions.
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
