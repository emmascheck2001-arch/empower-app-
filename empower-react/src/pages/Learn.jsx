// route /learn — science articles and education on hormones, perimenopause, and cycle health
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const SECTIONS = [
  {
    id: 'hormones',
    icon: 'ti ti-dna',
    iconBg: '#f0e8f8', iconColor: '#7a4a9a',
    title: 'Your hormones',
    desc: 'What estrogen, progesterone, LH, and cortisol actually do in your body and why they matter day to day',
  },
  {
    id: 'phases',
    icon: 'ti ti-circle-dotted',
    iconBg: '#f8f0e8', iconColor: '#9a6a2a',
    title: 'Your cycle phases',
    desc: 'What is happening in your body across all four phases, and what that means for training and energy',
  },
  {
    id: 'brain',
    icon: 'ti ti-brain',
    iconBg: '#e8f0f8', iconColor: '#2a5a8a',
    title: 'Your brain and your cycle',
    desc: 'Why your mood, focus, and motivation shift across your cycle, and why it is not a personality flaw',
  },
  {
    id: 'sleep',
    icon: 'ti ti-moon',
    iconBg: '#e8eef8', iconColor: '#2a4a8a',
    title: 'Sleep and your cycle',
    desc: 'Why sleep changes across your cycle, why the luteal phase is harder, and what the research actually supports',
  },
  {
    id: 'nutrition',
    icon: 'ti ti-salad',
    iconBg: '#e8f8e8', iconColor: '#2a6a2a',
    title: 'Nutrition and hormones',
    desc: 'Why your appetite, cravings, and protein needs change at different points in your cycle',
  },
  {
    id: 'training',
    icon: 'ti ti-barbell',
    iconBg: '#f8e8e8', iconColor: '#8a2a2a',
    title: 'Training and hormones',
    desc: 'Why exercise science was built on male physiology, and what the research actually says for women',
  },
  {
    id: 'conditions',
    icon: 'ti ti-stethoscope',
    iconBg: '#f8f8e8', iconColor: '#6a6a1a',
    title: 'Conditions worth knowing about',
    desc: 'PCOS, endometriosis, RED-S, and perimenopause explained clearly, without dismissal',
  },
]

const PERI_SECTIONS = [
  { id:'peri_what',      icon:'ti ti-question-mark', iconBg:'#f5f0e8', iconColor:'#8a6a4a', title:'What is perimenopause?',          desc:'What it is, when it starts, and what to expect from this transition' },
  { id:'peri_post',      icon:'ti ti-sun',            iconBg:'#f8f0e0', iconColor:'#a07020', title:'After menopause: the long view',   desc:'What changes once periods have stopped for good, and where to put your energy' },
  { id:'peri_hormones',  icon:'ti ti-dna',            iconBg:'#f0e8f8', iconColor:'#7a4a9a', title:'Hormones during the transition',   desc:'How estrogen, progesterone, and FSH change and why that matters' },
  { id:'peri_bone',      icon:'ti ti-bone',            iconBg:'#e8f0f8', iconColor:'#2a5a8a', title:'Bone health',                      desc:'Why bone loss accelerates and what you can do about it right now' },
  { id:'peri_metabolic', icon:'ti ti-activity',        iconBg:'#e8f8e8', iconColor:'#2a6a2a', title:'Metabolism and weight',            desc:'Why body composition changes and what is actually driving it' },
  { id:'peri_sleep',     icon:'ti ti-moon',            iconBg:'#f8f8e8', iconColor:'#6a6a1a', title:'Sleep in perimenopause',           desc:'Why sleep changes and evidence-backed strategies to protect it' },
  { id:'peri_mood',      icon:'ti ti-heart',           iconBg:'#f8e8e8', iconColor:'#8a2a2a', title:'Mood and mental health',           desc:'Hormonal depression is real, not weakness. What the research says and when to seek help' },
  { id:'peri_exercise',  icon:'ti ti-barbell',         iconBg:'#f8e8e8', iconColor:'#8a2a2a', title:'Exercise in perimenopause',        desc:'Why the training priority order changes, and what the research supports' },
  { id:'peri_nutrition', icon:'ti ti-salad',           iconBg:'#e8f8e8', iconColor:'#2a6a2a', title:'Nutrition priorities',             desc:'Protein, calcium, vitamin D, phytoestrogens, and what to reduce' },
  { id:'peri_gsm',       icon:'ti ti-heart',           iconBg:'#f8e8f0', iconColor:'#9a2a6a', title:'Vaginal and sexual health',        desc:'Dryness, painful sex, urinary changes, and libido — common, treatable, and rarely discussed' },
  { id:'peri_hrt',       icon:'ti ti-pill',            iconBg:'#f5f0e8', iconColor:'#8a6a4a', title:'HRT explained',                   desc:'What the 2002 study actually showed, what it did not show, and where the evidence stands now' },
  { id:'peri_doctor',    icon:'ti ti-stethoscope',     iconBg:'#f8f8e8', iconColor:'#6a6a1a', title:'Finding a doctor who listens',     desc:'What to ask, what to bring, and what you are entitled to expect' },
]

const ARTICLES = {
  hormones: {
    title: 'Your hormones',
    content: [
      { h: 'Why your hormone levels are not a fixed number' },
      { p: 'Almost every hormone reference range you have ever seen was built from population averages, often using studies that underrepresented women. Your normal is not the chart. Your normal is your own pattern across multiple cycles over time. A single blood test result tells you almost nothing on its own.' },
      { box: 'The most cited hormone reference values for women come from a study of 97 women across 2,105 cycles. Your personal normal may be different from those averages and still be completely healthy. What matters is your pattern, not a single number. (Munster et al. 2021)' },
      { h: 'Estrogen' },
      { p: 'Estrogen rises through the first half of your cycle, peaks just before ovulation, drops briefly, rises again in mid-luteal phase, then falls sharply before your period. You will feel this pattern even if you have never tracked it before.' },
      { p: 'Estrogen directly supports mood by driving serotonin production. It improves how your cells respond to insulin, which is why energy tends to be more stable and cravings are lower in the follicular phase. It supports bone density, cardiovascular health, cognitive function, and muscle protein synthesis. When it drops before your period, all of those effects drop with it. The physical and emotional low you feel before your period has a direct biological cause. (Source: Lokuge et al. Biological Psychiatry 2011; Mauvais-Jarvis et al. JCI 2013.)' },
      { h: 'Progesterone' },
      { p: 'Progesterone rises after ovulation and is only present in meaningful amounts in the second half of your cycle. If you ovulate, progesterone rises. If you do not, it does not.' },
      { p: 'Progesterone does several things that matter practically. It raises your core body temperature by 0.3 to 0.5 degrees Celsius, which is why wrist temperature tracking can detect ovulation. It increases how fast your body breaks down protein, which is why protein needs are higher in the luteal phase. And it competes with cortisol for the same receptors in the body, which means training stress hits harder in the second half of your cycle than the first. (Source: Charkoudian and Stachenfeld. Comprehensive Physiology 2014; Hackney. JSSM 2006.)' },
      { p: 'Progesterone levels pulse throughout the luteal phase rather than sitting at a constant level. Population charts smooth this into a curve that does not reflect any real woman\'s experience. (Filicori et al. JCEM 1984.)' },
      { h: 'LH' },
      { p: 'Luteinising hormone surges sharply just before ovulation, triggering the release of an egg. This is the surge that home LH tests detect. A surge above approximately 8 IU/L is consistent with ovulation being imminent, typically within 12 to 36 hours. (Source: Munster et al. 2021.)' },
      { h: 'Cortisol' },
      { p: 'Cortisol is your primary stress hormone. Normal morning cortisol is 10 to 30 nmol/L (LifeLabs/EORLA). In the luteal phase, cortisol and progesterone compete for the same receptors. High-intensity training raises cortisol. When that combines with high progesterone in mid-luteal phase, the total stress load on your body is higher than the same workout would create in the follicular phase. This is not in your head. It is a real physiological difference. (Source: Hackney. JSSM 2006.)' },
      { h: 'A note on hormone testing' },
      { p: 'If you are testing your hormones, always record where you are in your cycle. The same hormone at the same level means something completely different depending on the cycle day. Progesterone is only clinically meaningful when measured approximately 7 days after confirmed ovulation. Testing it on a fixed "day 21" only makes sense for a 28-day cycle with ovulation on day 14, which is not most women.' },
      { cite: 'Sources: Munster et al. 2021 (n=97, 2,105 cycles); LifeLabs/EORLA Canadian reference ranges; Charkoudian N, Stachenfeld NS. Comprehensive Physiology 2014; Hackney AC. JSSM 2006; Mauvais-Jarvis F et al. JCI 2013; Lokuge S et al. Biological Psychiatry 2011; Filicori M et al. JCEM 1984.' },
    ]
  },
  sleep: {
    title: 'Sleep and your cycle',
    content: [
      { h: 'Sleep is not passive recovery' },
      { p: 'Reproductive hormones are produced and regulated during sleep. LH pulses, which drive follicle development and ovulation, happen predominantly at night. Disrupted sleep disrupts those pulses. Poor sleep raises cortisol, which directly suppresses the hormone signal that tells your ovaries to function. The relationship runs both ways: your hormones affect your sleep, and your sleep affects your hormones.' },
      { box: 'Sleep quality is measurably worse in the mid-luteal and late luteal phases compared to the follicular phase. This is not anxiety or lifestyle. It is a direct effect of progesterone and temperature changes on sleep architecture. (De Martin Topranin et al. IJSPP 2023)' },
      { h: 'How sleep changes across your cycle' },
      { p: 'Menstrual phase: Estrogen and progesterone are both at their lowest. Prostaglandins driving cramping can also interrupt sleep, particularly in the first one to two nights.' },
      { p: 'Follicular phase: Rising estrogen supports serotonin production and improves mood stability, which typically improves sleep quality. Most women report their best sleep in the follicular phase. (Shechter A, Boivin DB. Sleep Med Rev 2010)' },
      { p: 'Luteal phase: Progesterone raises your core temperature by 0.3 to 0.5 degrees Celsius. Your body needs to cool down to fall into and maintain deep sleep. That elevated temperature works against this. Resting heart rate is on average 1.7 bpm higher. By late luteal, progesterone and estrogen are both dropping sharply, and GABA receptor activity falls with progesterone. For many women this creates a rebound effect: lighter sleep, more waking, and a feeling of not having rested properly. (De Martin Topranin et al. IJSPP 2023; Backstrom T et al. Psychoneuroendocrinology 2014)' },
      { h: 'What actually helps' },
      { ul: ['Keep the bedroom cool. 18 to 20 degrees Celsius. Especially important in the luteal phase when your core temperature is already elevated.', 'Consistent sleep and wake times. Circadian rhythm stability helps buffer against the hormonal disruption of late luteal. Even on weekends.', 'Magnesium glycinate 300 to 400mg before bed. Associated with improved sleep quality and reduced time to fall asleep. Well tolerated. (Abbasi B et al. J Res Med Sci 2012)', 'Protein before bed in the luteal phase. Progesterone causes your body to break down muscle protein faster overnight — a small protein snack helps offset this.', 'Reduce alcohol. Even moderate alcohol fragments sleep architecture and reduces REM sleep.', 'Limit caffeine after 12pm. Caffeine has a half-life of 5 to 6 hours and reduces slow-wave sleep even when you feel like you slept fine.'] },
      { h: 'When to talk to a doctor' },
      { p: 'If poor sleep is consistently affecting your daily function across multiple cycles, bring your logged sleep data to your doctor. A clear pattern of luteal-phase sleep disruption is clinical information, not a vague complaint.' },
      { cite: 'Sources: De Martin Topranin V et al. IJSPP 2023; Shechter A, Boivin DB. Sleep Med Rev 2010; Charkoudian N, Stachenfeld NS. Comprehensive Physiology 2014; Backstrom T et al. Psychoneuroendocrinology 2014; Abbasi B et al. J Res Med Sci 2012; Sims ST. ROAR. Rodale 2024.' },
    ]
  },
  phases: {
    title: 'Your cycle phases',
    content: [
      { h: 'The four phases' },
      { p: 'Your cycle has four phases. Their timing varies between women and between your own cycles. The lengths that matter are yours, not the textbook 28-day model.' },
      { h: 'Menstrual phase' },
      { p: 'This is day one of your period through to roughly day five. Estrogen and progesterone are both at their lowest point of the entire cycle. Energy is often low, mood may be more vulnerable, and physical performance tends to feel harder. These are not signs of weakness. They are the direct result of your lowest hormone levels of the month.' },
      { p: 'Your body is also losing iron through blood loss. Iron supports how your blood carries oxygen to your muscles. Low iron directly impairs training performance and energy. Prioritising iron-rich foods and eating vitamin C alongside them improves absorption by up to 67%. (Source: Angeli et al. European Journal of Sport Science 2016.)' },
      { h: 'Follicular phase' },
      { p: 'The follicular phase runs from the end of your period to just before ovulation. Estrogen is rising steadily. As it rises, mood, motivation, energy, and strength all tend to improve. Insulin sensitivity is higher, meaning your body handles carbohydrates more efficiently. This is generally the best training window of the cycle for most women, with some research suggesting this is when strength adaptations are strongest. (Source: Kissow et al. Sports Medicine 2022; Colenso-Semple et al. Frontiers 2023.)' },
      { h: 'Ovulatory phase' },
      { p: 'Ovulation lasts roughly one to two days. Estrogen peaks. There is a brief surge in testosterone as well. For many women, this is when energy, confidence, and cognitive performance feel best. Peak estrogen also slightly increases the laxity of ligaments. A thorough warmup before heavy training is especially important around ovulation.' },
      { h: 'Luteal phase' },
      { p: 'The luteal phase runs from after ovulation until the start of your next period, typically 12 to 14 days. Progesterone rises significantly, core temperature increases, and resting heart rate is on average 1.7 bpm higher than in the early follicular phase. The same workout will feel harder. That is a measurable physiological difference, not reduced fitness. (Source: De Martin Topranin et al. IJSPP 2023.)' },
      { p: 'Protein needs rise to approximately 1.8 to 2.2g per kg of bodyweight per day because progesterone increases how fast your body breaks down muscle protein. Eating more protein in the luteal phase is not optional if you are training. (Source: ISSN 2023.)' },
      { h: 'What is a normal cycle?' },
      { p: 'A healthy cycle is 21 to 35 days long. Your period may last 3 to 7 days. Mild discomfort is common. Pain that stops you going about your day is not normal and is worth investigating properly.' },
      { cite: 'Sources: Kissow et al. Sports Medicine 2022; Colenso-Semple et al. Frontiers 2023; De Martin Topranin et al. IJSPP 2023; ISSN 2023; Angeli et al. 2016; Sims ST. ROAR. Rodale 2024.' },
    ]
  },
  brain: {
    title: 'Your brain and your cycle',
    content: [
      { h: 'Your mood is not random' },
      { p: 'The way you feel across your cycle is not a personality trait or a lack of emotional control. It is a biological pattern driven by how your hormones interact directly with your brain chemistry. Your hormones do not just affect your reproductive system. They change the actual neurochemical environment of your brain throughout the month.' },
      { h: 'Estrogen and serotonin' },
      { p: 'Estrogen directly drives serotonin production and increases the sensitivity of serotonin receptors in the brain. As estrogen rises through the follicular phase, serotonin activity rises with it. This is why mood, motivation, and mental clarity tend to improve in the first half of your cycle. When estrogen drops sharply in the days before your period, serotonin drops with it. The low mood, reduced motivation, and emotional sensitivity many women experience before their period is a measurable neurochemical event, not a character flaw. (Source: Lokuge et al. Biological Psychiatry 2011; Backstrom et al. 2008.)' },
      { h: 'Progesterone and GABA' },
      { p: 'Progesterone is converted in the brain into a calming compound that works on the same receptors as anti-anxiety medication. This is why the early luteal phase often feels more grounded and peaceful than the week before your period — progesterone is directly calming your nervous system.' },
      { p: 'In the late luteal phase, progesterone drops quickly. When it does, GABA activity falls with it. For many women this creates a rebound effect: anxiety, irritability, low mood, and poor sleep, all arriving in the days before the period starts. The moment your period begins and the hormonal cycle resets, these symptoms lift. That pattern is the clearest way to distinguish PMS from general mood problems. (Source: Backstrom et al. Mol Cell Endocrinol 2014.)' },
      { box: 'Women with PMDD experience a greater neurological response to normal progesterone fluctuations, not abnormally high progesterone levels. The difference is in the brain\'s sensitivity to the change, not the size of the change itself. This is why PMDD is a real, biologically grounded condition that responds to specific treatments. (Source: Osborn et al. Frontiers in Pharmacology 2025.)' },
      { h: 'Knowing the cause changes things' },
      { p: 'Understanding that late luteal mood is hormonal does not make it disappear. But it can help you respond to it differently. Nutritional strategies, training adjustments, sleep prioritisation, and in some cases medical support all have evidence behind them. The emotions are real. They are also explainable. And explainable things are more manageable.' },
      { cite: 'Sources: Backstrom T et al. 2008; Backstrom T et al. Mol Cell Endocrinol 2014; Lokuge S et al. Biological Psychiatry 2011; Osborn E et al. Front Pharmacol 2025; DSM-5 PMDD diagnostic criteria.' },
    ]
  },
  nutrition: {
    title: 'Nutrition and hormones',
    content: [
      { h: 'Your nutritional needs change across your cycle' },
      { p: 'This is not about restriction or a complicated phase-by-phase meal plan. It is about understanding why the same eating habits feel different at different points in your cycle, and why certain things like stronger hunger before your period are biology rather than lack of discipline.' },
      { h: 'Protein needs are higher in the luteal phase' },
      { p: 'Progesterone increases the rate at which your body breaks down muscle protein. In the luteal phase, protein needs rise to approximately 1.8 to 2.2g per kg of bodyweight per day, compared to around 1.5g in the follicular phase. If you are training through the luteal phase without enough protein, you are losing muscle at a faster rate than usual without replacing it. (Source: ISSN 2023; Lariviere et al. Am J Physiol 2006.)' },
      { h: 'Why carbohydrate cravings increase before your period' },
      { p: 'Estrogen improves insulin sensitivity, which means your cells respond well to carbohydrates throughout the follicular phase. When estrogen drops in the late luteal phase, insulin sensitivity decreases and your body starts seeking quick energy sources. This is the biological mechanism behind pre-period carbohydrate cravings. Understanding this means you can plan for increased carbohydrate needs and choose good sources rather than feeling out of control. (Source: Mauvais-Jarvis et al. JCI 2013.)' },
      { h: 'Iron and your period' },
      { p: 'Iron loss during menstruation directly affects how much oxygen your blood can carry to your muscles. Many women with completely normal blood test results are still iron deficient because stored iron (ferritin) is depleted. When stored iron is low, training performance and energy are affected even though a routine test will not flag anything. If you are persistently fatigued, ask your doctor for a full iron panel that includes ferritin, not just a standard blood count. Vitamin C alongside iron-rich foods improves absorption by up to 67%. (Source: Angeli et al. 2016; Burden et al. BJSM 2015.)' },
      { h: 'Creatine' },
      { p: 'Women have naturally lower creatine stores than men. 3 to 5g of creatine monohydrate daily with food supports muscle strength, cognitive function, and mood across all phases of the cycle. It is well-studied and safe. It is particularly useful in the luteal phase when protein breakdown is elevated. (Source: Rawson et al. JISSN 2018; Candow et al. Nutrients 2021.)' },
      { h: 'Fasting and women' },
      { p: 'Intermittent fasting and regularly skipping breakfast may work against you if you are a woman who trains. Research suggests that fasting can suppress the hypothalamic-pituitary-adrenal axis in women, raise cortisol, and disrupt the hormonal cascade that regulates your cycle. Eating within 30 to 60 minutes of waking is particularly important if you train in the morning. (Source: Sims ST. ROAR 2024; Hamadeh MJ et al. Am J Physiol 2005.)' },
      { cite: 'Sources: ISSN 2023; Lariviere F et al. Am J Physiol 2006; Mauvais-Jarvis F et al. JCI 2013; Angeli A et al. 2016; Burden RJ et al. BJSM 2015; Rawson ES et al. JISSN 2018; Candow DG et al. Nutrients 2021; Sims ST. ROAR 2024; Hamadeh MJ et al. Am J Physiol 2005.' },
    ]
  },
  training: {
    title: 'Training and hormones',
    content: [
      { h: 'Exercise science was built on men\'s bodies' },
      { p: 'Until 1993, women were not required to be included in medical research in the United States. The result is that almost every training guideline was developed on male participants and then applied to women without adjustment. Women are not small men. Female physiology differs at the cellular level, and the difference matters for how you train, recover, and fuel. (Source: NIH Revitalization Act 1993; Sims ST. ROAR 2024.)' },
      { h: 'Do strength results actually change by phase?' },
      { p: 'The honest answer is: possibly, but individual variation is large enough that population averages have limited value for any one woman. Some research suggests follicular phase resistance training may produce stronger adaptations (Kissow et al. Sports Medicine 2022). A 2023 review found no consistent evidence that strength outcomes differ reliably by phase once individual variation is accounted for (Colenso-Semple et al. Frontiers 2023). Track your own response across cycles rather than applying a population rule.' },
      { box: 'Your personal pattern across multiple cycles is more useful than any population average. Track how your training feels across phases and let that guide your programming.' },
      { h: 'Why the luteal phase feels harder' },
      { p: 'The same workout genuinely requires more physiological effort in mid and late luteal phase. Core temperature is elevated. Resting heart rate is on average 1.7 bpm higher than in the early follicular phase. Protein breakdown is increased. Cortisol competes with progesterone and compounds the total stress load. Perceived exertion is higher for the same load. This is not in your head. It is a measurable physiological difference. (Source: De Martin Topranin et al. IJSPP 2023; Hackney. JSSM 2006.)' },
      { h: 'Building muscle protects your future health' },
      { p: 'Muscle mass is one of the most important things you can build for long-term hormonal health. It improves insulin sensitivity, supports healthy estrogen metabolism, and directly influences how well you move through perimenopause and menopause. Bone responds to load at every age. Every weighted squat and deadlift stimulates bone formation. (Source: Kohrt WM et al. MSSE 2004.)' },
      { h: 'RED-S: when exercise costs more than it returns' },
      { p: 'Relative Energy Deficiency in Sport happens when energy burned through exercise consistently exceeds energy taken in through food. Your body responds by shutting down non-essential systems, starting with reproduction. You do not need to be an elite athlete or visibly underweight for this to happen. A missing period is not a sign that you are training hard. It is a sign that your body has decided reproduction is too costly given your current energy balance. (Source: Mountjoy M et al. BJSM 2023, IOC RED-S Consensus Statement.)' },
      { cite: 'Sources: Sims ST. ROAR. Rodale 2024; Kissow et al. Sports Medicine 2022; Colenso-Semple et al. Frontiers 2023; De Martin Topranin et al. IJSPP 2023; Hackney AC. JSSM 2006; Kohrt WM et al. MSSE 2004; Mountjoy M et al. BJSM 2023 (IOC RED-S Consensus); NIH Revitalization Act 1993.' },
    ]
  },
  conditions: {
    title: 'Conditions worth knowing about',
    content: [
      { h: 'These conditions are common. They are also commonly missed.' },
      { p: 'If any of the following sounds familiar, you are not imagining it and you are not alone. Each condition has a specific biological mechanism. Each one is manageable with the right support. The biggest obstacle for most women is getting a proper investigation in the first place — because for decades, women\'s pain and symptoms have been dismissed as stress, anxiety, or "just how periods are."' },

      { h: 'PCOS: Polycystic Ovary Syndrome' },
      { p: 'What it is: PCOS is a hormonal condition affecting roughly 1 in 10 women in which the ovaries produce higher levels of androgens (male hormones such as testosterone) than usual. This disrupts ovulation, often causing irregular or absent periods. The underlying driver in around 70% of cases is insulin resistance — the cells become less responsive to insulin, which causes the pancreas to produce more of it, and elevated insulin directly stimulates the ovaries to produce more androgens. This creates a reinforcing cycle.' },
      { p: 'What the experience is like: Irregular cycles (often longer than 35 days or absent entirely), acne, excess facial or body hair, thinning scalp hair, difficulty managing weight, energy crashes after meals, and fatigue. Not every woman with PCOS has all of these. PCOS looks different in different women, which is one reason it is frequently missed.' },
      { p: 'What actually helps: Resistance training is one of the most evidence-supported interventions for PCOS because it directly improves insulin sensitivity, which addresses the root cause. Lower glycaemic index carbohydrates, adequate protein, and reducing ultra-processed foods support the same mechanism. In some cases, metformin (which improves insulin sensitivity) or hormonal treatment is appropriate. Hormonal birth control can suppress PCOS symptoms but does not address insulin resistance — the condition is still there when you stop.' },
      { box: 'PCOS features that look like cycle irregularity can also appear in high-volume female athletes. Over-training without adequate fuel can suppress ovulation and produce an androgen pattern that looks similar to PCOS. This is one reason proper investigation matters. (Rickenlund A et al. JCEM 2003; Teede HJ et al. Human Reproduction 2018)' },
      { p: 'If your cycles are consistently longer than 35 days, absent for months, or very irregular over multiple cycles, ask your doctor about a PCOS investigation. Bring your Em~power cycle log data — a pattern of irregular cycles with energy and mood data is far more useful than a description from memory.' },

      { h: 'Endometriosis' },
      { p: 'What it is: Endometriosis is a condition in which tissue similar to the lining of the uterus grows in other locations — commonly on the ovaries, fallopian tubes, bowel, or bladder. Unlike the uterine lining, this tissue has nowhere to go during your period. It bleeds, causes inflammation, and over time can create scar tissue and adhesions. This process causes pain — sometimes severe — and can affect fertility.' },
      { p: 'What the experience is like: Severe period pain that disrupts daily life, pain during or after sex, painful bowel movements or urination around your period, chronic pelvic pain, heavy or irregular bleeding, and fatigue. Some women with extensive endometriosis have mild symptoms. Some women with minimal disease have severe pain. Symptoms do not always correlate with severity.' },
      { box: 'Endometriosis affects approximately 1 in 10 women and causes an average diagnostic delay of 7 to 10 years from first symptom to diagnosis. That delay exists because pain is routinely minimised by doctors, teachers, and family members. "Painful periods are normal" is one of the most harmful dismissals in women\'s medicine. They are common. They are not always normal. (Nnoaham KE et al. Fertility and Sterility 2011)' },
      { p: 'Management options include pain relief, hormonal treatment to suppress the cycle and slow progression, and surgery to remove lesions. No option is a cure, but effective management significantly improves quality of life. If you have been told period pain is something to simply endure — please pursue a second opinion. Excruciating pain that disrupts your daily life is worth investigating properly.' },
      { p: 'If you experience severe pain, pain with sex, bowel or bladder symptoms around your period, or have struggled to conceive, bring this to your doctor and ask specifically about endometriosis.' },

      { h: 'RED-S: Relative Energy Deficiency in Sport' },
      { p: 'What it is: RED-S happens when the energy you burn through exercise consistently exceeds the energy you take in through food. Your body responds by rationing energy to essential functions and shutting down non-essential ones. Reproduction is considered non-essential — it is the first system to go. The result is disrupted or absent periods, and a cascade of effects on bone density, immune function, metabolic rate, cognitive function, and cardiovascular health.' },
      { p: 'Who it affects: You do not need to be an elite athlete. You do not need to be visibly underweight. RED-S can develop in recreational exercisers who train consistently without eating enough to match their energy output. It is especially common in women who are trying to lose weight while training — the intentional calorie restriction combined with training expenditure can push energy availability below the threshold the body needs to sustain reproductive function.' },
      { box: 'A missing period is not a sign that you are training hard. It is a sign that your body has decided reproduction is too costly given your current energy balance. A missing period is a medical symptom and deserves investigation — not acceptance as a training badge. (Mountjoy M et al. BJSM 2023, IOC Consensus Statement on RED-S)' },
      { p: 'Signs to watch for: Absent or very irregular periods in a woman who was previously cycling. Persistent fatigue that does not improve with rest. Getting ill more frequently than expected. Stress fractures or poor bone density results. Training performance that is not improving despite consistent training. Low mood, poor concentration.' },
      { p: 'The only effective treatment is eating more — consistently and durably. The goal is positive energy availability. If your period has been absent for three months or longer, please see your doctor. Bring your training log and your food intake history. The combination tells the story clearly.' },

      { h: 'PMDD: Premenstrual Dysphoric Disorder' },
      { p: 'What it is: PMDD is a recognised clinical condition in which normal progesterone fluctuations in the late luteal phase trigger a severe neurological response. Women with PMDD do not have abnormally high progesterone — their brains are more sensitive to the normal drop in progesterone before their period. This sensitivity affects serotonin, GABA, and other neurotransmitter systems in a measurable way. PMDD is not a mood disorder. It is a cyclical neurobiological condition.' },
      { p: 'What it looks like: Severe depression, anxiety, irritability, or rage in the 7 to 10 days before menstruation, resolving almost completely within a day or two of the period starting. This cycle-specific pattern is the defining feature. General depression or anxiety that is always present is not PMDD. (DSM-5 PMDD diagnostic criteria require prospective tracking across at least two cycles.)' },
      { p: 'PMDD affects approximately 3 to 8% of women in their reproductive years. It is significantly underdiagnosed because the cyclical pattern is rarely connected to hormones without symptom tracking. If your worst days consistently fall in the week before your period and resolve when it begins — that is clinically significant information. Take your Em~power log data to your doctor. Treatment options include SSRIs (used cyclically, not daily), certain combined oral contraceptives, and in severe cases, medications that temporarily suppress ovarian hormone production. (Source: Osborn E et al. Frontiers in Pharmacology 2025.)' },

      { h: 'Iron deficiency' },
      { p: 'What it is: Iron is essential for how your blood carries oxygen to your muscles and brain. During menstruation, iron is lost with blood. Many active women are quietly iron deficient without knowing it — because standard blood tests check hemoglobin, which can look completely normal while your stored iron is depleted.' },
      { p: 'Why the standard test misses it: Stored iron (ferritin) below 30 mcg/L is considered deficient for active women, even with a normal blood count. At this level, training performance, energy, brain function, and mood are all affected. Your body is not running well, but a routine blood test will not flag anything. (Burden RJ et al. BJSM 2015)' },
      { p: 'What it feels like: Persistent fatigue that does not improve with sleep. Poor training recovery. Breathlessness during exercise that seems disproportionate. Brain fog. Feeling cold when others are not. Restless legs at night.' },
      { p: 'What to do: Ask your doctor for a full iron panel that includes stored iron (ferritin), not just a standard blood count. Eat iron-rich foods — red meat, lentils, dark leafy greens, tofu — alongside vitamin C to improve absorption by up to 67%. Do not take calcium supplements within two hours of iron-rich meals as calcium reduces iron absorption. (Source: Angeli A et al. 2016; Burden RJ et al. BJSM 2015.)' },

      { cite: 'Sources: Teede HJ et al. Human Reproduction 2018; Woodward A et al. Obesity Reviews 2019; Rickenlund A et al. JCEM 2003; Nnoaham KE et al. Fertility and Sterility 2011; Meuleman C et al. Hum Reprod Update 2009; Mountjoy M et al. BJSM 2023 (IOC RED-S); Osborn E et al. Frontiers in Pharmacology 2025; DSM-5 PMDD criteria; Burden RJ et al. BJSM 2015; Angeli A et al. 2016; Harlow SD et al. Climacteric 2012; Manson JE et al. NEJM 2013.' },
    ]
  },
  peri_what: {
    title: 'What is perimenopause?',
    content: [
      { h: 'A transition, not a cliff' },
      { p: 'Perimenopause is the years-long hormonal transition leading up to menopause. Menopause itself is defined as 12 consecutive months without a period. Everything before that point is perimenopause. It is not a single moment. It is a gradual shift that can span 4 to 10 years.' },
      { box: 'Perimenopause can begin as early as the mid-30s in some women, though the average onset is in the early to mid-40s. Symptoms often begin before any noticeable change in cycle regularity. (Harlow SD et al. Climacteric 2012 STRAW+10 staging criteria)' },
      { h: 'What causes the symptoms' },
      { p: 'The primary driver is declining and fluctuating estrogen. Unlike the gradual rise and fall across a menstrual cycle, perimenopausal estrogen can fluctuate wildly day to day and week to week. This unpredictability is what produces symptoms. The brain, bones, cardiovascular system, gut, skin, joints, and sleep architecture all have estrogen receptors, which is why symptoms span so many seemingly unrelated systems.' },
      { h: 'Common early signs' },
      { ul: ['Cycle length changes, becoming shorter or more irregular', 'Sleep disruption, particularly waking in the middle of the night', 'Mood changes, irritability, or low mood that feels different from your normal pattern', 'Brain fog or word-finding difficulty', 'Joint stiffness or new joint pain', 'Changes in energy or exercise tolerance'] },
      { p: 'Hot flashes are well-known but often arrive later in the transition. Many women are well into perimenopause before hot flashes begin.' },
      { cite: 'Sources: Harlow SD et al. Climacteric 2012 (STRAW+10); Freeman EW et al. Archives of General Psychiatry 2004.' },
    ]
  },
  peri_hormones: {
    title: 'Hormones during the transition',
    content: [
      { h: 'Why blood tests are often unhelpful in perimenopause' },
      { p: 'Estrogen levels in perimenopause can be higher on some days than at any point in your reproductive years, and dramatically lower on others. A single blood test is a snapshot of one moment in an extremely variable process. Two tests taken a week apart in perimenopause can show wildly different values. This is one reason why many women are told their results are "normal" when they have significant symptoms.' },
      { box: 'FSH (follicle stimulating hormone) rising above 10 to 12 IU/L is often used as an indicator of perimenopause but alone is not sufficient for diagnosis. Both FSH and estrogen must be interpreted over time and alongside symptoms. (Harlow 2012 STRAW+10)' },
      { h: 'Progesterone drops first' },
      { p: 'Progesterone typically begins declining before estrogen does. Ovulation becomes less frequent, and without ovulation, the luteal phase does not produce progesterone. This creates a relative estrogen dominance even before total estrogen begins to fall, which can drive symptoms such as sleep disruption, mood changes, and heavier periods.' },
      { cite: 'Sources: Harlow SD et al. Climacteric 2012; Prior JC et al. Menopause 2018.' },
    ]
  },
  peri_bone: {
    title: 'Bone health in perimenopause',
    content: [
      { h: 'Why this window matters' },
      { p: 'Estrogen actively protects bone. When estrogen begins to decline in perimenopause, the rate of bone breakdown increases significantly. Women can lose 10 to 20% of their bone density in the 5 years around menopause. The perimenopause years are therefore one of the most important windows for bone-protective behaviour, while estrogen is still present at meaningful levels to support the process.' },
      { box: 'Bone can be built at any age through appropriate mechanical loading. Resistance training and impact exercise stimulate bone formation directly. Every weighted squat, deadlift, or jump you do has a measurable effect on bone mineral density. (Kohrt WM et al. Medicine and Science in Sports and Exercise 2004, ACSM position stand)' },
      { h: 'The two most effective interventions' },
      { p: 'Resistance training: Progressive loading with weights at 70 to 85% of your maximum effort is required to stimulate bone formation. Light resistance and aerobic exercise alone are not sufficient for bone protection. Spine and hip are the most critical sites. Squats, deadlifts, lunges, rows, and overhead pressing load both.' },
      { p: 'Calcium and vitamin D: Calcium 1000mg daily (split across two meals for absorption) and vitamin D 800 to 1000 IU daily are the dietary foundation of bone health during this transition.' },
      { cite: 'Sources: Kohrt WM et al. MSSE 2004 (ACSM position stand); NIH Calcium fact sheet 2022; Endocrine Society Vitamin D guidelines 2011.' },
    ]
  },
  peri_metabolic: {
    title: 'Metabolism and weight in perimenopause',
    content: [
      { h: 'It is not about willpower' },
      { p: 'Body composition changes in perimenopause are driven by hormonal physiology. Declining estrogen changes where the body stores fat, shifting from the hips and thighs toward the abdomen. This is a direct effect of estrogen loss on fat cell distribution. It is not caused by eating more, and it does not respond the same way to calorie restriction as fat gain at other life stages.' },
      { box: 'Estrogen receptors are present on fat cells, muscle cells, and pancreatic beta cells. As estrogen declines, insulin sensitivity decreases, which means the body handles carbohydrates less efficiently and stores fat more readily. (Mauvais-Jarvis F et al. JCI 2013; Carr MC. JCEM 2003)' },
      { h: 'What actually works' },
      { p: 'Resistance training is the single most effective intervention. Building and maintaining muscle mass directly improves insulin sensitivity, counteracts the metabolic slowing that comes with estrogen loss, and changes how the body distributes fat.' },
      { p: 'Protein intake: Higher protein intake preserves muscle during this transition. Target 1.6 to 2.0g per kg of bodyweight daily.' },
      { cite: 'Sources: Mauvais-Jarvis F et al. JCI 2013; Carr MC. JCEM 2003; ISSN 2023 protein position stand.' },
    ]
  },
  peri_sleep: {
    title: 'Sleep in perimenopause',
    content: [
      { h: 'Why sleep changes' },
      { p: 'Sleep disruption is one of the most common and most disruptive symptoms of perimenopause. Multiple hormonal mechanisms are involved: declining progesterone reduces GABA receptor activity that promotes deep sleep, estrogen fluctuations affect temperature regulation, and night sweats can wake women repeatedly through the night. This is not anxiety or stress causing poor sleep. It is direct hormonal interference with sleep architecture.' },
      { box: 'Reproductive hormones are produced and regulated during sleep. Poor sleep worsens hormonal disruption, which worsens sleep, creating a reinforcing cycle. Breaking this cycle is one of the highest-impact interventions in perimenopause. (Sims ST. ROAR 2024; De Martin Topranin et al. IJSPP 2023)' },
      { h: 'Evidence-backed strategies' },
      { ul: ['Keep the bedroom cool. Lower ambient temperature reduces the intensity and frequency of night sweats. 18 to 20 degrees Celsius is often cited.', 'Consistent sleep and wake times. Regulating circadian rhythm is especially important when hormonal disruption is making sleep harder to maintain.', 'Reduce alcohol. Even moderate alcohol significantly worsens sleep quality and increases night sweat frequency.', 'Magnesium glycinate 300 to 400mg before bed. Well-tolerated and associated with improved sleep quality. (Abbasi B et al. J Res Med Sci 2012)', 'Limit screens before bed. Blue light suppresses melatonin, which is already more vulnerable to disruption in perimenopause.'] },
      { cite: 'Sources: Freeman EW et al. Archives General Psychiatry 2004; Abbasi B et al. JRMS 2012; Backstrom T et al. Psychoneuroendocrinology 2014.' },
    ]
  },
  peri_mood: {
    title: 'Mood and mental health in perimenopause',
    content: [
      { h: 'This is hormonal, not personal' },
      { p: 'The hormonal transition into and through menopause is associated with significantly increased risk of depression and mood disorders, particularly in women with no prior history of depression. This is not a psychological weakness or a reaction to getting older. It is a direct effect of hormonal fluctuations on neurotransmitter systems. Estrogen regulates serotonin, dopamine, and norepinephrine production and receptor sensitivity. When estrogen becomes erratic, so does mood.' },
      { box: 'Women with no prior history of depression have roughly two to four times the risk of a depressive episode during perimenopause. This peaks in the late transition, when hormone fluctuations are most extreme. Perimenopausal depression can respond well to hormone therapy, sometimes when antidepressants alone have not been enough. (Freeman EW et al. Archives of General Psychiatry 2004 and 2006; Bromberger JT et al. Depression and Anxiety 2018)' },
      { h: 'What helps' },
      { ul: ['Consistent resistance training and aerobic exercise. Both have strong independent evidence for mood improvement.', 'Sleep protection. Sleep disruption worsens every mood symptom significantly.', 'Hormone therapy. Has good evidence specifically for perimenopausal depression, particularly when mood symptoms coincide with other physical symptoms.'] },
      { p: 'If you are experiencing depression or very low mood during this transition, please speak to a doctor who understands hormonal mental health. What you are experiencing has a physiological cause and is treatable.' },
      { p: 'Crisis support: Crisis Services Canada 1-833-456-4566 or text 45645.' },
      { cite: 'Sources: Freeman EW et al. Arch Gen Psychiatry 2004/2006; Bromberger JT, Epperson CN. Depression and Anxiety 2018; Backstrom T et al. Psychoneuroendocrinology 2014; Osborn E et al. Frontiers Pharmacology 2025.' },
    ]
  },
  peri_exercise: {
    title: 'Exercise in perimenopause',
    content: [
      { h: 'The priority order changes' },
      { p: 'The evidence-based priority order for exercise in perimenopause is different from general fitness recommendations, because declining estrogen creates specific physiological needs that must be addressed directly.' },
      { box: 'Muscle mass is one of the most powerful things you can build for your long-term hormonal health. It improves insulin sensitivity, supports healthy estrogen metabolism, and directly influences how well you transition through perimenopause and menopause. (Wright V; Kohrt WM et al. MSSE 2004)' },
      { h: 'Priority 1: Resistance training' },
      { p: 'Progressive resistance training is the most important form of exercise in perimenopause. It builds and maintains the muscle mass that supports insulin sensitivity and metabolic health, provides direct bone-loading stimulus to protect bone density, and has strong evidence for mood improvement. Aim for 2 to 3 sessions per week at progressive loads. (Kohrt 2004; Bernandez-Vazquez et al. Frontiers 2022)' },
      { h: 'Priority 2: Zone 2 cardio' },
      { p: '30 to 45 minutes of conversational-pace cardio supports mitochondrial density and cardiovascular health without creating the large cortisol response that high intensity training does. In a low-estrogen environment, excess cortisol has a larger hormonal cost. (Sims ST. ROAR 2024)' },
      { h: 'HIIT in perimenopause' },
      { p: 'High intensity interval training is valuable but should be used strategically. In a low-estrogen environment, the cortisol response to HIIT is larger. If HIIT sessions correlate with worsened hot flashes, sleep disruption, or increased fatigue in the days after, reduce frequency and prioritise zone 2 and resistance work instead. (Hackney 2006)' },
      { cite: 'Sources: Kohrt WM et al. MSSE 2004; Sims ST. ROAR 2024; Hackney 2006 JSSM; Bernandez-Vazquez et al. Frontiers 2022.' },
    ]
  },
  peri_nutrition: {
    title: 'Nutrition priorities in perimenopause',
    content: [
      { h: 'The four priorities that matter most' },
      { p: 'Nutrition during perimenopause is not about restriction. It is about making sure specific nutrients are consistently present to support what declining estrogen can no longer do automatically.' },
      { h: 'Protein: 1.6 to 2.0g per kg bodyweight daily' },
      { p: 'Declining estrogen reduces anabolic signalling in muscle tissue, which means the body needs more dietary protein to maintain the same muscle mass. Distribute across 3 to 4 meals and aim for 30 to 40g per meal for optimal muscle protein synthesis. (ISSN 2023)' },
      { h: 'Calcium 1000mg daily and vitamin D 800 to 1000 IU' },
      { p: 'Bone loss accelerates during the transition. Calcium and vitamin D are the dietary foundations of bone protection. Split calcium across two meals. Many women in northern latitudes need a vitamin D supplement, particularly in winter. (Kohrt 2004)' },
      { h: 'Omega-3 fatty acids' },
      { p: 'EPA and DHA reduce systemic inflammation, support cardiovascular health as estrogen protection declines, and may help with mood stability. Aim for 2 to 3 servings of salmon, sardines, or mackerel per week. (Mozaffarian D et al. JAMA 2006)' },
      { h: 'What to reduce' },
      { ul: ['Excess caffeine, which worsens hot flashes and increases calcium excretion', 'Alcohol, which worsens sleep, hot flashes, and mood', 'Ultra-processed foods, which drive insulin resistance already worsened by declining estrogen', 'High-sodium foods, which increase urinary calcium loss'] },
      { cite: 'Sources: ISSN 2023 protein position stand; Kohrt 2004 MSSE; Messina M et al. Nutrients 2021; Mozaffarian D et al. JAMA 2006.' },
    ]
  },
  peri_post: {
    title: 'After menopause: the long view',
    content: [
      { h: 'When the fluctuations finally settle' },
      { p: 'Menopause is a single point in time: 12 consecutive months with no period. Everything after that is postmenopause, and it is not a phase you pass through — it is the rest of your life. The defining difference from perimenopause is that estrogen is no longer swinging up and down; it is now low and steady. For many women that is a genuine relief: the unpredictability of late perimenopause eases, and mood and brain fog often improve once hormones stop fluctuating.' },
      { box: 'In postmenopause the goal shifts from managing fluctuating hormones to protecting long-term health, because the protection estrogen used to provide is now permanently reduced. The habits you build in the first years matter for decades. (Harlow SD et al. Climacteric 2012, STRAW+10)' },
      { h: 'Bone: the first years matter most' },
      { p: 'Bone loss is fastest in the first five to seven years after menopause. Keep up resistance and impact training, prioritise calcium and vitamin D, and ask your doctor whether a bone density (DXA) scan is appropriate for you. Protecting bone now prevents fractures later. (Kohrt WM et al. MSSE 2004)' },
      { h: 'Heart: the new priority' },
      { p: 'Cardiovascular disease is the leading cause of death in women, and risk rises after menopause as estrogen\'s protective effect on blood vessels and cholesterol is lost. Resistance training, regular conversational-pace cardio, and keeping an eye on blood pressure and cholesterol become central rather than optional. (Carr MC. JCEM 2003)' },
      { h: 'Symptoms that persist' },
      { p: 'Hot flashes usually fade within a few years for most women. Vaginal dryness and urinary symptoms do the opposite — they tend to persist and worsen without treatment, and they are easily treated. See the Vaginal and sexual health article. Do not assume these are simply permanent now.' },
      { h: 'HRT after menopause' },
      { p: 'HRT remains an option in postmenopause, and timing still matters most: the evidence is most favourable for women who begin within about 10 years of menopause or before age 60. Whether to start, continue, or stop is an individual decision to make with a doctor who knows your history. (Manson JE et al. NEJM 2013)' },
      { cite: 'Sources: Harlow SD et al. Climacteric 2012 (STRAW+10); Kohrt WM et al. MSSE 2004; Carr MC. JCEM 2003; Manson JE et al. NEJM 2013; The North American Menopause Society position statements.' },
    ]
  },
  peri_gsm: {
    title: 'Vaginal and sexual health',
    content: [
      { h: 'The symptom no one warns you about' },
      { p: 'Vaginal dryness, burning, irritation, discomfort or pain during sex, and urinary changes such as urgency, frequency, or more frequent urinary tract infections are some of the most common effects of menopause. Together these are called genitourinary syndrome of menopause. Unlike hot flashes, which often ease over time, these symptoms tend to be progressive and usually get worse without treatment, not better.' },
      { box: 'Genitourinary syndrome of menopause affects an estimated 50 to 70% of women in and after the menopause transition, yet only a minority ever raise it with a doctor. As estrogen declines, the tissues of the vulva, vagina, and urethra become thinner, less elastic, and less lubricated, and vaginal pH rises — which also raises the risk of irritation and urinary tract infections. (Portman DJ, Gass MLS. Menopause 2014; NAMS GSM Position Statement 2020)' },
      { h: 'It is treatable, and you do not have to accept it' },
      { p: 'Too many women are told that dryness and painful sex are just part of getting older. They are common, but they are not something you have to live with. There are effective options, from non-hormonal to prescription.' },
      { ul: [
        'Vaginal moisturisers used regularly — not only around sex — rehydrate the tissue over time. Lubricants reduce friction during sex. Both are non-hormonal and available without a prescription.',
        'Local vaginal estrogen (a low-dose cream, tablet, or ring) restores the tissue directly. Very little is absorbed into the bloodstream, so it is considered safe for most women, including many who cannot or choose not to take systemic HRT. (NAMS GSM Position Statement 2020)',
        'Pelvic floor physiotherapy can help with urinary urgency and discomfort.',
        'Newer prescription options, including intravaginal DHEA and the oral medication ospemifene, are worth asking your doctor about if simpler measures are not enough.',
      ] },
      { h: 'Desire and libido' },
      { p: 'A change in sex drive around menopause is common and rarely has a single cause. Declining estrogen and testosterone, disrupted sleep, mood changes, and the discomfort of the symptoms above all feed into it. Treating pain and protecting sleep often restores desire on their own, before anything else is needed.' },
      { box: 'For some postmenopausal women with low sexual desire that genuinely distresses them, testosterone therapy has evidence of benefit. It is not a routine treatment and is prescribed off-label in many countries, but it is a legitimate option to discuss with a knowledgeable doctor. (Davis SR et al. Global Consensus Position Statement on the Use of Testosterone Therapy for Women, 2019)' },
      { p: 'You are entitled to a comfortable, satisfying sex life at every age. If discomfort or loss of desire is affecting you, it is a medical issue worth raising — not something to endure quietly.' },
      { cite: 'Sources: Portman DJ, Gass MLS. Menopause 2014 (GSM consensus terminology); The 2020 Genitourinary Syndrome of Menopause Position Statement of The North American Menopause Society. Menopause 2020; Davis SR et al. Global Consensus Position Statement on the Use of Testosterone Therapy for Women. 2019.' },
    ]
  },
  peri_hrt: {
    title: 'HRT explained',
    content: [
      { h: 'What actually happened in 2002' },
      { p: 'In 2002, the Women\'s Health Initiative study published results that caused widespread panic about hormone replacement therapy. Headlines claimed HRT caused breast cancer and heart attacks. Millions of women stopped taking it, and millions more were told not to start.' },
      { p: 'The problem: the conclusions were significantly misapplied. The study used older hormone formulations, recruited women who were on average 63 years old and already more than 10 years past menopause, and published results that did not separate the findings by age group or timing of initiation.' },
      { box: 'When the Women\'s Health Initiative data was later reanalyzed separating women by age and timing of initiation, a different picture emerged. Women who started HRT within 10 years of menopause or before age 60 showed reduced risk of cardiovascular disease, not increased risk. (Manson JE et al. New England Journal of Medicine 2013)' },
      { h: 'Where the evidence stands now' },
      { p: 'Current evidence supports HRT as appropriate for most healthy women in perimenopause or early menopause. For women who start within the recommended window, the best-established benefits are significantly reduced perimenopausal symptoms and reduced risk of osteoporosis. The same data also point to a lower cardiovascular risk than the 2002 headlines suggested, rather than the harm once feared. Effects on long-term cognition are still being researched.' },
      { h: 'This is your decision to make with your doctor' },
      { p: 'HRT is not appropriate for every woman and there are individual risk factors that require assessment. But it is also not the dangerous treatment that decades of misreported science led many women and doctors to believe. If you are suffering significantly from perimenopausal symptoms, you are entitled to a proper evidence-based conversation about your options.' },
      { cite: 'Sources: Manson JE et al. NEJM 2013; British Menopause Society guidelines 2023; International Menopause Society position statement 2016.' },
    ]
  },
  peri_doctor: {
    title: 'Finding a doctor who listens',
    content: [
      { h: 'You may need to advocate for yourself' },
      { p: 'Many women in perimenopause are told their symptoms are stress, anxiety, or depression, and sent away with an antidepressant rather than a hormonal assessment. This is a systemic failure of medical education around women\'s hormonal health, not a reflection of your symptoms. Your symptoms are real. You are entitled to a proper evaluation.' },
      { h: 'What to bring to your appointment' },
      { ul: ['Your Em~power symptom log with weeks or months of daily data showing the pattern of your symptoms', 'A clear description of what symptoms are affecting your life and how long they have been present', 'Your menstrual cycle history including any irregularity or changes over the past 1 to 2 years', 'Family history of menopause timing if known (maternal menopause age is predictive of your own)'] },
      { h: 'Blood tests worth asking about' },
      { p: 'FSH, LH, estradiol, progesterone (7 days post-ovulation if applicable), testosterone, thyroid function (TSH, free T3, free T4), vitamin D (25-OH), full iron panel including ferritin, complete blood count.' },
      { h: 'Questions to ask' },
      { ul: ['Are my symptoms consistent with perimenopause?', 'Am I a candidate for hormone therapy? If not, why not?', 'Are there specialists in women\'s hormonal health you can refer me to?', 'What should I be monitoring for bone health at this stage?'] },
      { cite: 'Sources: Murabito JM et al. JCEM 2005 (menopause timing heritability); Harlow 2012 STRAW+10.' },
    ]
  },
}

function ArticleBody({ content }) {
  return (
    <div style={{ padding:'0 20px 40px' }}>
      {content.map((block, i) => {
        if (block.h) return <h3 key={i} style={{ fontSize:15, fontWeight:700, color:'#2c2820', margin:'24px 0 8px' }}>{block.h}</h3>
        if (block.p) return <p key={i} style={{ fontSize:14, color:'#4a4540', lineHeight:1.7, marginBottom:12 }}>{block.p}</p>
        if (block.box) return <div key={i} style={{ background:'#f5f0e8', borderRadius:10, padding:'14px 16px', margin:'14px 0', fontSize:13, color:'#5a5048', lineHeight:1.65 }}>{block.box}</div>
        if (block.ul) return <ul key={i} style={{ paddingLeft:18, marginBottom:12 }}>{block.ul.map((item,j) => <li key={j} style={{ fontSize:14, color:'#4a4540', lineHeight:1.7, marginBottom:6 }}>{item}</li>)}</ul>
        if (block.cite) return <p key={i} style={{ fontSize:12, color:'#9a9590', fontStyle:'italic', borderTop:'1px solid #ede8e0', paddingTop:12, marginTop:20 }}>{block.cite}</p>
        return null
      })}
    </div>
  )
}

export default function Learn() {
  const navigate = useNavigate()
  const [userPath, setUserPath] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login', { replace: true }); return }
      try {
        const { data: profile } = await supabase.from('profiles').select('user_path,bc_type').eq('id', user.id).single()
        if (profile?.user_path) setUserPath(profile.user_path)
      } catch (err) { console.error('Learn load error:', err) }
    }
    init()
  }, [navigate])

  const article = openArticle ? ARTICLES[openArticle] : null

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Top bar */}
      <div style={{ background:'#f5f0e8', padding:'20px 20px 16px', borderBottom:'1px solid #ede8e0' }}>
        <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase' }}>Em~power</div>
        <div style={{ fontSize:22, fontWeight:700, color:'#2c2820', marginTop:6 }}>Learn</div>
        <div style={{ fontSize:13, color:'#7a7268', marginTop:4, lineHeight:1.5 }}>Science explained clearly. Everything here is based on research conducted on women.</div>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        {SECTIONS.map(s => (
          <div key={s.id} onClick={() => setOpenArticle(s.id)} style={{
            background:'#fff', border:'1px solid #ede8e0', borderRadius:14, marginBottom:10,
            cursor:'pointer', overflow:'hidden',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 16px' }}>
              <div style={{ width:40, height:40, borderRadius:10, background:s.iconBg, color:s.iconColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                <i className={s.icon} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:600, color:'#2c2820' }}>{s.title}</div>
                <div style={{ fontSize:12, color:'#9a9590', marginTop:2, lineHeight:1.4 }}>{s.desc}</div>
              </div>
              <i className="ti ti-chevron-right" style={{ fontSize:16, color:'#c8b89a', flexShrink:0 }} />
            </div>
          </div>
        ))}

        {/* Perimenopause section for Path 4 */}
        {userPath === '4' && (
          <>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', padding:'8px 0 8px', marginTop:8 }}>Perimenopause</div>
            {PERI_SECTIONS.map(s => (
              <div key={s.id} onClick={() => setOpenArticle(s.id)} style={{
                background:'#fff', border:'1px solid #ede8e0', borderRadius:14, marginBottom:10,
                cursor:'pointer', overflow:'hidden',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 16px' }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:s.iconBg, color:s.iconColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    <i className={s.icon} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:'#2c2820' }}>{s.title}</div>
                    <div style={{ fontSize:12, color:'#9a9590', marginTop:2, lineHeight:1.4 }}>{s.desc}</div>
                  </div>
                  <i className="ti ti-chevron-right" style={{ fontSize:16, color:'#c8b89a', flexShrink:0 }} />
                </div>
              </div>
            ))}
          </>
        )}

        {/* Your path card */}
        {userPath && (
          <div onClick={() => setOpenArticle('path_' + userPath)} style={{
            background:'#fff', border:'1px solid #ede8e0', borderRadius:14, marginBottom:10,
            cursor:'pointer', overflow:'hidden',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 16px' }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'#f5f0e8', color:'#8a6a4a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                <i className="ti ti-route" />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:600, color:'#2c2820' }}>Your path</div>
                <div style={{ fontSize:12, color:'#9a9590', marginTop:2, lineHeight:1.4 }}>What to expect based on your specific situation</div>
              </div>
              <i className="ti ti-chevron-right" style={{ fontSize:16, color:'#c8b89a', flexShrink:0 }} />
            </div>
          </div>
        )}

        <div style={{ fontSize:12, color:'#9a9590', lineHeight:1.6, marginBottom:24, padding:16, background:'#f5f0e8', borderRadius:12 }}>
          Em~power is a wellness tracking app, not a medical device. Nothing here is medical advice. Every health claim is traceable to peer-reviewed research. Always consult a healthcare provider for medical decisions.
        </div>
      </div>

      <BottomNav />

      {/* Article bottom sheet */}
      {openArticle && (
        <>
          <div onClick={() => setOpenArticle(null)} style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100
          }} />
          <div style={{
            position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
            width:'100%', maxWidth:420, maxHeight:'92vh',
            background:'#faf8f5', borderRadius:'20px 20px 0 0',
            overflow:'hidden', display:'flex', flexDirection:'column',
            zIndex:101,
          }}>
            <div style={{ padding:'12px 20px 0', textAlign:'center' }}>
              <div style={{ width:36, height:4, background:'#ddd', borderRadius:2, margin:'0 auto 12px' }} />
            </div>
            <div style={{ padding:'0 20px 12px', borderBottom:'1px solid #ede8e0', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
              <div style={{ flex:1 }}>
                <h2 style={{ fontSize:18, fontWeight:700, color:'#2c2820' }}>
                  {article ? article.title : PATH_TITLES[openArticle] || 'Your path'}
                </h2>
              </div>
              <button onClick={() => setOpenArticle(null)} style={{ background:'none', border:'none', fontSize:18, color:'#9a9590', cursor:'pointer', padding:4, lineHeight:1 }}>&#x2715;</button>
            </div>
            <div style={{ overflowY:'auto', flex:1 }}>
              {article
                ? <ArticleBody content={article.content} />
                : <PathContent pathKey={openArticle} />
              }
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const PATH_TITLES = {
  path_1: 'Your path', path_2: 'Your path', path_3: 'Your path', path_4: 'Your path',
}

function PathContent({ pathKey }) {
  if (pathKey === 'path_2') return (
    <ArticleBody content={[
      { h: 'What to expect after stopping hormonal birth control' },
      { p: 'Your cycle will return on its own timeline. For most women after stopping the pill, the first natural cycle returns within 1 to 3 months. After Depo-Provera specifically, cycle return typically takes 9 to 18 months. Around 55% of women have no period at 12 months after their last Depo injection. This is within the normal range and does not indicate a problem.' },
      { p: 'Em~power tracks your recovery signals even before your period returns. Temperature shifts, cervical fluid changes, and mood patterns all emerge during hormonal recovery and give useful information about how your body is progressing.' },
      { h: 'Bone density after Depo-Provera' },
      { p: 'Depo-Provera reduces estrogen and causes measurable bone mineral density loss. The FDA carries a black box warning for this reason. Weight-bearing exercise and resistance training are the most effective non-pharmacological ways to protect and rebuild bone during recovery. Every session you log is doing something real for your long-term bone health. (Source: FDA Depo-Provera prescribing information 2016.)' },
      { h: 'Nutrition during recovery' },
      { p: 'Calcium 600mg twice daily and vitamin D 800 to 1000 IU are recommended during hormonal contraceptive recovery to support bone health. Do not under-eat during this period. Your body is working to restore hormone production and needs consistent energy to do so. (Source: FDA Depo-Provera prescribing information 2016.)' },
      { cite: 'Sources: FDA Depo-Provera prescribing information 2016; Teede HJ et al. Human Reproduction 2018.' },
    ]} />
  )
  if (pathKey === 'path_3') return (
    <ArticleBody content={[
      { h: 'Irregular cycles' },
      { p: 'Irregular cycles can have several causes: stress, under-fuelling, polycystic ovary syndrome, thyroid conditions, perimenopause, or simply natural variation between cycles. Em~power tracks your patterns over time to help you understand which signals are consistent and which are one-off events.' },
      { p: 'When your cycle timing is unpredictable, symptom-based inference becomes especially important. Your energy levels, mood patterns, cervical fluid, and temperature changes all carry hormonal information even without a reliable period date. The more consistently you log, the more accurately Em~power can estimate your phase even when your cycle length varies.' },
      { h: 'When to see a doctor' },
      { p: 'If your cycle is consistently shorter than 21 days or longer than 35 days over multiple cycles, it is worth a proper investigation. Your logged data over time is far more useful to a doctor than a description from memory. Take it with you.' },
      { cite: 'Sources: Teede HJ et al. Human Reproduction 2018; Harlow SD et al. Climacteric 2012.' },
    ]} />
  )
  if (pathKey === 'path_4') return (
    <ArticleBody content={[
      { h: 'Perimenopause' },
      { p: 'Perimenopause is a hormonal transition, not a disease. It can begin as early as the mid-30s and typically spans several years before menopause. The hormonal shifts during this time are real and affect sleep, mood, cognitive function, metabolism, bone density, and how your body responds to exercise. None of this is "just getting older" or "just stress."' },
      { p: 'Tracking your symptoms alongside your cycle data gives you and your doctor a much more accurate picture of where you are in this transition than a single blood test can provide. Hormone levels fluctuate significantly in perimenopause, which is why a single result is often not meaningful.' },
      { h: 'What the evidence actually says about HRT' },
      { p: 'Hormone replacement therapy started within 10 years of menopause or before age 60 is associated with reduced risk of osteoporosis, cardiovascular disease, and cognitive decline for most healthy women. The 2002 study that caused widespread fear around HRT was later found to have been significantly misinterpreted. Current clinical guidance supports HRT as appropriate for most healthy women in perimenopause or early menopause. (Source: Manson JE et al. NEJM 2013.)' },
      { cite: 'Sources: Harlow SD et al. Climacteric 2012 (STRAW+10); Manson JE et al. NEJM 2013; Kohrt WM et al. MSSE 2004.' },
    ]} />
  )
  return (
    <ArticleBody content={[
      { h: 'Tracking your natural cycle' },
      { p: 'Em~power builds a picture of your personal hormonal pattern over time using your logged data. The more consistently you log, the more personalised your recommendations become. Population averages fade out of your recommendations as your personal data builds across cycles.' },
      { p: 'Your personal cycle length, phase timing, energy patterns, and symptom clusters are unique to you. The goal is for this app to learn your cycle, not apply someone else\'s to you.' },
      { cite: 'Sources: Janse de Jonge XAK. Sports Medicine 2003; Munster et al. 2021.' },
    ]} />
  )
}
