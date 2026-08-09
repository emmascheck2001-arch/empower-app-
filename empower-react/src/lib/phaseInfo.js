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
    estrogen: { direction:'Generally low', patterns:['Mood and energy are personal and shaped by many things','Levels usually begin rising after menstruation'] },
    progesterone: { direction:'Generally low', patterns:['The previous decline is involved in menstruation','Temperature and heart rate may move toward personal baseline'] },
    expect: 'With estrogen and progesterone at their lowest, many women feel more tired and inward in the first days. Aim for gentle movement and iron-rich food, and rest without guilt. Everyone is different, so keep normal activity if you feel well. Repeated heavy bleeding, or pain that limits daily life, deserves care.',
  },
  Follicular: {
    bullets: ['Estrogen generally rises before ovulation','Progesterone generally remains low','Energy, mood and recovery may or may not change','Calendar timing cannot confirm hormone levels'],
    estrogen: { direction:'Generally rising', patterns:['Individual symptoms do not identify an estrogen level','Your training response is personal, so your own results matter most'] },
    progesterone: { direction:'Generally low', patterns:['Temperature often remains near personal baseline before ovulation','A single temperature cannot identify this phase'] },
    expect: 'As estrogen rises, many women notice energy, mood and recovery improving. This is often a good window to progress your training and take on demanding tasks. Responses vary, so let your warm-up and recent performance set the load.',
  },
  Ovulatory: {
    bullets: ['Estrogen commonly peaks before ovulation','An LH surge can precede ovulation','Calendar timing gives only an estimate','This estimated fertile window is not contraception'],
    estrogen: { direction:'Often near a peak', patterns:['Many women feel more confident and focused, though it is individual','A thorough warm-up helps, as higher estrogen can loosen ligaments (Herzberg 2017)'] },
    progesterone: { direction:'Usually begins rising after ovulation', patterns:['A later sustained temperature shift can add retrospective context','Symptoms alone cannot confirm this change'] },
    expect: 'Around ovulation many women feel their strongest and most confident, a good day to push if you feel good. Warm up thoroughly, as peak estrogen can make ligaments a little more lax. This is an estimated fertile window for information only, not contraception, and it does not confirm ovulation occurred.',
  },
  'Early luteal': {
    bullets: ['Progesterone generally rises after ovulation','Temperature may shift above personal baseline','Mood and energy remain individual','No workout or food change is required'],
    estrogen: { direction:'May dip and rise again', patterns:['Calendar timing cannot identify the exact level','Mood can shift for many reasons beyond your cycle'] },
    progesterone: { direction:'Generally rising', patterns:['A sustained temperature pattern can support a retrospective estimate','Aiming for the higher end of your protein range can help; needs are individual'] },
    expect: 'As progesterone rises after ovulation, many women feel calmer and settled, a good window for focused steady work. Your temperature may edge up slightly. Keep training as planned and aim for the higher end of your protein range.',
  },
  'Mid luteal': {
    bullets: ['Progesterone is often relatively high','Temperature or resting heart rate may shift','Sleep and perceived effort can vary','Recovery can feel a little slower for some'],
    estrogen: { direction:'Often declining after a second rise', patterns:['Mood is influenced by many interacting factors','Symptoms cannot identify a hormone concentration'] },
    progesterone: { direction:'Often relatively high', patterns:['May raise temperature slightly above personal baseline','A workout can feel a little harder for some, and that is normal'] },
    expect: 'With progesterone high, many women find the same workout feels a bit harder and sleep runs warmer. Aim to maintain your training rather than chase progress, keep protein high, and a cooler room can help sleep. It varies, so log whether this repeats for you.',
  },
  'Late luteal': {
    bullets: ['Estrogen and progesterone usually decline before a period','Premenstrual symptoms occur for some people','Symptoms can also have non-cycle causes','Severe or persistent symptoms deserve care'],
    estrogen: { direction:'Generally declining', patterns:['A decline may contribute to symptoms but is not the only cause','Mood changes do not always resolve when bleeding begins'] },
    progesterone: { direction:'Generally declining', patterns:['The decline is involved in the onset of menstruation','Tension or lower mood can appear for some, with many contributing factors'] },
    expect: 'As hormones drop before your period, many women notice lower mood, cravings or premenstrual symptoms. Aim for gentler movement, magnesium-rich and anti-inflammatory foods, and extra rest. Timing and severity differ, so seek support for severe or persistent mood or pain changes.',
  },
  Luteal: {
    bullets: ['Progesterone generally rises and later declines','Temperature may sit slightly above personal baseline','Heart rate, mood and sleep may or may not change','The same workout can feel a little harder for some'],
    estrogen: { direction:'Often rises again, then declines', patterns:['Changes may contribute to symptoms for some people','Personal repeated observations matter more than a population expectation'] },
    progesterone: { direction:'Generally rises, then declines', patterns:['May affect temperature and heart rate','Can make training feel a little harder for some'] },
    expect: 'After ovulation, many women feel calm early on then find effort creeping up and recovery slowing before their period. Aim to maintain your training and keep protein at the higher end of your range. Your own repeated pattern matters most, so track how sessions feel.',
  },
  Perimenopause: {
    bullets: ['Estrogen fluctuates unpredictably rather than following a steady cycle','Progesterone is declining overall as ovulation becomes less frequent','FSH is rising as the pituitary works harder to stimulate the ovaries','Symptoms are driven by variability, not just low levels'],
    estrogen: { direction:'Fluctuating', patterns:['Levels may vary substantially','Symptoms can have hormonal and non-hormonal contributors'] },
    progesterone: { direction:'Declining overall', patterns:['Less frequent ovulation generally means less progesterone production','Sleep and mood changes should not be assigned to one cause automatically'] },
    expect: 'As estrogen fluctuates, many women notice hot flashes, disrupted sleep, mood swings or brain fog. Prioritise resistance training two to three times a week and higher protein to protect muscle and bone. Needs vary, so confirm supplement and treatment choices with your clinician.',
  },
}
