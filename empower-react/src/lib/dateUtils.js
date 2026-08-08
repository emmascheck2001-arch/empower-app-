// DST-safe calendar-date helpers.
//
// The bug this fixes: code all over the app computed day differences as
//   Math.floor((dateA - dateB) / 86400000)
// on local-midnight Date objects. A local calendar day is NOT always 86400000 ms — on the two
// daylight-saving transitions each year it is 23h or 25h — so that division is off by one across
// those boundaries. For a cycle app an off-by-one silently shifts the phase, the predicted period,
// the streak, and "days late". These helpers count CALENDAR days independent of DST by mapping each
// date's LOCAL Y/M/D onto a UTC midnight (which is always an exact multiple of 86400000).

// Parse a 'YYYY-MM-DD' string (or Date) to a Date at LOCAL midnight. Appends T00:00:00 so the
// string is interpreted in local time, not UTC (bare 'YYYY-MM-DD' parses as UTC and can shift a day).
export function parseLocalDate(value) {
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const s = value.length === 10 ? value + 'T00:00:00' : value
    return new Date(s)
  }
  return new Date(value)
}

// The calendar-day index of a date: whole days since the epoch using the date's LOCAL Y/M/D.
// DST-independent because Date.UTC of a pure date is always a multiple of 86400000.
export function toCalendarDayIndex(value) {
  const d = parseLocalDate(value)
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)
}

// Whole calendar days from `b` to `a` (a − b). Positive when a is later. DST-safe.
export function diffCalendarDays(a, b) {
  return toCalendarDayIndex(a) - toCalendarDayIndex(b)
}

// Calendar days between today (local) and a past date — i.e. "how many days ago". DST-safe.
export function daysAgo(value, now = new Date()) {
  return diffCalendarDays(now, value)
}

// Add n calendar days to a date, returning a new Date at local midnight. DST-safe: builds from
// Y/M/D components so it never lands on a non-existent local time.
export function addDays(value, n) {
  const d = parseLocalDate(value)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

// 'YYYY-MM-DD' for a date in LOCAL time (mirrors the app's existing localDateStr()).
export function toDateStr(value = new Date()) {
  const d = parseLocalDate(value)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
