import { toNumberOrNull } from './validate'

const roundTo = (value, places = 1) => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

export const HORMONE_FIELDS = {
  hormone_estradiol: {
    label: 'Estradiol',
    baseUnit: 'pmol/L',
    units: {
      'pmol/L': { min: 20, max: 12000, fromBase: (value) => value, toBase: (value) => value, step: 1 },
      'pg/mL': { min: 5, max: 3500, fromBase: (value) => value / 3.671, toBase: (value) => value * 3.671, step: 1 },
    },
  },
  hormone_progesterone: {
    label: 'Progesterone',
    baseUnit: 'nmol/L',
    units: {
      'nmol/L': { min: 0.2, max: 400, fromBase: (value) => value, toBase: (value) => value, step: 0.1 },
      'ng/mL': { min: 0.1, max: 125, fromBase: (value) => value / 3.18, toBase: (value) => value * 3.18, step: 0.1 },
    },
  },
  hormone_lh: {
    label: 'LH',
    baseUnit: 'IU/L',
    units: {
      'IU/L': { min: 0.1, max: 250, fromBase: (value) => value, toBase: (value) => value, step: 0.1 },
    },
  },
  hormone_cortisol: {
    label: 'Cortisol',
    baseUnit: 'nmol/L',
    units: {
      'nmol/L': { min: 20, max: 2500, fromBase: (value) => value, toBase: (value) => value, step: 1 },
      'ug/dL': { min: 1, max: 90, fromBase: (value) => value / 27.59, toBase: (value) => value * 27.59, step: 0.1 },
    },
  },
}

export const DEFAULT_HORMONE_UNITS = Object.fromEntries(
  Object.entries(HORMONE_FIELDS).map(([field, meta]) => [field, meta.baseUnit]),
)

export function hormoneUnitOptions(field) {
  return Object.keys(HORMONE_FIELDS[field]?.units || {})
}

export function formatHormoneForInput(field, value, unit) {
  const meta = HORMONE_FIELDS[field]
  if (!meta) return value == null ? '' : String(value)
  const n = toNumberOrNull(value)
  if (n == null) return ''
  const nextUnit = meta.units[unit] ? unit : meta.baseUnit
  const places = meta.units[nextUnit]?.step === 1 ? 0 : 1
  return String(roundTo(meta.units[nextUnit].fromBase(n), places))
}

export function convertHormoneUnit(field, rawValue, fromUnit, toUnit) {
  const meta = HORMONE_FIELDS[field]
  if (!meta) return rawValue
  const n = toNumberOrNull(rawValue)
  if (n == null) return ''
  const source = meta.units[fromUnit] || meta.units[meta.baseUnit]
  const target = meta.units[toUnit] || meta.units[meta.baseUnit]
  const baseValue = source.toBase(n)
  const converted = target.fromBase(baseValue)
  const places = target.step === 1 ? 0 : 1
  return String(roundTo(converted, places))
}

export function normalizeHormoneEntry(field, rawValue, unit) {
  const meta = HORMONE_FIELDS[field]
  if (!meta) return { value: toNumberOrNull(rawValue), error: null }
  const selectedUnit = meta.units[unit] ? unit : meta.baseUnit
  const inputValue = toNumberOrNull(rawValue)
  if (inputValue == null) return { value: null, error: null }
  const bounds = meta.units[selectedUnit]
  if (inputValue < bounds.min || inputValue > bounds.max) {
    return {
      value: null,
      error: `${meta.label} looks out of range for ${selectedUnit}. Enter a value between ${bounds.min} and ${bounds.max}, or switch units.`,
    }
  }
  return { value: roundTo(bounds.toBase(inputValue), 2), error: null }
}

export function normalizeHormoneInputs(log, units) {
  const values = {}
  const errors = {}
  for (const field of Object.keys(HORMONE_FIELDS)) {
    const { value, error } = normalizeHormoneEntry(field, log?.[field], units?.[field])
    values[field] = value
    if (error) errors[field] = error
  }
  return { values, errors }
}
