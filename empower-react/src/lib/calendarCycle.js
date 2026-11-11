import { getOvulationDay } from './hormoneSync.js'

// Historical cycles can differ from the current average. The fertility estimate must use the
// length of the cycle being displayed so its fertile days remain aligned with its phase colours.
export function estimatedOvulationDayForPhase(phaseInfo, learnedLutealLength, signalOvulationDay = null) {
  const cycleLength = phaseInfo?.cycleLength
  if (!cycleLength) return null
  const signalDay = Number(signalOvulationDay)
  // A recent LH or cervical-fluid signal can refine the active cycle only. It remains an
  // estimate, so reject implausible values rather than inventing a precise ovulation date.
  if (Number.isInteger(signalDay) && signalDay >= 8 && signalDay <= cycleLength - 7) return signalDay
  return getOvulationDay(cycleLength, learnedLutealLength)
}

export function isEstimatedFertilePhaseDay(phaseInfo, learnedLutealLength, signalOvulationDay = null) {
  const cycleDay = phaseInfo?.cycleDay
  const ovulationDay = estimatedOvulationDayForPhase(phaseInfo, learnedLutealLength, signalOvulationDay)
  if (!cycleDay || !ovulationDay) return false
  return cycleDay >= ovulationDay - 5 && cycleDay <= ovulationDay + 1
}
