// Selects one nutrition-relevant symptom from the user's own logs. A symptom
// logged in the last few days takes precedence; otherwise a repeated symptom
// pattern supplies a useful, clearly labelled fallback.
const PATTERN_TO_RELIEF = {
  Cramps: 'cramping',
  Cramping: 'cramping',
  'Back pain': 'cramping',
  Headache: 'headache',
  Migraine: 'headache',
  Bloating: 'bloating',
  'Breast tenderness': 'breast',
  'Brain fog': 'brainfog',
  Acne: 'skin',
  'Skin breakouts': 'skin',
  Cravings: 'cravings',
  Fatigue: 'fatigue',
  'Low energy': 'fatigue',
}

function rank(pattern) {
  return pattern.kind === 'cyclical' ? 0 : pattern.kind === 'emerging' ? 1 : 2
}

export function getLoggedSymptomRelief(status) {
  const recent = status?.personalisedFocus
  if (recent?.focus) return { focus: recent.focus, reason: recent.reason, source: 'recent' }

  const match = [...(status?.symptomPatterns?.patterns || [])]
    .sort((a, b) => rank(a) - rank(b) || b.occurrences - a.occurrences)
    .find(pattern => PATTERN_TO_RELIEF[pattern.symptom])
  if (!match) return null

  const timing = match.kind === 'unrelated'
    ? 'with mixed timing'
    : `most often ${match.windowPhrase}`
  return {
    focus: PATTERN_TO_RELIEF[match.symptom],
    reason: `You have logged ${match.symptom.toLowerCase()} ${match.occurrences} times across ${match.cyclesSpanned} cycles, ${timing}.`,
    source: 'pattern',
  }
}
