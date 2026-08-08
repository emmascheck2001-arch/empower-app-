// askEngine.js, pure answer logic for the "Ask Em~power" assistant (no React/Supabase here so
// it is unit-testable). The user asks, this returns an answer drawn ONLY from their own data
// (passed in via ctx) and from the hand-written, cited topic bank below. Nothing is generated:
// every answer is traceable. Red flags route to seek-care; unmatched questions return kind:'unknown'.
import { parsePeriodStarts } from './hormoneSync.js'
import { cycleInfoForDate } from './cycleHistory.js'

export function pad(n) { return String(n).padStart(2, '0') }
export function localDateStr(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
export function prettyDate(ds) { return new Date(ds+'T00:00:00').toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }) }

export const STARTERS = [
  'What phase am I in today?',
  'When is my next period?',
  'What was day 3 of my last period like?',
  'What should I do for my workout today?',
  'What helps with bloating?',
  'How much protein should I aim for?',
]

function summariseLog(l) {
  if (!l) return null
  const bits = []
  if (l.energy) bits.push(`energy was ${l.energy.toLowerCase()}`)
  if (l.sleep_quality) bits.push(`sleep was ${l.sleep_quality.toLowerCase()}`)
  if (l.flow_volume) bits.push(`flow was ${l.flow_volume.toLowerCase()}`)
  if (l.pain_rating) bits.push(`pain was ${l.pain_rating} of 5`)
  if (l.workout_feel) bits.push(`workout felt "${l.workout_feel.toLowerCase()}"`)
  if (l.mood?.length) bits.push(`mood: ${l.mood.join(', ').toLowerCase()}`)
  if (l.symptoms?.length && !(l.symptoms.length === 1 && l.symptoms[0] === 'None')) bits.push(`symptoms: ${l.symptoms.join(', ').toLowerCase()}`)
  return bits.length ? bits.join('; ') : null
}

function redFlag(q) {
  const heavy = ['heavy bleed', 'heavy bleeding', 'bleeding a lot', 'bleeding so much', 'bleeding through', 'soaking', 'soaked', 'clots', 'flooding', "won't stop bleeding", 'wont stop bleeding', 'gushing']
  const pain = ['severe pain', 'unbearable', 'worst pain', 'debilitating', 'pain and fever', 'passing out', 'about to faint', 'fainting', "can't stand the pain", 'excruciating', 'one sided pain', 'one-sided pain', 'shoulder tip']
  const preg = ['could i be pregnant', 'am i pregnant', 'think i am pregnant', 'might be pregnant', 'chance i am pregnant']
  const crisis = ['suicid', 'kill myself', 'want to die', 'end my life', 'end it all', 'self harm', 'self-harm', 'hurt myself', "don't want to be here", 'better off dead']
  const affirmed = (term) => {
    const index = q.indexOf(term)
    if (index < 0) return false
    const before = q.slice(Math.max(0, index - 28), index)
    return !/\b(no|not|never|without|dont|don't|do not|isnt|isn't)\b/.test(before)
  }
  if (crisis.some(affirmed)) return 'crisis'
  if (heavy.some(affirmed)) return 'heavy'
  if (pain.some(affirmed)) return 'pain'
  if (preg.some(affirmed)) return 'pregnancy'
  return null
}

const RED_FLAG_ANSWERS = {
  crisis: { text: 'I am really glad you said something. You do not have to carry this alone. Please reach out right now: call or text 988, the Suicide and Crisis Lifeline, free and available 24/7 in Canada and the US. If you are in immediate danger, call your local emergency number. Low mood around your cycle or in perimenopause can be a real hormonal effect, and it is also worth taking seriously on its own.', tone: 'crisis' },
  heavy: { text: 'Bleeding this heavy is worth getting checked, not just tracked. If you are soaking through a pad or tampon every 1 to 2 hours for several hours, passing clots larger than a coin, or you feel dizzy, breathless, or your heart is racing, contact your doctor or urgent care today. This is the one situation where "wait and see" is not the right move. (ACOG)', tone: 'care' },
  pain: { text: 'Pain that severe deserves attention now. If it came on suddenly, is mostly on one side, or comes with fever, vomiting, fainting, or shoulder-tip pain, or there is any chance you could be pregnant, please seek same-day medical care, as these can signal an emergency. Ongoing severe period pain that disrupts your life is also worth a proper work-up with your doctor. (ACOG)', tone: 'care' },
  pregnancy: { text: 'Em~power cannot tell you whether you are pregnant, and it is not a method of contraception. If there is any chance you could be, the reliable next step is a home pregnancy test, most accurate with first-morning urine, or a visit to your doctor. If a period is late, that alone is common and has many causes, but a test gives you a clear answer.', tone: 'care' },
}

export function TRAIN_BY_PHASE(p) {
  const k = String(p).toLowerCase()
  if (k.includes('menstrual')) return 'Your calendar estimate is menstrual. Training can continue if you feel well; choose a lighter or recovery option for pain, heavy bleeding, low energy or a difficult warm-up.'
  if (k.includes('follicular')) return 'Your calendar estimate is follicular. Some people perform well here, but progress only when your recent sessions, symptoms and warm-up support it.'
  if (k.includes('ovulat')) return 'Your calendar places you near an estimated ovulation window. Keep your planned session and let your warm-up and recent performance decide the effort.'
  if (k.includes('luteal')) return 'Your calendar estimate is luteal. Some people notice higher perceived effort or symptoms here and others do not. Start with the plan, then adapt if that is true for you today.'
  if (k.includes('perimenopause')) return 'Resistance training supports muscle and bone in perimenopause. Exercise choice and load should reflect your experience, symptoms, pain and professional guidance.'
  return 'Train to how you feel today. Consistent strength work plus movement you enjoy is the foundation, whatever phase you are in.'
}

function countByPhase(c, symptom) {
  const byPhase = {}; let total = 0
  const starts = parsePeriodStarts(c.cycle)
  c.logs.forEach(l => {
    if ((l.symptoms||[]).includes(symptom)) {
      const info = cycleInfoForDate(l.log_date, starts, c.cycle?.cycle_length || 28)
      const ph = info?.phase || 'unknown'
      byPhase[ph] = (byPhase[ph]||0)+1; total++
    }
  })
  return { total, byPhase }
}
function topPhase(byPhase) {
  const e = Object.entries(byPhase).filter(([k])=>k!=='unknown').sort((a,b)=>b[1]-a[1])
  return e.length ? e[0][0] : null
}
function patternAnswer(c, symptom, label) {
  if (c.logs.length < 7 || parsePeriodStarts(c.cycle).length < 3) return { text: `I need at least two completed cycles and several logs to look for a ${label} pattern. Keep logging and ask me again.` }
  const { total, byPhase } = countByPhase(c, symptom)
  if (total === 0) return { text: `You have not logged ${label} recently, so there is no pattern to show yet.` }
  const ph = topPhase(byPhase)
  const peakCount = ph ? byPhase[ph] : 0
  const hasPattern = total >= 3 && peakCount >= 2 && peakCount >= Math.ceil(total * 0.6)
  return { text: hasPattern
    ? `You logged ${label} ${total} times across completed-cycle dates, most often in the ${ph.toLowerCase()} window. This is an observation to keep testing, not proof that phase caused it.`
    : `You logged ${label} ${total} time${total===1?'':'s'}, but there is not yet a clear phase pattern.`, link: { label:'See your calendar', to:'/calendar' } }
}

// Content + data topics. Each: kw (trigger phrases) + fn(ctx) -> { text, link }.
// Answers are hand-written and traceable. fn may use the user's own data (ctx).
export function buildTopics() {
  const L = (label, to) => ({ label, to })
  return [
    { id:'phase', kw:['what phase','which phase','where am i in my cycle','my phase','what part of my cycle'], fn:(c)=>{
      if (!c.status) return { text: 'I could not load your cycle data just now. Try again in a moment.' }
      if (c.status.phase === 'Perimenopause') return { text: `You are tracking perimenopause (${c.status.subPhase || 'in transition'}), so there are no set cycle phases. Your guidance is built around your symptoms instead.` }
      if (c.status.phase === 'bc' || String(c.status.phase).startsWith('bc')) return { text: 'Hormonal contraception changes natural-cycle tracking, and ovulation suppression depends on the method. Empower tracks your method, bleeding and symptoms without assigning a natural-cycle phase when that would be misleading.' }
      const day = c.status.cycleDay ? ` (day ${c.status.cycleDay} of about ${c.status.cycleLen})` : ''
      const label = c.status.phaseEvidence?.status === 'insufficient' ? 'Empower cannot estimate your phase reliably today.' : `Today is estimated as ${(c.status.subPhase || c.status.phase || 'observation').toLowerCase()}${day}.`
      return { text: `${label} ${c.status.phaseEvidence?.label || 'Cycle timing is an estimate, not a confirmation.'}`, link: L('See your dashboard', '/dashboard') }
    }},
    { id:'cycleday', kw:['what day of my cycle','what cycle day','what day am i on','my cycle day'], fn:(c)=>{
      if (!c.status?.cycleDay) return { text: 'I do not have a cycle day for you yet. Log your period start date and I can track it from there.', link: L('Log your period', '/log') }
      return { text: `You are on day ${c.status.cycleDay} of an approximately ${c.status.cycleLen}-day cycle.` }
    }},
    { id:'nextperiod', kw:['when is my next period','when will i get my period','next period','when is my period due','period coming'], fn:(c)=>{
      const prediction = c.status?.nextPeriodPrediction
      if (prediction?.windowStart && prediction?.windowEnd) {
        const centre = prettyDate(String(prediction.predictedDate).slice(0, 10))
        const start = prettyDate(String(prediction.windowStart).slice(0, 10))
        const end = prettyDate(String(prediction.windowEnd).slice(0, 10))
        const source = prediction.confidence === 'none' ? 'the cycle length you entered' : 'your recorded period starts'
        return { text: `Your next period is estimated around ${centre}, with a current window from ${start} to ${end}, based on ${source}. ${prediction.irregular ? 'The broad window reflects variable cycle timing. ' : ''}This is an estimate, not a guarantee.`, link: L('Open your calendar', '/calendar') }
      }
      if (c.status?.daysUntilPeriod == null) return { text: 'I need a logged period date to predict your next one. Once you log it, I can estimate a date range for you.', link: L('Log your period', '/log') }
      const d = c.status.daysUntilPeriod
      return { text: d <= 0 ? 'Your period is estimated around now. Cycle timing can vary, so log the actual start when it happens.' : `Your next period is about ${d} day${d===1?'':'s'} away based on the timing currently available. This is an estimate, not a guarantee.`, link: L('Open your calendar', '/calendar') }
    }},
    { id:'lastperiod', kw:['when was my last period','last period date','when did my period start','my last period'], fn:(c)=>{
      if (!c.cycle?.last_period_date) return { text: 'You have not logged a period start date yet, so I do not have your last period on record.', link: L('Log your period', '/log') }
      return { text: `Your most recent period start on record is ${prettyDate(c.cycle.last_period_date)}.` }
    }},
    { id:'streak', kw:['my streak','how many days have i logged','logging streak','days in a row'], fn:(c)=>{
      return { text: c.streak > 0 ? `You are on a ${c.streak}-day logging streak. Every day you log makes your guidance more personal.` : 'You do not have an active streak right now. Logging even once today restarts it, and consistent logging is what personalises everything.', link: L('Log today', '/log') }
    }},
    { id:'pattern_cramps', kw:['my cramp pattern','when do i get cramps','do i get cramps','my cramps','when are my cramps'], fn:(c)=> patternAnswer(c, 'Cramping', 'cramps') },
    { id:'pattern_general', kw:['my pattern','my symptom pattern','my symptoms over time','my trends','what do i usually'], fn:(c)=>{
      if (c.logs.length < 5) return { text: 'I need a bit more history to spot your patterns reliably. Keep logging for a week or two and ask me again, and I will show you what tends to happen and when.' }
      const top = ['Cramping','Bloating','Fatigue','Headache','Mood swings'].map(s => ({ s, ...countByPhase(c, s) })).filter(x => x.total >= 2).sort((a,b)=>b.total-a.total)[0]
      if (!top) return { text: 'You have not logged enough of any one symptom yet for a clear pattern. The more you log, the sharper this gets.' }
      const ph = topPhase(top.byPhase)
      return { text: `So far you have logged ${top.s.toLowerCase()} ${top.total} times${ph ? `, most often in your ${ph.toLowerCase()} phase` : ''}. Keep logging and I will keep refining this.`, link: L('See your calendar', '/calendar') }
    }},

    { id:'workout_today', kw:['workout today','what should i do today','train today','exercise today','what workout','should i work out today','what training today'], fn:(c)=>{
      const p = (c.status?.subPhase || c.status?.phase || 'observation')
      return { text: `${TRAIN_BY_PHASE(p)} You can build a full session in the workout planner.`, link: L('Plan my workout', '/workout') }
    }},
    { id:'train_period', kw:['work out on my period','train on my period','exercise on my period','workout during my period','can i exercise on my period','training on period'], fn:()=>({ text: 'Yes, most people can train during a period. Keep the planned session if you feel well; pain, heavy bleeding, dizziness, low energy or a difficult warm-up are good reasons to choose the lighter option or rest. A cycle label alone does not require a deload.', link: L('Plan my workout', '/workout') })},
    { id:'train_luteal', kw:['luteal workout','train in luteal','week before my period workout','exercise before my period','lift in luteal'], fn:()=>({ text: 'Some people notice higher temperature, heart rate, symptoms or perceived effort in the luteal phase, while others perform consistently. Begin with your normal plan and adjust load or volume only when your symptoms, warm-up or personal history support it.', link: L('Plan my workout', '/workout') })},
    { id:'hiit', kw:['hiit','high intensity','intervals','sprints'], fn:()=>({ text: 'HIIT can be performed across the cycle when you feel well and are prepared for it. Phase effects vary, so use sleep, symptoms, recent training and your warm-up to decide whether to complete the planned session or choose a lower-intensity option.', link: L('Plan my workout', '/workout') })},
    { id:'strength', kw:['build muscle','get stronger','gain strength','lift heavier','strength training','tone up','build strength'], fn:()=>({ text: 'Lifting close to challenging, where the last couple of reps are genuinely hard, builds strength and muscle. Muscle is one of the best things you can build for long-term hormonal and bone health (Kohrt 2004). Progress the weight gradually. The workout player shows your last weights so you can add a little when you are ready.', link: L('Plan my workout', '/workout') })},
    { id:'rest', kw:['should i rest','rest day','take a day off','too sore','overtraining'], fn:()=>({ text: 'Rest is part of training, not a failure of it. If you are very sore, run-down, ill, sleeping badly, or your warm-up feels unusually difficult, a rest or gentle-movement day may fit better. A calendar phase alone does not require rest.' })},

    { id:'eat_today', kw:['what should i eat','what to eat','what do i eat','eat today','what should i eat today','food today','nutrition today','what can i eat'], fn:(c)=>{
      const nt = c.status?.nutritionTargets
      const phase = c.status?.phase
      const foods = nt?.keyFoods
      let text = ''
      if (nt?.proteinRangeG) text += `Your research-informed protein range is ${nt.proteinRangeG[0]} to ${nt.proteinRangeG[1]}g today`
      text = text ? text + '. ' : ''
      if (foods && foods.length) text += `Good choices right now: ${foods.slice(0,5).join(', ')}.`
      if (phase === 'Menstrual') text += ' Iron-rich foods matter more while you are bleeding, paired with vitamin C to help you absorb them.'
      if (!text.trim()) text = 'Build your meals around protein, plenty of vegetables, and whole-food carbs. Add your body weight in the nutrition screen and I can give you a personalised target.'
      return { text: text.trim(), link: L('Open nutrition', '/nutrition') }
    }},
    { id:'protein', kw:['how much protein','protein target','protein should i eat','daily protein','protein goal','why protein','why do i need protein','why more protein','higher protein','more protein','need more protein','extra protein','protein today','why so much protein'], fn:(c)=>{
      const range = c.status?.nutritionTargets?.proteinRangeG
      const perKg = c.status?.nutritionTargets?.proteinRangePerKg
      return { text: range ? `Based on your weight, a research-informed range is about ${range[0]} to ${range[1]}g today. Your activity, goals, diet and health determine where you fit; phase alone does not set an exact number. (ISSN 2023)` : `Add your body weight to calculate a range. Current general guidance here is ${perKg?.[0] || 1.2} to ${perKg?.[1] || 1.6}g per kg, with individual needs depending on activity and health. (ISSN 2023)`, link: L('Open nutrition', '/nutrition') }
    }},
    { id:'bloating', kw:['bloating','bloated','water retention'], fn:()=>({ text: 'For bloating: cooked vegetables are gentler than raw, probiotic foods (yogurt, kefir, kimchi) help digestion, fennel can ease gut spasm, and staying well hydrated tends to reduce fluid retention. Easing off high-sodium foods, carbonated drinks, and alcohol helps too.', link: L('Symptom relief', '/nutrition') })},
    { id:'cramps', kw:['cramp','period pain','menstrual pain','painful period','help with cramps'], fn:()=>({ text: 'For cramps: magnesium-rich foods (pumpkin seeds, dark chocolate, leafy greens), omega-3 (salmon, sardines, walnuts), ginger, heat, and gentle movement all have evidence, used alongside, not instead of, your usual pain relief. If pain regularly stops you living your day, that is not just "normal" and is worth raising with a doctor.', link: L('Symptom relief', '/nutrition') })},
    { id:'headache', kw:['headache','migraine','head hurts'], fn:()=>({ text: 'Some people notice headaches or migraine around menstruation, but dehydration, missed meals, sleep, stress, medicines and other causes matter too. Track timing and known triggers. Frequent, new, severe or neurological symptoms need clinical advice.', link: L('Symptom relief', '/nutrition') })},
    { id:'pms', kw:['pms','mood swings','irritable before my period','low mood before my period','emotional before period'], fn:()=>({ text: 'Premenstrual mood symptoms are real and not a character flaw. A pattern that repeats before a period and improves afterward is useful to show a clinician, but sleep, stress, health and life events can contribute too. Severe symptoms or thoughts of self-harm need prompt support.', link: L('Your brain and your cycle', '/learn?article=brain') })},
    { id:'fatigue', kw:['tired','fatigue','no energy','exhausted','low energy','always tired'], fn:()=>({ text: 'Cyclical tiredness is common, especially during and after your period. Iron-rich foods with vitamin C, B12 sources, and protecting sleep all help. Many active women are low in stored iron (ferritin) even with a normal blood count, so if you are persistently exhausted, ask your doctor for a full iron panel including ferritin, and do not start iron supplements without testing first.', link: L('Nutrition', '/nutrition') })},
    { id:'brainfog', kw:['brain fog','can\'t focus','cant focus','foggy','concentrate'], fn:()=>({ text: 'Brain fog can have many contributors, including sleep, stress, medicines, nutrition, illness and hormonal transition. Track timing, but do not assume one cause. New or persistent focus problems are worth discussing with a clinician.', link: L('Learn', '/learn') })},
    { id:'cravings', kw:['craving','sugar craving','want to eat everything','hungry before my period'], fn:()=>({ text: 'Premenstrual cravings are common and not a failure of willpower. Appetite, sleep, stress, energy availability and hormonal changes may all contribute. Plan satisfying meals and snacks without assuming an exact phase-specific need.', link: L('Nutrition', '/nutrition') })},
    { id:'creatine', kw:['creatine'], fn:()=>({ text: 'Creatine monohydrate has evidence for strength and training support, but cycle phase does not determine a personal dose. Ask a clinician or sports dietitian whether it fits your goals, pregnancy status, medicines and health.' })},
    { id:'caffeine', kw:['caffeine','coffee','too much coffee'], fn:()=>({ text: 'Caffeine response varies. Use dose, timing, sleep, anxiety, pregnancy guidance, medicines and your own response rather than cycle phase to decide what works. Cutting it earlier in the day can help if it delays or fragments sleep.' })},
    { id:'fasting', kw:['fasting','intermittent fasting','skip breakfast','skipping breakfast'], fn:()=>({ text: 'Intermittent fasting is not automatically harmful or helpful for women. It may be a poor fit if it causes under-fuelling, worsens symptoms or recovery, or conflicts with pregnancy, diabetes, medicines or an eating-disorder history. Cycle phase alone does not create a required breakfast window.', link: L('Nutrition', '/nutrition') })},
    { id:'iron', kw:['iron','anemia','anaemia','ferritin','low iron'], fn:()=>({ text: 'Many active women are low in stored iron (ferritin) even when a standard blood count looks normal, which quietly affects energy, focus, and training. Pair iron-rich foods with vitamin C to boost absorption, and ask your doctor for a full iron panel including ferritin if you are persistently tired. Do not supplement iron without a test confirming you need it. (Burden et al. 2015)', link: L('Learn', '/learn?article=conditions') })},
    { id:'sleep', kw:['sleep','insomnia','can\'t sleep','cant sleep','sleep better','trouble sleeping','waking up at night'], fn:()=>({ text: 'Some people notice sleep changes across the cycle and others do not. Try a comfortably cool, dark room, a consistent wind-down, less alcohol, and earlier caffeine if it affects you. Persistent sleep problems deserve assessment beyond cycle timing.', link: L('Sleep guide', '/sleep') })},

    { id:'estrogen', kw:['what is estrogen','what does estrogen','estrogen do','about estrogen'], fn:()=>({ text: 'In an ovulatory cycle, estrogen generally rises before ovulation and changes again afterward. It interacts with brain, bone, cardiovascular and metabolic systems, but a symptom or calendar date cannot reveal your level or prove that estrogen caused how you feel.', link: L('Your hormones', '/learn?article=hormones') })},
    { id:'progesterone', kw:['what is progesterone','what does progesterone','progesterone do','about progesterone'], fn:()=>({ text: 'Progesterone generally rises after ovulation and is associated with a small temperature shift. Symptoms and training response vary widely, so Empower does not assume a mood, protein increase or workout change from the calendar alone.', link: L('Your hormones', '/learn?article=hormones') })},
    { id:'hormone_results', kw:['what do my results mean','hormone test results','understand my results','my blood test','what does my result mean','test results'], fn:()=>({ text: 'A hormone result is a starting point, not an answer. The same number means different things depending on your cycle day, symptoms, and history. Bring your results and your logged symptoms to your doctor and ask three things: what does this mean for me, why might it be happening, and what are my options. You are entitled to leave understanding all three.', link: L('Understanding results', '/learn?article=hormones') })},
    { id:'thyroid', kw:['thyroid','tsh'], fn:()=>({ text: 'Your thyroid is not a sex hormone, but it is checked alongside them because an under- or over-active thyroid causes fatigue, low mood, weight changes, and irregular or heavy periods, which overlap almost exactly with hormonal symptoms. If you have these, ask your doctor to check thyroid function (TSH and free T4) too.', link: L('Your hormones', '/learn?article=hormones') })},

    { id:'pcos', kw:['pcos','polycystic'], fn:()=>({ text: 'PCOS is a common hormonal condition where the ovaries make more androgens than usual, often driven by insulin resistance, causing irregular cycles, acne, and excess hair. Resistance training and lower-GI eating directly help the root cause. It is more common, and can appear at a lower body weight, in South Asian women. If your cycles are consistently long or absent, ask your doctor about it and bring your log. (Teede et al. 2018)', link: L('Conditions', '/learn?article=conditions') })},
    { id:'endo', kw:['endometriosis','endo'], fn:()=>({ text: 'Endometriosis is tissue similar to the uterine lining growing where it should not, causing pain, sometimes severe, and heavy or irregular bleeding. "Painful periods are normal" is one of the most harmful dismissals in women\'s medicine, and diagnosis is delayed 7 to 10 years on average. If your pain disrupts your life, push for a proper investigation and a second opinion if needed. (Nnoaham et al. 2011)', link: L('Conditions', '/learn?article=conditions') })},
    { id:'pmdd', kw:['pmdd'], fn:()=>({ text: 'PMDD is a real, biologically grounded condition where the brain is more sensitive to normal progesterone fluctuations, causing severe mood symptoms in the week or so before your period that lift once it starts. That cyclical timing is the key feature. Prospective tracking across two cycles is part of how it is assessed, so your Em~power log is useful to bring to a doctor. (Osborn et al. 2025)', link: L('Conditions', '/learn?article=conditions') })},
    { id:'fibroids', kw:['fibroid'], fn:()=>({ text: 'Fibroids are common, non-cancerous growths in or on the uterus. Many cause no symptoms; others cause heavy or prolonged bleeding, pelvic pressure, and iron deficiency. They are more common, earlier, and often more severe in Black women, who are also more likely to be dismissed. Heavy or painful periods deserve a proper assessment. (Eltoukhi et al. 2014)', link: L('Conditions', '/learn?article=conditions') })},
    { id:'perimenopause', kw:['perimenopause','menopause','hot flash','hot flashes','night sweats'], fn:()=>({ text: 'Perimenopause is the years-long transition before periods stop, driven by fluctuating then declining estrogen. Symptoms span sleep, mood, focus, joints, hot flashes, libido, and cycle changes, and can begin in the mid-30s. Many symptoms are treatable, including with HRT, and you can see someone for help rather than just enduring it.', link: L('Perimenopause', '/learn?article=peri_what') })},
    { id:'hrt', kw:['hrt','hormone replacement','hormone therapy'], fn:()=>({ text: 'The 2002 scare about HRT was based on older women and outdated formulations and has since been re-examined. Current evidence is that HRT started within about 10 years of menopause, or before 60, is associated with benefits for many women, including bone, heart, and mood. It is an individual decision to make with a knowledgeable doctor. (Manson et al. 2013)', link: L('HRT explained', '/learn?article=peri_hrt') })},
    { id:'adhd', kw:['adhd','attention','focus problems'], fn:()=>({ text: 'Attention and focus problems in the late 30s and 40s are real and can be driven by fluctuating estrogen, which supports dopamine. Some women are assessed for ADHD around this time; for some it is ADHD that went unrecognised, for others it is the perimenopause transition driving it. Both are treatable and both are worth raising, so do not write focus problems off as just stress. (Osborn et al. 2025)', link: L('Mood and mental health', '/learn?article=peri_mood') })},
    { id:'bc_help', kw:['birth control help','pill for my period','pill for pain','can birth control','birth control for pain','skip my period','stop my period','skip periods'], fn:()=>({ text: 'Hormonal birth control is often prescribed for reasons that have nothing to do with contraception: debilitating period pain, very heavy bleeding, endometriosis, PMDD, and PCOS symptoms, and taken continuously it can make periods lighter, less frequent, or pause them. It manages symptoms rather than fixing the root cause, so the pattern is still there if you stop. That makes it a valid, informed choice to discuss with your doctor.', link: L('Conditions', '/learn?article=conditions') })},
    { id:'normal_period', kw:['is my period normal','normal cycle','how long should my period','what is a normal period','heavy is that normal'], fn:()=>({ text: 'A healthy cycle is roughly 21 to 35 days, with a period of about 3 to 7 days and at most mild discomfort. Soaking through protection every 1 to 2 hours, periods longer than 7 days, or pain that stops your day are not "just normal" and are worth investigating with a doctor.', link: L('Your cycle phases', '/learn?article=phases') })},
    { id:'data_privacy', kw:['my data','sell my data','privacy','do you sell','what do you do with my data'], fn:()=>({ text: 'Your health data is yours. Em~power never sells it, shares it, or uses it for advertising, and you can permanently delete your account and everything in it yourself at any time from the privacy page.', link: L('Privacy and data', '/privacy') })},
  ]
}

// Core matcher → { kind:'redflag'|'answer'|'unknown', text?, link?, tone?, question? }
export function answerQuestion(raw, ctx, topics) {
  const q = ' ' + raw.toLowerCase().replace(/[^a-z0-9'\s]/g,' ').replace(/\s+/g,' ') + ' '

  const rf = redFlag(q)
  if (rf) return { kind:'redflag', ...RED_FLAG_ANSWERS[rf] }

  const dm = q.match(/\bday\s*(\d{1,2})\b/)
  if (dm && /(period|cycle|last)/.test(q)) {
    const n = parseInt(dm[1])
    if (ctx.cycle?.last_period_date && n >= 1 && n <= 40) {
      const d = new Date(ctx.cycle.last_period_date+'T00:00:00'); d.setDate(d.getDate()+(n-1))
      const ds = localDateStr(d)
      if (ds > localDateStr()) return { kind:'answer', text:`Day ${n} of your current cycle is still in the future (${prettyDate(ds)}), so there is nothing logged yet.` }
      const log = ctx.logs.find(l => l.log_date === ds)
      const sum = summariseLog(log)
      return { kind:'answer', text: sum ? `On day ${n} of your last cycle (${prettyDate(ds)}): ${sum}.` : `You did not log anything on day ${n} of your last cycle (${prettyDate(ds)}).`, link: { label:'Open your calendar', to:'/calendar' } }
    }
    return { kind:'answer', text:'I need a logged period start date to line up your cycle days. Once you log one, I can pull up any day for you.', link:{ label:'Log your period', to:'/log' } }
  }

  let best = null, bestScore = 0
  for (const t of topics) {
    let s = 0
    for (const k of t.kw) { if (q.includes(' ' + k + ' ') || q.includes(' ' + k) || raw.toLowerCase().includes(k)) s += k.split(' ').length }
    if (s > bestScore) { bestScore = s; best = t }
  }
  if (best && bestScore > 0) {
    const a = best.fn(ctx)
    return { kind:'answer', text: a.text, link: a.link }
  }
  return { kind:'unknown', question: raw }
}
