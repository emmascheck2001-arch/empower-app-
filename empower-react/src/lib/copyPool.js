// copyPool.js — stops the app saying the identical sentence every morning.
//
// THE PROBLEM: the dashboard greeted her with the same words on day 9 and day 10 and day 11.
// Identical copy is its own kind of boring, and it makes a phase that changes slowly feel
// like an app that is not paying attention.
//
// RULES (never loosen):
//  1. VARIATION IS COSMETIC ONLY. Every line in a pool must mean the SAME thing. Never vary
//     the substance, a health statement, a number, or a recommendation — only the wording.
//  2. DETERMINISTIC PER DAY. Seeded by the date so it does not reshuffle on every re-render
//     (which would read as glitchy), but differs from yesterday.
//  3. No hype, no false cheer, nothing that implies knowledge the app does not have.
// Pure functions, unit-tested.

// Small stable string hash → the same date always yields the same pick.
export function seedFrom(str) {
  let h = 2166136261
  for (let i = 0; i < (str || '').length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h)
}
export function pick(pool, seed) {
  if (!pool || !pool.length) return null
  return pool[seedFrom(String(seed)) % pool.length]
}

// Greetings. Time-of-day aware, and deliberately plain — no exclamation marks, no cheerleading.
const GREETINGS = {
  morning: ['Good morning', 'Morning', 'Hi', 'Morning — here is today'],
  afternoon: ['Good afternoon', 'Afternoon', 'Hi', 'Hi — here is where today sits'],
  evening: ['Good evening', 'Evening', 'Hi', 'Evening — here is today'],
}
export function greeting(name, hour = 9, dateSeed = '') {
  const slot = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const g = pick(GREETINGS[slot], `${dateSeed}|greet`) || 'Hi'
  return name ? `${g}, ${name}` : g
}

// Prompts to log. Same request, different words. None of them nag or guilt.
const LOG_PROMPTS = [
  'Two taps and today is on the record.',
  "Tell me how today is going and I'll update where you are.",
  "A quick check-in keeps the prediction sharp.",
  "Log today and I'll show you what it changed.",
  "Thirty seconds, and today counts toward your pattern.",
]
export function logPrompt(dateSeed = '') { return pick(LOG_PROMPTS, `${dateSeed}|log`) }

// Lines for a day already logged. Again: same meaning, varied wording.
const LOGGED_LINES = [
  'Today is logged.',
  'Got today, thank you.',
  "Today's in. That one counted.",
  'Logged — today is part of your pattern now.',
]
export function loggedLine(dateSeed = '') { return pick(LOGGED_LINES, `${dateSeed}|done`) }

// Phase framings. Each pool says the SAME factual thing about the phase, worded differently.
// Nothing here is a recommendation or a health claim — those live in the coach and nutrition
// engines and are never varied.
const PHASE_FRAMINGS = {
  Menstrual: [
    'Your period is underway.',
    "You're bleeding — this is day one territory of a new cycle.",
    'Menstrual phase: your body has started a fresh cycle.',
  ],
  Follicular: [
    'You are in the follicular phase, building toward ovulation.',
    'Follicular phase — the climb toward ovulation.',
    'Post-period, pre-ovulation: the follicular stretch.',
  ],
  Ovulatory: [
    'You are around ovulation.',
    'Ovulatory window — the peak of the cycle.',
    'This is your ovulation stretch.',
  ],
  Luteal: [
    'You are in the luteal phase, the stretch before your period.',
    'Luteal phase — the run-in to your next period.',
    'Post-ovulation: the luteal stretch.',
  ],
}
export function phaseFraming(phase, dateSeed = '') {
  return pick(PHASE_FRAMINGS[phase], `${dateSeed}|${phase}`) || null
}

// Every pool must be internally interchangeable. Exported so a test can assert every pool is
// non-empty and free of duplicates, which is what keeps variation real.
export const POOLS = { GREETINGS, LOG_PROMPTS, LOGGED_LINES, PHASE_FRAMINGS }
