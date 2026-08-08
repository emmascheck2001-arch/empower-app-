// phaseInfo.js, data for the interactive "Your cycle phases" grid + detail sheet.
// Lives in Learn now (moved off the dashboard so home stays about today).
//
// PERMANENT RULES (mirror the dashboard phase-card rules, never revert):
//  - No hormone NUMBERS (pmol/L, nmol/L, IU/L) in `bullets`, `direction`, or `patterns`, //    plain English only. Numbers, if ever added, belong behind a reference-range toggle.
//  - `bullets` is a 4-item plain-English "what is happening" list.
// Source for the hormone picture: Münster et al. 2021 (n=97, 2,105 cycles); LifeLabs/EORLA.

// The 4 cards in the grid (icons + one-line descriptor).
export const PHASE_GRID = [
  { name: 'Follicular', icon: 'ti-bolt',      iconBg: '#f5e8c0', iconColor: '#a07820', desc: 'Estimated pre-ovulation window' },
  { name: 'Ovulatory', icon: 'ti-trophy',    iconBg: '#d0ecd0', iconColor: '#2a6a2a', desc: 'Estimated ovulation window' },
  { name: 'Luteal',    icon: 'ti-moon-stars', iconBg: '#d0e0f0', iconColor: '#2a4a7a', desc: 'Estimated post-ovulation window' },
  { name: 'Menstrual', icon: 'ti-moon',      iconBg: '#f0d8d8', iconColor: '#8a2828', desc: 'Recorded or expected bleeding window' },
]

export const PHASE_SHEET_INFO = {
  Menstrual: {
    bullets: ['Bleeding marks cycle day one','Estrogen and progesterone are generally low','Pain, flow, mood and energy vary widely','Heavy or prolonged bleeding can contribute to iron deficiency'],
    estrogen: { direction:'Generally low', patterns:['A calendar phase cannot predict mood or energy','Levels usually begin rising after menstruation'] },
    progesterone: { direction:'Generally low', patterns:['The previous decline is involved in menstruation','Temperature and heart rate may move toward personal baseline'] },
    expect: 'Bleeding, pain, mood and energy vary. Keep normal activity if you feel well or adapt for your symptoms; repeated heavy bleeding or pain that limits daily life deserves care.',
  },
  Follicular: {
    bullets: ['Estrogen generally rises before ovulation','Progesterone generally remains low','Energy, mood and recovery may or may not change','Calendar timing cannot confirm hormone levels'],
    estrogen: { direction:'Generally rising', patterns:['Individual symptoms do not identify an estrogen level','Training response varies more than a phase label suggests'] },
    progesterone: { direction:'Generally low', patterns:['Temperature often remains near personal baseline before ovulation','A single temperature cannot identify this phase'] },
    expect: 'Some studies report small phase-related differences, but results vary and average effects should not prescribe your workout. Use your recent performance and warm-up.',
  },
  Ovulatory: {
    bullets: ['Estrogen commonly peaks before ovulation','An LH surge can precede ovulation','Calendar timing gives only an estimate','This estimated fertile window is not contraception'],
    estrogen: { direction:'Often near a peak', patterns:['This does not predict confidence, energy or focus','Evidence does not justify a phase-specific injury warning'] },
    progesterone: { direction:'Usually begins rising after ovulation', patterns:['A later sustained temperature shift can add retrospective context','Symptoms alone cannot confirm this change'] },
    expect: 'This is an estimated fertile and ovulatory window, not confirmation that ovulation occurred. It is not a performance or injury-risk score. Warm up well in every phase.',
  },
  'Early luteal': {
    bullets: ['Progesterone generally rises after ovulation','Temperature may shift above personal baseline','Mood and energy remain individual','No workout or food change is required'],
    estrogen: { direction:'May dip and rise again', patterns:['Calendar timing cannot identify the exact level','Do not assign mood changes to this phase automatically'] },
    progesterone: { direction:'Generally rising', patterns:['A sustained temperature pattern can support a retrospective estimate','It does not create a universal protein or training prescription'] },
    expect: 'Temperature may begin to shift after ovulation for some people. Mood, energy and training response remain individual, so keep your plan unless your own signals support a change.',
  },
  'Mid luteal': {
    bullets: ['Progesterone is often relatively high','Temperature or resting heart rate may shift','Sleep and perceived effort can vary','Recovery is not assumed to be slower'],
    estrogen: { direction:'Often declining after a second rise', patterns:['Mood is influenced by many interacting factors','Symptoms cannot identify a hormone concentration'] },
    progesterone: { direction:'Often relatively high', patterns:['May raise temperature slightly above personal baseline','Does not prove that a workout will feel harder'] },
    expect: 'Some people notice heat, heart-rate, sleep or perceived-effort changes after ovulation. Do not reduce load automatically; log whether the pattern repeats for you.',
  },
  'Late luteal': {
    bullets: ['Estrogen and progesterone usually decline before a period','Premenstrual symptoms occur for some people','Symptoms can also have non-cycle causes','Severe or persistent symptoms deserve care'],
    estrogen: { direction:'Generally declining', patterns:['A decline may contribute to symptoms but is not the only cause','Mood changes do not always resolve when bleeding begins'] },
    progesterone: { direction:'Generally declining', patterns:['The decline is involved in the onset of menstruation','It cannot predict anxiety or tension for an individual'] },
    expect: 'Premenstrual symptoms are real for many people, but timing, severity and causes differ. Use your symptoms to adapt the day and seek support for severe or persistent mood or pain changes.',
  },
  Luteal: {
    bullets: ['Progesterone generally rises and later declines','Temperature may sit slightly above personal baseline','Heart rate, mood and sleep may or may not change','The same workout is not assumed to require more effort'],
    estrogen: { direction:'Often rises again, then declines', patterns:['Changes may contribute to symptoms for some people','Personal repeated observations matter more than a population expectation'] },
    progesterone: { direction:'Generally rises, then declines', patterns:['May affect temperature and heart rate','Does not automatically make training harder'] },
    expect: 'Track how the same kinds of sessions feel across this window. Your own repeated pattern matters more than a population average, and no reduction is required from timing alone.',
  },
  Perimenopause: {
    bullets: ['Estrogen fluctuates unpredictably rather than following a steady cycle','Progesterone is declining overall as ovulation becomes less frequent','FSH is rising as the pituitary works harder to stimulate the ovaries','Symptoms are driven by variability, not just low levels'],
    estrogen: { direction:'Fluctuating', patterns:['Levels may vary substantially','Symptoms can have hormonal and non-hormonal contributors'] },
    progesterone: { direction:'Declining overall', patterns:['Less frequent ovulation generally means less progesterone production','Sleep and mood changes should not be assigned to one cause automatically'] },
    expect: 'Resistance training, adequate nutrition and bone-health care can be useful, but exact exercise and supplement needs depend on your health and clinical guidance.',
  },
}
