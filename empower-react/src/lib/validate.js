// Application-level validation for numeric health inputs. HTML min/max on an <input> is only a
// hint — it does not stop a value being set programmatically, pasted, or submitted, so every
// numeric health field must be validated here before it is saved. Mirrored by DB CHECK constraints
// (supabase/migrations/0004_check_constraints.sql) as defense-in-depth.

// Plausible physiological bounds. Values outside these are almost certainly typos or bad data and
// must never reach the algorithm (a negative weight or a 900°C temperature would corrupt targets).
export const RANGES = {
  body_weight_kg:    { min: 25,  max: 300 },   // kg
  height_cm:         { min: 90,  max: 250 },   // cm
  resting_hr_exact:  { min: 25,  max: 220 },   // bpm
  wrist_temp:        { min: 30,  max: 45 },     // °C
  sleep_hours:       { min: 0,   max: 24 },     // hours
  cycle_length:      { min: 15,  max: 90 },     // days
  pain_rating:       { min: 1,   max: 5 },
  hot_flash_count:   { min: 0,   max: 50 },
  hormone_estradiol:     { min: 0, max: 100000 }, // pmol/L
  hormone_progesterone:  { min: 0, max: 1000 },   // nmol/L
  hormone_lh:            { min: 0, max: 500 },     // IU/L
  hormone_cortisol:      { min: 0, max: 5000 },    // nmol/L
}

// Parse a user-entered value to a finite number, or null. Accepts number or string; rejects '',
// NaN, Infinity. Never throws.
export function toNumberOrNull(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).trim())
  return Number.isFinite(n) ? n : null
}

// Is `v` a valid value for `field`? null/empty is considered valid (the field is simply not set).
export function isValid(field, v) {
  const n = toNumberOrNull(v)
  if (n === null) return v == null || v === ''
  const r = RANGES[field]
  if (!r) return true
  return n >= r.min && n <= r.max
}

// Return the value to SAVE for `field`: a finite number within range, else null. This is the
// gatekeeper — a value that is present but out of range is dropped to null rather than persisted,
// so bad data can never look like a real reading. Use before building an upsert payload.
export function sanitize(field, v) {
  const n = toNumberOrNull(v)
  if (n === null) return null
  const r = RANGES[field]
  if (!r) return n
  return n >= r.min && n <= r.max ? n : null
}

// Human message for an out-of-range field, or null if valid. For inline form feedback.
export function rangeError(field, v) {
  if (isValid(field, v)) return null
  const r = RANGES[field]
  return r ? `Enter a value between ${r.min} and ${r.max}.` : 'Enter a valid number.'
}
