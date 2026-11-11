function hasSymptom(log, symptom) {
  const aliases = symptom === 'Cramping' ? ['Cramping', 'Cramps'] : [symptom]
  return (log.symptoms || []).some(item => aliases.includes(item))
}

const FOCUS_FILTERS = {
  'ovulation pain': { title:'ovulation-pain days', matches: log => hasSymptom(log, 'Ovulation pain') },
  headaches: { title:'headache days', matches: log => hasSymptom(log, 'Headache') },
  migraines: { title:'migraine days', matches: log => hasSymptom(log, 'Migraine') },
  cramps: { title:'cramp days', matches: log => hasSymptom(log, 'Cramping') },
  bloating: { title:'bloating days', matches: log => hasSymptom(log, 'Bloating') },
  'breast tenderness': { title:'breast-tenderness days', matches: log => hasSymptom(log, 'Breast tenderness') },
  'back pain': { title:'back-pain days', matches: log => hasSymptom(log, 'Back pain') },
  nausea: { title:'nausea days', matches: log => hasSymptom(log, 'Nausea') },
  diarrhea: { title:'diarrhea days', matches: log => hasSymptom(log, 'Diarrhea') },
  constipation: { title:'constipation days', matches: log => hasSymptom(log, 'Constipation') },
  cravings: { title:'craving days', matches: log => hasSymptom(log, 'Cravings') },
  'mood swings': { title:'mood-swing days', matches: log => hasSymptom(log, 'Mood swings') },
  acne: { title:'acne days', matches: log => hasSymptom(log, 'Acne') },
  'brain fog': { title:'brain-fog days', matches: log => (log.mood || []).includes('Brain fog') || Number(log.brain_fog_rating) >= 3 },
  'low-energy or fatigue days': { title:'low-energy or fatigue days', matches: log => hasSymptom(log, 'Fatigue') || ['Very low', 'Low'].includes(log.energy) },
  'high-energy days': { title:'high-energy days', matches: log => log.energy === 'High' },
  'poor-sleep days': { title:'poor-sleep days', matches: log => ['Poor', 'Fair'].includes(log.sleep_quality) },
  'good-sleep days': { title:'good-sleep days', matches: log => ['Good', 'Excellent'].includes(log.sleep_quality) },
  'difficult mood days': { title:'difficult mood days', matches: log => (log.mood || []).some(mood => ['Tired', 'Irritable', 'Anxious', 'Sad', 'Brain fog', 'Low mood'].includes(mood)) },
  'positive mood days': { title:'positive mood days', matches: log => (log.mood || []).some(mood => ['Energetic', 'Motivated', 'Confident', 'Social', 'Calm', 'Focused'].includes(mood)) },
  'high-stress days': { title:'high-stress days', matches: log => Number(log.stress_level) >= 4 },
  'low sex-drive days': { title:'low sex-drive days', matches: log => log.libido === 'Low' },
  'high sex-drive days': { title:'high sex-drive days', matches: log => log.libido === 'High' },
  'heavy-flow days': { title:'heavy-flow days', matches: log => ['Heavy', 'Very heavy'].includes(log.flow_volume) },
  'higher joint-pain days': { title:'higher joint-pain days', matches: log => Number(log.joint_pain_rating) >= 3 },
  'higher-pain days': { title:'higher-pain days', matches: log => Number(log.pain_rating) >= 4 },
  'hard-workout or recovery days': { title:'hard-workout or low-recovery days', matches: log => log.workout_feel === 'Felt hard' || ['Very low', 'Low'].includes(log.energy) },
  'strong-workout days': { title:'strong-workout days', matches: log => log.workout_feel === 'Felt strong' },
  'hot-flash days': { title:'hot-flash days', matches: log => Number(log.hot_flash_count) > 0 },
  'night-sweat days': { title:'night-sweat days', matches: log => Number(log.night_sweats_severity) > 0 },
}

export function calendarFocusFor(value) {
  const filter = FOCUS_FILTERS[value]
  return filter ? { value, ...filter } : null
}
