// route /learn, science articles and education on hormones, perimenopause, and cycle health
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PHASE_GRID, PHASE_SHEET_INFO } from '../lib/phaseInfo'
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
  { id:'peri_what',     icon:'ti ti-question-mark', iconBg:'#f5f0e8', iconColor:'#8a6a4a', title:'What is perimenopause?',         desc:'What it is, when it starts, and what to expect from this transition' },
  { id:'peri_post',     icon:'ti ti-sun',           iconBg:'#f8f0e0', iconColor:'#a07020', title:'After menopause: the long view',  desc:'What changes once periods have stopped for good, and where to put your energy' },
  { id:'peri_hormones', icon:'ti ti-dna',           iconBg:'#f0e8f8', iconColor:'#7a4a9a', title:'Hormones during the transition',  desc:'How estrogen, progesterone, and FSH change and why that matters' },
  { id:'peri_bone',     icon:'ti ti-bone',           iconBg:'#e8f0f8', iconColor:'#2a5a8a', title:'Bone health',                     desc:'Why bone loss accelerates and what you can do about it right now' },
  { id:'peri_metabolic', icon:'ti ti-activity',       iconBg:'#e8f8e8', iconColor:'#2a6a2a', title:'Metabolism and weight',           desc:'Why body composition changes and what is actually driving it' },
  { id:'peri_sleep',    icon:'ti ti-moon',           iconBg:'#f8f8e8', iconColor:'#6a6a1a', title:'Sleep in perimenopause',          desc:'Why sleep changes and evidence-backed strategies to protect it' },
  { id:'peri_mood',     icon:'ti ti-heart',          iconBg:'#f8e8e8', iconColor:'#8a2a2a', title:'Mood and mental health',          desc:'Hormonal depression is real, not weakness. What the research says and when to seek help' },
  { id:'peri_exercise', icon:'ti ti-barbell',        iconBg:'#f8e8e8', iconColor:'#8a2a2a', title:'Exercise in perimenopause',       desc:'Why the training priority order changes, and what the research supports' },
  { id:'peri_nutrition', icon:'ti ti-salad',          iconBg:'#e8f8e8', iconColor:'#2a6a2a', title:'Nutrition priorities',            desc:'Protein, calcium, vitamin D, phytoestrogens, and what to reduce' },
  { id:'peri_gsm',      icon:'ti ti-heart',          iconBg:'#f8e8f0', iconColor:'#9a2a6a', title:'Vaginal and sexual health',       desc:'Dryness, painful sex, urinary changes, and libido. Common, treatable, and rarely discussed' },
  { id:'peri_hrt',      icon:'ti ti-pill',           iconBg:'#f5f0e8', iconColor:'#8a6a4a', title:'HRT explained',                  desc:'What the 2002 study actually showed, what it did not show, and where the evidence stands now' },
  { id:'peri_doctor',   icon:'ti ti-stethoscope',    iconBg:'#f8f8e8', iconColor:'#6a6a1a', title:'Finding a doctor who listens',    desc:'What to ask, what to bring, and what you are entitled to expect' },
]

const PREG_SECTIONS = [
  { id:'preg_warning',   icon:'ti ti-urgent',     iconBg:'#fdeeee', iconColor:'#a83a20', title:'Warning signs: when to get care', desc:'Your safety net, the signs that mean call your provider now' },
  { id:'preg_trimesters', icon:'ti ti-calendar-heart', iconBg:'#f8e8f0', iconColor:'#9a2a6a', title:'Your trimesters',          desc:'What is happening and how you may feel, week by week' },
  { id:'preg_movement',  icon:'ti ti-stretching', iconBg:'#e8f0f8', iconColor:'#2a5a8a', title:'Moving safely in pregnancy', desc:'What helps, what to modify, and when to stop (SOGC / ACOG)' },
  { id:'preg_nutrition', icon:'ti ti-salad',      iconBg:'#e8f8e8', iconColor:'#2a6a2a', title:'Eating well in pregnancy',  desc:'Key nutrients, what to avoid, and morning-sickness help' },
  { id:'preg_mental',    icon:'ti ti-heart',      iconBg:'#f8e8e8', iconColor:'#8a2a2a', title:'Your mental health',        desc:'Common, real, and treatable, and where to get help' },
  { id:'preg_loss',      icon:'ti ti-heart-broken',iconBg:'#f5f0e8', iconColor:'#8a6a4a', title:'Pregnancy loss',            desc:'Common, almost never your fault, and you are not alone' },
]

const ARTICLES = {
  hormones: {
    title: 'Your hormones',
    content: [
      { h: 'Why your hormone levels are not a fixed number' },
      { p: 'Almost every hormone reference range you have ever seen was built from population averages, often using studies that underrepresented women. Your normal is not the chart. Your normal is your own pattern across multiple cycles over time. A single blood test result tells you almost nothing on its own.' },
      { box: 'The most cited hormone reference values for women come from a study of 97 women across 2,105 cycles. Your personal normal may be different from those averages and still be completely healthy. What matters is your pattern, not a single number. (Munster et al. 2021)' },
      { h: 'Estrogen' },
      { p: 'In an ovulatory cycle, estrogen generally rises through the first half, peaks near ovulation, changes again after ovulation, and falls before a period. The timing and symptoms vary, and some people do not feel a clear pattern.' },
      { p: 'Estrogen interacts with brain, bone, cardiovascular and metabolic systems. Changes may contribute to mood or physical symptoms for some people, but sleep, stress, health, medicines and life events can create the same experiences. A symptom cannot reveal an estrogen level or prove one cause. (Sources: Lokuge et al. 2011; Mauvais-Jarvis et al. 2013.)' },
      { h: 'Progesterone' },
      { p: 'Progesterone generally rises after ovulation. A single calendar date, symptom or app estimate cannot establish whether ovulation occurred or what an individual progesterone level is.' },
      { p: 'Progesterone rises after ovulation and is associated with a small temperature shift. When temperature is measured consistently, a sustained change can retrospectively support an ovulation estimate; it does not predict the exact day in advance or confirm ovulation on its own. You do not have to overhaul protein or training by phase, though many women find aiming for the higher end of their protein range in the luteal phase helps. (Source: Charkoudian and Stachenfeld. Comprehensive Physiology 2014.)' },
      { p: 'Progesterone levels pulse throughout the luteal phase rather than sitting at a constant level. Population charts smooth this into a curve that does not reflect any real woman\'s experience. (Filicori et al. JCEM 1984.)' },
      { h: 'LH' },
      { p: 'Luteinising hormone commonly surges before ovulation, which is what home urine LH tests are designed to detect. A positive result suggests a possible fertile window but does not guarantee ovulation or predict an exact release time; follow the test instructions and use clinical guidance for interpretation.' },
      { h: 'Cortisol' },
      { p: 'Cortisol helps regulate the stress response, metabolism and the sleep-wake cycle. A result must be interpreted using the reporting laboratory’s reference interval together with collection time, sample type, medicines and clinical context. Empower stores a result but does not diagnose from it or use it to change a workout.' },
      { h: 'Thyroid' },
      { p: 'Your thyroid is not a sex hormone, but it is checked alongside them for good reason. An under- or over-active thyroid causes fatigue, low mood, weight changes, and irregular or heavy periods, and those overlap almost exactly with hormonal symptoms. If you have these symptoms, ask your doctor to check thyroid function (TSH, and free T4) as part of the picture, not just sex hormones.' },
      { h: 'A note on hormone testing' },
      { p: 'If you are testing hormones, record the cycle timing, collection time, sample type, units and the laboratory reference interval. A clinician may time progesterone testing relative to expected ovulation rather than using a fixed cycle day. Interpretation depends on the purpose of testing and the full clinical context.' },
      { h: 'From a result to what you actually do' },
      { p: 'A test result is a starting point, not an answer. A number on a page only becomes useful when it is read alongside your symptoms, your cycle day, and your history. Bring your results and your logged symptoms to your doctor and ask three things: what does this mean for me, why might it be happening, and what are my options. You are entitled to leave understanding all three. If you do not, it is reasonable to ask again or to seek a second opinion.' },
      { cite: 'Sources: Munster et al. 2021 (n=97, 2,105 cycles); LifeLabs/EORLA Canadian reference ranges; Charkoudian N, Stachenfeld NS. Comprehensive Physiology 2014; Hackney AC. JSSM 2006; Mauvais-Jarvis F et al. JCI 2013; Lokuge S et al. Biological Psychiatry 2011; Filicori M et al. JCEM 1984.' },
    ]
  },
  sleep: {
    title: 'Sleep and your cycle',
    content: [
      { h: 'Sleep is not passive recovery' },
      { p: 'Sleep is when your body repairs, consolidates memory, and regulates the hormones that drive your cycle, mood, and appetite, so protecting it is one of the highest-value things you can do for how you feel and perform. Your cycle changes sleep in predictable ways, mostly through the temperature and progesterone shifts after ovulation, so it helps to expect a slightly harder stretch premenstrually and set yourself up for it. Stress, illness, medicines, pain, and environment shape sleep too, so one poor night is not a hormonal alarm, it is the repeated pattern that tells you something.' },
      { box: 'Phase-related sleep changes are common, driven mainly by the luteal-phase rise in core temperature and resting heart rate. How much they affect you varies, so tracking your own timing across cycles shows what is truly your pattern and what helps.' },
      { h: 'How sleep changes across your cycle' },
      { p: 'Menstrual phase: Estrogen and progesterone are both at their lowest. Prostaglandins driving cramping can also interrupt sleep, particularly in the first one to two nights.' },
      { p: 'Follicular phase: with estrogen rising and body temperature near baseline, many women find sleep comes more easily and feels more restorative through this stretch. It is a good window to bank consistent, quality sleep to support the harder training this phase invites. Response varies, so notice whether this holds for you.' },
      { p: 'Luteal phase: after ovulation, progesterone raises your core temperature and resting heart rate slightly, which is why sleep can feel lighter or more broken now, especially in the days before your period. Keep the room cooler than usual, wind down earlier, and go easy on alcohol and late caffeine to protect these nights. How much sleep shifts varies from person to person, so track your own pattern to see what helps most (De Martin Topranin et al. 2023).' },
      { h: 'What actually helps' },
      { ul: ['Use a cool, dark room at a temperature comfortable for you.', 'Keep sleep and wake times reasonably consistent when life allows.', 'Move caffeine earlier if you notice it delays or fragments your sleep.', 'Reduce alcohol if it disrupts sleep or worsens night sweats.', 'Seek clinical advice before using a supplement for sleep, especially during pregnancy or with medicines or health conditions.'] },
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
      { p: 'This begins on day one of bleeding and lasts for the period. Estrogen and progesterone are generally low. Energy, mood and pain can fluctuate through these days, and everyone experiences it a little differently.' },
      { p: 'Your body is also losing iron through blood loss. Iron supports how your blood carries oxygen to your muscles. Low iron directly impairs training performance and energy. Prioritising iron-rich foods and eating vitamin C alongside them improves absorption by up to 67%. (Source: Angeli et al. European Journal of Sport Science 2016.)' },
      { h: 'Follicular phase' },
      { p: 'The follicular phase runs from the end of your period to just before ovulation. Estrogen is rising steadily, and as it climbs it supports recovery, mood, motivation, and strength, so many women find energy lifts and training feels easier through this window. Insulin sensitivity is also higher, meaning your body handles carbohydrates more efficiently, so this is a good time to fuel harder sessions with more carbohydrate. Make the most of it: this is often the best window to add load, push intensity, or attempt a strength personal best, and some research suggests follicular resistance training may produce stronger strength adaptations (Kissow et al. Sports Medicine 2022). Individual response varies and the phase effect is not the same for everyone, so use your own tracking to confirm your pattern (McNulty et al. 2020, Sports Medicine; 2023 umbrella review; Colenso-Semple et al. Frontiers 2023).' },
      { h: 'Ovulatory phase' },
      { p: 'Ovulation is the release of an egg, driven by an LH surge at the peak of estrogen. Estrogen and a brief testosterone rise are at their highest around now, so many women feel strong, energetic, and socially confident in this short window, which can make it a good time for hard training or a personal best. Calendar timing only estimates the window, while an LH result and a later sustained temperature rise add context. Because estrogen also loosens ligaments, warm up thoroughly for heavy or explosive sessions, though this is sensible in every phase, not a reason to avoid training now. Peak mood and performance are not guaranteed on any given day, so go by how you actually feel alongside your tracking.' },
      { h: 'Luteal phase' },
      { p: 'The luteal phase runs from after ovulation until the next period. Progesterone rises and then, with estrogen, falls in the final days before your period. As it does, core temperature and resting heart rate edge up and perceived effort often climbs, so the same workout can genuinely feel harder in the mid and late luteal phase. This is a good stretch to keep training but plan for it: favour steady strength and skill work over all-out efforts, warm up a little longer, hydrate well, and treat a flat-feeling session as recovery rather than failure. A roughly 14-day luteal length is a population fallback, not a personal fact, and how strongly you feel these shifts varies, so let your own tracking fill in the detail (De Martin Topranin et al. 2023).' },
      { p: 'Because your body breaks down muscle protein a little faster in the luteal phase, protein is worth prioritising now, aiming for roughly 1.6 to 2.0 g per kg of body weight a day spread across meals, which also helps with recovery and premenstrual appetite. This is a helpful emphasis, not a mandatory phase-specific rule for everyone, so where you land in that range depends on your activity, goals, diet, and health. Empower calculates a general range once body weight is provided.' },
      { h: 'What is a normal cycle?' },
      { p: 'A healthy cycle is 21 to 35 days long. Your period may last 3 to 7 days. Mild discomfort is common. Pain that stops you going about your day is not normal and is worth investigating properly.' },
      { cite: 'Sources: McNulty KL et al. Sports Medicine 2020 (systematic review and meta-analysis); 2023 umbrella review of menstrual cycle and exercise performance; Kissow et al. Sports Medicine 2022; Colenso-Semple et al. Frontiers 2023; De Martin Topranin et al. IJSPP 2023; ISSN 2023; Angeli et al. 2016; Sims ST. ROAR. Rodale 2024.' },
    ]
  },
  brain: {
    title: 'Your brain and your cycle',
    content: [
      { h: 'Your mood is not random' },
      { p: 'Your mood genuinely shifts with your hormones across the cycle, and it is not a personality flaw or something you are imagining. Estrogen rising in the follicular phase tends to lift mood and motivation, while the fall in estrogen and progesterone before your period commonly brings lower mood, irritability, or anxiety for a few days that eases once bleeding starts. Knowing this lets you plan: schedule demanding or social things for your higher-energy weeks where you can, and be kinder to yourself in the days before your period. Mood is not driven by hormones alone, since sleep, stress, and life events matter too, so track the timing to see which shifts are truly cyclical for you.' },
      { h: 'Estrogen and serotonin' },
      { p: 'Estrogen boosts serotonin, the brain chemical tied to steady mood, which is a big reason many women feel brighter and more resilient as estrogen rises and lower as it drops before a period. Practical supports through the premenstrual dip include regular meals with complex carbohydrates, daylight and movement, and protecting sleep. Premenstrual mood symptoms are real and deserve support, and persistent or severe symptoms should never be dismissed as only hormonal (Lokuge et al. 2011; Backstrom et al. 2008).' },
      { h: 'Progesterone and GABA' },
      { p: 'Progesterone metabolites interact with GABA systems. Responses vary: an estimated early-luteal window is not a prediction that someone will feel calm.' },
      { p: 'Some people experience anxiety, irritability, low mood or sleep changes before a period. A repeated pattern that improves after menstruation is useful clinical information, but symptoms do not always lift immediately and can have other causes. (Source: Backstrom et al. 2014.)' },
      { box: 'Women with PMDD experience a greater neurological response to normal progesterone fluctuations, not abnormally high progesterone levels. The difference is in the brain\'s sensitivity to the change, not the size of the change itself. This is why PMDD is a real, biologically grounded condition that responds to specific treatments. (Source: Osborn et al. Frontiers in Pharmacology 2025.)' },
      { h: 'Knowing the cause changes things' },
      { p: 'Understanding timing can help you prepare without assuming causation. Sleep support, movement that feels manageable, regular meals and clinical care can all be considered. Severe mood symptoms or thoughts of self-harm need prompt support regardless of cycle timing.' },
      { cite: 'Sources: Backstrom T et al. 2008; Backstrom T et al. Mol Cell Endocrinol 2014; Lokuge S et al. Biological Psychiatry 2011; Osborn E et al. Front Pharmacol 2025; DSM-5 PMDD diagnostic criteria.' },
    ]
  },
  nutrition: {
    title: 'Nutrition and hormones',
    content: [
      { h: 'Your experience can change across your cycle' },
      { p: 'Appetite and digestion shift with your hormones. In the luteal phase, rising progesterone tends to lift your resting energy needs slightly and can slow digestion, so many women feel hungrier and a little more bloated in the two weeks before a period, then notice appetite settle once bleeding begins. Work with this rather than against it: eat to your hunger, lean on protein and fibre to stay satisfied, and expect to need a touch more food premenstrually. The direction and size of these changes vary between women, so this is a rhythm to notice, not a rigid phase-by-phase meal plan or a reason to restrict.' },
      { h: 'Protein needs depend on the person and activity' },
      { p: 'Protein is the nutrient most women under-eat, and it does more than build muscle: it steadies appetite, supports recovery, and helps counter the faster muscle-protein breakdown of the luteal phase. A practical target for active women is roughly 1.6 to 2.0 g per kg of body weight a day, spread across three or four meals of about 30 to 40 g each. This is a range to aim within, not a mandatory luteal-phase number for everyone, so goals, diet, pregnancy, kidney health, and clinical advice shape where you fit. Empower uses a broad activity-informed range once body weight is provided.' },
      { h: 'Why carbohydrate cravings increase before your period' },
      { p: 'Carbohydrate cravings in the late luteal phase are real and have a biological basis: as estrogen and progesterone fall, serotonin dips too, and carbohydrate helps the brain make more of it, so your body is reaching for a genuine lift. Meet the craving in a way that lasts, pairing complex carbohydrates like oats, whole grains, or sweet potato with protein to steady your energy and mood, rather than only fast sugar that spikes and crashes. Cravings are not a moral failure and are not driven by hormones alone, since sleep, stress, and under-eating feed into them too, so keep meals regular and satisfying across the day.' },
      { h: 'Iron and your period' },
      { p: 'Iron loss during menstruation directly affects how much oxygen your blood can carry to your muscles. Many women with completely normal blood test results are still iron deficient because stored iron (ferritin) is depleted. When stored iron is low, training performance and energy are affected even though a routine test will not flag anything. If you are persistently fatigued, ask your doctor for a full iron panel that includes ferritin, not just a standard blood count. Vitamin C alongside iron-rich foods improves absorption by up to 67%. (Source: Angeli et al. 2016; Burden et al. BJSM 2015.)' },
      { h: 'Creatine' },
      { p: 'Creatine monohydrate has evidence for strength and training support, but a supplement dose is not personalised by cycle phase. Ask a clinician or sports dietitian whether it fits your goals, pregnancy status, medicines and health. (Sources: Rawson et al. 2018; Candow et al. 2021.)' },
      { h: 'Fasting and women' },
      { p: 'Intermittent fasting is not automatically helpful or harmful for women. It may be a poor fit if it causes under-fuelling, worsens recovery or symptoms, or conflicts with pregnancy, diabetes, medicines or an eating-disorder history. Cycle phase alone does not require a breakfast window.' },
      { cite: 'Sources: ISSN 2023; Lariviere F et al. Am J Physiol 2006; Mauvais-Jarvis F et al. JCI 2013; Angeli A et al. 2016; Burden RJ et al. BJSM 2015; Rawson ES et al. JISSN 2018; Candow DG et al. Nutrients 2021; Sims ST. ROAR 2024; Hamadeh MJ et al. Am J Physiol 2005.' },
    ]
  },
  training: {
    title: 'Training and hormones',
    content: [
      { h: 'Exercise science was built on men\'s bodies' },
      { p: 'Until 1993, women were not required to be included in medical research in the United States. The result is that almost every training guideline was developed on male participants and then applied to women without adjustment. Women are not small men. Female physiology differs at the cellular level, and the difference matters for how you train, recover, and fuel. (Source: NIH Revitalization Act 1993; Sims ST. ROAR 2024.)' },
      { h: 'Do strength results actually change by phase?' },
      { p: 'Here is what the science supports. In the follicular phase, rising estrogen aids recovery and muscle adaptation, and some research suggests resistance training loaded into this phase may produce stronger strength gains (Kissow et al. Sports Medicine 2022). A practical way to use that: keep training consistently all month, but when you can, schedule your heaviest lifts and progression attempts in the week or two after your period, and treat the late luteal days as a good time for steady, quality work. A 2023 review found strength outcomes do not differ reliably by phase once individual variation is accounted for, so this is a helpful tilt, not a hard rule (Colenso-Semple et al. Frontiers 2023). Track your own response across a few cycles to see how strongly the pattern holds for you.' },
      { box: 'Consistency across the whole month builds strength; phase timing is a fine-tuning tool on top of that. Track how your training feels across phases and let your own pattern guide the details.' },
      { h: 'Why the luteal phase can feel harder' },
      { p: 'For many women the same workout requires more physiological effort in the mid and late luteal phase. Core temperature is elevated. Resting heart rate is on average 1.7 bpm higher than in the early follicular phase. Your body breaks down muscle protein faster. Cortisol competes with progesterone and can compound the total stress load. Perceived exertion is often higher for the same load. When you feel this, it is not in your head, it is a measurable physiological difference. What to do with it: keep training, but expect to work harder for the same numbers, so warm up longer, push a little more protein to support recovery, prioritise sleep and hydration, and save all-out efforts for earlier in the cycle when you can. How strongly this hits you varies between individuals, so let your own tracked response fine-tune the plan (De Martin Topranin et al. IJSPP 2023; Hackney. JSSM 2006).' },
      { h: 'A hard day is information, not failure' },
      { p: 'For many women, energy, strength, and coordination shift across the cycle, so a flat session or heavy-legged race day in the menstrual or late-luteal phase is often physiology rather than a lack of effort or fitness. Coaches and athletes tend to blame a bad day on being tired, run-down, or "off," when where she is in her cycle is part of the picture. Naming that changes how you respond: instead of pushing harder and digging a hole, treat your tougher-feeling days as quality-and-recovery work, and load your hardest efforts and progression into the days you reliably feel strong. When a fixed event like a tryout or competition lands on a day you tend to feel flat, you cannot move your cycle, but you can prepare for it with a longer warm-up, extra carbohydrate and iron-rich fuelling, and realistic expectations. The size of these phase effects is small and varies between individuals, so build your plan around your own tracked pattern rather than a universal rule (McNulty et al. 2020, Sports Medicine; 2023 umbrella review; De Martin Topranin et al. IJSPP 2023; Kissow et al. Sports Medicine 2022; Colenso-Semple et al. Frontiers 2023).' },
      { h: 'Building muscle protects your future health' },
      { p: 'Muscle mass is one of the most important things you can build for long-term hormonal health. It improves insulin sensitivity, supports healthy estrogen metabolism, and directly influences how well you move through perimenopause and menopause. Bone responds to load at every age. Every weighted squat and deadlift stimulates bone formation. (Source: Kohrt WM et al. MSSE 2004.)' },
      { h: 'RED-S: when exercise costs more than it returns' },
      { p: 'Relative Energy Deficiency in Sport happens when energy burned through exercise consistently exceeds energy taken in through food. Your body responds by shutting down non-essential systems, starting with reproduction. You do not need to be an elite athlete or visibly underweight for this to happen. A missing period is not a sign that you are training hard. It is a sign that your body has decided reproduction is too costly given your current energy balance. (Source: Mountjoy M et al. BJSM 2023, IOC RED-S Consensus Statement.)' },
      { cite: 'Sources: Sims ST. ROAR. Rodale 2024; McNulty KL et al. Sports Medicine 2020 (systematic review and meta-analysis); 2023 umbrella review of menstrual cycle and exercise performance; Kissow et al. Sports Medicine 2022; Colenso-Semple et al. Frontiers 2023; De Martin Topranin et al. IJSPP 2023; Hackney AC. JSSM 2006; Kohrt WM et al. MSSE 2004; Mountjoy M et al. BJSM 2023 (IOC RED-S Consensus); NIH Revitalization Act 1993.' },
    ]
  },
  conditions: {
    title: 'Conditions worth knowing about',
    content: [
      { h: 'These conditions are common. They are also commonly missed.' },
      { p: 'If any of the following sounds familiar, you are not imagining it and you are not alone. Each condition has a specific biological mechanism. Each one is manageable with the right support. The biggest obstacle for most women is getting a proper investigation in the first place, because for decades, women\'s pain and symptoms have been dismissed as stress, anxiety, or "just how periods are."' },

      { h: 'PCOS: Polycystic Ovary Syndrome' },
      { p: 'What it is: PCOS is a hormonal condition affecting roughly 1 in 10 women in which the ovaries produce higher levels of androgens (male hormones such as testosterone) than usual. This disrupts ovulation, often causing irregular or absent periods. The underlying driver in around 70% of cases is insulin resistance. The cells become less responsive to insulin, which causes the pancreas to produce more of it, and elevated insulin directly stimulates the ovaries to produce more androgens. This creates a reinforcing cycle.' },
      { p: 'Prevalence and presentation vary by ethnicity. PCOS is more common in South Asian women, who also tend to develop insulin resistance and symptoms at a lower body weight, so weight-based screening can miss them. If this sounds like you, it is worth raising regardless of your size. (Teede HJ et al. Human Reproduction 2018)' },
      { p: 'What the experience is like: Irregular cycles (often longer than 35 days or absent entirely), acne, excess facial or body hair, thinning scalp hair, difficulty managing weight, energy crashes after meals, and fatigue. Not every woman with PCOS has all of these. PCOS looks different in different women, which is one reason it is frequently missed.' },
      { p: 'What actually helps: Resistance training is one of the most evidence-supported interventions for PCOS because it directly improves insulin sensitivity, which addresses the root cause. Lower glycaemic index carbohydrates, adequate protein, and reducing ultra-processed foods support the same mechanism. In some cases, metformin (which improves insulin sensitivity) or hormonal treatment is appropriate. Hormonal birth control can suppress PCOS symptoms but does not address insulin resistance. The condition is still there when you stop.' },
      { box: 'PCOS features that look like cycle irregularity can also appear in high-volume female athletes. Over-training without adequate fuel can suppress ovulation and produce an androgen pattern that looks similar to PCOS. This is one reason proper investigation matters. (Rickenlund A et al. JCEM 2003; Teede HJ et al. Human Reproduction 2018)' },
      { p: 'If your cycles are consistently longer than 35 days, absent for months, or very irregular over multiple cycles, ask your doctor about a PCOS investigation. Bring your Em~power cycle log data. A pattern of irregular cycles with energy and mood data is far more useful than a description from memory.' },

      { h: 'Endometriosis' },
      { p: 'What it is: Endometriosis is a condition in which tissue similar to the lining of the uterus grows in other locations, commonly on the ovaries, fallopian tubes, bowel, or bladder. Unlike the uterine lining, this tissue has nowhere to go during your period. It bleeds, causes inflammation, and over time can create scar tissue and adhesions. This process causes pain, sometimes severe, and can affect fertility.' },
      { p: 'What the experience is like: Severe period pain that disrupts daily life, pain during or after sex, painful bowel movements or urination around your period, chronic pelvic pain, heavy or irregular bleeding, and fatigue. Some women with extensive endometriosis have mild symptoms. Some women with minimal disease have severe pain. Symptoms do not always correlate with severity.' },
      { box: 'Endometriosis affects approximately 1 in 10 women and causes an average diagnostic delay of 7 to 10 years from first symptom to diagnosis. That delay exists because pain is routinely minimised by doctors, teachers, and family members. "Painful periods are normal" is one of the most harmful dismissals in women\'s medicine. They are common. They are not always normal. (Nnoaham KE et al. Fertility and Sterility 2011)' },
      { p: 'Management options include pain relief, hormonal treatment to suppress the cycle and slow progression, and surgery to remove lesions. No option is a cure, but effective management significantly improves quality of life. If you have been told period pain is something to simply endure, please pursue a second opinion. Excruciating pain that disrupts your daily life is worth investigating properly.' },
      { p: 'If you experience severe pain, pain with sex, bowel or bladder symptoms around your period, or have struggled to conceive, bring this to your doctor and ask specifically about endometriosis.' },

      { h: 'Fibroids' },
      { p: 'What they are: Fibroids are common non-cancerous growths of muscle in or on the wall of the uterus. Many women have them with no symptoms at all; others have heavy or prolonged bleeding, pelvic pressure or pain, and a feeling of fullness low in the abdomen.' },
      { p: 'What the experience is like: The most common sign is heavy menstrual bleeding, sometimes with clots, periods lasting longer than a week, pelvic pressure, lower back ache, or needing to pass urine more often. Heavy bleeding over time can also lead to iron deficiency.' },
      { box: 'Fibroids are more common, tend to appear earlier, and are often more severe in Black women, who are also more likely to have their symptoms dismissed. Heavy or painful periods deserve a proper assessment, not reassurance that it is just normal. (Eltoukhi HM et al. American Journal of Obstetrics and Gynecology 2014)' },
      { p: 'What helps: Treatment depends on your symptoms and ranges from iron replacement and medication that lightens bleeding to procedures that shrink or remove fibroids. If your periods are heavy enough to disrupt your life, soak through protection quickly, or leave you exhausted, ask your doctor about fibroids and bring your Em~power flow and pain log.' },

      { h: 'RED-S: Relative Energy Deficiency in Sport' },
      { p: 'What it is: RED-S happens when the energy you burn through exercise consistently exceeds the energy you take in through food. Your body responds by rationing energy to essential functions and shutting down non-essential ones. Reproduction is considered non-essential, and it is the first system to go. The result is disrupted or absent periods, and a cascade of effects on bone density, immune function, metabolic rate, cognitive function, and cardiovascular health.' },
      { p: 'Who it affects: You do not need to be an elite athlete. You do not need to be visibly underweight. RED-S can develop in recreational exercisers who train consistently without eating enough to match their energy output. It is especially common in women who are trying to lose weight while training, because the intentional calorie restriction combined with training expenditure can push energy availability below the threshold the body needs to sustain reproductive function.' },
      { box: 'A missing period is not a sign that you are training hard. It is a sign that your body has decided reproduction is too costly given your current energy balance. A missing period is a medical symptom and deserves investigation, not acceptance as a training badge. (Mountjoy M et al. BJSM 2023, IOC Consensus Statement on RED-S)' },
      { p: 'Signs to watch for: Absent or very irregular periods in a woman who was previously cycling. Persistent fatigue that does not improve with rest. Getting ill more frequently than expected. Stress fractures or poor bone density results. Training performance that is not improving despite consistent training. Low mood, poor concentration.' },
      { p: 'The only effective treatment is eating more, consistently and durably. The goal is positive energy availability. If your period has been absent for three months or longer, please see your doctor. Bring your training log and your food intake history. The combination tells the story clearly.' },

      { h: 'PMDD: Premenstrual Dysphoric Disorder' },
      { p: 'What it is: PMDD is a recognised clinical condition in which normal progesterone fluctuations in the late luteal phase trigger a severe neurological response. Women with PMDD do not have abnormally high progesterone. Their brains are more sensitive to the normal drop in progesterone before their period. This sensitivity affects serotonin, GABA, and other neurotransmitter systems in a measurable way. PMDD is not a mood disorder. It is a cyclical neurobiological condition.' },
      { p: 'What it looks like: Severe depression, anxiety, irritability, or rage in the 7 to 10 days before menstruation, resolving almost completely within a day or two of the period starting. This cycle-specific pattern is the defining feature. General depression or anxiety that is always present is not PMDD. (DSM-5 PMDD diagnostic criteria require prospective tracking across at least two cycles.)' },
      { p: 'PMDD affects approximately 3 to 8% of women in their reproductive years. It is significantly underdiagnosed because the cyclical pattern is rarely connected to hormones without symptom tracking. If your worst days consistently fall in the week before your period and resolve when it begins, that is clinically significant information. Take your Em~power log data to your doctor. Treatment options include SSRIs (used cyclically, not daily), certain combined oral contraceptives, and in severe cases, medications that temporarily suppress ovarian hormone production. (Source: Osborn E et al. Frontiers in Pharmacology 2025.)' },

      { h: 'Iron deficiency' },
      { p: 'What it is: Iron is essential for how your blood carries oxygen to your muscles and brain. During menstruation, iron is lost with blood. Many active women are quietly iron deficient without knowing it, because standard blood tests check hemoglobin, which can look completely normal while your stored iron is depleted.' },
      { p: 'Why the standard test misses it: Stored iron (ferritin) below 30 mcg/L is considered deficient for active women, even with a normal blood count. At this level, training performance, energy, brain function, and mood are all affected. Your body is not running well, but a routine blood test will not flag anything. (Burden RJ et al. BJSM 2015)' },
      { p: 'One important nuance: iron results are harder to interpret if you carry a blood trait such as thalassemia or sickle cell trait, which are more common in women of South Asian, Mediterranean, Middle Eastern, African, and Caribbean heritage. These can change how hemoglobin and ferritin should be read, so mention any known trait to your doctor and never start iron supplements without a blood test confirming you need them.' },
      { p: 'What it feels like: Persistent fatigue that does not improve with sleep. Poor training recovery. Breathlessness during exercise that seems disproportionate. Brain fog. Feeling cold when others are not. Restless legs at night.' },
      { p: 'What to do: Ask your doctor for a full iron panel that includes stored iron (ferritin), not just a standard blood count. Eat iron-rich foods such as red meat, lentils, dark leafy greens, and tofu, alongside vitamin C to improve absorption by up to 67%. Do not take calcium supplements within two hours of iron-rich meals as calcium reduces iron absorption. (Source: Angeli A et al. 2016; Burden RJ et al. BJSM 2015.)' },

      { cite: 'Sources: Teede HJ et al. Human Reproduction 2018; Woodward A et al. Obesity Reviews 2019; Rickenlund A et al. JCEM 2003; Nnoaham KE et al. Fertility and Sterility 2011; Meuleman C et al. Hum Reprod Update 2009; Eltoukhi HM et al. American Journal of Obstetrics and Gynecology 2014; Mountjoy M et al. BJSM 2023 (IOC RED-S); Osborn E et al. Frontiers in Pharmacology 2025; DSM-5 PMDD criteria; Burden RJ et al. BJSM 2015; Angeli A et al. 2016; Harlow SD et al. Climacteric 2012; Gold EB et al. SWAN Study, AJPH 2011; Manson JE et al. NEJM 2013.' },
    ]
  },
  peri_what: {
    title: 'What is perimenopause?',
    content: [
      { h: 'A transition, not a cliff' },
      { p: 'Perimenopause is the years-long hormonal transition leading up to menopause. Menopause itself is defined as 12 consecutive months without a period. Everything before that point is perimenopause. It is not a single moment. It is a gradual shift that can span 4 to 10 years.' },
      { box: 'Perimenopause can begin as early as the mid-30s in some women, though the average onset is in the early to mid-40s. Symptoms often begin before any noticeable change in cycle regularity. On average, Black and Hispanic or Latina women enter the transition earlier and have a longer, more symptomatic one than white women, so symptoms in your late 30s deserve to be taken seriously. (Harlow SD et al. Climacteric 2012; Gold EB et al. SWAN Study, American Journal of Public Health 2011)' },
      { box: 'One thing to never ignore: any bleeding after you have gone 12 full months with no period (postmenopausal bleeding) should be checked by a doctor promptly. Most causes turn out to be harmless, but it always needs to be looked at. The same goes for unusually heavy or sudden between-period bleeding during perimenopause. (ACOG)' },
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
      { p: 'Calcium and vitamin D: adequate calcium (studies use around 1000mg daily, split across two meals for absorption) and vitamin D (around 800 to 1000 IU) are the dietary foundation of bone health during this transition. Your doctor can confirm the right amounts for you.' },
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
      { p: 'Sleep disruption is common during perimenopause. Hormonal changes and night sweats can contribute, while stress, anxiety, medicines, pain and sleep disorders may also be involved. Persistent sleep problems deserve assessment rather than being assigned to one cause automatically.' },
      { box: 'Reproductive hormones are produced and regulated during sleep. Poor sleep worsens hormonal disruption, which worsens sleep, creating a reinforcing cycle. Breaking this cycle is one of the highest-impact interventions in perimenopause. (Sims ST. ROAR 2024; De Martin Topranin et al. IJSPP 2023)' },
      { h: 'Evidence-backed strategies' },
      { ul: ['Keep the bedroom cool. Lower ambient temperature reduces the intensity and frequency of night sweats. 18 to 20 degrees Celsius is often cited.', 'Consistent sleep and wake times. Regulating circadian rhythm is especially important when hormonal disruption is making sleep harder to maintain.', 'Reduce alcohol. Even moderate alcohol significantly worsens sleep quality and increases night sweat frequency.', 'Magnesium glycinate before bed (studies use around 300 to 400mg) is well tolerated and associated with improved sleep quality. Check with your doctor before starting. (Abbasi B et al. J Res Med Sci 2012)', 'Limit screens before bed. Blue light suppresses melatonin, which is already more vulnerable to disruption in perimenopause.'] },
      { cite: 'Sources: Freeman EW et al. Archives General Psychiatry 2004; Abbasi B et al. JRMS 2012; Backstrom T et al. Psychoneuroendocrinology 2014.' },
    ]
  },
  peri_mood: {
    title: 'Mood and mental health in perimenopause',
    content: [
      { h: 'Symptoms are real and can have more than one cause' },
      { p: 'The hormonal transition into and through menopause is associated with significantly increased risk of depression and mood disorders, particularly in women with no prior history of depression. This is not a psychological weakness or a reaction to getting older. It is a direct effect of hormonal fluctuations on neurotransmitter systems. Estrogen regulates serotonin, dopamine, and norepinephrine production and receptor sensitivity. When estrogen becomes erratic, so does mood.' },
      { box: 'Women with no prior history of depression have roughly two to four times the risk of a depressive episode during perimenopause. This peaks in the late transition, when hormone fluctuations are most extreme. Perimenopausal depression can respond well to hormone therapy, sometimes when antidepressants alone have not been enough. (Freeman EW et al. Archives of General Psychiatry 2004 and 2006; Bromberger JT et al. Depression and Anxiety 2018)' },
      { h: 'Brain fog, focus, and being assessed for ADHD' },
      { p: 'Estrogen supports dopamine, the brain chemical behind focus, motivation, and attention. As estrogen becomes erratic in perimenopause, many women notice real problems with concentration, word-finding, and follow-through. Clinicians increasingly see women in their late 30s and 40s assessed for or diagnosed with ADHD around this time. For some it is ADHD that went unrecognised earlier; for others the transition is driving or unmasking the symptoms. Both are worth raising with a doctor, because both are treatable. The point is simple: do not assume focus problems at this age are just stress or a personal failing. (Osborn E et al. Frontiers in Pharmacology 2025)' },
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
      { h: 'Calcium and vitamin D for bone health' },
      { p: 'Bone loss accelerates during the transition. Calcium and vitamin D are the dietary foundations of bone protection. Split calcium across two meals. Many women need a vitamin D supplement, particularly in winter, at northern latitudes, or if you have darker skin, since more melanin reduces how much vitamin D your skin makes from sunlight. A simple blood test can confirm your level. (Kohrt 2004)' },
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
      { p: 'Menopause is a single point in time: 12 consecutive months with no period. Everything after that is postmenopause, and it is not a phase you pass through. It is the rest of your life. The defining difference from perimenopause is that estrogen is no longer swinging up and down; it is now low and steady. For many women that is a genuine relief: the unpredictability of late perimenopause eases, and mood and brain fog often improve once hormones stop fluctuating.' },
      { box: 'In postmenopause the goal shifts from managing fluctuating hormones to protecting long-term health, because the protection estrogen used to provide is now permanently reduced. The habits you build in the first years matter for decades. (Harlow SD et al. Climacteric 2012, STRAW+10)' },
      { h: 'Bone: the first years matter most' },
      { p: 'Bone loss is fastest in the first five to seven years after menopause. Keep up resistance and impact training, prioritise calcium and vitamin D, and ask your doctor whether a bone density (DXA) scan is appropriate for you. Protecting bone now prevents fractures later. (Kohrt WM et al. MSSE 2004)' },
      { h: 'Heart: the new priority' },
      { p: 'Cardiovascular disease is the leading cause of death in women, and risk rises after menopause as estrogen\'s protective effect on blood vessels and cholesterol is lost. Resistance training, regular conversational-pace cardio, and keeping an eye on blood pressure and cholesterol become central rather than optional. (Carr MC. JCEM 2003)' },
      { h: 'Symptoms that persist' },
      { p: 'Hot flashes usually fade within a few years for most women. Vaginal dryness and urinary symptoms do the opposite. They tend to persist and worsen without treatment, and they are easily treated. See the Vaginal and sexual health article. Do not assume these are simply permanent now.' },
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
      { box: 'Genitourinary syndrome of menopause affects an estimated 50 to 70% of women in and after the menopause transition, yet only a minority ever raise it with a doctor. As estrogen declines, the tissues of the vulva, vagina, and urethra become thinner, less elastic, and less lubricated, and vaginal pH rises, which also raises the risk of irritation and urinary tract infections. (Portman DJ, Gass MLS. Menopause 2014; NAMS GSM Position Statement 2020)' },
      { h: 'It is treatable, and you do not have to accept it' },
      { p: 'Too many women are told that dryness and painful sex are just part of getting older. They are common, but they are not something you have to live with. There are effective options, from non-hormonal to prescription.' },
      { ul: [
        'Vaginal moisturisers used regularly, not only around sex, rehydrate the tissue over time. Lubricants reduce friction during sex. Both are non-hormonal and available without a prescription.',
        'Local vaginal estrogen (a low-dose cream, tablet, or ring) restores the tissue directly. Very little is absorbed into the bloodstream, so it is considered safe for most women, including many who cannot or choose not to take systemic HRT. (NAMS GSM Position Statement 2020)',
        'Pelvic floor physiotherapy can help with urinary urgency and discomfort.',
        'Newer prescription options, including intravaginal DHEA and the oral medication ospemifene, are worth asking your doctor about if simpler measures are not enough.',
      ] },
      { h: 'Desire and libido' },
      { p: 'A change in sex drive around menopause is common and rarely has a single cause. Declining estrogen and testosterone, disrupted sleep, mood changes, and the discomfort of the symptoms above all feed into it. Treating pain and protecting sleep often restores desire on their own, before anything else is needed.' },
      { box: 'For some postmenopausal women with low sexual desire that genuinely distresses them, testosterone therapy has evidence of benefit. It is not a routine treatment and is prescribed off-label in many countries, but it is a legitimate option to discuss with a knowledgeable doctor. (Davis SR et al. Global Consensus Position Statement on the Use of Testosterone Therapy for Women, 2019)' },
      { p: 'You are entitled to a comfortable, satisfying sex life at every age. If discomfort or loss of desire is affecting you, it is a medical issue worth raising, not something to endure quietly.' },
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

  // ── Pregnancy (path 6), educational + safety, always provider-led ──────────────
  preg_trimesters: {
    title: 'Your trimesters',
    content: [
      { h: 'First trimester (weeks 1 to 13)' },
      { p: 'After conception, hCG (the "pregnancy hormone") rises quickly while estrogen and progesterone climb to support the pregnancy. This surge is behind most early symptoms: deep tiredness, nausea or "morning sickness" that can strike any time of day, tender breasts, needing to pee more, food aversions, a heightened sense of smell, and bigger mood swings. Many women feel more wiped out now than at any other point, even with little to show yet. It usually eases as the second trimester begins.' },
      { h: 'Second trimester (weeks 14 to 27)' },
      { p: 'Often called the "golden" stretch. Nausea and fatigue commonly settle, energy returns, and the bump becomes visible. Somewhere around 18 to 25 weeks many women first feel the baby move. Hormones are high but more stable. Common new sensations: round-ligament aches as the uterus stretches, mild swelling, nasal congestion, and occasional heartburn.' },
      { h: 'Third trimester (weeks 28 to 40+)' },
      { p: 'The baby grows fast and your body works hard. Common feelings: shortness of breath as the uterus presses upward, heartburn, back and pelvic ache, swollen feet and ankles, trouble sleeping, frequent urination, and Braxton-Hicks ("practice") contractions that come and go without a pattern. Feeling large, uncomfortable, and impatient near the end is completely normal.' },
      { cite: 'Sources: NHS Pregnancy; Mayo Clinic; ACOG. Educational only, your care is led by your doctor or midwife.' },
    ]
  },
  preg_movement: {
    title: 'Moving safely in pregnancy',
    content: [
      { box: 'Before starting or continuing any exercise in pregnancy, get cleared by your doctor or midwife. This guidance is general and assumes a healthy pregnancy with no complications. It is not a personal exercise prescription.' },
      { h: 'How much, and how hard' },
      { p: 'In a healthy pregnancy, accumulating about 150 minutes of moderate movement a week across most days lowers the risk of several complications (including gestational diabetes, preeclampsia, and excessive weight gain) and is safe, physical activity is not linked to miscarriage, preterm birth, or low birth weight. Judge intensity with the talk test: you should be able to hold a conversation. Daily pelvic-floor (Kegel) exercises help reduce the risk of urinary incontinence. (SOGC 2019)' },
      { h: 'Good options' },
      { p: 'Walking, swimming or aquafitness, stationary cycling, prenatal yoga, prenatal pilates, and light resistance work all suit pregnancy. Strength training is fine, keep loads light to moderate, breathe out on effort (never hold your breath), and avoid lifting to failure.' },
      { h: 'Modify or avoid' },
      { p: 'From about 16 weeks, stop exercises lying flat on your back (use incline, side-lying, seated, or standing positions). Skip deep abdominal "crunch" work and deep twists to protect against ab separation, avoid end-range stretching (your ligaments are looser from relaxin), and never hold your breath under effort. Avoid activities with a fall or impact risk (contact sports, off-road cycling, skiing, horse riding), scuba diving, hot yoga or hot pilates, and exercising in the heat. Stay well hydrated and cool. (ACOG 804)' },
      { box: 'Stop exercising and contact your provider for: vaginal bleeding, fluid leaking from the vagina, regular painful contractions, chest pain, shortness of breath before you start, dizziness or feeling faint, a headache, calf pain or swelling, or muscle weakness affecting your balance.' },
      { h: 'After birth' },
      { p: 'Return gradually and only when you are physically and medically ready, often around the 6-week check, and later with clearance after a caesarean or complicated birth. Pelvic-floor recovery and gentle deep-core work should come before running or heavy lifting; a pelvic-health physiotherapy check is worth asking about.' },
      { cite: 'Sources: SOGC/CSEP 2019 Canadian Guideline for Physical Activity throughout Pregnancy (Mottola et al.); ACOG Committee Opinion 804.' },
    ]
  },
  preg_nutrition: {
    title: 'Eating well in pregnancy',
    content: [
      { h: '"Eating for two" is a myth' },
      { p: 'You need only modest extra energy, but more of certain nutrients. No extra calories are needed in the first trimester, then about +340 kcal a day in the second and +450 in the third. Protein needs rise to roughly 1.1 g per kg of body weight a day. (Health Canada; ACOG)' },
      { h: 'The nutrients that matter most' },
      { p: 'A daily prenatal vitamin with folic acid (400 mcg, ideally started before conception) and iron is the foundation, folic acid is the most evidence-backed nutrient for preventing neural-tube defects. Also prioritise calcium, vitamin D, iodine, choline (eggs are a great source), and omega-3 DHA from 2 to 3 servings a week of low-mercury fish, or a supplement if you do not eat fish. Confirm all doses with your provider. (Health Canada; SOGC; ACOG)' },
      { h: 'Foods and drinks to avoid' },
      { p: 'Alcohol, none, there is no known safe amount. High-mercury fish (shark, swordfish, marlin, king mackerel, tilefish, fresh tuna). Unpasteurised milk and soft cheeses (brie, camembert, feta, blue). Deli meats and hot dogs unless heated until steaming. Raw or undercooked meat, eggs, fish, and sushi. Raw sprouts. Unwashed produce. And caffeine over about 200 mg a day (roughly one coffee). These carry listeria, mercury, or toxoplasma risks that matter more in pregnancy.' },
      { h: 'For morning sickness' },
      { p: 'Small, frequent meals so your stomach is never empty, dry bland carbohydrates (toast, crackers) before getting up, ginger, and sipping fluids between rather than with meals can all help. If you cannot keep fluids down or are losing weight, contact your provider, there are safe treatments.' },
      { cite: 'Sources: Health Canada Prenatal Nutrition Guidelines; Canada\'s Food Guide; ACOG. Confirm amounts with your doctor, midwife, or registered dietitian.' },
    ]
  },
  preg_warning: {
    title: 'Warning signs: when to get care',
    content: [
      { box: 'This is your safety net. Get care right away, call your provider, or emergency services (911) if it is severe, for any of the signs below. Always tell them you are pregnant, or have been within the past year.' },
      { ul: [
        'A headache that will not go away or gets worse',
        'Dizziness or fainting',
        'Changes in vision, blurring, flashing lights, or blind spots',
        'A fever of 38°C (100.4°F) or higher',
        'Extreme or sudden swelling of your hands or face',
        'Thoughts of harming yourself or your baby',
        'Trouble breathing',
        'Chest pain or a fast-beating heart',
        'Severe nausea and vomiting, unable to keep fluids down',
        'Severe belly pain that does not go away',
        'Your baby moving much less than usual (once movement is established)',
        'Vaginal bleeding or fluid leaking during pregnancy',
        'Heavy bleeding or discharge after birth',
        'Severe swelling, redness, or pain in a leg or arm',
        'Regular contractions before 37 weeks',
        'Overwhelming, unrelieved tiredness',
      ] },
      { p: 'Trust your instinct: if something feels wrong, or you are not sure whether it is serious, call your provider. Serious problems can also happen after the birth, so these warning signs keep mattering for a full year postpartum. (CDC)' },
      { cite: 'Sources: CDC HEAR HER / ACOG Urgent Maternal Warning Signs; NHS; SOGC.' },
    ]
  },
  preg_mental: {
    title: 'Your mental health',
    content: [
      { h: 'Common, real, and treatable' },
      { p: 'Depression and anxiety during pregnancy and the first year after birth affect roughly 1 in 7 women. They are genuine medical conditions, not a weakness or a parenting failure, and they can begin during pregnancy, not only afterward. (ACOG)' },
      { p: 'The "baby blues", feeling teary, overwhelmed, and up and down, affect most women in the first couple of weeks after birth and usually lift on their own. Symptoms that are severe, last beyond two weeks, or stop you functioning point toward perinatal depression or anxiety and deserve care. Postpartum psychosis (confusion, hallucinations, paranoia, rapidly shifting mood) is rare but a medical emergency.' },
      { p: 'Tell your OB, midwife, or doctor, screening is recommended and treatment works, including therapy and medications considered safe in pregnancy and breastfeeding. If you ever have thoughts of harming yourself or your baby, that is urgent: call or text 988, the Suicide and Crisis Lifeline, available 24/7 in Canada and the US.' },
      { cite: 'Sources: ACOG (perinatal depression screening); CDC; NHS.' },
    ]
  },
  preg_loss: {
    title: 'Pregnancy loss',
    content: [
      { p: 'Miscarriage is common, about 15% of recognised pregnancies end in loss (Quenby et al. The Lancet 2021), and many more very early losses happen before a positive test is even possible. If it happens to you, it is almost never your fault.' },
      { p: 'Most early losses are caused by random chromosomal differences in the developing pregnancy, not by exercise, lifting, working, stress, sex, an argument, a food, or anything you did or did not do. Women are rarely told this clearly, and many silently blame themselves. Please do not.' },
      { p: 'After a loss, your hormones re-settle over several weeks and a period usually returns within about 4 to 8 weeks. Your provider will guide your care. If you have had two or more losses, it is worth asking for a specialist evaluation, and most women who experience recurrent loss go on to have a healthy pregnancy.' },
      { p: 'If you are grieving, that grief is real and it is valid. Support is available through your provider and through pregnancy-loss organisations, and you do not have to carry it alone.' },
      { cite: 'Sources: Quenby S et al. The Lancet 2021; ACOG; NHS; RCOG.' },
    ]
  },
}

// Estimate reading time from an article's content blocks at ~200 words per minute.
function countWords(text) {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

function readMinutes(content) {
  if (!content) return 1
  let words = 0
  content.forEach(block => {
    if (block.h) words += countWords(block.h)
    if (block.p) words += countWords(block.p)
    if (block.box) words += countWords(block.box)
    if (block.cite) words += countWords(block.cite)
    if (block.ul) block.ul.forEach(item => { words += countWords(item) })
  })
  return Math.max(1, Math.round(words / 200))
}

// Read-time label, styled as subtle metadata.
function ReadTime({ minutes }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#9a9590', marginTop:5 }}>
      <i className="ti ti-clock" style={{ fontSize:12, color:'#c8b89a' }} />
      {minutes} min read
    </span>
  )
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

// Optional ethnicity → ancestry-linked health notes. ADDITIVE only: this surfaces info that
// is more relevant to the user, it never hides anything and is never a diagnosis. Population
// patterns, not predictions. Each note can deep-link into an existing Learn article.
const ETHNICITY_NOTES = {
  black: [
    { text:'Fibroids are more common, tend to start earlier, and can be more severe. Get heavy or painful periods properly assessed. (Eltoukhi et al. 2014)', article:'conditions' },
    { text:'Perimenopause tends to begin earlier and last longer, so symptoms in your late 30s are worth taking seriously. (SWAN, Gold et al. 2011)', article:'peri_what' },
    { text:'Darker skin makes less vitamin D from sunlight, so deficiency is more likely. A simple blood test can check your level.' },
    { text:'Sickle cell trait is more common and can change how iron and anaemia results should be read. Mention it to your doctor.', article:'conditions' },
  ],
  south_asian: [
    { text:'PCOS is more common and can appear at a lower body weight, so weight-based screening can miss it. Raise it regardless of your size. (Teede et al. 2018)', article:'conditions' },
    { text:'Insulin resistance and type 2 diabetes risk are higher, often at a lower BMI. Protein-forward, lower-GI eating and resistance training help most. (WHO Expert Consultation, Lancet 2004)' },
    { text:'Vitamin D deficiency is very common and worth testing for.' },
    { text:'Thalassemia trait is more common and affects how iron results read. Mention any known trait to your doctor.', article:'conditions' },
  ],
  east_asian: [
    { text:'Lactose intolerance is common, so our calcium guidance leads with non-dairy sources like tofu, fortified milks, leafy greens, and tinned sardines.' },
    { text:'Lower average bone density makes resistance and impact training especially valuable for long-term bone health.' },
  ],
  southeast_asian: [
    { text:'Lactose intolerance is common, so our calcium guidance leads with non-dairy sources like tofu, fortified milks, leafy greens, and tinned sardines.' },
    { text:'Thalassemia trait is more common and affects how iron results read. Mention any known trait to your doctor.', article:'conditions' },
  ],
  hispanic: [
    { text:'Perimenopause tends to begin earlier and be more symptomatic, so late-30s changes are worth taking seriously. (SWAN, Gold et al. 2011)', article:'peri_what' },
    { text:'Insulin resistance and gestational diabetes risk can be higher. Protein-forward, lower-GI eating helps.' },
  ],
  mena: [
    { text:'Vitamin D deficiency is very common. A simple blood test can check your level.' },
    { text:'Thalassemia trait is more common and affects how iron results read. Mention any known trait to your doctor.', article:'conditions' },
  ],
  indigenous: [
    { text:'Diabetes and insulin-resistance risk can be higher in some communities. Protein-forward, lower-GI eating and resistance training help.' },
    { text:'Your tracked log data is useful to bring to appointments, especially where access to care is a barrier.' },
  ],
  white: [
    { text:'Few ethnicity-specific flags apply, so your personal pattern over time is your best guide. Vitamin D can still dip in winter at northern latitudes.' },
  ],
  other: [
    { text:'We could not map specific notes to your selection, so explore the articles below, and remember your personal pattern over time is always the best guide.' },
  ],
}

export default function Learn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [userPath, setUserPath] = useState(null)
  const [ethnicity, setEthnicity] = useState([])
  const [openArticle, setOpenArticle] = useState(null)
  const [phaseSheet, setPhaseSheet] = useState(null) // the tapped phase in the cycle-phases grid

  // Deep link: /learn?article=hormones opens that article directly (used by Ask Em~power "Read more").
  useEffect(() => {
    const a = searchParams.get('article')
    if (a) setOpenArticle(a)
  }, [searchParams])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login', { replace: true }); return }
      try {
        const { data: profile } = await supabase.from('profiles').select('user_path,bc_type,ethnicity').eq('id', user.id).maybeSingle()
        if (profile?.user_path) setUserPath(profile.user_path)
        if (profile?.ethnicity) { try { const e = JSON.parse(profile.ethnicity); setEthnicity(Array.isArray(e) ? e : []) } catch { /* ignore */ } }
      } catch { /* ignore */ }
    }
    init()
  }, [navigate])

  const article = openArticle ? ARTICLES[openArticle] : null

  // Gather de-duplicated health notes for the user's selected background(s).
  const myNotes = []
  const seenNotes = new Set()
  ethnicity.filter(e => e !== 'prefer_not').forEach(code => {
    (ETHNICITY_NOTES[code] || []).forEach(n => { if (!seenNotes.has(n.text)) { seenNotes.add(n.text); myNotes.push(n) } })
  })

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Top bar */}
      <div style={{ background:'#f5f0e8', padding:'calc(20px + var(--sat)) 20px 16px', borderBottom:'1px solid #ede8e0' }}>
        <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase' }}>Em~power</div>
        <div style={{ fontSize:22, fontWeight:700, color:'#2c2820', marginTop:6 }}>Learn</div>
        <div style={{ fontSize:13, color:'#7a7268', marginTop:4, lineHeight:1.5 }}>Science explained clearly. Everything here is based on research conducted on women.</div>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        {/* Prep for a doctor visit, moved here from the home screen: turn tracked data into a
            clear summary to bring to an appointment. */}
        <button type="button" onClick={() => navigate('/visit-prep')} style={{ cursor:'pointer', width:'100%', textAlign:'left', font:'inherit', display:'flex', alignItems:'center', gap:12, background:'#faf7f1', border:'1px solid #e4d8c2', borderRadius:14, padding:'14px 16px', marginBottom:14 }}>
          <div style={{ width:38, height:38, borderRadius:11, background:'#f0e6d2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className="ti ti-clipboard-heart" aria-hidden="true" style={{ fontSize:19, color:'#a07a40' }} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, color:'#2c2820' }}>Prep for a doctor visit</div>
            <div style={{ fontSize:12, color:'#7a7268', marginTop:1, lineHeight:1.4 }}>Turn your tracking into a clear summary to bring to your appointment.</div>
          </div>
          <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize:16, color:'#c8b89a', flexShrink:0 }} />
        </button>

        {/* Relevant for you, surfaces ancestry-linked health info the user selected at
            signup. Additive only: population patterns, never a diagnosis, never hides content. */}
        {myNotes.length > 0 && (
          <div style={{ background:'#fff', border:'1px solid #d8d8ea', borderRadius:14, marginBottom:14, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px 10px' }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#5a5a8a', marginBottom:4 }}>Relevant for you</div>
              <div style={{ fontSize:11, color:'#9a9590', lineHeight:1.55 }}>These are population patterns, not predictions about you. Everyone is different. This is general information to discuss with your doctor, never a diagnosis.</div>
            </div>
            {myNotes.map((n, i) => {
              const noteStyle = { display:'flex', alignItems:'flex-start', gap:10, padding:'11px 16px', borderTop:'1px solid #f0f0f6', cursor:n.article?'pointer':'default' }
              const inner = <>
                <i className="ti ti-point-filled" aria-hidden="true" style={{ color:'#9a9aca', fontSize:14, flexShrink:0, marginTop:2 }} />
                <div style={{ flex:1, fontSize:13, color:'#3a3a4a', lineHeight:1.55 }}>{n.text}</div>
                {n.article && <i className="ti ti-chevron-right" aria-hidden="true" style={{ color:'#c8b89a', fontSize:15, flexShrink:0, marginTop:2 }} />}
              </>
              return n.article ? (
                <button type="button" key={i} onClick={() => setOpenArticle(n.article)}
                  style={{ ...noteStyle, width:'100%', textAlign:'left', font:'inherit', background:'none', border:'none' }}>{inner}</button>
              ) : (
                <div key={i} style={noteStyle}>{inner}</div>
              )
            })}
          </div>
        )}

        {/* Your cycle phases, interactive grid (moved here from the dashboard). Tap a phase for
            its detail sheet. Shown only to natural-cycle paths, hidden for hormonal birth control
            (5), perimenopause (4), and pregnancy (6), who don't have a rotating natural cycle. */}
        {userPath !== '6' && userPath !== '5' && userPath !== '4' && (
          <>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', padding:'4px 0 10px' }}>Your cycle phases</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              {PHASE_GRID.map(p => (
                <button type="button" key={p.name} onClick={() => setPhaseSheet(p.name)} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:'16px 14px', cursor:'pointer', textAlign:'left', font:'inherit', color:'#2c2820' }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:p.iconBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                    <i className={`ti ${p.icon}`} aria-hidden="true" style={{ fontSize:22, color:p.iconColor }} />
                  </div>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:3 }}>{p.name}</div>
                  <div style={{ fontSize:11, color:'#9a9590', lineHeight:1.4 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Pregnancy users get their own focused guide (cycle articles don't apply). */}
        {userPath === '6' && (
          <>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', padding:'4px 0 10px' }}>Your pregnancy</div>
            {PREG_SECTIONS.map(s => (
              <button type="button" key={s.id} onClick={() => setOpenArticle(s.id)} style={{ display:'block', width:'100%', textAlign:'left', font:'inherit', background:'#fff', border:'1px solid #ede8e0', borderRadius:14, marginBottom:10, cursor:'pointer', overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 16px' }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:s.iconBg, color:s.iconColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}><i className={s.icon} aria-hidden="true" /></div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:'#2c2820' }}>{s.title}</div>
                    <div style={{ fontSize:12, color:'#9a9590', marginTop:2, lineHeight:1.4 }}>{s.desc}</div>
                    {ARTICLES[s.id] && <ReadTime minutes={readMinutes(ARTICLES[s.id].content)} />}
                  </div>
                  <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize:16, color:'#c8b89a', flexShrink:0 }} />
                </div>
              </button>
            ))}
            <div style={{ fontSize:11, color:'#9a9590', lineHeight:1.6, padding:'6px 4px 16px', textAlign:'center' }}>Educational only. Your pregnancy care is led by your doctor or midwife.</div>
          </>
        )}

        {userPath !== '6' && SECTIONS.map(s => (
          <button type="button" key={s.id} onClick={() => setOpenArticle(s.id)} style={{
            display:'block', width:'100%', textAlign:'left', font:'inherit',
            background:'#fff', border:'1px solid #ede8e0', borderRadius:14, marginBottom:10,
            cursor:'pointer', overflow:'hidden',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 16px' }}>
              <div style={{ width:40, height:40, borderRadius:10, background:s.iconBg, color:s.iconColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                <i className={s.icon} aria-hidden="true" />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:600, color:'#2c2820' }}>{s.title}</div>
                <div style={{ fontSize:12, color:'#9a9590', marginTop:2, lineHeight:1.4 }}>{s.desc}</div>
                {ARTICLES[s.id] && <ReadTime minutes={readMinutes(ARTICLES[s.id].content)} />}
              </div>
              <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize:16, color:'#c8b89a', flexShrink:0 }} />
            </div>
          </button>
        ))}

        {/* Perimenopause section for Path 4 */}
        {userPath === '4' && (
          <>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', padding:'8px 0 8px', marginTop:8 }}>Perimenopause</div>
            {PERI_SECTIONS.map(s => (
              <button type="button" key={s.id} onClick={() => setOpenArticle(s.id)} style={{
                display:'block', width:'100%', textAlign:'left', font:'inherit',
                background:'#fff', border:'1px solid #ede8e0', borderRadius:14, marginBottom:10,
                cursor:'pointer', overflow:'hidden',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 16px' }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:s.iconBg, color:s.iconColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    <i className={s.icon} aria-hidden="true" />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:'#2c2820' }}>{s.title}</div>
                    <div style={{ fontSize:12, color:'#9a9590', marginTop:2, lineHeight:1.4 }}>{s.desc}</div>
                    {ARTICLES[s.id] && <ReadTime minutes={readMinutes(ARTICLES[s.id].content)} />}
                  </div>
                  <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize:16, color:'#c8b89a', flexShrink:0 }} />
                </div>
              </button>
            ))}
          </>
        )}

        {/* Your path card */}
        {userPath && (
          <button type="button" onClick={() => setOpenArticle('path_' + userPath)} style={{
            display:'block', width:'100%', textAlign:'left', font:'inherit',
            background:'#fff', border:'1px solid #ede8e0', borderRadius:14, marginBottom:10,
            cursor:'pointer', overflow:'hidden',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 16px' }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'#f5f0e8', color:'#8a6a4a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                <i className="ti ti-route" aria-hidden="true" />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:600, color:'#2c2820' }}>Your path</div>
                <div style={{ fontSize:12, color:'#9a9590', marginTop:2, lineHeight:1.4 }}>What to expect based on your specific situation</div>
                <ReadTime minutes={readMinutes(PATH_ARTICLES['path_' + userPath] || PATH_ARTICLES.default)} />
              </div>
              <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize:16, color:'#c8b89a', flexShrink:0 }} />
            </div>
          </button>
        )}

        <div style={{ fontSize:10, color:'#b0a89a', lineHeight:1.5, marginBottom:24, padding:'0 4px', textAlign:'center' }}>
          Wellness education, not medical advice. Always consult a healthcare provider for medical decisions.
        </div>
      </div>

      <BottomNav />

      {/* Article bottom sheet */}
      {openArticle && (
        <>
          <button type="button" aria-label="Close" onClick={() => setOpenArticle(null)} style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, border:'none', padding:0, cursor:'pointer'
          }} />
          <div role="dialog" aria-modal="true" aria-label={article ? article.title : PATH_TITLES[openArticle] || 'Your path'} style={{
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
              <button type="button" aria-label="Close" onClick={() => setOpenArticle(null)} style={{ background:'none', border:'none', fontSize:18, color:'#9a9590', cursor:'pointer', padding:4, lineHeight:1 }}>&#x2715;</button>
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

      {/* Cycle-phase detail sheet (moved here from the dashboard) */}
      {phaseSheet && (() => {
        const info = PHASE_SHEET_INFO[phaseSheet] || PHASE_SHEET_INFO.Follicular
        return (
          <>
            <button type="button" aria-label="Close" onClick={() => setPhaseSheet(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, border:'none', padding:0, cursor:'pointer' }} />
            <div role="dialog" aria-modal="true" aria-label={phaseSheet} style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:420, maxHeight:'88vh', background:'#faf8f5', borderRadius:'20px 20px 0 0', overflow:'hidden', display:'flex', flexDirection:'column', zIndex:201 }}>
              <div style={{ padding:'12px 20px 0', textAlign:'center', flexShrink:0 }}>
                <div style={{ width:36, height:4, background:'#ddd', borderRadius:2, margin:'0 auto 12px' }} />
              </div>
              <div style={{ padding:'0 20px 12px', borderBottom:'1px solid #ede8e0', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:18, fontWeight:600 }}>{phaseSheet}</div>
                <button type="button" aria-label="Close" onClick={() => setPhaseSheet(null)} style={{ background:'none', border:'none', fontSize:20, color:'#9a9590', cursor:'pointer' }}>&#x2715;</button>
              </div>
              <div style={{ overflowY:'auto', flex:1, padding:'16px 20px 40px' }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:10 }}>What is happening</div>
                {info.bullets.map((b,i) => (
                  <div key={i} style={{ display:'flex', gap:10, marginBottom:10 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'#c8b89a', flexShrink:0, marginTop:6 }} />
                    <div style={{ fontSize:14, color:'#3a3530', lineHeight:1.6 }}>{b}</div>
                  </div>
                ))}
                <div style={{ background:'#f5f0e8', borderRadius:12, padding:'12px 14px', margin:'16px 0' }}>
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>What to expect</div>
                  <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6 }}>{info.expect}</div>
                </div>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:10, marginTop:16 }}>Hormone picture</div>
                {[{key:'estrogen',label:'Estrogen'},{key:'progesterone',label:'Progesterone'}].map(h => (
                  <div key={h.key} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:'12px 14px', marginBottom:10 }}>
                    <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{h.label}</div>
                    <div style={{ fontSize:13, color:'#7a7268', marginBottom:6 }}>{info[h.key]?.direction}</div>
                    {info[h.key]?.patterns?.map((p,i) => (
                      <div key={i} style={{ display:'flex', gap:8, marginBottom:4 }}>
                        <div style={{ width:4, height:4, borderRadius:'50%', background:'#c8b89a', flexShrink:0, marginTop:7 }} />
                        <div style={{ fontSize:12, color:'#5a5048', lineHeight:1.5 }}>{p}</div>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ fontSize:11, color:'#9a9590', fontStyle:'italic', marginTop:8 }}>Sources: Munster et al. 2021 (n=97 women, 2,105 cycles). LifeLabs/EORLA Canadian reference ranges. Your personal normal may be different from population averages.</div>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

const PATH_TITLES = {
  path_1: 'Your path', path_2: 'Your path', path_3: 'Your path', path_4: 'Your path',
}

const PATH_ARTICLES = {
  path_2: [
    { h: 'What to expect after stopping hormonal birth control' },
    { p: 'Your cycle will return on its own timeline. For most women after stopping the pill, the first natural cycle returns within 1 to 3 months. After Depo-Provera specifically, cycle return typically takes 9 to 18 months. Around 55% of women have no period at 12 months after their last Depo injection. This is within the normal range and does not indicate a problem.' },
    { p: 'Em~power tracks your recovery signals even before your period returns. Temperature shifts, cervical fluid changes, and mood patterns all emerge during hormonal recovery and give useful information about how your body is progressing.' },
    { h: 'Bone density after Depo-Provera' },
    { p: 'Depo-Provera reduces estrogen and causes measurable bone mineral density loss. The FDA carries a black box warning for this reason. Weight-bearing exercise and resistance training are the most effective non-pharmacological ways to protect and rebuild bone during recovery. Every session you log is doing something real for your long-term bone health. (Source: FDA Depo-Provera prescribing information 2016.)' },
    { h: 'Nutrition during recovery' },
    { p: 'Calcium and vitamin D are especially important during hormonal contraceptive recovery to support bone health (studies use roughly 600mg calcium twice daily and 800 to 1000 IU vitamin D, and your doctor can confirm what is right for you). Do not under-eat during this period. Your body is working to restore hormone production and needs consistent energy to do so. (Source: FDA Depo-Provera prescribing information 2016.)' },
    { cite: 'Sources: FDA Depo-Provera prescribing information 2016; Teede HJ et al. Human Reproduction 2018.' },
  ],
  path_3: [
    { h: 'Irregular cycles' },
    { p: 'Irregular cycles can have several causes: stress, under-fuelling, polycystic ovary syndrome, thyroid conditions, perimenopause, or simply natural variation between cycles. Em~power tracks your patterns over time to help you understand which signals are consistent and which are one-off events.' },
    { p: 'When your cycle timing is unpredictable, symptom-based inference becomes especially important. Your energy levels, mood patterns, cervical fluid, and temperature changes all carry hormonal information even without a reliable period date. The more consistently you log, the more accurately Em~power can estimate your phase even when your cycle length varies.' },
    { h: 'When to see a doctor' },
    { p: 'If your cycle is consistently shorter than 21 days or longer than 35 days over multiple cycles, it is worth a proper investigation. Your logged data over time is far more useful to a doctor than a description from memory. Take it with you.' },
    { cite: 'Sources: Teede HJ et al. Human Reproduction 2018; Harlow SD et al. Climacteric 2012.' },
  ],
  path_4: [
    { h: 'Perimenopause' },
    { p: 'Perimenopause is a hormonal transition, not a disease. It can begin as early as the mid-30s and typically spans several years before menopause. The hormonal shifts during this time are real and affect sleep, mood, cognitive function, metabolism, bone density, and how your body responds to exercise. None of this is "just getting older" or "just stress."' },
    { p: 'Tracking your symptoms alongside your cycle data gives you and your doctor a much more accurate picture of where you are in this transition than a single blood test can provide. Hormone levels fluctuate significantly in perimenopause, which is why a single result is often not meaningful.' },
    { h: 'What the evidence actually says about HRT' },
    { p: 'Hormone replacement therapy started within 10 years of menopause or before age 60 is associated with reduced risk of osteoporosis, cardiovascular disease, and cognitive decline for most healthy women. The 2002 study that caused widespread fear around HRT was later found to have been significantly misinterpreted. Current clinical guidance supports HRT as appropriate for most healthy women in perimenopause or early menopause. (Source: Manson JE et al. NEJM 2013.)' },
    { cite: 'Sources: Harlow SD et al. Climacteric 2012 (STRAW+10); Manson JE et al. NEJM 2013; Kohrt WM et al. MSSE 2004.' },
  ],
  default: [
    { h: 'Tracking your natural cycle' },
    { p: 'Em~power builds a picture of your personal hormonal pattern over time using your logged data. The more consistently you log, the more personalised your recommendations become. Population averages fade out of your recommendations as your personal data builds across cycles.' },
    { p: 'Your personal cycle length, phase timing, energy patterns, and symptom clusters are unique to you. The goal is for this app to learn your cycle, not apply someone else\'s to you.' },
    { cite: 'Sources: Janse de Jonge XAK. Sports Medicine 2003; Munster et al. 2021.' },
  ],
}

function PathContent({ pathKey }) {
  const content = PATH_ARTICLES[pathKey] || PATH_ARTICLES.default
  return <ArticleBody content={content} />
}
