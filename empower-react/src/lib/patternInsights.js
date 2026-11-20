// Turns the conservative pattern analyses from the cycle-status pipeline into a
// consistent, display-ready list. Both Dashboard and Calendar use this so a
// newly saved log is reflected in the same way everywhere in the app.
function patternRank(pattern) {
  return pattern.kind === 'cyclical' ? 0 : pattern.kind === 'emerging' ? 1 : 2
}

export function buildPatternInsights(status) {
  return [
    ...(status?.personalPatterns?.insights || []).map(pattern => ({
      id: pattern.id,
      icon: 'ti-sparkles',
      label: 'Your pattern',
      title: pattern.headline,
      body: pattern.body,
    })),
    ...[...(status?.symptomPatterns?.patterns || [])]
      .sort((a, b) => patternRank(a) - patternRank(b) || b.occurrences - a.occurrences)
      .map(pattern => ({
        id: `symptom-${pattern.symptom}`,
        icon: 'ti-activity-heartbeat',
        label: 'Symptom',
        title: pattern.kind === 'cyclical'
          ? `${pattern.symptom} tends to show up ${pattern.windowPhrase}`
          : pattern.kind === 'emerging'
            ? `${pattern.symptom} shows an early trend ${pattern.windowPhrase}`
            : `${pattern.symptom} timing is mixed`,
        body: pattern.kind === 'unrelated'
          ? `Logged ${pattern.occurrences} times across ${pattern.cyclesSpanned} cycles, without one dominant cycle window.`
          : `Logged ${pattern.occurrences} times across ${pattern.cyclesSpanned} cycles; ${pattern.dominantPct}% fell ${pattern.windowPhrase}. ${pattern.kind === 'cyclical' ? 'This is a pattern in your own data, not a diagnosis.' : 'An early trend, not a diagnosis.'}`,
      })),
    ...[...(status?.moodPatterns?.patterns || [])]
      .sort((a, b) => patternRank(a) - patternRank(b) || b.occurrences - a.occurrences)
      .map(pattern => ({
        id: `mood-${pattern.mood}`,
        icon: 'ti-mood-heart',
        label: 'Mood',
        title: pattern.kind === 'cyclical'
          ? `${pattern.mood} tends to show up ${pattern.windowPhrase}`
          : pattern.kind === 'emerging'
            ? `${pattern.mood} shows an early trend ${pattern.windowPhrase}`
            : `${pattern.mood} timing is mixed`,
        body: pattern.kind === 'unrelated'
          ? `Logged ${pattern.occurrences} times across ${pattern.cyclesSpanned} cycles, without one dominant cycle window.`
          : `Logged ${pattern.occurrences} times across ${pattern.cyclesSpanned} cycles; ${pattern.dominantPct}% fell ${pattern.windowPhrase}. ${pattern.kind === 'cyclical' ? 'This is a pattern in your own data, not a diagnosis.' : 'An early trend, not a diagnosis.'}`,
      })),
  ].slice(0, 4)
}
