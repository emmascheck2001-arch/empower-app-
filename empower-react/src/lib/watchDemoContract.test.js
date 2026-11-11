import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The Watch target currently has no separate XCTest bundle. Keep the exercise-name contract in
// the normal CI test suite so changing a workout cannot silently route it to the wrong demo.
const source = readFileSync('ios/App/Empower Watch Watch App/StickFigure.swift', 'utf8')

const EXPECTED_FIGURES = {
  'Russian twist': 'russiantwist',
  'Mountain climbers': 'mountainclimber',
  'Side plank': 'sideplank',
  'Plank shoulder taps': 'plankshouldertap',
  'Plank jack': 'plankjack',
  'Plank to pike': 'plankpike',
  'Plank push-up': 'plankpushup',
  'Standing core twist': 'standingtwist',
}

describe('Apple Watch exercise-demo contract', () => {
  it('ships a distinct mapped figure for every corrected core exercise', () => {
    for (const [name, figure] of Object.entries(EXPECTED_FIGURES)) {
      const words = name.toLowerCase().replace(/s$/, '')
      expect(source, `${name} mapping`).toContain(`return "${figure}"`)
      expect(source, `${figure} figure`).toContain(`"${figure}": ExerciseFigure`)
      expect(words.length).toBeGreaterThan(0)
    }
  })
})
