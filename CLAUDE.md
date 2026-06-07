# HormoneSync — Claude Code Instructions

## Project context
Women's hormone-based fitness app. Vanilla HTML, CSS, JavaScript ES modules, Supabase JS client loaded via CDN. No build step, no npm, no framework. All files live in this folder and open directly in a browser via Live Server.

## Supabase credentials
URL: https://imgujppjvffbubnsscge.supabase.co
Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltZ3VqcHBqdmZmYnVibnNzY2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDQzNzIsImV4cCI6MjA5NjE4MDM3Mn0.TpjycdiHLl5iI1G8u07mVmStKZWU2fzEsuw1dUi6diU

## Files in this project
- login.html — sign in and create account
- setup.html — onboarding for new users, four paths
- dashboard.html — main home screen showing phase, nutrition card, log streak
- log.html — daily symptom and biometric log with 5-question morning check-in as default
- mucus.html — cervical mucus and spotting log
- workout.html — activity picker, muscle group selector, guided workout player
- checkin.html — 5-question morning check-in
- feedback.html — trial user feedback screen with smart follow-up questions, stores to user_feedback table
- nutrition.html — phase-aware nutrition screen with symptom relief accordion
- hormoneSync.js — shared getTodayStatus function used by all screens
- algorithm_v3.js — core algorithm with processAllSignals, getNutritionTargets, getIntensityModifier

## Database tables
- profiles — id, email, name, user_path, bc_type, bc_stop_date, cycle_length, body_weight_kg, fitness_level, onboarding_complete
- cycle_data — id, user_id, last_period_date, cycle_length, notes
- daily_logs — id, user_id, log_date, energy, symptoms[], workout_feel, mood[], sleep_quality, resting_hr, disruptors[], wrist_temp, lh_result, hormone_estradiol, hormone_progesterone, hormone_lh, hormone_cortisol, flow_volume, pain_rating, notes. Unique constraint on (user_id, log_date).
- mucus_logs — id, user_id, log_date, discharge_type, spotting_type, notes. Unique constraint on (user_id, log_date).
- cycle_summaries — id, user_id, cycle_number, cycle dates, phase lengths, ovulation data
- user_baselines — id, avg_cycle_length, avg_luteal_length, temp_follicular_baseline, rhr_follicular_baseline, pms_days_before, peak_energy_day, cycles_tracked, model_confidence
- user_feedback — id, user_id, user_email, category, screen, description, followup_answer, frustration_rating, priority, status, claude_code_instruction, developer_notes, resolved_at

Always use upsert with onConflict: 'user_id,log_date' when saving daily data.

---

## Behaviour rules — follow these exactly
- Never ask clarifying questions. Make a reasonable decision and state what you chose.
- Never rewrite a whole file unless the task explicitly says to. Edit only what needs changing.
- Never stop between tasks waiting for approval. Work continuously without pausing.
- After each fix reply with exactly one line: DONE — what you changed in one sentence.
- If something cannot be done explain why in one sentence then move on.
- Write the minimum code needed. Do not refactor unrelated code.
- Always verify your change is syntactically correct before moving on.
- Use the existing code style — same variable naming, same indentation, same Supabase client pattern already in the files.

---

## Product development mindset — apply this to every task

You are not just executing a task list. You are the lead developer of a women's health app that real women will use to understand their bodies. Your job is done when the app is genuinely excellent — not when a list is complete.

This app exists because almost everything women have been told about exercise and nutrition was researched on men and generalised to women. Women were not required to be included in medical research studies until 1993. Less than 1% of research funding goes to women over 40. HormoneSync is built entirely on research conducted on women. Every word in this app must reflect that commitment.

### The core philosophy — apply to every piece of content
- Women are not small men. Their physiology differs down to the cellular level.
- There is no universal normal for women's hormones. Population averages are built from research that often excluded women. Personal pattern over time is the only meaningful benchmark.
- The menstrual cycle is a vital sign — not just a reproductive function. It reflects bone health, brain health, cardiovascular health, and metabolic health.
- Women have been systematically dismissed by the medical system. This app never dismisses. Every symptom a user logs is real.
- Never replicate medical gaslighting. Remove any language that minimises symptoms.

### Continuous quality loop — run this after every change

1. Open every HTML file in a mental browser simulation. Does it load without errors? Does it make sense to a first-time user? Is anything confusing, broken, or missing?

2. Check every user flow end to end:
   - New user: login → setup → dashboard → log → mucus → dashboard
   - Returning user: dashboard → workout → complete → nutrition card
   - Any broken step — fix immediately without being asked

3. After every file edit ask: did this change break anything else?

4. Look for anything a real user would find confusing, frustrating, or incomplete. Fix it.

### Things to fix automatically without being asked

- Any JavaScript error that would appear in the browser console
- Any broken link between screens
- Any button that does not do what it says
- Any screen that shows blank or loading forever
- Any text truncated or unreadable on a 390px mobile screen
- Any form that does not save correctly
- Any screen missing a loading state or error state
- Any duplicate code doing the same thing in two files
- Any hardcoded value that should come from the database
- Any science claim without a citation — add SOURCE NEEDED comment
- Any weight suggestion missing from the WEIGHTS dictionary
- Any exercise missing a description
- Any phase guidance contradicting the research in this file
- Any mobile layout issue — perfect on 390px iPhone at all times
- Any muscle group combination that does not reflect real gym training
- Any language that minimises or dismisses symptoms — rewrite it
- Any hormone reference range shown without the personal variation caveat
- Any content sourced only from a podcast without peer-reviewed verification
- Any time you write health-related content — stop and ask: what peer-reviewed research supports this? If none exists write SOURCE NEEDED.

### Full audit — run after every session

**Code quality:** No console errors, no undefined variables, no async missing await, all Supabase calls in try-catch, all upserts use onConflict, no duplicate phase logic.

**UX:** Stranger can use in 60 seconds, every button labelled, no dead ends, all back buttons work, works with no data and with 30 days of data, works on slow connection.

**Science:** Every claim cited, no absolute language, no medical diagnostic language, all hormone ranges cite LifeLabs/EORLA or Münster 2021, all hormone ranges include personal variation caveat, all protein targets cite ISSN 2023, all weight suggestions cite strength standards, every claim cross-referenced against two peer-reviewed sources, no podcast-only claims.

**Visual:** Polished on 390px, no overflow, consistent spacing 16px margins 12px gaps, consistent colours, all icons loading, no placeholder text.

**Data:** Test account logs 7 days, all data saves correctly, phase correct, workout matches phase, nutrition uses correct bodyweight, mucus links correctly, persists after logout.

### After audit fix everything found. Run audit again. Repeat until zero issues.

### Think like a product manager
- Clinical or confusing language → rewrite warm, clear, human
- User action with no visible response → add feedback
- Data exists but not shown → surface it
- Woman might feel judged, scared, or confused → reframe it
- Science buried in footnote → bring it forward
- Woman has been dismissed before → make her feel seen

---

## Research rules — accuracy is everything

Every claim about hormones, exercise, nutrition, or physiology must be traceable to a peer-reviewed source. This is a health app. Being wrong causes real harm.

### Rule 1 — Never invent a claim
No peer-reviewed source = do not write the claim. Write SOURCE NEEDED.

### Rule 2 — Use the Research Foundation first
Check the Research Foundation below before writing any science claim. Cite by name: "Kissow et al. 2022 Sports Medicine" not "research suggests."

### Rule 3 — Search before writing new claims
If no listed study covers a topic, search training knowledge for a peer-reviewed source. If found, cite it and add it to Research Foundation. If not confident, write SOURCE NEEDED.

### Rule 4 — Precise language only
- "estrogen may improve muscle protein synthesis" NOT "estrogen will make you stronger"
- "high intensity exercise may create a larger stress response in the luteal phase" NOT "you cannot do HIIT in the luteal phase"
- "progesterone fluctuation is associated with PMS symptoms" NOT "progesterone causes PMS"
- Always "may" not "will" for phase-specific training claims (Colenso-Semple 2023)
- Always acknowledge individual variation

### Rule 5 — Confirmed science vs wellness claims
- "Research shows" — strong peer-reviewed backing only
- "Many women find" or "This may help" — wellness recommendations without specific citations

### Rule 6 — Hormone reference ranges
Always cite LifeLabs/EORLA or Münster 2021. Always add: "This is a population average. Your personal normal may be different. What matters most is your pattern across multiple cycles, not a single value against a population average."

### Rule 7 — Nutrition targets
Cite ISSN 2023. Luteal protein 1.8 to 2.2g per kg. Energy +200 to 300 kcal above follicular.

### Rule 8 — Weight and strength
Cite Arvo 2026, ExRx, or Strengthlevel.com. Use median across sources.

### Rule 9 — No medical claims
Forbidden language:
- "you have low progesterone" → "this pattern is sometimes associated with lower progesterone levels and is worth tracking"
- "this indicates a luteal phase defect" → "this pattern may be worth discussing with your doctor if it persists"
- "you are ovulating" → "these signals are consistent with ovulation"
- "your hormones are abnormal" → "this value is outside the typical reference range"
Always include "consult your doctor" when flagging a concerning pattern.

### Rule 10 — Source comments in code
```javascript
// Source: Arvo strength standards 2026 female intermediate percentile at 65kg
{ range: '50 to 75kg', science: 'Intermediate female squat 1.2x bodyweight at 65kg (Arvo 2026)' }
```

### Rule 11 — Podcast claims require independent peer-reviewed verification
Claims from the Diary of a CEO episodes or any podcast are expert opinion, not peer-reviewed evidence. Every specific claim from those episodes must be verified against at least one independent peer-reviewed source before appearing in the app as fact. If peer-reviewed source agrees — use it, cite the peer-reviewed source as primary. If peer-reviewed source partially disagrees — use the conservative version from the research. If no peer-reviewed source found — write SOURCE NEEDED. Never cite a podcast as the primary source for a health claim.

---

## Cross-referencing and fact verification

Every health claim must be cross-referenced against at least two independent peer-reviewed sources. One source is not enough.

### Cross-reference matrix

**Hormone reference ranges:** Münster 2021 + LifeLabs/EORLA + Endocrine Society 2018 + ACOG. Use most conservative if any disagree.

**Exercise and training:** Colenso-Semple 2023 + Kissow 2022 + Janse de Jonge 2003 + Sims ROAR 2024 + ACE + ACSM. Use most conservative if any contradict.

**Nutrition:** ISSN 2023 + Larivière 2006 + USDA 2020-2025 + Health Canada. Show Health Canada value to Canadian users if it differs from ISSN.

**Strength standards:** Arvo 2026 + ExRx + Strengthlevel.com + Powerlifting America. Use median.

**Cervical mucus:** Bigelow 2004 + Wilcox 2000 (NEJM) + WHO fertility awareness + FAM clinical guidelines.

**Wearable data:** Zhu 2021 + Oura 2025 validation + Stanford wearables research + BBT clinical guidelines.

**PCOS:** Teede et al. 2018 International PCOS Guideline + Woodward 2019 Obesity Reviews + Fica 2008 on insulin resistance.

**Endometriosis:** Meuleman 2009 Human Reproduction Update + Nnoaham 2011 Fertility and Sterility diagnostic delay data.

**Perimenopause and menopause:** Harlow 2012 STRAW+10 + Freeman 2004/2006 Archives General Psychiatry + Manson 2013 NEJM HRT reanalysis.

**Iron and anaemia:** Angeli 2016 + Burden 2015 BJSM ferritin threshold + WHO haemoglobin 2011.

**Bone density:** Kohrt 2004 MSSE ACSM position stand + Wright clinical practice.

**Pregnancy loss:** Quenby 2021 The Lancet miscarriage series.

**RED-S:** IOC Consensus Statement Mountjoy 2023 BJSM + Nattiv 2007 Female Athlete Triad original position stand.

**Creatine for women:** Rawson 2018 JISSN + Candow 2021 Nutrients.

**Fasted training in women:** Sims ROAR 2024 + Hamadeh 2005 Am J Physiol on sex differences in fuel utilisation.

### 23 specific claims to verify before app ships

For each add: VERIFIED (two sources agree), SINGLE SOURCE (needs second), or UNVERIFIED (remove).

1. Follicular phase resistance training produces superior strength gains
2. RHR rises 1.7 bpm in mid-luteal phase
3. Progesterone raises core temperature 0.3 to 0.5 degrees Celsius
4. Egg white cervical mucus indicates ovulation within 24 to 48 hours
5. Luteal phase protein requirements are 1.8 to 2.2g per kg bodyweight
6. Energy intake naturally higher by 200 to 300 kcal in luteal phase
7. Progesterone and cortisol compete for glucocorticoid receptors
8. Peak estrogen increases ACL injury risk
9. Oura Ring detects ovulation with 96.4% accuracy
10. Wrist temperature shift threshold is 0.2 degrees Celsius minimum
11. Ovulation confirmed when progesterone exceeds 10 nmol/L measured 7 days after confirmed ovulation (NOT "day 21" — that assumes 28-day cycle with ovulation day 14; always say "7 days post-ovulation")
12. LH surge threshold is 8 IU/L
13. Luteal phase length is relatively fixed at 12 to 14 days across women
14. Depo-Provera recovery hormone environment resembles the menstrual phase
15. Cool water may reduce prostaglandin activity during menstruation
16. HIIT in luteal phase creates larger cortisol stress response than follicular
17. Sleep quality is impaired in mid-luteal phase
18. 10 sets per week per muscle group is optimal for hypertrophy
19. Nordic hamstring curl reduces ACL injury risk in women
20. Progesterone has anxiolytic effect via GABA-A receptor interaction in luteal phase
21. Standard haemoglobin thresholds for women were set using male data — verify against WHO 2011 and Burden 2015
22. Perimenopause symptoms can begin as early as age 35 — verify against STRAW+10 Harlow 2012
23. Up to 1 in 4 known pregnancies ends in miscarriage — verify against Quenby 2021 Lancet

### Language rules
- Never cite a percentage without the study: "96.4% (Oura Ring 2025 validation)"
- Never say "research shows" without naming the research
- Never say "women experience" without clarifying population average with individual variation
- Never say "your hormones are" — say "your hormone levels appear to be"
- Never say "this confirms" — say "this is consistent with"
- Never round hormone values that change clinical significance
- Always include sample sizes: "Münster et al. 2021 n=97 women 2105 cycles"
- Never say "day 21 progesterone" — say "progesterone measured 7 days after confirmed ovulation"

### Credibility standard
A GP, registered dietitian, certified personal trainer, and reproductive endocrinologist should all read this app and find nothing clinically incorrect. If unsure — SOURCE NEEDED.

---

## Research Foundation — always check here first, always add new sources here

**Core hormones and physiology:**
- Münster et al. 2021 (ScienceDirect, n=97 women 2105 cycles) — hormone reference values. Follicular progesterone under 3 nmol/L. Mid-luteal progesterone 10 to 50 nmol/L median 28.8. Ovulatory E2 222 to 1959 pmol/L. LH surge above 8 IU/L.
- LifeLabs/EORLA Canadian reference ranges — Canadian clinical standard for all hormone interpretation.
- Endocrine Society Clinical Practice Guidelines 2018 — hormone reference standard.
- ACOG guidelines — clinical reference for reproductive health.
- Charkoudian N, Stachenfeld NS. Comprehensive Physiology. 2014;4(2):793-804 — progesterone raises core temperature, delays sweating onset.
- Crawford N. Diary of a CEO October 2025 — progesterone pulses throughout entire luteal phase. The smooth curve graph is a population average not a reality. Individual variation is the norm not the exception. Verify pulsatility claim against Filicori M et al. J Clin Endocrinol Metab 1984 and Eldar-Geva T et al.

**Exercise and training:**
- Colenso-Semple et al. 2023 (Frontiers) — no consistent evidence strength outcomes differ by phase. Always use "may" not "will".
- Kissow et al. 2022 (Sports Medicine) — follicular phase resistance training may produce superior strength gains.
- De Martin Topranin et al. 2023 (IJSPP) — RHR 1.7 bpm higher in mid-luteal vs early follicular (P=.006). Sleep quality impaired in mid-luteal.
- Sarwar R et al. Journal of Physiology. 1996;493(Pt 1):267-272 — muscle strength peaks in follicular phase.
- Janse de Jonge XAK. Sports Medicine. 2003;33(11):833-851 — individual hormone variability means personal tracking beats population averages.
- Hackney 2006 (Journal of Sports Science and Medicine) — progesterone and cortisol compete for glucocorticoid receptors. High intensity exercise in luteal phase creates larger net stress response.
- Bernárdez-Vázquez R et al. Frontiers in Sports and Active Living. 2022 — 10 sets per week per muscle group optimal for hypertrophy.
- Sims ST, Yeager S. ROAR Revised Edition. Rodale/Random House. 2024 — women are not small men. Synthesises 170+ peer-reviewed studies. Intermittent fasting can suppress HPA axis in women. Women need food within 30 to 60 minutes of waking. Caffeine above 200mg before training raises cortisol.
- Sims ST. Diary of a CEO October 2025 — wearable devices calibrated on male physiology underestimate readiness in luteal phase. PCOS more common in successful female athletes. Amenorrhea in athletes is illness not fitness. Allostatic load drives cycle disruption.
- Maher AC et al. PLOS ONE 2009 — women have more mitochondria in muscle than men. Satellite cells from XX individuals better at making cartilage and muscle.
- IOC Consensus Statement on RED-S 2023 (Mountjoy M et al. BJSM 2023;57(17):1073-1098) — Relative Energy Deficiency in Sport replaces female athlete triad. Affects immune function, bone health, metabolic rate, and reproductive function. Does not require being underweight or elite.
- Nattiv A et al. Medicine and Science in Sports and Exercise 2007 — Female Athlete Triad original position stand. Cross-reference for RED-S claims.
- Hamadeh MJ et al. American Journal of Physiology. 2005 — sex differences in fuel utilisation during exercise. Women rely more on fat oxidation; pre-exercise carbohydrate protects muscle differently in women than men.
- Kohrt WM et al. Medicine and Science in Sports and Exercise 2004 — ACSM position stand on exercise and bone health. Bone can be built at any age with resistance training and impact exercise.
- ACE guidelines — exercise science standard.
- ACSM guidelines — clinical exercise standard.
- Arvo strength standards 2026, ExRx female norms, Strengthlevel.com — weight suggestions.

**Nutrition:**
- ISSN 2023 position stand — luteal phase protein 1.8 to 2.2g per kg bodyweight. Energy +200 to 300 kcal above follicular. Progesterone increases protein catabolism.
- Larivière F et al. American Journal of Physiology. 2006 — luteal phase amino acid utilisation changes.
- USDA Dietary Guidelines 2020-2025 — baseline nutrition reference.
- Health Canada dietary guidelines — Canadian nutrition standard.
- Angeli A et al. European Journal of Sport Science. 2016 — iron loss during menstruation impacts exercise performance. Vitamin C improves iron absorption by up to 67%.
- Burden RJ et al. British Journal of Sports Medicine 2015 — ferritin below 30 mcg/L is functionally deficient for active women even with normal haemoglobin.
- WHO haemoglobin concentrations 2011 — clinical anaemia thresholds. Verify whether female thresholds were set from female-specific data.
- Rawson ES et al. Journal of the International Society of Sports Nutrition 2018 — creatine supplementation in women. Women have lower natural creatine stores. 3 to 5g daily supports muscle, cognition, and mood.
- Candow DG et al. Nutrients. 2021;13(6):1825 — creatine supplementation across age and sex. Cross-reference for creatine claims in women.
- Facchinetti F et al. Obstetrics and Gynecology 1991 — magnesium reduces dysmenorrhea severity.
- Rahbar N et al. Gynecological Endocrinology 2012 — omega-3 fatty acids reduce menstrual cramping.
- Zafari M et al. 2011 — omega-3 and dysmenorrhea mechanism.
- Akin MD et al. Obstetrics and Gynecology 2001 — continuous low-level heat therapy for primary dysmenorrhea.
- Mauvais-Jarvis F et al. Journal of Clinical Investigation 2013 — estrogen receptors on pancreatic beta cells and muscle cells. Estrogen improves insulin sensitivity directly via receptor activation. Low estrogen drives insulin resistance through impaired receptor signalling and reduced beta cell function. Primary peer-reviewed mechanism for the bidirectional estrogen-insulin connection.
- Carr MC. Journal of Clinical Endocrinology and Metabolism 2003 — estrogen loss at menopause drives visceral fat redistribution and metabolic syndrome. Visceral fat releases inflammatory cytokines that further worsen insulin resistance. Confirms estrogen-insulin relationship in the perimenopause context.
- Backstrom T et al. Archives of Women's Mental Health 2008 — estrogen regulates serotonin and dopamine production and receptor sensitivity. Progesterone metabolises to allopregnanolone which modulates GABA-A receptors. Phase-specific neurotransmitter fingerprints: late luteal low serotonin plus GABA withdrawal = anxious irritable low mood; early luteal allopregnanolone GABA effect = calm settled; follicular rising serotonin and dopamine = energised motivated; ovulatory peak neurochemistry = confident social focused. Direct neurobiological effects not psychological.
- Bäckström T et al. Psychoneuroendocrinology 2014 — allopregnanolone and GABA-A receptor modulation. Calming effect of progesterone in early luteal and the rebound anxiety when it drops in late luteal. Primary source for GABA withdrawal mechanism.
- Lokuge S et al. Journal of Psychiatry and Neuroscience 2011 — estrogen as serotonin modulator. Estrogen increases serotonin synthesis, reduces reuptake, and increases receptor sensitivity. Mood tracks estrogen across the cycle in measurable ways.
- Osborn E et al. Frontiers in Pharmacology 2025 — estrogen and progesterone regulate mood, cognition, and brain health across the lifespan. Hormonal fluctuations contribute to PMDD, postnatal depression, and menopausal depression through neurotransmitter pathways. PMDD affects approximately 3 to 8% of women.
- DSM-5 PMDD diagnostic criteria — cyclical mood symptoms confined to the luteal phase with remission in follicular phase. Requires prospective daily symptom tracking across at least two cycles. Source for PMDD pattern detection logic.

**Fertility, mucus, and cycle:**
- Bigelow et al. 2004 (Human Reproduction) — egg white cervical mucus 80% sensitivity for fertile window.
- Wilcox et al. 2000 (NEJM) — fertile window up to 6 days, timing relative to ovulation.
- Crawford N. Diary of a CEO October 2025 — normal period: 3 to 7 days, cycle 21 to 35 days, flow not requiring pad change more than every 1 to 2 hours, pain not disrupting daily life. Irregular cycles may indicate PCOS, endometriosis, or hormonal imbalance. 50% of unexplained infertility may have endometriosis — verify against Meuleman 2009.
- Meuleman C et al. Human Reproduction Update 2009 — endometriosis and subfertility. Use as primary source for endometriosis/infertility claim.
- Nnoaham KE et al. Fertility and Sterility 2011 — endometriosis diagnostic delay. Average 7 to 10 years — verify exact range from this study.
- Quenby S et al. The Lancet 2021 — miscarriage epidemiology. Use as primary source for pregnancy loss rates.
- Crawford N. Diary of a CEO October 2025 — the 5 fertility non-negotiables: sleep 7 to 9 hours, manage stress, do not smoke, maintain a weight the hormonal system can support, take folate if any chance of pregnancy.
- World Health Organization fertility awareness guidelines.
- Fertility Awareness Method clinical guidelines.

**Wearables and temperature:**
- Oura Ring 2025 validation study — 96.4% ovulation detection accuracy, error ±1.26 days.
- Zhu et al. 2021 (JMIR) — wrist temperature 86.2% accuracy. Shift 0.3 to 0.5 degrees Celsius above follicular baseline.
- Stanford wearables research group publications.
- BBT clinical fertility guidelines.

**PCOS:**
- Teede HJ et al. Human Reproduction 2018 — international PCOS guideline. Use as primary source for all PCOS management language.
- Woodward A et al. Obesity Reviews 2019 — exercise interventions in PCOS. Resistance training and insulin sensitivity.
- Fica S et al. Journal of Medicine 2008 — insulin resistance central to PCOS pathogenesis.
- Rickenlund A et al. Journal of Clinical Endocrinology 2003 — PCOS-like features in athletes. Verify "more common in successful athletes" claim against this source.
- Haver MC. Diary of a CEO October 2025 — insulin resistance fuels hormone imbalance, irregular cycles, and infertility. Birth control masks PCOS symptoms without fixing root cause.

**Bone density:**
- Kohrt WM et al. MSSE 2004 — bone health and exercise.
- Wright V. Diary of a CEO October 2025 — bone can be built in your 40s. Every resistance training session stimulates bone formation. Verify against Kohrt 2004 and ACSM guidelines.
- FDA Depo-Provera prescribing information 2016 — Depo causes significant bone mineral density loss. Partial recovery only. Black box warning.
- ScienceDirect 2006 BMD recovery study — spine BMD recovers approximately 37 months after stopping Depo. Hip BMD takes 48 to 92 months.

**Perimenopause and menopause:**
- Harlow SD et al. Climacteric 2012 — STRAW+10 reproductive aging staging. Gold standard for perimenopause onset age. Verify "as early as 35" claim against this study.
- Freeman EW et al. Archives of General Psychiatry 2004 and 2006 — depression risk across menopausal transition.
- Bromberger JT, Epperson CN. Depression and Anxiety 2018 — mental health and menopause.
- Soares CN. Menopause 2014 — depression in perimenopause.
- Manson JE et al. New England Journal of Medicine 2013 — HRT timing hypothesis reanalysis of WHI. HRT started within 10 years of menopause or before age 60 associated with reduced risk.
- Murabito JM et al. Journal of Clinical Endocrinology and Metabolism 2005 — heritability of menopause timing. Maternal age is predictive.
- Haver MC. Diary of a CEO October 2025 — perimenopause can begin at 35. Only 4% of eligible women use FDA-approved HRT. Verify current uptake statistics from peer-reviewed public health data. Verify suicide risk claims against Bromberger 2018 and Soares 2014 before including.

**Research gap and women's health history:**
- NIH Revitalization Act 1993 — women required in NIH-funded research. US law. Note this applies to US NIH-funded research specifically.
- Wright V, Haver MC. Diary of a CEO October 2025 — funding gap claim. Verify "$450 billion, less than 1% to women over 40" statistic from original McKinsey or Gates Foundation source before using exact figure.
- Sims ST. Diary of a CEO October 2025 — women are not small men. All exercise science built on male bodies.
- Crawford N, Haver MC, Sims ST, Wright V. Diary of a CEO October 2025 — women gaslight themselves about pain. Whiny woman dismissal is systemic across all medical specialties.

---

## Phase calculation — use this exact logic everywhere via hormoneSync.js, never duplicate it

```javascript
function getPhase(cycleDay, cycleLen) {
  const ovulation = Math.round(cycleLen / 2)
  if (cycleDay <= 5) return 'Menstrual'
  if (cycleDay <= ovulation - 2) return 'Follicular'
  if (cycleDay <= ovulation + 1) return 'Ovulatory'
  return 'Luteal'
}

function getLutealSubPhase(cycleDay, cycleLen) {
  const ovulation = Math.round(cycleLen / 2)
  const lutealDay = cycleDay - ovulation - 1
  if (lutealDay <= 4) return 'Early luteal'
  if (lutealDay <= 9) return 'Mid luteal'
  return 'Late luteal'
}
```

## Intensity modifiers — use these exact values
- Menstrual: 0.70
- Follicular early: 0.95
- Follicular late: 1.05
- Ovulatory: 1.05
- Early luteal: 0.92
- Mid luteal: 0.82
- Late luteal: 0.72
- Observation mode (Depo recovery or no cycle data): 0.72 — low-estrogen environment resembles menstrual phase

## Hormone reference ranges for interpretation cards
```javascript
const HORMONE_REFS = {
  progesterone: {
    follicular: { low: 0.1, high: 3.0, label: 'Follicular range' },
    earlyLuteal: { low: 2.0, high: 20.0, label: 'Early luteal' },
    midLuteal: { low: 10.0, high: 50.0, label: 'Confirmed ovulation' },
    ovulationConfirmed: 10.0
  },
  estradiol: {
    earlyFollicular: { low: 77, high: 330, label: 'Early follicular' },
    ovulatory: { low: 222, high: 1959, label: 'Ovulatory peak' },
    luteal: { low: 95, high: 854, label: 'Luteal range' }
  },
  lh: {
    follicular: { low: 2.0, high: 13.2 },
    surge: { low: 8.0, high: 90.0, label: 'LH surge — ovulation imminent' }
  },
  cortisol: {
    morningNormal: { low: 10.0, high: 30.0, label: 'Normal morning cortisol' },
    elevated: 30.0,
    suppressed: 5.0
  }
}
```

Every hormone reference range shown in the app must include: "This is a population average. Your personal normal may be different. What matters most is your pattern across multiple cycles."

## Muscle group options — correct real-world training splits

Section 1 — Train everything (single tap):
- Full body — everything in one session
- Upper body — push and pull combined
- Lower body — quads, hamstrings, glutes, calves

Section 2 — Build your own (multi-select checkboxes):
- Chest, shoulders and triceps
- Back and biceps
- Legs
- Glutes and hamstrings
- Glutes only
- Arms

Core finisher toggle at bottom of both sections.

## Auth and session protection — add to every screen except login.html

IMPORTANT: The pattern below uses `return` after redirect. In ES modules (all HTML files use `<script type="module">`), `return` at the top level of a module causes a SyntaxError. Omit `return` when the auth check runs at module top level. The safe pattern for module scripts:
```javascript
const { data: { session: _s } } = await supabase.auth.getSession()
if (!_s) { window.location.href = 'login.html' }
supabase.auth.onAuthStateChange((event, session) => {
  if (!session) window.location.href = 'login.html'
})
```

## Loading spinner — add to every screen
```css
.spinner {
  width: 32px; height: 32px;
  border: 3px solid #ede8e0;
  border-top-color: #c8b89a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 60px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
```
Show spinner immediately on page load. Hide when all Supabase data has loaded. Never show a blank screen.

## Upsert pattern
```javascript
await supabase.from('daily_logs').upsert(record, { onConflict: 'user_id,log_date' })
await supabase.from('mucus_logs').upsert(record, { onConflict: 'user_id,log_date' })
```

## getTodayStatus — single shared function for all screens
hormoneSync.js must export getTodayStatus which returns:
```javascript
{
  phase, subPhase, cycleDay, cycleLen, daysUntilPeriod,
  confidence, confidenceLabel, confidencePct,
  intensityModifier, intensityLabel,
  nutritionTargets: { proteinG, extraCalories, headline, keyFoods, avoid, source },
  immediateFeedback: [],
  anomalies: [],
  predictions: [],
  symptomInference: {
    inferredPhase,    // 'Follicular' | 'Menstrual' | 'Ovulatory' | 'Luteal' | null
    confidence,       // 'low' | 'medium' | 'high' | 'insufficient'
    confidencePct,    // rough percentage for UI display
    signals,          // string[] — what drove the inference
    source            // always 'symptom_inference'
  }
}
```
Every screen imports this. No screen calculates phase independently.

## inferPhaseFromSymptoms — symptom-based fallback phase detection
hormoneSync.js exports inferPhaseFromSymptoms(recentLogs, mucusLogs).
- If phase is confirmed from period date: inference runs alongside as supporting evidence
- If no cycle data at all: inference result becomes the working phase (clearly labeled as estimated)
- Returns null inferredPhase if fewer than 3 distinct signals are detected
- UI must never show inferred phase with same confidence as a calculated phase
- Always use "may be" or "looks like" language for inferred phases, never "You are in"
- Sources: Janse de Jonge 2003 Sports Medicine; Bigelow et al. 2004 Human Reproduction; De Martin Topranin 2023 IJSPP; Zhu et al. 2021 JMIR

## Confidence labels — based on personal learning not population comparison
- Under 30%: "Learning your baseline — using population averages for now"
- 30 to 55%: "Your personal pattern is emerging — population averages fading out"
- 55 to 75%: "Mostly your data now — your personal normal is becoming clear"
- 75 to 90%: "Your personal baseline established — almost entirely based on you"
- Above 90%: "Fully personalised — your recommendations are based on your cycle, not anyone else's"

---

## Content requirements — implement all of these

### ONBOARDING — setup.html

**Welcome screen — first thing new user sees:**
"You have probably been dismissed before. Maybe your pain was called normal. Maybe your symptoms were called anxiety. Maybe you were told to come back if it got worse. HormoneSync is not that. Your body sends signals every single day. This app learns to read them — and takes every single one seriously. Welcome."
Source: Haver, Crawford, Wright. Diary of a CEO October 2025.

**Research gap card — shown once, dismissible:**
"Almost everything you have been told about exercise and nutrition was researched on men and generalised to women. Women were not required to be included in research studies until 1993 (NIH Revitalization Act). HormoneSync is built on research conducted on women."

**Vital sign framing — shown during onboarding:**
"Your menstrual cycle is a monthly health report. It reflects your bone health, brain health, cardiovascular health, and metabolic health. When it is regular and pain-free your hormonal system is functioning well. When it is not it is sending you a signal worth listening to."
Source: Crawford N. Diary of a CEO October 2025.

**Birth control path card:**
"Birth control manages symptoms but does not fix the underlying hormonal pattern. If you were put on the pill for irregular cycles, PCOS, endometriosis, or painful periods the original condition is still there waiting to be understood. HormoneSync helps you see your hormones clearly now that you can see them."
Source: Crawford N. Diary of a CEO October 2025. Teede et al. 2018.

**Depo-Provera specific card (shown when bc_type is depo):**
"What to expect after Depo — your honest timeline. 55% of women have no period at 12 months after Depo. 68% have no period at 24 months. About 93% of women conceive within 18 months. Cycle return can take 9 to 18 months. This is completely normal for Depo. It does not mean something is wrong. HormoneSync will track your recovery signals daily."
Source: FDA Depo-Provera prescribing information 2016.

**5 fertility non-negotiables card (Path 1 and Path 3):**
1. Sleep 7 to 9 hours — reproductive hormones are produced during sleep
2. Manage stress actively — cortisol directly suppresses GnRH
3. Do not smoke — accelerates egg loss
4. Maintain a weight your hormonal system can support
5. Take folate 400mcg daily if any chance of pregnancy
Source: Crawford N. Diary of a CEO October 2025. Verify each claim against peer-reviewed sources before shipping.

**Decade-by-decade card in setup:**
Teens and 20s: Peak bone-building window. Every strength session builds foundation for life. First 2 years of cycling: irregular periods are normal. After 2 years: worth investigating.
Late 20s to early 30s: Highest hormonal output. Cycle syncing has most pronounced effect. Peak fertility window.
Late 30s: Perimenopause can begin here per STRAW+10 staging (Harlow 2012). Start tracking now.
40s: Bone and muscle can still be built. Protein needs increasing. Sleep becomes more critical.
Source: Wright V, Haver MC, Sims ST. Diary of a CEO October 2025. Harlow 2012 for perimenopause onset.

### DASHBOARD — dashboard.html

**Personal baseline card (shown after 2 cycles):**
Shows personal average cycle length vs population 28 days, personal follicular length, personal luteal length, personal temperature baseline, personal RHR. Under each: "Your personal pattern drives your recommendations — not the population average."
Source: Crawford, Haver, Sims, Wright. Diary of a CEO October 2025. Janse de Jonge 2003.

**Allostatic load indicator:**
Weekly score 1 to 10. Green under 4. Amber 4 to 7. Red above 7.
Calculated from: poor sleep (+2), high intensity 3+ consecutive days (+2), each disruptor logged (+1), very low energy 2+ consecutive days (+2), late luteal or menstrual (+1).
When above 7: "Your combined load this week is high. When allostatic load is consistently high your body responds by down-regulating reproductive hormones. Consider rest, eat more, prioritise sleep."
Source: Sims ST. ROAR 2024. Diary of a CEO October 2025.

**Wearable accuracy warning (mid and late luteal):**
"Your wearable readiness score may be lower than usual. Wearable algorithms were calibrated on male physiology. Your elevated core temperature and RHR in the luteal phase looks like poor recovery to a device that treats male physiology as the default. Dr Stacy Sims identified this specifically. Your HormoneSync recommendations already account for this."
Source: Sims ST. Diary of a CEO October 2025.

**Bone density card (Path 2 Depo users):**
"Depo-Provera reduces estrogen and causes measurable bone mineral density loss. The FDA carries a black box warning. Spine bone density recovery takes approximately 37 months. Hip bone density can take 4 to 8 years (ScienceDirect 2006). Weight-bearing exercise and strength training are the most effective non-pharmacological interventions. Every workout you log is actively protecting your long-term bone health."
Nutrition note: "Calcium 600mg twice daily and vitamin D 800 to 1000 IU are recommended during Depo recovery."
Source: FDA Depo-Provera prescribing information 2016. ScienceDirect bone density recovery study 2006.

**Depo doctor referral trigger:**
At 12 months observation with no cycle return: "It has been 12 months since you stopped Depo with no confirmed cycle return. This is within the normal range but worth mentioning to your doctor. Ask for estrogen, FSH, LH, and progesterone blood tests."
At 18 months: Stronger card recommending GP appointment.

**Research gap banner (shown once, dismissible):**
"Less than 1% of the $450 billion spent on health research goes to women over 40. Women were not required to be included in medical research studies until 1993. HormoneSync is different — every recommendation is based on research conducted on women."
Source: Haver MC. Diary of a CEO October 2025. Verify funding statistic against original McKinsey/Gates source.

**Phase cards — each must include:**
- Hormonal description
- Training implication
- Nutrition implication
- Mental health and brain health dimension:
  - Menstrual: "Estrogen and progesterone are at their lowest. Mood, motivation, and brain clarity may all be affected. This is hormonal — not a reflection of your character."
  - Follicular: "Rising estrogen supports mood, cognitive clarity, and motivation."
  - Ovulatory: "Peak estrogen and testosterone. Confidence, social drive, and cognitive performance all elevated. Biological, not coincidental."
  - Luteal: "Progesterone affects mood, sleep, and cognition. These are real hormonal effects — not weakness."
  - All: "These are population average hormone levels. Your personal levels may be higher or lower and still be completely normal for you."

**PCOS pattern flag:**
When cycle consistently over 35 days + no detected ovulation signals + 3 cycles: "Your cycle pattern shows some features sometimes associated with PCOS. This is not a diagnosis. PCOS is very manageable through training and nutrition. Worth discussing with your doctor."
Source: Crawford N. Diary of a CEO October 2025. Teede 2018 for PCOS management language.

**Endometriosis pain flag:**
When pain 4 or 5 logged for 2+ consecutive cycles: "Severe period pain is not something you have to accept. Excruciating cramps can indicate endometriosis, adenomyosis, or uterine fibroids. Women wait an average of years for a diagnosis because pain is dismissed. If your pain consistently disrupts your daily life please pursue a proper investigation."
Source: Crawford N. Diary of a CEO October 2025. Nnoaham 2011 for diagnostic delay data — use published figure not podcast.

**"Women suffer longer" motivation card (observation mode 30+ days):**
"Women live longer than men but spend 20% more of their lives in poor health. What you are doing right now — tracking your hormonal health before something goes wrong — is exactly the kind of proactive care that changes this."
Source: Haver MC. Diary of a CEO October 2025. Verify McKinsey statistic.

**Perimenopause awareness card (users showing symptoms and possible age 35+):**
"Perimenopause can begin as early as age 35. Sleep disruption, mood changes, cycle irregularity, and brain fog in your late 30s may be early hormonal shifts — not just stress. Worth discussing with a doctor who specialises in hormonal health."
Source: Haver MC, Wright V. Diary of a CEO October 2025. Harlow 2012 STRAW+10 — verify age range.

**HRT education card (Path 4 perimenopause):**
"In 2002 a study caused panic about HRT. Headlines said it caused cancer and heart attacks. The study was later found to have been misinterpreted — it used older women and outdated formulations. Current evidence shows HRT started within 10 years of menopause or before age 60 is associated with reduced risk of osteoporosis, heart disease, and dementia. Only a small percentage of eligible women currently use it. Most are suffering unnecessarily."
Source: Manson JE et al. NEJM 2013. Haver MC. Diary of a CEO October 2025. Verify uptake percentage from peer-reviewed public health data.

**Perimenopause mental health card (Path 4, shown sensitively):**
"The hormonal transition into menopause is associated with significant mood changes and in some women depression. This is a hormonal situation not a psychological weakness. If you are experiencing depression or very low mood during this transition please speak to a doctor who understands hormonal mental health."
If user logs crisis-level mood: include Crisis Services Canada 1-833-456-4566 or text 45645.
Source: Freeman 2004/2006. Bromberger 2018. Soares 2014. Verify suicide risk claim carefully against these sources before including.

### LOG SCREEN — log.html

**Flow volume tracking (menstrual phase only):**
Options: Spotting only, Light, Moderate, Heavy, Very heavy.
Note: "Flow volume is clinical information. Lighter than usual bleeding can indicate lower estrogen exposure. Heavier may indicate higher exposure or other factors. We track your personal pattern over time."
Source: Crawford N. Diary of a CEO October 2025.
Add flow_volume column to daily_logs table if not present.

**Pain scale (menstrual phase only):**
1 None, 2 Mild barely noticeable, 3 Moderate distracting, 4 Severe affects daily activities, 5 Debilitating cannot function.
Note: "Pain that disrupts your daily life is not normal. Log it here and we will track the pattern."
Add pain_rating column to daily_logs table if not present.

**Anaemia education — iron section:**
"The problem with standard anaemia tests: standard haemoglobin thresholds were set using male data. A woman can be functionally iron deficient — depleted stores affecting performance and mood — while her haemoglobin looks normal. Ask your doctor for a full iron panel including ferritin. Ferritin below 30 mcg/L is functionally deficient for active women even with normal haemoglobin."
Source: Crawford N. Diary of a CEO October 2025. Burden 2015 BJSM — verify 30 mcg/L threshold. WHO 2011 — verify haemoglobin threshold origin claim.

**Sleep field note:**
"Sleep is not passive recovery. Estrogen and progesterone are produced and regulated during sleep. Consistently poor sleep disrupts the hormonal cascade."
Source: Haver MC, Wright V. Diary of a CEO October 2025.

**Caffeine disruptor note (when logged):**
"Caffeine above 200mg before training raises cortisol and compounds the hormonal stress of hard training. In the luteal phase this effect is stronger because progesterone already elevates baseline cortisol load."
Source: Sims ST. ROAR 2024. Hackney 2006.

**Hormone+ section (full log, optional):**
Estradiol pmol/L, progesterone nmol/L, LH IU/L, cortisol nmol/L.
Show LifeLabs/EORLA reference range next to each field.
All ranges must include: "Population average — your personal normal may differ."

### NUTRITION CARDS — all phases

**Fasting warning (all phase nutrition cards, collapsible):**
"Intermittent fasting and skipping breakfast can backfire for women. Research suggests fasting can suppress the HPA axis in women, raise cortisol, and disrupt the hormonal system that regulates your cycle. Eat within 30 to 60 minutes of waking. Especially important in the luteal phase."
Source: Sims ST. ROAR 2024. Diary of a CEO October 2025. Hamadeh MJ et al. Am J Physiol 2005.

**Insulin resistance education (follicular and luteal cards):**
"Blood sugar and your hormones: insulin resistance is one of the most common hidden drivers of irregular cycles, PCOS, and hormonal imbalance. Eating protein and healthy fats before carbohydrates, avoiding ultra-processed foods, and resistance training are the three most evidence-supported lifestyle interventions."
Source: Haver MC, Crawford N. Diary of a CEO October 2025. Teede 2018. Fica 2008.

**Creatine recommendation (all phases):**
"Creatine for women — an underused tool: women have lower natural creatine stores than men. 3 to 5g daily with food supports muscle strength, cognitive function, and mood. Safe across the menstrual cycle. Particularly useful in the luteal phase when protein breakdown is elevated."
Source: Rawson ES et al. JISSN 2018. Candow DG et al. Nutrients 2021. Sims ST. Diary of a CEO October 2025.

**Natural period pain relief (late luteal, collapsible):**
Starting 5 to 7 days before predicted period:
- Anti-inflammatory foods: oily fish, turmeric, ginger, leafy greens. Reduce processed food, sugar, alcohol.
- Magnesium 400mg daily — relaxes smooth muscle including uterus (Facchinetti 1991)
- Omega-3 fatty acids — compete with arachidonic acid to reduce prostaglandin production (Rahbar 2012)
- Heat therapy — reduces prostaglandin-driven cramping (Akin 2001)
- Gentle exercise — movement reduces prostaglandins

**Calcium and vitamin D (Path 2 Depo users, all phases):**
"Calcium 1000mg daily and vitamin D 800 to 1000 IU are especially important during hormonal contraceptive recovery. Calcium from dairy, sardines, almonds, leafy greens."
Source: FDA Depo-Provera prescribing information 2016.

### WORKOUT SCREEN — workout.html

**Phase banner muscle mass note:**
"Muscle mass is one of the most powerful things you can build for your long-term hormonal health. It improves insulin sensitivity, supports healthy estrogen metabolism, and directly influences how well you transition through perimenopause and menopause."
Source: Wright V. Diary of a CEO October 2025. Kohrt 2004.

**Bone building note (users over 35 or in late 30s):**
"Yes you can build bone in your 40s. Bone responds to load at every age. Every weighted squat and every deadlift stimulates bone formation. The window before menopause is a critical bone-building opportunity while estrogen is still present to support the process."
Source: Wright V. Diary of a CEO October 2025. Kohrt 2004 MSSE.

**Wearable limitations note (mid and late luteal with wearable connected):**
Show same wearable accuracy warning as dashboard.

**PCOS high training volume flag:**
When 5+ gym sessions per week for 3+ consecutive weeks and irregular cycle or no cycle: show PCOS training load warning.

**RED-S education (observation mode users and high training volume users):**
"RED-S — Relative Energy Deficiency in Sport — happens when energy burned through exercise consistently exceeds energy taken in through food. Your body responds by shutting down non-essential systems. Reproduction is first to go. Signs: persistent fatigue, getting sick frequently, stress fractures, missing or irregular period. You do not need to be elite or underweight for RED-S to affect you."
Source: IOC Consensus Statement on RED-S 2023 (Mountjoy et al. BJSM). Sims ST. Diary of a CEO October 2025.

**No period is not a fitness badge (observation mode, training-related loss):**
"A missing period is not a sign you are training hard enough. It is a sign your body has decided reproduction is too costly given your current energy balance. Your period returning is not a sign you are getting softer. It is a sign your body is healthy enough to perform at its best."
Source: Sims ST. Diary of a CEO October 2025. IOC RED-S 2023.

**Ovulatory ACL warning:**
Prominent amber card when ovulatory + high intensity selection: "Peak estrogen this week increases ligament laxity. A thorough warmup is not optional today — complete all warmup exercises before loading any weight."
Source: Cite specific peer-reviewed ACL injury risk research — SOURCE NEEDED until verified.

**Post-workout nutrition card:**
Pull phase and body_weight_kg from Supabase. Show specific gram target, timing window, 3 food suggestions.
Mid-luteal 65kg woman example: "Eat 130g protein today. Within 45 minutes: Greek yogurt with pumpkin seeds, salmon with sweet potato, or eggs with spinach. Progesterone is increasing your protein breakdown rate right now (ISSN 2023)."

### PREGNANCY LOSS SUPPORT
Accessible from log screen and setup. Only shown when relevant. Extreme sensitivity required.
"Up to 1 in 4 known pregnancies ends in miscarriage (Quenby et al. The Lancet 2021). Most early losses are caused by chromosomal abnormalities — not caused by exercise, stress, food, or anything the mother did. Women are rarely told this clearly. HormoneSync will continue tracking your cycle as your hormones re-establish, typically 4 to 8 weeks."
Recurrent loss (3+): mention investigating thyroid, autoimmune, clotting disorders, uterine anatomy.

### CONTRACEPTIVE INFORMATION (setup.html)
Non-judgmental information about each method including effects on cycle visibility, training adaptation, and recovery. Note that all hormonal methods suppress natural cycle. Copper IUD is non-hormonal. New progestin-only pills have different profiles.
Source: Crawford N, Sims ST. Diary of a CEO October 2025. Teede 2018.

---

## Ongoing work — what to do every session

There is no fixed task list. Every session:

1. Re-read this entire file
2. Check user_feedback table for pending feedback — process before anything else
3. Run continuous quality loop on every file
4. Run full audit — code, UX, science, visual, data
5. Fix everything found — do not report, fix
6. Verify every health claim has two peer-reviewed sources — mark SOURCE NEEDED if not
7. Add new research sources found to Research Foundation above
8. Think like a product manager — what would make this better for a real woman today
9. Run audit again after all fixes
10. Keep going until zero issues remain

Never stop. There is always something that can be improved, verified, or made more human.

---

## Trial user feedback system — check and process this every session

Check user_feedback table at the start of every session. Process pending feedback before anything else.

```javascript
const { data: feedback } = await supabase
  .from('user_feedback')
  .select('*')
  .eq('status', 'pending')
  .order('frustration_rating', { ascending: false })
```

For each pending item present to Emma in this format:

---
FEEDBACK #[id] — [priority]
User reported: "[exact words]"
Screen: [screen] — Frustration: [rating]/5
What they want: [one sentence]

OPTION A — [simple fix]
What: [description] | Files: [list] | Risk: [level and why]

OPTION B — [complete fix]
What: [description] | Files: [list] | Risk: [level and why]

My recommendation: Option [A/B] because [one sentence]
Reply YES A, YES B, or NO.
---

Do not implement anything until Emma replies. When she says yes implement immediately, mark resolved in Supabase, run full audit on affected files.

Watch for patterns: 3+ users reporting same issue = systemic problem. Present to Emma separately.

Add subtle feedback link to dashboard.html:
```html
<div style="text-align:center;padding:12px 0;margin-bottom:8px">
  <a href="feedback.html" style="font-size:12px;color:#9a9590;text-decoration:none;display:inline-flex;align-items:center;gap:6px">
    <i class="ti ti-message-circle" style="font-size:14px"></i>
    Share feedback
  </a>
</div>
```
