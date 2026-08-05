// phaseInfo.js, data for the interactive "Your cycle phases" grid + detail sheet.
// Lives in Learn now (moved off the dashboard so home stays about today).
//
// PERMANENT RULES (mirror the dashboard phase-card rules, never revert):
//  - No hormone NUMBERS (pmol/L, nmol/L, IU/L) in `bullets`, `direction`, or `patterns`, //    plain English only. Numbers, if ever added, belong behind a reference-range toggle.
//  - `bullets` is a 4-item plain-English "what is happening" list.
// Source for the hormone picture: Münster et al. 2021 (n=97, 2,105 cycles); LifeLabs/EORLA.

// The 4 cards in the grid (icons + one-line descriptor).
export const PHASE_GRID = [
  { name: 'Follicular', icon: 'ti-bolt',      iconBg: '#f5e8c0', iconColor: '#a07820', desc: 'Build strength and push hard' },
  { name: 'Ovulatory', icon: 'ti-trophy',    iconBg: '#d0ecd0', iconColor: '#2a6a2a', desc: 'Peak power and coordination' },
  { name: 'Luteal',    icon: 'ti-moon-stars', iconBg: '#d0e0f0', iconColor: '#2a4a7a', desc: 'Recover smart and protect energy' },
  { name: 'Menstrual', icon: 'ti-moon',      iconBg: '#f0d8d8', iconColor: '#8a2828', desc: 'Rest, restore and replenish' },
]

export const PHASE_SHEET_INFO = {
  Menstrual: {
    bullets: ['Estrogen and progesterone are both at their lowest','Serotonin dips with estrogen, so mood and energy can feel low','Prostaglandins, the hormones that cause cramps, rise as the lining sheds','Iron is lost through bleeding, which can add to tiredness'],
    estrogen: { direction:'At its lowest point', patterns:['Mood, motivation, and energy often dip alongside it','It starts climbing again within a few days as your period ends'] },
    progesterone: { direction:'At its lowest point', patterns:['The drop from luteal levels is what started your period','Your body temperature and resting heart rate are back at baseline'] },
    expect: 'Energy is usually at its lowest now, and that is expected. Gentle movement, iron-rich food, and rest help the most. Anti-inflammatory foods like salmon and ginger ease cramps.',
  },
  Follicular: {
    bullets: ['Estrogen is rising','Progesterone stays low','Energy, mood, and recovery usually improve','Body temperature stays near its baseline'],
    estrogen: { direction:'Rising steadily toward ovulation', patterns:['Lifts mood, motivation, and how well your body handles carbs','Helps build muscle and recover faster from training'] },
    progesterone: { direction:'Low, with no temperature or heart-rate rise', patterns:['Resting heart rate and temperature sit at your baseline','Training tends to feel easier than in the luteal phase'] },
    expect: 'This is your strongest training window. Rising estrogen supports strength and faster recovery, so it is a good time to push the weights. Mood and focus often lift too.',
  },
  Ovulatory: {
    bullets: ['Estrogen peaks just before the egg is released','A surge of LH triggers ovulation','Testosterone rises briefly alongside estrogen','This is your most fertile window'],
    estrogen: { direction:'At its peak', patterns:['Confidence, energy, and focus are usually at their highest','Peak estrogen loosens your ligaments slightly, so warm up well'] },
    progesterone: { direction:'Starting to rise after ovulation', patterns:['Begins climbing once the egg is released','Its calming effect builds over the next few days'] },
    expect: 'Your peak window for energy, confidence, and performance. Make the most of it, and warm up thoroughly before heavy gym sessions, since your joints are a little looser now.',
  },
  'Early luteal': {
    bullets: ['Progesterone is rising and brings a calming effect','Energy is often still good','Body temperature starts to rise slightly','A steady, focused phase for getting things done'],
    estrogen: { direction:'Beginning to dip', patterns:['A small second peak, then a gentle decline','Mood can start to feel a little less steady'] },
    progesterone: { direction:'Rising, bringing a calm feeling', patterns:['It converts in the brain into a natural calming compound','Your body starts breaking down protein a little faster'] },
    expect: 'Progesterone is climbing and brings a calmer, settled feeling. Energy is usually still good, so keep making steady progress. Your protein needs start to rise.',
  },
  'Mid luteal': {
    bullets: ['Progesterone is at its peak','Body temperature and resting heart rate are noticeably higher','Serotonin starts to become less steady','Recovery is slower than in the follicular phase'],
    estrogen: { direction:'Declining', patterns:['Falling from its second peak','As it drops, serotonin activity eases off too'] },
    progesterone: { direction:'At its peak', patterns:['Raises your body temperature slightly above baseline','Competes with cortisol, so hard training feels more taxing'] },
    expect: 'Recovery is slower and the same session feels harder. That is your physiology, not lost fitness. Ease the load back a little and prioritise protein.',
  },
  'Late luteal': {
    bullets: ['Both estrogen and progesterone drop sharply','Serotonin is at its lowest since your period','PMS symptoms are most likely in these days','It eases once your period begins'],
    estrogen: { direction:'Dropping sharply', patterns:['The fall lowers serotonin and dopamine','This is the hormonal driver of pre-period mood changes'] },
    progesterone: { direction:'Dropping sharply', patterns:['Losing its calming effect can bring rebound tension or anxiety','The drop signals your body to start your period'] },
    expect: 'This is when PMS is most likely, and it has a hormonal cause, not a personal one. Be kind to yourself. Magnesium, protein, and steady meals help the most.',
  },
  Luteal: {
    bullets: ['Progesterone is high and body temperature rises slightly','Resting heart rate is higher than in the follicular phase','Serotonin becomes less steady through this phase','The same workout takes more effort, and that is physiology'],
    estrogen: { direction:'A second peak, then declining', patterns:['Rises again after ovulation, then falls toward your period','The late drop drives mood and sleep changes'] },
    progesterone: { direction:'Rises to a peak, then drops toward your period', patterns:['Keeps body temperature and heart rate up through the phase','Competes with cortisol, so training feels harder'] },
    expect: 'Same workout, more effort. Track how your body responds across the phase. Your own pattern matters far more than any population average.',
  },
  Perimenopause: {
    bullets: ['Estrogen fluctuates unpredictably rather than following a steady cycle','Progesterone is declining overall as ovulation becomes less frequent','FSH is rising as the pituitary works harder to stimulate the ovaries','Symptoms are driven by variability, not just low levels'],
    estrogen: { direction:'Fluctuating unpredictably', patterns:['Can be higher on some days than at any point in your reproductive years, lower on others','This variability drives symptoms more than consistently low levels'] },
    progesterone: { direction:'Declining overall', patterns:['Ovulation becoming less frequent means less progesterone production','Sleep disruption, mood changes common as progesterone drops'] },
    expect: 'Every strength session protects your bone density and metabolic health. Protein, calcium, vitamin D, and resistance training are your priorities.',
  },
}
